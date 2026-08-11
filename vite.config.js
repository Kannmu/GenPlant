import { defineConfig } from 'vite';

export default defineConfig({
  root: 'GenPlant',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500
  },
  server: {
    host: true,
    port: 5173
  },
  preview: {
    port: 4173
  }
});