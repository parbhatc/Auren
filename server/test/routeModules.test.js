import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../../src/navigation/routeModules.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'page-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'dynamic-import') return { path, namespace: 'page' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'page' }, ({ path }) => ({
      contents: `globalThis.__routeImports.push(${JSON.stringify(path)}); export default function Page() { throw new Error('Prefetch must not render a page') }`,
    }))
  } }],
})
const encoded = Buffer.from(result.outputFiles[0].text).toString('base64')
const { routeModule, modulesForRoute, routeModules } = await import(`data:text/javascript;base64,${encoded}#mapping`)

test('navigation intent and rendering join one module load; rejected loads can retry', async () => {
  let calls = 0
  let finish
  const shared = routeModule(() => { calls += 1; return new Promise((resolve) => { finish = resolve }) })
  const intent = shared()
  const render = shared()
  assert.equal(intent, render)
  assert.equal(calls, 1)
  finish({ default: 'Page' })
  await render
  assert.equal(shared(), intent)

  const retry = routeModule(async () => {
    calls += 1
    if (calls === 2) throw new Error('Temporary module failure')
    return 'recovered'
  })
  await assert.rejects(retry(), /Temporary/)
  assert.equal(await retry(), 'recovered')
})

test('route matching selects concrete pages and nested settings without importing siblings', () => {
  assert.deepEqual(modulesForRoute('/dashboard?month=10'), [routeModules.dashboard])
  assert.deepEqual(modulesForRoute('/news/'), [routeModules.news])
  assert.deepEqual(modulesForRoute('/practice'), [routeModules.practice])
  assert.deepEqual(modulesForRoute('/practice/accounts'), [routeModules.practiceAccounts])
  assert.deepEqual(modulesForRoute('/practice/trade/account-id'), [routeModules.practiceTrade])
  assert.deepEqual(modulesForRoute('/settings/props'), [routeModules.settingsWorkspace, routeModules.propsSettings])
  assert.deepEqual(modulesForRoute('/journal/reviews'), [routeModules.journalReviews])
  assert.deepEqual(modulesForRoute('/journal/entry-id'), [routeModules.journalDetail])
  assert.deepEqual(modulesForRoute('/practice/trade/account-id/stats'), [routeModules.practiceStats])
  assert.deepEqual(modulesForRoute('/backtester/chart?sessionId=local-id'), [routeModules.replayChart])
  assert.deepEqual(modulesForRoute('/backtester/stats?sessionId=replay-id'), [routeModules.dashboard])
  for (const invalid of ['/unknown', '/journal/one/two', '//external.example/news', 'https://external.example/news']) {
    assert.deepEqual(modulesForRoute(invalid), [])
  }
})

test('prefetch evaluates only the requested module and never renders a page', async (t) => {
  const previous = globalThis.__routeImports
  globalThis.__routeImports = []
  t.after(() => { globalThis.__routeImports = previous })
  const { prefetchRoute } = await import(`data:text/javascript;base64,${encoded}#intent`)
  assert.deepEqual(globalThis.__routeImports, [], 'registering routes must not evaluate their imports')
  await prefetchRoute('/news')
  await prefetchRoute('/news')
  assert.deepEqual(globalThis.__routeImports, ['../pages/workspace/NewsWorkspacePage'])
  await prefetchRoute('/settings/props')
  assert.deepEqual(globalThis.__routeImports.slice(1).sort(), [
    '../pages/settings/SettingsWorkspacePage', '../components/settings/prop_firms',
  ].sort())
  await prefetchRoute('/unknown')
  assert.equal(globalThis.__routeImports.length, 3)
})

test('legacy replay statistics warm up Overview without loading the removed page', async (t) => {
  const previous = globalThis.__routeImports
  globalThis.__routeImports = []
  t.after(() => { globalThis.__routeImports = previous })
  const { prefetchRoute } = await import(`data:text/javascript;base64,${encoded}#legacy-replay`)
  await prefetchRoute('/backtester/stats?sessionId=replay-id')
  assert.deepEqual(globalThis.__routeImports, ['../pages/workspace/DashboardPage'])
})
