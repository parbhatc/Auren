import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPositionBoxes,
  filterPaperSnapshotToBars,
} from '../../public/auren-indicators/custom-setups/positionBoxes.js'
import { subscribePaperFeed } from '../../public/auren-indicators/custom-setups/paperFeed.js'

const baseInputs = {
  drawPositionTool: true,
  showSignalLabels: true,
  showHoverStats: true,
  riskAmountUsd: 150,
  maxClosedTrades: 500,
  ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`showSetup${index + 1}`, true])),
}

test('audited trades appear only as their candle history is loaded', () => {
  const snapshot = {
    openPosition: null,
    trades: [
      { setupId: 1, entryTime: '2026-07-30T14:00:00.000Z' },
      { setupId: 7, entryTime: '2026-07-31T14:00:00.000Z' },
      { setupId: 3, entryTime: '2026-08-03T14:00:00.000Z' },
    ],
  }
  const filtered = filterPaperSnapshotToBars(snapshot, [
    { time: Date.parse('2026-07-31T13:30:00.000Z') / 1000 },
    { time: Date.parse('2026-07-31T20:00:00.000Z') / 1000 },
  ])
  assert.deepEqual(filtered.trades.map((trade) => trade.setupId), [7])
})

test('position tool extends an open live-paper trade to the right', () => {
  const boxes = buildPositionBoxes({
    trades: [],
    openPosition: {
      setupId: 2, side: 'LONG', entry: 28000, stop: 27990, target: 28035,
      qty: 5, entryTime: '2026-08-03T14:00:00.000Z', status: 'OPEN',
    },
  }, baseInputs, 30)
  assert.equal(boxes.length, 2)
  assert.equal(boxes.every((box) => box.extendRight === true), true)
  assert.equal(boxes.every((box) => box.borderWidth === 0), true)
  assert.match(boxes[0].label, /S2 LONG.*OPEN/)
  assert.match(boxes[0].hoverLabel, /Setup 2.*LONG.*OPEN/)
  assert.match(boxes[0].hoverLabel, /Entry 28000.*Stop 27990.*Target 28035/)
  assert.match(boxes[0].hoverLabel, /Risk -\$150\.00.*Reward \+\$525\.00/)
  assert.match(boxes[0].hoverLabel, /R:R 3\.50/)
  assert.match(boxes[0].hoverStats.targetLabel, /Target: 35 \(0\.125%\) 140, Amount: 525/)
  assert.deepEqual(boxes[0].hoverStats.centerLines, [
    'Setup 2',
    'Open P&L: —, Qty: 5',
    'Risk/Reward Ratio: 3.5',
  ])
})

test('position tool ends both zones on the actual TP or SL exit timestamp', () => {
  const boxes = buildPositionBoxes({
    openPosition: null,
    trades: [{
      setupId: 7, side: 'SHORT', entry: 28100, stop: 28160, target: 27980,
      qty: 1, entryTime: '2026-08-03T14:00:00.000Z',
      exitTime: '2026-08-03T14:15:00.000Z', status: 'CLOSED', reason: 'TARGET', pnl: 239,
    }],
  }, baseInputs, 60)
  assert.equal(boxes.length, 2)
  assert.equal(boxes.every((box) => box.extendRight === false), true)
  assert.equal(boxes.every((box) => box.timeEnd === Date.parse('2026-08-03T14:15:00.000Z') / 1000), true)
  assert.match(boxes[0].hoverLabel, /Setup 7.*SHORT.*WIN/)
  assert.match(boxes[0].hoverLabel, /Net P&L \+\$239\.00/)
  assert.match(boxes[0].hoverStats.stopLabel, /Stop: 60 \(0\.214%\) 240, Amount: 150/)
})

test('position drawing can be disabled while retaining the setup signal', () => {
  const boxes = buildPositionBoxes({
    openPosition: {
      setupId: 1, side: 'SHORT', entry: 28000, stop: 28010, target: 27970,
      entryTime: '2026-08-03T14:00:00.000Z', status: 'OPEN',
    },
    trades: [],
  }, { ...baseInputs, drawPositionTool: false }, 60)
  assert.equal(boxes.length, 1)
  assert.match(boxes[0].label, /S1 SHORT/)
})

test('position hover stats can be disabled without hiding the position zones', () => {
  const boxes = buildPositionBoxes({
    openPosition: {
      setupId: 3, side: 'LONG', entry: 28000, stop: 27990, target: 28020,
      entryTime: '2026-08-03T14:00:00.000Z', status: 'OPEN',
    },
    trades: [],
  }, { ...baseInputs, showHoverStats: false }, 60)
  assert.equal(boxes.length, 2)
  assert.equal(boxes.every((box) => box.hoverLabel === ''), true)
  assert.equal(boxes.every((box) => box.hoverStats == null), true)
})

test('position colors and borders follow indicator settings', () => {
  const boxes = buildPositionBoxes({
    openPosition: {
      setupId: 1, side: 'SHORT', entry: 28000, stop: 28010, target: 27980,
      entryTime: '2026-08-03T14:00:00.000Z', status: 'OPEN',
    },
    trades: [],
  }, {
    ...baseInputs,
    targetColor: { color: '#112233', opacity: 25 },
    stopColor: { color: '#445566', opacity: 40 },
    showPositionBorder: true,
    targetBorderColor: { color: '#abcdef', opacity: 100 },
    stopBorderColor: { color: '#fedcba', opacity: 100 },
    positionBorderWidth: 3,
  }, 60)
  assert.equal(boxes[0].fillColor, 'rgba(17,34,51,0.25)')
  assert.equal(boxes[1].fillColor, 'rgba(68,85,102,0.4)')
  assert.equal(boxes[0].borderColor, '#abcdef')
  assert.equal(boxes[1].borderColor, '#fedcba')
  assert.equal(boxes.every((box) => box.borderWidth === 3), true)
})

test('a chart subscribing after the initial paper fetch receives the current snapshot', () => {
  let calls = 0
  const unsubscribe = subscribePaperFeed(() => { calls += 1 })
  assert.equal(calls, 1)
  unsubscribe()
})
