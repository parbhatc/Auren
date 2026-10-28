import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import ts from 'typescript'

const entry = fileURLToPath(new URL('../../src/components/layout/ProductHeader.tsx', import.meta.url))
const ast = ts.createSourceFile(entry, await readFile(entry, 'utf8'), ts.ScriptTarget.Latest, true)
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
const bundled = await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'header-read-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => kind === 'entry-point' ? undefined : {
      path, namespace: 'header-test',
    })
    builder.onLoad({ filter: /.*/, namespace: 'header-test' }, ({ path }) => {
      if (path === 'react/jsx-runtime') return { contents: 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = "fragment";' }
      const dependency = imports.get(path)
      if (!dependency) throw new Error(`Unexpected header dependency: ${path}`)
      const declarations = dependency.names.map((name) => {
        if (name === 'useState') return `export const useState = (initial) => {
          const state = globalThis.__headerStartup;
          const index = state.values.push(typeof initial === 'function' ? initial() : initial) - 1;
          return [state.values[index], (value) => { state.values[index] = typeof value === 'function' ? value(state.values[index]) : value }];
        };`
        if (name === 'useContext') return 'export const useContext = () => globalThis.__headerStartup.context;'
        if (name === 'useMemo') return 'export const useMemo = (callback) => callback();'
        if (name === 'useEffect') return 'export const useEffect = (effect) => globalThis.__headerStartup.effects.push(effect);'
        if (name === 'ROUTES') return 'export const ROUTES = new Proxy({}, { get: (_, key) => "/" + key.toLowerCase() });'
        if (name === 'PRACTICE_STORAGE_KEYS') return 'export const PRACTICE_STORAGE_KEYS = { ACTIVE_TRADE_ID: "practice-trade" };'
        if (name === 'ValidatedAuthContext') return 'export const ValidatedAuthContext = {};'
        if (name === 'DASHBOARD_ACCOUNT_CHANGED_EVENT') return 'export const DASHBOARD_ACCOUNT_CHANGED_EVENT = "dashboard-change";'
        if (name === 'authAPI') return `export const authAPI = { validateToken(token) {
          const state = globalThis.__headerStartup;
          state.authReads.push(token);
          return state.authResponse();
        } };`
        if (name === 'tradeseaAPI') return `export const tradeseaAPI = {
          async getAccounts() { globalThis.__headerStartup.liveCatalogReads += 1; return { connected: true, accounts: [] } },
          async getConnectionStatus() { globalThis.__headerStartup.providerReads += 1; return { connected: true } },
        };`
        return `export const ${name} = (...args) => globalThis.__headerStartup.functions['${name}']?.(...args);`
      })
      if (dependency.hasDefault) declarations.push('export default () => null;')
      return { contents: declarations.join('\n') }
    })
  } }],
})
const { default: ProductHeader } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let previous
let state
beforeEach(() => {
  previous = { fixture: globalThis.__headerStartup, localStorage: globalThis.localStorage, window: globalThis.window, document: globalThis.document }
  state = {
    token: 'auth-current', context: null, values: [], effects: [], authReads: [], providerReads: 0, catalogReads: 0, liveCatalogReads: 0,
    listeners: new Map(), cleanups: [],
    authResponse: async () => ({ user: { isAdmin: false } }),
    functions: {
      useNavigate: () => () => {}, useLocation: () => ({ pathname: '/trade' }),
      useDisplayUnit: () => ({ unit: 'usd', setUnit() {} }),
      getPracticeAccounts: () => [], refreshPracticeFromApi: () => Promise.resolve(),
      refreshHeaderPracticeCatalog: () => { state.catalogReads += 1; return Promise.resolve() },
      subscribeHeaderWorkspaceData: () => () => {},
      loadHeaderProviderStatus: async () => { state.providerReads += 1; return { label: 'Tradesea connected', connected: true } },
      getPracticeMarketDataSettings: () => ({ propFirmId: 'tradesea' }),
      getPracticePropFirmConfig: () => ({ id: 'tradesea', displayName: 'Tradesea' }),
      getDashboardAccountSelection: () => null,
    },
  }
  globalThis.__headerStartup = state
  globalThis.localStorage = { getItem(key) { return key === 'token' ? state.token : null }, setItem() {} }
  globalThis.window = {
    addEventListener(name, listener) { const listeners = state.listeners.get(name) ?? new Set(); listeners.add(listener); state.listeners.set(name, listeners) },
    removeEventListener(name, listener) { state.listeners.get(name)?.delete(listener) },
  }
  globalThis.document = { documentElement: { style: { setProperty() {} } }, body: { style: {} } }
})
afterEach(() => {
  for (const cleanup of state.cleanups) cleanup()
  globalThis.__headerStartup = previous.fixture
  globalThis.localStorage = previous.localStorage
  globalThis.window = previous.window
  globalThis.document = previous.document
})
async function mount(props = {}) {
  const rendered = ProductHeader({ isDark: true, toggleTheme() {}, sidebarOnly: true, ...props })
  state.cleanups = state.effects.map((effect) => effect()).filter(Boolean)
  await new Promise(setImmediate)
  return rendered
}

