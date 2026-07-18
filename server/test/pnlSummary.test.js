import test from 'node:test'
import assert from 'node:assert/strict'

import { PnlAccumulator } from '../../src/services/stats/pnlSummary.js'

test('empty accumulator returns finite zero statistics', () => {
  const summary = new PnlAccumulator().summary()
  assert.deepEqual(summary, {
    count: 0,
    wins: 0,
    losses: 0,
    total: 0,
    avgWin: 0,
    avgLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    profitFactor: 0,
    avgWinLossFactor: 0,
    sharpeRatio: 0,
  })
})

test('aggregates wins, losses, breakeven, factors, and extrema in one pass', () => {
  const accumulator = new PnlAccumulator()
  for (const pnl of [100, -50, 0]) assert.equal(accumulator.add(pnl), true)

  const summary = accumulator.summary()
  assert.equal(summary.count, 3)
  assert.equal(summary.wins, 1)
  assert.equal(summary.losses, 2)
  assert.equal(summary.total, 50)
  assert.equal(summary.avgWin, 100)
  assert.equal(summary.avgLoss, -25)
  assert.equal(summary.largestWin, 100)
  assert.equal(summary.largestLoss, -50)
  assert.equal(summary.profitFactor, 2)
  assert.equal(summary.avgWinLossFactor, 4)
  assert.equal(Number.isFinite(summary.sharpeRatio), true)
})

test('all-winning and all-losing histories keep factor edge cases well-defined', () => {
  const wins = new PnlAccumulator()
  wins.add(10)
  wins.add(20)
  assert.equal(wins.summary().profitFactor, Infinity)
  assert.equal(wins.summary().avgWinLossFactor, Infinity)

  const losses = new PnlAccumulator()
  losses.add(-10)
  losses.add(-20)
  assert.equal(losses.summary().profitFactor, 0)
  assert.equal(losses.summary().avgWinLossFactor, 0)
})

test('rejects null, empty, NaN, and infinite values without corrupting totals', () => {
  const accumulator = new PnlAccumulator()
  for (const value of [null, undefined, '', Number.NaN, Infinity, -Infinity]) {
    assert.equal(accumulator.add(value), false)
  }
  assert.equal(accumulator.summary().count, 0)
})

test('handles very large histories without arrays, spread limits, or numerical overflow', () => {
  const accumulator = new PnlAccumulator()
  const count = 250_000
  for (let i = 0; i < count; i++) accumulator.add(i % 2 === 0 ? 1 : -1)
  const summary = accumulator.summary()

  assert.equal(summary.count, count)
  assert.equal(summary.total, 0)
  assert.equal(summary.wins, count / 2)
  assert.equal(summary.losses, count / 2)
  assert.equal(summary.profitFactor, 1)
  assert.equal(summary.sharpeRatio, 0)
})

test('Welford variance remains stable for large close-together values', () => {
  const accumulator = new PnlAccumulator()
  accumulator.add(1_000_000_000_001)
  accumulator.add(1_000_000_000_002)
  accumulator.add(1_000_000_000_003)
  assert.equal(Number.isFinite(accumulator.summary().sharpeRatio), true)
})
