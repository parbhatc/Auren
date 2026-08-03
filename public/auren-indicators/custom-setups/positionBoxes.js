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

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const sign = number > 0 ? '+' : number < 0 ? '-' : ''
  return `${sign}$${Math.abs(number).toFixed(2)}`
}

function compactNumber(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function colorSetting(value, fallbackColor, fallbackOpacity = 100) {
  const color = typeof value === 'object' && value ? value.color : value
  const opacity = typeof value === 'object' && value ? value.opacity : fallbackOpacity
  const resolved = typeof color === 'string' && color ? color : fallbackColor
  const alpha = Math.max(0, Math.min(100, Number(opacity ?? fallbackOpacity))) / 100
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(resolved)
  if (!hex || alpha >= 1) return resolved
  return `rgba(${parseInt(hex[1], 16)},${parseInt(hex[2], 16)},${parseInt(hex[3], 16)},${alpha})`
}

function solidSetting(value, fallbackColor) {
  return colorSetting(
    typeof value === 'object' && value ? { ...value, opacity: 100 } : value,
    fallbackColor,
    100,
  )
}

export function filterPaperSnapshotToBars(snapshot, bars) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { ...snapshot, trades: [], openPosition: null }
  }
  const times = bars.map((bar) => Number(bar?.time)).filter(Number.isFinite)
  if (!times.length) return { ...snapshot, trades: [], openPosition: null }
  const first = Math.min(...times)
  const last = Math.max(...times)
  const isLoaded = (trade) => {
    const entryTime = seconds(trade?.entryTime)
    return entryTime != null && entryTime >= first && entryTime <= last
  }
  return {
    ...snapshot,
    trades: Array.isArray(snapshot?.trades) ? snapshot.trades.filter(isLoaded) : [],
    openPosition: isLoaded(snapshot?.openPosition) ? snapshot.openPosition : null,
  }
}

function configuredRiskAmount(inputs) {
  const amount = Number(inputs?.riskAmountUsd)
  return Number.isFinite(amount) && amount > 0 ? amount : 150
}

function positionHoverLabel(trade, inputs) {
  const qty = Number(trade.qty)
  const pointsRisk = Math.abs(Number(trade.entry) - Number(trade.stop))
  const pointsReward = Math.abs(Number(trade.target) - Number(trade.entry))
  const rr = pointsRisk > 0 ? pointsReward / pointsRisk : null
  const risk = configuredRiskAmount(inputs)
  const reward = rr == null ? null : risk * rr
  const lines = [
    `Setup ${trade.setupId} • ${trade.side} • ${resultText(trade)}`,
    `Entry ${trade.entry}  Stop ${trade.stop}  Target ${trade.target}`,
    `Risk ${money(risk == null ? risk : -Math.abs(risk))}  Reward ${money(reward)}${rr != null ? `  R:R ${rr.toFixed(2)}` : ''}`,
  ]
  if (Number.isFinite(qty)) lines.push(`Quantity ${qty} MNQ`)
  if (trade.status !== 'OPEN') lines.push(`Net P&L ${money(trade.pnl)}`)
  return lines.join('\n')
}

