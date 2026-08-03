const GREEN = '#22c55e'
const RED = '#ef4444'
const LONG_SIGNAL = '#16a34a'
const SHORT_SIGNAL = '#dc2626'

function seconds(value) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null
}

function enabledForSetup(inputs, setupId) {
  return inputs[`showSetup${setupId}`] !== false
}

function resultText(trade) {
  if (trade.status === 'OPEN') return 'OPEN'
  if (Number(trade.pnl) > 0) return 'WIN'
  if (Number(trade.pnl) < 0) return 'LOSS'
  return trade.reason || 'CLOSED'
}

function signalBox(trade, timeStart, timeEnd, extendRight, barSec) {
  const long = trade.side === 'LONG'
  const tick = 0.25
  return {
    timeStart,
    timeEnd: timeEnd ?? timeStart + Math.max(30, Number(barSec) || 60),
    extendRight,
    priceTop: trade.entry + tick,
    priceBottom: trade.entry - tick,
    fillColor: long ? 'rgba(22,163,74,0.26)' : 'rgba(220,38,38,0.26)',
    borderColor: long ? LONG_SIGNAL : SHORT_SIGNAL,
    borderWidth: 1,
    showLabel: true,
    label: `S${trade.setupId} ${trade.side} • ${resultText(trade)}`,
    labelAlign: 'left',
    textColor: long ? '#86efac' : '#fca5a5',
  }
}

export function buildPositionBoxes(snapshot, inputs = {}, barSec = 60) {
  const trades = [...(snapshot?.trades ?? [])]
  if (snapshot?.openPosition) trades.push(snapshot.openPosition)
  const maxClosed = Math.max(1, Math.min(5000, Number(inputs.maxClosedTrades) || 500))
  const closed = trades.filter((trade) => trade.status !== 'OPEN').slice(-maxClosed)
  const open = trades.filter((trade) => trade.status === 'OPEN')
  const visible = [...closed, ...open].filter((trade) => enabledForSetup(inputs, Number(trade.setupId)))
  const boxes = []

  for (const trade of visible) {
    const timeStart = seconds(trade.entryTime)
    if (timeStart == null) continue
    const exitTime = seconds(trade.exitTime)
    const extendRight = trade.status === 'OPEN' || exitTime == null
    const timeEnd = exitTime ?? timeStart + Math.max(30, Number(barSec) || 60)

    if (inputs.drawPositionTool === false) {
      boxes.push(signalBox(trade, timeStart, timeEnd, extendRight, barSec))
      continue
    }

    const entry = Number(trade.entry)
    const stop = Number(trade.stop)
    const target = Number(trade.target)
    if (![entry, stop, target].every(Number.isFinite)) continue
    const label = inputs.showSignalLabels === false
      ? ''
      : `S${trade.setupId} ${trade.side} • ${resultText(trade)}${trade.qty ? ` • ${trade.qty} MNQ` : ''}`

    boxes.push({
      timeStart,
      timeEnd,
      extendRight,
      priceTop: Math.max(entry, target),
      priceBottom: Math.min(entry, target),
      fillColor: 'rgba(34,197,94,0.18)',
      borderColor: GREEN,
      borderWidth: 1,
      showLabel: Boolean(label),
      label,
      labelAlign: 'left',
      textColor: '#86efac',
    })
    boxes.push({
      timeStart,
      timeEnd,
      extendRight,
      priceTop: Math.max(entry, stop),
      priceBottom: Math.min(entry, stop),
      fillColor: 'rgba(239,68,68,0.18)',
      borderColor: RED,
      borderWidth: 1,
      showLabel: false,
    })
  }
  return boxes
}
