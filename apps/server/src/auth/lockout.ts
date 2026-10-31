import type { Redis } from 'ioredis';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_SEC = 15 * 60;

/** Khoá tạm theo tài khoản sau nhiều lần đăng nhập sai liên tiếp. */
export function createLockout(redis: Redis) {
  const failKey = (subject: string) => `login:fail:${subject}`;
  const lockKey = (subject: string) => `login:lock:${subject}`;

  return {
    async isLocked(subject: string) {
      return (await redis.exists(lockKey(subject))) === 1;
    },
    async recordFailure(subject: string) {
      const [[, count]] = (await redis
        .multi()
        .incr(failKey(subject))
        .expire(failKey(subject), LOCK_SEC)
        .exec()) as [[null, number]];
      if (count >= MAX_FAILED_LOGINS) {
        await redis.multi().set(lockKey(subject), 1, 'EX', LOCK_SEC).del(failKey(subject)).exec();
      }
    },
    async clear(subject: string) {
      await redis.del(failKey(subject), lockKey(subject));
    },
  };
}
