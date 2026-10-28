import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../vite.bwcStatic.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replace(/from (['"])esbuild\1/, `from ${JSON.stringify(import.meta.resolve('esbuild'))}`)
const { betterweightChartStatic } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function fixture(t, prepare = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-chart-assets-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const bwcRoot = path.join(directory, 'bwc')
  const publicDir = path.join(directory, 'public')
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
  write(path.join(bwcRoot, 'public/chart/sdk.js'), 'export * from "../js/sdk.js"')
  write(path.join(bwcRoot, 'public/js/sdk.js'), [
    'export const bootChart = () => {}',
    'export { registerIndicator, getIndicatorClass } from "./indicators/catalog.js"',
  ].join('\n'))
  write(path.join(bwcRoot, 'public/js/indicators/catalog.js'), [
    'const registry = new Map()',
    'export const registerIndicator = (definition) => registry.set(definition.id, definition)',
    'export const getIndicatorClass = (id) => registry.get(id)',
  ].join('\n'))
  const indicatorPath = path.join(publicDir, 'auren-indicators/custom/Indicator.js')
  write(indicatorPath, [
    "import { bootChart } from '/js/sdk.js'",
    "import './side-effect.js?v=4#ready'",
    "export const load = () => import('./lazy.mjs')",
  ].join('\n'))
  prepare({ directory, bwcRoot, publicDir, write })
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
  const request = (url, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    const response = {
      headers: {}, statusCode: 200, body: undefined,
      setHeader(name, value) { this.headers[name] = value },
      end(body) { this.body = body?.toString(); resolve(response) },
    }
    middleware({ url, method, headers }, response, (error) => {
      if (error) return reject(error)
      response.statusCode = 404
      resolve(response)
    })
  })
  return { directory, plugin, watcher, indicatorPath, write, version, request, invalidations: () => invalidations }
}

test('chart graph URLs stay stable and cacheable until module content changes', async (t) => {
  const f = fixture(t)
  const version = f.version()
  assert.equal(f.version(), version)
  const sdk = await f.request(`/chart/sdk.js?bwc=${version}`)
  assert.equal(sdk.headers['Cache-Control'], 'public, max-age=31536000, immutable')
  assert.match(sdk.body, new RegExp(`_bundled/[^"']+\\?bwc=${version}`))
  const repeated = await f.request(`/chart/sdk.js?bwc=${version}`, {
    headers: { 'if-none-match': sdk.headers.ETag },
  })
  assert.equal(repeated.statusCode, 304)
  assert.equal(repeated.body, undefined)
  const head = await f.request(`/chart/sdk.js?bwc=${version}`, { method: 'HEAD' })
  assert.equal(head.body, undefined)
  assert.equal(head.headers['Content-Length'], Buffer.byteLength(sdk.body))
  assert.equal((await f.request('/chart/sdk.js')).headers['Cache-Control'], 'no-cache')

  // A sibling-repository or Auren indicator edit must invalidate both the module
  // version and cached transformed responses, even with Vite HMR disabled.
  f.write(f.indicatorPath, "import { bootChart } from '/js/sdk.js'; export const updated = true")
  f.watcher.emit('all', 'change', f.indicatorPath)
  assert.equal(f.invalidations(), 1)
  const updatedVersion = f.version()
  assert.notEqual(updatedVersion, version)
  const updated = await f.request(`/auren-indicators/custom/Indicator.js?bwc=${updatedVersion}`)
  assert.match(updated.body, /updated = true/)
  assert.match(updated.body, new RegExp(`/js/sdk.js\\?bwc=${updatedVersion}`))
  assert.equal((await f.request(`/chart/sdk.js?bwc=${version}`)).headers['Cache-Control'], 'no-cache')
})

test('Auren indicators and production copies share the SDK graph version', async (t) => {
  const f = fixture(t)
  const version = f.version()
  const indicator = await f.request(`/auren-indicators/custom/Indicator.js?bwc=${version}`)
  assert.match(indicator.body, new RegExp(`/js/sdk.js\\?bwc=${version}`))
  assert.match(indicator.body, new RegExp(`./side-effect.js\\?v=4&bwc=${version}#ready`))
  assert.match(indicator.body, new RegExp(`./lazy.mjs\\?bwc=${version}`))

  await f.plugin.closeBundle()
  const builtIndicator = fs.readFileSync(path.join(f.directory, 'dist/auren-indicators/custom/Indicator.js'), 'utf8')
  const builtSdk = fs.readFileSync(path.join(f.directory, 'dist/chart/sdk.js'), 'utf8')
  assert.equal(builtIndicator, indicator.body)
  assert.equal(builtSdk, (await f.request(`/chart/sdk.js?bwc=${version}`)).body)

  // Restarting with unchanged sources must preserve usable browser cache keys.
  const restarted = betterweightChartStatic(path.join(f.directory, 'bwc'))
  restarted.configResolved({ publicDir: path.join(f.directory, 'public'), root: f.directory, build: { outDir: 'dist' } })
  assert.equal(restarted.load('\0virtual:auren-chart-version'), `export default "${version}"`)
})

test('bundled and raw SDK consumers share registry and class identities', async (t) => {
  const f = fixture(t, ({ bwcRoot, write }) => {
    write(path.join(bwcRoot, 'public/js/indicators/BaseIndicator.js'), 'export class BaseIndicator {}')
    write(path.join(bwcRoot, 'public/js/sdk.js'), [
      'export { registerIndicator, getIndicatorClass } from "./indicators/catalog.js"',
      'export { BaseIndicator } from "./indicators/BaseIndicator.js"',
      'export { EngineClass, setInteraction, getInteraction } from "prochart"',
      'export { getInteraction as getDirectInteraction } from "../vendor/prochart/input/interactions.mjs"',
      'export const bootChart = () => {}',
    ].join('\n'))
    write(path.join(bwcRoot, 'testing_web/frontend/js/indicators/fvg/FvgIndicator.js'), [
      'import { BaseIndicator } from "/js/indicators/BaseIndicator.js"',
      'export default class FvgIndicator extends BaseIndicator { static id = "fixture-fvg" }',
      'export const loadDetail = () => import("./detail.js")',
    ].join('\n'))
    write(path.join(bwcRoot, 'testing_web/frontend/js/indicators/fvg/detail.js'),
      'export const detail = "lazy indicator details"')
    write(path.join(bwcRoot, 'public/js/rawExtension.js'), [
      'import { BaseIndicator } from "./indicators/BaseIndicator.js"',
      'import { registerIndicator } from "./indicators/catalog.js"',
      'export { EngineClass, getInteraction } from "prochart"',
      'export class Extension extends BaseIndicator { static id = "raw-extension" }',
      'registerIndicator(Extension)',
    ].join('\n'))
    write(path.join(bwcRoot, 'public/vendor/prochart/index.mjs'), [
      'export class EngineClass {}',
      'export { setInteraction, getInteraction } from "./input/interactions.mjs"',
    ].join('\n'))
    write(path.join(bwcRoot, 'public/vendor/prochart/input/interactions.mjs'), [
      'let value = 0',
      'export const setInteraction = (next) => { value = next }',
      'export const getInteraction = () => value',
    ].join('\n'))
  })
  const version = f.version()
  // Concurrent entry requests exercise the single shared build path.
  const [sdkResponse, indicatorResponse] = await Promise.all([
    f.request(`/chart/sdk.js?bwc=${version}`),
    f.request(`/testing/js/indicators/fvg/FvgIndicator.js?bwc=${version}`),
  ])
  assert.equal(sdkResponse.statusCode, 200)
  assert.equal(indicatorResponse.statusCode, 200)
  await f.plugin.closeBundle()
  const dist = path.join(f.directory, 'dist')
  fs.writeFileSync(path.join(dist, 'package.json'), '{"type":"module"}')
  // Node has no browser origin. Resolve only root URL imports in the emitted
  // fixture to its local dist root; relative shared-chunk imports stay intact.
  function localize(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) localize(file)
      else if (/\.(?:js|mjs)$/.test(file)) {
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
          /(['"])(\/(?:js|chart|testing|vendor)\/[^'"]+)\1/g,
          (_match, quote, url) => `${quote}${pathToFileURL(dist).href}${url}${quote}`,
        ).replace(/(['"])prochart\1/g, JSON.stringify(`${pathToFileURL(dist).href}/vendor/prochart/index.mjs`)))
      }
    }
  }
  localize(dist)
  const load = (url) => import(`${pathToFileURL(dist).href}${url}`)
  const [sdk, rawSdk, catalog, indicator] = await Promise.all([
    load(`/chart/sdk.js?bwc=${version}`),
    load('/js/sdk.js'),
    load(`/js/indicators/catalog.js?bwc=${version}`),
    load(`/testing/js/indicators/fvg/FvgIndicator.js?bwc=${version}`),
  ])
  assert.equal(sdk.registerIndicator, rawSdk.registerIndicator)
  assert.equal(sdk.registerIndicator, catalog.registerIndicator)
  assert.ok(indicator.default.prototype instanceof sdk.BaseIndicator)
  sdk.registerIndicator(indicator.default)
  assert.equal(catalog.getIndicatorClass('fixture-fvg'), indicator.default)
  const extension = await load(`/js/rawExtension.js?bwc=${version}`)
  assert.equal(sdk.getIndicatorClass('raw-extension'), extension.Extension)
  assert.ok(extension.Extension.prototype instanceof sdk.BaseIndicator)
  assert.equal(extension.EngineClass, sdk.EngineClass)
  sdk.setInteraction(42)
  assert.equal(extension.getInteraction(), 42)
  assert.equal(sdk.getDirectInteraction(), 42)
  assert.equal((await indicator.loadDetail()).detail, 'lazy indicator details')
})

test('cold SDK graph collapses nested source imports and rebuilds changed shared modules', async (t) => {
  const f = fixture(t, ({ bwcRoot, write }) => {
    for (let index = 0; index < 40; index += 1) {
      write(path.join(bwcRoot, `public/js/helpers/part${index}.js`), index === 39
        ? 'export const value = "initial"'
        : `export { value } from "./part${index + 1}.js"`)
    }
    write(path.join(bwcRoot, 'public/js/sdk.js'), [
      'export { value } from "./helpers/part0.js"',
      'export { registerIndicator, getIndicatorClass } from "./indicators/catalog.js"',
    ].join('\n'))
  })
  const graph = async (entry) => {
    const visited = new Map()
    async function visit(url) {
      if (visited.has(url)) return
      const response = await f.request(url)
      assert.equal(response.statusCode, 200, url)
      visited.set(url, response.body)
      const module = ts.createSourceFile(url, response.body, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      for (const statement of module.statements) {
        if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue
        const specifier = statement.moduleSpecifier.text
        if (specifier.startsWith('.')) await visit(new URL(specifier, `http://chart.local${url}`).pathname + new URL(specifier, `http://chart.local${url}`).search)
      }
    }
    await visit(entry)
    return visited
  }
  const version = f.version()
  const initial = await graph(`/chart/sdk.js?bwc=${version}`)
  assert.ok(initial.size < 6, `expected fewer than six requests, got ${initial.size}`)
  assert.ok([...initial.values()].some((body) => body.includes('initial')))
  const shared = path.join(f.directory, 'bwc/public/js/helpers/part39.js')
  f.write(shared, 'export const value = "edited"')
  f.watcher.emit('all', 'change', shared)
  const updated = await graph(`/chart/sdk.js?bwc=${f.version()}`)
  assert.notEqual(f.version(), version)
  assert.ok([...updated.values()].some((body) => body.includes('edited')))
  assert.ok([...updated.values()].every((body) => !body.includes('initial')))
})

test('HTML preloads the versioned public chart graph only for an authenticated Trade route', (t) => {
  const f = fixture(t)
  const hook = f.plugin.transformIndexHtml
  assert.equal(hook.order, 'post')
  const [tag] = hook.handler()
  assert.equal(tag.tag, 'script')
  assert.equal(tag.injectTo, 'head')
  const evaluate = (pathname, token, blockedStorage = false) => {
    const links = []
    vm.runInNewContext(tag.children, {
      location: { pathname },
      localStorage: { getItem(key) {
        assert.equal(key, 'token')
        if (blockedStorage) throw new Error('storage blocked')
        return token
      } },
      document: { createElement: () => ({}), head: { appendChild: (link) => links.push(link) } },
    })
    return links
  }
  const links = evaluate('/trade', 'fixture-session')
  assert.equal(links.length, 7)
  assert.ok(links.every((link) => link.rel === 'modulepreload' && link.href.endsWith(`?bwc=${f.version()}`)))
  assert.equal(evaluate('/dashboard', 'fixture-session').length, 0)
  assert.equal(evaluate('/trade', null).length, 0)
  assert.equal(evaluate('/trade', 'fixture-session', true).length, 0)
})
