import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { build as bundleModules, version as esbuildVersion } from 'esbuild'
import type { ServerResponse } from 'node:http'
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

const VERSION_MODULE = 'virtual:auren-chart-version'
const RESOLVED_VERSION_MODULE = `\0${VERSION_MODULE}`
const VERSIONED_EXTENSIONS = /\.(?:js|mjs|json|css)$/
const BUNDLE_DIRECTORY = '/chart/_bundled'
const CHART_ENTRYPOINTS = [
  '/chart/sdk.js',
  '/testing/js/indicators/fvg/FvgIndicator.js',
  '/testing/js/indicators/levels/LevelsIndicator.js',
  '/testing/js/indicators/inputPanels.js',
  '/testing/js/indicators/presets.js',
  '/auren-indicators/custom-setups/CustomSetupsPaperIndicator.js',
  '/auren-indicators/nice-sweep/NiceSweepIndicator.js',
]
// Direct SDK/debug imports and raw extension modules must reach the same state
// as the bundled widget. These original URLs become shared esbuild entrypoints,
// rather than leaving a second copy of a registry behind the raw fallback.
const SHARED_ENTRYPOINTS = [
  '/js/sdk.js',
  '/js/indicators/catalog.js',
  '/js/indicators/presets.js',
  '/js/indicators/ui/customInputPanels.js',
  '/js/indicators/BaseIndicator.js',
  '/js/indicators/BarScriptIndicator.js',
  '/js/indicators/ComputeIndicator.js',
  '/js/chart/hostHooks.js',
  '/js/chart/features.js',
  '/js/chart/orderLine/theme.js',
  '/js/debug/chart/index.js',
  '/js/debug/chart/liveControl.js',
  '/js/ui/chart/hostInteraction.js',
  '/js/app/bar/resolutionCache.js',
  '/js/app/bar/htfBarCache.js',
]

type AssetResponse = { body: Buffer; etag: string }
type ChartBundle = { version: string; assets: Map<string, AssetResponse> }

/**
 * Use the same content version for root and transitive imports, including Auren's
 * own indicators. This also keeps a single SDK registry: importing /js/sdk.js with
 * different query strings would create independent instances of its module state.
 */
function versionModuleSpecifiers(code: string, version: string): string {
  const spec = "((?:\\.{1,2}/|/)[^'\"]*?\\.(?:js|mjs|json|css)(?:\\?[^'\"#]*)?(?:#[^'\"]*)?)"
  const stamp = (specifier: string) => {
    const url = new URL(specifier, 'http://chart.local')
    url.searchParams.set('bwc', version)
    // Keep relative imports relative to their original module.
    const [pathname] = specifier.split(/[?#]/)
    return `${pathname}${url.search}${url.hash}`
  }
  return code
    // static: `... from "./x.js"` / `export ... from "/js/x.js"`
    .replace(new RegExp(`(\\bfrom\\s*)(['"])${spec}(\\2)`, 'g'), (_m, kw, q, s, q2) => `${kw}${q}${stamp(s)}${q2}`)
    // side-effect: `import "./x.js"`
    .replace(new RegExp(`(\\bimport\\s*)(['"])${spec}(\\2)`, 'g'), (_m, kw, q, s, q2) => `${kw}${q}${stamp(s)}${q2}`)
    // dynamic: `import("./x.js")`
    .replace(new RegExp(`(\\bimport\\(\\s*)(['"])${spec}(\\2)(\\s*\\))`, 'g'), (_m, kw, q, s, q2, close) => `${kw}${q}${stamp(s)}${q2}${close}`)
}

function copyDir(src: string, dest: string, version: string): void {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to, version)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      fs.writeFileSync(to, versionModuleSpecifiers(fs.readFileSync(from, 'utf8'), version), 'utf8')
    } else fs.copyFileSync(from, to)
  }
}

