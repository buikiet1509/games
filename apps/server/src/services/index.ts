import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import type { AccessTokens } from '../auth/accessToken';
import { Batcher } from './batcher';
import { createLeaderboard } from './leaderboard';
import { createMeritLedger } from './merit';
import { createProfanityFilter } from './moderation';

export interface PrayerRow {
  id: string;
  userId: string;
  text: string;
  areaId: string;
  createdAt: Date;
}

/** Các dịch vụ dùng chung cho mọi room trong một process. */
export function createGameServices(opts: {
  prisma: PrismaClient;
  redis: Redis;
  accessTokens: AccessTokens;
  log: FastifyBaseLogger;
  profanityExtra?: string[];
}) {
  const { prisma, redis, log } = opts;
  const logError = (what: string) => (err: unknown) => log.error({ err }, what);
  const services = {
    prisma,
    redis,
    log,
    accessTokens: opts.accessTokens,
    merit: createMeritLedger(prisma, logError('Ghi phước theo lô thất bại')),
    leaderboard: createLeaderboard(redis),
    prayers: new Batcher<PrayerRow>(
      async (rows) => {
        await prisma.prayer.createMany({ data: rows, skipDuplicates: true });
      },
      2000,
      logError('Ghi lời nguyện theo lô thất bại'),
    ),
    profanity: createProfanityFilter(opts.profanityExtra),
    start() {
      services.merit.start();
      services.prayers.start();
    },
    async stop() {
      await Promise.allSettled([services.merit.stop(), services.prayers.stop()]);
    },
  };
  return services;
}

export type GameServices = ReturnType<typeof createGameServices>;
