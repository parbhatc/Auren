import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// Exercise the actual provider. The harness supplies React scheduling and browser
// boundaries; preference parsing, effects and event handlers remain production code.
const dependencies = {
  react: `
    export const createContext = () => ({ Provider: 'theme-provider' });
    export const useContext = () => undefined;
    export const useState = (initial) => globalThis.__themeTest.useState(initial);
    export const useEffect = (effect, deps) => globalThis.__themeTest.useEffect(effect, deps);
  `,
  'react/jsx-runtime': 'export const jsx = (type, props) => ({ type, props });',
}
const bundle = await build({
  entryPoints: [
    fileURLToPath(
      new URL('../../src/contexts/ThemeContext.tsx', import.meta.url)
    ),
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'theme-browser-boundaries',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
          if (kind === 'entry-point') return
          if (!(path in dependencies))
            throw new Error(`Unexpected theme dependency: ${path}`)
          return { path, namespace: 'theme-test' }
        })
        builder.onLoad(
          { filter: /.*/, namespace: 'theme-test' },
          ({ path }) => ({ contents: dependencies[path] })
        )
      },
    },
  ],
})
const { ThemeProvider } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
const html = await readFile(
  new URL('../../index.html', import.meta.url),
  'utf8'
)
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes('auren-theme'))
assert.ok(bootstrap, 'the first-paint theme bootstrap must be present')

function browserFixture() {
  const storage = new Map(),
    classes = new Set(),
    mediaListeners = new Set(),
    storageListeners = new Set(),
    meta = new Map()
  const root = {
    dataset: {},
    style: {},
    classList: {
      toggle(name, enabled) {
        enabled ? classes.add(name) : classes.delete(name)
      },
      add(name) {
        classes.add(name)
      },
      contains(name) {
        return classes.has(name)
      },
    },
  }
  const media = {
    matches: false,
    addEventListener(name, callback) {
      assert.equal(name, 'change')
      mediaListeners.add(callback)
    },
    removeEventListener(name, callback) {
      assert.equal(name, 'change')
      mediaListeners.delete(callback)
    },
  }
  return {
    storage,
    classes,
    media,
    mediaListeners,
    storageListeners,
    root,
    meta,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    document: {
      documentElement: root,
      querySelector: () => ({
        setAttribute: (key, value) => meta.set(key, value),
      }),
    },
    window: {
      matchMedia(query) {
        assert.equal(query, '(prefers-color-scheme: dark)')
        return media
      },
      addEventListener(name, callback) {
        assert.equal(name, 'storage')
        storageListeners.add(callback)
      },
      removeEventListener(name, callback) {
        assert.equal(name, 'storage')
        storageListeners.delete(callback)
      },
    },
    emitMedia(matches) {
      media.matches = matches
      for (const callback of mediaListeners) callback({ matches })
    },
    emitStorage(key) {
      for (const callback of storageListeners) callback({ key })
    },
  }
}

let state, previous
beforeEach(() => {
  previous = Object.fromEntries(
    [
      '__themeTest',
      'localStorage',
      'document',
      'window',
      'getComputedStyle',
    ].map((key) => [key, globalThis[key]])
  )
  state = Object.assign(browserFixture(), {
    hooks: [],
    cursor: 0,
    effects: [],
    dirty: false,
    writes: 0,
    unmounted: false,
    computedBackground: '#123456',
    useState(initial) {
      const index = this.cursor++
      this.hooks[index] ??= {
        value: typeof initial === 'function' ? initial() : initial,
      }
      return [
        this.hooks[index].value,
        (update) => {
          assert.equal(
            this.unmounted,
            false,
            'unmounted theme providers must not receive updates'
          )
          this.writes += 1
          const value =
            typeof update === 'function'
              ? update(this.hooks[index].value)
              : update
          if (!Object.is(value, this.hooks[index].value)) this.dirty = true
          this.hooks[index].value = value
        },
      ]
    },
    useEffect(effect, deps) {
      const index = this.cursor++,
        old = this.hooks[index]
      if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return
      this.effects.push(() => {
        old?.cleanup?.()
        this.hooks[index] = { deps, cleanup: effect() }
      })
    },
  })
  globalThis.__themeTest = state
  globalThis.localStorage = state.localStorage
  globalThis.document = state.document
  globalThis.window = state.window
  globalThis.getComputedStyle = () => ({
    getPropertyValue: (name) =>
      name === '--app-bg' ? state.computedBackground : '',
  })
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
  let tree,
    attempts = 0
  do {
    assert.ok(
      attempts++ < 10,
      'theme effects must settle without a render loop'
    )
    state.cursor = 0
    state.effects = []
    state.dirty = false
    tree = ThemeProvider({ children: 'workspace' })
    for (const effect of state.effects) effect()
  } while (state.dirty)
  return tree.props.value
}

test('valid stored preferences restore the provider and update root styling and browser theme color', () => {
  state.storage.set('auren-theme', 'light')
  state.storage.set('auren-appearance', 'graphite')
  const value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.isDark, false)
  assert.equal(value.appearancePreset, 'graphite')
  assert.equal(state.root.dataset.appearance, 'graphite')
  assert.equal(state.classes.has('dark'), false)
  assert.equal(state.root.style.colorScheme, 'light')
  assert.equal(
    state.root.style.backgroundColor,
    '#123456',
    'the computed CSS palette must drive the background'
  )
  assert.equal(state.meta.get('content'), '#123456')
})

