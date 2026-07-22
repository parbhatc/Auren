import test from 'node:test'
import assert from 'node:assert/strict'

import TradingJournalController from '../src/controllers/TradingJournalController.js'

test('manual journal URLs use compact unique identifiers', () => {
  const first = TradingJournalController.journalEntryId()
  const second = TradingJournalController.journalEntryId()

  assert.match(first, /^jt_[A-Za-z0-9_-]{12}$/)
  assert.notEqual(first, second)
})

test('manual journal payload keeps flexible setup details and normalizes identity fields', () => {
  const values = TradingJournalController.journalEntryValues({
    playbook: ' LIQ SWEEP + HTF PDA + IFVG ',
    dateTime: '2026-07-16T09:22',
    exitDateTime: '2026-07-16T09:35',
    symbol: 'nq',
    side: 'short',
    outcome: 'win',
    pnl: 285,
    conditionResponses: {
      IFVG: '1m @ 9:22 AM',
      'HTF bias aligned': true,
    },
  })

  assert.equal(values.playbook, 'LIQ SWEEP + HTF PDA + IFVG')
  assert.equal(values.dateTime, '2026-07-16T09:22')
  assert.equal(values.exitDateTime, '2026-07-16T09:35')
  assert.equal(values.symbol, 'NQ')
  assert.equal(values.side, 'short')
  assert.equal(values.outcome, 'win')
  assert.equal(values.pnl, '285')
  assert.deepEqual(values.conditionResponses, {
    IFVG: '1m @ 9:22 AM',
    'HTF bias aligned': true,
  })
})

test('stored manual journal rows parse into the frontend record contract', () => {
  const entry = TradingJournalController.parseJournalEntry({
    id: 'journal-nq-2026-07-16-test',
    strategy_id: 'strategy-1',
    playbook_name: 'LIQ SWEEP + HTF PDA + IFVG',
    entry_datetime: '2026-07-16T09:22',
    exit_datetime: '2026-07-16T09:35',
    symbol: 'NQ',
    side: 'short',
    entry_price: '29249.25',
    close_price: '29235.00',
    position_size: '1',
    pnl: '285.00',
    outcome: 'win',
    condition_responses: '{"IFVG":"1m @ 9:22 AM"}',
    notes: 'Test entry',
  })

  assert.equal(entry.dateTime, '2026-07-16T09:22')
  assert.equal(entry.exitDateTime, '2026-07-16T09:35')
  assert.equal(entry.pnl, '285.00')
  assert.deepEqual(entry.conditionResponses, { IFVG: '1m @ 9:22 AM' })
})

test('manual journal accepts breakeven as a first-class outcome', () => {
  const values = TradingJournalController.journalEntryValues({
    playbook: 'Test setup',
    dateTime: '2026-07-16T11:00',
    symbol: 'NQ',
    side: 'long',
    pnl: '0',
    outcome: 'breakeven',
  })

  assert.equal(values.outcome, 'breakeven')
  assert.equal(values.pnl, '0')
})

test('replay journal metadata and universal risk rules survive normalization', () => {
  const values = TradingJournalController.journalEntryValues({
    playbook: 'Any custom playbook',
    dateTime: '2026-07-21T10:18:00',
    symbol: 'ES',
    source: 'replay',
    sourceSessionId: 'session-123',
    sourceContext: { chartResolution: '30S', snapshotKind: 'cursor' },
    riskPlan: {
      stopLoss: { mode: 'dynamic', value: 'Close beyond confirmation zone', timeframe: '30s' },
      breakEven: { enabled: true, mode: 'strict_r', value: '1', basis: '1R' },
      takeProfit: { mode: 'fixed', price: '6375.25' },
    },
    conditionResponses: { 'Completely custom condition': 'User-defined evidence' },
  })

  assert.equal(values.source, 'replay')
  assert.equal(values.sourceSessionId, 'session-123')
  assert.deepEqual(values.sourceContext, { chartResolution: '30S', snapshotKind: 'cursor' })
  assert.equal(values.riskPlan.stopLoss.mode, 'dynamic')
  assert.deepEqual(values.conditionResponses, { 'Completely custom condition': 'User-defined evidence' })
})

test('stored replay rows parse source context and risk plan JSON', () => {
  const entry = TradingJournalController.parseJournalEntry({
    id: 'jt_replaytest12',
    playbook_name: 'Breakout continuation',
    entry_datetime: '2026-07-21T10:18:00',
    symbol: 'ES',
    side: 'long',
    condition_responses: '{"Volume confirmed":true}',
    source: 'replay',
    source_session_id: 'session-123',
    source_context: '{"chartResolution":"5"}',
    risk_plan: '{"stopLoss":{"mode":"fixed","price":"6360"}}',
  })

  assert.equal(entry.source, 'replay')
  assert.equal(entry.sourceSessionId, 'session-123')
  assert.deepEqual(entry.sourceContext, { chartResolution: '5' })
  assert.deepEqual(entry.riskPlan.stopLoss, { mode: 'fixed', price: '6360' })
  assert.deepEqual(entry.conditionResponses, { 'Volume confirmed': true })
})
