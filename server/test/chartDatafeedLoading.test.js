import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

async function loadDatafeed(relativePath) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    define: { 'import.meta.env': '{}' },
    plugins: [{
      name: 'datafeed-test-api',
      setup(builder) {
        builder.onResolve({ filter: /\/api\/api$/ }, () => ({ path: 'api', namespace: 'test-api' }))
        builder.onLoad({ filter: /.*/, namespace: 'test-api' }, () => ({
          contents: `
            export const getApiBaseUrl = () => '/api';
            export const getAuthHeaders = () => ({});
            export const getAuthToken = () => null;
            export const getWebSocketUrl = (path) => 'ws://localhost' + path;
            export default { get: (...args) => globalThis.datafeedApiGet(...args) };
          `,
        }))
      },
    }],
  })
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
}

const { TradeseaDatafeed } = await loadDatafeed('../../src/services/tradesea/TradeseaDatafeed.ts')
const { createPracticeMarketDatafeed } = await loadDatafeed('../../src/services/practice/PracticeMarketDatafeed.ts')

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function resolveSymbol(feed, name) {
  return new Promise((resolve, reject) => feed.resolveSymbol(name, resolve, reject))
}

function bars(feed, resolution = '1', to = 1_800_000_000, period = {}) {
  return new Promise((resolve, reject) => feed.getBars(
    { name: 'NQ', ticker: 'CME_MINI:NQ1!' }, resolution,
    { from: to - 30_000, to, countBack: 500, ...period },
    (rows) => resolve(rows), reject,
  ))
}

function liveFeed() {
  return new TradeseaDatafeed({
    mds: { on: () => () => undefined }, accountId: 'account', userId: 'user', connectionGroupId: 'group',
  })
}

const lastLiveBar = (feed) => feed.getLastBarForChart({ symbol: () => 'NQ', resolution: () => '1' })

test('live tail refresh bypasses completed history and replaces stale candle values', async (t) => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1
    return new Response(JSON.stringify({
      s: 'ok', t: [1_799_999_940], o: [100], h: [103], l: [99], c: [100 + requests], v: [10],
    }))
  })
  const feed = liveFeed()
  t.after(() => feed.dispose())
  assert.equal((await bars(feed))[0].close, 101)
  assert.equal((await bars(feed))[0].close, 101)
  assert.equal(requests, 1)
  assert.equal((await bars(feed, '1', undefined, { refresh: true }))[0].close, 102)
  assert.equal((await bars(feed))[0].close, 102)
  assert.equal(requests, 2, 'fresh tail repair must replace, rather than reuse, a completed source response')
})

function historyResponse(close) {
  return new Response(JSON.stringify({
    s: 'ok', t: [1_799_999_940], o: [100], h: [110], l: [99], c: [close], v: [10],
  }))
}

test('fresh live repair detaches older work, bypasses its queue and shares concurrent fresh callers', async (t) => {
  const old = deferred()
  const fresh = deferred()
  let requests = 0
  t.mock.method(globalThis, 'fetch', () => ++requests === 1 ? old.promise : fresh.promise)
  const feed = liveFeed()
  t.after(() => feed.dispose())
  const original = bars(feed)
  await new Promise(setImmediate)
  const repair = bars(feed, '1', undefined, { refresh: true })
  const duplicate = bars(feed, '1', undefined, { refresh: true })
  await new Promise(setImmediate)
  assert.equal(requests, 2, 'recovery must not wait for an ordinary stalled history queue')
  fresh.resolve(historyResponse(109))
  assert.equal((await repair)[0].close, 109)
  assert.equal((await duplicate)[0].close, 109)
  assert.equal(lastLiveBar(feed).close, 109)
  old.resolve(historyResponse(101))
  await original
  assert.equal(lastLiveBar(feed).close, 109, 'a late invalidated history response must not roll the live mark back')
  assert.equal((await bars(feed))[0].close, 109)
  assert.equal(requests, 2, 'late ordinary completion must not replace the fresh cache')
})

test('live scrollback cannot replace the newest remembered candle or timestamp', async (t) => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => ++requests === 1
    ? historyResponse(109)
    : new Response(JSON.stringify({ s: 'ok', t: [1_699_999_940], o: [80], h: [82], l: [79], c: [81] })))
  const feed = liveFeed()
  t.after(() => feed.dispose())
  await bars(feed)
  const current = lastLiveBar(feed)
  const older = await bars(feed, '1', 1_700_000_000)
  assert.equal(older[0].close, 81, 'older candles are still returned to the history caller')
  assert.equal(lastLiveBar(feed), current, 'older history cannot replace the current candle seed')
})

