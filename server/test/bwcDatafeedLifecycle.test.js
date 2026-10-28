import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/chart/bwcDatafeed.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  define: { 'import.meta.env': '{}' },
})
const { createBwcDatafeed } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('warm-cache tail repair forwards freshness and reason through the chart adapter', async () => {
  let received
  const feed = createBwcDatafeed({
    getBars(_info, _resolution, period, result) {
      received = period
      result([], { noData: false })
    },
  })
  await feed.getBars({ name: 'NQ' }, '30S', {
    from: 60, to: 150, countBack: 4, refresh: true, requestReason: 'chart.resume',
  })
  assert.equal(received.refresh, true)
  assert.equal(received.requestReason, 'chart.resume')
  assert.equal(received.countBack, 4)
})

test('chart detach removes only its own listeners while preserving the shared session', () => {
  const bars = new Map()
  const quotes = new Map()
  const source = {
    historyCache: new Map([['NQ|1', 'cached candles']]),
    connection: { readyState: 1 },
    subscribeBars(_info, _resolution, callback, guid) { bars.set(guid, callback) },
    unsubscribeBars(guid) { bars.delete(guid) },
    subscribeQuotes(_info, callback, guid) { quotes.set(guid, callback) },
    unsubscribeQuotes(guid) { quotes.delete(guid) },
    teardownCandleStreams() { assert.fail('chart detach must not tear down the shared feed') },
    dispose() { assert.fail('chart detach must not dispose the account session') },
  }
  const first = createBwcDatafeed(source)
  const second = createBwcDatafeed(source)
  const info = { name: 'NQ', ticker: 'CME:NQ' }
  let firstTicks = 0
  let secondTicks = 0
  let firstQuotes = 0
  let secondQuotes = 0
  // Every BWC widget uses the same pane-local listener name.
  first.subscribeBars(info, '1', () => { firstTicks += 1 }, 'pane-0')
  second.subscribeBars(info, '1', () => { secondTicks += 1 }, 'pane-0')
  first.subscribeQuotes(info, () => { firstQuotes += 1 }, 'quote-NQ')
  second.subscribeQuotes(info, () => { secondQuotes += 1 }, 'quote-NQ')
  assert.equal(bars.size, 2)
  assert.equal(quotes.size, 2)
  const staleTick = [...bars.values()][0]
  const staleQuote = [...quotes.values()][0]
  const tick = { time: 1_800_000_000_000, open: 100, high: 101, low: 99, close: 100 }
  for (const callback of bars.values()) callback(tick)
  for (const callback of quotes.values()) callback([])
  assert.equal(firstTicks, 1)
  assert.equal(secondTicks, 1)

  first.dispose()
  first.dispose()
  assert.equal(bars.size, 1)
  assert.equal(quotes.size, 1)
  staleTick(tick)
  staleQuote([])
  assert.equal(firstTicks, 1, 'late ticks cannot update a detached chart')
  assert.equal(firstQuotes, 1, 'late quotes cannot update a detached chart')
  // A late SDK cleanup/subscribe cannot disturb the remaining chart.
  first.unsubscribeBars('pane-0')
  first.unsubscribeQuotes('quote-NQ')
  first.subscribeBars(info, '1', () => assert.fail('detached subscription'), 'pane-0')
  first.subscribeQuotes(info, () => assert.fail('detached subscription'), 'quote-NQ')
  assert.equal(bars.size, 1)
  assert.equal(quotes.size, 1)
  for (const callback of bars.values()) callback(tick)
  for (const callback of quotes.values()) callback([])
  assert.equal(secondTicks, 2)
  assert.equal(secondQuotes, 2)
  assert.equal(source.historyCache.get('NQ|1'), 'cached candles')
  assert.equal(source.connection.readyState, 1)

  second.unsubscribeBars('pane-0')
  second.unsubscribeQuotes('quote-NQ')
  second.dispose()
  assert.equal(bars.size, 0)
  assert.equal(quotes.size, 0)
})
