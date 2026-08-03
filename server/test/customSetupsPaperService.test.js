import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { CustomSetupsPaperService, parseCsv } from '../src/services/CustomSetupsPaperService.js'

test('CSV parser preserves quoted Custom Setups confluences', () => {
  const rows = parseCsv('setup_id,side,confluences\n1,LONG,"FVG, sweep | IFVG"\n')
  assert.deepEqual(rows, [{ setup_id: '1', side: 'LONG', confluences: 'FVG, sweep | IFVG' }])
})

test('paper snapshot exposes the live position and completed Setup 1-8 trades', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-custom-setups-'))
  const statePath = path.join(dir, 'account.json')
  const tradeLogPath = path.join(dir, 'trades.csv')
  fs.writeFileSync(statePath, JSON.stringify({
    updatedAt: '2026-08-03T15:00:01.000Z',
    openPosition: {
      setupId: 3, side: 'LONG', entry: 28000, stop: 27990, target: 28030,
      initialQty: 5, riskUsd: 100, entryTime: '2026-08-03T14:00:00.000Z',
      confluences: ['CRT', 'first retest'],
    },
  }))
  fs.writeFileSync(tradeLogPath, [
    'setup_id,side,entry,stop,target,qty,entry_time,exit,exit_time,reason,pnl,risk_usd,confluences',
    '7,SHORT,28100,28160,27980,1,2026-08-01T14:00:00.000Z,27980,2026-08-01T14:15:00.000Z,TARGET,239,121,"ORB | retest"',
  ].join('\n'))

  const snapshot = new CustomSetupsPaperService({ statePath, tradeLogPath }).snapshot()
  assert.equal(snapshot.available, true)
  assert.deepEqual(snapshot.priority, [2, 1, 3, 4, 5, 6, 7, 8])
  assert.equal(snapshot.openPosition.setupId, 3)
  assert.equal(snapshot.openPosition.status, 'OPEN')
  assert.equal(snapshot.trades[0].setupId, 7)
  assert.equal(snapshot.trades[0].status, 'CLOSED')
  assert.equal(snapshot.trades[0].pnl, 239)
})

test('paper snapshot falls back to audited historical trades for localhost', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-custom-setups-history-'))
  const historicalPath = path.join(dir, 'history.csv')
  fs.writeFileSync(historicalPath, [
    'id,setup,date,direction,entryTime,exitTime,entry,stop,target,contracts,riskUsd,grossPnl,netPnl,costs',
    'S7-TEST,7,2026-07-31,short,1785506400,1785506700,28360,28420,28240,1,121,240,239,1',
  ].join('\n'))

  const snapshot = new CustomSetupsPaperService({
    statePath: path.join(dir, 'missing-account.json'),
    tradeLogPath: path.join(dir, 'missing-live.csv'),
    historicalPath,
  }).snapshot()

  assert.equal(snapshot.operatingMode, 'AUDITED_HISTORICAL_FALLBACK')
  assert.equal(snapshot.trades[0].setupId, 7)
  assert.equal(snapshot.trades[0].side, 'SHORT')
  assert.equal(snapshot.trades[0].entryTime, '2026-07-31T14:00:00.000Z')
  assert.equal(snapshot.trades[0].exitTime, '2026-07-31T14:05:00.000Z')
  assert.equal(snapshot.trades[0].pnl, 239)
})
