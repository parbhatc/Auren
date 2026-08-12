import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calcPracticePnL,
  resolvePracticeInstrumentTicks,
  snapPracticePriceToTick,
} from '../src/utils/practiceInstrumentTicks.js'

test('NQ prices snap to quarter-point ticks', () => {
  assert.deepEqual(resolvePracticeInstrumentTicks('CME:NQ1!'), {
    tickSize: 0.25,
    tickValue: 5,
  })
  assert.equal(snapPracticePriceToTick('NQ', 25000.1), 25000)
  assert.equal(snapPracticePriceToTick('NQ', 25000.2), 25000.25)
  assert.equal(snapPracticePriceToTick('NQ', 25000.4), 25000.5)
})

test('NQ P&L uses $20 per point after tick normalization', () => {
  assert.equal(calcPracticePnL(25000, 25000.5, 1, 'NQ'), 10)
  assert.equal(calcPracticePnL(25000, 25002, 1, 'NQ'), 40)
  assert.equal(calcPracticePnL(25000, 24999.5, 1, 'NQ'), -10)
})
