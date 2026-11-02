import Fastify, { type FastifyInstance } from 'fastify';
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
import { createLeaderboard } from './services/leaderboard';
import { matchMaker } from '@colyseus/core';
import { AREAS } from '@chua/shared';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';

export interface AppDeps {
  prisma: PrismaClient;
  redis: Redis;
  /** undefined = tự tạo theo cấu hình; null = không gửi email (tắt quên mật khẩu). */
  mailer?: Mailer | null;
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

  // Số người online toàn chùa và từng khu (cộng mọi room/bản sao; nhiều instance thì qua Redis driver).
  let onlineCache: { at: number; body: unknown } | undefined;
  app.get('/api/online', async () => {
    if (onlineCache && Date.now() - onlineCache.at < 3000) return onlineCache.body;
    const rooms = await matchMaker.query({});
    const areas = Object.fromEntries(AREAS.map((a) => [a.id, 0])) as Record<string, number>;
    for (const r of rooms) if (r.name in areas) areas[r.name]! += r.clients;
    const body = { total: Object.values(areas).reduce((a, b) => a + b, 0), areas };
    onlineCache = { at: Date.now(), body };
    return body;
  });

  const leaderboard = createLeaderboard(deps.redis);
  const leaderboardQuery = z.object({
    period: z.enum(['day', 'week', 'all']).default('day'),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  });
  app.get('/api/leaderboard', async (request) => {
    const q = leaderboardQuery.safeParse(request.query);
    if (!q.success) throw new HttpError(400, 'Tham số không hợp lệ');
    return { period: q.data.period, entries: await leaderboard.top(q.data.period, q.data.limit) };
  });

  if (config.SERVE_CLIENT_DIR) await serveClient(app, path.resolve(config.SERVE_CLIENT_DIR));

  await authRoutes(app, {
    config,
    prisma: deps.prisma,
    redis: deps.redis,
    mailer: deps.mailer === undefined ? createMailer(config, app.log) : deps.mailer,
    accessTokens,
    refreshTokens: createRefreshTokens(deps.prisma),
  });

  // Trả về object bọc ngoài: instance Fastify là thenable nên `await` sẽ "mở" mất thuộc tính gắn thêm.
  return { app, accessTokens };
}

/**
 * Phục vụ bản build của client cùng địa chỉ với API (một origin duy nhất → cookie đăng nhập
 * hoạt động mà không cần tên miền riêng). Đường dẫn lạ (vd. /dat-lai-mat-khau) trả index.html.
 */
async function serveClient(app: FastifyInstance, dir: string) {
  if (!existsSync(path.join(dir, 'index.html'))) {
    app.log.warn({ dir }, 'Không thấy bản build client, bỏ qua phục vụ trang web');
    return;
  }
  await app.register(fastifyStatic, {
    root: dir,
    wildcard: false,
    cacheControl: false, // tự đặt Cache-Control ở setHeaders
    setHeaders(res, file) {
      // File trong assets/ có hash trong tên → cache lâu; index.html luôn lấy bản mới.
      res.setHeader(
        'Cache-Control',
        file.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });
  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split('?')[0]!;
    if (request.method !== 'GET' || url.startsWith('/api/') || path.extname(url)) {
      return reply.code(404).send({ error: 'Không tìm thấy' });
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });
}
