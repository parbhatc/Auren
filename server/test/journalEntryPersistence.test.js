import test from 'node:test'
import assert from 'node:assert/strict'
import sqlite3 from 'sqlite3'
import Database from '../src/config/Database.js'
import controller from '../src/controllers/TradingJournalController.js'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII='

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

test('journal API persists recaps, keeps lists lightweight, and scopes CRUD to the owner', async (t) => {
  const previousDb = Database.db
  const db = new sqlite3.Database(':memory:')
  Database.db = db
  t.after(async () => { Database.db = previousDb; await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve())) })
  await Database.createTables()
  // Exercise the existing-database migration path as well as a fresh install.
  await Database.run('ALTER TABLE journal_entries DROP COLUMN recap')
  await Database.createTables()
  assert.ok((await Database.query('PRAGMA table_info(journal_entries)')).some((column) => column.name === 'recap'))
  const body = { playbook: 'Sweep + IFVG', symbol: 'NQ', dateTime: '2026-09-10T09:30', exitDateTime: '', side: 'long', entryPrice: '', closePrice: '', size: '1', pnl: '', outcome: 'planned', conditionResponses: { 'Clear targets': '' }, notes: 'Original note', recap: { title: 'Setup one', execution: 'missed', lesson: 'Wait', screenshots: [{ id: 'chart', caption: 'Before', dataUrl: png }] } }
  const created = response()
  await controller.createJournalEntry({ user: { id: 'owner' }, body }, created)
  assert.equal(created.statusCode, 200, JSON.stringify(created.body))
  const id = created.body.entry.id
  assert.equal(created.body.entry.recap.screenshots[0].dataUrl, png)

  const listed = response()
  await controller.getJournalEntries({ user: { id: 'owner' } }, listed)
  assert.equal(listed.body.entries[0].recap.screenshots, undefined)
  assert.equal(listed.body.entries[0].recap.screenshotCount, 1)
  assert.ok(!JSON.stringify(listed.body).includes('base64'))

  const detail = response()
  await controller.getJournalEntry({ user: { id: 'owner' }, params: { id } }, detail)
  assert.equal(detail.body.entry.recap.screenshots[0].caption, 'Before')
  const { recap: _recap, ...legacyBody } = body
  const updated = response()
  await controller.updateJournalEntry({ user: { id: 'owner' }, params: { id }, body: { ...legacyBody, notes: 'Updated by an older client' } }, updated)
  assert.equal(updated.body.entry.recap.screenshots.length, 1)
  assert.equal(updated.body.entry.notes, 'Updated by an older client')

  for (const method of ['getJournalEntry', 'updateJournalEntry', 'deleteJournalEntry']) {
    const denied = response()
    await controller[method]({ user: { id: 'other-user' }, params: { id }, body }, denied)
    assert.equal(denied.statusCode, 404, method)
  }
  const invalid = response()
  await controller.updateJournalEntry({ user: { id: 'owner' }, params: { id }, body: { ...body, recap: { screenshots: [{ dataUrl: 'https://example.com/chart.svg' }] } } }, invalid)
  assert.equal(invalid.statusCode, 400)
  const otherPlaybook = response()
  await controller.createJournalEntry({ user: { id: 'owner' }, body: { ...body, strategyId: 'not-owned' } }, otherPlaybook)
  assert.equal(otherPlaybook.statusCode, 400)
  const removed = response()
  await controller.deleteJournalEntry({ user: { id: 'owner' }, params: { id } }, removed)
  assert.equal(removed.body.success, true)
  assert.equal(await Database.get('SELECT id FROM journal_entries WHERE id = ?', [id]), undefined)
  for (const source of ['practice', 'live', 'replay']) {
    const captured = response()
    await controller.createJournalEntry({ user: { id: 'owner' }, body: { ...body, source, sourceSessionId: 'account-or-session', sourceTradeId: 'open-position', sourceContext: { snapshotKind: 'open_position' } } }, captured)
    assert.equal(captured.body.entry.source, source)
    assert.equal(captured.body.entry.sourceTradeId, 'open-position')
    assert.equal(captured.body.entry.sourceContext.snapshotKind, 'open_position')
    assert.equal(captured.body.entry.pnl, '')
  }
  await Database.run("INSERT INTO strategies (id, user_id, name) VALUES ('private-playbook', 'owner', 'Private setup')")
  await Database.run("INSERT INTO daily_reviews (id, user_id, review_date) VALUES ('private-review', 'owner', '2026-09-10')")
  for (const [handler, target, payload] of [
    ['updateStrategy', 'private-playbook', { name: 'Attempt', timeframes: [], entry_conditions: [], invalidation_rules: [] }],
    ['updateDailyReview', 'private-review', { followed_rules: true }],
  ]) {
    const denied = response()
    await controller[handler]({ user: { id: 'other-user' }, params: { id: target }, body: payload }, denied)
    assert.equal(denied.statusCode, 404)
    assert.equal(denied.body.strategy, undefined)
    assert.equal(denied.body.review, undefined)
  }
})
