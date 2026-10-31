// Test dùng schema Postgres "test" và Redis db 15 riêng, không đụng dữ liệu dev.
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://chua:chua@localhost:5432/chua?schema=test',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  JWT_ACCESS_SECRET: 'test-only-secret-0123456789abcdefghijklmnop',
} as const;
