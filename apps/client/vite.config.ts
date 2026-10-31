import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    // Cùng origin với API khi dev → cookie refresh SameSite=Strict hoạt động như production.
    proxy: { '/api': 'http://localhost:2567' },
  },
});