function positionHoverStats(trade, inputs) {
  const entry = Number(trade.entry)
  const stop = Number(trade.stop)
  const target = Number(trade.target)
  const qty = Number(trade.qty)
  const riskPoints = Math.abs(entry - stop)
  const rewardPoints = Math.abs(target - entry)
  const riskPercent = entry ? (riskPoints / entry) * 100 : 0
  const rewardPercent = entry ? (rewardPoints / entry) * 100 : 0
  const riskTicks = Math.round(riskPoints / 0.25)
  const rewardTicks = Math.round(rewardPoints / 0.25)
  const rr = riskPoints > 0 ? rewardPoints / riskPoints : 0
  const riskAmount = configuredRiskAmount(inputs)
  const rewardAmount = riskAmount * rr
  const pnlState = trade.status === 'OPEN' ? 'Open' : 'Closed'
  return {
    entryPrice: entry,
    targetPrice: target,
    stopPrice: stop,
    targetColor: solidSetting(inputs.targetColor, '#089981'),
    stopColor: solidSetting(inputs.stopColor, '#f23645'),
    centerColor: Number(trade.pnl) >= 0 ? '#089981' : '#f23645',
    textColor: '#ffffff',
    centerBorderColor: '#ffffff',
    centerBorderWidth: 1,
    targetLabel: `Target: ${compactNumber(rewardPoints)} (${rewardPercent.toFixed(3)}%) ${rewardTicks}, Amount: ${compactNumber(rewardAmount, 0)}`,
    centerLines: [
      `Setup ${trade.setupId}`,
      `${pnlState} P&L: ${trade.status === 'OPEN' ? '—' : money(trade.pnl)}, Qty: ${Number.isFinite(qty) ? qty : '—'}`,
      `Risk/Reward Ratio: ${compactNumber(rr)}`,
    ],
    stopLabel: `Stop: ${compactNumber(riskPoints)} (${riskPercent.toFixed(3)}%) ${riskTicks}, Amount: ${compactNumber(riskAmount, 0)}`,
  }
}

function signalBox(trade, timeStart, timeEnd, extendRight, barSec, showLabel, showHoverStats, inputs) {
  const long = trade.side === 'LONG'
  const tick = 0.25
  return {
    timeStart,
    timeEnd: timeEnd ?? timeStart + Math.max(30, Number(barSec) || 60),
    extendRight,
    priceTop: trade.entry + tick,
    priceBottom: trade.entry - tick,
    fillColor: long ? 'rgba(22,163,74,0.26)' : 'rgba(220,38,38,0.26)',
    borderColor: 'transparent',
    borderWidth: 0,
    showLabel,
    label: `S${trade.setupId} ${trade.side} • ${resultText(trade)}`,
    labelAlign: 'left',
    textColor: long ? '#86efac' : '#fca5a5',
    hoverId: `setup-${trade.setupId}-${trade.entryTime}`,
    hoverLabel: showHoverStats ? positionHoverLabel(trade, inputs) : '',
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
      boxes.push(signalBox(
        trade,
        timeStart,
        timeEnd,
        extendRight,
        barSec,
        inputs.showSignalLabels !== false,
        inputs.showHoverStats !== false,
        inputs,
      ))
      continue
    }

    const entry = Number(trade.entry)
    const stop = Number(trade.stop)
    const target = Number(trade.target)
    if (![entry, stop, target].every(Number.isFinite)) continue
    const hoverId = `setup-${trade.setupId}-${trade.entryTime}`
    const hoverLabel = inputs.showHoverStats === false ? '' : positionHoverLabel(trade, inputs)
    const hoverStats = inputs.showHoverStats === false ? null : positionHoverStats(trade, inputs)
    const showBorder = inputs.showPositionBorder === true
    const borderWidth = showBorder
      ? Math.max(1, Math.min(4, Number(inputs.positionBorderWidth) || 1))
      : 0
    const label = inputs.showSignalLabels === false
      ? ''
      : `S${trade.setupId} ${trade.side} • ${resultText(trade)}${trade.qty ? ` • ${trade.qty} MNQ` : ''}`

    boxes.push({
      timeStart,
      timeEnd,
      extendRight,
      priceTop: Math.max(entry, target),
      priceBottom: Math.min(entry, target),
      fillColor: colorSetting(inputs.targetColor, '#089981', 18),
      borderColor: showBorder ? solidSetting(inputs.targetBorderColor, '#089981') : 'transparent',
      borderWidth,
      showLabel: false,
      label,
      labelAlign: 'left',
      textColor: '#86efac',
      hoverId,
      hoverLabel,
      hoverStats,
    })
    boxes.push({
      timeStart,
      timeEnd,
      extendRight,
      priceTop: Math.max(entry, stop),
      priceBottom: Math.min(entry, stop),
      fillColor: colorSetting(inputs.stopColor, '#f23645', 18),
      borderColor: showBorder ? solidSetting(inputs.stopBorderColor, '#f23645') : 'transparent',
      borderWidth,
      showLabel: false,
      hoverId,
      hoverLabel,
      hoverStats,
    })
  }
  return boxes
}
