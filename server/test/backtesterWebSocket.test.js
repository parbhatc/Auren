import test from 'node:test'
import assert from 'node:assert/strict'

import BacktesterWebSocket from '../src/websocket/BacktesterWebSocket.js'
import BarCache from '../src/utils/BarCache.js'
import BacktesterBarsService from '../src/services/BacktesterBarsService.js'
import { replaySourceCutoffSec } from '../src/utils/backtesterResolution.js'

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

function minuteReplayFixture() {
  const base = Date.parse('2026-11-06T09:15:00-05:00')
  const source = Array.from({ length: 60 }, (_, index) => ({
    time: base + index * 60_000,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 1,
  }))
  const loader = {
    loadBars: (_symbol, from, to) => source.filter((bar) => bar.time >= from && bar.time <= to),
    loadForward: (_symbol, after, count) => source.filter((bar) => bar.time > after).slice(0, count),
    loadCountback: (_symbol, before, count, inclusive) => source
      .filter((bar) => inclusive ? bar.time <= before : bar.time < before).slice(-count),
  }
  const replay = new BacktesterWebSocket({ csvLoader: loader })
  replay.toEpochMs = (value) => Number(value) * 1000
  const client = { id: 'completed-source-candle', userId: 'user' }
  replay.onSubscribeBars(createSocket(), { symbol: 'NQ', resolution: '15', subscriberUID: 'nq-15m' }, client)
  const state = replay.getClientState(client)
  state.cursor = new Date(base)
  state.barCache = new BarCache({ csvLoader: loader }, state.cursor)
  return { base, loader, replay, client, service: new BacktesterBarsService(loader) }
}

function candleValues(bars) {
  return bars.map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }))
}

test('15m Next reveals the full distinct 09:30 candle and matches direct history at the source cutoff', () => {
  const { base, replay, client, service } = minuteReplayFixture()
  const cursor = base / 1000
  const target = cursor + 900
  const ws = createSocket()
  replay.onNextCandle(ws, { cursorSec: cursor, targetSec: target, stepSec: 900, playbackTimeframe: '15' }, client)
  const streamed = ws.sent.find((message) => message.type === 'realtimeBars').candles
  const cutoff = replaySourceCutoffSec(target, '15', 60)
  const history = service.getHistoryBars({ symbol: 'NQ', resolution: '15', from: cursor, to: cutoff }).bars
  assert.deepEqual(streamed.map((bar) => bar.time), [base, base + 900_000])
  assert.equal(streamed[0].close, 114.5)
  assert.equal(streamed[1].close, 129.5)
  assert.equal(streamed[1].volume, 15)
  assert.deepEqual(candleValues(streamed), history)

  // Rewinding the server cursor must not allow its future cache to alter the
  // same forward request on a second pass.
  replay.onSyncReplayCursor(createSocket(), { cursorSec: cursor }, client)
  const again = createSocket()
  replay.onNextCandle(again, { cursorSec: cursor, targetSec: target, stepSec: 900, playbackTimeframe: '15' }, client)
  assert.deepEqual(again.sent, ws.sent)
})

test('1m Next across a 15m boundary includes the new minute in the new chart bucket', () => {
  const { base, replay, client, service } = minuteReplayFixture()
  const cursor = base / 1000 + 14 * 60
  const target = cursor + 60
  const ws = createSocket()
  replay.onNextCandle(ws, { cursorSec: cursor, targetSec: target, stepSec: 60, playbackTimeframe: '1' }, client)
  const streamed = ws.sent.find((message) => message.type === 'realtimeBars').candles
  const history = service.getHistoryBars({ symbol: 'NQ', resolution: '15', from: base / 1000, to: target }).bars
  assert.deepEqual(candleValues(streamed), history)
  assert.equal(streamed[0].volume, 15)
  assert.equal(streamed[1].time, base + 900_000)
  assert.equal(streamed[1].volume, 1)
  assert.equal(streamed[1].close, 115.5)
})

