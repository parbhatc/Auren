import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import BacktesterDataWebSocket from '../src/websocket/BacktesterDataWebSocket.js'

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
