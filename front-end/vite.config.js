import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite proxy: chuyển /api và /socket.io sang backend Node.js (cổng 3000) khi dev.
// Khi build production, frontend thường được serve qua nginx cùng host nên proxy không cần.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
