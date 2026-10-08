import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import BacktesterDataWebSocket from '../src/websocket/BacktesterDataWebSocket.js'
import TradeseaDataHandler from '../src/websocket/handlers/TradeseaDataHandler.js'

test('Tradesea CSV history uses the authenticated UDF proxy and normalizes bars', async () => {
  const calls = []
  const identityService = {
    async proxyUdfRequest(tokens, accountId, targetPath) {
      calls.push({ tokens, accountId, targetPath })
      return {
        statusCode: 200,
        body: JSON.stringify({
          s: 'ok',
          t: [100, 200],
          o: [10, 20],
          h: [11, 21],
          l: [9, 19],
          c: [10.5, 20.5],
          v: [5, 6],
        }),
      }
    },
  }
  const handler = new TradeseaDataHandler({}, identityService)
  const connection = {
    tokens: { accessToken: 'connected-session' },
    accountId: 'account-1',
    userId: 'market-user-1',
    connectionGroupId: 'group-1',
    delayed: false,
  }

  const result = await handler.getHistory(connection, 'CME:NQ', '1', 25_000, 0, 300)

  assert.deepEqual(result.bars, [
    { t: 200_000, o: 20, h: 21, l: 19, c: 20.5, v: 6 },
    { t: 100_000, o: 10, h: 11, l: 9, c: 10.5, v: 5 },
  ])
  assert.equal(calls[0].accountId, 'account-1')
  assert.deepEqual(calls[0].tokens, connection.tokens)
  const requestUrl = new URL(`https://example.test${calls[0].targetPath}`)
  assert.equal(requestUrl.pathname, '/history')
  assert.equal(requestUrl.searchParams.get('connection-user-id'), 'market-user-1')
  assert.equal(requestUrl.searchParams.get('connection-group-id'), 'group-1')
  assert.equal(requestUrl.searchParams.get('symbol'), 'CME:NQ')
})

test('Tradesea CSV history uses delayed symbols for sandbox market data', async () => {
  const calls = []
  const identityService = {
    async proxyUdfRequest(_tokens, _accountId, targetPath) {
      calls.push(targetPath)
      return {
        statusCode: 200,
        body: JSON.stringify({ s: 'ok', t: [], o: [], h: [], l: [], c: [], v: [] }),
      }
    },
  }
  const handler = new TradeseaDataHandler({}, identityService)
  const connection = {
    tokens: { accessToken: 'connected-session' },
    accountId: 'sandbox-account',
    userId: 'market-user-1',
    connectionGroupId: 'group-1',
    delayed: true,
  }

  await handler.getHistory(connection, 'CME:NQ', '1', 100, 0, 300)
  const requestUrl = new URL(`https://example.test${calls[0]}`)
  assert.equal(requestUrl.searchParams.get('symbol'), 'CME-Delayed:NQ')
})

test('Tradesea CSV updates keep sub-minute data in its own resolution folder', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-tradesea-csv-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))
  const invalidations = []
  const messages = []
  const websocket = {
    csvDir: tempDir,
    server: {
      csvLoader: {
        invalidateMonthData: (...args) => invalidations.push(args),
      },
    },
    sendProgress() {},
    broadcast: (message) => messages.push(message),
  }
  const handler = new TradeseaDataHandler(websocket, {})
  let page = 0
  const timeMs = Date.UTC(2027, 0, 15, 12)
  handler.getHistory = async () => {
    page += 1
    return page === 1
      ? { bars: [{ t: timeMs, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }] }
      : { bars: [] }
  }

  await handler.update('CME:NQ', 'NQ', {}, '30S')

  const csvPath = monthFilePathForTest(tempDir, 'NQ', 2027, '30s')
  assert.equal(fs.existsSync(csvPath), true)
  assert.equal(fs.readFileSync(csvPath, 'utf8'), `${Math.floor(timeMs / 1000)},1,2,0.5,1.5,10`)
  assert.equal(invalidations[0][3], '30s')
  assert.equal(messages.at(-1).success, true)
})

function monthFilePathForTest(root, symbol, year, resolution) {
  return path.join(root, symbol, resolution, String(year), 'January.csv')
}

test('data-handler failures return an operation response instead of leaving the client waiting', async () => {
  const socketServer = new BacktesterDataWebSocket({})
  const messages = []
  const cleared = []
  const originalConsoleError = console.error

  socketServer.broadcast = (message) => messages.push(message)
  socketServer.clearProgress = (...args) => cleared.push(args)
  console.error = () => undefined

  try {
    socketServer.runDataHandlerSafely(
      Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:8532')),
      {
        action: 'update',
        symbol: 'NQ',
        source: 'tradingview',
        operationKey: 'tradingview_NQ_update'
      }
    )
    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(messages, [{
      type: 'update_response',
      success: false,
      error: 'TradingView gateway is unavailable. Start TradingviewServer on port 8532 and try again.',
      symbol: 'NQ',
      source: 'tradingview'
    }])
    assert.deepEqual(cleared, [['update', 'NQ', 'tradingview']])
  } finally {
    console.error = originalConsoleError
  }
})

test('CSV data websocket rejects missing authentication before sending inventory', async () => {
  const socketServer = new BacktesterDataWebSocket({})
  const closes = []
  let welcomed = false
  const ws = {
    close: (code, reason) => closes.push([code, reason]),
  }
  socketServer.sendWelcomeMessage = () => {
    welcomed = true
  }

  await socketServer.handleConnection(ws, {}, { id: 'anonymous', token: null }, {})

  assert.deepEqual(closes, [[1008, 'Admin access required']])
  assert.equal(welcomed, false)
})

test('saving a TradingView session invalidates its cached websocket token', (t) => {
  const socketServer = new BacktesterDataWebSocket({})
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-tv-session-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))

  socketServer.configPath = path.join(tempDir, 'config.json')
  const messages = []
  let closeCalls = 0
  socketServer.send = (_ws, message) => messages.push(message)
  socketServer.tradingViewHandler.marketData.close = () => {
    closeCalls += 1
  }

  socketServer.onSaveToken({}, {
    source: 'tradingview',
    token: 'same-session-id',
  })

  assert.equal(closeCalls, 1)
  assert.equal(messages.at(-1).success, true)
  assert.equal(
    JSON.parse(fs.readFileSync(socketServer.configPath, 'utf8')).sessions.tradingview,
    'same-session-id'
  )
})
