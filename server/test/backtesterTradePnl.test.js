import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateBacktesterTradePnl } from '../src/utils/backtesterTradePnl.js'

const mnq = {
  tickSize: 0.25,
  tickValue: 0.5,
  totalFees: 1.24,
}

test('closing one of six MNQ contracts realizes only one contract of P&L', () => {
  const oneContract = calculateBacktesterTradePnl({
    direction: 'short',
    entryPrice: 100,
    exitPrice: 95,
    contracts: 1,
    ...mnq,
  })
  const allSix = calculateBacktesterTradePnl({
    direction: 'short',
    entryPrice: 100,
    exitPrice: 95,
    contracts: 6,
    ...mnq,
  })

  assert.equal(oneContract, 8.76)
  assert.equal(allSix, 52.56)
  assert.equal(allSix, oneContract * 6)
})

test('signed short partial quantities use their absolute fill size', () => {
  assert.equal(
    calculateBacktesterTradePnl({
      direction: 'short',
      entryPrice: 100,
      exitPrice: 95,
      contracts: -1,
      ...mnq,
    }),
    8.76,
  )
})

test('partial-close P&L handles losses and fails closed for invalid inputs', () => {
  assert.equal(
    calculateBacktesterTradePnl({
      direction: 'long',
      entryPrice: 100,
      exitPrice: 99,
      contracts: 2,
      ...mnq,
    }),
    -6.48,
  )
  assert.equal(
    calculateBacktesterTradePnl({
      direction: 'long',
      entryPrice: 100,
      exitPrice: 101,
      contracts: 1,
      tickSize: 0,
      tickValue: 0.5,
      totalFees: 0,
    }),
    0,
  )
})
