import type { Redis } from 'ioredis';

/**
 * Giữ hồi chiêu trên Redis để đúng cả khi một người mở nhiều tab/room hoặc
 * server chạy nhiều instance. Trả về 0 nếu được phép, ngược lại là số ms còn lại.
 */
export async function tryCooldown(redis: Redis, key: string, ms: number): Promise<number> {
  const ok = await redis.set(`cd:${key}`, 1, 'PX', ms, 'NX');
  if (ok === 'OK') return 0;
  return Math.max(1, await redis.pttl(`cd:${key}`));
}

export async function cooldownRemaining(redis: Redis, key: string): Promise<number> {
  return Math.max(0, await redis.pttl(`cd:${key}`));
}
