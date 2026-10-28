import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { LIVE_TRADE_IDLE_MS, LIVE_TRADE_WARM_MS } from '../../src/services/trading/liveTradeSession.ts'

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/services/trading/liveTradeViewRetention.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { createLiveTradeViewRetention } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 })
  const cache = createLiveTradeViewRetention()
  const identity = { token: 'auth-a', firmId: 'tradesea', accountId: 'account-a', mode: 'live' }
  const update = (active, patch = {}, eligible = true) => cache.update({ active, eligible, identity: { ...identity, ...patch } })
  t.after(() => cache.dispose())
  return { cache, update }
}

test('dashboard never boots Trade before its first visit, then a 95-second return retains the exact view', (t) => {
  const f = fixture(t)
  f.update(false)
  assert.equal(f.cache.snapshot(), null)
  f.update(true)
  const first = f.cache.snapshot()
  f.update(false)
  t.mock.timers.tick(95_000)
  f.update(true)
  assert.equal(f.cache.snapshot().key, first.key, 'return beyond HTTP-cache TTL must preserve the widget')
  assert.equal(f.cache.snapshot().expiresAt, null)
  t.mock.timers.tick(600_000)
  assert.equal(f.cache.snapshot().key, first.key, 'an active Trade view has no idle deadline')
})

test('rapid route round trips cancel old deadlines and expire once after the latest departure', (t) => {
  const f = fixture(t)
  const halfWindow = LIVE_TRADE_IDLE_MS / 2
  f.update(true)
  const first = f.cache.snapshot().key
  f.update(false)
  t.mock.timers.tick(halfWindow)
  f.update(true)
  f.update(false)
  t.mock.timers.tick(halfWindow + 1)
  assert.equal(f.cache.snapshot().key, first)
  t.mock.timers.tick(LIVE_TRADE_IDLE_MS - halfWindow - 1)
  assert.equal(f.cache.snapshot(), null)
  f.update(true)
  assert.notEqual(f.cache.snapshot().key, first, 'expiry creates a fresh isolated view')
})

for (const patch of [{ token: null }, { token: 'auth-b' }, { firmId: 'other' }, { accountId: 'account-b' }, { mode: 'practice' }]) {
  test(`inactive ${Object.keys(patch)[0]} changes immediately dispose the old view`, (t) => {
    const f = fixture(t)
    f.update(true)
    f.update(false)
    f.update(false, patch)
    assert.equal(f.cache.snapshot(), null)
  })
}

test('active account selection preserves the provider-owned transition, but a later inactive change disposes it', (t) => {
  const f = fixture(t)
  f.update(true)
  const first = f.cache.snapshot().key
  f.update(true, { accountId: 'account-b' })
  assert.equal(f.cache.snapshot().key, first)
  f.update(false, { accountId: 'account-b' })
  assert.equal(f.cache.snapshot().key, first)
  f.update(false)
  assert.equal(f.cache.snapshot(), null)
})

test('entering a route that uses the shared practice provider disposes Live before it mounts', (t) => {
  const f = fixture(t)
  f.update(true)
  f.update(false, {}, false)
  assert.equal(f.cache.snapshot(), null)
})

test('suspended timers cannot let an expired view be reused before the delayed timer fires', (t) => {
  const f = fixture(t)
  f.update(true)
  const first = f.cache.snapshot().key
  f.update(false)
  t.mock.timers.setTime(Date.now() + LIVE_TRADE_IDLE_MS + 1)
  f.update(true)
  assert.notEqual(f.cache.snapshot().key, first)
})

for (const awayMs of [5 * 60_000, LIVE_TRADE_WARM_MS]) {
  test(`the actual Trade view survives a ${awayMs / 60_000}-minute dashboard visit`, (t) => {
    const f = fixture(t)
    f.update(true)
    const first = f.cache.snapshot().key
    f.update(false)
    t.mock.timers.tick(awayMs)
    assert.equal(f.cache.snapshot().key, first, 'cleanup must not win at exactly ten minutes')
    f.update(true)
    assert.equal(f.cache.snapshot().key, first, 'the retained widget must be reused')
    f.update(false)
    t.mock.timers.tick(LIVE_TRADE_IDLE_MS - 1)
    assert.equal(f.cache.snapshot().key, first)
    t.mock.timers.tick(1)
    assert.equal(f.cache.snapshot(), null, 'the retained view still expires after its grace period')
  })
}

test('lazy dashboard suspension cannot dispose the retained chart through React layout-effect cleanup', async () => {
  const parse = async (path) => ts.createSourceFile(path,
    await readFile(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const app = await parse('../../src/App.tsx')
  const boundaries = new Map()
  function visit(node, suspense = null) {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(app)
      if (name === 'Suspense') suspense = node
      if (name === 'LiveTradeViewRetention' || name === 'Routes') boundaries.set(name, suspense)
    }
    ts.forEachChild(node, (child) => visit(child, suspense))
  }
  visit(app)
  assert.ok(boundaries.get('LiveTradeViewRetention'))
  assert.ok(boundaries.get('Routes'))
  assert.notEqual(boundaries.get('LiveTradeViewRetention'), boundaries.get('Routes'),
    'a lazy dashboard must not hide the live view through the same Suspense boundary')

  const retention = await parse('../../src/components/trading/Live/LiveTradeViewRetention.tsx')
  const disposalHooks = []
  function visitEffects(node, hook = null) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(retention)
      if (callee === 'useEffect' || callee === 'useLayoutEffect') hook = callee
      if (callee === 'cache.dispose') disposalHooks.push(hook)
    }
    ts.forEachChild(node, (child) => visitEffects(child, hook))
  }
  visitEffects(retention)
  assert.deepEqual(disposalHooks, ['useEffect'],
    'React temporarily cleans up layout effects when Suspense hides a mounted tree; only unmount may dispose it')
})
