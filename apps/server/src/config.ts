import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(2567),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Số proxy tin cậy phía trước (Fly.io = 1). 0 = lấy IP trực tiếp của kết nối. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET cần tối thiểu 32 ký tự'),
    MAIL_FROM: z.string().default('Chùa An Lạc <no-reply@localhost>'),
    RESEND_API_KEY: z.string().optional(),
  })
  .refine((c) => c.NODE_ENV !== 'production' || !c.JWT_ACCESS_SECRET.includes('dev-only'), {
    message: 'Không được dùng JWT secret mặc định ở production',
  })
  .refine((c) => c.NODE_ENV !== 'production' || Boolean(c.RESEND_API_KEY), {
    message: 'Production cần RESEND_API_KEY để gửi email quên mật khẩu',
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Biến môi trường không hợp lệ: ${parsed.error.message}`);
  }
  return parsed.data;
}
