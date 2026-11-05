import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const built = await build({
  entryPoints: [fileURLToPath(new URL('../../src/utils/mobileTradePrefs.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', write: false,
})

function fixture() {
  const values = new Map()
  const events = []
  const module = { exports: {} }
  vm.runInNewContext(built.outputFiles[0].text, {
    module, exports: module.exports, Event,
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    window: { dispatchEvent: event => events.push(event.type) },
  })
  return { ...module.exports, values, events }
}

test('mobile entry choice survives market pad minimization, floating and docking for its account', () => {
  const f = fixture()
  f.setMobileEntryMode('a', 'auto')
  f.setMobileQuickTradeMinimized('a', false)
  f.setMobileFloatingPad('a', true)
  f.setMobileFloatingPad('a', false)
  assert.equal(f.getMobileTradePrefs('a').entryMode, 'auto')
  assert.equal(f.getMobileTradePrefs('b').entryMode, 'both')
  f.setMobileEntryMode('b', 'market')
  assert.equal(f.getMobileTradePrefs('a').entryMode, 'auto')
  assert.equal(f.getMobileTradePrefs('b').entryMode, 'market')
  assert.equal(f.events.length, 5)
})

test('existing and malformed preferences retain working controls when adding entry modes', () => {
  const f = fixture()
  f.saveMobileTradePrefs('a', { floatingPad: true, quickTradeMinimized: false })
  assert.equal(f.getMobileTradePrefs('a').entryMode, 'both')
  assert.equal(f.getMobileTradePrefs('a').floatingPad, true)
  f.saveMobileTradePrefs('a', { entryMode: 'unknown', floatingPad: false, quickTradeMinimized: true })
  assert.equal(f.getMobileTradePrefs('a').entryMode, 'both')
})
