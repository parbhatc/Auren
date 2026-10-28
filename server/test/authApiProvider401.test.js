import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

let state
const previousStorage = globalThis.localStorage
globalThis.localStorage = { getItem: () => null }
const bundled = await build({
  stdin: {
    contents: `export { authAPI, authSession } from './src/api/auth.api.ts';
      export { default as api, setAuthToken, getAuthToken } from './src/api/api.ts';
      export { default as TradeseaController } from './server/src/controllers/TradeseaController.js';`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false, define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'auth-api-provider-boundaries', setup(builder) {
    builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'auth-api-test' }))
    builder.onResolve({ filter: /TradeseaIdentityService\.js$/ }, () => ({ path: 'provider', namespace: 'auth-api-test' }))
    builder.onResolve({ filter: /PropsController\.js$/ }, () => ({ path: 'props', namespace: 'auth-api-test' }))
    builder.onResolve({ filter: /config\/Database\.js$/ }, () => ({ path: 'database', namespace: 'auth-api-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'auth-api-test' }, ({ path }) => {
      if (path === 'provider') return { contents: `export default {
        async verifyConnection() { return { connected: false, reason: 'unauthorized' } },
        async refreshAccessToken() { throw new Error('Provider refresh expired') },
      };` }
      if (path === 'props') return { contents: 'export default { async initializeTable() {} };' }
      if (path === 'database') return { contents: 'export default { async get() { return { token: "expired-provider", session_id: "expired-refresh" } } };' }
      return { contents: `export default { create() {
        let requestHandler = (config) => config;
        let responseHandler = (error) => Promise.reject(error);
        return {
          interceptors: {
            request: { use(handler) { requestHandler = handler } },
            response: { use(_success, handler) { responseHandler = handler } },
          },
          async get(url, config = {}) {
            const request = requestHandler({ ...config, url, headers: { ...config.headers } });
            try { return await globalThis.__authApiProvider.adapter(url, request) }
            catch (error) { error.config = request; return responseHandler(error) }
          },
        };
      } };` }
    })
  } }],
})
const { authAPI, authSession, api, setAuthToken, TradeseaController } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
globalThis.localStorage = previousStorage
const flush = async () => { for (let i = 0; i < 32; i += 1) await Promise.resolve() }
let restoreStorage
beforeEach(async () => {
  restoreStorage = globalThis.localStorage
  state = { token: null, validationReads: 0, providerReads: 0, failure: null }
  globalThis.__authApiProvider = state
  globalThis.localStorage = {
    getItem: () => state.token,
    setItem: (_key, token) => { state.token = token },
    removeItem: () => { state.token = null },
  }
  state.adapter = async (url) => {
    if (url === '/auth/validate') {
      state.validationReads += 1
      return { data: { success: true, user: { id: 'app-user', isAdmin: false } } }
    }
    state.providerReads += 1
    throw state.failure
  }
  setAuthToken(null)
  setAuthToken('valid-auren-token')
  await authAPI.validateToken('valid-auren-token')
})
afterEach(() => { setAuthToken(null); authSession.stop(); globalThis.localStorage = restoreStorage; delete globalThis.__authApiProvider })

test('a real expired Tradesea session response leaves a valid Auren login intact and keeps returning the provider error', async () => {
  const response = { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await TradeseaController.placeOrder({ user: { id: 'app-user' }, body: { accountId: 'provider-account' } }, response)
  assert.equal(response.statusCode, 401)
  assert.match(response.body.error, /Market data session expired/)
  state.failure = { response: { status: response.statusCode, data: response.body } }
  await assert.rejects(api.get('/tradesea/orders'))
  await flush()
  assert.equal(state.token, 'valid-auren-token')
  assert.equal(authSession.getSnapshot().value.user.id, 'app-user')
  assert.equal(state.validationReads, 2, 'an ambiguous provider 401 must verify app auth rather than clear it')
  state.failure = { response: { status: response.statusCode, data: response.body } }
  await assert.rejects(api.get('/tradesea/orders'))
  assert.equal(state.providerReads, 2, 'provider errors must not become successful cached responses')
  await flush()
  assert.equal(state.token, 'valid-auren-token')
})

test('an explicit app-auth middleware failure clears the current login immediately without a recursive check', async () => {
  state.failure = { response: { status: 401, data: { success: false, code: 'APP_AUTH_INVALID', message: 'Invalid or expired token' } } }
  await assert.rejects(api.get('/journal'))
  assert.equal(state.token, null)
  assert.equal(authSession.getSnapshot().value, null)
  assert.equal(state.validationReads, 1)
})

test('an authoritative validation 401 ends the login without recursively validating itself', async () => {
  state.adapter = async () => {
    state.validationReads += 1
    throw { response: { status: 401, data: { success: false, message: 'Invalid or expired token' } } }
  }
  await assert.rejects(authSession.ensure(state.token, { force: true }))
  assert.equal(state.token, null)
  assert.equal(authSession.getSnapshot().value, null)
  assert.equal(state.validationReads, 2)
})
