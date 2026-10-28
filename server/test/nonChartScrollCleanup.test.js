import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  stdin: {
    contents: `export { schedulePageScrollReset } from './src/utils/resetPageScroll';
      export { getBwcHostHooks } from './src/chart/aurenChartBoot';`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'chart-version-fixture', setup(builder) {
    builder.onResolve({ filter: /^virtual:auren-chart-version$/ }, () => ({ path: 'version', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default "fixture-version"' }))
  } }],
})

test('initial route scroll restoration never downloads the chart SDK; a loaded SDK still tears down its HUD', async (t) => {
  const previous = { window: globalThis.window, document: globalThis.document, Function: globalThis.Function }
  const deferred = []
  const imports = []
  const resources = { raf: true, pingTimer: true, socket: true }
  let destroyed = 0
  let orphanRemoved = 0
  let orphanPresent = true
  const sdk = {
    registerTradeContextActions() {}, clearChartContextActions() {},
    destroyDebugHud() {
      destroyed += 1
      resources.raf = false
      resources.pingTimer = false
      resources.socket = false
    },
  }
  globalThis.Function = function (...parameters) {
    assert.deepEqual(parameters, ['url', 'return import(url)'])
    return async (url) => { imports.push(url); return sdk }
  }
  const element = () => ({ style: { removeProperty() {} }, classList: { remove() {} } })
  const root = element()
  globalThis.document = {
    documentElement: element(), body: element(),
    getElementById: () => root,
    querySelectorAll(selector) {
      return selector === '.bwc-debug-hud' && orphanPresent
        ? [{ remove() { orphanPresent = false; orphanRemoved += 1 } }] : []
    },
    removeEventListener() {},
  }
  globalThis.window = {
    requestAnimationFrame: (callback) => { deferred.push(callback); return deferred.length },
    setTimeout: (callback) => { deferred.push(callback); return deferred.length },
  }
  t.after(() => {
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.Function = previous.Function
  })
  const module = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  module.schedulePageScrollReset()
  deferred.splice(0).forEach((callback) => callback())
  await Promise.resolve()
  assert.deepEqual(imports, [], 'opening a non-chart route must not fetch SDK code for cleanup')
  assert.equal(orphanRemoved, 1, 'orphaned HUD markup still gets removed without a loaded SDK')
  assert.equal(destroyed, 0)

  await module.getBwcHostHooks()
  assert.deepEqual(imports, ['/chart/sdk.js?bwc=fixture-version'])
  module.schedulePageScrollReset()
  deferred.splice(0).forEach((callback) => callback())
  assert.equal(imports.length, 1, 'cleanup must reuse the actual loaded SDK without another import')
  assert.equal(destroyed, 3)
  assert.deepEqual(resources, { raf: false, pingTimer: false, socket: false })

  orphanPresent = true
  sdk.destroyDebugHud = () => { throw new Error('Already detached') }
  assert.doesNotThrow(() => module.schedulePageScrollReset())
  assert.equal(orphanRemoved, 2, 'a failed loaded cleanup must still remove orphaned HUD markup')
  assert.equal(imports.length, 1)
})
