import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev-only proxy to avoid browser CORS issues when calling Janice.
      '/janice': {
        target: 'https://janice.e-351.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/janice/, ''),
      },
    },
  },
})
