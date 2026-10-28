import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const dependencies = {
  react: `
    const fixture = () => globalThis.__accountPickerTest;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    export const useState = (initial) => {
      const state = fixture(), index = state.cursor++;
      state.hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [state.hooks[index].value, (update) => {
        if (state.unmounted) state.lateWrites++;
        const value = typeof update === 'function' ? update(state.hooks[index].value) : update;
        if (!Object.is(value, state.hooks[index].value)) state.dirty = true;
        state.hooks[index].value = value;
      }];
    };
    export const useRef = (initial) => {
      const state = fixture(), index = state.cursor++;
      return state.hooks[index] ??= { current: initial };
    };
    export const useId = () => {
      const state = fixture(), index = state.cursor++;
      return (state.hooks[index] ??= { id: 'account-picker-' + index }).id;
    };
    export const useEffect = (effect, deps) => {
      const state = fixture(), index = state.cursor++, old = state.hooks[index];
      if (old && same(deps, old.deps)) return;
      state.effects.push(() => { old?.cleanup?.(); state.hooks[index] = { deps, cleanup: effect() }; });
    };
    export const useLayoutEffect = useEffect;
    export const useMemo = (compute, deps) => {
      const state = fixture(), index = state.cursor++, old = state.hooks[index];
      if (old && same(deps, old.deps)) return old.value;
      const value = compute(); state.hooks[index] = { deps, value }; return value;
    };
    export const useCallback = (callback, deps) => useMemo(() => callback, deps);
  `,
  'react/jsx-runtime': 'export const jsx = (...args) => globalThis.__accountPickerTest.jsx(...args); export const jsxs = jsx; export const Fragment = "fragment";',
  'react-dom': 'export const createPortal = (node, target) => { globalThis.__accountPickerTest.portalTarget = target; return node; };',
  'lucide-react': 'export const Beaker = "practice"; export const Rewind = "replay"; export const Check = "check"; export const ChevronDown = "chevron"; export const X = "close"; export const Wallet = "wallet";',
  '../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true });',
  '../common/PlatformLogo': 'export default "platform-logo";',
  './AccountPicker.css': '',
}

// The boundary intentionally permits UI dependencies only: choosing an account
// must never import authentication, data-fetching, or trading execution code.
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/layout/AccountPicker.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'account-picker-ui-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected account picker dependency: ${path}`)
      return { path, namespace: 'account-picker-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'account-picker-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})
