import test from 'node:test'
import assert from 'node:assert/strict'
import { EconomicNewsController } from '../src/controllers/EconomicNewsController.js'

test('partial weekly cache triggers one full month import for concurrent replay days', async () => {
  const controller = new EconomicNewsController()
  let saved = { coverage: 'partial' }
  let calls = 0
  controller.loadNewsData = async () => saved
  controller.getEventsFromFile = async () => [{date:'2024-10-01',event:'ISM Manufacturing PMI'}]
  controller.scrapeForexFactory = async () => {
    calls++
    await new Promise(resolve => setImmediate(resolve))
    return [{date:'2024-10-01',event:'ISM Manufacturing PMI'}]
  }
  controller.saveEvents = async events => { saved = {coverage:events.coverage} }
  await Promise.all([controller.ensureMonth(2024,10),controller.ensureMonth(2024,10)])
  assert.equal(calls,1)
  assert.equal(saved.coverage,'month')
  await controller.ensureMonth(2024,10)
  assert.equal(calls,1)
})

test('failed monthly import does not overwrite saved news with an empty success', async () => {
  const controller = new EconomicNewsController()
  controller.loadNewsData = async () => ({coverage:'partial'})
  controller.scrapeForexFactory = async () => []
  controller.saveEvents = async () => assert.fail('must preserve saved events')
  await assert.rejects(controller.ensureMonth(2024,9), /no calendar data/)
})
