import request from 'supertest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createPrisma } from '../src/db/prisma';
import { createRedis } from '../src/lib/redis';
import { MemoryMailer } from '../src/auth/mailer';
import { REFRESH_COOKIE } from '../src/auth/routes';
import { TEST_ENV } from './env';

export async function createTestContext() {
  const config = loadConfig({ ...TEST_ENV });
  const prisma = createPrisma(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  const mailer = new MemoryMailer();
  const { app, accessTokens } = await buildApp(config, { prisma, redis, mailer });
  await app.ready();

  return {
    app,
    accessTokens,
    prisma,
    redis,
    mailer,
    http: () => request(app.server),
    async reset() {
      await prisma.$executeRawUnsafe(
        'TRUNCATE "User", "RefreshToken", "PasswordResetToken", "Donation", "Prayer", "Report" CASCADE',
      );
      await redis.flushdb();
      mailer.sent = [];
    },
    async close() {
      await app.close();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

/** Lấy giá trị refresh cookie từ header Set-Cookie (chuỗi rỗng nếu bị xoá). */
export function refreshCookieOf(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const line = list.find((c: string) => c.startsWith(`${REFRESH_COOKIE}=`));
  return line ? { line, value: line.split(';')[0]!.slice(REFRESH_COOKIE.length + 1) } : undefined;
}

export const cookieHeader = (value: string) => `${REFRESH_COOKIE}=${value}`;

export const validUser = {
  username: 'minh_tam',
  email: 'MinhTam@Example.com',
  password: 'sen-no-giua-ho-2026',
  robeColor: '#8B1E1E',
};
