import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electric/estimator-core': path.resolve(__dirname, '../packages/estimator-core/src/index.ts')
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.dev'
    ],
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.dev'
    ]
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
