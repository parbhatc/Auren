import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import ts from 'typescript'

const entry = fileURLToPath(new URL('../../src/propfirms/tradesea/TradeseaPropFirm.ts', import.meta.url))
const source = await readFile(entry, 'utf8')
const ast = ts.createSourceFile(entry, source, ts.ScriptTarget.Latest, true)
const imports = new Map()
for (const statement of ast.statements) {
  if (!ts.isImportDeclaration(statement)) continue
  const clause = statement.importClause
  const names = clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
    ? clause.namedBindings.elements.map((item) => item.propertyName?.text ?? item.name.text) : []
  const previous = imports.get(statement.moduleSpecifier.text)
  imports.set(statement.moduleSpecifier.text, {
    names: [...new Set([...(previous?.names ?? []), ...names])],
    hasDefault: Boolean(clause?.name) || Boolean(previous?.hasDefault),
  })
}
const constructors = new Set([
  'TradeseaMdsClient', 'TradeseaTradesClient', 'TradeseaDatafeed', 'PracticeTradeHandler', 'TradeseaTradeHandler',
])
const bundled = await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'adapter-lifecycle-dependencies', setup(build) {
    build.onResolve({ filter: /.*/ }, ({ path, kind }) => kind === 'entry-point' ? undefined : {
      path, namespace: 'adapter-test',
    })
    build.onLoad({ filter: /.*/, namespace: 'adapter-test' }, ({ path }) => {
      const dependency = imports.get(path)
      if (!dependency) throw new Error(`Unexpected adapter dependency: ${path}`)
      const declarations = dependency.names.map((name) => {
        if (name === 'PropFirmBase') return 'export class PropFirmBase {}'
        if (name === 'tradeseaAPI' || name === 'propsAPI') {
          return `export const ${name} = new Proxy({}, { get: (_, key) => (...args) => globalThis.__adapterTest[key](...args) })`
        }
        if (constructors.has(name)) return `export class ${name} {
          constructor() { globalThis.__adapterTest.constructed.push('${name}') }
          disconnect() {}
          dispose() {}
        }`
        return `export const ${name} = (...args) => globalThis.__adapterTest['${name}']?.(...args)`
      })
      if (dependency.hasDefault) declarations.push('export default { createElement() {} }')
      return { contents: declarations.join('\n') }
    })
  } }],
})
const { TradeseaPropFirm } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const state = {}
globalThis.__adapterTest = state
const market = { id: 'practice-market', label: 'Practice market' }
const live = { id: 'live-current', label: 'Current live account' }
const simulated = { id: 'simulated', status: 'active', marketDataAccountId: market.id }
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  for (const key of Object.keys(state)) delete state[key]
  Object.assign(state, {
    constructed: [], saves: [], connects: [],
    getPracticeAccountById: () => simulated,
    getPracticeSettings: () => ({ accountId: market.id, accountLabel: market.label }),
    getPracticeAccountDisplayTitle: () => 'Simulated account',
    updateFirmMarketDataSelection: (_settings, _firm, selection) => selection,
    savePracticeMarketDataSettings: async (settings) => { state.saves.push(settings) },
    getTradeTradeseaAccount: () => ({ accountId: live.id }),
    saveTradeTradeseaAccount: (...args) => state.saves.push(args),
    prepareTradeseaChartServices: async (...args) => { state.connects.push(args); throw new Error('Unexpected stream connection') },
    getAuthToken: () => 'current-auth',
  })
})
function beginCurrentLiveState(firm) {
  firm.setPracticeMode(false)
  firm.selectedAccountId = live.id
  firm.accounts = [live]
  firm.formattedAccounts = [{ account: live }]
  firm.accountsLoading = true
  let notifications = 0
  firm.setOnDataReady(() => { notifications += 1 })
  return () => {
    assert.equal(firm.selectedAccountId, live.id)
    assert.deepEqual(firm.accounts, [live])
    assert.equal(firm.practiceTradeHandler, null)
    assert.equal(firm.accountsLoading, true, 'a stale finally must not clear the new bootstrap loading flag')
    assert.equal(notifications, 0)
    assert.deepEqual(state.saves, [])
    assert.deepEqual(state.connects, [])
  }
}

for (const withSimulation of [false, true]) {
  test(`a late ${withSimulation ? 'simulated' : 'market-only'} practice catalog cannot overwrite Live after a mode switch`, async () => {
    const catalog = deferred()
    const started = deferred()
    state.getAccounts = () => { started.resolve(); return catalog.promise }
    const firm = new TradeseaPropFirm()
    firm.setPracticeMode(true, market.id, market.label, withSimulation ? simulated.id : undefined)
    const pending = firm.onValidateSuccess()
    await started.promise
    const assertCurrentState = beginCurrentLiveState(firm)
    catalog.resolve({ connected: true, accounts: [market] })
    await pending
    assertCurrentState()
    assert.equal(state.constructed.includes('PracticeTradeHandler'), false)
  })
}

test('a late practice settings save cannot restart practice streams after entering Live', async () => {
  const saving = deferred()
  const started = deferred()
  state.getPracticeSettings = () => ({ accountId: 'old-market', accountLabel: 'Old market' })
  state.getAccounts = async () => ({ connected: true, accounts: [market] })
  state.savePracticeMarketDataSettings = () => { started.resolve(); return saving.promise }
  const firm = new TradeseaPropFirm()
  firm.setPracticeMode(true, market.id, market.label, simulated.id)
  const pending = firm.onValidateSuccess()
  await started.promise
  const assertCurrentState = beginCurrentLiveState(firm)
  saving.resolve()
  await pending
  assertCurrentState()
  assert.equal(state.constructed.includes('PracticeTradeHandler'), false)
})

