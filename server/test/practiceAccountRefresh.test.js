import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/constants/practice.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'practice-refresh-boundaries', setup(builder) {
    builder.onResolve({ filter: /api\/(api|practice\.api)$/ }, ({ path }) => ({ path, namespace: 'practice-refresh-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'practice-refresh-test' }, ({ path }) => ({ contents: path.endsWith('practice.api')
      ? `export const practiceAPI = new Proxy({}, { get: (_, method) => (...args) => {
          const state = globalThis.__practiceRefresh;
          state.calls.push({ method, owner: state.token, args });
          return state.api[method](...args);
        } });`
      : 'export const getAuthToken = () => globalThis.__practiceRefresh.token;',
    }))
  } }],
})

let state
let practice
let previous
let instance = 0
const settings = (id) => ({ propFirmId: 'tradesea', accountId: id, accountLabel: id })
const account = (id) => ({ id, mode: 'eval', size: 50_000, rules: { startingBalance: 50_000 } })
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const flush = () => new Promise(setImmediate)
const calls = (method) => state.calls.filter((call) => call.method === method)

beforeEach(async () => {
  previous = { fixture: globalThis.__practiceRefresh, localStorage: globalThis.localStorage, window: globalThis.window }
  const storage = new Map([['practiceMigratedToApi_v1', '1']])
  state = { token: 'owner-a', storage, calls: [], notifications: 0, api: {} }
  state.api = {
    getMarketData: async () => ({ success: true, settings: settings(state.token) }),
    listAccounts: async () => ({ success: true, accounts: [account(state.token)] }),
    saveMarketData: async () => ({ success: true }),
    createAccount: async () => ({ success: true, account: account(state.token) }),
    deleteAllAccounts: async () => ({ success: true }),
  }
  globalThis.__practiceRefresh = state
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  }
  globalThis.window = new EventTarget()
  window.addEventListener('practiceAccountsChanged', () => { state.notifications += 1 })
  const source = `${bundled.outputFiles[0].text}\n// fresh practice cache ${++instance}`
  practice = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
})
afterEach(() => {
  globalThis.__practiceRefresh = previous.fixture
  globalThis.localStorage = previous.localStorage
  globalThis.window = previous.window
})

test('strict refresh rejects failed reads and immediately retries instead of marking fallback as successful', async () => {
  state.api.getMarketData = async () => { throw new Error('offline') }
  await assert.rejects(practice.refreshPracticeFromApi({ strict: true }), /offline/)
  state.api.getMarketData = async () => ({ success: true, settings: settings('fresh') })
  await practice.refreshPracticeFromApi({ strict: true })
  assert.equal(calls('getMarketData').length, 2)
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'fresh')

  for (const failed of ['getMarketData', 'listAccounts']) {
    const original = state.api[failed]
    state.api[failed] = async () => ({ success: false })
    await assert.rejects(practice.refreshPracticeFromApi({ strict: true }), /could not be loaded/)
    state.api[failed] = original
    await practice.refreshPracticeFromApi({ strict: true })
  }
  assert.equal(calls('listAccounts').length, 6)
})

test('same-owner normal and strict consumers join one read while preserving their failure behavior', async () => {
  const pending = deferred()
  state.api.getMarketData = () => pending.promise
  const normal = practice.refreshPracticeFromApi({ notify: true })
  const strict = assert.rejects(practice.refreshPracticeFromApi({ strict: true }), /offline/)
  await flush()
  assert.equal(calls('getMarketData').length, 1)
  assert.equal(calls('listAccounts').length, 1)
  pending.reject(new Error('offline'))
  await Promise.all([normal, strict])
  assert.equal(state.notifications, 1, 'the normal caller retains its fallback notification')
})

test('a superseded owner cannot overwrite caches or clear the newer owner pending request', async () => {
  const first = { md: deferred(), accounts: deferred() }
  const second = { md: deferred(), accounts: deferred() }
  state.api.getMarketData = () => state.token === 'owner-a' ? first.md.promise : second.md.promise
  state.api.listAccounts = () => state.token === 'owner-a' ? first.accounts.promise : second.accounts.promise
  const old = practice.refreshPracticeFromApi({ notify: true })
  await flush()
  state.token = 'owner-b'
  assert.deepEqual(practice.getPracticeAccounts(), [])
  assert.equal(practice.getPracticeMarketDataSettings().accountId, '')
  const current = practice.refreshPracticeFromApi({ strict: true })
  await flush()
  first.md.resolve({ success: true, settings: settings('old-a') })
  first.accounts.resolve({ success: true, accounts: [account('old-a')] })
  await old
  const joined = practice.refreshPracticeFromApi({ strict: true })
  await flush()
  assert.equal(calls('getMarketData').length, 2, 'cleanup of A must leave B available for joining')
  assert.equal(state.notifications, 0, 'A must not notify B about its stale response')
  assert.deepEqual(practice.getPracticeAccounts(), [])
  second.md.resolve({ success: true, settings: settings('current-b') })
  second.accounts.resolve({ success: true, accounts: [account('current-b')] })
  await Promise.all([current, joined])
  assert.equal(practice.getPracticeAccounts()[0].id, 'current-b')
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'current-b')
})

