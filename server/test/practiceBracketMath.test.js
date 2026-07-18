import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeBarTimeSec,
  resolveBracketCrossHit,
  resolveBracketLtpHit,
} from '../src/utils/practiceBracketMath.js'

const long = (overrides = {}) => ({
  id: 'long-1',
  type: 'long',
  contracts: 1,
  entry: 100,
  stopLoss: 95,
  takeProfit: 110,
  ...overrides,
})

const short = (overrides = {}) => ({
  id: 'short-1',
  type: 'short',
  contracts: -1,
  entry: 100,
  stopLoss: 105,
  takeProfit: 90,
  ...overrides,
})

test('long TP and SL trigger at equality and through gaps', () => {
  assert.deepEqual(resolveBracketCrossHit(long(), 109, 110), {
    reason: 'take_profit',
    exitPrice: 110,
  })
  assert.deepEqual(resolveBracketCrossHit(long(), 96, 92), {
    reason: 'stop_loss',
    exitPrice: 95,
  })
})

test('short TP and SL trigger at equality and through gaps', () => {
  assert.deepEqual(resolveBracketCrossHit(short(), 91, 90), {
    reason: 'take_profit',
    exitPrice: 90,
  })
  assert.deepEqual(resolveBracketCrossHit(short(), 104, 108), {
    reason: 'stop_loss',
    exitPrice: 105,
  })
})

test('restored position closes when previous and current marks are already beyond TP', () => {
  assert.deepEqual(resolveBracketCrossHit(long(), 112, 113), {
    reason: 'take_profit',
    exitPrice: 110,
  })
  assert.deepEqual(resolveBracketCrossHit(short(), 88, 87), {
    reason: 'take_profit',
    exitPrice: 90,
  })
})

test('restored position closes when previous and current marks are already beyond SL', () => {
  assert.deepEqual(resolveBracketCrossHit(long(), 94, 93), {
    reason: 'stop_loss',
    exitPrice: 95,
  })
  assert.deepEqual(resolveBracketCrossHit(short(), 106, 107), {
    reason: 'stop_loss',
    exitPrice: 105,
  })
})

test('TP uses standard limit-side semantics independent of entry metadata', () => {
  assert.equal(resolveBracketLtpHit(long({ entry: null }), 111), 'take_profit')
  assert.equal(resolveBracketLtpHit(short({ entry: null }), 89), 'take_profit')
  assert.equal(resolveBracketLtpHit(long({ takeProfit: 99, stopLoss: null }), 100), 'take_profit')
  assert.equal(resolveBracketLtpHit(short({ takeProfit: 101, stopLoss: null }), 100), 'take_profit')
})

test('stop wins if malformed brackets are both executable', () => {
  assert.deepEqual(
    resolveBracketCrossHit(long({ stopLoss: 105, takeProfit: 100 }), 102, 102),
    { reason: 'stop_loss', exitPrice: 105 }
  )
})

test('timestamps normalize seconds, milliseconds, and missing values', () => {
  assert.equal(normalizeBarTimeSec(1_700_000_000), 1_700_000_000)
  assert.equal(normalizeBarTimeSec(1_700_000_000_123), 1_700_000_000)
  assert.ok(Math.abs(normalizeBarTimeSec(null) - Math.floor(Date.now() / 1000)) <= 1)
})

test('empty brackets and non-finite marks never trigger', () => {
  assert.equal(
    resolveBracketCrossHit(long({ stopLoss: null, takeProfit: null }), 100, 101),
    null
  )
  assert.equal(resolveBracketCrossHit(long(), 100, Number.NaN), null)
  assert.equal(resolveBracketLtpHit(long(), Infinity), null)
  assert.equal(resolveBracketLtpHit(long(), null), null)
})
