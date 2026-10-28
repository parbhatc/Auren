import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../vite.bwcStatic.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { betterweightChartStatic } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-chart-assets-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const bwcRoot = path.join(directory, 'bwc')
  const publicDir = path.join(directory, 'public')
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
  write(path.join(bwcRoot, 'public/chart/sdk.js'), 'export { bootChart } from "../js/sdk.js"')
  write(path.join(bwcRoot, 'public/js/sdk.js'), 'export const bootChart = () => {}')
  const indicatorPath = path.join(publicDir, 'auren-indicators/custom/Indicator.js')
  write(indicatorPath, [
    "import { bootChart } from '/js/sdk.js'",
    "import './side-effect.js?v=4#ready'",
    "export const load = () => import('./lazy.mjs')",
  ].join('\n'))
  const plugin = betterweightChartStatic(bwcRoot)
  plugin.configResolved({ publicDir, root: directory, build: { outDir: 'dist' } })
  const watcher = new EventEmitter()
  watcher.add = () => {}
  const versionModule = {}
  let invalidations = 0
  let middleware
  plugin.configureServer({
    watcher,
    httpServer: new EventEmitter(),
    moduleGraph: {
      getModuleById: () => versionModule,
      invalidateModule: (module) => { assert.equal(module, versionModule); invalidations += 1 },
    },
    middlewares: { use: (handler) => { middleware = handler } },
  })
  const version = () => JSON.parse(plugin.load('\0virtual:auren-chart-version').replace('export default ', ''))
  const request = (url, { method = 'GET', headers = {} } = {}) => {
    const response = {
      headers: {}, statusCode: 200, body: undefined,
      setHeader(name, value) { this.headers[name] = value },
      end(body) { this.body = body?.toString() },
    }
    middleware({ url, method, headers }, response, () => { response.statusCode = 404 })
    return response
  }
  return { directory, plugin, watcher, indicatorPath, write, version, request, invalidations: () => invalidations }
}

test('chart graph URLs stay stable and cacheable until module content changes', (t) => {
  const f = fixture(t)
  const version = f.version()
  assert.equal(f.version(), version)
  const sdk = f.request(`/chart/sdk.js?bwc=${version}`)
  assert.equal(sdk.headers['Cache-Control'], 'public, max-age=31536000, immutable')
  assert.match(sdk.body, new RegExp(`../js/sdk.js\\?bwc=${version}`))
  const repeated = f.request(`/chart/sdk.js?bwc=${version}`, {
    headers: { 'if-none-match': sdk.headers.ETag },
  })
  assert.equal(repeated.statusCode, 304)
  assert.equal(repeated.body, undefined)
  const head = f.request(`/chart/sdk.js?bwc=${version}`, { method: 'HEAD' })
  assert.equal(head.body, undefined)
  assert.equal(head.headers['Content-Length'], Buffer.byteLength(sdk.body))
  assert.equal(f.request('/chart/sdk.js').headers['Cache-Control'], 'no-cache')

  // A sibling-repository or Auren indicator edit must invalidate both the module
  // version and cached transformed responses, even with Vite HMR disabled.
  f.write(f.indicatorPath, "import { bootChart } from '/js/sdk.js'; export const updated = true")
  f.watcher.emit('all', 'change', f.indicatorPath)
  assert.equal(f.invalidations(), 1)
  const updatedVersion = f.version()
  assert.notEqual(updatedVersion, version)
  const updated = f.request(`/auren-indicators/custom/Indicator.js?bwc=${updatedVersion}`)
  assert.match(updated.body, /updated = true/)
  assert.match(updated.body, new RegExp(`/js/sdk.js\\?bwc=${updatedVersion}`))
  assert.equal(f.request(`/chart/sdk.js?bwc=${version}`).headers['Cache-Control'], 'no-cache')
})

test('Auren indicators and production copies share the SDK graph version', (t) => {
  const f = fixture(t)
  const version = f.version()
  const indicator = f.request(`/auren-indicators/custom/Indicator.js?bwc=${version}`)
  assert.match(indicator.body, new RegExp(`/js/sdk.js\\?bwc=${version}`))
  assert.match(indicator.body, new RegExp(`./side-effect.js\\?v=4&bwc=${version}#ready`))
  assert.match(indicator.body, new RegExp(`./lazy.mjs\\?bwc=${version}`))

  f.plugin.closeBundle()
  const builtIndicator = fs.readFileSync(path.join(f.directory, 'dist/auren-indicators/custom/Indicator.js'), 'utf8')
  const builtSdk = fs.readFileSync(path.join(f.directory, 'dist/chart/sdk.js'), 'utf8')
  assert.equal(builtIndicator, indicator.body)
  assert.match(builtSdk, new RegExp(`../js/sdk.js\\?bwc=${version}`))

  // Restarting with unchanged sources must preserve usable browser cache keys.
  const restarted = betterweightChartStatic(path.join(f.directory, 'bwc'))
  restarted.configResolved({ publicDir: path.join(f.directory, 'public'), root: f.directory, build: { outDir: 'dist' } })
  assert.equal(restarted.load('\0virtual:auren-chart-version'), `export default "${version}"`)
})
