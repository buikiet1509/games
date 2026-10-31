import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  MERIT,
  type AuthResponse,
  type PublicUser,
} from '@chua/shared';
import type { Config } from '../config';
import { HttpError, parseBody } from '../lib/errors';
import { hitRateLimit } from '../lib/rateLimit';
import { randomToken, sha256 } from '../lib/crypto';
import type { AccessTokens } from './accessToken';
import type { RefreshTokens, IssuedRefresh } from './refreshTokens';
import { createLockout } from './lockout';
import { checkPasswordPolicy, hashPassword, verifyPassword } from './passwords';
import type { Mailer } from './mailer';
import { requireAuth } from './guard';

export const REFRESH_COOKIE = 'chua_rt';
const COOKIE_PATH = '/api/auth';
const RESET_TTL_MS = 30 * 60_000;
const INVALID_CREDENTIALS = 'Sai tên đăng nhập hoặc mật khẩu';

export interface AuthDeps {
  config: Config;
  prisma: PrismaClient;
  redis: Redis;
  mailer: Mailer;
  accessTokens: AccessTokens;
  refreshTokens: RefreshTokens;
}

const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  username: u.username,
  email: u.email,
  robeColor: u.robeColor,
  merit: u.merit,
});

export async function authRoutes(app: FastifyInstance, deps: AuthDeps) {
  const { prisma, redis, mailer, accessTokens, refreshTokens, config } = deps;
  const lockout = createLockout(redis);

  async function limit(key: string, max: number, windowSec: number) {
    const r = await hitRateLimit(redis, key, max, windowSec);
    if (!r.allowed) {
      throw new HttpError(429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau', r.retryAfterSec);
    }
  }

  function setRefreshCookie(reply: FastifyReply, refresh: IssuedRefresh) {
    reply.setCookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: COOKIE_PATH,
      // Không "ghi nhớ" → cookie phiên, mất khi đóng trình duyệt.
      ...(refresh.remember ? { expires: refresh.expiresAt } : {}),
    });
  }

  async function startSession(reply: FastifyReply, user: User, remember: boolean) {
    setRefreshCookie(reply, await refreshTokens.issue(user.id, remember));
    const body: AuthResponse = {
      accessToken: await accessTokens.sign({ userId: user.id, username: user.username }),
      user: toPublicUser(user),
    };
    return body;
  }

  const readRefreshCookie = (request: FastifyRequest) => request.cookies[REFRESH_COOKIE];

  app.post('/api/auth/register', async (request, reply) => {
    await limit(`register:ip:${request.ip}`, 10, 3600);
    const input = parseBody(registerSchema, request.body);
    const weak = checkPasswordPolicy(input.password, input.username);
    if (weak) throw new HttpError(400, weak);

    let user: User;
    try {
      user = await prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash: await hashPassword(input.password),
          robeColor: input.robeColor,
          merit: MERIT.starting,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(409, 'Tên đăng nhập hoặc email đã được sử dụng');
      }
      throw err;
    }
    reply.code(201);
    return startSession(reply, user, false);
  });

  app.post('/api/auth/login', async (request, reply) => {
    await limit(`login:ip:${request.ip}`, 20, 60);
    const input = parseBody(loginSchema, request.body);

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: input.identifier }, { email: input.identifier }] },
    });
    // Không có tài khoản vẫn đếm/khoá theo identifier → hành vi giống hệt, không lộ tài khoản.
    const subject = user ? `user:${user.id}` : `id:${input.identifier}`;

    if (await lockout.isLocked(subject)) {
      throw new HttpError(429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút');
    }
    const ok = await verifyPassword(user?.passwordHash, input.password);
    if (!user || !ok) {
      await lockout.recordFailure(subject);
      throw new HttpError(401, INVALID_CREDENTIALS);
    }
    await lockout.clear(subject);
    return startSession(reply, user, input.remember ?? false);
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    await limit(`refresh:ip:${request.ip}`, 60, 60);
    const token = readRefreshCookie(request);
    const refresh = token ? await refreshTokens.rotate(token) : null;
    const user = refresh ? await prisma.user.findUnique({ where: { id: refresh.userId } }) : null;
    if (!refresh || !user) {
      reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      throw new HttpError(401, 'Phiên đăng nhập đã hết hạn');
    }
    setRefreshCookie(reply, refresh);
    const body: AuthResponse = {
      accessToken: await accessTokens.sign({ userId: user.id, username: user.username }),
      user: toPublicUser(user),
    };
    return body;
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readRefreshCookie(request);
    if (token) await refreshTokens.revoke(token);
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return reply.code(204).send();
  });

  app.post('/api/auth/forgot', async (request, reply) => {
    await limit(`forgot:ip:${request.ip}`, 5, 900);
    const { email } = parseBody(forgotPasswordSchema, request.body);
    const generic = { message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.' };

    const perEmail = await hitRateLimit(redis, `forgot:email:${email}`, 3, 3600);
    const user = perEmail.allowed ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user) {
      const token = randomToken();
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: sha256(token),
            expiresAt: new Date(Date.now() + RESET_TTL_MS),
          },
        }),
      ]);
      const link = `${config.CLIENT_ORIGIN}/dat-lai-mat-khau?token=${token}`;
      await mailer.send({
        to: user.email,
        subject: 'Đặt lại mật khẩu — Chùa An Lạc Online',
        text: `Chào ${user.username},\n\nNhấp vào liên kết sau để đặt lại mật khẩu (hết hạn sau 30 phút):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    }
    return reply.code(202).send(generic);
  });

  app.post('/api/auth/reset', async (request, reply) => {
    await limit(`reset:ip:${request.ip}`, 10, 900);
    const input = parseBody(resetPasswordSchema, request.body);
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(input.token) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      throw new HttpError(400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    const weak = checkPasswordPolicy(input.password, row.user.username);
    if (weak) throw new HttpError(400, weak);

    const passwordHash = await hashPassword(input.password);
    const { count } = await prisma.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      throw new HttpError(400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    await prisma.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await refreshTokens.revokeAllForUser(row.userId); // đăng xuất mọi thiết bị
    await lockout.clear(`user:${row.userId}`);
    return reply.code(204).send();
  });

  app.get('/api/me', { preHandler: requireAuth(accessTokens) }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
    if (!user) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn');
    return { user: toPublicUser(user) };
  });
}
