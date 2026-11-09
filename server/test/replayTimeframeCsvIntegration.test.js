import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { resolveBwcRoot } from '../../scripts/resolve-bwc-root.mjs'
import CSVLoader from '../src/utils/CSVLoader.js'
import BacktesterBarsService from '../src/services/BacktesterBarsService.js'

// Keep the real Replay feed, chart adapter and API serialization. Replace only
// the HTTP/config transport; real server history code reads temporary CSVs.
const bundled = await build({
  stdin: {
    contents: `
      export { BacktesterChartDataFeed } from './src/backtester/components/chart/BacktesterChartDataFeed.tsx';
      export { createBwcDatafeed } from './src/services/chart/bwcDatafeed.ts';
      export { tradeseaResolutionToSeconds } from './src/services/tradesea/tradeseaResolutions.ts';
    `,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'replay-config-transport', setup(builder) {
    builder.onResolve({ filter: /^\.\/api$/ }, ({ importer }) => {
      if (importer.replaceAll('\\', '/').endsWith('/src/api/backtester.api.ts')) {
        return { path: 'api-transport', namespace: 'replay-csv-test' }
      }
    })
    builder.onLoad({ filter: /.*/, namespace: 'replay-csv-test' }, () => ({ contents: `
      export const getApiBaseUrl = () => '/api';
      export const getAuthHeaders = () => ({ Authorization: 'Bearer fixture-user' });
      export default { async get(url) {
        if (url !== '/backtester/symbol-data') throw new Error('Unexpected metadata read: ' + url);
        return { data: { success: true, symbols: {
          NQ: { tickSize: 0.25, tickValue: 5, supportedChartResolutions: ['30S', '1', '5'] },
        } } };
      } };
    ` }))
  } }],
})
const { BacktesterChartDataFeed, createBwcDatafeed, tradeseaResolutionToSeconds } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`,
)
const bwcRoot = resolveBwcRoot()
const bwcImport = (file) => import(pathToFileURL(path.join(bwcRoot, file)).href)
const [{ createBarLoader }, { createHistoryRequestCache }, { clearResolutionCache }] = await Promise.all([
  bwcImport('public/js/app/bar/loader.js'),
  bwcImport('public/js/datafeed/historyRequests.js'),
  bwcImport('public/js/app/bar/resolutionCache.js'),
])

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('switching from 1m to 30s includes the closing half-minute bar', () => {
  const source = new BacktesterChartDataFeed(null)
  const minuteOpen = 1_800_000_000
  source.setPlaybackAnchorSec(minuteOpen, '1')

  const clamped = source.clampPeriodToSessionAnchor({
    from: minuteOpen - 120,
    to: minuteOpen + 60,
    countBack: 5,
    firstDataRequest: true,
  }, '30S')

  assert.equal(source.getPlaybackAnchorSecForResolution('30S'), minuteOpen + 30)
  assert.equal(clamped.to, minuteOpen + 30)
})

test('completed 15m replay history reveals the full source candle and keeps earlier backfill bounded', () => {
  const source = new BacktesterChartDataFeed(null)
  const anchor = Date.parse('2026-11-06T09:30:00-05:00') / 1000
  source.setPlaybackAnchorSec(anchor, '15')

  for (const target of ['1', '15', '60']) {
    const currentOpen = source.getPlaybackAnchorSecForResolution(target)
    const current = source.clampPeriodToSessionAnchor({ to: currentOpen, countBack: 10, firstDataRequest: true }, target)
    assert.equal(current.to, anchor + 14 * 60, `${target}: includes 09:44 minute`)
    const olderTo = anchor - 3600
    const older = source.clampPeriodToSessionAnchor({ to: olderTo, countBack: 10, firstDataRequest: false }, target)
    assert.equal(older.to, olderTo, `${target}: does not expand an older backfill page`)
  }
  const seconds = source.clampPeriodToSessionAnchor({ to: anchor + 14 * 60 + 30, firstDataRequest: true }, '30S')
  assert.equal(seconds.to, anchor + 14 * 60 + 30)
})

test('history reads cannot move the source replay cursor or replace completed candles with stale finer data', () => {
  const source = new BacktesterChartDataFeed(null)
  const anchor = Date.parse('2026-11-06T09:30:00-05:00') / 1000
  source.setPlaybackAnchorSec(anchor, '15')
  const complete = { time: anchor, open: 100, high: 130, low: 90, close: 125, volume: 150 }
  source.replayLtfBars.set('NQ:1', [{ time: anchor, open: 100, high: 101, low: 99, close: 100, volume: 1 }])
  assert.deepEqual(source.patchFormingHtfBars([complete], 'NQ', '15'), [complete])

  let delivered = null
  source.pendingGetBarsRequests.set('finer-history', {
    symbol: 'NQ', resolution: '1',
    onHistoryCallback: bars => { delivered = bars },
    onErrorCallback: reason => assert.fail(reason),
  })
  source.handleGetBarsResponse({ requestId: 'finer-history', bars: [{ ...complete, time: anchor + 14 * 60 }] })
  assert.equal(delivered.at(-1).time, anchor + 14 * 60)
  assert.equal(source.getPlaybackAnchorSecPublic(), anchor)
  assert.equal(source.playbackAnchorResolution, '15')
})

test('CSV-backed 09:15 and 09:30 candles retain distinct full OHLC across history round trips', () => {
  const start = Date.parse('2026-11-06T09:15:00-05:00') / 1000
  const minutes = Array.from({ length: 30 }, (_, index) => ({
    time: (start + index * 60) * 1000,
    open: 100 + index, high: 102 + index, low: 99 + index, close: 101 + index, volume: 10,
  }))
  const select = (from, to) => minutes.filter(bar => bar.time >= from && bar.time <= to)
  const service = new BacktesterBarsService({
    loadBars: (_symbol, from, to) => select(from, to),
    loadCountback: (_symbol, to, count, inclusive) => minutes.filter(bar => inclusive ? bar.time <= to : bar.time < to).slice(-count),
  })
  const source = new BacktesterChartDataFeed(null)
  const read = anchor => {
    source.setPlaybackAnchorSec(anchor, '15')
    const bounds = source.clampPeriodToSessionAnchor({ to: anchor, from: start, countBack: 2, firstDataRequest: true }, '15')
    return service.getHistoryBars({ symbol: 'NQ', resolution: '15', ...bounds }).bars
  }
  const first = read(start)
  const next = read(start + 900)
  assert.equal(first.length, 1)
  assert.equal(first[0].close, 115)
  assert.equal(next.length, 2)
  assert.equal(next[1].close, 130)
  assert.deepEqual(next[0], first[0])
  assert.deepEqual(read(start), first)
  assert.deepEqual(read(start + 900), next)
})

test('one-second replay reloads forming intraday candles without exposing the final OHLC', async (t) => {
  const source = new BacktesterChartDataFeed(null)
  // 10:00 ET is a 4h open even though 14:00 UTC is not a UTC 4h boundary.
  const openSec = Date.parse('2026-07-08T10:00:00-04:00') / 1000
  let previous
  const completed = { time: openSec, open: 100, high: 130, low: 80, close: 120, volume: 500 }
  const seconds = [
    { time: openSec, open: 100, high: 102, low: 99, close: 101, volume: 3 },
    { time: openSec + 1, open: 101, high: 104, low: 98, close: 103, volume: 7 },
  ]
  const read = async (anchor, resolution) => {
    source.setPlaybackAnchorSec(anchor, '1S')
    let result
    const requestId = String(anchor)
    source.pendingGetBarsRequests.set(requestId, {
      symbol: 'NQ', resolution,
      onHistoryCallback: bars => { result = bars },
      onErrorCallback: reason => assert.fail(reason),
    })
    await source.fetchBarsHttp({ requestId, symbol: 'NQ', resolution, to: anchor, firstDataRequest: true })
    return result
  }
  t.mock.method(globalThis, 'fetch', async (url) => {
    const query = new URL(String(url), 'https://replay.test').searchParams
    const fine = query.get('resolution') === '1s'
    if (fine) assert.equal(Number(query.get('from')), openSec - 1)
    const bars = fine ? seconds.filter(bar => bar.time <= Number(query.get('to'))) : [previous, completed]
    return new Response(JSON.stringify({ success: true, bars }))
  })
  for (const resolution of ['1', '60', '240']) {
    const intervalSec = Number(resolution) * 60
    previous = { time: openSec - intervalSec, open: 98, high: 100, low: 96, close: 99, volume: 30 }
    const advanced = [previous, {
      time: openSec, open: 100, high: 104, low: 98, close: 103, volume: 10,
    }]
    assert.deepEqual(await read(openSec + 1, resolution), advanced)
    assert.deepEqual(await read(openSec, resolution), [previous, seconds[0]])
    assert.deepEqual(await read(openSec + 1, resolution), advanced)
    source.setPlaybackAnchorSec(openSec, resolution)
    assert.equal(source.getPlaybackStepCursorSec('1S'), openSec + intervalSec - 1)
  }
})

test('actual Replay and CSV history reuse 30s/1m/5m round trips and join overlapping backfill', async (t) => {
  const csvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-replay-timeframes-'))
  t.after(() => fs.rmSync(csvDir, { recursive: true, force: true }))
  const anchor = Math.floor(new Date(2026, 6, 15, 12, 30, 30).getTime() / 1000)
  t.mock.method(Date, 'now', () => anchor * 1000)
  const files = {}
  for (const [folder, seconds, count, price] of [['30s', 30, 4800, 100], ['1m', 60, 2400, 500]]) {
    const last = Math.floor(anchor / seconds) * seconds
    const rows = Array.from({ length: count }, (_, index) => {
      const time = last - (count - index - 1) * seconds
      return `${time},${price},${price + 2},${price - 1},${price + 1},10`
    })
    const file = path.join(csvDir, 'NQ', folder, '2026', 'July.csv')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, rows.join('\n'))
    files[folder] = file
  }

  // Retain CSVLoader's real constructor/cache behavior and release its normal
  // ten-minute maintenance timer when this fixture finishes.
  const realSetInterval = globalThis.setInterval
  const intervals = []
  t.mock.method(globalThis, 'setInterval', (...args) => {
    const timer = realSetInterval(...args)
    timer.unref()
    intervals.push(timer)
    return timer
  })
  t.after(() => { for (const timer of intervals) clearInterval(timer) })
  const csv = new CSVLoader(csvDir)
  const service = new BacktesterBarsService(csv)
  const diskReads = []
  const readFileSync = fs.readFileSync
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (String(file).endsWith('.csv')) diskReads.push(String(file))
    return readFileSync(file, ...args)
  })
  t.mock.method(console, 'log', () => {})

  const previous = { window: globalThis.window, storage: globalThis.localStorage, raf: globalThis.requestAnimationFrame, cancelRaf: globalThis.cancelAnimationFrame }
  globalThis.window = { setTimeout(callback, ms) { const timer = setTimeout(callback, ms); timer.unref(); return timer } }
  globalThis.localStorage = { getItem: () => null }
  globalThis.requestAnimationFrame = (callback) => setImmediate(callback)
  globalThis.cancelAnimationFrame = clearImmediate
  t.after(() => {
    globalThis.window = previous.window
    globalThis.localStorage = previous.storage
    globalThis.requestAnimationFrame = previous.raf
    globalThis.cancelAnimationFrame = previous.cancelRaf
  })
  const historyRequests = []
  let nextGate = null
  t.mock.method(globalThis, 'fetch', async (url) => {
    const request = new URL(String(url), 'https://replay.test')
    assert.equal(request.pathname, '/api/backtester/history')
    const params = {
      symbol: request.searchParams.get('symbol'), resolution: request.searchParams.get('resolution'),
      from: Number(request.searchParams.get('from')), to: Number(request.searchParams.get('to')),
      countBack: Number(request.searchParams.get('countback')),
      firstDataRequest: request.searchParams.get('firstDataRequest') === 'true',
      requestId: request.searchParams.get('requestId'),
    }
    historyRequests.push(params)
    const gate = nextGate
    nextGate = null
    if (gate) { gate.started.resolve(); await gate.release.promise }
    return new Response(JSON.stringify({ success: true, ...service.getHistoryBars(params) }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const ws = { isConnected: () => true, isChartReady: () => true, getSession: () => null, send() {} }
  const source = new BacktesterChartDataFeed(ws)
  source.setPlaybackAnchorSec(anchor, '30S')
  const adapter = createBwcDatafeed(source)
  const feed = createHistoryRequestCache(adapter)
  t.after(() => { adapter.dispose(); feed.historyCache.dispose(); source.resetSessionState(); clearResolutionCache() })
  const info = await feed.resolveSymbol('NQ')
  let logicalRange = { from: 50, to: 100 }
  const pane = {
    index: 0, symbol: 'NQ', resolution: '30S', symbolInfo: info, bars: [],
    chart: { timeScale: () => ({
      getVisibleLogicalRange: () => logicalRange,
      setVisibleLogicalRange: (next) => { logicalRange = next },
    }) },
  }
  const loader = createBarLoader({
    datafeed: feed, countBack: 120, historyChunk: 500,
    getAllChartPanes: () => [pane], getActivePaneIndex: () => 0,
    getBarSecForPane: (current) => tradeseaResolutionToSeconds(current.resolution),
    getRequiredChartBarsForPane: () => 240,
    isReplayLocked: () => true,
    getReplayLoadContext: (current) => {
      const cap = source.getPlaybackAnchorSecForResolution(current.resolution)
      return { anchorFrom: cap, loadTo: cap, capDisplay: cap }
    },
    refreshPaneCandleData() {}, setPrimaryBars() {}, setBarsLoading() {}, refreshStatusLine() {}, setHoverState() {},
  })

  await loader.loadPaneBars(pane)
  assert.equal(historyRequests.length, 1)
  assert.equal(historyRequests[0].resolution, '30s', 'the actual API serializes native seconds')
  assert.equal(pane.bars.length, 120)
  assert.equal(pane.bars[0].open, 100)

  // A second consumer arrives while real CSV-backed older history is pending.
  // Its requested window is covered by that page, so the broker must join it.
  const gate = { started: deferred(), release: deferred() }
  nextGate = gate
  const backfill = loader.ensureIndicatorChartHistory(pane)
  await gate.started.promise
  const page = historyRequests.at(-1)
  const overlapping = feed.getBars(info, '30S', {
    from: page.to - 59 * 30, to: page.to, countBack: 60, firstDataRequest: false,
  })
  gate.release.resolve()
  const [, overlapResult] = await Promise.all([backfill, overlapping])
  assert.equal(overlapResult.bars.length, 60)
  assert.equal(historyRequests.length, 2, 'overlapping consumers make one older-page download')
  assert.equal(feed.historyCache.stats().inflightJoins, 1)
  assert.equal(pane.bars.length, 240)
  const originalThirtySecondBars = pane.bars.slice()

  for (const resolution of ['1', '5']) {
    const validation = await source.validateResolutionAtCursor('NQ', resolution)
    assert.equal(validation.ok, true)
    loader.stashPaneResolutionCache(pane, pane.resolution)
    pane.resolution = resolution
    await loader.loadPaneBars(pane, { force: true })
    await loader.ensureIndicatorChartHistory(pane)
    assert.ok(pane.bars.length >= 240)
    assert.equal(pane.bars[0].open, 500, 'minute and HTF history use the native minute dataset')
    assert.ok(pane.bars.at(-1).time <= source.getPlaybackAnchorSecForResolution(resolution))
  }
  assert.deepEqual(historyRequests.map((request) => request.resolution), ['30s', '30s', '1', '30s', '1', '5', '30s', '5'])
  assert.ok(historyRequests.filter((request) => request.requestId === null && request.resolution === '30s')
    .every((request) => request.to === anchor && request.to - request.from <= 300),
  'forming candles only read the fine bars inside their active bucket')
  assert.deepEqual(diskReads.sort(), [files['1m'], files['30s']].sort(), '1m and 5m share one parsed month; native 30s reads its own month once')
  for (const resolution of ['30s', '1', '5']) {
    const [initial, older] = historyRequests.filter((request) => request.resolution === resolution)
    assert.ok(older.to < initial.from, `${resolution}: backfill requests disjoint older windows`)
  }

  const downloadsBeforeReturn = historyRequests.length
  for (const resolution of ['30S', '1', '5', '30S']) {
    assert.equal((await source.validateResolutionAtCursor('NQ', resolution)).ok, true)
    loader.stashPaneResolutionCache(pane, pane.resolution)
    pane.resolution = resolution
    await loader.loadPaneBars(pane, { force: true })
    await loader.ensureIndicatorChartHistory(pane)
    assert.equal(new Set(pane.bars.map((bar) => bar.time)).size, pane.bars.length)
  }
  assert.equal(historyRequests.length, downloadsBeforeReturn, 'all warm returns reuse full snapshots without another history or 30s probe request')
  assert.deepEqual(pane.bars, originalThirtySecondBars, 'returning to 30s preserves all original candles and OHLC')
  assert.equal(diskReads.length, 2)
  assert.equal(source.getPlaybackAnchorSecPublic(), anchor, 'timeframe reads cannot move the authoritative replay cursor')
})
