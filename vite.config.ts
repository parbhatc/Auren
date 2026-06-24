import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { betterweightChartStatic } from './vite.bwcStatic'

const require = createRequire(import.meta.url)

function resolveBetterweightChartRoot(): string {
  try {
    const sdkPath = require.resolve('betterweightchart')
    return path.resolve(path.dirname(sdkPath), '..', '..')
  } catch {
    throw new Error(
      'BetterweightChart is not installed. Run npm install (dependency: github:parbhatc/BetterweightChart)'
    )
  }
}

const bwcRoot = resolveBetterweightChartRoot()

export default defineConfig({
  plugins: [react(), betterweightChartStatic(bwcRoot)],
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
      '/news': {
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
