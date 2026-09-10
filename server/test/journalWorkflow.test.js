import test from 'node:test'
import assert from 'node:assert/strict'
import sqlite3 from 'sqlite3'
import Database from '../src/config/Database.js'
import controller from '../src/controllers/TradingJournalController.js'
import { journalAnalytics, journalPeriod } from '../../shared/journalAnalytics.js'
import { normalizeJournalRecap } from '../../shared/journalRecap.js'
import {
  applyJournalExecution,
  practiceJournalExecution,
} from '../../src/journal/journalExecutions.ts'
import { journalDraftKey } from '../../src/journal/journalDraftStore.ts'

const base = {
  id: '',
  playbook: 'Sweep',
  symbol: 'NQ',
  side: 'short',
  dateTime: '2026-09-10T09:45',
  exitDateTime: '',
  entryPrice: '20000',
  closePrice: '',
  size: '2',
  pnl: '',
  outcome: 'planned',
  conditionResponses: {},
  notes: 'Keep my note',
}
const response = () => ({
  code: 200,
  status(code) {
    this.code = code
    return this
  },
  json(body) {
    this.body = body
    return this
  },
})
const call = async (method, args) => {
  const res = response()
  await controller[method]({ user: { id: 'owner' }, ...args }, res)
  return res
}

test('analytics excludes observations, open/unknown and gross-only P&L; R and tagged losses use distinct samples', () => {
  const closed = {
    ...base,
    outcome: 'loss',
    pnl: '-50',
    recap: { execution: 'taken', riskDollars: '25', mistakeTags: ['FOMO', 'Moved stop', 'FOMO'] },
  }
  const data = journalAnalytics([
    closed,
    { ...closed, pnl: '100', outcome: 'win', recap: { riskDollars: '50' } },
    { ...closed, pnl: '900', recap: { execution: 'missed' } },
    { ...closed, pnl: '800', recap: { execution: 'observation' } },
    { ...base, pnl: '700' },
    { ...closed, pnl: '' },
    { ...closed, sourceContext: { pnlBasis: 'gross' } },
  ])
  assert.equal(data.count, 2)
  assert.equal(data.netPnl, 50)
  assert.equal(data.winRate, 50)
  assert.equal(data.expectancy, 25)
  assert.equal(data.averageR, 0)
  assert.equal(data.rCount, 2)
  assert.equal(data.mistakeLoss, 50)
  assert.equal(data.byMistake.find((g) => g.label === 'FOMO').count, 1)
  assert.equal(data.open, 1)
  assert.equal(data.missed, 1)
  assert.equal(data.observations, 1)
  assert.equal(data.missingPnl, 2)
  assert.equal(journalAnalytics([]).winRate, null)
  assert.deepEqual(journalPeriod('weekly', '2026-09-07'), {
    start: '2026-09-07',
    end: '2026-09-14',
  })
  assert.throws(() => journalPeriod('weekly', '2026-09-10'))
  assert.throws(() => journalPeriod('daily', '2026-02-30'))
})

test('execution merge preserves evidence and source identity; drafts are isolated per owner', () => {
  const entry = {
    ...base,
    source: 'practice',
    sourceSessionId: 'pa',
    sourceTradeId: 'position',
    version: 2,
    recap: { lesson: 'Keep', riskDollars: '100' },
    conditionResponses: { IFVG: true },
  }
  const updated = applyJournalExecution(entry, {
    id: 'closed',
    symbol: 'CME:NQ',
    side: 'short',
    entryPrice: '20000',
    closePrice: '19990',
    size: '2',
    dateTime: entry.dateTime,
    exitDateTime: '2026-09-10T10:00',
    pnl: '395',
    fees: '5',
  })
  assert.equal(updated.pnl, '395')
  assert.equal(updated.outcome, 'win')
  assert.equal(updated.sourceTradeId, 'position')
  assert.equal(updated.sourceContext.executionId, 'closed')
  assert.equal(updated.version, 2)
  assert.deepEqual(updated.recap, entry.recap)
  assert.deepEqual(updated.conditionResponses, entry.conditionResponses)
  assert.equal(updated.notes, entry.notes)
  assert.throws(() => applyJournalExecution(entry, { symbol: 'MNQ', side: 'short' }))
  assert.notEqual(journalDraftKey('owner', entry), journalDraftKey('other', entry))
  assert.throws(() => journalDraftKey('', entry))
})

test('practice close import never presents gross less exit commission as verified net P&L', () => {
  const trade = {
    id: 'closed',
    symbol: 'NQ',
    direction: 'short',
    entryPrice: 20000,
    exitPrice: 19990,
    contracts: 2,
    pnl: 400,
    fees: 5,
    entryTime: 1789047900,
    exitTime: 1789048800,
  }
  const execution = practiceJournalExecution(trade)
  assert.equal(execution.pnl, '')
  assert.equal(execution.fees, '5')
  assert.match(execution.note, /exit fill only/)
  const entry = applyJournalExecution(base, execution)
  assert.equal(entry.pnl, '')
  assert.equal(journalAnalytics([entry]).count, 0)
  assert.equal(journalAnalytics([entry]).missingPnl, 1)
  assert.throws(() => applyJournalExecution(base, { ...execution, closePrice: 'NaN' }))
  assert.throws(() => applyJournalExecution(base, { ...execution, size: '0' }))
})

