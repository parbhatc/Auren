import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createAuthSession } from '../../src/services/auth/authSession.ts'

const dependencies = {
  react: 'export const Suspense = "suspense"; export class Component { constructor(props) { this.props = props } setState(patch) { this.state = { ...this.state, ...patch } } }',
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props });',
  axios: 'export default { isAxiosError: (error) => Boolean(error?.isAxiosError) };',
  'react-router-dom': 'export const Navigate = "redirect";',
  '../../constants/routes': 'export const ROUTES = { LOGIN: "/login", DASHBOARD: "/dashboard" };',
  '../../api/auth.api': `export const authAPI = { validateToken: (token) => globalThis.__protectedAuth.session.ensure(token) };
    export const authSession = new Proxy({}, { get: (_, key) => (...args) => globalThis.__protectedAuth.session[key](...args) });`,
  './Loading': 'export default "loading";',
  '../../contexts/ValidatedAuthContext': 'export const ValidatedAuthContext = { Provider: "validated-auth" };',
  '../../services/debug/startupTrace': 'export const traceStartup = (name) => globalThis.__protectedAuth.traces.push(name);',
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/common/ProtectedRoute.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'guard-read-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected route dependency: ${path}`)
      return { path, namespace: 'guard-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'guard-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: ProtectedRoute } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let state
let previous
beforeEach(() => {
  previous = { fixture: globalThis.__protectedAuth, storage: globalThis.localStorage }
  state = { token: 'auth-current', calls: [], traces: [], validate: async () => ({ success: true, user: { isAdmin: true } }) }
  globalThis.__protectedAuth = state
  globalThis.localStorage = {
    getItem(key) { return key === 'token' ? state.token : null },
    removeItem(key) { if (key === 'token') state.token = null },
  }
  state.session = createAuthSession({
    readToken: () => state.token,
    clearToken: (token) => { if (state.token === token) state.token = null },
    validate: (token) => state.validate(token),
    trace: (name) => state.traces.push(name),
  })
})
afterEach(() => { state.session.stop(); globalThis.__protectedAuth = previous.fixture; globalThis.localStorage = previous.storage })

test('the route publishes admin information only after its server validation completes', async () => {
  let finish
  state.validate = (token) => { state.calls.push(token); return new Promise((resolve) => { finish = resolve }) }
  const route = new ProtectedRoute({ children: 'protected-content' })
  const pending = route.validateToken()
  assert.equal(route.render().type, 'loading')
  await flush()
  finish({ success: true, user: { isAdmin: true } })
  await pending
  assert.deepEqual(state.calls, ['auth-current'])
  assert.deepEqual(state.traces, ['auth-start', 'auth-ready'])
  assert.equal(route.render().type, 'validated-auth')
  assert.deepEqual(route.render().props.value, { token: 'auth-current', isAdmin: true })
  assert.equal(route.render().props.children.type, 'suspense')
  assert.equal(route.render().props.children.props.children, 'protected-content')
})

test('the existing server-unavailable fallback does not manufacture a reusable auth result', async () => {
  state.validate = async () => { throw new Error('Server unavailable') }
  const route = new ProtectedRoute({ children: 'protected-content' })
  await route.validateToken()
  assert.equal(route.state.isAuthenticated, true)
  assert.equal(route.render().props.value, null)
  assert.deepEqual(state.traces, ['auth-start', 'auth-error'])
})

test('an unauthorized response still clears authentication and redirects before rendering children', async () => {
  state.validate = async () => { throw { isAxiosError: true, response: { status: 401 } } }
  const route = new ProtectedRoute({ children: 'protected-content' })
  await route.validateToken()
  assert.equal(state.token, null)
  assert.equal(route.render().type, 'redirect')
  assert.equal(route.render().props.to, '/login')
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 32; i += 1) await Promise.resolve() }

