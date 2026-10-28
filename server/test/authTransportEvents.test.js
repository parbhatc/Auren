import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { createAuthSession } from '../../src/services/auth/authSession.ts'

const handlers = { request: null, response: null }
globalThis.__authTransportHandlers = handlers
const bundled = await build({
  stdin: {
    contents: `export { getAuthToken, setAuthToken, clearAuthToken } from './src/api/api.ts';
      export { subscribeAuthEvents } from './src/services/auth/authEvents.ts';`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false, define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'auth-transport-boundary', setup(builder) {
    builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'axios-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'axios-test' }, () => ({ contents: `export default { create() {
      return { interceptors: {
        request: { use(handler) { globalThis.__authTransportHandlers.request = handler } },
        response: { use(_success, handler) { globalThis.__authTransportHandlers.response = handler } },
      } };
    } };` }))
  } }],
})
const { getAuthToken, setAuthToken, clearAuthToken, subscribeAuthEvents } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
delete globalThis.__authTransportHandlers
let state
let previous
beforeEach(() => {
  previous = globalThis.localStorage
  state = { token: 'auth-current', events: [], cleanups: [] }
  globalThis.localStorage = {
    getItem: () => state.token,
    setItem: (_key, token) => { state.token = token },
    removeItem: () => { state.token = null },
  }
  state.cleanups.push(subscribeAuthEvents((event) => state.events.push(event)))
})
afterEach(() => { for (const cleanup of state.cleanups) cleanup(); globalThis.localStorage = previous })

test('login and logout update this tab synchronously without waiting for a storage event', () => {
  setAuthToken('auth-replacement')
  assert.equal(getAuthToken(), 'auth-replacement')
  clearAuthToken()
  assert.equal(getAuthToken(), null)
  assert.deepEqual(state.events, [{ kind: 'token-change' }, { kind: 'token-change' }])
})

test('request-level unauthorized events identify their exact token and preserve a newer login', async () => {
  const session = createAuthSession({ readToken: getAuthToken, clearToken: () => clearAuthToken(),
    validate: async () => ({ success: true, user: { isAdmin: false } }) })
  state.cleanups.push(subscribeAuthEvents((event) => {
    if (event.kind === 'unauthorized') session.rejectToken(event.token)
    else session.sync()
  }))
  await session.ensure()
  setAuthToken('auth-replacement')
  await session.ensure()
  const oldFailure = { response: { status: 401, data: { success: false, code: 'APP_AUTH_INVALID' } }, config: { headers: { Authorization: 'Bearer auth-current' } } }
  await assert.rejects(handlers.response(oldFailure))
  assert.equal(state.token, 'auth-replacement')
  assert.equal(session.getSnapshot().value.user.isAdmin, false)
  const currentFailure = { response: { status: 401, data: { success: false, code: 'APP_AUTH_INVALID' } }, config: { headers: { Authorization: 'Bearer auth-replacement' } } }
  await assert.rejects(handlers.response(currentFailure))
  assert.equal(state.token, null)
  assert.equal(session.getSnapshot().value, null)
})

test('an endpoint permission failure does not discard the authenticated session', async () => {
  const denied = { response: { status: 403 }, config: { headers: { Authorization: 'Bearer auth-current' } } }
  await assert.rejects(handlers.response(denied))
  assert.deepEqual(state.events, [])
  assert.equal(state.token, 'auth-current')
})

test('a provider-session 401 requests an authoritative app check instead of declaring the login invalid', async () => {
  const expiredProvider = { response: { status: 401, data: { success: false, error: 'Market data session expired. Reconnect in Settings → Market data.' } },
    config: { url: '/tradesea/orders', headers: { Authorization: 'Bearer auth-current' } } }
  await assert.rejects(handlers.response(expiredProvider))
  assert.deepEqual(state.events, [{ kind: 'verify-current', token: 'auth-current' }])
  assert.equal(state.token, 'auth-current')
})
