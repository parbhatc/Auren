import test from 'node:test'
import assert from 'node:assert/strict'

import { EconomicNewsController } from '../src/controllers/EconomicNewsController.js'

test('ForexFactory weekly JSON is normalized to Eastern calendar events', () => {
  const controller = new EconomicNewsController()
  const events = controller.formatForexFactoryJsonEvents([
    {
      title: 'ADP Weekly Employment Change',
      country: 'USD',
      date: '2026-10-06T08:15:00-04:00',
      impact: 'High',
      forecast: '20.0K',
      previous: '18.0K',
    },
    {
      title: 'Outside requested month',
      country: 'USD',
      date: '2026-11-01T08:30:00-05:00',
      impact: 'Low',
    },
  ], 2026, 10)

  assert.equal(events.length, 1)
  assert.deepEqual(events[0], {
    id: 'ff-2026-10-06-8-15am-usd-adp-weekly-employment-change-0',
    date: '2026-10-06',
    time: '8:15am',
    timeLabel: '8:15am',
    currency: 'USD',
    event: 'ADP Weekly Employment Change',
    impact: 'high',
    forecast: '20.0K',
    previous: '18.0K',
    actual: null,
  })
})

test('weekly calendar fetch uses the official ForexFactory export', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  let requestedUrl = null
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return [{
          title: 'Trade Balance',
          country: 'USD',
          date: '2026-10-06T08:30:00-04:00',
          impact: 'Medium',
          forecast: '-100.8B',
          previous: '-88.6B',
        }]
      },
    }
  }

  const controller = new EconomicNewsController()
  const events = await controller.fetchForexFactoryWeeklyJson(2026, 10)

  assert.equal(requestedUrl, 'https://nfs.faireconomy.media/ff_calendar_thisweek.json')
  assert.equal(events.length, 1)
  assert.equal(events[0].timeLabel, '8:30am')
  assert.equal(events[0].impact, 'medium')
})

test('current-week refresh merges updated ForexFactory values without dropping cached days', async () => {
  const controller = new EconomicNewsController()
  const cached = [
    { date: '2026-11-01', time: '8:30am', currency: 'USD', event: 'Old Event', actual: '1' },
    { date: '2026-11-06', time: '8:30am', currency: 'USD', event: 'Payrolls', actual: '10K' },
  ]
  const weekly = [
    { date: '2026-11-06', time: '8:30am', timeLabel: '8:30am', currency: 'USD', event: 'Payrolls', actual: '25K' },
  ]
  let saved = null

  controller.fetchForexFactoryWeeklyJson = async () => weekly
  controller.getEventsFromFile = async () => saved || cached
  controller.saveEvents = async (events) => { saved = events }

  const events = await controller.refreshCurrentWeek(2026, 11)

  assert.equal(events.length, 2)
  assert.equal(events.find((event) => event.event === 'Old Event').actual, '1')
  assert.equal(events.find((event) => event.event === 'Payrolls').actual, '25K')
})

test('current-week refresh serves cached news when ForexFactory rate limits the refresh', async () => {
  const controller = new EconomicNewsController()
  const cached = [{ date: '2026-11-06', time: '8:30am', currency: 'USD', event: 'Payrolls' }]
  controller.getEventsFromFile = async () => cached
  controller.fetchForexFactoryWeeklyJson = async () => {
    throw new Error('ForexFactory JSON export returned HTTP 429')
  }
  controller.saveEvents = async () => assert.fail('must not replace a valid cache')

  assert.equal(await controller.refreshCurrentWeek(2026, 11), cached)
})

test('current-month refresh prefers ChromeProX monthly data', async () => {
  const controller = new EconomicNewsController()
  const scraped = [{ date: '2026-11-03', time: '8:30am', currency: 'USD', event: 'CPI' }]
  let saved = null
  controller.scrapeForexFactory = async () => scraped
  controller.saveEvents = async (events) => { saved = events }
  controller.getEventsFromFile = async () => saved
  controller.refreshCurrentWeek = async () => assert.fail('weekly fallback should not run')

  const events = await controller.refreshCurrentMonth(2026, 11)

  assert.equal(events, scraped)
  assert.equal(saved.coverage, 'month')
})

test('current-month refresh falls back to the official week if ChromeProX fails', async () => {
  const controller = new EconomicNewsController()
  const fallback = [{ date: '2026-11-06', time: '8:30am', currency: 'USD', event: 'Payrolls' }]
  controller.scrapeForexFactory = async () => { throw new Error('browser unavailable') }
  controller.refreshCurrentWeek = async () => fallback

  assert.equal(await controller.refreshCurrentMonth(2026, 11), fallback)
})
