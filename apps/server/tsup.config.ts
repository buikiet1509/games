import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // shared chỉ là mã nguồn TS, phải bundle vào bản build.
  noExternal: ['@chua/shared'],
});
