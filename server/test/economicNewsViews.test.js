import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const reactStub = `
  export class Component {
    constructor(props) { this.props = props; }
    setState(update, callback) {
      globalThis.__newsFixture.classWrites += 1;
      this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) };
      callback?.();
    }
  }
  export const createRef = () => ({ current: null });
  export const useState = (initial) => globalThis.__newsHooks.useState(initial);
  export const useRef = (initial) => globalThis.__newsHooks.useMemo(() => ({ current: initial }), []);
  export const useMemo = (callback, deps) => globalThis.__newsHooks.useMemo(callback, deps);
  export const useCallback = (callback, deps) => useMemo(() => callback, deps);
  export const useEffect = (callback, deps) => globalThis.__newsHooks.useEffect(callback, deps);
`

async function loadView(relative, exportName) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, format: 'esm', platform: 'node', write: false,
    plugins: [{ name: 'news-ui-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path, kind }) => kind === 'entry-point' ? undefined : { path, namespace: 'news-test' })
      builder.onLoad({ filter: /.*/, namespace: 'news-test' }, ({ path }) => {
        if (path === 'react') return { contents: reactStub }
        if (path === 'react/jsx-runtime') return { contents: 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;' }
        if (path === 'react-dom') return { contents: 'export const createPortal = (children) => children;' }
        if (path === 'lucide-react') return { contents: 'export const Calendar = "calendar"; export const Settings = "settings"; export const X = "close";' }
        if (path.endsWith('economicNews.api')) return { contents: 'export const economicNewsAPI = { getEvents: (...args) => globalThis.__newsFixture.getEvents(...args) };' }
        if (path.endsWith('/api/api')) return { contents: 'export const getAuthToken = () => globalThis.__newsFixture.token;' }
        if (path.endsWith('newsTime')) return { contents: 'export const formatNewsTime = (_date, time) => time;' }
        if (path.endsWith('Checkbox')) return { contents: 'export default "checkbox";' }
        throw new Error(`Unexpected news view dependency: ${path}`)
      })
    } }],
  })
  const module = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  return module[exportName]
}

const EconomicNewsView = await loadView('../../src/components/trading/shared/news/EconomicNewsView.tsx', 'EconomicNewsView')
const EconomicNewsPanel = await loadView('../../src/components/common/EconomicNewsPanel.tsx', 'default')
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]))

class HookView {
  slots = []
  dirty = true
  mounted = true
  constructor() { this.render() }
  useState(initial) {
    const index = this.cursor++
    if (!this.slots[index]) this.slots[index] = { value: typeof initial === 'function' ? initial() : initial }
    return [this.slots[index].value, (next) => {
      fixture.hookWrites += 1
      const value = typeof next === 'function' ? next(this.slots[index].value) : next
      if (Object.is(value, this.slots[index].value)) return
      this.slots[index].value = value
      this.dirty = true
    }]
  }
  useMemo(callback, deps) {
    const index = this.cursor++
    if (!sameDeps(this.slots[index]?.deps, deps)) this.slots[index] = { deps, value: callback() }
    return this.slots[index].value
  }
  useEffect(callback, deps) {
    const index = this.cursor++
    if (sameDeps(this.slots[index]?.deps, deps)) return
    const previous = this.slots[index]
    this.slots[index] = { deps, cleanup: previous?.cleanup }
    this.effects.push(() => {
      previous?.cleanup?.()
      this.slots[index].cleanup = callback()
    })
  }
  render() {
    this.dirty = true
    for (let attempts = 0; this.dirty && attempts < 10; attempts += 1) {
      this.dirty = false
      this.cursor = 0
      this.effects = []
      globalThis.__newsHooks = this
      this.tree = EconomicNewsView({ isDark: true })
      for (const effect of this.effects) effect()
    }
    assert.equal(this.dirty, false, 'news view must settle without a render loop')
  }
  unmount() {
    this.mounted = false
    for (const slot of this.slots) slot?.cleanup?.()
  }
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
function event(date, name, impact = 'high', time = '8:30 AM') {
  return { date, event: name, impact, time, currency: 'USD' }
}
function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
async function settle(view) {
  await new Promise(setImmediate)
  view?.render()
}

let fixture
let previous
beforeEach((t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 28, 16) })
  previous = { fixture: globalThis.__newsFixture, hooks: globalThis.__newsHooks, localStorage: globalThis.localStorage, window: globalThis.window, document: globalThis.document }
  const listeners = new Map()
  const storage = new Map([['user_timezone', 'UTC']])
  fixture = {
    token: 'current-user', calls: [], classWrites: 0, hookWrites: 0, listeners, storage,
    getEvents(year, month, options) {
      fixture.calls.push({ year, month, signal: options?.signal })
      return fixture.response(year, month)
    },
    response: async () => ({ success: true, events: [event('2026-10-28', 'High release'), event('2026-10-28', 'Low release', 'low')] }),
  }
  globalThis.__newsFixture = fixture
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const surface = {
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name) },
  }
  globalThis.window = surface
  globalThis.document = { ...surface, body: {} }
})
afterEach(() => {
  globalThis.__newsFixture = previous.fixture
  globalThis.__newsHooks = previous.hooks
  globalThis.localStorage = previous.localStorage
  globalThis.window = previous.window
  globalThis.document = previous.document
})