test('same-bucket live updates received during history repair retain the latest remembered mark', async (t) => {
  const pending = deferred()
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => ++requests === 1 ? historyResponse(109) : pending.promise)
  const listeners = new Map()
  let streamId
  let sourceResolution
  const ticks = []
  const feed = new TradeseaDatafeed({
    mds: {
      on(type, listener) { listeners.set(type, listener); return () => listeners.delete(type) },
      getConnectionState: () => 'connected',
      hasBookSubscriptionsFor: () => true,
      subscribeCandles(symbols, resolutions) { streamId = symbols[0]; sourceResolution = resolutions[0]; return 1 },
      unsubscribe: () => undefined,
    },
    accountId: 'account', userId: 'user', connectionGroupId: 'group',
  })
  t.after(() => feed.dispose())
  const symbolInfo = { name: 'NQ', ticker: 'CME:NQ', broker_symbol: 'CME:NQ' }
  const requestHistory = (refresh = false) => new Promise((resolve, reject) => feed.getBars(
    symbolInfo, '1', { from: 1_799_970_000, to: 1_800_000_000, countBack: 500, refresh },
    resolve, reject,
  ))
  await requestHistory()
  feed.subscribeBars(symbolInfo, '1', (bar) => ticks.push(bar), 'test-live')
  const repair = requestHistory(true)
  await new Promise(setImmediate)
  listeners.get('candles')({ id: streamId, r: sourceResolution, t: 1_799_999_940_000, o: 100, h: 118, l: 99, c: 117, v: 10 })
  assert.equal(ticks.length, 1)
  assert.equal(lastLiveBar(feed).close, 117)
  const live = lastLiveBar(feed)
  pending.resolve(historyResponse(110))
  await repair
  assert.equal(lastLiveBar(feed), live, 'same-time repair must preserve a live object received after request start')
})

test('fresh live repair invalidates differently sized overlapping work and retains other resolutions', async (t) => {
  const old = deferred()
  let requests = 0
  t.mock.method(globalThis, 'fetch', () => {
    requests += 1
    return requests === 2 ? old.promise : Promise.resolve(historyResponse(100 + requests))
  })
  const feed = liveFeed()
  t.after(() => feed.dispose())
  await bars(feed, '5')
  const original = bars(feed)
  await new Promise(setImmediate)
  const tail = { from: 1_799_999_880, countBack: 2 }
  await bars(feed, '1', undefined, { ...tail, refresh: true })
  old.resolve(historyResponse(102))
  await original
  await bars(feed, '5')
  assert.equal(requests, 3, 'a tail repair must preserve unrelated warm history')
  assert.equal((await bars(feed))[0].close, 104)
  assert.equal(requests, 4, 'an invalidated overlapping result cannot repopulate its larger window')
})

test('fresh live repair rejects network failures while ordinary expired history keeps stale resilience', async (t) => {
  const started = Date.now()
  let now = started
  let requests = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(console, 'warn', () => undefined)
  t.mock.method(globalThis, 'fetch', async () => {
    if (++requests === 1) return historyResponse(101)
    throw new Error('offline during resume')
  })
  const feed = liveFeed()
  t.after(() => feed.dispose())
  await bars(feed)
  now += 100_000
  assert.equal((await bars(feed))[0].close, 101, 'ordinary reads may retain offline continuity')
  await assert.rejects(bars(feed, '1', undefined, { refresh: true }), /offline during resume/)
  assert.equal(requests, 3)
})

test('fresh live repair rejects exhausted rate limits instead of claiming stale cache recovered the gap', async (t) => {
  let requests = 0
  t.mock.method(console, 'warn', () => undefined)
  t.mock.method(globalThis, 'fetch', async () => {
    if (++requests === 1) return historyResponse(101)
    return new Response(JSON.stringify({ s: 'error', message: 'limited' }), { status: 429 })
  })
  const feed = liveFeed()
  t.after(() => feed.dispose())
  t.mock.method(feed, 'sleep', async () => undefined)
  await bars(feed)
  await assert.rejects(bars(feed, '1', undefined, { refresh: true }), /rate limited/)
  assert.equal(requests, 6)
})

