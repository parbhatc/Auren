import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const state = { token: 'owner', accounts: [], calls: {} }
globalThis.__dashboardTest = state
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
}
globalThis.window = new EventTarget()
const mocks = {
  'api/api': 'export const getAuthToken = () => globalThis.__dashboardTest.token',
  'api/backtester.api': 'export const backtesterAPI = { getSessions: async () => ({ success: true, sessions: [] }) }',
  'api/practice.api': 'export const practiceAPI = { getStats: (...args) => globalThis.__dashboardTest.getStats(...args) }',
  'api/tradesea.api': `export const tradeseaAPI = {
    getAccounts: (...args) => globalThis.__dashboardTest.getAccounts(...args),
    getTradelensDashboard: (...args) => globalThis.__dashboardTest.getDashboard(...args),
    getTradelensCalendar: (...args) => globalThis.__dashboardTest.getCalendar(...args),
  }`,
  'constants/practice': `export const PRACTICE_STORAGE_KEYS = { ACTIVE_TRADE_ID: 'activePractice' };
    export const getPracticeAccounts = () => globalThis.__dashboardTest.accounts;
    export const refreshPracticeFromApi = () => globalThis.__dashboardTest.refreshPractice();`,
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/dashboard/dashboardAccountData.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'dashboard-test-dependencies', setup(build) {
    build.onResolve({ filter: /(?:api\/api|api\/(?:practice|tradesea|backtester)\.api|constants\/practice)$/ }, ({ path }) => {
      const key = Object.keys(mocks).find((key) => path.endsWith(key))
      return key ? { path: key, namespace: 'dashboard-test' } : undefined
    })
    build.onLoad({ filter: /.*/, namespace: 'dashboard-test' }, ({ path }) => ({ contents: mocks[path] }))
  } }],
})
const {
  getDashboardAccountSnapshot, invalidateDashboardAccountSnapshots, loadDashboardAccountData,
} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const selectionBundle = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/dashboard/dashboardAccountSelection.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { saveDashboardAccountSelection } = await import(
  `data:text/javascript;base64,${Buffer.from(selectionBundle.outputFiles[0].text).toString('base64')}`
)
const month = new Date(2026, 9, 1)
const practice = { id: 'practice-1', updatedAt: 'first', dayPnL: [{ date: '2026-10-12', pnl: 120 }] }
const live = { id: 'live-1', label: 'Live account' }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

beforeEach(() => {
  invalidateDashboardAccountSnapshots()
  storage.clear()
  state.token = 'owner'
  state.accounts = [practice]
  state.calls = { refresh: 0, stats: 0, accounts: 0, dashboard: 0, calendar: 0 }
  state.refreshPractice = async () => { state.calls.refresh += 1 }
  state.getStats = async () => { state.calls.stats += 1; return { totalPnl: 120, totalTrades: 2 } }
  state.getAccounts = async () => { state.calls.accounts += 1; return { connected: true, accounts: [live] } }
  state.getDashboard = async () => { state.calls.dashboard += 1; return { s: 'success', d: { totalPnl: { value: 450 } } } }
  state.getCalendar = async () => { state.calls.calendar += 1; return { s: 'success', d: { pnlAndTradeCountCalendar: [] } } }
})

function select(source, accountId) {
  storage.set('aurenDashboardAccount', `${source}:${accountId}`)
}

test('practice statistics never wait for the disconnected live provider', async () => {
  select('practice', practice.id)
  state.getAccounts = () => { throw new Error('The live provider must not be queried') }
  const result = await loadDashboardAccountData(month)
  assert.equal(result.practiceStats.totalPnl, 120)
  assert.equal(result.loading, false)
  assert.equal(state.calls.refresh, 1)
})

test('practice month switches reuse statistics without refreshing account catalogs', async () => {
  select('practice', practice.id)
  await loadDashboardAccountData(month)
  const result = await loadDashboardAccountData(new Date(2026, 8, 1), { refreshPractice: false })
  assert.equal(result.practiceStats.totalPnl, 120)
  assert.deepEqual(state.calls, { refresh: 1, stats: 1, accounts: 0, dashboard: 0, calendar: 0 })
})

test('a changed practice account invalidates recent statistics', async () => {
  select('practice', practice.id)
  await loadDashboardAccountData(month)
  state.accounts = [{ ...practice, updatedAt: 'after-trade' }]
  await loadDashboardAccountData(month, { refreshPractice: false })
  assert.equal(state.calls.stats, 2)
})

