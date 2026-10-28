import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveTradeSessionCache, LIVE_TRADE_IDLE_MS, LIVE_TRADE_WARM_MS } from '../../src/services/trading/liveTradeSession.ts'

function fixture(t, load) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 })
  const cache = createLiveTradeSessionCache()
  let identity = { token: 'auth-a', firmId: 'tradesea', accountId: 'account-a', mode: 'live' }
  let ready = false
  let loads = 0
  let cleanups = 0
  const owner = { cleanup() { cleanups += 1; ready = false } }
  const options = {
    owner,
    getIdentity: () => identity,
    isReusable: () => ready,
    load: async (assertCurrent) => { loads += 1; await load?.(assertCurrent); ready = true },
  }
  t.after(() => cache.invalidate())
  return {
    cache, options,
    get loads() { return loads }, get cleanups() { return cleanups },
    setIdentity(patch) { identity = { ...identity, ...patch } },
    fail() { ready = false },
    succeed() { ready = true },
  }
}

test('Live to Dashboard to Live reuses its validated session and cancels idle expiry', async (t) => {
  const f = fixture(t)
  const first = f.cache.acquire(f.options)
  await first.ready
  first.release()
  t.mock.timers.tick(60_000)
  const second = f.cache.acquire(f.options)
  await second.ready
  t.mock.timers.tick(600_000)
  assert.equal(f.loads, 1)
  assert.equal(f.cleanups, 0, 'a mounted session must survive a ten-minute background period')
  second.release()
  t.mock.timers.tick(LIVE_TRADE_IDLE_MS)
  assert.equal(f.cleanups, 1)
})

test('expired and failed ready sessions reconnect rather than reusing stale state', async (t) => {
  const f = fixture(t)
  const first = f.cache.acquire(f.options)
  await first.ready
  first.release()
  t.mock.timers.tick(LIVE_TRADE_IDLE_MS + 1)
  const second = f.cache.acquire(f.options)
  await second.ready
  assert.equal(f.loads, 2)
  f.fail()
  const third = f.cache.acquire(f.options)
  await third.ready
  assert.equal(f.loads, 3)
  second.release()
  third.release()
})

for (const change of [{ token: 'auth-b' }, { accountId: 'account-b' }, { mode: 'practice' }, { firmId: 'other' }]) {
  test(`a changed ${Object.keys(change)[0]} invalidates retained Live state`, async (t) => {
    const f = fixture(t)
    const first = f.cache.acquire(f.options)
    await first.ready
    first.release()
    f.setIdentity(change)
    f.cache.sync()
    assert.equal(f.cleanups, 1)
  })
}

test('parallel mounts share bootstrap and a failed bootstrap is never retained', async (t) => {
  let finish
  const f = fixture(t, () => new Promise((resolve) => { finish = resolve }))
  const first = f.cache.acquire(f.options)
  const second = f.cache.acquire(f.options)
  await Promise.resolve()
  assert.equal(f.loads, 1)
  finish()
  await Promise.all([first.ready, second.ready])
  first.release()
  t.mock.timers.tick(LIVE_TRADE_IDLE_MS)
  assert.equal(f.cleanups, 0, 'one mounted owner still uses the session')
  second.release()
  f.cache.invalidate()
  const failure = f.cache.acquire({ ...f.options, load: async () => { throw new Error('validation failed') } })
  await assert.rejects(failure.ready, /validation failed/)
  const retry = f.cache.acquire({ ...f.options, load: async () => { f.succeed() } })
  await retry.ready
  assert.equal(f.cleanups, 2, 'a failed validation must be disposed before a successful retry')
  retry.release()
})

test('navigation during bootstrap can retain it, but invalidation rejects late completion', async (t) => {
  let finish
  const f = fixture(t, () => new Promise((resolve) => { finish = resolve }))
  const first = f.cache.acquire(f.options)
  await Promise.resolve()
  first.release()
  const second = f.cache.acquire(f.options)
  finish()
  await second.ready
  assert.equal(f.loads, 1)
  second.release()

  f.cache.invalidate()
  let completeLate
  const late = f.cache.acquire({ ...f.options, load: async (assertCurrent) => {
    await new Promise((resolve) => { completeLate = resolve })
    assertCurrent()
  } })
  await Promise.resolve()
  f.setIdentity({ token: null })
  f.cache.sync()
  completeLate()
  await assert.rejects(late.ready, { name: 'AbortError' })
  late.release()
})

test('logout before route unmount disconnects immediately instead of adopting a null auth token', async (t) => {
  const f = fixture(t)
  const lease = f.cache.acquire(f.options)
  await lease.ready
  f.setIdentity({ token: null })
  lease.release()
  f.cache.sync()
  assert.equal(f.cleanups, 1)
})

test('a different requested account replaces a still-pending bootstrap on return', async (t) => {
  const finishes = []
  const f = fixture(t, (assertCurrent) => new Promise((resolve) => finishes.push(resolve)).then(assertCurrent))
  const first = f.cache.acquire(f.options)
  await Promise.resolve()
  first.release()
  f.setIdentity({ accountId: 'account-b' })
  const second = f.cache.acquire(f.options)
  await Promise.resolve()
  assert.equal(f.loads, 2)
  finishes[0]()
  await assert.rejects(first.ready, { name: 'AbortError' })
  finishes[1]()
  await second.ready
  second.release()
})

for (const awayMs of [5 * 60_000, LIVE_TRADE_WARM_MS]) {
  test(`a ${awayMs / 60_000}-minute dashboard visit reuses its connection and source caches`, async (t) => {
    const f = fixture(t)
    const first = f.cache.acquire(f.options)
    await first.ready
    first.release()
    t.mock.timers.tick(awayMs)
    f.cache.sync()
    assert.equal(f.cleanups, 0, 'the nominal ten-minute window must include its endpoint')
    const returned = f.cache.acquire(f.options)
    await returned.ready
    assert.equal(f.loads, 1, 'return must not bootstrap another source/history session')
    returned.release()
    t.mock.timers.tick(LIVE_TRADE_IDLE_MS - 1)
    assert.equal(f.cleanups, 0, 'a new departure starts a new complete warm window')
    t.mock.timers.tick(1)
    assert.equal(f.cleanups, 1, 'unused connections still have a bounded idle lifetime')
  })
}

test('an overdue cleanup still expires the session when background timers were suspended', async (t) => {
  const f = fixture(t)
  const first = f.cache.acquire(f.options)
  await first.ready
  first.release()
  t.mock.timers.setTime(Date.now() + LIVE_TRADE_IDLE_MS + 1)
  f.cache.sync()
  assert.equal(f.cleanups, 1)
  const returned = f.cache.acquire(f.options)
  await returned.ready
  assert.equal(f.loads, 2)
  returned.release()
})
