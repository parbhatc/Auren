import assert from 'node:assert/strict'
import test from 'node:test'
import { computeNiceSweepSignals, insideTradeWindow } from '../../public/auren-indicators/nice-sweep/niceSweepEngine.js'

const t = (clock) => Date.parse(`2026-10-15T${clock}-04:00`) / 1000
const t14 = (clock) => Date.parse(`2026-10-14T${clock}-04:00`) / 1000

function bar(clock, open, high, low, close) {
  return { time: t(clock), open, high, low, close, volume: 1 }
}

function bar14(clock, open, high, low, close) {
  return { time: t14(clock), open, high, low, close, volume: 1 }
}

test('NiceSweep defaults to the 9:30-11:00 New York window', () => {
  assert.equal(insideTradeWindow(t('09:29:30'), '09:30', '11:00'), false)
  assert.equal(insideTradeWindow(t('09:30:00'), '09:30', '11:00'), true)
  assert.equal(insideTradeWindow(t('10:59:30'), '09:30', '11:00'), true)
  assert.equal(insideTradeWindow(t('11:00:00'), '09:30', '11:00'), false)
  assert.equal(insideTradeWindow(t('11:00:30'), '09:30', '11:00'), false)
})

test('NiceSweep marks one NQ entry and explains the 4H sweep, IFVG, and body quality', () => {
  const htfBars = [
    { ...bar('00:00:00', 120, 125, 110, 118), time: t('00:00:00') - 86400 },
    { ...bar('04:00:00', 118, 122, 100, 115), time: t('04:00:00') - 86400 },
    { ...bar('08:00:00', 115, 121, 108, 119), time: t('08:00:00') - 86400 },
    { ...bar('12:00:00', 119, 124, 111, 120), time: t('12:00:00') - 86400 },
  ]
  // 09:57 sweeps the confirmed 4H pivot low at 100. The bearish gap
  // created at 09:58:30 is inverted by the large bullish 10:01 candle.
  const bars = [
    bar('09:56:30', 104, 106, 103, 105),
    bar('09:57:00', 105, 105.5, 99, 100.5),
    bar('09:57:30', 100.5, 103, 100, 102),
    bar('09:58:00', 102, 104, 101, 103),
    bar('09:58:30', 97, 99, 96, 98),
    bar('09:59:00', 98, 100, 97, 99),
    bar('09:59:30', 99, 101, 98, 100),
    bar('10:00:00', 100, 101, 99, 100.5),
    bar('10:00:30', 100.5, 101.5, 100, 101),
    bar('10:01:00', 101, 106, 100.5, 105),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    htfBars,
    inputs: {
      windowStart: '09:30',
      windowEnd: '11:00',
      direction: 'both',
      requireBodyDominance: true,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
      maxBarsAfterSweep: 20,
    },
    chartResolution: '30S',
  })

  assert.equal(signals.length, 1)
  assert.equal(signals[0].time, t('10:01:00'))
  assert.equal(signals[0].direction, 'long')
  assert.equal(signals[0].text, 'BUY')
  assert.deepEqual(signals[0].why, [
    '4H low sweep',
    '30s IFVG',
    'body > wicks',
    'clean directional close',
    'strong reaction',
  ])
})

test('NiceSweep respects buy-only and sell-only direction settings', () => {
  const common = {
    bars: [], htfBars: [], chartResolution: '30S',
  }
  assert.deepEqual(computeNiceSweepSignals({ ...common, inputs: { direction: 'long' } }), [])
  assert.deepEqual(computeNiceSweepSignals({ ...common, inputs: { direction: 'short' } }), [])
})

test('NiceSweep detects the IFVG on the active 1-minute chart timeframe', () => {
  const bars = [
    bar('09:30:00', 104, 106, 103, 105),
    bar('09:31:00', 105, 105.5, 99, 100.5),
    bar('09:32:00', 100.5, 103, 100, 102),
    bar('09:33:00', 102, 104, 101, 103),
    bar('09:34:00', 97, 99, 96, 98),
    bar('09:35:00', 98, 100, 97, 99),
    bar('09:36:00', 99, 101, 98, 100),
    bar('09:37:00', 100, 106, 99.5, 105.5),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    levelSweeps: [{ time: t('09:31:00'), kind: 'low', price: 99, label: '1H Low' }],
    inputs: {
      direction: 'both',
      requireBodyDominance: true,
      requireDirectionalClose: true,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
    },
    chartResolution: '1',
  })

  assert.equal(signals.length, 1)
  assert.equal(signals[0].time, t('09:37:00'))
  assert.equal(signals[0].why.includes('1m IFVG'), true)
})

test('NiceSweep catches the earlier NQ internal sweep as a separate entry', () => {
  const bars = [
    bar('09:29:30', 29751.25, 29762, 29744.75, 29744.75),
    bar('09:30:00', 29746, 29763.25, 29708, 29711),
    bar('09:30:30', 29711.75, 29718, 29687.25, 29714.75),
    bar('09:31:00', 29715, 29749.25, 29711, 29720.25),
    bar('09:31:30', 29721.5, 29725.25, 29684.25, 29696),
    bar('09:32:00', 29695, 29730.75, 29694.5, 29725),
    bar('09:32:30', 29723.5, 29739.25, 29711.25, 29726.5),
    bar('09:33:00', 29726.25, 29765.5, 29723.5, 29764.75),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    htfBars: [],
    inputs: {
      direction: 'both',
      sweepLookback: 2,
      requireBodyDominance: true,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
    },
    chartResolution: '30S',
  })

  assert.equal(signals.length, 1)
  assert.equal(signals[0].time, t('09:33:00'))
  assert.deepEqual(signals[0].why, [
    'Sweep',
    '30s IFVG',
    'body > wicks',
    'clean directional close',
    'strong reaction',
  ])
})

