import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthSession, AUTH_FRESH_MS, AUTH_MAX_VERIFIED_MS, authTokenExpiry } from '../../src/services/auth/authSession.ts'

const result = (isAdmin = true) => ({ success: true, user: { id: 'user-current', isAdmin } })
const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve() }
function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function fixture(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_800_000_000_000 })
  const state = { token: 'auth-current', calls: [], cleared: [], visible: true, load: async () => result(), snapshots: [] }
  const session = createAuthSession({
    readToken: () => state.token,
    validate: (token) => { state.calls.push(token); return state.load(token) },
    clearToken: (token) => { if (state.token === token) { state.cleared.push(token); state.token = null } },
    isVisible: () => state.visible,
  })
  session.subscribe(() => state.snapshots.push(session.getSnapshot()))
  t.after(() => session.stop())
  return { session, state }
}

test('cold auth checks once, coalesces parallel callers, then navigation reuses only verified memory', async (t) => {
  const { session, state } = fixture(t)
  const loading = deferred()
  state.load = () => loading.promise
  const first = session.ensure()
  const parallel = session.ensure()
  assert.equal(first, parallel)
  assert.equal(session.getSnapshot().value, null)
  await flush()
  assert.deepEqual(state.calls, ['auth-current'])
  loading.resolve(result())
  await first
  for (let route = 0; route < 12; route += 1) assert.equal((await session.ensure()).user.id, 'user-current')
  assert.equal(state.calls.length, 1)
  const newDocument = createAuthSession({ readToken: () => state.token, validate: state.load, clearToken() {} })
  assert.equal(newDocument.getSnapshot().value, null, 'a page reload must not restore permissions from storage')
})

test('a stale verified result renders immediately while one background request refreshes permissions', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  t.mock.timers.setTime(Date.now() + AUTH_FRESH_MS)
  const refresh = deferred()
  state.load = () => refresh.promise
  const current = await session.ensure()
  assert.equal(current.user.isAdmin, true)
  assert.equal(session.getSnapshot().phase, 'ready')
  assert.equal(session.getSnapshot().refreshing, true)
  await session.ensure()
  await flush()
  assert.equal(state.calls.length, 2)
  refresh.resolve(result(false))
  await flush()
  assert.equal(session.getSnapshot().value.user.isAdmin, false)
  assert.equal(session.getSnapshot().refreshing, false)
})

test('the five-minute hard bound removes permissions even when a refresh is still pending', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  const checkedAt = Date.now()
  const refresh = deferred()
  state.load = () => refresh.promise
  t.mock.timers.setTime(checkedAt + AUTH_FRESH_MS)
  await session.ensure()
  t.mock.timers.setTime(checkedAt + AUTH_MAX_VERIFIED_MS)
  session.sync()
  assert.equal(session.getSnapshot().value, null)
  assert.equal(session.getSnapshot().phase, 'checking')
  refresh.resolve(result(false))
  await flush()
  assert.equal(session.getSnapshot().value.user.isAdmin, false)
})

test('cold transient failures retain the login token without inventing verified permissions', async (t) => {
  const { session, state } = fixture(t)
  state.load = async () => { throw new Error('Network unavailable') }
  await assert.rejects(session.ensure(), /Network unavailable/)
  assert.equal(state.token, 'auth-current')
  assert.equal(session.getSnapshot().phase, 'unavailable')
  assert.equal(session.getSnapshot().value, null)
  await assert.rejects(session.ensure(), /Network unavailable/)
  assert.equal(state.calls.length, 1, 'repeated route mounts must not cause a failing-request storm')
})

test('transient refresh failures retain verified permissions only until their original hard deadline', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  const checkedAt = Date.now()
  state.load = async () => { throw new Error('Network unavailable') }
  t.mock.timers.setTime(checkedAt + AUTH_FRESH_MS)
  await session.ensure()
  await flush()
  assert.equal(session.getSnapshot().value.user.isAdmin, true)
  t.mock.timers.setTime(checkedAt + AUTH_MAX_VERIFIED_MS)
  session.sync()
  assert.equal(session.getSnapshot().value, null)
  assert.equal(session.getSnapshot().phase, 'unavailable')
  assert.equal(state.token, 'auth-current')
})

for (const status of [401, 403]) {
  test(`a current validation ${status} immediately clears the shared identity`, async (t) => {
    const { session, state } = fixture(t)
    await session.ensure()
    state.load = async () => { throw { response: { status } } }
    await assert.rejects(session.ensure(state.token, { force: true }))
    assert.equal(state.token, null)
    assert.equal(session.getSnapshot().phase, 'anonymous')
    assert.equal(session.getSnapshot().value, null)
    assert.deepEqual(state.cleared, ['auth-current'])
  })
}

