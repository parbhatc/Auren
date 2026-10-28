import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Exercise the actual wrapper and its effects. Only rendering and external
// services are replaced; deferred promises control real startup ordering.
const dependencies = {
  react: `
    export const useState = (initial) => {
      const state = globalThis.__replayStartup;
      const index = state.cursor++;
      state.hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [state.hooks[index].value, (value) => {
        state.writes += 1;
        if (state.unmounted) state.lateWrites += 1;
        const next = typeof value === 'function' ? value(state.hooks[index].value) : value;
        if (!Object.is(next, state.hooks[index].value)) state.dirty = true;
        state.hooks[index].value = next;
      }];
    };
    export const useEffect = (effect, deps) => {
      const state = globalThis.__replayStartup;
      const index = state.cursor++;
      const old = state.hooks[index];
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
      state.pendingEffects.push(() => {
        old?.cleanup?.();
        state.hooks[index] = { deps, cleanup: effect() };
      });
    };
  `,
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = "fragment";',
  'lucide-react': 'export const RefreshCw = "refresh-icon";',
  'react-router-dom': 'export const useNavigate = () => globalThis.__replayStartup.navigate;',
  '../../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true, toggleTheme() {} });',
  '../../../constants/routes': 'export const ROUTES = { LOGIN: "/login" };',
  '../../../api/auth.api': `
    export const authAPI = { validateToken(token) {
      const state = globalThis.__replayStartup;
      state.calls.push(['auth', token]);
      return state.auth(token);
    } };
    export const authSession = { subscribe(listener) {
      const listeners = globalThis.__replayStartup.listeners;
      listeners.add(listener);
      return () => listeners.delete(listener);
    } };
  `,
  '../../../api/backtester.api': `export const backtesterAPI = {
    getSessions() {
      const state = globalThis.__replayStartup;
      state.calls.push(['sessions', state.token]);
      return state.sessions(state.token);
    },
    getAvailableSymbols() {
      const state = globalThis.__replayStartup;
      state.calls.push(['catalog', state.token]);
      return state.catalog(state.token);
    },
  };`,
  '../../../constants/theme': 'export const getThemeColors = () => ({});',
  '../../../styles/aurenTheme': 'export const fieldLabelClass = () => ""; export const ghostButtonClass = () => ""; export const primaryButtonClass = () => ""; export const settingsInputClass = () => "";',
  '../../../utils/translator': 'export const t = (key, params, fallback) => fallback ?? key;',
  '../../common/Loading': 'export default "loading";',
  '../../common/ErrorMessage': 'export default "error-message";',
  './BacktesterSessionsList': 'export default "sessions-list";',
  '../ResetSessionModal': 'export default "reset-modal";',
  '../../common/Modal': 'export default "modal";',
  '../../../backtester/constants': 'export const DEFAULT_BACKTESTER_SYMBOL = "NQ";',
  '../../../utils/replayPreferences': 'export const clearSavedReplayPositions = () => {};',
  '../../../services/dashboard/dashboardReplayData': 'export const DASHBOARD_REPLAY_CHANGED_EVENT = "replaySessionsChanged"; export const invalidateDashboardReplaySessions = () => {};',
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/backtester/BacktesterSessionsList/BacktesterSessionsListWrapper.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'replay-startup-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected replay dependency: ${path}`)
      return { path, namespace: 'replay-startup-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'replay-startup-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: ReplaySessions } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let state
let previous
const user = (id = 'current') => ({ success: true, user: { id, isAdmin: id === 'old' } })
const sessions = (id = 'current') => ({ success: true, sessions: [{ id, name: `${id} session` }] })
const symbols = (symbol = 'NQ') => ({ success: true, symbols: [symbol], count: 1 })
beforeEach(() => {
  previous = { fixture: globalThis.__replayStartup, storage: globalThis.localStorage }
  state = {
    token: 'current', hooks: [], cursor: 0, pendingEffects: [], listeners: new Set(), calls: [], navigations: [],
    dirty: false, unmounted: false, writes: 0, lateWrites: 0,
    auth: async (token) => user(token), sessions: async (token) => sessions(token), catalog: async () => symbols(),
  }
  state.navigate = (route) => state.navigations.push(route)
  globalThis.__replayStartup = state
  globalThis.localStorage = { getItem: (key) => key === 'token' ? state.token : null }
})
afterEach(() => {
  unmount()
  globalThis.__replayStartup = previous.fixture
  globalThis.localStorage = previous.storage
})

function render(props = {}) {
  let result
  let renders = 0
  do {
    assert.ok(renders++ < 10, 'startup must settle without a render loop')
    state.dirty = false
    state.cursor = 0
    state.pendingEffects = []
    result = ReplaySessions({ embedded: true, ...props })
    for (const effect of state.pendingEffects) effect()
  } while (state.dirty)
  state.rendered = result
  return result
}
function unmount() {
  if (state.unmounted) return
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
}
function changeToken(token, notify = true) {
  state.token = token
  if (notify) for (const listener of [...state.listeners]) listener()
}
function find(type, node = state.rendered) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) return node.map((child) => find(type, child)).find(Boolean) ?? null
  if (node.type === type) return node
  return find(type, node.props?.children ?? null)
}
function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
async function flush() {
  await new Promise(setImmediate)
  return render()
}

