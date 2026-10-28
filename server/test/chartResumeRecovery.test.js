import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/chart/chartResumeRecovery.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { createChartResumeRecovery } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

function fixture(t, { recover, capture = () => ({ lastTime: Date.now() / 1000 }) } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 })
  const pageDocument = new EventTarget()
  pageDocument.visibilityState = 'visible'
  const pageWindow = new EventTarget()
  const handlers = new Map()
  const calls = { clear: 0, refresh: 0, resets: [], recoveries: [], captures: [], resend: 0, errors: [] }
  const connection = {
    state: 'connected',
    getConnectionState() { return this.state },
    on(event, callback) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event).add(callback)
      return () => handlers.get(event).delete(callback)
    },
    emit(event, payload) { for (const callback of handlers.get(event) || []) callback(payload) },
    change(state) { this.state = state; this.emit('connection', state) },
    resendAllSubscriptions() { calls.resend += 1; this.emit('resubscribed') },
  }
  let widget = {
    captureResumeState() { const state = capture(); calls.captures.push(state); return state },
    async recover(options) { calls.recoveries.push(options); await recover?.(options) },
    async reset(options) { calls.resets.push(options) },
  }
  const recovery = createChartResumeRecovery({
    connection,
    datafeed: {
      clearHistoryCache() { calls.clear += 1 },
      refreshMdsSubscriptions() { calls.refresh += 1 },
    },
    getWidget: () => widget,
    pageDocument, pageWindow,
    onError: (error) => calls.errors.push(error),
  })
  t.after(() => recovery.dispose())
  const event = (name, target = pageWindow, persisted = false) => {
    const value = new Event(name)
    if (name === 'pageshow') Object.defineProperty(value, 'persisted', { value: persisted })
    target.dispatchEvent(value)
  }
  const hide = () => { pageDocument.visibilityState = 'hidden'; event('visibilitychange', pageDocument) }
  const show = () => { pageDocument.visibilityState = 'visible'; event('visibilitychange', pageDocument) }
  const advance = async (milliseconds) => {
    t.mock.timers.tick(milliseconds)
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
  }
  return { calls, recovery, connection, event, hide, show, advance, pageDocument, replaceWidget(value) { widget = value } }
}

test('ten-minute Safari suspension refills history even when fresh ticks keep the socket open', async (t) => {
  const f = fixture(t)
  f.hide()
  await f.advance(10 * 60_000)
  // No close/connection event occurs: the resumed socket already delivers ticks.
  f.show()
  f.event('pageshow')
  f.event('focus')
  await f.advance(299)
  assert.equal(f.calls.recoveries.length, 0)
  await f.advance(1)
  assert.equal(f.calls.recoveries.length, 1)
  assert.equal(f.calls.recoveries[0].since, f.calls.captures[0])
  assert.equal(f.calls.recoveries[0].since.lastTime, 1_800_000_000)
  assert.equal(f.calls.recoveries[0].shouldContinue(), true)
  assert.equal(f.calls.resets.length, 0, 'background recovery must never reset loaded history')
  assert.equal(f.calls.clear, 0, 'completed old history stays cached')
  assert.equal(f.calls.refresh, 1)
  assert.equal(f.calls.resend, 1)
  await f.advance(2_000)
  assert.equal(f.calls.recoveries.length, 1, 'the recovery resubscribe must not cause a recovery loop')
})

test('a retained Dashboard visit repairs only on return and preserves its original widget checkpoint', async (t) => {
  const f = fixture(t)
  f.recovery.setViewActive(false)
  const checkpoint = f.calls.captures[0]
  await f.advance(95_000)
  f.event('focus')
  f.connection.emit('resubscribed')
  await f.advance(1_000)
  assert.equal(f.calls.recoveries.length, 0, 'hidden retained Trade cannot run foreground repairs')
  f.recovery.setViewActive(true)
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
  assert.equal(f.calls.recoveries[0].since, checkpoint)
  assert.equal(f.calls.resets.length, 0)
  assert.equal(f.calls.clear, 0)
})

test('rapid Dashboard round trips keep the warm widget without unnecessary history repairs', async (t) => {
  const f = fixture(t)
  f.recovery.setViewActive(false)
  await f.advance(10_000)
  f.recovery.setViewActive(true)
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 0)
  f.recovery.setViewActive(false)
  await f.advance(35_000)
  f.recovery.setViewActive(true)
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
  assert.equal(f.calls.recoveries[0].since, f.calls.captures[1])
})

test('pagehide and BFCache pageshow recover when Safari omits visibilitychange', async (t) => {
  const f = fixture(t)
  f.event('pagehide')
  await f.advance(10 * 60_000)
  f.event('pageshow', undefined, true)
  f.event('focus')
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
})

test('persisted pageshow alone refills history without requiring a prior hidden event', async (t) => {
  const f = fixture(t)
  f.event('pageshow', undefined, true)
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
})

