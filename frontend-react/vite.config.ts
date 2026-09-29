import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/analyze': 'http://127.0.0.1:5173',
      '/source': 'http://127.0.0.1:5173',
      '/refactor': 'http://127.0.0.1:5173',
      '/health': 'http://127.0.0.1:5173',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../frontend'),
    emptyOutDir: true,
  },
})
