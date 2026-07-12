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

// Unique per server start. Stamped onto every BWC module specifier below so the
// browser fetches a fresh URL each run — see bustModuleSpecifiers().
const BUILD_ID = String(Date.now())

/**
 * Append `?v=<BUILD_ID>` to every relative/root-absolute module specifier in a JS
 * module. `no-store` stops the browser caching NEW responses, but it does not evict
 * entries stored earlier (e.g. before a header/export existed): the ES module loader
 * fetches transitive imports with `cache: "default"`, so a bare URL like `../js/sdk.js`
 * can resolve to a poisoned disk-cache entry and silently run old code — even after a
 * hard reload (dynamic import() ignores the reload's cache bypass). Giving every
 * specifier a per-run query makes each a guaranteed cache-miss, so the whole graph is
 * always fresh. Only `.js/.mjs/.json/.css` paths are touched to avoid rewriting
 * lookalike strings/comments.
 */
function bustModuleSpecifiers(code: string): string {
  const spec = "(\\.{1,2}/[^'\"]*?\\.(?:js|mjs|json|css)|/[^'\"]*?\\.(?:js|mjs|json|css))"
  const stamp = (s: string) => `${s}${s.includes('?') ? '&' : '?'}v=${BUILD_ID}`
  return code
    // static: `... from "./x.js"` / `export ... from "/js/x.js"`
    .replace(new RegExp(`(\\bfrom\\s*)(['"])${spec}(\\2)`, 'g'), (_m, kw, q, s, q2) => `${kw}${q}${stamp(s)}${q2}`)
    // side-effect: `import "./x.js"`
    .replace(new RegExp(`(\\bimport\\s*)(['"])${spec}(\\2)`, 'g'), (_m, kw, q, s, q2) => `${kw}${q}${stamp(s)}${q2}`)
    // dynamic: `import("./x.js")`
    .replace(new RegExp(`(\\bimport\\(\\s*)(['"])${spec}(\\2)(\\s*\\))`, 'g'), (_m, kw, q, s, q2, close) => `${kw}${q}${stamp(s)}${q2}${close}`)
}

function serveFile(res: Connect.ServerResponse, filePath: string): void {
  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  // Dev/preview only (prod copies these into dist and the host serves them).
  // Never cache here — the BWC sources are edited live in the sibling repo and a
  // stale HTTP cache silently runs old modules across reloads.
  res.setHeader('Cache-Control', 'no-store')
  if (ext === '.js' || ext === '.mjs') {
    res.end(bustModuleSpecifiers(fs.readFileSync(filePath, 'utf8')))
    return
  }
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