test('live symbol metadata resolves before the catalog and is shared across panes and timeframes', async (t) => {
  const catalog = deferred()
  const metadata = deferred()
  let metadataRequests = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(options.signal, 'upstream reads must have a finite timeout')
    if (String(url).includes('/all/symbols')) return catalog.promise
    metadataRequests += 1
    return metadata.promise
  })
  const feed = liveFeed()
  const first = resolveSymbol(feed, 'NQ')
  const duplicate = resolveSymbol(feed, 'CME:NQ')
  assert.equal(metadataRequests, 1)
  metadata.resolve(new Response(JSON.stringify({ name: 'CME:NQ', ticker: 'CME:NQ', minmov: 25, pricescale: 100 })))
  const [info, sameInfo] = await Promise.all([first, duplicate])
  assert.equal(info, sameInfo)
  assert.equal(await resolveSymbol(feed, 'NQ'), info)
  assert.equal(metadataRequests, 1, 'revisiting an interval must reuse symbol metadata')
  catalog.resolve(new Response('[]'))
  await feed.whenSymbolsReady()
  feed.dispose()
})

test('live symbol resolution falls back to catalog metadata after a UDF failure', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => new Response(JSON.stringify(
    String(url).includes('/all/symbols')
      ? [{ symbol: 'NQ', ticker: 'CME:NQ', minTick: 0.25, precision: 2, description: 'Nasdaq futures' }]
      : { s: 'error' },
  )))
  const feed = liveFeed()
  const info = await resolveSymbol(feed, 'NQ')
  assert.equal(info.description, 'Nasdaq futures')
  assert.equal(info.broker_symbol, 'CME:NQ')
  feed.dispose()
})

class FakeSocket {
  static OPEN = 1
  static instances = []
  readyState = 0
  sent = []
  constructor() {
    FakeSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.onmessage?.({ data: '{"type":"connected"}' })
    })
  }
  send(raw) {
    const message = JSON.parse(raw)
    this.sent.push(message)
    if (message.type === 'history') {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({
        id: message.id, type: 'response',
        data: { bars: [{ time: 60, open: 100, high: 102, low: 99, close: 101 }] },
      }) }))
    }
  }
  close() { this.readyState = 3; this.onclose?.() }
}

