import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Config } from './config';
import { HttpError } from './lib/errors';
import { createAccessTokens } from './auth/accessToken';
import { createRefreshTokens } from './auth/refreshTokens';
import { createMailer, type Mailer } from './auth/mailer';
import { authRoutes } from './auth/routes';

export interface AppDeps {
  prisma: PrismaClient;
  redis: Redis;
  mailer?: Mailer;
}

export async function buildApp(config: Config, deps: AppDeps) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    // Chỉ tin X-Forwarded-For từ đúng số proxy phía trước, tránh client tự giả IP.
    trustProxy: (_addr: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 16 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.CLIENT_ORIGIN, credentials: true });
  await app.register(cookie);

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof HttpError) {
      if (err.retryAfterSec) reply.header('Retry-After', err.retryAfterSec);
      return reply.code(err.statusCode).send({ error: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'Yêu cầu không hợp lệ' });
    }
    request.log.error(err);
    return reply.code(500).send({ error: 'Đã có lỗi xảy ra, vui lòng thử lại' });
  });

  const accessTokens = createAccessTokens(config.JWT_ACCESS_SECRET);

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  await authRoutes(app, {
    config,
    prisma: deps.prisma,
    redis: deps.redis,
    mailer: deps.mailer ?? createMailer(config, app.log),
    accessTokens,
    refreshTokens: createRefreshTokens(deps.prisma),
  });

  return Object.assign(app, { accessTokens });
}