test('overlapping dashboard mounts share the practice statistics request', async () => {
  select('practice', practice.id)
  const pending = deferred()
  state.getStats = () => { state.calls.stats += 1; return pending.promise }
  const first = loadDashboardAccountData(month, { refreshPractice: false })
  const second = loadDashboardAccountData(month, { refreshPractice: false })
  await Promise.resolve()
  assert.equal(state.calls.stats, 1)
  pending.resolve({ totalPnl: 25 })
  assert.equal((await first).practiceStats.totalPnl, 25)
  assert.equal((await second).practiceStats.totalPnl, 25)
})

test('failed statistics stop loading and can be retried immediately', async () => {
  select('practice', practice.id)
  state.getStats = async () => { throw new Error('offline') }
  const failed = await loadDashboardAccountData(month)
  assert.equal(failed.loading, false)
  assert.match(failed.error, /could not be loaded/)
  assert.equal(getDashboardAccountSnapshot(month), null)
  state.getStats = async () => ({ totalPnl: 75 })
  assert.equal((await loadDashboardAccountData(month)).practiceStats.totalPnl, 75)
})

test('live statistics render before a slow calendar and skip practice discovery', async () => {
  select('tradesea', live.id)
  const calendar = deferred()
  const progress = deferred()
  state.getCalendar = () => calendar.promise
  let complete = false
  const request = loadDashboardAccountData(month, { onProgress: progress.resolve }).then((result) => {
    complete = true
    return result
  })
  const rendered = await progress.promise
  assert.equal(rendered.tradeseaDashboard.totalPnl.value, 450)
  assert.equal(rendered.loading, false)
  assert.equal(rendered.refreshing, true)
  assert.equal(complete, false)
  assert.equal(state.calls.refresh, 0)
  calendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [{ date: '2026-10-12T12:00:00Z', pnl: 450 }] } })
  assert.deepEqual((await request).days, [{ date: '2026-10-12', pnl: 450 }])
})

test('a dashboard return reuses visible live cards before the first calendar finishes', async () => {
  select('tradesea', live.id)
  const calendar = deferred()
  const progress = deferred()
  state.getCalendar = () => { state.calls.calendar += 1; return calendar.promise }
  const first = loadDashboardAccountData(month, { onProgress: progress.resolve })
  await progress.promise
  const snapshot = getDashboardAccountSnapshot(month)
  assert.equal(snapshot?.tradeseaDashboard.totalPnl.value, 450)
  assert.equal(snapshot.loading, false)
  assert.equal(snapshot.refreshing, false)
  const returned = await loadDashboardAccountData(month, { refreshPractice: false })
  assert.equal(returned.tradeseaDashboard.totalPnl.value, 450)
  assert.equal(state.calls.dashboard, 1, 'a recent snapshot can be reused without another statistics download')
  assert.equal(state.calls.calendar, 1)

  calendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [{ date: '2026-10-13', pnl: 90 }] } })
  await first
  assert.deepEqual(getDashboardAccountSnapshot(month).days, [{ date: '2026-10-13', pnl: 90 }])
})

test('practice-only invalidation does not prevent pending live cards or calendar from being cached', async () => {
  select('tradesea', live.id)
  const dashboard = deferred()
  const calendar = deferred()
  const progress = deferred()
  state.getDashboard = () => dashboard.promise
  state.getCalendar = () => calendar.promise
  const request = loadDashboardAccountData(month, { onProgress: progress.resolve })
  await new Promise(setImmediate)
  invalidateDashboardAccountSnapshots('practice')
  dashboard.resolve({ s: 'success', d: { totalPnl: { value: 125 } } })
  await progress.promise
  assert.equal(getDashboardAccountSnapshot(month)?.tradeseaDashboard.totalPnl.value, 125)
  invalidateDashboardAccountSnapshots('practice')
  calendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [{ date: '2026-10-14', pnl: 125 }] } })
  await request
  assert.deepEqual(getDashboardAccountSnapshot(month).days, [{ date: '2026-10-14', pnl: 125 }])
})

