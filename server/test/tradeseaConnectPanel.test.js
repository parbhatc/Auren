import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const dependencies = {
  react: `
    export const useState = (initial) => {
      const state = globalThis.__connectionPanelTest;
      const index = state.cursor++;
      state.hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [state.hooks[index].value, (update) => {
        if (state.unmounted) state.lateWrites++;
        const value = typeof update === 'function' ? update(state.hooks[index].value) : update;
        if (!Object.is(value, state.hooks[index].value)) state.dirty = true;
        state.hooks[index].value = value;
      }];
    };
    export const useEffect = (effect, deps) => {
      const state = globalThis.__connectionPanelTest;
      const index = state.cursor++;
      const old = state.hooks[index];
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
      state.effects.push(() => { old?.cleanup?.(); state.hooks[index] = { deps, cleanup: effect() }; });
    };
  `,
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;',
  axios: 'export default { isAxiosError: () => false };',
  '../../../api/tradesea.api': `export const tradeseaAPI = new Proxy({}, {
    get: (_, method) => (...args) => globalThis.__connectionPanelTest.api[method](...args),
  });`,
  '../../../utils/translator': 'export const t = (key, params) => params?.name ? "Connected as " + params.name : key;',
  '../../connect/BaseEmailOTPFirm': 'export default "email-otp";',
  './TradeseaAdvancedTokens': 'export default "manual-tokens";',
  '../../../api/props.api': `
    export const propsAPI = {
      updatePropFirm: async (type, payload) => globalThis.__connectionPanelTest.credentialSaves.push({ kind: 'update', type, ...payload }),
      savePropFirm: async (payload) => globalThis.__connectionPanelTest.credentialSaves.push({ kind: 'create', ...payload }),
      updateToken: async (...args) => globalThis.__connectionPanelTest.tokenSaves.push(args),
    };
  `,
}
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../../src/propfirms/tradesea/connect/TradeseaConnectPanel.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'connection-panel-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point' || path.endsWith('/savePropFirmCredentials')) return
      if (!(path in dependencies)) throw new Error(`Unexpected connection dependency: ${path}`)
      return { path, namespace: 'connection-panel-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'connection-panel-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: ConnectPanel } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

let state, previous, props
beforeEach(() => {
  previous = globalThis.__connectionPanelTest
  state = {
    hooks: [], cursor: 0, effects: [], dirty: false, unmounted: false, lateWrites: 0,
    credentialSaves: [], tokenSaves: [], errors: [], successes: [], refreshes: 0,
    statusReads: 0, otpSends: [], otpVerifications: [],
    api: {
      getConnectionStatus: async () => { state.statusReads++; return { connected: false } },
      sendOtp: async (...args) => { state.otpSends.push(args); return { ok: true, deviceId: 'fixture-device' } },
      verifyOtp: async (...args) => {
        state.otpVerifications.push(args)
        return { ok: true, accessToken: 'fixture-otp-access', refreshToken: 'fixture-otp-refresh' }
      },
    },
  }
  props = {
    isDark: true, propFirm: undefined,
    onError: (message) => state.errors.push(message),
    onSuccess: (message) => state.successes.push(message),
    onRefresh: () => { state.refreshes++ },
  }
  globalThis.__connectionPanelTest = state
})
afterEach(() => {
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
  globalThis.__connectionPanelTest = previous
})
function render() {
  let tree, attempts = 0
  do {
    assert.ok(attempts++ < 10)
    state.cursor = 0; state.effects = []; state.dirty = false
    tree = ConnectPanel(props)
    for (const effect of state.effects) effect()
  } while (state.dirty)
  return tree
}
async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve()
  return render()
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
function field(tree, id) { return find(tree, (node) => node.props?.id === id) }
function component(tree, type) { return find(tree, (node) => node.type === type) }
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('a verified session without identity details still displays Connected', async () => {
  props.propFirm = { token: 'fixture-session', credentials: {} }
  state.api.getConnectionStatus = async () => ({ connected: true })
  render()
  assert.ok(JSON.stringify(await settle()).includes('Connected'))
})

