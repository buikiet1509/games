import type { Redis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import type { LeaderboardEntry, LeaderboardPeriod } from '@chua/shared';
import { vnDateKey, vnIsoWeekKey, vnStartOfDay, vnStartOfWeek } from './time';

const NAMES = 'lb:names';
export const LEADERBOARD_CHANNEL = 'lb:changed';

const keyFor = (period: LeaderboardPeriod, now: Date) =>
  period === 'day'
    ? `lb:day:${vnDateKey(now)}`
    : period === 'week'
      ? `lb:week:${vnIsoWeekKey(now)}`
      : 'lb:all';

/** Bảng công đức trên Redis sorted set; Postgres (bảng Donation) là nguồn để dựng lại. */
export function createLeaderboard(redis: Redis) {
  return {
    async add(userId: string, name: string, amount: number, now = new Date()) {
      await redis
        .multi()
        .zincrby(keyFor('day', now), amount, userId)
        .expire(keyFor('day', now), 3 * 86400)
        .zincrby(keyFor('week', now), amount, userId)
        .expire(keyFor('week', now), 15 * 86400)
        .zincrby(keyFor('all', now), amount, userId)
        .hset(NAMES, userId, name)
        .exec();
    },

    async top(
      period: LeaderboardPeriod,
      limit = 10,
      now = new Date(),
    ): Promise<LeaderboardEntry[]> {
      const raw = await redis.zrevrange(keyFor(period, now), 0, limit - 1, 'WITHSCORES');
      const ids: string[] = [];
      const scores: number[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        ids.push(raw[i]!);
        scores.push(Number(raw[i + 1]));
      }
      const names = ids.length ? await redis.hmget(NAMES, ...ids) : [];
      return ids.map((_, i) => ({ rank: i + 1, name: names[i] ?? 'Phật tử', score: scores[i]! }));
    },

    /** Khi Redis mất dữ liệu (khởi động lại, đổi instance), dựng lại từ lịch sử công đức. */
    async rebuildIfEmpty(prisma: PrismaClient, now = new Date()) {
      if (await redis.exists(keyFor('all', now))) return false;
      const ranges: [LeaderboardPeriod, Date | undefined][] = [
        ['all', undefined],
        ['week', vnStartOfWeek(now)],
        ['day', vnStartOfDay(now)],
      ];
      const multi = redis.multi();
      for (const [period, since] of ranges) {
        const rows = await prisma.donation.groupBy({
          by: ['userId'],
          where: { showName: true, ...(since ? { createdAt: { gte: since } } : {}) },
          _sum: { amount: true },
        });
        for (const r of rows) multi.zadd(keyFor(period, now), r._sum.amount ?? 0, r.userId);
      }
      const users = await prisma.user.findMany({
        where: { donations: { some: { showName: true } } },
        select: { id: true, username: true },
      });
      for (const u of users) multi.hset(NAMES, u.id, u.username);
      await multi.exec();
      return true;
    },
  };
}

export type Leaderboard = ReturnType<typeof createLeaderboard>;