test('1s replay rebuilds all 900 source rows in a 15m candle without truncation', () => {
  const base = Date.parse('2026-11-06T09:15:00-05:00')
  const rows = Array.from({ length: 901 }, (_, index) => ({
    time: base + index * 1000, open: index, high: index + 1, low: index, close: index + 0.5, volume: 1,
  }))
  let requestedCount = 0
  const loader = {
    loadForward(_symbol, after, count) {
      requestedCount = Math.max(requestedCount, count)
      return rows.filter((bar) => bar.time > after).slice(0, count)
    },
  }
  const replay = new BacktesterWebSocket({ csvLoader: loader })
  const client = { id: 'second-source', userId: 'user' }
  replay.onSubscribeBars(createSocket(), { symbol: 'NQ', resolution: '15', subscriberUID: 'nq-15m' }, client)
  const state = replay.getClientState(client)
  state.cursor = new Date(base + 898_000)
  state.barCache = { last: state.cursor, getNewest: () => null }
  const ws = createSocket()
  replay.onNextCandle(ws, {
    cursorSec: base / 1000 + 898, targetSec: base / 1000 + 899, stepSec: 1, playbackTimeframe: '1S',
  }, client)
  const candle = ws.sent.find((message) => message.type === 'realtimeBars').candles[0]
  assert.equal(requestedCount, 900)
  assert.equal(candle.volume, 900)
  assert.equal(candle.close, 899.5)
  assert.equal(candle.time, base)
})

test('1s replay on a native 30s chart builds only revealed seconds instead of exposing the full native candle', () => {
  const base = Date.parse('2026-11-06T09:15:00-05:00')
  const rows = Array.from({ length: 31 }, (_, index) => ({
    time: base + index * 1000, open: index, high: index + 1, low: index, close: index + 0.5, volume: 1,
  }))
  const loader = {
    loadForward: (_symbol, after, count) => rows.filter((bar) => bar.time > after).slice(0, count),
  }
  const replay = new BacktesterWebSocket({ csvLoader: loader })
  const client = { id: 'native-second-source', userId: 'user' }
  replay.onSubscribeBars(createSocket(), { symbol: 'NQ', resolution: '30S', subscriberUID: 'nq-30s' }, client)
  const state = replay.getClientState(client)
  state.cursor = new Date(base + 8000)
  state.barCache = { last: state.cursor, getNewest: () => null }
  const ws = createSocket()
  replay.onNextCandle(ws, {
    cursorSec: base / 1000 + 8, targetSec: base / 1000 + 9, stepSec: 1, playbackTimeframe: '1S',
  }, client)
  const candle = ws.sent.find((message) => message.type === 'realtimeBars').candles[0]
  assert.equal(candle.time, base)
  assert.equal(candle.volume, 10)
  assert.equal(candle.high, 10)
  assert.equal(candle.close, 9.5)
})

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
  assert.equal(bars[0].symbol, 'NQ')
  assert.equal(bars[0].resolution, '1')
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

test('1m step after a 30s-aligned cursor completes the current minute before appending the next', () => {
  const replay = new BacktesterWebSocket({ csvLoader: {} })
  const client = { id: 'socket-30s-to-1m', userId: 'user' }
  const cursorSec = 1_800_000_000
  const targetSec = cursorSec + 60
  const currentBar = {
    time: cursorSec * 1000,
    open: 100,
    high: 103,
    low: 99,
    close: 102,
    volume: 10,
  }
  const nextBar = {
    time: targetSec * 1000,
    open: 102,
    high: 104,
    low: 101,
    close: 103,
    volume: 12,
  }

  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '1',
    subscriberUID: 'one-minute-sub',
  }, client)

  const state = replay.getClientState(client)
  state.cursor = new Date(cursorSec * 1000)
  state.barCache = {
    last: state.cursor,
    getNewest: () => null,
    loadForward: () => [nextBar],
    loadRange: () => [currentBar, nextBar],
    addBars: () => {},
    clearAll: () => {},
  }

  const ws = createSocket()
  replay.onNextCandle(ws, {
    playbackTimeframe: '1',
    cursorSec,
    stepSec: 60,
    targetSec,
  }, client)

  const message = ws.sent.find((item) => item.type === 'realtimeBars')
  assert.ok(message)
  assert.equal(message.subscriberUID, 'one-minute-sub')
  assert.equal(message.symbol, 'NQ')
  assert.equal(message.resolution, '1')
  assert.deepEqual(
    message.candles.map((bar) => bar.time),
    [currentBar.time, nextBar.time],
  )
  assert.equal(message.candles[0].close, currentBar.close)
})

