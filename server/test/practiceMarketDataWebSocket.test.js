import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import PracticeMarketDataWebSocket from '../src/websocket/PracticeMarketDataWebSocket.js'
import TradingViewMarketDataClient, { normalizeSearchResult } from '../src/services/tradingview/TradingViewMarketDataClient.js'
import { getPropFirmDescriptor } from '../src/services/propfirms/PropFirmCatalog.js'

class FakeSocket extends EventEmitter {
  OPEN = 1
  readyState = 1
  sent = []
  send(value) { this.sent.push(JSON.parse(value)) }
  close(code, reason) { this.readyState = 3; this.closeFrame = { code, reason } }
}

function waitFor(socket, predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const check = () => {
      const found = socket.sent.find(predicate)
      if (found) resolve(found)
      else if (Date.now() >= deadline) reject(new Error('Timed out waiting for message'))
      else setTimeout(check, 5)
    }
    check()
  })
}

test('TradingView futures search selects the continuous contract', () => {
  const result = normalizeSearchResult({
    symbol: '<em>NQ</em>',
    description: 'E-mini Nasdaq-100 Futures',
    exchange: 'CME',
    source_id: 'CME_MINI',
    type: 'futures',
    contracts: [{ symbol: '<em>NQ</em>1!', prefix: 'CME_MINI', typespecs: ['continuous'] }]
  })
  assert.equal(result.symbol, 'NQ')
  assert.equal(result.ticker, 'CME_MINI:NQ1!')
})

test('TradingView history retries a rate-limited connection and shares identical requests', async () => {
  let attempts = 0
  const socketFactory = () => {
    attempts += 1
    const attempt = attempts
    return {
      disconnect() {},
      createSeries() {
        return {
          resolve() {
            queueMicrotask(() => {
              this.onTimescaleUpdate?.({
                series_data: { s: [{ v: [60, 1, 2, 1, 2, 3] }] }
              })
              this.onSeriesCompleted?.()
            })
          },
          requestMoreData() {},
        }
      },
      async connect(callbacks) {
        if (attempt === 1) throw new Error('Unexpected server response: 429')
        callbacks.onSessionInit?.()
      },
    }
  }
  const client = new TradingViewMarketDataClient({
    socketFactory,
    historyRetries: 1,
    historyRetryBaseMs: 100,
  })

  const first = client.history('CME_MINI:MNQ1!', { interval: '1', bars: 1 })
  const duplicate = client.history('CME_MINI:MNQ1!', { interval: '1', bars: 1 })
  assert.equal(first, duplicate)
  const result = await first

  assert.equal(attempts, 2)
  assert.equal(result.bars.length, 1)
  assert.equal(result.bars[0].close, 2)
})

test('server-side provider catalog describes Tradesea and TradingView consistently', () => {
  const tradesea = getPropFirmDescriptor('tradesea')
  const tradingview = getPropFirmDescriptor('tradingview')
  assert.equal(tradesea.driver, 'tradesea')
  assert.equal(tradesea.capabilities.liveTrading, true)
  assert.equal(tradingview.driver, 'tradingview')
  assert.equal(tradingview.capabilities.marketData.practice, true)
  assert.equal(tradingview.capabilities.liveTrading, false)
  assert.equal(tradingview.credentials.tokenEnv, 'TRADINGVIEW_AUTH_TOKEN')
  assert.equal(tradingview.transport.clientSearchPath, '/api/tradingview/search')
  assert.equal(tradingview.transport.upstreamSearchUrl, 'https://symbol-search.tradingview.com/symbol_search/v3/')
})

test('practice market-data stream serves history and symbol-resolution subscription IDs', async () => {
  const marketData = {
    supportedResolutions: ['30S', '1'],
    history: async (symbol, options) => ({
      symbol,
      interval: options.interval,
      bars: [{ time: 60, open: 1, high: 2, low: 1, close: 2, volume: 3 }],
      historyExhausted: false
    })
  }
  const stream = new PracticeMarketDataWebSocket(null, {
    marketData,
    resolutions: marketData.supportedResolutions,
    verifyToken: () => ({ userId: 1, username: 'practice-user' }),
    pollMs: 1000
  })
  const socket = new FakeSocket()
  stream.subscriptions.set(socket, new Map())

  await stream.dispatch(socket, {
    id: 'history-1', type: 'history', symbol: 'nasdaq:aapl', resolution: '30s', bars: 100
  })
  const history = await waitFor(socket, (message) => message.id === 'history-1')
  assert.equal(history.data.symbol, 'NASDAQ:AAPL')
  assert.equal(history.data.interval, '30S')

  await stream.dispatch(socket, {
    id: 'sub-1', type: 'subscribe', subscriptionId: 'NASDAQ:AAPL#30S', symbol: 'NASDAQ:AAPL', resolution: '30S'
  })
  const update = await waitFor(socket, (message) => message.type === 'update')
  assert.equal(update.subscriptionId, 'NASDAQ:AAPL#30S')
  stream.unsubscribe(socket, 'NASDAQ:AAPL#30S')
})

test('practice market-data stream rejects pane-scoped subscription IDs', async () => {
  const stream = new PracticeMarketDataWebSocket(null, {
    marketData: {},
    resolutions: ['1'],
    verifyToken: () => ({})
  })
  const socket = new FakeSocket()
  stream.subscriptions.set(socket, new Map())
  assert.throws(() => stream.subscribe(socket, {
    subscriptionId: 'pane-0', symbol: 'NASDAQ:AAPL', resolution: '1'
  }), /NASDAQ:AAPL#1/)
})
