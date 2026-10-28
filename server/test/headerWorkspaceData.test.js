import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  stdin: {
    contents: `export * from './src/services/dashboard/headerWorkspaceData.ts'; export { publishAuthEvent } from './src/services/auth/authEvents.ts';`,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'header-metadata-boundaries', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/(?:api\/api|api\/tradesea\.api|constants\/practice)$/ }, ({ path }) => ({ path, namespace: 'header-data-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'header-data-test' }, ({ path }) => ({ contents:
      path.endsWith('/api/api') ? 'export const getAuthToken = () => globalThis.__headerData.token;' :
      path.endsWith('tradesea.api') ? `export const tradeseaAPI = { getConnectionStatus: () => {
        const state = globalThis.__headerData; state.statusReads++; return state.loadStatus();
      } };` : `
        export const PRACTICE_STORAGE_KEYS = { MARKET_DATA: 'practiceMarketData', ACCOUNTS: 'practiceAccounts_v1', ACTIVE_TRADE_ID: 'practiceActiveTradeAccountId' };
        export const getPracticeMarketDataSettings = () => globalThis.__headerData.settings;
        export const getPracticePropFirmConfig = (id) => ({ id, displayName: id === 'tradesea' ? 'Tradesea' : 'TradingView' });
        export const refreshPracticeFromApi = (options) => { const state = globalThis.__headerData; state.practiceOptions.push(options); state.practiceReads++; return state.loadPractice(); };
      `
    }))
  } }],
})
const {
  refreshHeaderPracticeCatalog, loadHeaderProviderStatus, subscribeHeaderWorkspaceData,
  invalidateHeaderWorkspaceData, publishAuthEvent,
} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
let sequence = 0
function fixture(t) {
  const previous = { state: globalThis.__headerData, window: globalThis.window }
  const state = {
    token: `header-user-${++sequence}`, practiceReads: 0, statusReads: 0, practiceOptions: [], cleanups: [],
    settings: { propFirmId: 'tradesea', accountId: 'market-a', accountLabel: 'Market A' },
    loadStatus: async () => ({ connected: true, token: 'must-not-retain', email: 'private@example.com' }),
    loadPractice: async () => {},
  }
  globalThis.__headerData = state
  globalThis.window = new EventTarget()
  t.after(() => {
    for (const cleanup of state.cleanups) cleanup()
    invalidateHeaderWorkspaceData()
    globalThis.__headerData = previous.state
    globalThis.window = previous.window
  })
  return state
}
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve() }
async function loadHeader() { await Promise.all([refreshHeaderPracticeCatalog(), loadHeaderProviderStatus('tradesea')]) }

test('seven mounted navigation headers reuse one display catalog refresh and one sanitized status read', async (t) => {
  const state = fixture(t)
  await Promise.all([loadHeader(), loadHeader()])
  for (let index = 0; index < 5; index++) await loadHeader()
  assert.equal(state.practiceReads, 1)
  assert.equal(state.statusReads, 1)
  assert.deepEqual(state.practiceOptions, [{ strict: true }])
  assert.deepEqual(await loadHeaderProviderStatus('tradesea'), { label: 'Tradesea connected', connected: true })
})

test('navigation metadata expires at 30 seconds without turning a failed status read into a cached disconnect', async (t) => {
  const state = fixture(t)
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 })
  await loadHeader()
  t.mock.timers.setTime(Date.now() + 30_001)
  await loadHeader()
  assert.equal(state.practiceReads, 2)
  assert.equal(state.statusReads, 2)
  invalidateHeaderWorkspaceData()
  state.loadStatus = async () => { throw new Error('offline') }
  await assert.rejects(loadHeaderProviderStatus('tradesea'), /offline/)
  state.loadStatus = async () => ({ connected: false })
  assert.deepEqual(await loadHeaderProviderStatus('tradesea'), { label: 'Tradesea disconnected', connected: false })
  assert.equal(state.statusReads, 4)
})

test('one mutation event invalidates once for both a visible and retained header', async (t) => {
  const state = fixture(t)
  const refresh = () => { void loadHeader() }
  const first = subscribeHeaderWorkspaceData(refresh)
  const second = subscribeHeaderWorkspaceData(refresh)
  state.cleanups.push(first, second)
  await loadHeader()
  window.dispatchEvent(new Event('refreshPropFirms'))
  await flush()
  assert.equal(state.practiceReads, 2)
  assert.equal(state.statusReads, 2)
  // Practice WS balance updates emit both settings/accounts events. They do
  // not change the market-data selection and must not trigger more HTTP reads.
  window.dispatchEvent(new Event('practiceSettingsChanged'))
  window.dispatchEvent(new Event('practiceAccountsChanged'))
  await flush()
  assert.equal(state.practiceReads, 2)
  assert.equal(state.statusReads, 2)
  state.settings = { ...state.settings, accountId: 'market-b' }
  window.dispatchEvent(new Event('practiceSettingsChanged'))
  await flush()
  assert.equal(state.practiceReads, 3)
  assert.equal(state.statusReads, 3)
})

test('storage mutations and explicit logout invalidate navigation metadata without logged-out API requests', async (t) => {
  const state = fixture(t)
  const unsubscribe = subscribeHeaderWorkspaceData(() => { void loadHeader() })
  state.cleanups.push(unsubscribe)
  await loadHeader()
  const event = new Event('storage')
  Object.defineProperty(event, 'key', { value: 'practiceMarketData' })
  window.dispatchEvent(event)
  await flush()
  assert.equal(state.practiceReads, 2)
  assert.equal(state.statusReads, 2)
  state.token = null
  publishAuthEvent({ kind: 'token-change' })
  await flush()
  assert.equal(state.practiceReads, 2)
  assert.equal(state.statusReads, 2)
  state.token = 'replacement-login'
  publishAuthEvent({ kind: 'token-change' })
  await flush()
  assert.equal(state.practiceReads, 3)
  assert.equal(state.statusReads, 3)
})

test('a status response from the previous login cannot populate the replacement user cache', async (t) => {
  const state = fixture(t)
  let finish
  state.loadStatus = () => new Promise((resolve) => { finish = resolve })
  const old = loadHeaderProviderStatus('tradesea')
  const discarded = assert.rejects(old, { name: 'AbortError' })
  await flush()
  state.token = 'new-owner'
  state.loadStatus = async () => ({ connected: false })
  await loadHeaderProviderStatus('tradesea')
  finish({ connected: true })
  await discarded
  assert.equal((await loadHeaderProviderStatus('tradesea')).connected, false)
  assert.equal(state.statusReads, 2)
})

test('a failed strict practice label refresh is retryable immediately instead of being remembered for 30 seconds', async (t) => {
  const state = fixture(t)
  state.loadPractice = async () => { throw new Error('practice catalog offline') }
  await assert.rejects(refreshHeaderPracticeCatalog(), /offline/)
  state.loadPractice = async () => {}
  await refreshHeaderPracticeCatalog()
  assert.equal(state.practiceReads, 2)
})