function setupPractice(t, fallback = {}) {
  let feed
  const originals = new Map(['window', 'WebSocket', 'datafeedApiGet'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  t.after(() => {
    feed?.dispose()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  globalThis.window = { setTimeout, clearTimeout }
  globalThis.WebSocket = FakeSocket
  globalThis.datafeedApiGet = async () => ({
    data: { data: { streamPath: '/stream', searchPath: '/search' } },
  })
  feed = createPracticeMarketDatafeed(fallback)
  return feed
}

test('practice history shares concurrent loads and reuses a recently visited timeframe', async (t) => {
  const feed = setupPractice(t)
  const first = bars(feed)
  const duplicate = bars(feed)
  await Promise.all([first, duplicate])
  const socket = FakeSocket.instances.at(-1)
  assert.equal(socket.sent.length, 1)
  await bars(feed, '5')
  await bars(feed)
  assert.equal(socket.sent.length, 2, 'switching back should use the warm history')
  await bars(feed, '1', 1_700_000_000)
  assert.equal(socket.sent.length, 3, 'scrollback cursors must remain separate')
  feed.clearHistoryCache()
  await bars(feed)
  assert.equal(socket.sent.length, 4, 'an explicit refresh must invalidate cached history')
})

test('practice tail refresh bypasses completed history without discarding warm scrollback', async (t) => {
  const feed = setupPractice(t)
  await bars(feed)
  await bars(feed, '5')
  const socket = FakeSocket.instances.at(-1)
  assert.equal(socket.sent.length, 2)
  await bars(feed, '1', undefined, { refresh: true })
  assert.equal(socket.sent.length, 3, 'tail repair must reach the source even while the same window is cached')
  await bars(feed)
  await bars(feed, '5')
  assert.equal(socket.sent.length, 3, 'other warm history and the refreshed response remain reusable')
})

test('practice fresh repair detaches ordinary history and keeps its fresh cache after a late response', async (t) => {
  const feed = setupPractice(t)
  class ManualSocket extends FakeSocket {
    send(raw) { this.sent.push(JSON.parse(raw)) }
    respond(index, close) {
      this.onmessage({ data: JSON.stringify({ id: this.sent[index].id, type: 'response', data: {
        bars: [{ time: 60, open: 100, high: 110, low: 99, close }],
      } }) })
    }
  }
  globalThis.WebSocket = ManualSocket
  const original = bars(feed)
  await new Promise(setImmediate)
  const socket = FakeSocket.instances.at(-1)
  const repair = bars(feed, '1', undefined, { refresh: true })
  const duplicate = bars(feed, '1', undefined, { refresh: true })
  await new Promise(setImmediate)
  assert.equal(socket.sent.length, 2)
  socket.respond(1, 109)
  assert.equal((await repair)[0].close, 109)
  assert.equal((await duplicate)[0].close, 109)
  socket.respond(0, 101)
  await original
  assert.equal(feed.getLastBarForChart({ symbol: () => 'CME_MINI:NQ1!' }).close, 109)
  assert.equal((await bars(feed))[0].close, 109)
  assert.equal(socket.sent.length, 2)
})

test('practice history cannot roll newer live marks or execution seeds back within a bucket or during scrollback', async (t) => {
  const applied = []
  const feed = setupPractice(t, { applyExternalMarketBar: (_symbol, bar) => applied.push(bar.close) })
  class ManualSocket extends FakeSocket {
    send(raw) { this.sent.push(JSON.parse(raw)) }
    respond(index, time, close) {
      this.onmessage({ data: JSON.stringify({ id: this.sent[index].id, type: 'response', data: {
        bars: [{ time, open: 100, high: 120, low: 99, close }],
      } }) })
    }
  }
  globalThis.WebSocket = ManualSocket
  const initial = bars(feed)
  await new Promise(setImmediate)
  const socket = FakeSocket.instances.at(-1)
  socket.respond(0, 1_799_999_940, 109)
  await initial
  const repair = bars(feed, '1', undefined, { refresh: true })
  await new Promise(setImmediate)
  socket.onmessage({ data: JSON.stringify({ type: 'bar', symbol: 'CME_MINI:NQ1!', bar: {
    time: 1_799_999_940, open: 100, high: 118, low: 99, close: 117,
  } }) })
  socket.respond(1, 1_799_999_940, 110)
  await repair
  const current = feed.getLastBarForChart({ symbol: () => 'CME_MINI:NQ1!' })
  assert.equal(current.close, 117)
  const older = bars(feed, '1', 1_700_000_000)
  await new Promise(setImmediate)
  socket.respond(2, 1_699_999_940, 81)
  await older
  assert.equal(feed.getLastBarForChart({ symbol: () => 'CME_MINI:NQ1!' }), current)
  assert.ok(!applied.includes(110) && !applied.includes(81), 'stale history cannot be forwarded to execution marks')
})

test('practice symbol searches are shared while metadata is loading', async (t) => {
  const feed = setupPractice(t)
  const search = deferred()
  let searches = 0
  globalThis.datafeedApiGet = async (path) => {
    if (path.includes('/config')) return { data: { data: { streamPath: '/stream', searchPath: '/search' } } }
    searches += 1
    return search.promise
  }
  const first = resolveSymbol(feed, 'NQ')
  const second = resolveSymbol(feed, 'NQ')
  search.resolve({ data: { data: [{ symbol: 'NQ', source_id: 'CME_MINI', type: 'futures' }] } })
  const [info, sameInfo] = await Promise.all([first, second])
  assert.equal(info, sameInfo)
  assert.equal(searches, 1)
})

test('practice connections reject immediately if the socket closes before its welcome message', async (t) => {
  const feed = setupPractice(t)
  class ClosingSocket {
    static OPEN = 1
    readyState = 0
    constructor() { queueMicrotask(() => this.close()) }
    close() { this.readyState = 3; this.onclose?.() }
  }
  // Closing before the welcome frame must settle every chart history request.
  globalThis.WebSocket = ClosingSocket
  await assert.rejects(bars(feed), /disconnected/)
})

test('an in-flight practice history response cannot repopulate an explicitly cleared cache', async (t) => {
  const feed = setupPractice(t)
  class ManualSocket extends FakeSocket {
    send(raw) { this.sent.push(JSON.parse(raw)) }
    respond(index) {
      this.onmessage({ data: JSON.stringify({ id: this.sent[index].id, type: 'response', data: { bars: [] } }) })
    }
  }
  globalThis.WebSocket = ManualSocket
  const first = bars(feed)
  await new Promise(setImmediate)
  const socket = FakeSocket.instances.at(-1)
  feed.clearHistoryCache()
  socket.respond(0)
  await first
  const second = bars(feed)
  await new Promise(setImmediate)
  assert.equal(socket.sent.length, 2, 'a cleared in-flight response must not become a cache hit')
  socket.respond(1)
  await second
})

test('disposing while provider config loads does not open an orphan market-data connection', async (t) => {
  const feed = setupPractice(t)
  const config = deferred()
  globalThis.datafeedApiGet = () => config.promise
  const initialSocketCount = FakeSocket.instances.length
  const result = bars(feed)
  feed.dispose()
  config.resolve({ data: { data: { streamPath: '/stream', searchPath: '/search' } } })
  await assert.rejects(result, /disposed/)
  assert.equal(FakeSocket.instances.length, initialSocketCount)
})
