import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const handlerCode = compile('../../src/services/practice/PracticeTradeHandler.ts')
const panCode = compile('../../src/utils/bwcPan.ts')
const pnlCode = compile('../../src/services/tradesea/tradeseaPnL.ts')
const tradeCacheCode = compile('../../src/components/common/ChartTradeCache.tsx')
const datafeedCode = compile('../../src/services/tradesea/TradeseaDatafeed.ts')
const marketBookCode = compile('../../src/services/tradesea/tradeseaMarketBook.ts')

function fixture({ panning = true, now = 1000 } = {}) {
  const state = { panning, now, waiterRegistrations: 0, markReads: 0, riskChecks: 0, disposed: 0 }
  const frames = new Map()
  const timers = new Map()
  const published = []
  const marks = new Map([['MNQ', 100], ['MES', 200]])
  const positions = new Map([
    ['MNQ', { symbol: 'MNQ', entry: 100, contracts: 2, id: 'long' }],
    ['MES', { symbol: 'MES', entry: 200, contracts: -1, id: 'short' }],
  ])
  let id = 0
  const context = vm.createContext({
    console,
    window: { __BWC_WIDGET__: { isChartPanning: () => state.panning } },
    performance: { now: () => state.now },
    requestAnimationFrame(callback) { const key = ++id; frames.set(key, callback); return key },
    cancelAnimationFrame(key) { frames.delete(key) },
    setTimeout(callback, delay) { const key = ++id; timers.set(key, { callback, at: state.now + delay }); return key },
    clearTimeout(key) { timers.delete(key) },
  })
  function load(code, require) {
    const module = { exports: {} }
    const evaluate = vm.runInContext(`(function(require, module, exports) { ${code}\n})`, context)
    evaluate(require, module, module.exports)
    return module.exports
  }
  const unexpectedDependency = (specifier) => new Proxy({}, {
    get(_target, name) {
      return () => { throw new Error(`Unexpected ${specifier}.${String(name)} in P&L queue test`) }
    },
  })
  // Use the real shared pan queue, not a fake wait-until-release implementation.
  // Count its registrations separately from its single polling animation frame.
  const pan = load(panCode, unexpectedDependency)
  const dependencies = {
    '../../utils/bwcPan': {
      ...pan,
      whenBwcPanEnds(callback) {
        state.waiterRegistrations++
        pan.whenBwcPanEnds(callback)
      },
    },
    '../tradesea/tradeseaPnL': load(pnlCode, unexpectedDependency),
  }
  const { PracticeTradeHandler } = load(handlerCode, (specifier) => dependencies[specifier] ?? unexpectedDependency(specifier))
  const firm = {
    chartServices: { datafeed: { getTickSize: () => 0.25, getTickValue: () => 0.5 } },
    setUnrealizedPl(value) { published.push(value) },
  }
  const handler = new PracticeTradeHandler(firm, 'practice-account')
  handler.tradeCache = {
    hasAnyOpenPosition: () => positions.size > 0,
    getCache: () => positions,
    dispose() { state.disposed++ },
  }
  handler.getMarkPriceForPositionKey = (symbol) => {
    state.markReads++
    return marks.get(symbol)
  }
  // Observe the existing risk checks, without invoking any account mutation or
  // network boundary. Actual P&L aggregation and tick mathematics remain real.
  handler.checkBlownWhileTrading = () => state.riskChecks++
  handler.checkPassedWhileTrading = () => state.riskChecks++
  function frame() {
    const batch = [...frames.values()]
    frames.clear()
    for (const callback of batch) callback(state.now)
  }
  function advance(ms) {
    state.now += ms
    const due = [...timers].filter(([, timer]) => timer.at <= state.now)
    for (const [key, timer] of due) {
      timers.delete(key)
      timer.callback()
    }
  }
  const loadProduction = (code, extraDependencies = {}) => load(code, (specifier) =>
    extraDependencies[specifier] ?? dependencies[specifier] ?? unexpectedDependency(specifier)
  )
  return { handler, state, marks, published, frames, timers, frame, advance, loadProduction }
}