const { default: AccountPicker } = await import(`data:text/javascript;base64,${Buffer.from(`${bundled.outputFiles[0].text}\n//# sourceURL=account-picker-under-test.mjs`).toString('base64')}`)

let state, previous, props
class Element {
  constructor(type = 'div', props = {}) {
    this.type = type; this.props = props; this.parent = null; this.alive = true; this.isConnected = true; this.style = {}
  }
  get id() { return this.props.id || '' }
  get disabled() { return Boolean(this.props.disabled) }
  get dataset() { return { accountValue: this.props['data-account-value'] } }
  focus() { document.activeElement = this }
  contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false }
  getAttribute(name) { return this.props[name] ?? null }
  getBoundingClientRect() { return { x: 20, y: 20, top: 20, left: 20, bottom: 60, right: 270, width: 250, height: 40 } }
  getClientRects() { return this.alive ? [{}] : [] }
  scrollIntoView() {}
  querySelectorAll(selector) {
    return state.elements.filter((node) => node.alive && this.contains(node) && matches(node, selector))
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  closest(selector) { for (let current = this; current; current = current.parent) if (matches(current, selector)) return current; return null }
}
function matches(node, selector) {
  if (selector.includes('role="option"') || selector.includes("role='option'")) return node.props.role === 'option'
  if (selector.startsWith('#')) return node.id === selector.slice(1)
  const value = selector.match(/data-account-value=["']([^"']+)["']/)?.[1]
  if (value) return node.props['data-account-value'] === value
  if (selector.includes('input')) return node.type === 'input'
  if (selector.includes('button')) return node.type === 'button' && !node.disabled
  return false
}
function eventTarget(listeners) {
  return {
    addEventListener(type, handler) { const list = listeners.get(type) ?? new Set(); list.add(handler); listeners.set(type, list) },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler) },
  }
}
beforeEach(() => {
  previous = Object.fromEntries(['__accountPickerTest', 'document', 'window', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]))
  state = {
    hooks: [], cursor: 0, effects: [], dirty: false, unmounted: false, lateWrites: 0,
    elements: [], listeners: new Map(), windowListeners: new Map(), frames: new Map(), nextFrame: 0, changes: [],
  }
  state.jsx = (type, elementProps = {}) => {
    let element
    if (typeof type === 'string') {
      element = elementProps.ref?.current ?? new Element(type, elementProps)
      element.props = elementProps; element.alive = true
      if (!state.elements.includes(element)) state.elements.push(element)
      if (typeof elementProps.ref === 'function') elementProps.ref(element)
      else if (elementProps.ref) elementProps.ref.current = element
      for (const child of [elementProps.children].flat(Infinity)) if (child?.element) child.element.parent = element
    }
    return { type, props: elementProps, element }
  }
  globalThis.__accountPickerTest = state
  globalThis.HTMLElement = Element
  globalThis.Node = Element
  globalThis.requestAnimationFrame = (callback) => { const id = ++state.nextFrame; state.frames.set(id, callback); return id }
  globalThis.cancelAnimationFrame = (id) => state.frames.delete(id)
  globalThis.document = {
    ...eventTarget(state.listeners), body: new Element('body'), documentElement: { clientWidth: 1200, clientHeight: 800 }, activeElement: null,
    getElementById: (id) => state.elements.find((node) => node.alive && node.id === id) ?? null,
    querySelector: (selector) => state.elements.find((node) => node.alive && matches(node, selector)) ?? null,
  }
  globalThis.window = {
    ...eventTarget(state.windowListeners), innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0,
    requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame,
  }
  props = {
    value: 'practice:eval-a', emptyLabel: 'Choose an account',
    options: [
      { value: 'practice:eval-a', label: 'Evaluation A', group: 'Practice accounts', description: '25K evaluation', status: 'active', platform: 'practice' },
      { value: 'practice:funded-b', label: 'Funded B', group: 'Practice accounts', description: '50K funded', status: 'passed', platform: 'practice' },
      { value: 'tradesea:live-c', label: 'Live C', group: 'Connected accounts', description: 'Primary account', status: 'Connected', platform: 'tradesea' },
      { value: 'tradesea:live-d', label: 'Live D', group: 'Connected accounts', description: 'Secondary account', status: 'Connected', platform: 'tradesea' },
      { value: 'replay:session-y', label: 'NQ session', group: 'Replay accounts', description: 'Historical practice', platform: 'replay' },
      { value: 'replay:session-z', label: 'ES session', group: 'Replay accounts', description: 'Historical practice', platform: 'replay' },
    ],
    onChange: (value) => { state.changes.push(value); props = { ...props, value } },
  }
})
function unmount() {
  if (state.unmounted) return
  for (const hook of state.hooks) hook?.cleanup?.()
  state.unmounted = true
}
afterEach(() => {
  unmount()
  for (const [key, value] of Object.entries(previous)) globalThis[key] = value
})
function render() {
  let tree, attempts = 0
  do {
    assert.ok(attempts++ < 15, 'account picker should settle without a render loop')
    for (const element of state.elements) element.alive = false
    state.cursor = 0; state.effects = []; state.dirty = false
    tree = AccountPicker(props)
    for (const effect of state.effects) effect()
    const frames = [...state.frames.values()]; state.frames.clear()
    for (const frame of frames) frame()
  } while (state.dirty)
  return tree
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found }
  return null
}
function findAll(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found
  if (predicate(node)) found.push(node)
  for (const child of [node.props?.children].flat(Infinity)) findAll(child, predicate, found)
  return found
}
function trigger(tree) { return find(tree, (node) => node.type === 'button' && node.props['aria-label'] === 'Active account') }
function listbox(tree) { return find(tree, (node) => node.props?.role === 'listbox') }
function options(tree) { return findAll(tree, (node) => node.props?.role === 'option') }
function dialog(tree) { return find(tree, (node) => node.props?.role === 'dialog') }
function open(tree = render()) {
  trigger(tree).element.focus()
  trigger(tree).props.onClick()
  return render()
}
function key(node, pressed, extras = {}) {
  const event = { key: pressed, target: node.element, currentTarget: node.element, preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.propagationStopped = true }, ...extras }
  for (let current = node.element; current; current = current.parent) {
    event.currentTarget = current
    current.props.onKeyDown?.(event)
    if (event.propagationStopped) break
  }
  return event
}
function activeValue(tree) {
  const id = listbox(tree)?.props['aria-activedescendant']
  return id ? find(tree, (node) => node.props?.id === id)?.props['data-account-value'] : undefined
}
function outsidePointer(element) {
  for (const listeners of [state.listeners, state.windowListeners]) {
    for (const handler of listeners.get('pointerdown') ?? []) handler({ target: element })
  }
}
function pointerListenerCount() { return (state.listeners.get('pointerdown')?.size ?? 0) + (state.windowListeners.get('pointerdown')?.size ?? 0) }