test('a late old-owner failure cannot replace the current owner cache with local fallback', async () => {
  state.storage.set('practiceAccounts_v1', JSON.stringify([account('local-a')]))
  const first = deferred()
  state.api.getMarketData = () => state.token === 'owner-a' ? first.promise : Promise.resolve({ success: true, settings: settings('current-b') })
  const old = practice.refreshPracticeFromApi()
  await flush()
  state.token = 'owner-b'
  await practice.refreshPracticeFromApi({ strict: true })
  first.reject(new Error('late A offline'))
  await old
  assert.equal(practice.getPracticeAccounts()[0].id, 'owner-b')
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'current-b')
})

test('getters immediately hide a previous owner cache and its known legacy rows', async () => {
  state.storage.set('practiceAccounts_v1', JSON.stringify([account('local-a')]))
  await practice.refreshPracticeFromApi({ strict: true })
  assert.equal(practice.getPracticeAccounts()[0].id, 'owner-a')
  state.token = 'owner-b'
  assert.deepEqual(practice.getPracticeAccounts(), [])
  assert.equal(practice.getPracticeMarketDataSettings().accountId, '')
})

test('default callers preserve offline local fallback and unsuccessful-response behavior', async () => {
  state.storage.set('practiceAccounts_v1', JSON.stringify([account('local-a')]))
  state.storage.set('practiceMarketData', JSON.stringify(settings('local-market')))
  await practice.refreshPracticeFromApi()
  state.api.getMarketData = async () => { throw new Error('offline') }
  await practice.refreshPracticeFromApi({ notify: true })
  assert.equal(practice.getPracticeAccounts()[0].id, 'local-a')
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'local-market')
  assert.equal(state.notifications, 1)
  state.api.getMarketData = async () => ({ success: false })
  state.api.listAccounts = async () => ({ success: false })
  await practice.refreshPracticeFromApi()
  assert.equal(practice.getPracticeAccounts()[0].id, 'local-a')
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'local-market')
})

test('legacy migration stops on owner change without creating later rows or deleting original local data', async () => {
  state.storage.delete('practiceMigratedToApi_v1')
  const legacy = [account('legacy-one'), account('legacy-two')]
  state.storage.set('practiceAccounts_v1', JSON.stringify(legacy))
  const firstCreate = deferred()
  state.api.createAccount = () => firstCreate.promise
  const old = practice.refreshPracticeFromApi()
  await flush()
  assert.equal(calls('createAccount').length, 1)
  state.token = 'owner-b'
  await practice.refreshPracticeFromApi({ strict: true })
  firstCreate.resolve({ success: true, account: account('legacy-one') })
  await old
  assert.equal(calls('createAccount').length, 1)
  assert.equal(state.storage.get('practiceMigratedToApi_v1'), undefined)
  assert.deepEqual(JSON.parse(state.storage.get('practiceAccounts_v1')), legacy)
  assert.equal(practice.getPracticeAccounts()[0].id, 'owner-b')
  assert.equal(calls('getMarketData').length, 1, 'old migration must not start reads using B credentials')
})

test('a late reset completion cannot clear a replacement owner account list', async () => {
  const deletion = deferred()
  state.api.deleteAllAccounts = () => deletion.promise
  await practice.refreshPracticeFromApi()
  const oldReset = practice.resetAllPracticeAccounts()
  state.token = 'owner-b'
  await practice.refreshPracticeFromApi({ strict: true })
  deletion.resolve({ success: true })
  await oldReset
  assert.equal(practice.getPracticeAccounts()[0].id, 'owner-b')
  assert.equal(state.notifications, 0)
})

test('a late market-data save does not start a replacement owner refresh or notify it', async () => {
  await practice.refreshPracticeFromApi()
  const save = deferred()
  state.api.saveMarketData = () => save.promise
  const oldSave = practice.savePracticeMarketDataSettings(settings('old-a-selection'))
  state.token = 'owner-b'
  await practice.refreshPracticeFromApi({ strict: true })
  save.resolve({ success: true })
  await oldSave
  assert.equal(calls('getMarketData').length, 2)
  assert.equal(practice.getPracticeAccounts()[0].id, 'owner-b')
  assert.equal(practice.getPracticeMarketDataSettings().accountId, 'owner-b')
  assert.equal(state.notifications, 0)
})
