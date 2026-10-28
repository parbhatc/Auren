import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { resolveBwcRoot } from '../../scripts/resolve-bwc-root.mjs'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/chart/chartResumeRecovery.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { createChartResumeRecovery } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const routeCaches = await build({
  stdin: {
    contents: `
      export { createLiveTradeSessionCache } from './src/services/trading/liveTradeSession.ts';
      export { createLiveTradeViewRetention } from './src/services/trading/liveTradeViewRetention.ts';
    `,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { createLiveTradeSessionCache, createLiveTradeViewRetention } = await import(
  `data:text/javascript;base64,${Buffer.from(routeCaches.outputFiles[0].text).toString('base64')}`,
)
// Resolve the same configured sibling/package used to serve the chart, so the
// test exercises the actual BWC recovery implementation without a fixed path.
const { createLiveHistoryRecovery } = await import(pathToFileURL(path.join(
  resolveBwcRoot(), 'public/js/app/bar/liveRecovery.js',
)).href)

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

const flush = async () => { for (let i = 0; i < 32; i += 1) await Promise.resolve() }

test('Auren foreground recovery fills only the real BWC ten-minute gap while preserving 3600 loaded candles', async (t) => {
  const start = 1_800_000_000
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: start * 1000 })
  const original = Array.from({ length: 3600 }, (_, index) => ({
    time: start - (3599 - index) * 30,
    open: 100, high: 102, low: 99, close: 101,
  }))
  const initialRange = { from: original[0].time + 300, to: original[0].time + 3300 }
  let visibleRange = { ...initialRange }
  const pane = {
    index: 0, symbol: 'NQ', resolution: '30S', bars: original.slice(),
    symbolInfo: { name: 'NQ', ticker: 'NQ', data_status: 'streaming' },
    _barSeriesIdentity: { symbol: 'NQ', resolution: '30S' },
    _historyGeneration: 3,
    chart: { timeScale: () => ({
      getVisibleRange: () => ({ ...visibleRange }),
      setVisibleRange: (range) => { visibleRange = { ...range } },
    }) },
  }
  const pendingHistory = deferred()
  const requests = []
  const calls = { clear: 0, refresh: 0, reset: 0, resend: 0, captures: [], recoveries: [], errors: [], reports: [] }
  const realHistory = createLiveHistoryRecovery({
    getAllChartPanes: () => [pane],
    getBarSecForPane: () => 30,
    datafeed: { async getBars(symbolInfo, resolution, params) {
      requests.push({ symbolInfo, resolution, ...params })
      await pendingHistory.promise
      return { bars: Array.from({ length: params.countBack }, (_, index) => ({
        time: params.from + index * 30,
        open: 200, high: 204, low: 199, close: 202,
      })) }
    } },
    refreshPaneCandleData: () => { visibleRange = { from: 0, to: 1 } },
  })
  const widget = {
    captureResumeState() {
      const state = realHistory.captureResumeState()
      calls.captures.push(state)
      return state
    },
    async recover(options) {
      calls.recoveries.push(options)
      const report = await realHistory.recoverLiveHistory(options)
      calls.reports.push(report)
      return report
    },
    reset() { calls.reset += 1; throw new Error('Full chart reset must not be used') },
  }
  const handlers = new Map()
  const connection = {
    getConnectionState: () => 'connected',
    on(type, listener) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type).add(listener)
      return () => handlers.get(type).delete(listener)
    },
    resendAllSubscriptions() {
      calls.resend += 1
      for (const listener of handlers.get('resubscribed') || []) listener()
    },
  }
  const pageDocument = new EventTarget()
  pageDocument.visibilityState = 'visible'
  const pageWindow = new EventTarget()
  const controller = createChartResumeRecovery({
    connection, getWidget: () => widget, pageDocument, pageWindow,
    datafeed: {
      clearHistoryCache: () => { calls.clear += 1 },
      refreshMdsSubscriptions: () => { calls.refresh += 1 },
    },
    onError: (error) => calls.errors.push(error),
  })
  t.after(() => controller.dispose())

  pageDocument.visibilityState = 'hidden'
  pageDocument.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls.captures[0].panes[0].lastTime, start)
  t.mock.timers.tick(10 * 60_000)
  await flush()
  assert.equal(requests.length, 0, 'hidden pages do not download history')

  // The first resumed tick jumps over the gap before focus handlers run. An
  // implementation that captures its checkpoint now would miss all 19 bars.
  pane.bars.push({ time: start + 600, open: 300, high: 305, low: 299, close: 301 })
  pageDocument.visibilityState = 'visible'
  pageDocument.dispatchEvent(new Event('visibilitychange'))
  pageWindow.dispatchEvent(new Event('pageshow'))
  pageWindow.dispatchEvent(new Event('focus'))
  t.mock.timers.tick(300)
  await flush()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].refresh, true)
  assert.equal(requests[0].requestReason, 'chart.resume-gap')
  assert.equal(requests[0].resolution, '30S')
  assert.equal(requests[0].from, start - 30, 'the former confirmed/forming pair stays in the recovery range')
  assert.equal(requests[0].to, start + 600)
  assert.equal(requests[0].countBack, 22, 'only the ten-minute gap and two overlap bars are requested')
  assert.equal(calls.recoveries[0].since, calls.captures[0])

  const newerLive = { time: start + 600, open: 300, high: 310, low: 299, close: 309 }
  pane.bars[pane.bars.length - 1] = newerLive
  pendingHistory.resolve()
  await flush()
  assert.deepEqual(calls.errors, [])
  assert.equal(pane.bars.length, 3620)
  assert.equal(pane.bars[0], original[0], 'the complete existing history head remains loaded')
  for (let index = 0; index < original.length - 2; index += 1) assert.equal(pane.bars[index], original[index])
  for (let index = 1; index < pane.bars.length; index += 1) {
    assert.equal(pane.bars[index].time - pane.bars[index - 1].time, 30, 'recovered candles have no gap')
  }
  assert.equal(pane.bars.find((bar) => bar.time === start).close, 202, 'the previously forming candle is finalized')
  assert.equal(pane.bars.at(-1), newerLive, 'ticks received during recovery retain their newer values')
  assert.deepEqual(visibleRange, initialRange)
  assert.equal(calls.reports[0].panes[0].requests, 1)
  assert.equal(calls.reports[0].panes[0].repairedBars, 22)
  assert.equal(calls.reset, 0)
  assert.equal(calls.clear, 0)
  assert.equal(calls.refresh, 1)
  assert.equal(calls.resend, 1)
  t.mock.timers.tick(2000)
  await flush()
  assert.equal(calls.recoveries.length, 1, 'recovery resubscription does not start a reset/refetch loop')
  assert.equal(requests.length, 1)
})

