import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Satu build statis yang dipakai web/PWA, Tauri (desktop) dan Capacitor (Android).
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
