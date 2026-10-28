import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createAuthSession } from '../../src/services/auth/authSession.ts'

const dependencies = {
  react: `export const Suspense = "suspense";
    export const useEffect = (effect) => globalThis.__guestAuth.effects.push(effect);
    export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`,
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props });',
  'react-router-dom': 'export const Navigate = "redirect";',
  '../../constants/routes': 'export const ROUTES = { HOME: "/dashboard" };',
  '../../api/auth.api': `export const authAPI = { validateToken: (token) => globalThis.__guestAuth.session.ensure(token) };
    export const authSession = new Proxy({}, { get: (_, key) => (...args) => globalThis.__guestAuth.session[key](...args) });`,
  './Loading': 'export default "loading";',
  '../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true });',
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/common/GuestRoute.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'guest-read-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected guest dependency: ${path}`)
      return { path, namespace: 'guest-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'guest-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: GuestRoute } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
let previous
let state
beforeEach(() => {
  previous = globalThis.__guestAuth
  state = { token: 'auth-current', effects: [], calls: 0, load: async () => ({ success: true, user: { isAdmin: false } }) }
  state.session = createAuthSession({
    readToken: () => state.token,
    validate: () => { state.calls += 1; return state.load() },
    clearToken: (token) => { if (state.token === token) state.token = null },
  })
  globalThis.__guestAuth = state
})
afterEach(() => { state.session.stop(); globalThis.__guestAuth = previous })
const render = () => GuestRoute({ children: 'login-form' })

test('a verified session redirects from guest pages immediately without another auth request', async () => {
  await state.session.ensure()
  assert.equal(render().type, 'redirect')
  for (const effect of state.effects) effect()
  await new Promise(setImmediate)
  assert.equal(state.calls, 1)
})

test('an anonymous guest renders the login page inside its own lazy boundary without validation', () => {
  state.token = null
  state.session.sync()
  assert.equal(render().type, 'suspense')
  assert.equal(render().props.children, 'login-form')
  for (const effect of state.effects) effect()
  assert.equal(state.calls, 0)
})

test('cold auth waits for a real check and preserves the existing transient-error guest fallback', async () => {
  state.load = async () => { throw new Error('Network unavailable') }
  assert.equal(render().type, 'loading')
  for (const effect of state.effects) effect()
  await new Promise(setImmediate)
  assert.equal(render().type, 'suspense')
  assert.equal(state.token, 'auth-current')
  assert.equal(state.session.getSnapshot().value, null)
})
