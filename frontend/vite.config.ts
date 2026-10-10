/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use /SpokeMemo/ base path only for GitHub Pages (when VITE_DEMO_MODE is set)
  base: process.env.VITE_DEMO_MODE === 'true' ? '/SpokeMemo/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // Backend routes live at /api/v1. Do not strip the /api prefix.
      // Override with VITE_DEV_API_TARGET when the API is not on this machine.
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/types/**', 'src/main.tsx'],
    },
  },
});