/**
 * Serve BetterweightChartPro `public/` and testing_web indicator assets from the
 * `betterweightchartpro` npm package (github:parbhatc/BetterweightChartPro).
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
    { prefix: '/auren-indicators', root: path.resolve('public/auren-indicators'), distSubdir: 'auren-indicators' },
  ]

  let outDir = path.resolve('dist')
  let assetVersion: string | null = null
  let bundlePromise: Promise<ChartBundle> | null = null
  const responses = new Map<string, AssetResponse>()

  function fileForUrl(url: string): string | null {
    const pathname = url.split(/[?#]/)[0]
    for (const { prefix, root } of roots) {
      if (!pathname.startsWith(prefix + '/')) continue
      return safeUnder(root, pathname.slice(prefix.length + 1))
    }
    return null
  }

  function urlForFile(filePath: string): string | null {
    for (const { prefix, root } of roots) {
      const relative = path.relative(root, filePath)
      if (relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) {
        return `${prefix}/${relative.split(path.sep).join('/')}`
      }
    }
    return null
  }

  function getAssetVersion(): string {
    if (assetVersion) return assetVersion
    const hash = createHash('sha256').update(`auren-chart-bundle-v1\0${esbuildVersion}\0`)
    hash.update(JSON.stringify([...CHART_ENTRYPOINTS, ...SHARED_ENTRYPOINTS]))
    const addDirectory = (directory: string, prefix: string) => {
      if (!fs.existsSync(directory)) return
      const entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        const filePath = path.join(directory, entry.name)
        const url = `${prefix}/${entry.name}`
        if (entry.isDirectory()) addDirectory(filePath, url)
        else if (VERSIONED_EXTENSIONS.test(entry.name)) {
          hash.update(url)
          hash.update('\0')
          hash.update(fs.readFileSync(filePath))
          hash.update('\0')
        }
      }
    }
    // Hash served module assets once, then again only after a source edit. The
    // version is stable across reloads/restarts and changes with actual content.
    for (const { root, prefix } of roots) addDirectory(root, prefix)
    assetVersion = hash.digest('hex').slice(0, 20)
    return assetVersion
  }

  function assetResponse(body: Buffer): AssetResponse {
    return { body, etag: `"${createHash('sha256').update(body).digest('hex')}"` }
  }

  async function createChartBundle(version: string): Promise<ChartBundle> {
    const entryPoints: Record<string, string> = {}
    for (const url of [...CHART_ENTRYPOINTS, ...SHARED_ENTRYPOINTS]) {
      const filePath = fileForUrl(url)
      // Small fixtures and older BWC packages can omit optional host studies.
      // Existing files still bundle together; absent URLs retain normal 404s.
      if (filePath && fs.existsSync(filePath)) entryPoints[url.slice(1, -3)] = filePath
    }
    const assets = new Map<string, AssetResponse>()
    if (!Object.keys(entryPoints).length) return { version, assets }
    const bundleOutDir = path.resolve(outDir, '.chart-bundle')
    const result = await bundleModules({
      entryPoints,
      outdir: bundleOutDir,
      write: false,
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      minify: true,
      entryNames: '[dir]/[name]',
      chunkNames: 'chart/_bundled/[name]-[hash]',
      assetNames: 'chart/_bundled/[name]-[hash]',
      logLevel: 'silent',
      plugins: [{
        name: 'auren-chart-public-urls',
        setup(builder) {
          builder.onResolve({ filter: /^(?:\.{1,2}\/|\/|prochart$)/ }, (args) => {
            // Keep the engine on its canonical import-map/raw URLs. A raw
            // extension and the bundled widget must never load distinct engine
            // classes or copies of its interaction state.
            if (args.path === 'prochart') return { path: args.path, external: true }
            const filePath = args.path.startsWith('/')
              ? fileForUrl(args.path)
              : path.resolve(args.resolveDir, args.path)
            if (!filePath) return undefined
            const url = urlForFile(filePath)
            if (url?.startsWith('/vendor/')) return { path: url, external: true }
            if (args.path.startsWith('/')) return { path: filePath }
            return undefined
          })
        },
      }],
    })
    for (const output of result.outputFiles) {
      const url = `/${path.relative(bundleOutDir, output.path).split(path.sep).join('/')}`
      const body = Buffer.from(output.contents)
      assets.set(url, assetResponse(/\.(?:js|mjs)$/.test(url)
        ? Buffer.from(versionModuleSpecifiers(body.toString('utf8'), version))
        : body))
    }
    return { version, assets }
  }

  async function getChartBundle(): Promise<ChartBundle> {
    if (!bundlePromise) {
      const pending = createChartBundle(getAssetVersion())
      bundlePromise = pending
      pending.catch(() => { if (bundlePromise === pending) bundlePromise = null })
    }
    const current = bundlePromise
    const bundle = await current
    // An edit during compilation must not publish an old graph under the new
    // content version, including when several entry requests arrive together.
    if (current !== bundlePromise) return getChartBundle()
    return bundle
  }

  function serveAsset(req: Connect.IncomingMessage, res: ServerResponse, url: string, cached: AssetResponse, version: string): void {
    res.setHeader('Content-Type', MIME[path.extname(url)] || 'application/octet-stream')
    res.setHeader('ETag', cached.etag)
    const requestVersion = new URL(req.url ?? '/', 'http://chart.local').searchParams.get('bwc')
    res.setHeader('Cache-Control', requestVersion === version
      ? 'public, max-age=31536000, immutable'
      : 'no-cache')
    if (req.headers['if-none-match'] === cached.etag) {
      res.statusCode = 304
      res.end()
      return
    }
    res.setHeader('Content-Length', cached.body.length)
    res.end(req.method === 'HEAD' ? undefined : cached.body)
  }

  function serveFile(req: Connect.IncomingMessage, res: ServerResponse, filePath: string): void {
    const version = getAssetVersion()
    const ext = path.extname(filePath)
    let cached = responses.get(filePath)
    if (!cached) {
      const raw = fs.readFileSync(filePath)
      const body = ext === '.js' || ext === '.mjs'
        ? Buffer.from(versionModuleSpecifiers(raw.toString('utf8'), version))
        : raw
      cached = assetResponse(body)
      responses.set(filePath, cached)
    }
    serveAsset(req, res, filePath, cached, version)
  }

  async function tryServe(req: Connect.IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url?.split('?')[0] ?? ''
    if ([...CHART_ENTRYPOINTS, ...SHARED_ENTRYPOINTS].includes(url) || url.startsWith(BUNDLE_DIRECTORY + '/')) {
      const bundle = await getChartBundle()
      const asset = bundle.assets.get(url)
      if (asset) {
        serveAsset(req, res, url, asset, bundle.version)
        return true
      }
    }
    for (const { prefix, root } of roots) {
      if (!url.startsWith(prefix + '/') && url !== prefix) continue
      const rel = url.slice(prefix.length).replace(/^\//, '') || 'index.js'
      const filePath = safeUnder(root, rel)
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        continue
      }
      serveFile(req, res, filePath)
      return true
    }
    return false
  }

  return {
    name: 'betterweightchartpro-static',
    configResolved(config) {
      roots[roots.length - 1].root = path.join(config.publicDir, 'auren-indicators')
      outDir = path.resolve(config.root, config.build.outDir)
    },
    resolveId(id) {
      if (id === VERSION_MODULE) return RESOLVED_VERSION_MODULE
    },
    load(id) {
      if (id === RESOLVED_VERSION_MODULE) {
        return `export default ${JSON.stringify(getAssetVersion())}`
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        const version = getAssetVersion()
        const urls = CHART_ENTRYPOINTS.map((url) => `${url}?bwc=${version}`)
        return [{
          tag: 'script',
          attrs: { 'data-auren-chart-preload': '' },
          injectTo: 'head',
          // Append after the document's import map, while the Vite application
          // graph is still loading. Modulepreload fetches public code without
          // evaluating indicators or starting an authenticated account request.
          children: `(()=>{try{if(location.pathname!=="/trade"||!localStorage.getItem("token"))return;for(const href of ${JSON.stringify(urls)}){const link=document.createElement("link");link.rel="modulepreload";link.href=href;document.head.appendChild(link)}}catch{}})()`,
        }]
      },
    },
    configureServer(server) {
      const watchedRoots = roots.map(({ root }) => path.resolve(root))
      server.watcher.add(watchedRoots)
      const onAssetChange = (_event: string, filePath: string) => {
        const absolute = path.resolve(filePath)
        if (!watchedRoots.some((root) => absolute.startsWith(root + path.sep))) return
        assetVersion = null
        bundlePromise = null
        responses.clear()
        const versionModule = server.moduleGraph.getModuleById(RESOLVED_VERSION_MODULE)
        if (versionModule) server.moduleGraph.invalidateModule(versionModule)
      }
      server.watcher.on('all', onAssetChange)
      server.httpServer?.once('close', () => server.watcher.off('all', onAssetChange))
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        void tryServe(req, res).then((served) => { if (!served) next() }, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        void tryServe(req, res).then((served) => { if (!served) next() }, next)
      })
    },
    async closeBundle() {
      const version = getAssetVersion()
      for (const { root, distSubdir } of roots) {
        copyDir(root, path.join(outDir, distSubdir), version)
      }
      const bundle = await getChartBundle()
      bundle.assets.forEach((asset, url) => {
        const destination = safeUnder(outDir, url.slice(1))
        if (!destination) throw new Error(`Invalid chart bundle output: ${url}`)
        fs.mkdirSync(path.dirname(destination), { recursive: true })
        fs.writeFileSync(destination, asset.body)
      })
    },
  }
}