test('saved sessions render while the slow CSV catalog is still unresolved', async () => {
  const auth = deferred()
  const saved = deferred()
  const catalog = deferred()
  state.auth = () => auth.promise
  state.sessions = () => saved.promise
  state.catalog = () => catalog.promise
  render()
  assert.deepEqual(state.calls, [['auth', 'current']])
  auth.resolve(user())
  await flush()
  assert.deepEqual(state.calls, [['auth', 'current'], ['catalog', 'current'], ['sessions', 'current']])
  assert.equal(find('sessions-list'), null)

  saved.resolve(sessions())
  await flush()
  assert.deepEqual(find('sessions-list').props.sessions, sessions().sessions)
  assert.deepEqual(find('sessions-list').props.availableSymbols, [], 'creation remains unavailable until symbols arrive')
  assert.equal(find('sessions-list').props.symbolsError, '')

  catalog.resolve(symbols('ES'))
  await flush()
  assert.deepEqual(find('sessions-list').props.availableSymbols, ['ES'])
  find('sessions-list').props.onCreateClick()
  render()
  assert.equal(find('sessions-list').props.showNewSessionForm, true)
  assert.equal(state.calls.length, 3, 'finishing metadata must not fetch the sessions again')
})

test('catalog failure remains nonfatal and leaves saved sessions usable', async () => {
  state.catalog = async () => { throw new Error('CSV scan failed') }
  render()
  await flush()
  assert.deepEqual(find('sessions-list').props.sessions, sessions().sessions)
  assert.equal(find('sessions-list').props.symbolsError, 'backtester.failedToLoadSymbols')
  assert.equal(find('error-message'), null, 'only the list should receive the optional catalog error')
})

for (const failure of ['network', 'empty-user', 'sessions-rejected', 'sessions-unsuccessful']) {
  test(`${failure} ends startup with a retry that can successfully load sessions`, async () => {
    if (failure === 'network') state.auth = async () => { throw new Error('Offline') }
    if (failure === 'empty-user') state.auth = async () => ({ success: true })
    if (failure === 'sessions-rejected') state.sessions = async () => { throw new Error('Database offline') }
    if (failure === 'sessions-unsuccessful') state.sessions = async () => ({ success: false, sessions: [] })
    render()
    await flush()
    assert.equal(find('sessions-list'), null)
    assert.equal(find('refresh-icon'), null, 'a settled failure must not leave an infinite spinner')
    assert.match(find('error-message').props.message, /Unable to load replay sessions/)
    const retry = find('button')
    assert.equal(retry.props.children, 'Try again')
    state.auth = async (token) => user(token)
    state.sessions = async (token) => sessions(token)
    retry.props.onClick()
    render()
    await flush()
    assert.deepEqual(find('sessions-list').props.sessions, sessions().sessions)
    assert.equal(find('error-message'), null)
    assert.equal(state.listeners.size, 1, 'retry cleans up its previous auth subscription')
  })
}

