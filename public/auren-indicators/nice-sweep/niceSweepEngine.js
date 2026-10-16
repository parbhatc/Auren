const NEW_YORK_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function clockMinutes(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return fallback
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
  return hour * 60 + minute
}

export function newYorkClockMinutes(unixSeconds) {
  const parts = Object.fromEntries(
    NEW_YORK_TIME.formatToParts(new Date(Number(unixSeconds) * 1000))
      .map((part) => [part.type, part.value]),
  )
  return Number(parts.hour) * 60 + Number(parts.minute)
}

export function insideTradeWindow(unixSeconds, startText, endText) {
  const start = clockMinutes(startText, 9 * 60 + 30)
  const end = clockMinutes(endText, 11 * 60)
  const minute = newYorkClockMinutes(unixSeconds)
  return start <= end
    ? minute >= start && minute < end
    : minute >= start || minute < end
}

function pivotAt(bars, index, left, right, kind) {
  const price = finite(bars[index]?.[kind])
  if (price == null) return null
  for (let offset = 1; offset <= left; offset += 1) {
    const other = finite(bars[index - offset]?.[kind])
    if (other == null || (kind === 'high' ? other >= price : other <= price)) return null
  }
  for (let offset = 1; offset <= right; offset += 1) {
    const other = finite(bars[index + offset]?.[kind])
    if (other == null || (kind === 'high' ? other >= price : other <= price)) return null
  }
  return price
}

export function confirmedHtfLevels(htfBars, options = {}) {
  const bars = Array.isArray(htfBars) ? htfBars : []
  const left = Math.max(1, Math.trunc(Number(options.left) || 1))
  const right = Math.max(1, Math.trunc(Number(options.right) || 1))
  const tfSec = Math.max(60, Number(options.tfSec) || 4 * 60 * 60)
  const levels = []
  for (let index = left; index + right < bars.length; index += 1) {
    const confirmationBar = bars[index + right]
    const confirmedAt = finite(confirmationBar?.time)
    if (confirmedAt == null) continue
    for (const kind of ['high', 'low']) {
      const price = pivotAt(bars, index, left, right, kind)
      if (price == null) continue
      levels.push({
        id: `${kind}:${bars[index].time}:${price}`,
        kind,
        price,
        pivotTime: Number(bars[index].time),
        confirmedAt: confirmedAt + tfSec,
      })
    }
  }
  return levels.sort((a, b) => a.confirmedAt - b.confirmedAt || a.price - b.price)
}

function levelWasTakenBefore(level, htfBars, chartStart, tfSec) {
  for (const bar of htfBars) {
    const start = finite(bar?.time)
    if (start == null || start < level.confirmedAt || start + tfSec > chartStart) continue
    if (level.kind === 'low' && finite(bar.low) < level.price) return true
    if (level.kind === 'high' && finite(bar.high) > level.price) return true
  }
  return false
}

export function ifvgInversions(bars) {
  const source = Array.isArray(bars) ? bars : []
  const gaps = []
  const events = []
  for (let index = 0; index < source.length; index += 1) {
    const bar = source[index]
    const close = finite(bar?.close)
    if (close == null) continue

    const directions = new Set()
    for (const gap of gaps) {
      if (gap.inverted || index <= gap.createdIndex) continue
      if (gap.kind === 'bearish' && close > gap.top) {
        gap.inverted = true
        directions.add('long')
      } else if (gap.kind === 'bullish' && close < gap.bottom) {
        gap.inverted = true
        directions.add('short')
      }
    }
    for (const direction of directions) events.push({ index, direction })

    if (index < 2) continue
    const twoBack = source[index - 2]
    const high = finite(bar.high)
    const low = finite(bar.low)
    const oldHigh = finite(twoBack?.high)
    const oldLow = finite(twoBack?.low)
    if ([high, low, oldHigh, oldLow].some((value) => value == null)) continue
    if (high < oldLow) {
      gaps.push({ kind: 'bearish', bottom: high, top: oldLow, createdIndex: index, inverted: false })
    }
    if (low > oldHigh) {
      gaps.push({ kind: 'bullish', bottom: oldHigh, top: low, createdIndex: index, inverted: false })
    }
  }
  return events
}