for (const oldOutcome of ['success', 'unauthorized']) {
  test(`an old ${oldOutcome} validates the replacement token without authorizing or clearing it`, async () => {
    const old = deferred()
    const replacement = deferred()
    state.validate = (token) => {
      state.calls.push(token)
      return token === 'auth-current' ? old.promise : replacement.promise
    }
    const route = new ProtectedRoute({ children: 'protected-content' })
    const pending = route.validateToken()
    state.token = 'auth-replacement'
    if (oldOutcome === 'success') old.resolve({ success: true, user: { isAdmin: true } })
    else old.reject({ isAxiosError: true, response: { status: 401 } })
    await flush()
    assert.equal(state.token, 'auth-replacement')
    assert.equal(route.render().type, 'loading', 'the previous login must not authorize the replacement')
    assert.deepEqual(state.calls, ['auth-current', 'auth-replacement'])
    replacement.resolve({ success: true, user: { isAdmin: false } })
    await pending
    assert.deepEqual(route.render().props.value, { token: 'auth-replacement', isAdmin: false })
    assert.deepEqual(state.traces, ['auth-start', 'auth-start', 'auth-ready'])
  })
}

test('a late unauthorized result cannot remove a newer token whose validation has already started', async () => {
  const old = deferred()
  const replacement = deferred()
  state.validate = (token) => {
    state.calls.push(token)
    return token === 'auth-current' ? old.promise : replacement.promise
  }
  const route = new ProtectedRoute({ children: 'protected-content' })
  const oldPending = route.validateToken()
  state.token = 'auth-replacement'
  const replacementPending = route.validateToken()
  replacement.resolve({ success: true, user: { isAdmin: false } })
  await replacementPending
  old.reject({ isAxiosError: true, response: { status: 401 } })
  await oldPending
  assert.equal(state.token, 'auth-replacement')
  assert.deepEqual(state.calls, ['auth-current', 'auth-replacement'])
  assert.deepEqual(route.render().props.value, { token: 'auth-replacement', isAdmin: false })
})

for (const oldOutcome of ['success', 'unauthorized']) {
  test(`unmount detaches the guard while the shared session handles a pending current-token ${oldOutcome}`, async () => {
    const old = deferred()
    state.validate = () => old.promise
    const route = new ProtectedRoute({ children: 'protected-content' })
    route.componentDidMount()
    route.componentWillUnmount()
    let lateUpdates = 0
    route.setState = () => { lateUpdates += 1 }
    if (oldOutcome === 'success') old.resolve({ success: true, user: { isAdmin: true } })
    else old.reject({ isAxiosError: true, response: { status: 401 } })
    await flush()
    assert.equal(lateUpdates, 0)
    assert.equal(state.token, oldOutcome === 'success' ? 'auth-current' : null)
    assert.deepEqual(state.traces, ['auth-start', oldOutcome === 'success' ? 'auth-ready' : 'auth-error'])
  })
}

test('development mount replay shares the pending check while old guard callbacks stay detached', async () => {
  const first = deferred()
  state.validate = (token) => {
    state.calls.push(token)
    return first.promise
  }
  const route = new ProtectedRoute({ children: 'protected-content' })
  route.componentDidMount()
  route.componentWillUnmount()
  route.componentDidMount()
  await flush()
  assert.equal(route.render().type, 'loading')
  assert.deepEqual(state.calls, ['auth-current'])
  first.resolve({ success: true, user: { isAdmin: false } })
  await flush()
  assert.deepEqual(route.render().props.value, { token: 'auth-current', isAdmin: false })
  assert.deepEqual(state.traces, ['auth-start', 'auth-ready'])
  route.componentWillUnmount()
})

test('a second protected route renders verified content immediately without another blocking auth check', async () => {
  state.validate = async (token) => { state.calls.push(token); return { success: true, user: { isAdmin: true } } }
  const first = new ProtectedRoute({ children: 'first-page' })
  await first.validateToken()
  const next = new ProtectedRoute({ children: 'next-page' })
  assert.equal(next.render().type, 'validated-auth')
  assert.equal(next.render().props.children.props.children, 'next-page')
  next.componentDidMount()
  await flush()
  assert.deepEqual(state.calls, ['auth-current'])
  state.token = null
  state.session.sync()
  assert.equal(next.render().type, 'redirect', 'logout must also invalidate a mounted retained guard')
  next.componentWillUnmount()
})