for (const oldOutcome of ['success', 'unauthorized']) {
  test(`late ${oldOutcome} from old authentication cannot affect a replacement login`, async () => {
    const old = deferred()
    state.token = 'old'
    state.auth = (token) => token === 'old' ? old.promise : Promise.resolve(user(token))
    render()
    changeToken('replacement')
    await flush()
    assert.deepEqual(find('sessions-list').props.sessions, sessions('replacement').sessions)
    assert.equal(find('sessions-list').props.showAdmin, false)
    if (oldOutcome === 'success') old.resolve(user('old'))
    else old.reject({ response: { status: 401 } })
    await flush()
    assert.deepEqual(find('sessions-list').props.sessions, sessions('replacement').sessions)
    assert.equal(find('sessions-list').props.showAdmin, false)
    assert.deepEqual(state.navigations, [])
    assert.equal(state.calls.some(([name, token]) => name !== 'auth' && token === 'old'), false)
  })
}

for (const oldOutcome of ['success', 'unauthorized']) {
  test(`old session ${oldOutcome} and catalog completion cannot replace data from the new login`, async () => {
    const oldSessions = deferred()
    const oldCatalog = deferred()
    state.token = 'old'
    state.sessions = (token) => token === 'old' ? oldSessions.promise : Promise.resolve(sessions(token))
    state.catalog = (token) => token === 'old' ? oldCatalog.promise : Promise.resolve(symbols('ES'))
    render()
    await flush()
    changeToken('replacement')
    await flush()
    assert.deepEqual(find('sessions-list').props.sessions, sessions('replacement').sessions)
    assert.deepEqual(find('sessions-list').props.availableSymbols, ['ES'])
    if (oldOutcome === 'success') oldSessions.resolve(sessions('old'))
    else oldSessions.reject({ response: { status: 401 } })
    oldCatalog.resolve(symbols('OLD'))
    await flush()
    assert.deepEqual(find('sessions-list').props.sessions, sessions('replacement').sessions)
    assert.deepEqual(find('sessions-list').props.availableSymbols, ['ES'])
    assert.deepEqual(state.navigations, [])
  })
}

test('a token replaced directly in storage is detected when an older auth request settles', async () => {
  const old = deferred()
  state.auth = (token) => token === 'current' ? old.promise : Promise.resolve(user(token))
  render()
  changeToken('replacement', false)
  old.resolve(user())
  await flush()
  assert.deepEqual(find('sessions-list').props.sessions, sessions('replacement').sessions)
  assert.equal(state.calls.some(([name, token]) => name !== 'auth' && token === 'current'), false)
})

for (const phase of ['authentication', 'sessions-and-catalog']) {
  test(`unmount during ${phase} detaches all late updates and navigation`, async () => {
    const auth = deferred()
    const saved = deferred()
    const catalog = deferred()
    state.auth = () => phase === 'authentication' ? auth.promise : Promise.resolve(user())
    state.sessions = () => saved.promise
    state.catalog = () => catalog.promise
    render()
    if (phase !== 'authentication') await flush()
    unmount()
    const writes = state.writes
    if (phase === 'authentication') auth.reject({ response: { status: 401 } })
    saved.resolve(sessions())
    catalog.resolve(symbols())
    await new Promise(setImmediate)
    assert.equal(state.writes, writes)
    assert.equal(state.lateWrites, 0)
    assert.equal(state.listeners.size, 0)
    assert.deepEqual(state.navigations, [])
  })
}

test('same-token background auth updates do not reload sessions or symbols', async () => {
  render()
  await flush()
  for (const listener of [...state.listeners]) listener()
  await flush()
  assert.deepEqual(state.calls, [['auth', 'current'], ['catalog', 'current'], ['sessions', 'current']])
  assert.deepEqual(find('sessions-list').props.sessions, sessions().sessions)
})

test('a late catalog from a failed attempt cannot overwrite the successful retry', async () => {
  const firstCatalog = deferred()
  state.catalog = () => firstCatalog.promise
  state.sessions = async () => { throw new Error('Database offline') }
  render()
  await flush()
  state.catalog = async () => symbols('ES')
  state.sessions = async () => sessions()
  find('button').props.onClick()
  render()
  await flush()
  assert.deepEqual(find('sessions-list').props.availableSymbols, ['ES'])
  firstCatalog.resolve(symbols('OLD'))
  await flush()
  assert.deepEqual(find('sessions-list').props.availableSymbols, ['ES'])
})

test('a missing token redirects and settles without a spinner or backend reads', async () => {
  state.token = null
  render()
  await flush()
  assert.deepEqual(state.navigations, ['/login'])
  assert.deepEqual(state.calls, [])
  assert.equal(find('refresh-icon'), null)
  assert.match(find('error-message').props.message, /Please sign in/)
})
