import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

process.env.TZ = 'America/New_York'
const state = { token: 'replay-owner' }
globalThis.__replayDashboardTest = state
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
}
globalThis.window = new EventTarget()
const mocks = {
  'api/api': 'export const getAuthToken = () => globalThis.__replayDashboardTest.token;',
  'api/backtester.api': `export const backtesterAPI = {
    getSessions: (...args) => globalThis.__replayDashboardTest.sessions(...args),
    getTrades: (...args) => globalThis.__replayDashboardTest.trades(...args),
    getSymbolData: (...args) => globalThis.__replayDashboardTest.symbols(...args),
    getSessionStats: (...args) => globalThis.__replayDashboardTest.balances(...args),
  };`,
  'api/practice.api': 'export const practiceAPI = { getStats: (...args) => globalThis.__replayDashboardTest.practiceStats(...args) };',
  'api/tradesea.api': `export const tradeseaAPI = {
    getAccounts: (...args) => globalThis.__replayDashboardTest.liveAccounts(...args),
    getTradelensCalendar: () => { throw new Error('Unexpected live calendar'); },
    getTradelensTrades: () => { throw new Error('Unexpected live trades'); },
  };`,
  'constants/practice': `export const PRACTICE_STORAGE_KEYS = { ACTIVE_TRADE_ID: 'activePractice' };
    export const getPracticeAccounts = () => globalThis.__replayDashboardTest.practiceAccounts;
    export const refreshPracticeFromApi = async () => { globalThis.__replayDashboardTest.calls.push(['practice-catalog']); };`,
}
const bundle = await build({
  stdin: {
    contents: `export * from './src/services/dashboard/dashboardReplayData.ts';
      export * from './src/services/dashboard/dashboardAccountData.ts';
      export * from './src/services/dashboard/dashboardDayDetails.ts';`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'replay-dashboard-read-boundaries', setup(builder) {
    builder.onResolve({ filter: /(?:api\/api|api\/(?:backtester|practice|tradesea)\.api|constants\/practice)$/ }, ({ path }) => {
      const key = Object.keys(mocks).find((key) => path.endsWith(key))
      return key ? { path: key, namespace: 'replay-dashboard-test' } : undefined
    })
    builder.onLoad({ filter: /.*/, namespace: 'replay-dashboard-test' }, ({ path }) => ({ contents: mocks[path] }))
  } }],
})
const {
  loadDashboardReplaySessions, invalidateDashboardReplaySessions, loadDashboardReplayData,
  loadDashboardAccountData, invalidateDashboardAccountSnapshots, getDashboardAccountSnapshot,
  loadDashboardDayDetails,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const session = { id: 'replay-a', name: 'Morning replay', startDate: '2020-01-02', startTime: '09:30', symbol: 'MNQ', timeframe: '1m', createdAt: '2026-10-28' }
const seconds = (value) => Date.parse(value) / 1000
const row = (patch = {}) => ({
  id: 'fill-1', session_id: session.id, symbol: 'MNQ', direction: 'long',
  entry_price: 20000, exit_price: 20010, contracts: 2,
  entry_time: seconds('2020-01-02T23:55:00-05:00'),
  exit_time: seconds('2020-01-03T00:05:00-05:00'), ...patch,
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { resolve, promise }
}
beforeEach(() => {
  state.token = 'replay-owner'
  invalidateDashboardReplaySessions()
  invalidateDashboardAccountSnapshots()
  storage.clear()
  state.calls = []
  state.rows = [row()]
  state.catalog = [session]
  state.practiceAccounts = [{ id: 'practice-a', updatedAt: 'now', dayPnL: [] }]
  state.sessions = async () => { state.calls.push(['sessions']); return { success: true, sessions: state.catalog } }
  state.trades = async (params) => { state.calls.push(['trades', params]); return { success: true, trades: state.rows } }
  state.symbols = async () => { state.calls.push(['symbols']); return { success: true, symbols: { MNQ: { tickSize: 0.25, tickValue: 0.5, totalFees: 1.5 } } } }
  state.balances = async (id) => { state.calls.push(['balance', id]); return { success: true, balance: 50123, initialBalance: 50000, realizedPnL: 999999, unrealizedPnL: 0 } }
  state.liveAccounts = async () => { state.calls.push(['live-catalog']); return { connected: false } }
  state.practiceStats = async () => ({ totalTrades: 0, totalPnl: 0 })
})

test('replay normalizes gross P&L and per-contract fees once, preserving signed short quantities', async () => {
  state.rows = [row(), row({ id: 'short', direction: 'SHORT', entry_price: 20010, exit_price: 20000, contracts: -1 })]
  const result = await loadDashboardReplayData(session)
  assert.equal(result.stats.totalTrades, 2)
  assert.equal(result.stats.winRate, 100)
  assert.deepEqual(result.stats.trades.map((trade) => [trade.pnl, trade.fees, trade.contracts]), [[40, 3, 2], [20, 1.5, 1]])
  assert.deepEqual(result.dayTrades.map((trade) => trade.netPnl), [37, 18.5])
  assert.equal(result.stats.totalPnl, 123, 'lifetime profit uses actual balances, not date-scoped realizedPnL')
  assert.deepEqual(result.days, [{ date: '2020-01-03', pnl: 55.5 }])
  assert.equal(result.detailsStatus, 'available')
  assert.deepEqual(state.calls.find(([name]) => name === 'trades')[1], { sessionId: session.id })
})

test('reported zero balances and zero fees remain real values', async () => {
  state.balances = async () => ({ success: true, balance: 0, initialBalance: 50000 })
  state.symbols = async () => ({ success: true, symbols: { MNQ: { tickSize: 0.25, tickValue: 0.5, totalFees: 0 } } })
  const result = await loadDashboardReplayData(session)
  assert.equal(result.balance, 0)
  assert.equal(result.stats.totalPnl, -50000)
  assert.equal(result.dayTrades[0].fees, 0)
  assert.equal(result.dayTrades[0].netPnl, 40)
})

test('open rows and accidentally mixed-session rows never become closed replay results', async () => {
  state.rows = [row(), row({ id: 'open', exit_price: null, exit_time: null }), row({ id: 'other', session_id: 'other-session' })]
  const result = await loadDashboardReplayData(session)
  assert.equal(result.stats.totalTrades, 1)
  assert.equal(result.dayTrades.length, 1)
})

test('missing tick or fee metadata leaves net amounts unavailable rather than inventing dollars', async () => {
  state.symbols = async () => ({ success: true, symbols: {} })
  const result = await loadDashboardReplayData(session)
  assert.equal(result.stats.winRate, undefined)
  assert.equal(result.stats.totalTrades, 1)
  assert.equal(result.dayTrades[0].netPnl, null)
  assert.equal(result.dayTrades[0].fees, null)
  assert.deepEqual(result.stats.trades, [])
  assert.deepEqual(result.days, [])
  assert.equal(result.detailsStatus, 'partial')
  const day = await loadDashboardDayDetails({ source: 'replay', accountId: session.id }, '2020-01-03')
  assert.equal(day.netPnl, null)
  assert.equal(day.winRate, null)
  assert.equal(day.totalTrades, 1)
})

test('replay day drilldown uses closed EXIT local calendar date across midnight with no history restriction', async () => {
  const selection = { source: 'replay', accountId: session.id }
  const prior = await loadDashboardDayDetails(selection, '2020-01-02', { dateBasis: 'practice-session' })
  assert.equal(prior.totalTrades, 0)
  assert.equal(prior.netPnl, 0)
  const day = await loadDashboardDayDetails(selection, '2020-01-03', { dateBasis: 'practice-session' })
  assert.equal(day.netPnl, 37)
  assert.equal(day.totalFees, 3)
  assert.equal(day.totalTrades, 1)
  assert.equal(day.trades[0].entryTime, '2020-01-03T04:55:00.000Z')
  assert.equal(day.trades[0].exitTime, '2020-01-03T05:05:00.000Z')
  assert.equal(day.detailsStatus, 'available')
})

test('an unavailable replay trades endpoint preserves balance but leaves trade metrics unknown', async () => {
  state.trades = async () => { throw new Error('Offline') }
  const result = await loadDashboardReplayData(session)
  assert.equal(result.balance, 50123)
  assert.equal(result.stats.totalPnl, 123)
  assert.equal(result.stats.totalTrades, undefined)
  assert.equal(result.stats.winRate, undefined)
  const day = await loadDashboardDayDetails({ source: 'replay', accountId: session.id }, '2020-01-03')
  assert.equal(day.netPnl, null)
  assert.equal(day.totalTrades, null)
  assert.equal(day.detailsStatus, 'unavailable')
})

test('malformed closed timestamps cannot manufacture an empty-day zero result', async () => {
  state.rows = [row({ exit_time: null })]
  const result = await loadDashboardReplayData(session)
  assert.equal(result.stats.totalTrades, 1)
  assert.deepEqual(result.days, [])
  assert.equal(result.detailsStatus, 'partial')
  const day = await loadDashboardDayDetails({ source: 'replay', accountId: session.id }, '2020-01-03')
  assert.equal(day.netPnl, null)
  assert.equal(day.totalTrades, null)
})

test('a selected replay account loads independently of practice or connected account catalogs', async () => {
  storage.set('aurenDashboardAccount', `replay:${session.id}`)
  state.liveAccounts = () => { throw new Error('Unexpected live catalog') }
  const result = await loadDashboardAccountData(new Date(2026, 9, 1))
  assert.equal(result.selection.source, 'replay')
  assert.equal(result.replaySession.id, session.id)
  assert.equal(result.replayBalance, 50123)
  assert.equal(result.replayInitialBalance, 50000)
  assert.equal(result.replayStats.totalTrades, 1)
  assert.equal(result.practiceAccount, null)
  assert.equal(result.tradeseaAccount, null)
  assert.ok(!state.calls.some(([name]) => name === 'practice-catalog'))
})

test('a replay catalog error preserves selection while a genuinely deleted session falls back', async () => {
  storage.set('aurenDashboardAccount', `replay:${session.id}`)
  state.sessions = async () => { throw new Error('Offline') }
  const failed = await loadDashboardAccountData(new Date(2026, 9, 1))
  assert.equal(failed.selection.source, 'replay')
  assert.match(failed.error, /Replay sessions could not be loaded/)
  assert.ok(!state.calls.some(([name]) => name === 'practice-catalog'))
  state.sessions = async () => ({ success: true, sessions: [] })
  const removed = await loadDashboardAccountData(new Date(2026, 9, 1))
  assert.deepEqual(removed.selection, { source: 'practice', accountId: 'practice-a' })
})

test('replay snapshots reuse closed statistics across month navigation and invalidate independently', async () => {
  storage.set('aurenDashboardAccount', `replay:${session.id}`)
  const month = new Date(2026, 9, 1)
  await loadDashboardAccountData(month)
  await loadDashboardAccountData(new Date(2026, 8, 1))
  assert.equal(state.calls.filter(([name]) => name === 'trades').length, 1)
  invalidateDashboardAccountSnapshots('replay')
  await loadDashboardAccountData(month)
  assert.equal(state.calls.filter(([name]) => name === 'trades').length, 2)
})

test('replay catalog caching is bounded by owner and explicit invalidation', async () => {
  await loadDashboardReplaySessions()
  await loadDashboardReplaySessions()
  assert.equal(state.calls.filter(([name]) => name === 'sessions').length, 1)
  state.token = 'new-owner'
  await loadDashboardReplaySessions()
  assert.equal(state.calls.filter(([name]) => name === 'sessions').length, 2)
  invalidateDashboardReplaySessions()
  await loadDashboardReplaySessions()
  assert.equal(state.calls.filter(([name]) => name === 'sessions').length, 3)
})

test('auth replacement or abort cannot publish completed replay statistics or cache them', async () => {
  storage.set('aurenDashboardAccount', `replay:${session.id}`)
  const pending = deferred()
  state.trades = () => pending.promise
  const request = loadDashboardReplayData(session)
  state.token = 'new-owner'
  pending.resolve({ success: true, trades: state.rows })
  await assert.rejects(request, { name: 'AbortError' })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(loadDashboardReplayData(session, { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(getDashboardAccountSnapshot(new Date(2026, 9, 1)), null)
})
