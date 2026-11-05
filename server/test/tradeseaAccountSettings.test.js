import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { test } from 'node:test'
import sqlite3 from 'sqlite3'
import { TradeseaAccountSettingsStore, validateAccountSettings } from '../src/services/tradesea/TradeseaAccountSettings.js'
import Settings from '../src/services/tradesea/TradeseaAccountSettings.js'
import Identity from '../src/services/tradesea/TradeseaIdentityService.js'
import Controller from '../src/controllers/TradeseaController.js'

const account = (id, extra = {}) => ({ id, label: `Lucid Trading | ${id}`, name: id, ...extra })
async function fixture(t) {
  const connection = new sqlite3.Database(':memory:')
  const db = { run: promisify(connection.run.bind(connection)), query: promisify(connection.all.bind(connection)) }
  await db.run('CREATE TABLE users (id TEXT PRIMARY KEY)')
  await db.run("INSERT INTO users VALUES ('alice'), ('bob')")
  t.after(() => promisify(connection.close.bind(connection))())
  return { db, store: new TradeseaAccountSettingsStore(db) }
}

test('confirmed rules persist across store instances and remain isolated by user', async t => {
  const { store, db } = await fixture(t)
  await store.remember('alice', [account('LFE025-A')])
  await store.remember('bob', [account('LFE025-A')])
  await store.save('alice', 'LFE025-A', { dllEnabled: true, dllAmount: 600, consistencyPercent: 40 })
  const restarted = new TradeseaAccountSettingsStore(db)
  const [saved] = await restarted.list('alice')
  assert.equal(saved.ruleSettings.dllAmount, 600)
  assert.equal(saved.ruleSettings.consistencyPercent, 40)
  assert.equal((await restarted.list('bob'))[0].ruleSettings, null)
})

test('missing, archived, empty provider lists and reconnects preserve saved account settings', async t => {
  const { store } = await fixture(t)
  await store.remember('alice', [account('LFE025-A')])
  await store.save('alice', 'LFE025-A', { dllEnabled: false, consistencyPercent: 50 })
  await store.remember('alice', [])
  let [saved] = await store.list('alice')
  assert.equal(saved.providerAvailable, false)
  assert.equal(saved.ruleSettings.dllEnabled, false)
  await store.remember('alice', [account('LFE025-A', { isArchived: true })])
  ;[saved] = await store.list('alice')
  assert.equal(saved.isArchived, true)
  assert.equal(saved.ruleSettings.consistencyPercent, 50)
  await store.remember('alice', [account('LFE025-A')])
  assert.equal((await store.list('alice'))[0].providerAvailable, true)
})

test('manual removal clears details and rules, stays removed on refresh, and can be explicitly restored', async t => {
  const { store, db } = await fixture(t)
  await store.remember('alice', [account('LFE025-A')])
  await store.remember('bob', [account('LFE025-A')])
  await store.save('alice', 'LFE025-A', { dllEnabled: true, dllAmount: 600 })
  await store.remove('alice', 'LFE025-A')
  await store.remember('alice', [account('LFE025-A')])
  assert.deepEqual(await store.list('alice'), [])
  assert.equal((await store.list('bob')).length, 1)
  const [tombstone] = await db.query("SELECT account_details, settings FROM tradesea_account_settings WHERE user_id = 'alice'")
  assert.equal(tombstone.account_details, null)
  assert.equal(tombstone.settings, '{}')
  await store.remember('alice', [account('LFE025-A')], { full: false, restore: true })
  assert.equal((await store.list('alice'))[0].ruleSettings, null)
})

test('clearing rules retains the saved account; deleting the Auren user removes all saved rows', async t => {
  const { store, db } = await fixture(t)
  await store.remember('alice', [account('LFE025-A')])
  await store.save('alice', 'LFE025-A', { dllEnabled: true, dllAmount: 600 })
  await store.save('alice', 'LFE025-A', {})
  assert.equal((await store.list('alice'))[0].ruleSettings, null)
  await db.run("DELETE FROM users WHERE id = 'alice'")
  assert.deepEqual(await db.query('SELECT * FROM tradesea_account_settings'), [])
})

test('settings validation rejects malformed, unbounded or unknown fields and preserves false/zero choices', () => {
  for (const body of [null, [], { dllEnabled: 'false' }, { dllAmount: -1 }, { consistencyPercent: 101 }, { maxLoss: 0 }, { profitTarget: Infinity }, { drawdownMethod: 'random' }, { userId: 'bob' }]) {
    assert.throws(() => validateAccountSettings(body))
  }
  const settings = validateAccountSettings({ dllEnabled: false, dllAmount: 600, consistencyPercent: 0 })
  assert.equal(settings.dllEnabled, false)
  assert.equal(settings.dllAmount, null)
  assert.equal(settings.consistencyPercent, 0)
})

test('strict account parsing rejects failures and malformed lists while accepting authoritative empty results', () => {
  for (const body of [{ status: 'error', data: [] }, { status: 'success' }, '<html>failure</html>']) {
    assert.throws(() => Identity.parseAccountsBody(body, { strict: true }))
  }
  assert.deepEqual(Identity.parseAccountsBody({ status: 'success', data: [] }, { strict: true }), [])
})

const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('saved-account writes check the current user and support editing offline saved accounts', async t => {
  const writes = []
  t.mock.method(Settings, 'list', async user => user === 'alice' ? [account('saved')] : [])
  t.mock.method(Settings, 'save', async (...args) => { writes.push(args); return args[2] })
  t.mock.method(Controller, 'resolveTradeseaSession', async () => ({ connected: false }))
  const own = response()
  await Controller.saveAccountSettings({ user: { id: 'alice' }, params: { accountId: 'saved' }, body: { dllEnabled: false } }, own)
  assert.equal(own.code, 200)
  assert.equal(writes[0][0], 'alice')
  const other = response()
  await Controller.saveAccountSettings({ user: { id: 'bob' }, params: { accountId: 'saved' }, body: { dllEnabled: true } }, other)
  assert.equal(other.body.success, false)
  assert.equal(writes.length, 1)
})

test('disconnected account discovery never changes saved profiles', async t => {
  t.mock.method(Controller, 'resolveTradeseaSession', async () => ({ configured: true, connected: false, sessionExpired: true }))
  const remember = t.mock.method(Settings, 'remember', async () => { throw new Error('Should not run') })
  const result = response()
  await Controller.getAccounts({ user: { id: 'alice' } }, result)
  assert.equal(result.body.connected, false)
  assert.equal(remember.mock.callCount(), 0)
})
