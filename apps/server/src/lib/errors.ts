import type { ZodSchema } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  }
  return parsed.data;
}
