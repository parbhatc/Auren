import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/navigation/pwaTerminalResume.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { rememberPwaTerminalRoute, restorePwaTerminalRoute, clearPwaTerminalRoute } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

function withBrowser(run) {
  const original = globalThis.window
  const values = new Map([['token', 'session']])
  let standalone = true
  function launch(url = '/') {
    const { pathname, search, hash } = new URL(url, 'https://auren.example')
    const location = { pathname, search, hash }
    globalThis.window = {
      location,
      matchMedia: () => ({ matches: false }),
      navigator: { standalone },
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
      history: { state: null, replaceState: (_state, _title, path) => { location.pathname = path } },
    }
    restorePwaTerminalRoute()
    return location.pathname
  }
  try {
    run({ launch, values, setStandalone: (enabled) => { standalone = enabled } })
  } finally {
    if (original === undefined) delete globalThis.window
    else globalThis.window = original
  }
}

test('installed Auren restores Practice and Live Trade on a cold launch', () => {
  withBrowser(({ launch }) => {
    for (const path of ['/practice', '/trade', '/practice/trade/account_123']) {
      assert.equal(launch(path), path)
      rememberPwaTerminalRoute(path)
      assert.equal(launch(), path)
    }
  })
})

test('browser tabs, explicit links, leaving a terminal and logout do not redirect to a terminal', () => {
  withBrowser(({ launch, values, setStandalone }) => {
    launch('/trade')
    rememberPwaTerminalRoute('/trade')
    assert.equal(launch('/practice'), '/practice')
    assert.equal(launch('/?mode=live'), '/')
    assert.equal(launch('/#home'), '/')
    rememberPwaTerminalRoute('/practice/trade/account_123/stats')
    assert.equal(launch(), '/')
    rememberPwaTerminalRoute('/trade')

    setStandalone(false)
    assert.equal(launch(), '/')
    rememberPwaTerminalRoute('/practice')
    setStandalone(true)
    assert.equal(launch(), '/trade')

    rememberPwaTerminalRoute('/dashboard')
    assert.equal(launch(), '/')
    rememberPwaTerminalRoute('/trade')
    values.delete('token')
    assert.equal(launch(), '/')
    clearPwaTerminalRoute()
    values.set('token', 'new-session')
    assert.equal(launch(), '/')
  })
})
