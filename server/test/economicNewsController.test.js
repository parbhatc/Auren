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