test('live invalidation cannot be undone by an older partial or completed response', async () => {
  for (const invalidateBeforeCards of [true, false]) {
    invalidateDashboardAccountSnapshots()
    select('tradesea', live.id)
    const dashboard = deferred()
    const calendar = deferred()
    const progress = deferred()
    state.getDashboard = () => dashboard.promise
    state.getCalendar = () => calendar.promise
    const request = loadDashboardAccountData(month, { onProgress: progress.resolve })
    await new Promise(setImmediate)
    if (invalidateBeforeCards) invalidateDashboardAccountSnapshots('tradesea')
    dashboard.resolve({ s: 'success', d: { totalPnl: { value: 125 } } })
    await progress.promise
    if (!invalidateBeforeCards) invalidateDashboardAccountSnapshots('tradesea')
    assert.equal(getDashboardAccountSnapshot(month), null)
    calendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [] } })
    await request
    assert.equal(getDashboardAccountSnapshot(month), null)
  }
})

test('auth replacement cannot publish or cache an older live dashboard response', async () => {
  select('tradesea', live.id)
  const dashboard = deferred()
  const calendar = deferred()
  let progressCalls = 0
  state.getDashboard = () => dashboard.promise
  state.getCalendar = () => calendar.promise
  const request = loadDashboardAccountData(month, { onProgress: () => { progressCalls += 1 } })
  await new Promise(setImmediate)
  state.token = 'replacement-owner'
  dashboard.resolve({ s: 'success', d: { totalPnl: { value: 125 } } })
  await new Promise(setImmediate)
  assert.equal(progressCalls, 0)
  assert.equal(getDashboardAccountSnapshot(month), null)
  calendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [] } })
  await request
  assert.equal(getDashboardAccountSnapshot(month), null)
  state.token = 'owner'
  assert.equal(getDashboardAccountSnapshot(month), null, 'the obsolete request must not create its partial or completed snapshot')
})

test('calendar failure preserves the main dashboard and its fallback calendar', async () => {
  select('tradesea', live.id)
  state.getCalendar = async () => { throw new Error('calendar offline') }
  state.getDashboard = async () => ({ s: 'success', d: {
    totalPnl: { value: 33 }, pnlAndTradeCountCalendar: [{ date: '2026-10-12', pnl: 33 }],
  } })
  const result = await loadDashboardAccountData(month)
  assert.equal(result.error, '')
  assert.equal(result.tradeseaDashboard.totalPnl.value, 33)
  assert.deepEqual(result.days, [{ date: '2026-10-12', pnl: 33 }])
})

test('live snapshots are scoped to the calendar month and authenticated owner', async () => {
  select('tradesea', live.id)
  await loadDashboardAccountData(month)
  assert.equal(getDashboardAccountSnapshot(month).tradeseaAccount.id, live.id)
  assert.equal(getDashboardAccountSnapshot(new Date(2026, 8, 1)), null)
  state.token = 'other-user'
  assert.equal(getDashboardAccountSnapshot(month), null)
})

test('account change invalidation cannot be undone by an older in-flight response', async () => {
  select('practice', practice.id)
  const pending = deferred()
  state.getStats = () => pending.promise
  const request = loadDashboardAccountData(month, { refreshPractice: false })
  await Promise.resolve()
  invalidateDashboardAccountSnapshots('practice')
  pending.resolve({ totalPnl: 100 })
  await request
  assert.equal(getDashboardAccountSnapshot(month), null)
})

test('an unavailable saved live account falls back to available practice accounts', async () => {
  select('tradesea', 'removed-account')
  const result = await loadDashboardAccountData(month)
  assert.deepEqual(result.selection, { source: 'practice', accountId: practice.id })
})

test('no available account ends the loading state', async () => {
  state.accounts = []
  state.getAccounts = async () => ({ connected: false })
  const result = await loadDashboardAccountData(month)
  assert.equal(result.loading, false)
  assert.equal(result.selection, null)
  assert.match(result.error, /No account/)
})

test('saving the same dashboard selection emits only one change event', () => {
  let events = 0
  const listener = () => { events += 1 }
  window.addEventListener('dashboardAccountChanged', listener)
  saveDashboardAccountSelection({ source: 'practice', accountId: practice.id })
  saveDashboardAccountSelection({ source: 'practice', accountId: practice.id })
  window.removeEventListener('dashboardAccountChanged', listener)
  assert.equal(events, 1)
})

