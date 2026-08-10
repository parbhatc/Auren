import test from 'node:test'
import assert from 'node:assert/strict'

import TradingViewDirectClient from '../src/services/tradingview/TradingViewDirectClient.js'

test('direct TradingView client authenticates once and reads history without a gateway', async () => {
  const calls = []
  const api = {
    loginBySessionId: async (sessionId) => calls.push(['login', sessionId]),
    history: async (symbol, options) => {
      calls.push(['history', symbol, options])
      return { symbol, interval: options.interval, bars: [{ time: 60 }] }
    },
    loadAllBars: async (symbol, options) => {
      calls.push(['loadAllBars', symbol, options])
      return { symbol, interval: options.interval, bars: [{ time: 121 }] }
    },
    close: () => calls.push(['close']),
  }
  const client = new TradingViewDirectClient({
    apiFactory: () => api,
    configPath: 'missing-config.json',
  })

  const first = await client.history('CME_MINI:NQ1!', {
    sessionId: 'session-value',
    interval: '1',
    bars: 5,
  })
  const second = await client.history('CME_MINI:NQ1!', {
    sessionId: 'session-value',
    interval: '1',
    bars: 1,
    to: 120,
  })
  const incremental = await client.loadAllBars('CME_MINI:NQ1!', {
    sessionId: 'session-value',
    interval: '30s',
    chunkSize: 10_000,
    after: 120,
  })

  assert.equal(first.bars.length, 1)
  assert.equal(second.bars.length, 1)
  assert.equal(incremental.bars.length, 1)
  assert.deepEqual(calls, [
    ['login', 'session-value'],
    ['history', 'CME_MINI:NQ1!', { interval: '1', bars: 5 }],
    ['history', 'CME_MINI:NQ1!', { interval: '1', bars: 1, to: 120 }],
    ['loadAllBars', 'CME_MINI:NQ1!', {
      interval: '30S',
      chunkSize: 10_000,
      session: 'extended',
      after: 120,
    }],
  ])
})

test('direct TradingView client explains when no session ID is configured', async () => {
  const client = new TradingViewDirectClient({
    apiFactory: () => {
      throw new Error('should not create API')
    },
    configPath: 'missing-config.json',
    sessionIdEnv: 'MISSING_TRADINGVIEW_SESSION_ID_FOR_TEST',
  })

  await assert.rejects(
    client.history('CME_MINI:NQ1!', { interval: '1', bars: 1 }),
    /TradingView session ID is required/
  )
})