test('thousands of quote P&L signals hold one pan waiter and calculate the latest account marks after release', () => {
  const f = fixture()
  for (let tick = 0; tick < 5000; tick++) {
    f.marks.set('MNQ', 100 + tick / 4)
    f.handler.scheduleRefreshUnrealizedPl()
  }
  f.marks.set('MNQ', 102)
  f.marks.set('MES', 201)
  assert.equal(f.state.waiterRegistrations, 1)
  assert.equal(f.frames.size, 1, 'only the shared pan-end polling frame is scheduled')
  assert.equal(f.timers.size, 0)
  assert.equal(f.state.markReads, 0, 'account P&L calculation waits for release')
  assert.deepEqual(f.published, [])
  for (let heldFrame = 0; heldFrame < 10; heldFrame++) f.frame()
  assert.equal(f.frames.size, 1)
  assert.equal(f.state.waiterRegistrations, 1)

  f.state.panning = false
  f.frame()
  assert.deepEqual(f.published, [6], 'latest long +$8 and short -$2 marks produce account +$6')
  assert.equal(f.state.markReads, 2)
  assert.equal(f.state.riskChecks, 2, 'the final refresh preserves both existing risk checks')
  assert.equal(f.frames.size, 0)
});

test('direct account refreshes and scheduled quote refreshes share the same held-pan work', () => {
  const f = fixture()
  for (let tick = 0; tick < 3000; tick++) {
    f.handler.refreshUnrealizedPl()
    f.handler.updateUnrealizedFromMark(tick)
  }
  assert.equal(f.state.waiterRegistrations, 1)
  f.marks.set('MNQ', 103)
  f.marks.set('MES', 202)
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.published, [8])
  assert.equal(f.state.markReads, 2)
});

test('a quote frame overtaken by a pan joins the same latest-state waiter', () => {
  const f = fixture({ panning: false })
  f.handler.scheduleRefreshUnrealizedPl()
  assert.equal(f.frames.size, 1)
  f.state.panning = true
  f.frame()
  for (let tick = 0; tick < 5000; tick++) f.handler.scheduleRefreshUnrealizedPl()
  assert.equal(f.state.waiterRegistrations, 1)
  assert.equal(f.frames.size, 1)
  f.marks.set('MNQ', 101)
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.published, [4])
  assert.equal(f.state.markReads, 2)
});

test('disposing a handler cancels its queued post-pan account refresh', () => {
  const f = fixture()
  f.handler.scheduleRefreshUnrealizedPl()
  f.handler.dispose()
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.published, [])
  assert.equal(f.state.markReads, 0)
  assert.equal(f.state.disposed, 1)
  assert.equal(f.frames.size, 0)
});

test('normal quote bursts retain the existing 120ms rate limit and latest-mark behavior', () => {
  const f = fixture({ panning: false })
  f.marks.set('MNQ', 101)
  f.handler.scheduleRefreshUnrealizedPl()
  f.frame()
  assert.deepEqual(f.published, [4])
  for (let tick = 0; tick < 2000; tick++) f.handler.scheduleRefreshUnrealizedPl()
  assert.equal(f.timers.size, 1)
  assert.equal(f.frames.size, 0)
  f.marks.set('MNQ', 102)
  f.advance(119)
  assert.equal(f.frames.size, 0)
  f.advance(1)
  assert.equal(f.frames.size, 1)
  f.frame()
  assert.deepEqual(f.published, [4, 8])
  assert.equal(f.state.waiterRegistrations, 0)
  assert.equal(f.timers.size, 0)
});

function cacheFixture() {
  const f = fixture()
  const { default: ChartTradeCache } = f.loadProduction(tradeCacheCode)
  const cache = new ChartTradeCache({}, { symbol: () => 'CME:NQ', resolution: () => '30S' })
  const delivered = []
  cache.runRealTimeBar = (...args) => delivered.push(args)
  return { ...f, cache, delivered }
}

