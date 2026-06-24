import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function safeUnder(root: string, urlPath: string): string | null {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '')
  const full = path.resolve(root, rel)
  if (!full.startsWith(root + path.sep) && full !== root) return null
  return full
}

function serveFile(res: Connect.ServerResponse, filePath: string): void {
  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', ext === '.html' ? 'no-store' : 'public, max-age=86400')
  fs.createReadStream(filePath).pipe(res)
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

/**
 * Serve BetterweightChart `public/` and testing_web indicator assets from the
 * `betterweightchart` npm package (github:parbhatc/BetterweightChart).
 */
export function betterweightChartStatic(bwcRoot: string): Plugin {
  const publicRoot = path.join(bwcRoot, 'public')
  const testingRoot = path.join(bwcRoot, 'testing_web', 'frontend')

  const roots: { prefix: string; root: string; distSubdir: string }[] = [
    { prefix: '/chart', root: path.join(publicRoot, 'chart'), distSubdir: 'chart' },
    { prefix: '/js', root: path.join(publicRoot, 'js'), distSubdir: 'js' },
    { prefix: '/css', root: path.join(publicRoot, 'css'), distSubdir: 'css' },
    { prefix: '/vendor', root: path.join(publicRoot, 'vendor'), distSubdir: 'vendor' },
    { prefix: '/testing/js', root: path.join(testingRoot, 'js'), distSubdir: 'testing/js' },
  ]

  function tryServe(req: Connect.IncomingMessage, res: Connect.ServerResponse): boolean {
    const url = req.url?.split('?')[0] ?? ''
    for (const { prefix, root } of roots) {
      if (!url.startsWith(prefix + '/') && url !== prefix) continue
      const rel = url.slice(prefix.length).replace(/^\//, '') || 'index.js'
      const filePath = safeUnder(root, rel)
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        continue
      }
      serveFile(res, filePath)
      return true
    }
    return false
  }

  return {
    name: 'betterweightchart-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        if (tryServe(req, res)) return
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        if (tryServe(req, res)) return
        next()
      })
    },
    closeBundle() {
      const outDir = path.resolve('dist')
      for (const { root, distSubdir } of roots) {
        copyDir(root, path.join(outDir, distSubdir))
      }
    },
  }
}
