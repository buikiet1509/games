import { execSync } from 'node:child_process';
import { TEST_ENV } from './env';

// Chỉ áp migration (không phá huỷ) lên schema "test"; mỗi test tự TRUNCATE dữ liệu của nó.
export default function setup() {
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_ENV.DATABASE_URL },
    stdio: 'pipe',
  });
}
