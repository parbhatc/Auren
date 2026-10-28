import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const dependencies = {
  react: `
    export const useState = (initial) => {
      const state = globalThis.__dayDialogTest;
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
      const state = globalThis.__dayDialogTest;
      const index = state.cursor++;
      return state.hooks[index] ??= { current: initial };
    };
    export const useId = () => {
      const state = globalThis.__dayDialogTest;
      const index = state.cursor++;
      return (state.hooks[index] ??= { id: 'day-dialog-' + index }).id;
    };
    export const useEffect = (effect, deps) => {
      const state = globalThis.__dayDialogTest;
      const index = state.cursor++;
      const old = state.hooks[index];
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
      state.effects.push(() => { old?.cleanup?.(); state.hooks[index] = { deps, cleanup: effect() }; });
    };
  `,
  'react/jsx-runtime': 'export const jsx = (...args) => globalThis.__dayDialogTest.jsx(...args); export const jsxs = jsx; export const Fragment = "fragment";',
  'react-dom': 'export const createPortal = (node, target) => { globalThis.__dayDialogTest.portalTarget = target; return node; };',
  'lucide-react': 'export const AlertCircle = "alert-icon"; export const CalendarDays = "calendar-icon"; export const LoaderCircle = "loader-icon"; export const RefreshCw = "refresh-icon"; export const X = "close-icon";',
  '../../api/api': 'export const getAuthToken = () => globalThis.__dayDialogTest.owner;',
  '../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true });',
  '../../services/auth/authEvents': `export const subscribeAuthEvents = (listener) => {
    const listeners = globalThis.__dayDialogTest.authListeners;
    listeners.add(listener); return () => listeners.delete(listener);
  };`,
  '../../services/dashboard/dashboardDayDetails': `export const loadDashboardDayDetails = (...args) => {
    const state = globalThis.__dayDialogTest;
    state.requests.push(args); return state.load(...args);
  };`,
  './CalendarDayDetailsDialog.css': '',
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/dashboard/CalendarDayDetailsDialog.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'day-dialog-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected day dialog dependency: ${path}`)
      return { path, namespace: 'day-dialog-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'day-dialog-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: Dialog } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let state, previous, props
class Element {
  constructor(type = 'div', props = {}) {
    this.type = type; this.props = props; this.parent = null; this.style = {}; this.isConnected = true; this.alive = true
  }
  focus() {
    document.activeElement = this
    for (const handler of state.listeners.get('focusin') ?? []) handler({ target: this })
  }
  contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false }
  getClientRects() { return this.alive ? [{}] : [] }
  querySelectorAll() {
    return state.elements.filter((node) => node.alive && this.contains(node) && (
      node.type === 'button' && !node.props.disabled && node.props.tabIndex !== -1 || node.props.tabIndex === 0
    ))
  }
}
function ready(overrides = {}) {
  return {
    selection: props.selection, date: props.date, netPnl: 0, totalTrades: 0, winRate: 0, totalFees: 0,
    trades: [], detailsStatus: 'available', message: null, ...overrides,
  }
}
beforeEach(() => {
  previous = { fixture: globalThis.__dayDialogTest, document: globalThis.document, HTMLElement: globalThis.HTMLElement, Node: globalThis.Node }
  state = {
    hooks: [], cursor: 0, effects: [], dirty: false, unmounted: false, lateWrites: 0,
    elements: [], listeners: new Map(), authListeners: new Set(), requests: [], owner: 'owner-a', closes: 0,
    load: async () => ready(),
  }
  state.jsx = (type, props = {}) => {
    let element
    if (typeof type === 'string') {
      element = props.ref?.current ?? new Element(type, props)
      element.props = props; element.alive = true
      if (!state.elements.includes(element)) state.elements.push(element)
      if (props.ref) props.ref.current = element
      for (const child of [props.children].flat(Infinity)) if (child?.element) child.element.parent = element
    }
    return { type, props, element }
  }
  globalThis.__dayDialogTest = state
  globalThis.HTMLElement = Element
  globalThis.Node = Element
  globalThis.document = {
    documentElement: new Element('html'), body: new Element('body'), activeElement: new Element('calendar-cell'),
    addEventListener(type, handler) { const list = state.listeners.get(type) ?? new Set(); list.add(handler); state.listeners.set(type, list) },
    removeEventListener(type, handler) { state.listeners.get(type)?.delete(handler) },
  }
  props = {
    selection: { source: 'practice', accountId: 'practice-a' }, date: '2026-10-12', accountName: 'Account A',
    calendarPnl: 125, formatPnl: (value) => `PNL:${value}`, onClose: () => { state.closes++ },
  }
})
function unmount() {
  if (state.unmounted) return
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
}
afterEach(() => {
  unmount()
  globalThis.__dayDialogTest = previous.fixture
  globalThis.document = previous.document
  globalThis.HTMLElement = previous.HTMLElement
  globalThis.Node = previous.Node
})
function render() {
  let tree, attempts = 0
  do {
    assert.ok(attempts++ < 10, 'daily dialog should settle without a render loop')
    for (const element of state.elements) element.alive = false
    state.cursor = 0; state.effects = []; state.dirty = false
    tree = Dialog(props)
    for (const effect of state.effects) effect()
  } while (state.dirty)
  return tree
}
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); return render() }
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found }
  return null
}
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  return [node.props?.children].flat(Infinity).map(text).join(' ')
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