test('trade-cache pan deferral retains the exact last bar and metadata with one waiter', () => {
  const f = cacheFixture()
  const last = { close: 5000, low: 4999, high: 5001, time: 5000 }
  for (let tick = 0; tick < 5000; tick++) {
    f.cache.onRealTimeBar('NQ', { close: tick, time: tick }, 0.25, 5)
  }
  f.cache.onRealTimeBar('ES', last, 0.5, 12.5)
  assert.equal(f.state.waiterRegistrations, 1)
  assert.equal(f.frames.size, 1)
  assert.equal(f.delivered.length, 0)
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.delivered, [['ES', last, 0.5, 12.5]])
  assert.equal(f.delivered[0][1], last, 'preserve the existing payload, without changing candle extrema')
  // Outside a pan this boundary still delivers every call; only the existing
  // held-pan latest-payload slot is coalesced.
  f.cache.onRealTimeBar('NQ', { close: 1 }, 0.25, 5)
  f.cache.onRealTimeBar('NQ', { close: 2 }, 0.25, 5)
  assert.equal(f.delivered.length, 3)
});

test('detaching the trade-cache chart invalidates its pending pan callback', () => {
  const f = cacheFixture()
  f.cache.onRealTimeBar('NQ', { close: 100 }, 0.25, 5)
  f.cache.detachChartView()
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.delivered, [])
  assert.equal(f.frames.size, 0)
});

function datafeedFixture({ panning = true } = {}) {
  const f = fixture({ panning })
  const listeners = new Set()
  const { TradeseaDatafeed } = f.loadProduction(datafeedCode, {
    './tradeseaMarketBook': f.loadProduction(marketBookCode),
    './tradeseaDebug': { debugTradeseaUpl() {} },
  })
  const feed = new TradeseaDatafeed({
    mds: { on() { const listener = {}; listeners.add(listener); return () => listeners.delete(listener) } },
    accountId: 'account', userId: 'user', connectionGroupId: 'connection',
  })
  const delivered = []
  feed.setTradeHandler({ onRealTimeBar: (...args) => delivered.push(args) })
  return { ...f, feed, delivered, listeners }
}

test('datafeed pan deferral registers once and forwards its unchanged latest symbol, interval and bar', () => {
  const f = datafeedFixture()
  const last = { close: 5001, open: 4990, high: 5002, low: 4980, time: 5001 }
  for (let tick = 0; tick < 5000; tick++) {
    f.feed.scheduleTradeHandlerBar('NQ', '1', { close: tick, time: tick })
  }
  f.feed.scheduleTradeHandlerBar('ES', '30S', last)
  assert.equal(f.state.waiterRegistrations, 1)
  assert.equal(f.frames.size, 1)
  assert.deepEqual(f.delivered, [])
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.delivered, [['ES', '30S', last]])
  assert.equal(f.delivered[0][2], last)
});

test('a datafeed animation frame overtaken by a pan shares its one latest-payload callback', () => {
  const f = datafeedFixture({ panning: false })
  f.feed.scheduleTradeHandlerBar('NQ', '1', { close: 1 })
  f.state.panning = true
  f.frame()
  for (let tick = 0; tick < 5000; tick++) f.feed.scheduleTradeHandlerBar('ES', '30S', { close: tick })
  assert.equal(f.state.waiterRegistrations, 1)
  assert.equal(f.frames.size, 1)
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.delivered, [['ES', '30S', { close: 4999 }]])
});

for (const cleanup of ['dispose', 'teardownCandleStreams']) {
  test(`datafeed ${cleanup} cancels a held-pan callback even without an active animation frame`, () => {
    const f = datafeedFixture()
    f.feed.scheduleTradeHandlerBar('NQ', '30S', { close: 100 })
    f.feed[cleanup]()
    f.state.panning = false
    f.frame()
    assert.deepEqual(f.delivered, [])
    assert.equal(f.frames.size, 0)
    if (cleanup === 'dispose') assert.equal(f.listeners.size, 0)
  })
}

test('changing datafeed handler cannot deliver a previous owner\'s queued candle to its replacement', () => {
  const f = datafeedFixture()
  f.feed.scheduleTradeHandlerBar('NQ', '1', { close: 100 })
  const replacement = []
  f.feed.setTradeHandler({ onRealTimeBar: (...args) => replacement.push(args) })
  f.state.panning = false
  f.frame()
  assert.deepEqual(f.delivered, [])
  assert.deepEqual(replacement, [])
  f.feed.scheduleTradeHandlerBar('ES', '30S', { close: 200 })
  f.frame()
  assert.deepEqual(replacement, [['ES', '30S', { close: 200 }]])
});