test('BFCache history recovery survives pageshow firing before visibility becomes visible', async (t) => {
  const f = fixture(t)
  // Safari can dispatch restored-page events before reporting the new visible
  // state, with no matching visibilitychange delivered to this document.
  f.pageDocument.visibilityState = 'hidden'
  f.event('pageshow', undefined, true)
  f.pageDocument.visibilityState = 'visible'
  f.event('focus')
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
})

test('resume and resubscription wait for recovery and coalesce into one gap repair', async (t) => {
  const f = fixture(t)
  f.hide()
  await f.advance(10 * 60_000)
  f.show()
  f.connection.change('connecting')
  f.connection.emit('close', { code: 1006, reason: 'background socket' })
  await f.advance(1_000)
  assert.equal(f.calls.recoveries.length, 0)
  f.connection.change('connected')
  f.connection.emit('resubscribed')
  f.event('focus')
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
  await f.advance(2_000)
  assert.equal(f.calls.recoveries.length, 1)
})

test('a second outage during history refill receives its own refill after reconnect', async (t) => {
  let finishRepair
  let pending = new Promise((resolve) => { finishRepair = resolve })
  const f = fixture(t, { recover: () => pending })
  f.connection.change('disconnected')
  f.connection.change('connected')
  f.connection.emit('resubscribed')
  await f.advance(200)
  assert.equal(f.calls.recoveries.length, 1)
  f.connection.change('connecting')
  f.connection.change('connected')
  f.connection.emit('resubscribed')
  await f.advance(200)
  assert.equal(f.calls.recoveries.length, 1, 'history refills cannot overlap')
  finishRepair()
  pending = Promise.resolve()
  await f.advance(0)
  await f.advance(200)
  assert.equal(f.calls.recoveries.length, 2)
  await f.advance(2_000)
  assert.equal(f.calls.recoveries.length, 2)
})

test('short tab switches need no refill and chart detach cancels pending recovery', async (t) => {
  const f = fixture(t)
  f.event('pageshow')
  f.hide()
  await f.advance(500)
  f.show()
  f.event('focus')
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 0)
  f.hide()
  await f.advance(10 * 60_000)
  f.show()
  f.recovery.dispose()
  await f.advance(1_000)
  f.connection.change('connecting')
  f.connection.change('connected')
  f.event('pageshow', undefined, true)
  await f.advance(1_000)
  assert.equal(f.calls.recoveries.length, 0)
})

test('resumed ticks and a second outage cannot advance the original missing-history checkpoint', async (t) => {
  let latest = 100
  const f = fixture(t, { capture: () => ({ lastTime: latest }) })
  f.hide()
  latest = 700 // The first resumed quote already jumps across the lost interval.
  await f.advance(600_000)
  f.connection.change('connecting')
  f.show()
  f.connection.change('connected')
  await f.advance(300)
  assert.equal(f.calls.captures.length, 1)
  assert.equal(f.calls.recoveries[0].since.lastTime, 100)
  assert.equal(f.calls.resets.length, 0)
  assert.equal(f.calls.clear, 0)
})

test('failed gap repairs retry the original checkpoint with backoff and stop after detach', async (t) => {
  let attempts = 0
  const f = fixture(t, { recover: () => {
    if (++attempts <= 2) throw new Error('history unavailable')
  } })
  f.hide()
  await f.advance(600_000)
  f.show()
  await f.advance(300)
  assert.equal(f.calls.recoveries.length, 1)
  await f.advance(999)
  assert.equal(f.calls.recoveries.length, 1)
  await f.advance(1)
  assert.equal(f.calls.recoveries.length, 2)
  await f.advance(1_999)
  assert.equal(f.calls.recoveries.length, 2)
  await f.advance(1)
  assert.equal(f.calls.recoveries.length, 3)
  assert.ok(f.calls.recoveries.every((call) => call.since === f.calls.captures[0]))
  assert.equal(f.calls.resend, 1, 'only a completed repair announces recovery')
  assert.equal(f.calls.errors.length, 2)
  f.recovery.dispose()
  assert.equal(f.calls.recoveries[2].shouldContinue(), false)
  await f.advance(60_000)
  assert.equal(f.calls.recoveries.length, 3)
})

test('an old widget checkpoint is never applied to a replacement chart', async (t) => {
  const f = fixture(t)
  f.hide()
  await f.advance(600_000)
  const replacements = []
  f.replaceWidget({ async recover(options) { replacements.push(options) } })
  f.show()
  await f.advance(300)
  assert.equal(replacements.length, 1)
  assert.equal(replacements[0].since, undefined)
  assert.equal(f.calls.recoveries.length, 0)
})

test('a chart that finishes booting in the background captures its first loaded tail', async (t) => {
  const f = fixture(t)
  f.replaceWidget(null)
  f.hide()
  const checkpoint = { lastTime: 123 }
  const recovered = []
  f.replaceWidget({
    captureResumeState: () => checkpoint,
    async recover(options) { recovered.push(options) },
  })
  await f.recovery.reloadPending()
  await f.advance(600_000)
  f.show()
  await f.advance(300)
  assert.equal(recovered[0].since, checkpoint)
})
