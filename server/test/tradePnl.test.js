import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateDirectionalPnl } from '../../src/services/stats/tradePnl.js'

test('calculates long and short tick P&L with absolute quantity', () => {
  assert.equal(
    calculateDirectionalPnl({
      entryPrice: 100,
      exitPrice: 101,
      contracts: 2,
      direction: 'long',
      tickSize: 0.25,
      tickValue: 5,
    }),
    40
  )
  assert.equal(
    calculateDirectionalPnl({
      entryPrice: 100,
      exitPrice: 99,
      contracts: -2,
      direction: 'short',
      tickSize: 0.25,
      tickValue: 5,
    }),
    40
  )
})

test('preserves valid zero entry and exit prices', () => {
  assert.equal(
    calculateDirectionalPnl({ entryPrice: 0, exitPrice: 2, contracts: 1, direction: 'long' }),
    2
  )
  assert.equal(
    calculateDirectionalPnl({ entryPrice: 2, exitPrice: 0, contracts: 1, direction: 'short' }),
    2
  )
})

test('returns zero for missing, empty-size, and non-finite inputs', () => {
  assert.equal(calculateDirectionalPnl({ entryPrice: 1, exitPrice: null, contracts: 1 }), 0)
  assert.equal(calculateDirectionalPnl({ entryPrice: 1, exitPrice: 2, contracts: 0 }), 0)
  assert.equal(calculateDirectionalPnl({ entryPrice: 1, exitPrice: Infinity, contracts: 1 }), 0)
  assert.equal(calculateDirectionalPnl({ entryPrice: Number.NaN, exitPrice: 2, contracts: 1 }), 0)
})

test('uses safe defaults for invalid tick configuration', () => {
  assert.equal(
    calculateDirectionalPnl({
      entryPrice: 10,
      exitPrice: 12,
      contracts: 3,
      tickSize: 0,
      tickValue: Number.NaN,
    }),
    6
  )
})

test('overflowing extreme calculations fail closed instead of returning Infinity', () => {
  assert.equal(
    calculateDirectionalPnl({
      entryPrice: -Number.MAX_VALUE,
      exitPrice: Number.MAX_VALUE,
      contracts: Number.MAX_VALUE,
    }),
    0
  )
})
