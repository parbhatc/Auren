import test from 'node:test'
import assert from 'node:assert/strict'
import sqlite3 from 'sqlite3'
import Database from '../src/config/Database.js'
import controller from '../src/controllers/TradingJournalController.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('building block library persists custom blocks and scopes them to their owner', async (t) => {
  const previousDb = Database.db
  const db = new sqlite3.Database(':memory:')
  Database.db = db
  t.after(async () => {
    Database.db = previousDb
    await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()))
  })
  await Database.createTables()

  const created = response()
  await controller.createBuildingBlock({
    user: { id: 'owner' },
    body: { name: 'IFVG', type: 'timeframe_time', description: 'Inversion gap evidence' },
  }, created)
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.block.name, 'IFVG')

  const listed = response()
  await controller.getBuildingBlocks({ user: { id: 'owner' } }, listed)
  assert.equal(listed.body.blocks.length, 1)
  assert.equal(listed.body.blocks[0].type, 'timeframe_time')

  const otherUser = response()
  await controller.getBuildingBlocks({ user: { id: 'other-user' } }, otherUser)
  assert.deepEqual(otherUser.body.blocks, [])

  const duplicate = response()
  await controller.createBuildingBlock({
    user: { id: 'owner' },
    body: { name: 'ifvg', type: 'timeframe_time' },
  }, duplicate)
  assert.equal(duplicate.statusCode, 409)

  const invalid = response()
  await controller.createBuildingBlock({
    user: { id: 'owner' },
    body: { name: 'Unknown', type: 'unsupported' },
  }, invalid)
  assert.equal(invalid.statusCode, 400)

  const denied = response()
  await controller.deleteBuildingBlock({
    user: { id: 'other-user' },
    params: { id: created.body.block.id },
  }, denied)
  assert.equal(denied.statusCode, 404)

  const removed = response()
  await controller.deleteBuildingBlock({
    user: { id: 'owner' },
    params: { id: created.body.block.id },
  }, removed)
  assert.equal(removed.body.success, true)
})
