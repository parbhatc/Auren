import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { selectPracticeTerminalAccount } from '../../src/services/practice/practiceTerminalSelection.ts'

const dependencies = {
  react: `
    export const useState = (initial) => {
      const state = globalThis.__practiceTerminal;
      const index = state.cursor++;
      state.hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [state.hooks[index].value, (update) => {
        if (state.unmounted) state.lateWrites++;
        const next = typeof update === 'function' ? update(state.hooks[index].value) : update;
        if (!Object.is(next, state.hooks[index].value)) state.dirty = true;
        state.hooks[index].value = next;
      }];
    };
    export const useRef = (initial) => {
      const state = globalThis.__practiceTerminal;
      return state.hooks[state.cursor++] ??= { current: initial };
    };
    export const useEffect = (effect, deps) => {
      const state = globalThis.__practiceTerminal;
      const index = state.cursor++;
      const old = state.hooks[index];
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
      state.effects.push(() => { old?.cleanup?.(); state.hooks[index] = { deps, cleanup: effect() }; });
    };
  `,
  'react/jsx-runtime': 'export const jsx = (type, props, key) => ({ type, props, key }); export const jsxs = jsx; export const Fragment = "fragment";',
  'react-router-dom': 'export const Navigate = "navigate"; export const useNavigate = () => globalThis.__practiceTerminal.navigate;',
  '../../api/api': 'export const getAuthToken = () => globalThis.__practiceTerminal.token;',
  '../../chart/aurenChartBoot': 'export const registerAurenChartIndicators = () => { const state = globalThis.__practiceTerminal; state.warmups++; return state.warm(); };',
  '../../components/trading/Practice/TradePage': 'export default "practice-trade"; export const TerminalBootScreen = "terminal-boot";',
  '../../constants/practice': `
    export const PRACTICE_STORAGE_KEYS = { ACTIVE_TRADE_ID: 'practiceActiveTradeAccountId' };
    export const getPracticeAccounts = () => globalThis.__practiceTerminal.accounts;
    export const refreshPracticeFromApi = (options) => {
      const state = globalThis.__practiceTerminal; state.refreshes.push(options); return state.refresh();
    };
  `,
  '../../constants/routes': 'export const ROUTES = { PRACTICE_ACCOUNTS: "/practice/accounts" };',
  '../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true });',
  '../../services/debug/startupTrace': 'export const traceStartup = (phase) => globalThis.__practiceTerminal.traces.push(phase);',
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/pages/practice/PracticeTerminalPage.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'practice-terminal-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point' || path.endsWith('/practiceTerminalSelection')) return
      if (!(path in dependencies)) throw new Error(`Unexpected practice dependency: ${path}`)
      return { path, namespace: 'practice-terminal-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'practice-terminal-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: PracticeTerminal } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

const account = (id, status = 'active') => ({ id, status })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
let state, previous
beforeEach(() => {
  previous = { fixture: globalThis.__practiceTerminal, storage: globalThis.localStorage, window: globalThis.window }
  state = {
    token: 'practice-user', activeId: 'account-b', accounts: [account('account-a'), account('account-b')],
    hooks: [], cursor: 0, effects: [], refreshes: [], traces: [], dirty: false, unmounted: false, lateWrites: 0,
    refresh: async () => {}, navigations: [], warmups: 0, warm: async () => {},
  }
  state.navigate = (path) => state.navigations.push(path)
  globalThis.__practiceTerminal = state
  globalThis.window = new EventTarget()
  globalThis.localStorage = {
    getItem: (key) => key === 'practiceActiveTradeAccountId' ? state.activeId : null,
    setItem: (key, value) => {
      if (key === 'practiceActiveTradeAccountId') state.activeId = value
      else assert.equal(key, 'activePropFirm')
    },
  }
})
afterEach(() => {
  unmount()
  globalThis.__practiceTerminal = previous.fixture
  globalThis.localStorage = previous.storage
  globalThis.window = previous.window
})
function render(component = PracticeTerminal) {
  let result, attempts = 0
  do {
    assert.ok(attempts++ < 10, 'practice terminal must settle without a render loop')
    state.cursor = 0; state.effects = []; state.dirty = false
    result = component()
    for (const effect of state.effects) effect()
  } while (state.dirty)
  return result
}
function unmount() {
  if (state.unmounted) return
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
}
async function settle(component = PracticeTerminal) {
  for (let i = 0; i < 15; i++) await Promise.resolve()
  return render(component)
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate)
    if (result) return result
  }
  return null
}

