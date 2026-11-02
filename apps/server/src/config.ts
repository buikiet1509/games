import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(2567),
    /** Địa chỉ trang web (CORS, link đặt lại mật khẩu). Render: tự lấy từ RENDER_EXTERNAL_URL. */
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Số proxy tin cậy phía trước (Fly.io = 1). 0 = lấy IP trực tiếp của kết nối. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    /** Header chứa IP thật của người dùng do nền tảng đặt (vd. cf-connecting-ip), nếu có. */
    CLIENT_IP_HEADER: z.string().toLowerCase().optional(),
    /** Thư mục bản build của client để server phục vụ luôn trang web (một địa chỉ duy nhất). */
    SERVE_CLIENT_DIR: z.string().optional(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET cần tối thiểu 32 ký tự'),
    MAIL_FROM: z.string().default('Chùa An Lạc <no-reply@localhost>'),
    RESEND_API_KEY: z.string().optional(),
    /**
     * Chạy nhiều instance game server: chia sẻ room qua Redis (RedisPresence + RedisDriver).
     * Tắt (mặc định) khi chỉ chạy một process.
     */
    COLYSEUS_REDIS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /** Fly.io tự đặt biến này cho mỗi máy; dùng để chuyển kết nối WebSocket về đúng máy giữ room. */
    FLY_MACHINE_ID: z.string().optional(),
    /** Từ cấm bổ sung cho bộ lọc lời nguyện, phân tách bằng dấu phẩy. */
    PROFANITY_EXTRA: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
          : [],
      ),
  })
  .refine((c) => c.NODE_ENV !== 'production' || !c.JWT_ACCESS_SECRET.includes('dev-only'), {
    message: 'Không được dùng JWT secret mặc định ở production',
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse({
    ...env,
    // Render tự cung cấp địa chỉ công khai của service → dùng làm CLIENT_ORIGIN nếu chưa đặt.
    CLIENT_ORIGIN: env.CLIENT_ORIGIN || env.RENDER_EXTERNAL_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Biến môi trường không hợp lệ: ${parsed.error.message}`);
  }
  return parsed.data;
}
