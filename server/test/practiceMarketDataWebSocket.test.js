import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import PracticeMarketDataWebSocket, { livePollDelayMs } from '../src/websocket/PracticeMarketDataWebSocket.js'
import TradingViewMarketDataClient, { normalizeQuote, normalizeSearchResult } from '../src/services/tradingview/TradingViewMarketDataClient.js'
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

test('TradingView quote normalization drops a last price that conflicts with fresh bid and ask', () => {
  const quote = normalizeQuote({
    n: 'CME_MINI:MNQ1!',
    v: { lp: 29214.75, bid: 29742.5, ask: 29742.75, lp_time: 1785862333 },
  })
  assert.equal(quote.last, null)
  assert.equal(quote.bid, 29742.5)
  assert.equal(quote.ask, 29742.75)

  const valid = normalizeQuote({
    n: 'CME_MINI:MNQ1!',
    v: { lp: 29742.5, bid: 29742.5, ask: 29742.75 },
  })
  assert.equal(valid.last, 29742.5)
})

test('TradingView history retries a rate-limited connection and shares identical requests', async () => {
  let attempts = 0
  const gateway = { history: async (symbol, options) => {
    attempts += 1
    if (attempts === 1) throw new Error('Unexpected server response: 429')
    return { symbol, interval: options.interval, bars: [{ time: 60, open: 1, high: 2, low: 1, close: 2, volume: 3 }] }
  } }
  const client = new TradingViewMarketDataClient({
    gateway,
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
  assert.equal(tradingview.credentials.sessionIdEnv, 'TRADINGVIEW_SESSION_ID')
  assert.equal(tradingview.transport.gatewayWebSocketUrl, 'ws://127.0.0.1:8532/api/tradingview/stream')
  assert.equal(tradingview.transport.clientSearchPath, '/api/tradingview/search')
  assert.equal(tradingview.transport.upstreamSearchUrl, 'https://symbol-search.tradingview.com/symbol_search/v3/')
})

test('practice market-data stream serves history and symbol-resolution subscription IDs', async () => {
  const calls = []
  const marketData = {
    supportedResolutions: ['30S', '1'],
    history: async (symbol, options) => {
      calls.push({ symbol, options })
      return {
        symbol,
        interval: options.interval,
        bars: [{ time: 60, open: 1, high: 2, low: 1, close: 2, volume: 3 }],
        historyExhausted: false
      }
    }
  }
  const stream = new PracticeMarketDataWebSocket(null, {
    marketData,
    resolutions: marketData.supportedResolutions,
    verifyToken: () => ({ userId: 1, username: 'practice-user' }),
    getUserSessionId: async () => 'personal-session',
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
  assert.equal(calls[0].options.sessionId, 'personal-session')

  await stream.dispatch(socket, {
    id: 'sub-1', type: 'subscribe', subscriptionId: 'NASDAQ:AAPL#30S', symbol: 'NASDAQ:AAPL', resolution: '30S'
  })
  const update = await waitFor(socket, (message) => message.type === 'update')
  assert.equal(update.subscriptionId, 'NASDAQ:AAPL#30S')
  stream.unsubscribe(socket, 'NASDAQ:AAPL#30S')
})

test('practice market-data stream accepts chart daily and weekly aliases', async () => {
  const calls = []
  const marketData = {
    supportedResolutions: ['1D', '1W'],
    history: async (symbol, options) => {
      calls.push({ symbol, ...options })
      return { symbol, interval: options.interval, bars: [], historyExhausted: true }
    }
  }
  const stream = new PracticeMarketDataWebSocket(null, {
    marketData,
    resolutions: marketData.supportedResolutions,
    getUserSessionId: async () => null,
  })
  const socket = new FakeSocket()
  stream.userIds.set(socket, 1)

  await stream.dispatch(socket, {
    id: 'daily-history', type: 'history', symbol: 'NASDAQ:AAPL', resolution: 'D', bars: 10
  })
  await stream.dispatch(socket, {
    id: 'weekly-history', type: 'history', symbol: 'NASDAQ:AAPL', resolution: 'W', bars: 10
  })

  assert.equal(calls[0].interval, '1D')
  assert.equal(calls[1].interval, '1W')
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

test('practice market-data stream retries promptly when a new minute has just started', () => {
  const minute = 60_000
  const barStart = Date.UTC(2026, 7, 7, 11, 14, 0)
  const current = { time: barStart / 1000 }

  assert.equal(livePollDelayMs('1', current, barStart + minute + 250, 5_000, 0), 1_000)
  assert.equal(livePollDelayMs('1', current, barStart + minute + 1_250, 5_000, 1), 1_000)
  assert.equal(livePollDelayMs('1', current, barStart + minute + 2_250, 5_000, 2), 5_000)
  assert.equal(livePollDelayMs('1', current, barStart + minute + 11_000, 5_000, 0), 5_000)
})
