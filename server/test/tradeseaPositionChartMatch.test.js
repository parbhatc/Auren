import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(
  new URL('../../src/services/tradesea/tradeseaPositions.ts', import.meta.url)
)
const bundled = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const source = bundled.outputFiles[0].text
const { findPositionForChartInstrument } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)

test('selects an MNQ live position for display on its related NQ chart', () => {
  const position = findPositionForChartInstrument(
    [
      {
        id: 'mnq-position',
        instrument: 'CME-Delayed:MNQ',
        qty: 2,
        side: 'buy',
        avgPrice: 25_123.25,
      },
    ],
    'CME-Delayed:NQ',
    true
  )

  assert.equal(position?.id, 'mnq-position')
  assert.equal(position?.instrument, 'CME-Delayed:MNQ')
})

test('prefers an exact NQ position when both NQ and MNQ are open', () => {
  const position = findPositionForChartInstrument(
    [
      { id: 'mnq-position', instrument: 'CME-Delayed:MNQ', qty: 2 },
      { id: 'nq-position', instrument: 'CME-Delayed:NQ', qty: 1 },
    ],
    'CME-Delayed:NQ',
    true
  )

  assert.equal(position?.id, 'nq-position')
})

test('does not show MNQ on NQ when the chart setting is disabled', () => {
  const position = findPositionForChartInstrument(
    [{ id: 'mnq-position', instrument: 'CME-Delayed:MNQ', qty: 2 }],
    'CME-Delayed:NQ',
    false
  )

  assert.equal(position, null)
})