test('opening and navigating are read-only until the user explicitly selects an account', () => {
  let tree = open()
  assert.equal(state.portalTarget, document.body)
  assert.equal(document.activeElement, listbox(tree).element)
  assert.equal(trigger(tree).props['aria-expanded'], true)
  assert.equal(find(tree, (node) => node.type === 'input' || node.props.role === 'combobox'), null, 'account selection must not add a search bar')
  key(listbox(tree), 'ArrowDown')
  tree = render()
  key(listbox(tree), 'ArrowUp')
  tree = render()
  assert.deepEqual(state.changes, [])
  const choice = options(tree).find((option) => option.props['data-account-value'] === 'tradesea:live-d')
  choice.props.onClick()
  tree = render()
  assert.deepEqual(state.changes, ['tradesea:live-d'])
  assert.equal(dialog(tree), null)
  assert.equal(document.activeElement, trigger(tree).element)
})

test('Enter chooses the highlighted replay account with its replay source value intact', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  assert.equal(activeValue(tree), 'replay:session-z')
  key(listbox(tree), 'Enter')
  tree = render()
  assert.deepEqual(state.changes, ['replay:session-z'])
  assert.equal(dialog(tree), null)
})

test('Arrow keys and Home/End navigate the visible account list without changing the selected account', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  assert.equal(activeValue(tree), 'replay:session-z')
  key(listbox(tree), 'ArrowUp'); tree = render()
  assert.equal(activeValue(tree), 'replay:session-y')
  key(listbox(tree), 'Home'); tree = render()
  assert.equal(activeValue(tree), 'practice:eval-a')
  key(listbox(tree), 'ArrowDown'); tree = render()
  assert.equal(activeValue(tree), 'practice:funded-b')
  assert.deepEqual(state.changes, [])
})

test('grouped keyboard navigation follows displayed rows even when the input catalog is interleaved', () => {
  props = { ...props, options: [props.options[0], props.options[2], props.options[1], props.options[4], props.options[3], props.options[5]] }
  let tree = open()
  const displayed = options(tree).map((option) => option.props['data-account-value'])
  key(listbox(tree), 'Home'); tree = render()
  for (const value of displayed) {
    assert.equal(activeValue(tree), value)
    key(listbox(tree), 'ArrowDown'); tree = render()
  }
  assert.deepEqual(state.changes, [])
})

test('Enter on a focused option selects that exact row rather than a different highlighted account', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  const choice = options(tree).find((option) => option.props['data-account-value'] === 'tradesea:live-c')
  choice.element.focus()
  key(choice, 'Enter')
  tree = render()
  assert.deepEqual(state.changes, ['tradesea:live-c'])
  assert.equal(dialog(tree), null)
})

test('keyboard opening focuses the account list and Tab dismisses without committing a highlighted account', () => {
  let tree = render()
  trigger(tree).element.focus()
  key(trigger(tree), 'ArrowDown')
  tree = render()
  assert.ok(dialog(tree))
  assert.equal(document.activeElement, listbox(tree).element)
  key(listbox(tree), 'End'); tree = render()
  const tab = key(listbox(tree), 'Tab')
  tree = render()
  assert.equal(dialog(tree), null)
  assert.notEqual(tab.defaultPrevented, true, 'Tab must preserve ordinary focus navigation')
  assert.deepEqual(state.changes, [])
})

test('Escape dismisses an uncommitted choice, restores trigger focus, and reopens at the selected account', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  key(listbox(tree), 'Escape')
  tree = render()
  assert.equal(dialog(tree), null)
  assert.equal(document.activeElement, trigger(tree).element)
  assert.deepEqual(state.changes, [])
  tree = open(tree)
  assert.equal(activeValue(tree), props.value)
  assert.equal(options(tree).length, props.options.length)
})

test('pressing Enter on the close button dismisses the picker without selecting the highlighted account', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  const close = find(tree, (node) => node.type === 'button' && node.props['aria-label'] === 'Close accounts')
  close.element.focus()
  const enter = key(close, 'Enter')
  assert.deepEqual(state.changes, [], 'Enter on Close must never commit the highlighted trading account')
  // Native buttons activate their click action when Enter was not intercepted.
  if (!enter.defaultPrevented) close.props.onClick()
  tree = render()
  assert.equal(dialog(tree), null)
  assert.equal(document.activeElement, trigger(tree).element)
  assert.deepEqual(state.changes, [])
})

