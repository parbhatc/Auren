import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolveBwcRoot } from './scripts/resolve-bwc-root.mjs'
import { betterweightChartStatic } from './vite.bwcStatic'

const bwcRoot = resolveBwcRoot()
const devHttps =
  process.env.VITE_DEV_HTTPS === '1' || process.env.VITE_DEV_HTTPS === 'true'

export default defineConfig({
  plugins: [
    ...(devHttps ? [basicSsl()] : []),
    react(),
    betterweightChartStatic(bwcRoot),
  ],
  server: {
    port: 3000,
    host: true,
    strictPort: false,
    hmr: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {})
        },
      },
      '^/news/(config|calendar)': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => `/api${p}`,
      },
      '/tradesea-mds-ws': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/tradesea-trades-ws': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/practice-account-ws': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/backtester-ws': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/backtester/data-management-ws': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/tradesea-instruments': {
        target: 'https://api-instruments-delayed.tradesea.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/tradesea-instruments/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      external: (id) =>
        id.startsWith('/chart/') ||
        id.startsWith('/testing/') ||
        id.startsWith('/js/'),
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['@microsoft/signalr'],
        },
      },
    },
  },
})