function directionAllowed(direction, setting) {
  const normalized = String(setting ?? 'both').toLowerCase()
  return normalized === 'both' || normalized === direction ||
    (direction === 'long' && normalized === 'buy') ||
    (direction === 'short' && normalized === 'sell')
}

function dominantBody(bar, direction) {
  const open = finite(bar?.open)
  const high = finite(bar?.high)
  const low = finite(bar?.low)
  const close = finite(bar?.close)
  if ([open, high, low, close].some((value) => value == null)) return false
  if (direction === 'long' && close <= open) return false
  if (direction === 'short' && close >= open) return false
  const body = Math.abs(close - open)
  const upperWick = high - Math.max(open, close)
  const lowerWick = Math.min(open, close) - low
  return body > upperWick && body > lowerWick
}

function directionalClose(bar, direction, minimumPercent) {
  const high = finite(bar?.high)
  const low = finite(bar?.low)
  const close = finite(bar?.close)
  if ([high, low, close].some((value) => value == null)) return false
  const range = high - low
  if (range <= 0) return false
  const strength = direction === 'long'
    ? ((close - low) / range) * 100
    : ((high - close) / range) * 100
  return strength >= minimumPercent
}

function strongReaction(bars, index, multiplier) {
  const lookback = Math.min(10, index)
  if (lookback < 3) return false
  let total = 0
  let count = 0
  for (let offset = 1; offset <= lookback; offset += 1) {
    const open = finite(bars[index - offset]?.open)
    const close = finite(bars[index - offset]?.close)
    if (open == null || close == null) continue
    total += Math.abs(close - open)
    count += 1
  }
  if (!count) return false
  const open = finite(bars[index]?.open)
  const close = finite(bars[index]?.close)
  if (open == null || close == null) return false
  return Math.abs(close - open) >= (total / count) * multiplier
}

function strongReactionSequence(bars, index, direction, multiplier) {
  if (strongReaction(bars, index, multiplier)) return true
  if (index < 1 || !strongReaction(bars, index - 1, multiplier)) return false
  const previous = bars[index - 1]
  const current = bars[index]
  const previousOpen = finite(previous?.open)
  const previousClose = finite(previous?.close)
  const currentOpen = finite(current?.open)
  const currentClose = finite(current?.close)
  if ([previousOpen, previousClose, currentOpen, currentClose].some((value) => value == null)) return false
  return direction === 'long'
    ? previousClose > previousOpen && currentClose > currentOpen
    : previousClose < previousOpen && currentClose < currentOpen
}

function internalSweepAt(bars, index, direction, lookback) {
  if (index < lookback) return false
  const prior = bars.slice(index - lookback, index)
  const bar = bars[index]
  const close = finite(bar?.close)
  if (close == null) return false
  if (direction === 'long') {
    const priorLow = Math.min(...prior.map((item) => finite(item?.low) ?? Infinity))
    const low = finite(bar?.low)
    return Number.isFinite(priorLow) && low != null && low < priorLow && close > priorLow
  }
  const priorHigh = Math.max(...prior.map((item) => finite(item?.high) ?? -Infinity))
  const high = finite(bar?.high)
  return Number.isFinite(priorHigh) && high != null && high > priorHigh && close < priorHigh
}

function timeframeLabel(resolution) {
  const value = String(resolution ?? '30S')
  if (/^\d+S$/i.test(value)) return value.toLowerCase()
  if (/^\d+$/.test(value)) return `${value}m`
  return value
}

/**
 * Detect entry-only NiceSweep signals. Prices are never interpreted as stops,
 * targets, or exits; the returned reason is the complete chart annotation.
 */