test('an outside pointer dismisses without selection and preserves the clicked element focus', () => {
  let tree = open()
  const outside = new Element('button')
  outside.focus()
  outsidePointer(outside)
  tree = render()
  assert.equal(dialog(tree), null)
  assert.equal(document.activeElement, outside)
  assert.deepEqual(state.changes, [])
})

test('an empty catalog disables selection and removing all open accounts cannot submit a stale choice', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  props = { ...props, options: [], value: '' }
  tree = render()
  assert.equal(options(tree).length, 0)
  assert.equal(dialog(tree), null)
  assert.equal(trigger(tree).props.disabled, true)
  key(trigger(tree), 'ArrowDown'); tree = render()
  assert.equal(dialog(tree), null)
  assert.deepEqual(state.changes, [])
})

test('duplicate account labels keep distinct values and select the exact row the user chose', () => {
  props = { ...props, options: [
    { value: 'practice:duplicate', label: 'Trading account', group: 'Practice accounts' },
    { value: 'tradesea:duplicate', label: 'Trading account', group: 'Connected accounts' },
    { value: 'replay:duplicate', label: 'Trading account', group: 'Replay accounts', platform: 'replay' },
  ], value: 'practice:duplicate' }
  let tree = open()
  assert.deepEqual(options(tree).map((option) => option.props['data-account-value']), ['practice:duplicate', 'tradesea:duplicate', 'replay:duplicate'])
  options(tree)[2].props.onClick()
  tree = render()
  assert.deepEqual(state.changes, ['replay:duplicate'])
  assert.equal(dialog(tree), null)
})

test('removing the highlighted account while the picker is open cannot select a stale catalog entry', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  assert.equal(activeValue(tree), 'replay:session-z')
  props = { ...props, options: props.options.filter((account) => account.value !== 'replay:session-z') }
  tree = render()
  assert.ok(options(tree).every((option) => option.props['data-account-value'] !== 'replay:session-z'))
  assert.notEqual(activeValue(tree), 'replay:session-z')
  key(listbox(tree), 'Enter')
  tree = render()
  assert.ok(state.changes.every((value) => props.options.some((account) => account.value === value)))
})

test('updated account data and an external selection are reflected when the picker reopens', () => {
  let tree = open()
  key(listbox(tree), 'Escape'); render()
  props = { ...props, value: 'tradesea:replacement', options: [
    { value: 'tradesea:replacement', label: 'Replacement account', group: 'Connected accounts' },
  ] }
  tree = open()
  assert.equal(options(tree).length, 1)
  assert.equal(options(tree)[0].props['data-account-value'], 'tradesea:replacement')
  assert.equal(options(tree)[0].props['aria-selected'], true)
  key(listbox(tree), 'Enter'); render()
  assert.ok(state.changes.every((value) => value === 'tradesea:replacement'))
})

test('an external account selection closes an open draft choice without committing its previous highlight', () => {
  let tree = open()
  key(listbox(tree), 'End'); tree = render()
  props = { ...props, value: 'tradesea:live-c' }
  tree = render()
  assert.equal(dialog(tree), null)
  assert.deepEqual(state.changes, [])
  tree = open(tree)
  assert.equal(activeValue(tree), 'tradesea:live-c')
  key(listbox(tree), 'Enter'); render()
  assert.deepEqual(state.changes, [])
})

test('a missing controlled value does not silently replace the selected account', () => {
  props = { ...props, value: 'replay:removed-session' }
  let tree = open()
  assert.equal(activeValue(tree), 'practice:eval-a')
  assert.deepEqual(state.changes, [])
  key(listbox(tree), 'Escape'); tree = render()
  assert.equal(dialog(tree), null)
  assert.deepEqual(state.changes, [])
})

test('dismissal and unmount remove popup listeners without leaving scheduled focus work', () => {
  let tree = open()
  assert.ok(pointerListenerCount())
  key(listbox(tree), 'Escape'); tree = render()
  assert.equal(dialog(tree), null)
  assert.equal(pointerListenerCount(), 0)
  open(tree)
  unmount()
  assert.equal(pointerListenerCount(), 0)
  assert.equal(state.frames.size, 0)
  assert.equal(state.lateWrites, 0)
})