test('selection uses the saved active account, falls back safely, and never auto-opens an ended account', () => {
  const accounts = [account('passed', 'passed'), account('active-a'), account('active-b'), account('blown', 'blown')]
  assert.equal(selectPracticeTerminalAccount(accounts, 'active-b').id, 'active-b')
  for (const saved of ['removed', 'passed', 'blown', null]) assert.equal(selectPracticeTerminalAccount(accounts, saved).id, 'active-a')
  assert.equal(selectPracticeTerminalAccount([accounts[0], accounts[3]], 'passed'), null)
  assert.equal(selectPracticeTerminalAccount([], null), null)
})

test('canonical Practice resolves one refreshed account catalog and renders the terminal without changing its URL', async () => {
  assert.equal(render().type, 'terminal-boot')
  const terminal = await settle()
  assert.equal(terminal.type, 'practice-trade')
  assert.equal(terminal.props.practiceAccountId, 'account-b')
  assert.equal(terminal.props.accountCatalogReady, true, 'the existing terminal must not download the catalog again')
  assert.deepEqual(state.refreshes, [{ strict: true }])
  assert.equal(state.warmups, 1)
  assert.deepEqual(state.navigations, [])
  assert.deepEqual(state.traces, ['practice-account-start', 'practice-account-ready'])
})

test('a stale or ended saved selection falls back to an active account and persists the corrected selection', async () => {
  state.activeId = 'ended'
  state.accounts.unshift(account('ended', 'blown'))
  render()
  const terminal = await settle()
  assert.equal(terminal.props.practiceAccountId, 'account-a')
  assert.equal(state.activeId, 'account-a')
})

for (const accounts of [[], [account('ended', 'passed')]]) {
  test(`no ${accounts.length ? 'active' : 'existing'} practice account opens account onboarding`, async () => {
    state.accounts = accounts
    render()
    const result = await settle()
    assert.equal(result.type, 'navigate')
    assert.deepEqual(result.props, { to: '/practice/accounts', replace: true })
    assert.equal(state.refreshes.length, 1)
    assert.equal(state.warmups, 0, 'account onboarding must not download the chart SDK')
  })
}

test('account selector events switch canonical Practice without another catalog download', async () => {
  render()
  const first = await settle()
  state.activeId = 'account-a'
  window.dispatchEvent(new Event('practiceAccountsChanged'))
  const second = render()
  assert.equal(second.props.practiceAccountId, 'account-a')
  assert.notEqual(second.key, first.key, 'a new account receives a clean terminal lifecycle')
  assert.equal(state.refreshes.length, 1)
  assert.deepEqual(state.navigations, [])
})

test('a current account that passes stays in its terminal for the existing status modal', async () => {
  render()
  await settle()
  state.accounts = [account('account-a'), account('account-b', 'passed')]
  window.dispatchEvent(new Event('practiceAccountsChanged'))
  assert.equal(render().props.practiceAccountId, 'account-b')
  state.accounts = [account('account-a')]
  window.dispatchEvent(new Event('practiceAccountsChanged'))
  assert.equal(render().props.practiceAccountId, 'account-a', 'a removed account cannot remain selected')
})

test('failed account discovery ends the spinner and can retry successfully', async () => {
  state.refresh = async () => { throw new Error('offline') }
  render()
  const failed = await settle()
  assert.ok(find(failed, (node) => node.props?.role === 'alert'))
  const retry = find(failed, (node) => node.type === 'button' && node.props.children === 'Try again')
  state.refresh = async () => {}
  retry.props.onClick()
  render()
  assert.equal((await settle()).type, 'practice-trade')
  assert.equal(state.refreshes.length, 2)
})

test('chart warmup overlaps terminal setup and cannot block account readiness', async () => {
  state.warm = () => new Promise(() => {})
  render()
  assert.equal((await settle()).type, 'practice-trade')
  assert.equal(state.warmups, 1)
})

for (const superseded of ['unmount', 'replacement-login']) {
  test(`a late ${superseded} account response cannot open an old terminal`, async () => {
    const pending = deferred()
    state.refresh = () => pending.promise
    render()
    if (superseded === 'unmount') unmount()
    else state.token = 'replacement'
    pending.resolve()
    for (let i = 0; i < 15; i++) await Promise.resolve()
    assert.equal(state.lateWrites, 0)
    assert.equal(state.hooks[0].value, null)
    assert.equal(state.hooks[1].value, true)
    assert.deepEqual(state.traces, ['practice-account-start'])
    assert.equal(state.warmups, 0)
  })
}

