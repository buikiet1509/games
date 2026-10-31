import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.ts',
    // Các file test dùng chung DB/Redis → chạy tuần tự.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