test('a superseded status response cannot overwrite the replacement connection', async () => {
  const oldStatus = deferred(), currentStatus = deferred()
  props.propFirm = { token: 'fixture-old-session', credentials: {} }
  state.api.getConnectionStatus = () => oldStatus.promise
  render()
  props.propFirm = { token: 'fixture-current-session', credentials: {} }
  state.api.getConnectionStatus = () => currentStatus.promise
  render()
  currentStatus.resolve({ connected: true, name: 'Current trader' })
  await settle()
  oldStatus.resolve({ connected: true, name: 'Previous trader' })
  const tree = await settle()
  assert.ok(JSON.stringify(tree).includes('Connected as Current trader'))
  assert.ok(!JSON.stringify(tree).includes('Previous trader'))
})

test('a status response after leaving connection settings cannot update the unmounted panel', async () => {
  const status = deferred()
  props.propFirm = { token: 'fixture-session', credentials: {} }
  state.api.getConnectionStatus = () => status.promise
  render()
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
  status.resolve({ connected: true, name: 'Late trader' })
  for (let i = 0; i < 15; i++) await Promise.resolve()
  assert.equal(state.lateWrites, 0)
})

test('editing email does not recheck the saved session', async () => {
  props.propFirm = { token: 'fixture-session', credentials: { email: 'saved@example.com' } }
  let tree = render()
  find(tree, (node) => node.type === 'button' && node.props.children === 'Email sign-in').props.onClick()
  tree = render()
  component(tree, 'email-otp').props.onEmailChange('unsaved@example.com')
  render()
  await settle()
  assert.equal(state.statusReads, 1)
})

test('email sign-in is the default and no firm affiliation controls or external login links are shown', () => {
  const tree = render()
  assert.ok(component(tree, 'email-otp'))
  assert.equal(component(tree, 'manual-tokens'), null)
  assert.equal(field(tree, 'connection-firm'), null)
  assert.equal(field(tree, 'connection-firm-name'), null)
  assert.ok(!JSON.stringify(tree).includes('Save firm'))
  assert.equal(find(tree, (node) => node.type === 'a'), null)
  assert.equal(state.credentialSaves.length, 0)
  assert.equal(state.tokenSaves.length, 0)
  assert.equal(state.otpSends.length, 0)
})

test('invalid email, OTP, and missing manual access tokens cannot start authentication or persist sessions', async () => {
  let tree = render()
  component(tree, 'email-otp').props.onSendOtp()
  tree = await settle()
  assert.equal(state.otpSends.length, 0)
  component(tree, 'email-otp').props.onVerifyOtp()
  tree = await settle()
  assert.equal(state.otpVerifications.length, 0)
  find(tree, (node) => node.type === 'button' && node.props.children === 'Advanced').props.onClick()
  tree = render()
  component(tree, 'manual-tokens').props.onSave()
  await settle()
  assert.equal(state.credentialSaves.length, 0)
  assert.equal(state.tokenSaves.length, 0)
  assert.equal(state.errors.filter(Boolean).length, 3)
})

for (const method of ['manual', 'email']) {
  test(`${method} connection preserves saved provider credentials and does not change the current session keys`, async () => {
    props.propFirm = { credentials: {
      email: 'saved@example.com', deviceId: 'saved-device', firstName: 'Saved trader', extraSetting: 'preserved',
    } }
    let tree = render()
    if (method === 'manual') {
      find(tree, (node) => node.type === 'button' && node.props.children === 'Advanced').props.onClick()
      tree = render()
      component(tree, 'manual-tokens').props.onAccessChange('fixture-manual-access')
      tree = render()
      component(tree, 'manual-tokens').props.onSave()
    } else {
      component(tree, 'email-otp').props.onEmailChange('fixture@example.com')
      tree = render()
      component(tree, 'email-otp').props.onSendOtp()
      tree = await settle()
      component(tree, 'email-otp').props.onOtpChange('123456')
      tree = render()
      component(tree, 'email-otp').props.onVerifyOtp()
    }
    await settle()
    assert.equal(state.credentialSaves.length, 1)
    assert.equal(state.credentialSaves[0].type, 'tradesea')
    assert.equal(state.credentialSaves[0].kind, 'update')
    assert.equal(state.credentialSaves[0].credentials.extraSetting, 'preserved')
    assert.equal(state.credentialSaves[0].credentials.firstName, 'Saved trader')
    assert.equal('firmId' in state.credentialSaves[0].credentials, false)
    assert.equal('firmName' in state.credentialSaves[0].credentials, false)
    assert.equal(state.tokenSaves[0][0], 'tradesea')
    assert.equal(state.refreshes, 1)
  })
}
