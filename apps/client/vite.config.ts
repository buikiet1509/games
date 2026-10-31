import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // Chunk Phaser (~1,5 MB) chỉ tải sau khi đăng nhập (lazy) nên chấp nhận vượt ngưỡng mặc định.
  build: { chunkSizeWarningLimit: 1700 },
  server: {
    port: 5173,
    // Cùng origin với API khi dev → cookie refresh SameSite=Strict hoạt động như production.
    proxy: { '/api': 'http://localhost:2567' },
  },
});