test('full news view filters raw data locally after API TTL, including saved filters and timezone changes', async (t) => {
  fixture.storage.set('economicNews_filters', JSON.stringify({ currencies: { ALL: true }, impact: { high: true, low: true } }))
  const view = new HookView()
  await settle(view)
  assert.equal(fixture.calls.length, 1, 'saved preferences must not cause a second initial monthly read')
  assert.match(text(view.tree), /High release/)
  t.mock.timers.tick(61_000)
  find(view.tree, (item) => item.props?.['aria-label'] === 'Filter settings')[0].props.onClick()
  view.render()
  find(view.tree, (item) => item.type === 'checkbox' && item.props.label === 'High')[0].props.onChange(false)
  view.render()
  assert.doesNotMatch(text(view.tree), /High release/)
  assert.match(text(view.tree), /Low release/)
  fixture.listeners.get('storage')({ key: 'user_timezone', newValue: 'Pacific/Kiritimati' })
  view.render()
  assert.doesNotMatch(text(view.tree), /Low release/, 'timezone derives a different target day from the same raw month')
  assert.equal(fixture.calls.length, 1)
  view.unmount()
})

test('full news view rejects late responses after unmount and auth replacement', async () => {
  const pending = deferred()
  fixture.response = () => pending.promise
  const view = new HookView()
  view.unmount()
  const writes = fixture.hookWrites
  assert.equal(fixture.calls[0].signal.aborted, true)
  pending.resolve({ success: true, events: [event('2026-10-28', 'Disposed response')] })
  await settle()
  assert.equal(fixture.hookWrites, writes)

  const old = deferred()
  fixture.response = () => old.promise
  const next = new HookView()
  fixture.token = 'replacement-user'
  fixture.response = async () => ({ success: true, events: [event('2026-10-28', 'Replacement news')] })
  next.render()
  await settle(next)
  old.resolve({ success: true, events: [event('2026-10-28', 'Old user news')] })
  await settle(next)
  assert.match(text(next.tree), /Replacement news/)
  assert.doesNotMatch(text(next.tree), /Old user news/)
  next.unmount()
})

test('compact panel reuses one raw month across filters, timezone and replay day changes after API TTL', async (t) => {
  fixture.response = async () => ({ success: true, events: [
    ...Array.from({ length: 7 }, (_, index) => event('2026-10-28', `Release ${index}`, index ? 'low' : 'high', `${9 + index}:00`)),
    event('2026-10-29', 'Next replay day'),
  ] })
  const panel = new EconomicNewsPanel({ isDark: true, date: '2026-10-28' })
  panel.componentDidMount()
  await settle()
  assert.equal(panel.getTodayEvents().length, 5, 'compact panel retains its five-event limit')
  assert.equal(fixture.calls.length, 1)
  t.mock.timers.tick(61_000)
  panel.handleFilterChange('impact', 'high', false)
  assert.doesNotMatch(text(panel.render()), /Release 0/)
  panel.handleSelectAll('impact', true)
  panel.handleStorageChange({ key: 'user_timezone', newValue: 'America/New_York' })
  const oldProps = panel.props
  panel.props = { ...oldProps, date: '2026-10-29' }
  panel.componentDidUpdate(oldProps)
  await settle()
  assert.match(text(panel.render()), /Next replay day/)
  assert.equal(fixture.calls.length, 1)
  panel.componentWillUnmount()
})

test('compact panel cancels replaced months and ignores late successes or failures after unmount', async () => {
  const october = deferred()
  const november = deferred()
  fixture.response = (_year, month) => month === 10 ? october.promise : november.promise
  const panel = new EconomicNewsPanel({ isDark: true, date: '2026-10-28' })
  panel.componentDidMount()
  const oldProps = panel.props
  panel.props = { ...oldProps, date: '2026-11-02' }
  panel.componentDidUpdate(oldProps)
  assert.equal(fixture.calls.length, 2)
  assert.equal(fixture.calls[0].signal.aborted, true)
  november.resolve({ success: true, events: [event('2026-11-02', 'Current month')] })
  await settle()
  october.resolve({ success: true, events: [event('2026-10-28', 'Stale month')] })
  await settle()
  assert.match(text(panel.render()), /Current month/)
  assert.doesNotMatch(text(panel.render()), /Stale month/)
  panel.componentWillUnmount()

  const pending = deferred()
  fixture.response = () => pending.promise
  const disposed = new EconomicNewsPanel({ isDark: true, date: '2026-10-28' })
  disposed.componentDidMount()
  disposed.componentWillUnmount()
  const writes = fixture.classWrites
  pending.reject(new Error('late failure'))
  await settle()
  assert.equal(fixture.classWrites, writes)
})

test('compact panel hides cached events on auth replacement and rejects the old response', async () => {
  const old = deferred()
  fixture.response = () => old.promise
  const panel = new EconomicNewsPanel({ isDark: true, date: '2026-10-28' })
  panel.componentDidMount()
  fixture.token = 'replacement-user'
  fixture.response = async () => ({ success: true, events: [event('2026-10-28', 'New owner')] })
  panel.componentDidUpdate(panel.props)
  await settle()
  old.resolve({ success: true, events: [event('2026-10-28', 'Previous owner')] })
  await settle()
  assert.match(text(panel.render()), /New owner/)
  assert.doesNotMatch(text(panel.render()), /Previous owner/)
  panel.componentWillUnmount()
})