test('a late live catalog cannot overwrite a replacement bootstrap after cleanup', async () => {
  const catalog = deferred()
  const started = deferred()
  state.getAccounts = () => { started.resolve(); return catalog.promise }
  const firm = new TradeseaPropFirm()
  const pending = firm.onValidateSuccess()
  await started.promise
  firm.cleanup()
  const assertCurrentState = beginCurrentLiveState(firm)
  catalog.resolve({ connected: true, accounts: [{ id: 'old-live', label: 'Old live account' }] })
  await pending
  assertCurrentState()
})

test('cold Live startup uses authoritative accounts without a credential or connection preflight', async () => {
  let accountReads = 0
  state.getPropFirm = () => { throw new Error('Live must not fetch credentials before accounts') }
  state.getConnectionStatus = () => { throw new Error('Accounts already verifies the provider session') }
  state.getAccounts = async () => {
    accountReads += 1
    return { connected: true, accounts: [market, live], defaultAccountId: market.id }
  }
  const datafeed = { setTradeHandler() {} }
  state.prepareTradeseaChartServices = async (accountId) => {
    state.connects.push(accountId)
    return { accountId, datafeed, streamConfig: {} }
  }
  const firm = new TradeseaPropFirm()
  firm.getHandler = () => null
  // Starting a new lease must refresh an old catalog, while the chosen saved
  // account still wins over the provider's default selection.
  firm.accountsFetched = true
  firm.accounts = [{ id: 'stale-account', label: 'Old account' }]
  firm.formattedAccounts = [{ account: firm.accounts[0] }]
  await firm.initializeLiveTrade()
  assert.equal(accountReads, 1)
  assert.deepEqual(firm.accounts, [market, live])
  assert.equal(firm.selectedAccountId, live.id)
  assert.equal(firm.chartServices.datafeed, datafeed)
  assert.equal(firm.streamsReady, true)
  assert.equal(firm.accountsLoading, false)
  assert.deepEqual(state.connects, [live.id])
})

for (const outcome of [
  { connected: false, message: 'Market data is not connected. Connect in Settings → Market data.', type: 'no_prop_firm' },
  { connected: false, sessionExpired: true, message: 'Market data session expired. Reconnect in Settings → Market data.', type: 'token_expired' },
  { connected: true, accounts: [], message: 'No supported accounts are available.', type: 'no_accounts' },
]) {
  test(`Live account bootstrap preserves the ${outcome.type} error without starting streams`, async () => {
    state.getAccounts = async () => outcome
    const firm = new TradeseaPropFirm()
    await assert.rejects(firm.initializeLiveTrade(), { message: outcome.message, type: outcome.type })
    assert.equal(firm.accountsFetched, false)
    assert.equal(firm.accountsLoading, false)
    assert.equal(firm.streamsReady, false)
    assert.deepEqual(state.connects, [])
  })
}

test('a superseded authoritative Live bootstrap cannot select accounts or start streams', async () => {
  const catalog = deferred()
  const started = deferred()
  state.getAccounts = () => { started.resolve(); return catalog.promise }
  const firm = new TradeseaPropFirm()
  const pending = firm.initializeLiveTrade()
  await started.promise
  firm.cleanup()
  const assertCurrentState = beginCurrentLiveState(firm)
  catalog.resolve({ connected: true, accounts: [{ id: 'old-live', label: 'Old live account' }] })
  await pending
  assertCurrentState()
})

test('the Live bootstrap cannot replace a practice session', async () => {
  state.getAccounts = () => { throw new Error('Practice bootstrap must use its existing path') }
  const firm = new TradeseaPropFirm()
  firm.setPracticeMode(true, market.id, market.label)
  await assert.rejects(firm.initializeLiveTrade(), /Live startup requires live mode/)
  assert.equal(firm.practiceMode, true)
  assert.equal(firm.selectedAccountId, market.id)
  assert.deepEqual(state.connects, [])
})

test('late validation credentials are rejected after cleanup', async () => {
  const credentials = deferred()
  state.getPropFirm = () => credentials.promise
  const firm = new TradeseaPropFirm()
  const pending = firm.validate()
  firm.cleanup()
  credentials.resolve({ success: true, propFirm: { token: 'old-provider-token' } })
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(firm.token, null)
})

test('a late connection-status response cannot validate a superseded session', async () => {
  const connection = deferred()
  const started = deferred()
  state.getPropFirm = async () => ({ success: true, propFirm: { token: 'provider-token' } })
  state.getConnectionStatus = () => { started.resolve(); return connection.promise }
  const firm = new TradeseaPropFirm()
  const pending = firm.validate()
  await started.promise
  firm.cleanup()
  connection.resolve({ connected: true })
  await assert.rejects(pending, { name: 'AbortError' })
})

test('detaching an old data-ready callback preserves the replacement callback', () => {
  const firm = new TradeseaPropFirm()
  let oldNotifications = 0
  let currentNotifications = 0
  const detachOld = firm.setOnDataReady(() => { oldNotifications += 1 })
  const detachCurrent = firm.setOnDataReady(() => { currentNotifications += 1 })
  detachOld()
  firm.notifyAccountInfoChanged()
  assert.equal(oldNotifications, 0)
  assert.equal(currentNotifications, 1)
  detachCurrent()
  firm.notifyAccountInfoChanged()
  assert.equal(currentNotifications, 1)
})