test('loading retains the clicked calendar total and an empty successful response is distinct', async () => {
  const tree = render()
  assert.ok(text(tree).includes('PNL:125'))
  assert.ok(text(tree).includes('Loading daily statistics'))
  assert.equal(state.requests[0][0].accountId, 'practice-a')
  assert.equal(state.requests[0][2].dateBasis, 'practice-session')
  assert.equal(state.portalTarget, document.body)
  const completed = await settle()
  assert.ok(text(completed).includes('No closed trades'))
  assert.ok(text(completed).includes('PNL:0'))
})

test('a failed request preserves the calendar total and can retry', async () => {
  state.load = async () => { throw new Error('fixture network failure') }
  render()
  const failed = await settle()
  assert.ok(find(failed, (node) => node.props?.role === 'alert'))
  assert.ok(text(failed).includes('PNL:125'))
  state.load = async () => ready({ netPnl: 150 })
  find(failed, (node) => node.type === 'button' && text(node).includes('Try again')).props.onClick()
  render()
  assert.ok(text(await settle()).includes('PNL:150'))
  assert.equal(state.requests.length, 2)
})

test('a later day request rejects old details even when the old network request finishes last', async () => {
  const old = deferred(), current = deferred()
  state.load = () => old.promise
  render()
  props = { ...props, selection: { source: 'tradesea', accountId: 'connected-b' }, date: '2026-10-13', accountName: 'Account B', calendarPnl: 50 }
  state.load = () => current.promise
  render()
  assert.equal(state.requests[0][2].signal.aborted, true)
  current.resolve(ready({ netPnl: 50 }))
  await settle()
  old.resolve(ready({ netPnl: 999 }))
  const tree = await settle()
  assert.ok(text(tree).includes('PNL:50'))
  assert.ok(!text(tree).includes('PNL:999'))
})

test('an auth change removes the old account calendar total and ignores a late response', async () => {
  const pending = deferred()
  state.load = () => pending.promise
  render()
  state.owner = 'owner-b'
  for (const listener of state.authListeners) listener({ kind: 'token-change' })
  let tree = render()
  assert.ok(!text(tree).includes('PNL:125'))
  assert.ok(text(tree).includes('sign-in session changed'))
  pending.resolve(ready({ netPnl: 999 }))
  tree = await settle()
  assert.ok(!text(tree).includes('PNL:999'))
  assert.equal(state.requests[0][2].signal.aborted, true)
})

test('partial records with an authoritative trade count never claim that no trades exist', async () => {
  state.load = async () => ready({ detailsStatus: 'partial', totalTrades: 4, netPnl: 125, totalFees: null, winRate: null, message: 'Trade rows were not returned.' })
  render()
  const tree = await settle()
  assert.ok(text(tree).includes('Some details are unavailable'))
  assert.ok(!text(tree).includes('No closed trades'))
})

test('focus stays in the dialog, Escape closes it, and cleanup restores focus and scrolling', () => {
  const previousFocus = document.activeElement
  document.body.style.overflow = 'auto'
  const tree = render()
  const dialog = find(tree, (node) => node.props?.role === 'dialog').element
  const focusables = dialog.querySelectorAll()
  assert.equal(document.activeElement, focusables[0])
  const key = (key, shiftKey = false) => {
    const event = { key, shiftKey, preventDefault() { this.prevented = true }, stopPropagation() {} }
    for (const listener of state.listeners.get('keydown') ?? []) listener(event)
    return event
  }
  assert.equal(key('Tab', true).prevented, true)
  assert.equal(document.activeElement, focusables.at(-1))
  key('Tab')
  assert.equal(document.activeElement, focusables[0])
  key('Escape')
  assert.equal(state.closes, 1)
  assert.equal(document.body.style.overflow, 'hidden')
  unmount()
  assert.equal(document.body.style.overflow, 'auto')
  assert.equal(document.activeElement, previousFocus)
})

test('closing the dialog aborts pending details without late state writes', async () => {
  const pending = deferred()
  state.load = () => pending.promise
  render()
  unmount()
  pending.resolve(ready({ netPnl: 999 }))
  for (let i = 0; i < 15; i++) await Promise.resolve()
  assert.equal(state.requests[0][2].signal.aborted, true)
  assert.equal(state.lateWrites, 0)
  assert.equal(state.authListeners.size, 0)
})