const hookState = {}
globalThis.__dashboardHookTest = hookState
const hookBundle = await build({
  entryPoints: [fileURLToPath(new URL('../../src/hooks/useDashboardAccountData.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'dashboard-hook-test', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'dashboard-hook' }))
    build.onResolve({ filter: /api\/api$/ }, () => ({ path: 'auth', namespace: 'dashboard-hook' }))
    build.onResolve({ filter: /services\/dashboard\/dashboardAccountData$/ }, () => ({ path: 'loader', namespace: 'dashboard-hook' }))
    build.onResolve({ filter: /services\/dashboard\/dashboardReplayData$/ }, () => ({ path: 'replay', namespace: 'dashboard-hook' }))
    build.onLoad({ filter: /.*/, namespace: 'dashboard-hook' }, ({ path }) => ({ contents: path === 'auth'
      ? 'export const getAuthToken = () => globalThis.__dashboardTest.token'
      : path === 'replay' ? `export const DASHBOARD_REPLAY_CHANGED_EVENT = 'replaySessionsChanged'; export const invalidateDashboardReplaySessions = () => {};`
      : path === 'react' ? `
      export const useState = (initial) => {
        const state = globalThis.__dashboardHookTest;
        if (state.value === undefined) state.value = typeof initial === 'function' ? initial() : initial;
        return [state.value, (update) => { state.value = typeof update === 'function' ? update(state.value) : update }];
      };
      export const useRef = (initial) => {
        const state = globalThis.__dashboardHookTest;
        const index = state.refIndex++;
        return state.refs[index] ??= { current: initial };
      };
      export const useEffect = (effect, deps) => {
        const state = globalThis.__dashboardHookTest;
        state.effect = effect;
        state.deps = deps;
      };
    ` : `
      export const emptyDashboardData = () => ({
        selection: null, practiceAccount: null, tradeseaAccount: null,
        practiceStats: {}, tradeseaDashboard: null, days: [],
        loading: true, refreshing: false, error: '',
      });
      export const getDashboardAccountSnapshot = () => globalThis.__dashboardHookTest.snapshot;
      export const invalidateDashboardAccountSnapshots = () => {};
      export const loadDashboardAccountData = (...args) => globalThis.__dashboardHookTest.load(...args);
    ` }))
  } }],
})
const { useDashboardAccountData } = await import(
  `data:text/javascript;base64,${Buffer.from(hookBundle.outputFiles[0].text).toString('base64')}`
)
function mountHook(snapshot = null) {
  hookState.value = undefined
  hookState.refIndex = 0
  hookState.refs = []
  hookState.snapshot = snapshot
  hookState.loads = []
  hookState.load = (_month, options) => {
    const pending = deferred()
    hookState.loads.push({ ...pending, options })
    return pending.promise
  }
  useDashboardAccountData(month)
  return hookState.effect()
}
function hookResult(accountId) {
  return {
    selection: { source: 'practice', accountId }, practiceAccount: { id: accountId },
    tradeseaAccount: null, practiceStats: {}, tradeseaDashboard: null,
    days: [], loading: false, refreshing: false, error: '',
  }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test('switching accounts discards an older dashboard response', async () => {
  select('practice', 'account-a')
  const cleanup = mountHook()
  saveDashboardAccountSelection({ source: 'practice', accountId: 'account-b' })
  assert.equal(hookState.loads.length, 2)
  hookState.loads[1].resolve(hookResult('account-b'))
  await flush()
  hookState.loads[0].resolve(hookResult('account-a'))
  await flush()
  assert.equal(hookState.value.selection.accountId, 'account-b')
  cleanup()
})

test('an automatically persisted fallback does not recursively reload dashboard data', async () => {
  const cleanup = mountHook()
  hookState.loads[0].resolve(hookResult('account-a'))
  await flush()
  assert.equal(hookState.loads.length, 1)
  assert.equal(storage.get('aurenDashboardAccount'), 'practice:account-a')
  cleanup()
})

test('practice change bursts refresh once without rediscovering provider catalogs', async () => {
  select('practice', 'account-a')
  const cleanup = mountHook()
  hookState.loads[0].resolve(hookResult('account-a'))
  await flush()
  for (let index = 0; index < 5; index += 1) window.dispatchEvent(new Event('practiceAccountsChanged'))
  await new Promise((resolve) => setTimeout(resolve, 125))
  assert.equal(hookState.loads.length, 2)
  assert.equal(hookState.loads[1].options.refreshPractice, false)
  assert.equal(hookState.value.loading, false)
  assert.equal(hookState.value.refreshing, true)
  hookState.loads[1].resolve(hookResult('account-a'))
  await flush()
  cleanup()
})

test('replay catalog mutations coalesce financial reloads without refreshing practice catalogs', async () => {
  select('replay', 'replay-a')
  const cleanup = mountHook()
  const replay = { ...hookResult('replay-a'), selection: { source: 'replay', accountId: 'replay-a' } }
  hookState.loads[0].resolve(replay)
  await flush()
  for (let index = 0; index < 5; index += 1) window.dispatchEvent(new Event('replaySessionsChanged'))
  await new Promise((resolve) => setTimeout(resolve, 125))
  assert.equal(hookState.loads.length, 2)
  assert.equal(hookState.loads[1].options.refreshPractice, false)
  assert.equal(hookState.loads[1].options.force, true)
  hookState.loads[1].resolve(replay)
  await flush()
  cleanup()
})

test('effect replay still waits for the initial practice catalog refresh', async () => {
  const cleanup = mountHook()
  cleanup()
  const replayCleanup = hookState.effect()
  assert.equal(hookState.loads[0].options.refreshPractice, true)
  assert.equal(hookState.loads[1].options.refreshPractice, true)
  hookState.loads[0].resolve(hookResult('account-a'))
  hookState.loads[1].resolve(hookResult('account-a'))
  await flush()
  replayCleanup()
})

test('dashboard requests depend on the month values instead of Date object identity', async () => {
  const cleanup = mountHook()
  assert.deepEqual(hookState.deps, [2026, 9])
  hookState.loads[0].resolve(hookResult('account-a'))
  await flush()
  cleanup()
})

test('revisiting the dashboard revalidates statistics while keeping its snapshot visible', async () => {
  select('practice', 'account-a')
  const snapshot = hookResult('account-a')
  snapshot.practiceStats = { totalPnl: 42 }
  const cleanup = mountHook(snapshot)
  assert.equal(hookState.value.practiceStats.totalPnl, 42)
  assert.equal(hookState.value.loading, false)
  assert.equal(hookState.value.refreshing, true)
  assert.equal(hookState.loads[0].options.force, true)
  hookState.loads[0].resolve(hookResult('account-a'))
  await flush()
  cleanup()
})

test('a response from a previous session is neither rendered nor persisted', async () => {
  const cleanup = mountHook()
  state.token = 'new-user'
  hookState.loads[0].resolve(hookResult('old-user-account'))
  await flush()
  assert.equal(hookState.value.selection, null)
  assert.equal(storage.get('aurenDashboardAccount'), undefined)
  cleanup()
})

for (const source of ['practice', 'tradesea']) {
  test(`${source} invalidation starts fresh reads instead of joining and remembering an older pending response`, async () => {
    select(source, source === 'practice' ? practice.id : live.id)
    const previous = deferred()
    const oldCalendar = deferred()
    state.getStats = () => {
      state.calls.stats += 1
      return state.calls.stats === 1 ? previous.promise : Promise.resolve({ totalPnl: 900 })
    }
    state.getDashboard = () => {
      state.calls.dashboard += 1
      return state.calls.dashboard === 1 ? previous.promise : Promise.resolve({ s: 'success', d: { totalPnl: { value: 900 } } })
    }
    state.getCalendar = () => {
      state.calls.calendar += 1
      return state.calls.calendar === 1 ? oldCalendar.promise : Promise.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [{ date: '2026-10-12', pnl: 900 }] } })
    }
    const first = loadDashboardAccountData(month, { refreshPractice: false })
    for (let index = 0; index < 12; index++) await Promise.resolve()
    invalidateDashboardAccountSnapshots(source)
    const refreshed = loadDashboardAccountData(month, { refreshPractice: false, force: true })
    for (let index = 0; index < 12; index++) await Promise.resolve()
    if (source === 'practice') assert.equal(state.calls.stats, 2)
    else {
      assert.equal(state.calls.dashboard, 2)
      assert.equal(state.calls.calendar, 2)
    }
    const fresh = await refreshed
    assert.equal(source === 'practice' ? fresh.practiceStats.totalPnl : fresh.tradeseaDashboard.totalPnl.value, 900)
    previous.resolve(source === 'practice' ? { totalPnl: 1 } : { s: 'success', d: { totalPnl: { value: 1 } } })
    oldCalendar.resolve({ s: 'success', d: { pnlAndTradeCountCalendar: [{ date: '2026-10-12', pnl: 1 }] } })
    await first
    const snapshot = getDashboardAccountSnapshot(month)
    assert.equal(source === 'practice' ? snapshot.practiceStats.totalPnl : snapshot.tradeseaDashboard.totalPnl.value, 900,
      'a pre-invalidation result cannot acquire the newer load revision and replace fresh statistics')
    if (source === 'tradesea') assert.equal(snapshot.days[0].pnl, 900)
  })
}
