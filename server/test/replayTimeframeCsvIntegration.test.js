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
  assert.deepEqual(historyRequests.map((request) => request.resolution), ['30s', '30s', '1', '1', '5', '5'])
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