export function computeNiceSweepSignals({
  bars,
  htfBars,
  htfSources,
  levelSweeps,
  inputs = {},
  chartResolution = '30S',
  formingTime = null,
}) {
  const source = Array.isArray(bars) ? bars : []
  if (source.length < 3) return []
  const useLevelSweeps = Array.isArray(levelSweeps)
  const sources = Array.isArray(htfSources) && htfSources.length
    ? htfSources
    : [{ label: '4H', bars: Array.isArray(htfBars) ? htfBars : [], tfSec: 4 * 60 * 60 }]
  const levels = (useLevelSweeps ? [] : sources).flatMap((source) => {
    const sourceBars = Array.isArray(source?.bars) ? source.bars : []
    const tfSec = Math.max(60, Number(source?.tfSec) || 4 * 60 * 60)
    return confirmedHtfLevels(sourceBars, {
      left: inputs.pivotLeft ?? 1,
      right: inputs.pivotRight ?? 1,
      tfSec,
    }).map((level) => ({
      ...level,
      id: `${source?.label ?? 'HTF'}:${level.id}`,
      timeframe: String(source?.label ?? 'HTF'),
      sourceBars,
      tfSec,
    }))
  }).sort((a, b) => a.confirmedAt - b.confirmedAt || a.price - b.price)
  const chartStart = Number(source[0].time)
  const active = new Map()
  const sweptByTime = new Map()
  for (const sweep of levelSweeps ?? []) {
    const time = finite(sweep?.time)
    if (time == null) continue
    if (!sweptByTime.has(time)) sweptByTime.set(time, [])
    sweptByTime.get(time).push({
      kind: sweep.kind === 'high' ? 'high' : 'low',
      price: finite(sweep.price),
      reasonLabel: String(sweep.label ?? '').trim(),
    })
  }
  let nextLevel = 0
  while (nextLevel < levels.length && levels[nextLevel].confirmedAt <= chartStart) {
    const level = levels[nextLevel]
    if (!levelWasTakenBefore(level, level.sourceBars, chartStart, level.tfSec)) active.set(level.id, level)
    nextLevel += 1
  }

  const primaryEvents = ifvgInversions(source)
  const primaryByIndex = new Map()
  for (const event of primaryEvents) {
    if (!primaryByIndex.has(event.index)) primaryByIndex.set(event.index, new Set())
    primaryByIndex.get(event.index).add(event.direction)
  }

  const maxSweepBars = Math.max(1, Math.trunc(Number(inputs.maxBarsAfterSweep) || 20))
  const sweepLookback = Math.max(2, Math.trunc(Number(inputs.sweepLookback) || 6))
  const maxEntriesPerSweep = Math.max(1, Math.trunc(finite(inputs.maxEntriesPerSweep) ?? 2))
  const cooldownBars = Math.max(0, Math.trunc(finite(inputs.cooldownBars) ?? 0))
  const requireBody = inputs.requireBodyDominance !== false
  const requireDirectionalClose = inputs.requireDirectionalClose !== false
  const minDirectionalClosePercent = Math.min(
    100,
    Math.max(50, finite(inputs.minDirectionalClosePercent) ?? 80),
  )
  const requireStrong = inputs.requireStrongReaction !== false
  const displacementMultiplier = Math.max(1, Number(inputs.displacementMultiplier) || 1.5)
  const latestSweep = { long: null, short: null }
  const signals = []
  let lastSignalIndex = null

  for (let index = 0; index < source.length; index += 1) {
    const bar = source[index]
    const time = finite(bar?.time)
    if (time == null || (formingTime != null && time === Number(formingTime))) continue

    while (nextLevel < levels.length && levels[nextLevel].confirmedAt <= time) {
      const level = levels[nextLevel]
      active.set(level.id, level)
      nextLevel += 1
    }

    const sweptLow = []
    const sweptHigh = []
    if (useLevelSweeps) {
      for (const level of sweptByTime.get(time) ?? []) {
        if (level.kind === 'low') sweptLow.push(level)
        else sweptHigh.push(level)
      }
    } else {
      for (const [id, level] of active) {
        if (level.kind === 'low' && finite(bar.low) < level.price) {
          sweptLow.push(level)
          active.delete(id)
        } else if (level.kind === 'high' && finite(bar.high) > level.price) {
          sweptHigh.push(level)
          active.delete(id)
        }
      }
    }
    if (sweptLow.length) latestSweep.long = { index, levels: sweptLow, uses: 0 }
    if (sweptHigh.length) latestSweep.short = { index, levels: sweptHigh, uses: 0 }

    if (!useLevelSweeps) {
      for (const direction of ['long', 'short']) {
        if (!internalSweepAt(source, index, direction, sweepLookback)) continue
        const current = latestSweep[direction]
        const protectedHtfSweep = current && current.uses < maxEntriesPerSweep && current.levels.length &&
          index - current.index <= maxSweepBars
        if (!protectedHtfSweep) {
          latestSweep[direction] = { index, levels: [], uses: 0 }
        }
      }
    }

    for (const direction of ['long', 'short']) {
      if (!primaryByIndex.get(index)?.has(direction)) continue
      if (!directionAllowed(direction, inputs.direction)) continue
      if (!insideTradeWindow(time, inputs.windowStart, inputs.windowEnd)) continue
      if (requireBody && !dominantBody(bar, direction)) continue
      if (requireDirectionalClose && !directionalClose(bar, direction, minDirectionalClosePercent)) continue
      if (requireStrong && !strongReactionSequence(source, index, direction, displacementMultiplier)) continue

      const sweep = latestSweep[direction]
      if (!sweep || sweep.uses >= maxEntriesPerSweep || index <= sweep.index || index - sweep.index > maxSweepBars) continue
      if (lastSignalIndex != null && index - lastSignalIndex < cooldownBars) continue
      sweep.uses += 1
      lastSignalIndex = index
      const side = direction === 'long' ? 'BUY' : 'SELL'
      const levelSide = direction === 'long' ? 'low' : 'high'
      const levelLabels = [...new Set(sweep.levels.map((level) => level.reasonLabel).filter(Boolean))]
      const timeframes = [...new Set(sweep.levels.map((level) => level.timeframe).filter(Boolean))]
      const sweepWhy = levelLabels.length
        ? `Sweep (${levelLabels.join(' + ')})`
        : timeframes.length
          ? `${timeframes.join(' + ')} ${levelSide} sweep`
          : 'Sweep'
      const ifvgWhy = `${timeframeLabel(chartResolution)} IFVG`
      const why = [
        sweepWhy,
        ifvgWhy,
        ...(requireBody ? ['body > wicks'] : []),
        ...(requireDirectionalClose ? ['clean directional close'] : []),
        ...(requireStrong ? ['strong reaction'] : []),
      ]
      signals.push({
        time,
        price: direction === 'long' ? Number(bar.low) : Number(bar.high),
        direction,
        kind: direction === 'long' ? 'low' : 'high',
        text: side,
        why,
        sweep,
        barIndex: index,
      })
    }
  }

  const maxSignals = Math.max(1, Math.trunc(Number(inputs.maxSignals) || 100))
  const collapsed = []
  for (const signal of signals) {
    const previous = collapsed.at(-1)
    if (
      previous &&
      previous.direction === signal.direction &&
      previous.sweep === signal.sweep &&
      signal.barIndex === previous.barIndex + 1
    ) {
      collapsed[collapsed.length - 1] = signal
    } else {
      collapsed.push(signal)
    }
  }
  return collapsed.slice(-maxSignals).map(({ sweep: _sweep, barIndex: _barIndex, ...signal }) => signal)
}

