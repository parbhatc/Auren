import test from 'node:test'
import assert from 'node:assert/strict'

import BacktesterWebSocket from '../src/websocket/BacktesterWebSocket.js'

function createSocket() {
  return {
    readyState: 1,
    sent: [],
    send(raw) {
      this.sent.push(JSON.parse(raw))
    },
  }
}

function createBarCache(nextTimeMs) {
  const nextBar = {
    time: nextTimeMs,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 10,
  }

  return {
    last: new Date(nextTimeMs - 60_000),
    getNewest: () => null,
    loadForward: () => [nextBar],
    loadRange: () => [nextBar],
    addBars: () => {},
    clearAll: () => {},
  }
}

test('closing a stale socket does not delete the active replay subscription', () => {
  const replay = new BacktesterWebSocket({ csvLoader: {} })
  const staleClient = { id: 'socket-stale', userId: 'same-user' }
  const activeClient = { id: 'socket-active', userId: 'same-user' }

  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '1',
    subscriberUID: 'stale-sub',
  }, staleClient)
  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '1',
    subscriberUID: 'active-sub',
  }, activeClient)

  replay.handleClose(createSocket(), staleClient)

  assert.equal(replay.getClientState(staleClient, false), null)
  assert.equal(replay.getClientState(activeClient, false).subscriptions.size, 1)
  assert.equal(replay.getClientState(activeClient, false).subscriptions.has('active-sub'), true)
})

test('next candle streams only the requesting socket subscriptions', () => {
  const replay = new BacktesterWebSocket({ csvLoader: {} })
  const firstClient = { id: 'socket-first', userId: 'same-user' }
  const secondClient = { id: 'socket-second', userId: 'same-user' }
  const targetSec = 1_800_000_060

  replay.onSubscribeBars(createSocket(), {
    symbol: 'ES',
    resolution: '1',
    subscriberUID: 'first-sub',
  }, firstClient)
  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '1',
    subscriberUID: 'second-sub',
  }, secondClient)

  const state = replay.getClientState(secondClient)
  state.barCache = createBarCache(targetSec * 1000)
  state.cursor = new Date((targetSec - 60) * 1000)

  const ws = createSocket()
  replay.onNextCandle(ws, {
    playbackTimeframe: '1',
    cursorSec: targetSec - 60,
    stepSec: 60,
    targetSec,
  }, secondClient)

  const bars = ws.sent.filter((message) => message.type === 'realtimeBars')
  const ack = ws.sent.find((message) => message.type === 'nextCandleAck')

  assert.equal(bars.length, 1)
  assert.equal(bars[0].subscriberUID, 'second-sub')
  assert.equal(bars[0].candles.length, 1)
  assert.deepEqual(ack, { type: 'nextCandleAck', cursorSec: targetSec, emitted: 1 })
})

test('step before session initialization is acknowledged without throwing', () => {
  const replay = new BacktesterWebSocket({ csvLoader: {} })
  const ws = createSocket()

  replay.onNextCandle(ws, { cursorSec: 1234 }, { id: 'socket-uninitialized', userId: 'user' })

  assert.deepEqual(ws.sent, [
    { type: 'nextCandleAck', cursorSec: 1234, emitted: 0 },
  ])
})