test('journal saves are retry-safe, updates reject stale versions, reviews validate ownership and periods', async (t) => {
  const previous = Database.db
  Database.db = new sqlite3.Database(':memory:')
  t.after(async () => {
    const db = Database.db
    Database.db = previous
    await new Promise((resolve) => db.close(resolve))
  })
  await Database.createTables()
  const body = {
    ...base,
    clientRequestId: 'retry-safe-request',
    recap: { title: 'Before', riskDollars: '100' },
  }
  const [a, b] = await Promise.all([
    call('createJournalEntry', { body }),
    call('createJournalEntry', { body }),
  ])
  assert.equal(a.code, 200, JSON.stringify(a.body))
  assert.equal(a.body.entry.id, b.body.entry.id)
  assert.equal((await Database.get('SELECT count(*) AS n FROM journal_entries')).n, 1)
  const collision = await call('createJournalEntry', {
    body: { ...body, notes: 'Different request' },
  })
  assert.equal(collision.code, 409)
  const sameKeyOtherOwner = await call('createJournalEntry', { user: { id: 'other' }, body })
  assert.notEqual(sameKeyOtherOwner.body.entry.id, a.body.entry.id)
  const params = { id: a.body.entry.id }
  const updated = await call('updateJournalEntry', {
    params,
    body: { ...a.body.entry, notes: 'New' },
  })
  assert.equal(updated.code, 200)
  assert.equal(updated.body.entry.version, 2)
  const updateRetry = await call('updateJournalEntry', {
    params,
    body: { ...a.body.entry, notes: 'New' },
  })
  assert.equal(updateRetry.code, 200)
  assert.equal(updateRetry.body.entry.version, 2)
  const stale = await call('updateJournalEntry', {
    params,
    body: { ...a.body.entry, notes: 'Stale' },
  })
  assert.equal(stale.code, 409)
  const [race1, race2] = await Promise.all([
    call('updateJournalEntry', { params, body: { ...updated.body.entry, notes: 'Race 1' } }),
    call('updateJournalEntry', { params, body: { ...updated.body.entry, notes: 'Race 2' } }),
  ])
  assert.deepEqual([race1.code, race2.code].sort(), [200, 409])
  const reviewParams = { kind: 'daily', start: '2026-09-10' }
  const reviewBody = { version: 0, focusRule: 'Wait', entryIds: [params.id] }
  const review = await call('saveJournalReview', { params: reviewParams, body: reviewBody })
  assert.equal(review.code, 200, JSON.stringify(review.body))
  assert.equal(review.body.review.version, 1)
  assert.equal(
    (await call('saveJournalReview', { params: reviewParams, body: reviewBody })).code,
    200,
    'identical retry succeeds'
  )
  assert.equal(
    (
      await call('saveJournalReview', {
        params: reviewParams,
        body: { ...reviewBody, focusRule: 'Stale' },
      })
    ).code,
    409
  )
  assert.equal(
    (
      await call('saveJournalReview', {
        user: { id: 'other' },
        params: reviewParams,
        body: reviewBody,
      })
    ).code,
    400
  )
  assert.equal(
    (
      await call('saveJournalReview', {
        params: { ...reviewParams, start: '2026-09-11' },
        body: reviewBody,
      })
    ).code,
    400
  )
  const fetched = await call('getJournalReview', { params: reviewParams })
  assert.equal(fetched.body.entries.length, 1)
  assert.equal(fetched.body.review.focusRule, 'Wait')
  const privateReview = await call('getJournalReview', {
    user: { id: 'other' },
    params: reviewParams,
  })
  assert.equal(privateReview.body.review.version, 0)
  assert.equal(privateReview.body.review.focusRule, undefined)
  assert.equal((await call('getJournalAnalytics', { query: { from: '2026-02-30' } })).code, 400)
  assert.equal(
    (await call('getJournalAnalytics', { query: { from: '2026-09-11', to: '2026-09-10' } })).code,
    400
  )
})

test('annotation normalization rejects unsafe coordinates and preserves bounded metadata', () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII='
  const mark = { kind: 'arrow', x1: 0.1, y1: 0.2, x2: 0.8, y2: 0.9 }
  const result = normalizeJournalRecap({
    screenshots: [
      {
        dataUrl: png,
        capturedAt: '2026-09-10T14:00:00Z',
        chartResolution: '1m',
        annotations: [mark, { ...mark, x1: Infinity }, { ...mark, kind: 'script' }],
      },
    ],
  })
  assert.deepEqual(result.screenshots[0].annotations, [mark])
  assert.equal(result.screenshots[0].chartResolution, '1m')
})