const tradeDependencies = {
  react: `${dependencies.react}
    export class Component { constructor(props) { this.props = props } }
    export const useCallback = (callback, deps) => {
      const state = globalThis.__practiceTerminal;
      const index = state.cursor++;
      const old = state.hooks[index];
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return old.callback;
      state.hooks[index] = { callback, deps };
      return callback;
    };
  `,
  'react/jsx-runtime': dependencies['react/jsx-runtime'],
  'react-router-dom': `
    export const useNavigate = () => globalThis.__practiceTerminal.navigate;
    export const useParams = () => ({ practiceAccountId: globalThis.__practiceTerminal.routeAccountId });
  `,
  'lucide-react': 'export const BarChart3 = "bar-chart"; export const RefreshCw = "refresh"; export const ShieldCheck = "shield";',
  '../../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true, toggleTheme() {} });',
  '../../../api/api': dependencies['../../api/api'],
  '../../../constants/theme': 'export const getThemeColors = () => ({});',
  '../../../propfirms/registry': `
    const firm = {
      id: 'tradesea',
      validate() { return globalThis.__practiceTerminal.validate() },
      setPracticeMode(...args) { globalThis.__practiceTerminal.practiceModes.push(args) },
      setOnDataReady(callback) { globalThis.__practiceTerminal.onDataReady = callback },
      onValidateSuccess() { const state = globalThis.__practiceTerminal; state.initializations++; return state.initialize() },
      cleanup() { globalThis.__practiceTerminal.cleanups++ },
    };
    export const propFirmRegistry = [firm];
  `,
  '../../../constants/routes': `export const ROUTES = { PRACTICE_ACCOUNTS: '/practice/accounts', PROPS_SETTINGS: '/settings/props' }; export const practiceTradeStatsPath = (id) => '/practice/trade/' + id + '/stats';`,
  '../Trading/TradingRenderer': 'export default "trading-renderer";',
  '../../../utils/translator': 'export const t = (key) => key;',
  '../../../services/trading/accountStatsStore': 'export const publishAccountStats = () => {};',
  '../../../constants/practice': `
    export const getPracticeAccountById = (id) => globalThis.__practiceTerminal.accounts.find((account) => account.id === id);
    export const getPracticeAccountDisplayTitle = (account) => account.id;
    export const getFirmMarketDataSelection = () => ({ accountId: 'feed', accountLabel: 'Feed' });
    export const getPracticeMarketDataSettings = () => ({ propFirmId: 'tradesea' });
    export const normalizePracticePropFirmId = (id) => id;
    export const refreshPracticeFromApi = () => { const state = globalThis.__practiceTerminal; state.refreshes.push({}); return state.refresh() };
  `,
  '../../../services/practice/practiceRules': 'export const computeDrawdownFloor = () => 0; export const evaluatePracticeRules = () => ({});',
  '../../../services/practice/practicePlans': 'export const getPracticePlanFromAccount = () => ({});',
  '../shared/modals/BlownAccountModal': 'export default "blown-modal";',
  '../shared/modals/PassedAccountModal': 'export default "passed-modal";',
}
const tradeBundle = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/trading/Practice/TradePage.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'practice-trade-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in tradeDependencies)) throw new Error(`Unexpected terminal dependency: ${path}`)
      return { path, namespace: 'practice-trade-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'practice-trade-test' }, ({ path }) => ({ contents: tradeDependencies[path] }))
  } }],
})
const { default: TradePage } = await import(`data:text/javascript;base64,${Buffer.from(tradeBundle.outputFiles[0].text).toString('base64')}`)

function tradeComponent(props = {}) {
  state.routeAccountId = 'account-a'
  state.practiceModes = []
  state.initializations = 0
  state.cleanups = 0
  state.validate ??= async () => ({ success: true })
  state.initialize ??= async () => {}
  const inner = new TradePage(props).render()
  return () => inner.type(inner.props)
}

test('actual terminal accepts canonical account props and skips a catalog already refreshed by the landing page', async () => {
  const component = tradeComponent({ practiceAccountId: 'account-b', accountCatalogReady: true })
  render(component)
  await settle(component)
  assert.equal(state.refreshes.length, 0)
  assert.equal(state.practiceModes[0][3], 'account-b', 'canonical props override the legacy route parameter')
  assert.equal(state.initializations, 1)
})

test('an existing practice deep link still refreshes and initializes its route account', async () => {
  const component = tradeComponent()
  render(component)
  await settle(component)
  assert.equal(state.refreshes.length, 1)
  assert.equal(state.practiceModes[0][3], 'account-a')
})

for (const superseded of ['unmount', 'replacement-login']) {
  test(`late provider validation after ${superseded} cannot configure the previous practice account`, async () => {
    const pending = deferred()
    state.validate = () => pending.promise
    const component = tradeComponent({ practiceAccountId: 'account-b', accountCatalogReady: true })
    render(component)
    if (superseded === 'unmount') unmount()
    else state.token = 'replacement-user'
    pending.resolve({ success: true })
    for (let i = 0; i < 15; i++) await Promise.resolve()
    assert.deepEqual(state.practiceModes, [])
    assert.equal(state.initializations, 0)
    assert.equal(state.lateWrites, 0)
  })
}