for (const minutes of [5, 10]) {
  test(`a ${minutes}-minute Dashboard visit retains the actual Trade session and repairs only the real BWC candle gap`, async (t) => {
    const start = 1_800_000_000
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: start * 1000 })
    const identity = { token: 'auth-a', firmId: 'tradesea', accountId: 'account-a', mode: 'live' }
    const views = createLiveTradeViewRetention()
    const sessions = createLiveTradeSessionCache()
    const calls = { loads: 0, cleanups: 0, reset: 0, clear: 0, refresh: 0, resend: 0, recover: 0 }
    let ready = false
    const sessionOptions = {
      owner: { cleanup() { calls.cleanups += 1; ready = false } },
      getIdentity: () => identity,
      isReusable: () => ready,
      async load() { calls.loads += 1; ready = true },
    }
    const original = Array.from({ length: 3600 }, (_, index) => ({
      time: start - (3599 - index) * 30,
      open: 100, high: 102, low: 99, close: 101,
    }))
    const initialRange = { from: original[0].time + 300, to: original[0].time + 3300 }
    let visibleRange = { ...initialRange }
    const pane = {
      index: 0, symbol: 'NQ', resolution: '30S', bars: original.slice(),
      symbolInfo: { name: 'NQ', ticker: 'NQ', data_status: 'streaming' },
      _barSeriesIdentity: { symbol: 'NQ', resolution: '30S' },
      _historyGeneration: 3,
      chart: { timeScale: () => ({
        getVisibleRange: () => ({ ...visibleRange }),
        setVisibleRange: (range) => { visibleRange = { ...range } },
      }) },
    }
    const requests = []
    const reports = []
    const realHistory = createLiveHistoryRecovery({
      getAllChartPanes: () => [pane], getBarSecForPane: () => 30,
      datafeed: { async getBars(symbolInfo, resolution, params) {
        requests.push({ symbolInfo, resolution, ...params })
        return { bars: Array.from({ length: params.countBack }, (_, index) => ({
          time: params.from + index * 30,
          open: 200, high: 204, low: 199, close: 202,
        })) }
      } },
      refreshPaneCandleData: () => { visibleRange = { from: 0, to: 1 } },
    })
    const widget = {
      captureResumeState: realHistory.captureResumeState,
      async recover(options) {
        calls.recover += 1
        const report = await realHistory.recoverLiveHistory(options)
        reports.push(report)
        return report
      },
      reset() { calls.reset += 1; throw new Error('A route return must not reset loaded chart history') },
    }
    const handlers = new Map()
    const connection = {
      getConnectionState: () => 'connected',
      on(type, listener) {
        if (!handlers.has(type)) handlers.set(type, new Set())
        handlers.get(type).add(listener)
        return () => handlers.get(type).delete(listener)
      },
      resendAllSubscriptions() {
        calls.resend += 1
        for (const listener of handlers.get('resubscribed') || []) listener()
      },
    }
    const pageDocument = new EventTarget()
    pageDocument.visibilityState = 'visible'
    const pageWindow = new EventTarget()
    const errors = []
    const controller = createChartResumeRecovery({
      connection, getWidget: () => widget, pageDocument, pageWindow,
      datafeed: {
        clearHistoryCache: () => { calls.clear += 1 },
        refreshMdsSubscriptions: () => { calls.refresh += 1 },
      },
      onError: (error) => errors.push(error),
    })
    t.after(() => { controller.dispose(); views.dispose(); sessions.invalidate() })

    views.update({ active: true, eligible: true, identity })
    const originalKey = views.snapshot().key
    const first = sessions.acquire(sessionOptions)
    await first.ready
    // Dashboard keeps this document visible. Route activity, rather than a
    // browser visibility event, must preserve the pre-gap widget checkpoint.
    views.update({ active: false, eligible: true, identity })
    controller.setViewActive(false)
    first.release()
    t.mock.timers.tick(minutes * 60_000)
    pageWindow.dispatchEvent(new Event('focus'))
    await flush()
    assert.equal(requests.length, 0, 'the retained inactive chart cannot download hidden history')
    assert.equal(calls.cleanups, 0, 'the default session deadline includes an exact ten-minute return')
    assert.equal(views.snapshot()?.key, originalKey, 'the actual retained widget must still exist')

    const gapSeconds = minutes * 60
    const resumedTick = { time: start + gapSeconds, open: 300, high: 310, low: 299, close: 309 }
    pane.bars.push(resumedTick)
    views.update({ active: true, eligible: true, identity })
    const returned = sessions.acquire(sessionOptions)
    await returned.ready
    controller.setViewActive(true)
    t.mock.timers.tick(300)
    await flush()

    assert.equal(views.snapshot().key, originalKey)
    assert.equal(calls.loads, 1, 'route reentry reuses the validated session')
    assert.equal(calls.cleanups, 0)
    assert.equal(requests.length, 1, 'route reentry issues one tail request, not an initial history loop')
    assert.equal(requests[0].resolution, '30S')
    assert.equal(requests[0].refresh, true)
    assert.equal(requests[0].requestReason, 'chart.resume-gap')
    assert.equal(requests[0].from, start - 30)
    assert.equal(requests[0].to, start + gapSeconds)
    assert.equal(requests[0].countBack, gapSeconds / 30 + 2, 'only the missing tail and two overlap candles download')
    assert.deepEqual(errors, [])
    assert.equal(pane.bars.length, 3600 + gapSeconds / 30)
    assert.equal(pane.bars[0], original[0], 'all 3600 original timestamps and the history head remain loaded')
    for (let index = 0; index < original.length - 2; index += 1) assert.equal(pane.bars[index], original[index])
    for (let index = 1; index < pane.bars.length; index += 1) {
      assert.equal(pane.bars[index].time - pane.bars[index - 1].time, 30, 'returned candles have no missing interval')
    }
    assert.equal(pane.bars.at(-1), resumedTick, 'the first returned quote remains newer than history')
    assert.deepEqual(visibleRange, initialRange)
    assert.equal(reports[0].panes[0].repairedBars, gapSeconds / 30 + 2)
    assert.equal(calls.reset, 0)
    assert.equal(calls.clear, 0)
    assert.equal(calls.refresh, 1)
    assert.equal(calls.resend, 1)
    t.mock.timers.tick(2000)
    await flush()
    assert.equal(calls.recover, 1)
    assert.equal(requests.length, 1, 'recovery does not restart a repeated history download')
    returned.release()
  })
}
