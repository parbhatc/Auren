import test from 'node:test'
import assert from 'node:assert/strict'
import { captureOpenPosition, createJournalDraft, isSameCapturedTrade } from '../../src/journal/journalCapture.ts'

const now = new Date('2026-09-10T14:00:00Z')
test('active-position capture preserves entry, size and risk without inventing a close or realized P&L', () => {
  for (const source of ['practice', 'live']) {
    const entry = captureOpenPosition({ source, symbol: 'NQ', accountId: 'account-a', now,
      position: { symbol: 'CME:NQ', contracts: -2, entry: 20000, entryTime: 1789047900,
        positionId: 'position-a', stopLoss: 20010, takeProfit: 19980 } })
    assert.equal(entry.source, source)
    assert.equal(entry.side, 'short')
    assert.equal(entry.size, '2')
    assert.equal(entry.entryPrice, '20000')
    assert.equal(entry.closePrice, '')
    assert.equal(entry.exitDateTime, '')
    assert.equal(entry.pnl, '')
    assert.equal(entry.outcome, 'planned')
    assert.equal(entry.sourceTradeId, 'position-a')
    assert.equal(entry.sourceContext.snapshotKind, 'open_position')
    assert.equal(entry.riskPlan.stopLoss.price, '20010')
    assert.equal(entry.riskPlan.takeProfit.price, '19980')
    assert.equal(isSameCapturedTrade({ ...entry, id: 'saved' }, entry), true)
    assert.equal(isSameCapturedTrade({ ...entry, sourceSessionId: 'account-b' }, entry), false)
    assert.equal(isSameCapturedTrade({ ...entry, source: 'replay' }, entry), false)
  }
})

test('flat/invalid positions become observations and unknown IDs do not merge unrelated entries', () => {
  for (const position of [null, { contracts: 0 }, { contracts: NaN }]) {
    const entry = captureOpenPosition({ source: 'practice', symbol: 'ES', position, now })
    assert.equal(entry.recap.execution, 'observation')
    assert.equal(entry.entryPrice, '')
    assert.equal(entry.sourceContext.snapshotKind, 'cursor')
    assert.equal(isSameCapturedTrade(entry, entry), false)
  }
  const seconds = captureOpenPosition({ source: 'live', symbol: 'ES', now, position: { contracts: 1, entryTime: 1789047900 } })
  const millis = captureOpenPosition({ source: 'live', symbol: 'ES', now, position: { contracts: 1, entryTime: 1789047900000 } })
  assert.equal(seconds.dateTime, millis.dateTime)
  assert.notEqual(createJournalDraft().recap, createJournalDraft().recap)
})
