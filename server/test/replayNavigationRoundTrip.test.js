import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/backtester/services/BacktesterTradeHandler.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'browser', write: false,
  define: { 'import.meta.env': '{}' },
})
const { BacktesterTradeHandler } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  .catch(error => { throw new Error(error.message) })

function fixture() {
  let cursor = 1_800_000_000
  const messages = []
  const client = { isConnected: () => true, send: message => messages.push(message) }
  const handler = new BacktesterTradeHandler(null, client)
  handler.datafeed = {
    getPlaybackAnchorSecPublic: () => cursor,
    setPlaybackAnchorSec: next => { cursor = next },
  }
  handler.resolvePlaybackStepResolution = () => '15'
  handler.resolvePlaybackStepSec = () => 900
  handler.resolveChartSymbol = () => 'NQ'
  handler.getBwcWidget = () => ({ getBars: () => [] })
  handler.scheduleSyncAllPanesReplayCursor = () => {}
  handler.logPlaybackAction = () => {}
  return { handler, messages, cursor: () => cursor }
}

test('NQ realtime frame does not allow Previous before ES and step acknowledgement', async (t) => {
  const { handler, messages } = fixture()
  t.after(() => clearTimeout(handler.nextCandleTimeout))
  handler.handleNextCandle()
  const requested = messages[0].targetSec
  handler.syncReplayCursorFromBar(requested, '15')
  let rewinds = 0
  handler.reloadChartAfterSessionAnchor = async () => { rewinds++ }
  await handler.handlePreviousCandle()
  assert.equal(rewinds, 0, 'first symbol reply cannot release navigation')
  handler.handleNextCandleAck({ cursorSec: requested, emitted: 2 })
  await handler.handlePreviousCandle()
  assert.equal(rewinds, 1, 'rewind is allowed after the final ack')
})

test('Previous rebuilds candle data at its source resolution and serializes rapid navigation', async () => {
  const { handler, messages } = fixture()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const loads = []
  handler.reloadChartAfterSessionAnchor = async options => { loads.push(options); await gate }
  const first = handler.handlePreviousCandle()
  const target = handler.datafeed.getPlaybackAnchorSecPublic()
  assert.equal(loads.length, 1)
  assert.equal(loads[0].playbackAnchorResolution, '15')
  assert.equal(loads[0].playbackAnchorSec, target)
  assert.equal(loads[0].clearPlaybackAnchor, false)
  assert.equal(loads[0].preserveTimeRange, true, 'rewind keeps the current time window rather than following the cursor')
  await handler.handlePreviousCandle()
  handler.handleNextCandle()
  assert.equal(loads.length, 1)
  assert.deepEqual(messages.map(message => message.type), ['syncReplayCursor'])
  release()
  await first
  assert.equal(handler.previousCandleInFlight, false)
})
