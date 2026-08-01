import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: true, // 广播到局域网 (0.0.0.0)
  },
  plugins: [
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