for (const outcome of ['success', 'unauthorized']) {
  test(`an old-token ${outcome} cannot publish permissions or clear a replacement login`, async (t) => {
    const { session, state } = fixture(t)
    const loading = deferred()
    state.load = (token) => token === 'auth-current' ? loading.promise : Promise.resolve(result(false))
    const old = session.ensure()
    await flush()
    state.token = 'auth-replacement'
    session.sync()
    await session.ensure()
    if (outcome === 'success') loading.resolve(result(true))
    else loading.reject({ response: { status: 401 } })
    await assert.rejects(old, { name: 'AbortError' })
    assert.equal(state.token, 'auth-replacement')
    assert.equal(session.getSnapshot().value.user.isAdmin, false)
    assert.deepEqual(state.cleared, [])
    session.rejectToken('auth-current')
    assert.equal(state.token, 'auth-replacement', 'an old request-level 401 must also be ignored')
  })
}

test('logout removes the verified result synchronously and ignores pending work', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  const loading = deferred()
  state.load = () => loading.promise
  const refresh = session.ensure(state.token, { force: true })
  state.token = null
  session.sync()
  assert.equal(session.getSnapshot().phase, 'anonymous')
  assert.equal(session.getSnapshot().value, null)
  loading.resolve(result())
  await assert.rejects(refresh, { name: 'AbortError' })
  assert.equal(session.getSnapshot().value, null)
})

test('periodic visible checks refresh permissions, and paired return events share one request', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  session.start()
  state.load = async () => result(false)
  t.mock.timers.tick(AUTH_FRESH_MS)
  await flush()
  assert.equal(state.calls.length, 2)
  assert.equal(session.getSnapshot().value.user.isAdmin, false)
  const loading = deferred()
  state.load = () => loading.promise
  session.returned()
  session.returned()
  await flush()
  assert.equal(state.calls.length, 3)
  loading.resolve(result())
  await flush()
})

test('hidden pages defer periodic checks and revalidate on return without extending stale permissions', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  session.start()
  state.visible = false
  t.mock.timers.tick(AUTH_MAX_VERIFIED_MS + 1)
  await flush()
  assert.equal(state.calls.length, 1)
  state.visible = true
  const loading = deferred()
  state.load = () => loading.promise
  session.returned()
  assert.equal(session.getSnapshot().value, null)
  await flush()
  assert.equal(state.calls.length, 2)
  loading.resolve(result(false))
  await flush()
})

test('JWT expiry can shorten a server-verified result but cannot authorize an unverified token', async (t) => {
  const { session, state } = fixture(t)
  const expiry = Date.now() + 90_000
  state.token = `header.${Buffer.from(JSON.stringify({ exp: expiry / 1000 })).toString('base64url')}.signature`
  session.sync()
  assert.equal(authTokenExpiry(state.token), expiry)
  assert.equal(session.getSnapshot().value, null)
  await session.ensure()
  t.mock.timers.setTime(expiry)
  session.sync()
  assert.equal(session.getSnapshot().value, null)
})

test('a retry delay cannot carry cached permissions past the five-minute timer deadline', async (t) => {
  const { session, state } = fixture(t)
  await session.ensure()
  const checkedAt = Date.now()
  session.start()
  t.mock.timers.setTime(checkedAt + AUTH_MAX_VERIFIED_MS - 1_000)
  state.load = async () => { throw new Error('Network unavailable') }
  await assert.rejects(session.ensure(state.token, { force: true }))
  assert.notEqual(session.getSnapshot().value, null)
  t.mock.timers.tick(1_000)
  await flush()
  assert.equal(session.getSnapshot().value, null)
  assert.equal(session.getSnapshot().phase, 'unavailable')
})

test('callers cannot mutate the shared verified authority or its permission arrays', async (t) => {
  const { session, state } = fixture(t)
  const source = { success: true, user: { id: 'user-current', isAdmin: false, permissions: ['read'] } }
  state.load = async () => source
  const verified = await session.ensure()
  source.user.isAdmin = true
  assert.equal(session.getSnapshot().value.user.isAdmin, false)
  assert.throws(() => { verified.user.isAdmin = true }, TypeError)
  assert.throws(() => { verified.user.permissions.push('admin') }, TypeError)
  assert.throws(() => { session.getSnapshot().value = source }, TypeError)
})
