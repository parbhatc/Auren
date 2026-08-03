import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPositionBoxes } from '../../public/auren-indicators/custom-setups/positionBoxes.js'

const baseInputs = {
  drawPositionTool: true,
  showSignalLabels: true,
  maxClosedTrades: 500,
  ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`showSetup${index + 1}`, true])),
}

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
  assert.match(boxes[0].label, /S2 LONG.*OPEN/)
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
