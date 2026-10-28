import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/propfirms/hydratePropFirms.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { hydratePropFirmsList } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

function firm(type, credentials = {}) {
  return { id: type, type, name: type, displayName: type, enabled: true, credentials }
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('both firm details start together while listed order and unconfigured firms remain intact', async () => {
  const details = { tradesea: deferred(), tradingview: deferred() }
  const calls = []
  const custom = firm('custom')
  const listed = [firm('tradingview'), custom, firm('tradesea')]
  const original = [...listed]
  const hydratedTrade = firm('tradesea', { token: 'fresh-tradesea' })
  const hydratedView = firm('tradingview', { session: 'fresh-view' })
  const result = hydratePropFirmsList(listed, (type) => {
    calls.push(type)
    return details[type].promise
  })

  assert.deepEqual(calls, ['tradesea', 'tradingview'], 'a slow first firm must not block the second request')
  details.tradingview.resolve({ success: true, propFirm: hydratedView })
  details.tradesea.resolve({ success: true, propFirm: hydratedTrade })
  assert.deepEqual(await result, [hydratedView, custom, hydratedTrade])
  assert.deepEqual(listed, original, 'hydration must not mutate the caller list')
})

test('new firms append in configuration order even when responses finish in reverse order', async () => {
  const details = { tradesea: deferred(), tradingview: deferred() }
  const custom = firm('custom')
  const hydratedTrade = firm('tradesea', { token: 'fresh' })
  const hydratedView = firm('tradingview', { session: 'fresh' })
  const result = hydratePropFirmsList([custom], (type) => details[type].promise)
  details.tradingview.resolve({ success: true, propFirm: hydratedView })
  details.tradesea.resolve({ success: true, propFirm: hydratedTrade })
  assert.deepEqual(await result, [custom, hydratedTrade, hydratedView])
})

test('failed listed details keep their fallback while successful missing firms still load', async () => {
  const listed = firm('tradesea')
  const hydratedView = firm('tradingview', { session: 'fresh' })
  const calls = []
  const result = await hydratePropFirmsList([listed], async (type) => {
    calls.push(type)
    if (type === 'tradesea') throw new Error('unavailable')
    return { success: true, propFirm: hydratedView }
  })
  assert.deepEqual(result, [listed, hydratedView])
  assert.deepEqual(calls, ['tradesea', 'tradingview'], 'failed firms are not immediately fetched twice')
})

test('missing, unsuccessful, and rejected details preserve listed entries without adding placeholders', async () => {
  const listed = firm('tradesea')
  for (const missingResponse of [null, { success: false, propFirm: firm('tradingview') }, { success: true }, { success: true, propFirm: null }]) {
    const result = await hydratePropFirmsList([listed], async (type) => {
      if (type === 'tradesea') return { success: false, propFirm: firm('tradesea', { stale: true }) }
      if (missingResponse === null) throw new Error('not configured')
      return missingResponse
    })
    assert.deepEqual(result, [listed])
  }
})
