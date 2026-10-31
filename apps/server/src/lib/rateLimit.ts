import type { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** Fixed-window counter: tối đa `limit` lần trong `windowSec` giây cho mỗi key. */
export async function hitRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const k = `rl:${key}`;
  const res = await redis.multi().set(k, 0, 'EX', windowSec, 'NX').incr(k).pttl(k).exec();
  const count = Number(res?.[1]?.[1] ?? 0);
  const pttl = Number(res?.[2]?.[1] ?? windowSec * 1000);
  return { allowed: count <= limit, retryAfterSec: Math.max(1, Math.ceil(pttl / 1000)) };
}
