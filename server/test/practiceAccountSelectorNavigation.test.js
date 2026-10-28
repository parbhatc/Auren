import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/trading/Trading/AccountSelector.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'practice-selector-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point' || path.endsWith('/constants/routes')) return undefined
      return { path, namespace: 'selector-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'selector-test' }, ({ path }) => {
      if (path === 'react') return { contents: `
        export const useState = (initial) => {
          const state = globalThis.__practiceSelector;
          const index = state.cursor++;
          if (!(index in state.values)) state.values[index] = typeof initial === 'function' ? initial() : initial;
          return [state.values[index], (next) => { state.values[index] = typeof next === 'function' ? next(state.values[index]) : next; }];
        };
        export const useCallback = (callback) => callback;
        export const useMemo = (callback) => callback();
        export const useRef = () => ({ current: null });
        export const useEffect = (effect) => { globalThis.__practiceSelector.effects.push(effect); };
      ` }
      if (path === 'react/jsx-runtime') return { contents: 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;' }
      if (path === 'react-router-dom') return { contents: 'export const useLocation = () => ({ pathname: globalThis.__practiceSelector.pathname });' }
      if (path === 'lucide-react') return { contents: 'export const ChevronDown = "chevron"; export const RefreshCw = "refresh";' }
      if (path.endsWith('/constants/practice')) return { contents: `
        export const getPracticeAccounts = () => globalThis.__practiceSelector.accounts;
        export const PRACTICE_STORAGE_KEYS = { ACTIVE_TRADE_ID: 'practiceActiveTradeAccountId' };
        export const getPracticeAccountDisplayTitle = (account) => account.id;
        export const refreshPracticeFromApi = async () => { globalThis.__practiceSelector.reads++; };
      ` }
      if (path.endsWith('practicePlans')) return { contents: 'export const formatPracticeSize = (size) => String(size);' }
      if (path.endsWith('translator')) return { contents: 'export const t = (key) => key;' }
      if (path.endsWith('practiceAccountColors')) return { contents: 'export const getPracticeAccountColorClasses = () => ""; export const practiceAccountModeBadgeClass = () => ""; export const practiceAccountTriggerBorderClass = () => "";' }
      throw new Error(`Unexpected selector dependency: ${path}`)
    })
  } }],
})
const { AccountSelector } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let state
let previous
beforeEach(() => {
  previous = { fixture: globalThis.__practiceSelector, localStorage: globalThis.localStorage, window: globalThis.window, document: globalThis.document }
  state = {
    cursor: 0, values: [], navigation: [], reads: 0, refreshes: 0, effects: [], cleanups: [],
    pathname: '/practice/trade/current', storage: new Map(), selections: [],
    accounts: ['current', 'other', 'passed', 'blown'].map((id) => ({
      id, mode: 'eval', size: 50_000, balance: 50_000,
      status: ['current', 'other'].includes(id) ? 'active' : id,
    })),
  }
  globalThis.__practiceSelector = state
  globalThis.localStorage = { getItem: (key) => state.storage.get(key) ?? null, setItem: (key, value) => state.storage.set(key, value) }
  globalThis.window = new EventTarget()
  globalThis.document = new EventTarget()
  window.addEventListener('practiceAccountsChanged', () => state.selections.push(localStorage.getItem('practiceActiveTradeAccountId')))
})
afterEach(() => {
  for (const cleanup of state.cleanups) cleanup()
  globalThis.__practiceSelector = previous.fixture
  globalThis.localStorage = previous.localStorage
  globalThis.window = previous.window
  globalThis.document = previous.document
})

function render() {
  state.cursor = 0
  return AccountSelector({
    isDark: true, currentAccountId: 'current', navigate: (path) => state.navigation.push(path),
    onRefresh: () => { state.refreshes += 1 },
  })
}
function find(root, predicate) {
  if (Array.isArray(root)) return root.flatMap((item) => find(item, predicate))
  if (!root || typeof root !== 'object') return []
  return [...(predicate(root) ? [root] : []), ...find(root.props?.children, predicate)]
}
function text(root) {
  if (Array.isArray(root)) return root.map(text).join(' ')
  if (root == null || typeof root === 'boolean') return ''
  return typeof root === 'object' ? text(root.props?.children) : String(root)
}
function open() {
  const tree = render()
  find(tree, (node) => node.props?.['aria-haspopup'] === 'listbox')[0].props.onClick()
  return render()
}
function clickOption(id) {
  const tree = open()
  find(tree, (node) => node.props?.role === 'option' && text(node).split(' ')[0] === id)[0].props.onClick()
}

function mount() {
  const tree = render()
  state.cleanups.push(...state.effects.map((effect) => effect()).filter(Boolean))
  return tree
}

test('mounting reflects the host-loaded account catalog and local updates without another HTTP refresh', async () => {
  mount()
  await new Promise(setImmediate)
  assert.equal(state.reads, 0)
  const added = { id: 'new-account', mode: 'funded', size: 50_000, balance: 50_000, status: 'active' }
  state.accounts = [...state.accounts, added]
  window.dispatchEvent(new Event('practiceAccountsChanged'))
  const tree = open()
  assert.equal(find(tree, (node) => node.props?.role === 'option' && text(node).split(' ')[0] === added.id).length, 1)
  assert.equal(state.reads, 0, 'account notifications only reread the shared catalog')
})

test('passed and blown selections open account management and close the dropdown', () => {
  for (const id of ['passed', 'blown']) {
    clickOption(id)
    assert.equal(state.navigation.at(-1), '/practice/accounts')
    assert.equal(find(render(), (node) => node.props?.role === 'listbox').length, 0)
  }
})

test('manage accounts opens the manager while active and current account choices retain terminal behavior', () => {
  const tree = open()
  find(tree, (node) => node.type === 'button' && text(node).trim() === 'practice.hub.manageAccounts')[0].props.onClick()
  assert.deepEqual(state.navigation, ['/practice/accounts'])
  assert.equal(find(render(), (node) => node.props?.role === 'listbox').length, 0)
  clickOption('other')
  assert.deepEqual(state.navigation, ['/practice/accounts', '/practice/trade/other'])
  assert.deepEqual(state.selections, ['other'])
  clickOption('current')
  assert.deepEqual(state.navigation, ['/practice/accounts', '/practice/trade/other'])
  assert.deepEqual(state.selections, ['other'], 'reselecting the current account must not restart the session')
})

test('canonical Practice selection persists and announces the active account while retaining /practice', () => {
  state.pathname = '/practice'
  clickOption('other')
  assert.equal(state.storage.get('practiceActiveTradeAccountId'), 'other')
  assert.deepEqual(state.selections, ['other'], 'the account must be persisted before the landing listener receives the event')
  assert.deepEqual(state.navigation, ['/practice'])
  assert.equal(find(render(), (node) => node.props?.role === 'listbox').length, 0)
  clickOption('current')
  assert.deepEqual(state.selections, ['other'])
  assert.deepEqual(state.navigation, ['/practice'])
})

test('refresh retains the open dropdown, refreshes its accounts, and invokes the existing callback', async () => {
  mount()
  assert.equal(state.reads, 0)
  const tree = open()
  find(tree, (node) => node.type === 'button' && text(node).trim() === 'practice.refreshAccounts')[0].props.onClick()
  await new Promise(setImmediate)
  assert.equal(state.reads, 1)
  assert.equal(state.refreshes, 1)
  assert.equal(find(render(), (node) => node.props?.role === 'listbox').length, 1)
  assert.deepEqual(state.navigation, [])
})