test('missing or malformed saved values fall back to dark black and repair stored preferences', () => {
  state.storage.set('auren-theme', 'unknown-mode')
  state.storage.set('auren-appearance', '{broken-json')
  const value = render()
  assert.equal(value.themeMode, 'dark')
  assert.equal(value.appearancePreset, 'black')
  assert.equal(value.isDark, true)
  assert.equal(state.root.dataset.appearance, 'black')
  assert.equal(state.storage.get('auren-theme'), 'dark')
  assert.equal(state.storage.get('auren-appearance'), 'black')
})

test('choosing an appearance and explicit mode persists both and updates the live document', () => {
  let value = render()
  value.setAppearancePreset('slate')
  value.setThemeMode('light')
  state.computedBackground = '#F4F7FB'
  value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.appearancePreset, 'slate')
  assert.equal(state.storage.get('auren-theme'), 'light')
  assert.equal(state.storage.get('auren-appearance'), 'slate')
  assert.equal(state.root.dataset.appearance, 'slate')
  assert.equal(state.classes.has('dark'), false)
  assert.equal(state.root.style.backgroundColor, '#F4F7FB')
})

test('system mode follows media changes without replacing the saved system preference', () => {
  state.storage.set('auren-theme', 'system')
  state.media.matches = true
  assert.equal(render().isDark, true)
  state.emitMedia(false)
  let value = render()
  assert.equal(value.isDark, false)
  assert.equal(value.themeMode, 'system')
  assert.equal(state.root.style.colorScheme, 'light')
  assert.equal(state.storage.get('auren-theme'), 'system')
  state.emitMedia(true)
  value = render()
  assert.equal(value.isDark, true)
  assert.equal(state.classes.has('dark'), true)
})

test('toggling a system theme creates an explicit override that later media changes cannot undo', () => {
  state.storage.set('auren-theme', 'system')
  state.media.matches = true
  render().toggleTheme()
  let value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.isDark, false)
  state.emitMedia(false)
  state.emitMedia(true)
  value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.isDark, false)
  value.toggleTheme()
  value = render()
  assert.equal(value.themeMode, 'dark')
  assert.equal(state.storage.get('auren-theme'), 'dark')
})

test('storage events synchronize preferences, clearing restores defaults, and unmount removes listeners', () => {
  render()
  state.storage.set('auren-theme', 'light')
  state.emitStorage('auren-theme')
  assert.equal(render().themeMode, 'light')
  state.storage.set('auren-appearance', 'slate')
  state.emitStorage('auren-appearance')
  assert.equal(render().appearancePreset, 'slate')
  assert.equal(state.root.dataset.appearance, 'slate')
  state.storage.clear()
  state.emitStorage(null)
  const value = render()
  assert.equal(value.themeMode, 'dark')
  assert.equal(value.appearancePreset, 'black')
  assert.equal(state.mediaListeners.size, 1)
  assert.equal(state.storageListeners.size, 1)
  unmount()
  assert.equal(state.mediaListeners.size, 0)
  assert.equal(state.storageListeners.size, 0)
  const writes = state.writes
  state.emitMedia(false)
  state.emitStorage(null)
  assert.equal(state.writes, writes)
})

test('the first storage event preserves both preferences updated together in another tab', () => {
  render()
  state.storage.set('auren-theme', 'light')
  state.storage.set('auren-appearance', 'slate')
  state.emitStorage('auren-theme')
  let value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.appearancePreset, 'slate')
  assert.equal(state.root.dataset.appearance, 'slate')
  assert.equal(state.storage.get('auren-appearance'), 'slate', 'handling the mode event must not write an obsolete preset back to storage')
  state.emitStorage('auren-appearance')
  value = render()
  assert.equal(value.themeMode, 'light')
  assert.equal(value.appearancePreset, 'slate')
  assert.equal(value.isDark, false)
  assert.equal(state.storage.get('auren-theme'), 'light')
  assert.equal(state.storage.get('auren-appearance'), 'slate')
})

test('the actual first-paint script restores a saved palette and tracks system preference', () => {
  const browser = browserFixture()
  browser.storage.set('auren-theme', 'system')
  browser.storage.set('auren-appearance', 'slate')
  browser.media.matches = true
  runInNewContext(bootstrap, browser)
  assert.equal(browser.classes.has('dark'), true)
  assert.equal(browser.root.dataset.appearance, 'slate')
  assert.equal(browser.root.style.backgroundColor, '#0B1220')
  assert.equal(browser.meta.get('content'), '#0B1220')
  browser.media.matches = false
  runInNewContext(bootstrap, browser)
  assert.equal(browser.classes.has('dark'), false)
  assert.equal(browser.root.style.backgroundColor, '#F4F7FB')
})

test('the actual first-paint script handles corrupt or unavailable storage with the dark default', () => {
  const browser = browserFixture()
  browser.storage.set('auren-theme', 'invalid')
  browser.storage.set('auren-appearance', 'invalid')
  runInNewContext(bootstrap, browser)
  assert.equal(browser.classes.has('dark'), true)
  assert.equal(browser.root.dataset.appearance, 'black')
  assert.equal(browser.root.style.backgroundColor, '#09090B')
  browser.localStorage.getItem = () => {
    throw new Error('Storage unavailable')
  }
  runInNewContext(bootstrap, browser)
  assert.equal(browser.root.style.colorScheme, 'dark')
  assert.equal(browser.root.style.backgroundColor, '#09090B')
})