test('NiceSweep consumes sweeps produced by the Levels indicator without drawing its lines', () => {
  const bars = [
    bar('09:29:30', 29751.25, 29762, 29744.75, 29744.75),
    bar('09:30:00', 29746, 29763.25, 29708, 29711),
    bar('09:30:30', 29711.75, 29718, 29687.25, 29714.75),
    bar('09:31:00', 29715, 29749.25, 29711, 29720.25),
    bar('09:31:30', 29721.5, 29725.25, 29684.25, 29696),
    bar('09:32:00', 29695, 29730.75, 29694.5, 29725),
    bar('09:32:30', 29723.5, 29739.25, 29711.25, 29726.5),
    bar('09:33:00', 29726.25, 29765.5, 29723.5, 29764.75),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    levelSweeps: [{
      time: t('09:31:30'),
      kind: 'low',
      price: 29687.25,
      label: 'PPI Low',
    }],
    inputs: {
      direction: 'both',
      requireBodyDominance: true,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
    },
    chartResolution: '30S',
  })

  assert.equal(signals.length, 1)
  assert.equal(signals[0].time, t('09:33:00'))
  assert.equal(signals[0].why[0], 'Sweep (PPI Low)')
})

test('NiceSweep permits two distinct IFVG entries from the same swept level', () => {
  const bars = [
    bar('09:29:30', 29751.25, 29762, 29744.75, 29744.75),
    bar('09:30:00', 29746, 29763.25, 29708, 29711),
    bar('09:30:30', 29711.75, 29718, 29687.25, 29714.75),
    bar('09:31:00', 29715, 29749.25, 29711, 29720.25),
    bar('09:31:30', 29721.5, 29725.25, 29684.25, 29696),
    bar('09:32:00', 29695, 29730.75, 29694.5, 29725),
    bar('09:32:30', 29723.5, 29739.25, 29711.25, 29726.5),
    bar('09:33:00', 29726.25, 29765.5, 29723.5, 29764.75),
    bar('09:33:30', 29764.5, 29783.25, 29760.25, 29769),
    bar('09:34:00', 29769.25, 29787.75, 29743.25, 29743.25),
    bar('09:34:30', 29743.75, 29749, 29719.25, 29721.25),
    bar('09:35:00', 29721, 29745, 29704, 29710.75),
    bar('09:35:30', 29711, 29717.75, 29689.75, 29703),
    bar('09:36:00', 29702.75, 29720.5, 29693, 29708.25),
    bar('09:36:30', 29707.75, 29752.25, 29705.25, 29747.25),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    levelSweeps: [{
      time: t('09:31:30'),
      kind: 'low',
      price: 29687.25,
      label: 'PPI Low',
    }],
    inputs: {
      direction: 'both',
      requireBodyDominance: true,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
      maxEntriesPerSweep: 2,
      cooldownBars: 0,
    },
    chartResolution: '30S',
  })

  assert.deepEqual(signals.map((signal) => signal.time), [t('09:33:00'), t('09:36:30')])
})

test('NiceSweep matches the October 14 journal with one trade through 11:00', () => {
  const bars = [
    bar14('09:29:30', 30548.25, 30555.75, 30542.75, 30551.5),
    bar14('09:30:00', 30551.5, 30576, 30528, 30544.5),
    bar14('09:30:30', 30545, 30575.5, 30544.5, 30563.25),
    bar14('09:31:00', 30563, 30583.75, 30560, 30566),
    bar14('09:31:30', 30565.5, 30565.5, 30518.25, 30520),
    bar14('09:32:00', 30519.75, 30553.25, 30505, 30550.25),
    bar14('09:32:30', 30549, 30549.75, 30517.25, 30541.5),
    bar14('09:33:00', 30542.5, 30585.75, 30536, 30572),
    bar14('09:33:30', 30571.25, 30597.75, 30570.5, 30590.5),
    bar14('09:34:00', 30591.25, 30593.75, 30564.25, 30565.25),
    bar14('09:34:30', 30565.25, 30576.5, 30552, 30552),
    bar14('09:35:00', 30552, 30553, 30532, 30534),
    bar14('09:35:30', 30534.5, 30540.75, 30515.5, 30523.75),
    bar14('09:36:00', 30524.25, 30539.25, 30510.75, 30526.25),
    bar14('09:36:30', 30526.75, 30552.25, 30526.25, 30541),
    bar14('09:37:00', 30541.5, 30554.75, 30530.5, 30534.25),
    bar14('09:37:30', 30534.25, 30534.5, 30509.25, 30510),
    bar14('09:38:00', 30510.25, 30554.75, 30498, 30552.25),
    bar14('09:38:30', 30552, 30574.25, 30545.5, 30574.25),
  ]
  const signals = computeNiceSweepSignals({
    bars,
    levelSweeps: [{
      time: t14('09:30:00'),
      kind: 'low',
      price: 30529.25,
      label: '4H Low + 1H Low',
    }],
    inputs: {
      direction: 'both',
      requireBodyDominance: true,
      requireDirectionalClose: true,
      minDirectionalClosePercent: 80,
      requireStrongReaction: true,
      displacementMultiplier: 1.5,
      maxEntriesPerSweep: 2,
      cooldownBars: 0,
    },
    chartResolution: '30S',
  })

  assert.deepEqual(signals.map((signal) => signal.time), [t14('09:38:30')])
  assert.equal(signals[0].why.includes('clean directional close'), true)
})

