import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterTradesByDateRange,
  parseRangeBoundary,
  tradeTimestampMs,
} from '../../src/services/stats/tradeDateRange.js'

test('date-only end boundary includes the entire selected local day', () => {
  const trades = [
    { id: 'open', entry_time: '2026-07-18T00:00:00' },
    { id: 'late', entry_time: '2026-07-18T23:59:59.999' },
    { id: 'next', entry_time: '2026-07-19T00:00:00' },
  ]
  assert.deepEqual(
    filterTradesByDateRange(trades, '2026-07-18', '2026-07-18').map((trade) => trade.id),
    ['open', 'late']
  )
})

test('supports Unix seconds, Unix milliseconds, and numeric strings', () => {
  const milliseconds = Date.now()
  const seconds = Math.floor(milliseconds / 1000)
  assert.equal(tradeTimestampMs(seconds), seconds * 1000)
  assert.equal(tradeTimestampMs(milliseconds), milliseconds)
  assert.equal(tradeTimestampMs(String(seconds)), seconds * 1000)
})

test('invalid, missing, and reversed ranges safely return no trades', () => {
  const trades = [{ entry_time: '2026-07-18T12:00:00' }]
  assert.deepEqual(filterTradesByDateRange(trades, 'bad', '2026-07-18'), [])
  assert.deepEqual(filterTradesByDateRange(trades, '2026-07-19', '2026-07-18'), [])
  assert.deepEqual(filterTradesByDateRange(null, '2026-07-18', '2026-07-18'), [])
  assert.equal(Number.isNaN(tradeTimestampMs(null)), true)
})

test('rejects impossible calendar dates instead of rolling into another month', () => {
  assert.equal(Number.isNaN(parseRangeBoundary('2026-02-30', false)), true)
  assert.equal(Number.isNaN(parseRangeBoundary('2026-13-01', false)), true)
})
