import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function loadBootFixture(t, importModule) {
  const previous = globalThis.__aurenChartImportFixture
  globalThis.__aurenChartImportFixture = importModule
  t.after(() => { globalThis.__aurenChartImportFixture = previous })
  const source = fs.readFileSync(new URL('../../src/chart/aurenChartBoot.ts', import.meta.url), 'utf8')
    .replace("import chartAssetVersion from 'virtual:auren-chart-version'", "const chartAssetVersion = 'fixture-version'")
    .replace("new Function('url', 'return import(url)')", 'globalThis.__aurenChartImportFixture')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#${t.name}`)
}

function indicatorModule(url) {
  if (url.includes('inputPanels')) return { registerTestingInputPanels() {} }
  if (url.includes('presets')) return { registerTestingIndicatorPresets() {} }
  return { default: {}, startPaperFeedPolling() {} }
}

test('parallel chart mounts share registration while SDK and indicator downloads overlap', async (t) => {
  const requested = []
  let resolveSdk
  let registered = 0
  const sdk = new Promise((resolve) => { resolveSdk = resolve })
  const boot = await loadBootFixture(t, (url) => {
    requested.push(url)
    return url.startsWith('/chart/sdk.js') ? sdk : Promise.resolve(indicatorModule(url))
  })
  const first = boot.registerAurenChartIndicators()
  const concurrent = boot.registerAurenChartIndicators()
  assert.equal(first, concurrent)
  // All six indicator roots start before the SDK response is available.
  assert.equal(requested.length, 7)
  assert.ok(requested.every((url) => url.endsWith('?bwc=fixture-version')))
  assert.equal(registered, 0)
  resolveSdk({ registerIndicator() { registered += 1 } })
  await Promise.all([first, concurrent])
  assert.equal(registered, 4)
  await boot.registerAurenChartIndicators()
  assert.equal(requested.length, 7)
  assert.equal(registered, 4)
})

test('a temporary module fetch failure allows chart registration to retry', async (t) => {
  let sdkAttempts = 0
  let registered = 0
  const boot = await loadBootFixture(t, async (url) => {
    if (url.startsWith('/chart/sdk.js')) {
      sdkAttempts += 1
      if (sdkAttempts === 1) throw new Error('temporary network error')
      return { registerIndicator() { registered += 1 } }
    }
    return indicatorModule(url)
  })
  await assert.rejects(boot.registerAurenChartIndicators(), /temporary network error/)
  await boot.registerAurenChartIndicators()
  assert.equal(sdkAttempts, 2)
  assert.equal(registered, 4)
})
