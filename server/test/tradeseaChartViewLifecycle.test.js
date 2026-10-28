import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/tradesea/TradeseaTradeHandler.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'no-live-orders', setup(builder) {
    builder.onResolve({ filter: /(?:\/api\/api|\/tradesea\.api|\/aurenToast)$/ }, ({ path }) => ({ path, namespace: 'test-api' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-api' }, ({ path }) => ({ contents: path.endsWith('/aurenToast')
      ? 'export const aurenToast = new Proxy({}, { get: () => () => {} })'
      : path.endsWith('/tradesea.api')
        ? 'export const tradeseaAPI = new Proxy({}, { get: (_, name) => async () => { globalThis.__chartViewFixture.orders.push(name); throw new Error("Unexpected broker API call: " + name) } })'
        : 'export const getAuthToken = () => globalThis.__chartViewFixture.auth; export const getApiBaseUrl = () => "/api"; export const getAuthHeaders = () => ({}); export const getWebSocketUrl = () => "ws://localhost"; export default {}' }))
  } }],
})
const { TradeseaTradeHandler } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve() }

function widget() {
  let position = null
  const events = { close: new Set(), stop: new Set(), take: new Set(), bar: new Set() }
  const calls = []
  const listen = (kind, callback) => { events[kind].add(callback); return () => events[kind].delete(callback) }
  const overlay = {
    getPosition: () => position,
    async buy({ price, qty }) { calls.push('buy'); position = { entry: price, qty, stopLoss: null, takeProfit: null } },
    async sell({ price, qty }) { calls.push('sell'); position = { entry: price, qty: -qty, stopLoss: null, takeProfit: null } },
    clear() { calls.push('clear'); position = null; for (const callback of events.close) callback() },
    async setStopLoss(price) { calls.push('stop'); if (position) position.stopLoss = price },
    async setTakeProfit(price) { calls.push('take'); if (position) position.takeProfit = price },
    clearStopLoss() {}, clearTakeProfit() {},
    setMarkPrice() { calls.push('mark') },
    setPresentation() { calls.push('presentation') },
    refreshLayout() { calls.push('layout') },
    onClose: (callback) => listen('close', callback),
    onStopLossChanged: (callback) => listen('stop', callback),
    onTakeProfitChanged: (callback) => listen('take', callback),
  }
  const chart = { symbol: () => 'NQ', resolution: () => '1' }
  return { chart: () => chart, positionOverlay: overlay, onLiveBar: (callback) => listen('bar', callback), calls, events }
}

async function fixture(t) {
  const previous = globalThis.__chartViewFixture
  const state = { auth: 'auth-A', orders: [] }
  globalThis.__chartViewFixture = state
  t.after(() => { globalThis.__chartViewFixture = previous })
  const listeners = new Set()
  const datafeed = {
    handler: null,
    setTradeHandler(handler) { this.handler = handler },
    subscribeMarketBook(callback) { listeners.add(callback); return () => listeners.delete(callback) },
    getMarketBookForStream: () => ({ last: 100 }),
    getMarketBookForChart: () => ({ last: 100 }),
    getLastBarForChart: () => ({ time: 1_800_000_000_000, close: 100 }),
    resolveStreamInstrument: (symbol) => symbol.includes(':') ? symbol : `CME:${symbol}`,
    resolveProductSymbol: (symbol) => symbol.split(':').pop(),
    getTickSize: () => 0.25,
    getTickValue: () => 0.5,
    whenSymbolsReady: () => Promise.resolve(),
  }
  const firm = {
    token: 'provider-A', selectedAccountId: 'account-A', chartSymbol: 'NQ',
    positions: [], orders: [], upl: 0,
    chartServices: { datafeed },
    setUnrealizedPl(value) { this.upl = value },
  }
  const handler = new TradeseaTradeHandler(firm)
  // Execution reads are unrelated to chart detach; never call a broker in tests.
  handler.refreshExecutionsForChart = async () => {}
  t.after(() => handler.disposeSession())
  const first = widget()
  handler.onReady(first, datafeed)
  await flush()
  firm.positions = [{ id: 'position-A', instrument: 'CME:NQ', qty: 2, side: 'buy', avgPrice: 100 }]
  const cache = handler.tradeCache
  const position = cache.setData('NQ', 100, null, 110, 2, 1_800_000_000_000)
  position.positionId = 'position-A'
  position.tradeInstrument = 'CME:NQ'
  await cache.armSoftStop('NQ', 99, '1')
  handler.syncFromStream()
  await flush()
  return { state, listeners, firm, datafeed, handler, cache, first }
}

test('warm chart detach preserves positions and soft stops, releases rendering, then reattaches', async (t) => {
  const f = await fixture(t)
  f.handler.detachChart(f.first)
  assert.equal(f.cache.getWidget(), null)
  assert.equal(f.cache.getChart().symbol(), 'NQ')
  assert.equal(f.cache.getPosition('NQ').contracts, 2)
  assert.equal(f.cache.softStops.get('CME:NQ').price, 99)
  assert.ok(Object.values(f.first.events).every((callbacks) => callbacks.size === 0))
  const detachedCalls = f.first.calls.length
  for (const callback of f.listeners) callback('CME:NQ', 'ltp')
  f.handler.syncFromStream()
  await flush()
  assert.equal(f.first.calls.length, detachedCalls, 'background snapshots must not paint the detached widget')
  assert.deepEqual(f.state.orders, [], 'detaching cannot close positions or cancel broker stops')

  const next = widget()
  f.handler.onReady(next, f.datafeed)
  await flush()
  assert.equal(f.handler.tradeCache, f.cache)
  assert.equal(f.cache.getWidget(), next)
  assert.equal(f.cache.softStops.get('CME:NQ').price, 99)
  assert.equal(next.positionOverlay.getPosition().stopLoss, 99)
  f.handler.detachChart(f.first)
  assert.equal(f.cache.getWidget(), next, 'late cleanup of an old widget must not detach its replacement')
  assert.deepEqual(f.state.orders, [])
})

test('authoritative closes reconcile the detached cache without rendering or broker writes', async (t) => {
  const f = await fixture(t)
  f.handler.detachChart(f.first)
  const detachedCalls = f.first.calls.length
  f.firm.positions = []
  f.handler.scheduleStreamSync()
  await flush()
  assert.equal(f.cache.getPosition('NQ'), undefined)
  assert.equal(f.first.calls.length, detachedCalls)
  assert.deepEqual(f.state.orders, [])
})

test('auth/account boundaries block old ticks and create an isolated stop cache', async (t) => {
  const f = await fixture(t)
  f.handler.detachChart(f.first)
  const oldTick = [...f.listeners][0]
  let marks = 0
  f.cache.onMarketPrice = () => { marks += 1 }
  f.state.auth = 'auth-B'
  f.firm.selectedAccountId = 'account-B'
  oldTick('CME:NQ', 'ltp')
  f.handler.onRealTimeBar('NQ', '1', { close: 90 })
  assert.equal(marks, 0, 'stale callbacks cannot evaluate account-A stops under account-B')
  f.firm.positions = []
  const next = widget()
  f.handler.onReady(next, f.datafeed)
  await flush()
  assert.notEqual(f.handler.tradeCache, f.cache)
  assert.equal(f.handler.tradeCache.softStops.size, 0)
  assert.equal(f.listeners.size, 1)
  f.handler.disposeSession()
  assert.equal(f.handler.tradeCache, null)
  assert.equal(f.listeners.size, 0)
  assert.equal(f.datafeed.handler, null)
  assert.deepEqual(f.state.orders, [])
})
