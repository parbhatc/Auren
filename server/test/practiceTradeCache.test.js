import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(
  new URL('../../src/services/practice/PracticeTradeCache.ts', import.meta.url)
)
const bundled = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const source = bundled.outputFiles[0].text
const { PracticeTradeCache } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)

test('opening MNQ while viewing NQ immediately schedules its chart position line', () => {
  const chart = { symbol: () => 'CME-Delayed:NQ' }
  const datafeed = {
    getLastBarForChart: () => ({ time: 1_792_106_000, close: 30_041.25 }),
    getSymbolInfo: () => null,
    getTickSize: () => 0.25,
    getTickValue: (symbol) => (String(symbol).includes('MNQ') ? 0.5 : 5),
    resolveProductSymbol: (symbol) =>
      String(symbol).toUpperCase().includes('MNQ') ? 'MNQ' : 'NQ',
  }
  const handler = {
    propFirm: { chartServices: { datafeed } },
    widget: { chart: () => chart },
  }
  const cache = new PracticeTradeCache(handler, handler.widget, 'account-1')
  let reconciliations = 0
  cache.scheduleReconcilePositionLines = () => {
    reconciliations += 1
  }
  cache.handleOpenPosition = () => {}

  const position = cache.onOpenPosition('MNQ', 30_040.75, -2, 30_061.25)

  assert.equal(position.symbol, 'MNQ')
  assert.equal(position.contracts, -2)
  assert.equal(reconciliations, 1)
  cache.dispose()
})
