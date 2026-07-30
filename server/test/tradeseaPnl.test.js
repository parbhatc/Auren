import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../../src/services/tradesea/tradeseaPnL.ts', import.meta.url))
const bundled = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const source = bundled.outputFiles[0].text
const pnl = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('does not mark a lone MNQ position from an NQ chart price', () => {
  const result = pnl.calcAccountUnrealizedPl(
    [{ id: 'mnq-1', instrument: 'CME-Delayed:MNQ', qty: 1, side: 'buy', avgPrice: 20_000 }],
    () => null,
    () => ({ tickSize: 0.25, tickValue: 0.5 }),
    { chartMark: 20_010, chartInstrument: 'CME-Delayed:NQ' }
  )

  assert.deepEqual(result, { total: 0, counted: false })
})

test('uses the matching MNQ market mark and MNQ tick value while charting NQ', () => {
  const result = pnl.calcAccountUnrealizedPl(
    [{ id: 'mnq-1', instrument: 'CME-Delayed:MNQ', qty: 1, side: 'buy', avgPrice: 20_000 }],
    (instrument) => (instrument.endsWith(':MNQ') ? 20_010 : null),
    () => ({ tickSize: 0.25, tickValue: 0.5 }),
    { chartMark: 20_100, chartInstrument: 'CME-Delayed:NQ' }
  )

  assert.deepEqual(result, { total: 20, counted: true })
})

test('still accepts a chart mark when the chart and position instruments match', () => {
  const result = pnl.calcAccountUnrealizedPl(
    [{ id: 'mnq-1', instrument: 'CME-Delayed:MNQ', qty: 1, side: 'buy', avgPrice: 20_000 }],
    () => null,
    () => ({ tickSize: 0.25, tickValue: 0.5 }),
    { chartMark: 20_010, chartInstrument: 'CME:MNQ' }
  )

  assert.deepEqual(result, { total: 20, counted: true })
})

test('does not publish a partial account total while another instrument lacks a mark', () => {
  const result = pnl.calcAccountUnrealizedPl(
    [
      { id: 'mnq-1', instrument: 'CME-Delayed:MNQ', qty: 1, side: 'buy', avgPrice: 20_000 },
      { id: 'mes-1', instrument: 'CME-Delayed:MES', qty: 1, side: 'buy', avgPrice: 6_000 },
    ],
    (instrument) => (instrument.endsWith(':MNQ') ? 20_010 : null),
    () => ({ tickSize: 0.25, tickValue: 0.5 }),
    { chartMark: 20_100, chartInstrument: 'CME-Delayed:NQ' }
  )

  assert.deepEqual(result, { total: 20, counted: false })
})
