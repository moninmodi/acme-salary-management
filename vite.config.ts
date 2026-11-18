/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // FastAPI runs separately in development; nginx does the same proxying in Docker.
    proxy: { '/api': process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000' },
  },
  build: {
    // antd is one long-lived vendor chunk (~390 kB gzip) that browsers cache across releases.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // Split large vendor libraries so the app bundle stays small and caches well.
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design') || id.includes('node_modules/rc-'))
            return 'antd'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
