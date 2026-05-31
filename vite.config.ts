import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'tradingview-chart': path.resolve(rootDir, 'node_modules/tradingview-chart/src'),
    },
  },
  server: {
    port: 3000,
    host: true, // Allow external connections (0.0.0.0)
    strictPort: false, // Allow port to be changed if 3000 is in use
    hmr: false, // Disable Hot Module Replacement (auto refresh)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Silent error handling
          })
        }
      },
      '/tradesea-mds-ws': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/tradesea-trades-ws': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/tradesea-instruments': {
        target: 'https://api-instruments-delayed.tradesea.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tradesea-instruments/, ''),
      },
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['@microsoft/signalr']
        }
      }
    }
  }
})