test('a header reuses its exact route validation result without another auth request', async () => {
  state.context = { token: state.token, isAdmin: true }
  await mount({ marketDataStatus: { label: 'Market data live', connected: true } })
  assert.deepEqual(state.authReads, [])
  assert.equal(state.values[6], true)
  assert.equal(state.providerReads, 0)
})

test('a changed login token cannot reuse the old route admin result', async () => {
  state.context = { token: 'auth-old', isAdmin: true }
  await mount({ marketDataStatus: { label: 'Market data live', connected: true } })
  assert.deepEqual(state.authReads, ['auth-current'])
  assert.equal(state.values[6], false)
})

test('a pending fallback for the old login cannot publish admin information after a token change', async () => {
  let finish
  state.authResponse = () => new Promise((resolve) => { finish = resolve })
  await mount({ marketDataStatus: { label: 'Market data live', connected: true } })
  state.token = 'auth-replacement'
  finish({ user: { isAdmin: true } })
  await new Promise(setImmediate)
  assert.deepEqual(state.authReads, ['auth-current'])
  assert.equal(state.values[6], false)
})

test('headers outside a validated route retain the server auth and linked-provider checks', async () => {
  state.authResponse = async () => ({ user: { isAdmin: true } })
  await mount()
  assert.deepEqual(state.authReads, ['auth-current'])
  assert.equal(state.values[6], true)
  assert.equal(state.providerReads, 1)
})

test('a terminal displays the actual stream status without a redundant credential probe', async () => {
  state.context = { token: state.token, isAdmin: false }
  const rendered = await mount({ marketDataStatus: { label: 'Market data reconnecting…', connected: false } })
  assert.ok(JSON.stringify(rendered).includes('Market data reconnecting…'))
  assert.equal(state.providerReads, 0)
  assert.equal(state.catalogReads, 0, 'the terminal host owns the visible account selector and catalog')
  assert.equal(state.listeners.get('practiceAccountsChanged')?.size ?? 0, 0)
  assert.equal(state.listeners.get('activePropFirmChanged')?.size ?? 0, 0)
})

test('a retained terminal rail cannot download unused account labels when the current route becomes Dashboard', async () => {
  state.context = { token: state.token, isAdmin: false }
  state.functions.useLocation = () => ({ pathname: '/dashboard' })
  await mount({ marketDataStatus: { label: 'Market data connected', connected: true } })
  assert.equal(state.catalogReads, 0)
  assert.equal(state.liveCatalogReads, 0)
})

test('the full Dashboard header still refreshes the catalog used by its visible account control', async () => {
  state.context = { token: state.token, isAdmin: false }
  state.functions.useLocation = () => ({ pathname: '/dashboard' })
  await mount({ sidebarOnly: false })
  assert.equal(state.catalogReads, 1)
  assert.equal(state.liveCatalogReads, 1)
  assert.equal(state.listeners.get('practiceAccountsChanged')?.size ?? 0, 1)
})

test('a logged-out header cannot reuse an old admin result or start a new auth read', async () => {
  state.token = null
  state.context = { token: 'auth-old', isAdmin: true }
  await mount({ marketDataStatus: { label: 'Market data disconnected', connected: false } })
  assert.deepEqual(state.authReads, [])
  assert.equal(state.values[6], false)
})