test('next candle skips the NQ maintenance gap from 4:59 PM to 6:00 PM', () => {
  const cursorSec = 1_785_272_340
  const requestedTargetSec = cursorSec + 60
  const nextTradingSec = 1_785_276_000
  const currentBar = {
    time: cursorSec * 1000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 10,
  }
  const nextBar = {
    time: nextTradingSec * 1000,
    open: 101,
    high: 102,
    low: 100,
    close: 101.5,
    volume: 12,
  }
  const replay = new BacktesterWebSocket({
    csvLoader: {
      loadForward: () => [nextBar],
    },
  })
  const client = { id: 'socket-maintenance-gap', userId: 'user' }

  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '1',
    subscriberUID: 'nq-one-minute',
  }, client)

  const state = replay.getClientState(client)
  state.cursor = new Date(cursorSec * 1000)
  state.barCache = {
    last: state.cursor,
    getNewest: () => currentBar.time,
    loadForward: () => [nextBar],
    loadRange: () => [currentBar, nextBar],
    addBars: () => {},
    clearAll: () => {},
  }

  const ws = createSocket()
  replay.onNextCandle(ws, {
    playbackTimeframe: '1',
    chartSymbol: 'NQ',
    cursorSec,
    stepSec: 60,
    targetSec: requestedTargetSec,
  }, client)

  const message = ws.sent.find((item) => item.type === 'realtimeBars')
  const ack = ws.sent.find((item) => item.type === 'nextCandleAck')
  assert.ok(message)
  assert.deepEqual(
    message.candles.map((bar) => bar.time),
    [currentBar.time, nextBar.time],
  )
  assert.deepEqual(ack, {
    type: 'nextCandleAck',
    cursorSec: nextTradingSec,
    emitted: 2,
  })
})

test('sync replay cursor accepts backward movement before the next forward step', () => {
  const replay = new BacktesterWebSocket({ csvLoader: {} })
  replay.toEpochMs = (value) => Number(value) * 1000
  const client = { id: 'socket-rewind', userId: 'user' }
  const state = replay.getClientState(client)
  state.cursor = new Date(1_800_000_120_000)
  state.barCache = { last: state.cursor }

  replay.onSyncReplayCursor(createSocket(), { cursorSec: 1_800_000_000 }, client)

  assert.equal(state.cursor.getTime(), 1_800_000_000_000)
  assert.equal(state.barCache.last.getTime(), 1_800_000_000_000)
})

test('exchange-prefixed active pane advances every 30s subscription without skipping a half-minute', () => {
  const cursorSec = 1_790_602_260 // 9:31:00 AM local in the replay fixture
  const barsBySymbol = {
    NQ: [cursorSec + 30, cursorSec + 60],
    ES: [cursorSec + 30, cursorSec + 60],
  }
  const requestedSymbols = []
  const replay = new BacktesterWebSocket({
    csvLoader: {
      loadForward(symbol, afterMs, count) {
        requestedSymbols.push(symbol)
        return (barsBySymbol[symbol] ?? [])
          .filter((time) => time * 1000 > afterMs)
          .slice(0, count)
          .map((time) => ({
            time: time * 1000,
            open: 100,
            high: 101,
            low: 99,
            close: 100.5,
            volume: 10,
          }))
      },
    },
  })
  const client = { id: 'socket-prefixed-pane', userId: 'user' }
  replay.onSubscribeBars(createSocket(), {
    symbol: 'NQ',
    resolution: '30S',
    subscriberUID: 'nq-pane',
  }, client)
  replay.onSubscribeBars(createSocket(), {
    symbol: 'ES',
    resolution: '30S',
    subscriberUID: 'es-pane',
  }, client)

  const state = replay.getClientState(client)
  state.cursor = new Date(cursorSec * 1000)
  state.barCache = {
    last: state.cursor,
    getNewest: () => null,
    addBars: () => {},
    clearAll: () => {},
  }

  const firstSocket = createSocket()
  replay.onNextCandle(firstSocket, {
    playbackTimeframe: '30S',
    chartSymbol: 'CME:ES',
    cursorSec,
    stepSec: 30,
    targetSec: cursorSec + 30,
  }, client)

  const firstBars = firstSocket.sent.filter((message) => message.type === 'realtimeBars')
  assert.equal(firstBars.length, 2)
  assert.deepEqual(
    firstBars.map((message) => message.candles.at(-1).time),
    [(cursorSec + 30) * 1000, (cursorSec + 30) * 1000],
  )
  assert.deepEqual(
    firstSocket.sent.find((message) => message.type === 'nextCandleAck'),
    { type: 'nextCandleAck', cursorSec: cursorSec + 30, emitted: 2 },
  )

  const secondSocket = createSocket()
  replay.onNextCandle(secondSocket, {
    playbackTimeframe: '30S',
    chartSymbol: 'CME:ES',
    cursorSec: cursorSec + 30,
    stepSec: 30,
    targetSec: cursorSec + 60,
  }, client)

  assert.deepEqual(
    secondSocket.sent.find((message) => message.type === 'nextCandleAck'),
    { type: 'nextCandleAck', cursorSec: cursorSec + 60, emitted: 2 },
  )
  assert.equal(requestedSymbols.includes('CME:ES'), false)
  assert.equal(requestedSymbols.every((symbol) => symbol === 'NQ' || symbol === 'ES'), true)
})
