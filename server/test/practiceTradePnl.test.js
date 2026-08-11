import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPracticeTradeNetPnl,
  getPracticeTradesNetPnl,
} from '../src/utils/practiceTradePnl.js'

test('subtracts commission from practice trade P&L', () => {
  assert.equal(getPracticeTradeNetPnl({ pnl: 5, fees: 1 }), 4)
})

test('totals net P&L across realized practice trades', () => {
  assert.equal(
    getPracticeTradesNetPnl([
      { pnl: 5, fees: 1 },
      { pnl: -2, fees: 0.5 },
    ]),
    1.5
  )
})

test('treats missing or invalid P&L fields as zero', () => {
  assert.equal(getPracticeTradeNetPnl({ pnl: 'invalid', fees: undefined }), 0)
  assert.equal(getPracticeTradesNetPnl(null), 0)
})
