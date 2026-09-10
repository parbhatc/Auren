import test from 'node:test'
import assert from 'node:assert/strict'
import { isJournalImage, normalizeJournalRecap, summarizeJournalEntry, journalLocalDateTime, validateJournalEntry } from '../../shared/journalRecap.js'
import { conditionsForJournalEntry, parseLiquiditySweeps, serializeLiquiditySweeps, parsePdaDeliveries, serializePdaDeliveries, formatRiskLeg } from '../../src/journal/journalConditions.ts'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII='

test('recap keeps screenshots, typed checklist snapshots, and review fields', () => {
  const recap = normalizeJournalRecap({ title: ' Setup 1 ', execution: 'missed', grade: 'A', lesson: 'Wait for confirmation', mistakeTags: ['FOMO', 'FOMO', 'unknown'], setupConditions: [{ id: 'sweep', label: 'Liquidity sweep', type: 'liquidity_sweep' }], screenshots: [{ id: 'before', caption: 'Before entry', dataUrl: png }] })
  assert.equal(recap.title, 'Setup 1')
  assert.equal(recap.execution, 'missed')
  assert.equal(recap.grade, 'A')
  assert.deepEqual(recap.mistakeTags, ['FOMO'])
  assert.equal(recap.setupConditions[0].type, 'liquidity_sweep')
  assert.equal(recap.screenshotCount, 1)
  assert.equal(recap.screenshots[0].dataUrl, png)
  const summary = summarizeJournalEntry({ id: 'one', recap })
  assert.equal(summary.recap.screenshotCount, 1)
  assert.equal(summary.recap.screenshots, undefined)
  assert.equal(recap.screenshots.length, 1, 'summarization must not mutate the detail record')
})

test('recap rejects oversized, non-raster, forged, external, and excessive images', () => {
  assert.equal(isJournalImage(png), true)
  for (const value of ['https://example.com/chart.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', `data:image/png;base64,${'A'.repeat(800000)}`]) {
    assert.equal(isJournalImage(value), false)
    assert.throws(() => normalizeJournalRecap({ screenshots: [{ dataUrl: value }] }), /Screenshots/)
  }
  assert.throws(() => normalizeJournalRecap({ screenshots: Array(5).fill({ dataUrl: png }) }), /four/)
  assert.equal(normalizeJournalRecap(null).screenshots.length, 0)
})

test('journal datetime defaults preserve local wall time instead of converting to UTC', () => {
  assert.equal(journalLocalDateTime(new Date(2026, 8, 10, 9, 5)), '2026-09-10T09:05')
})

test('entry validation permits untraded setups and rejects invalid prices and reversed dates', () => {
  const entry = { playbook: 'Sweep', symbol: 'NQ', dateTime: '2026-09-10T09:30', outcome: 'planned' }
  assert.equal(validateJournalEntry(entry), '')
  assert.match(validateJournalEntry({ ...entry, exitDateTime: '2026-09-10T09:20' }), /Exit time/)
  assert.match(validateJournalEntry({ ...entry, pnl: 'NaN' }), /Net P&L/)
  assert.match(validateJournalEntry({ ...entry, size: 0 }), /positive/)
  assert.equal(validateJournalEntry({ ...entry, pnl: '0', size: '1' }), '')
})

test('extracted condition helpers preserve legacy and detailed evidence formats', () => {
  const sweeps = [{ sweepTime: '9:10 AM', referenceTime: '8:00 AM', level: 'low', price: '20000', sourceLabel: 'Asia low' }]
  assert.deepEqual(parseLiquiditySweeps(serializeLiquiditySweeps(sweeps)), sweeps)
  assert.equal(parseLiquiditySweeps('9:10 AM | high | $20300')[0].price, '20300')
  const pdas = [{ time: '9:20 AM', timeframe: '15m', pda: 'FVG', candles: ['8:30 AM', '8:45 AM', '9:00 AM'] }]
  assert.deepEqual(parsePdaDeliveries(serializePdaDeliveries(pdas)), pdas)
  assert.equal(formatRiskLeg({}), 'Not set')
})

test('saved checklists retain unanswered conditions and custom responses after a playbook changes', () => {
  const entry = { recap: { setupConditions: [{ id: 'targets', label: 'Clear targets', type: 'boolean' }] }, conditionResponses: { 'Old custom note': 'Keep this evidence' } }
  const conditions = conditionsForJournalEntry(entry, [{ id: 'new', label: 'Renamed condition', type: 'text' }])
  assert.deepEqual(conditions.map((item) => item.label), ['Clear targets', 'Old custom note'])
  assert.equal(conditions[0].type, 'boolean')
})
