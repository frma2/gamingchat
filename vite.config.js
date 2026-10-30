import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
    },
  },
})
