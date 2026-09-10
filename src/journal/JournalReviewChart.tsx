import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Star } from 'lucide-react'
import { backtesterAPI } from '../api/backtester.api'
import type { JournalEntryRecord as ManualJournalEntry } from '../api/journal.api'
import AurenChart from '../services/chart/AurenChart'
import type { BwcWidget } from '../services/chart/bwcDatafeed'
import type { Bar, IDatafeedChartApi, LibrarySymbolInfo } from '../types/chart'
import {
  parseLiquiditySweeps,
  parsePdaDeliveries,
  extractClockValues,
  type LiquiditySweepRow,
} from './journalConditions'

type JournalChartResolution = string
type JournalChartResolutionOption = { value: JournalChartResolution; label: string }

const JOURNAL_REVIEW_RESOLUTIONS: JournalChartResolutionOption[] = [
  { value: '30S', label: '30s' },
  { value: '1', label: '1m' },
  { value: '2', label: '2m' },
  { value: '3', label: '3m' },
  { value: '5', label: '5m' },
  { value: '10', label: '10m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '45', label: '45m' },
  { value: '60', label: '1h' },
  { value: '120', label: '2h' },
  { value: '180', label: '3h' },
  { value: '240', label: '4h' },
]

function journalChartResolutions(entry: ManualJournalEntry): JournalChartResolutionOption[] {
  const values = Object.values(entry.conditionResponses || {})
  const seconds = new Set<number>()
  for (const value of values) {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    for (const match of text.matchAll(
      /\b(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/gi
    )) {
      const amount = Number(match[1])
      if (!Number.isFinite(amount) || amount <= 0) continue
      const unit = match[2].toLowerCase()
      const totalSeconds = unit.startsWith('h')
        ? amount * 3600
        : unit.startsWith('m')
          ? amount * 60
          : amount
      if (totalSeconds >= 30 && totalSeconds <= 86400) seconds.add(totalSeconds)
    }
  }
  if (!seconds.size) seconds.add(60)
  return [...seconds]
    .sort((a, b) => a - b)
    .map((value) => ({
      value: value < 60 ? `${value}S` : String(value / 60),
      label:
        value < 60
          ? `${value}s`
          : value >= 3600 && value % 3600 === 0
            ? `${value / 3600}h`
            : `${value / 60}m`,
    }))
}

function journalResolutionMs(resolution: JournalChartResolution): number {
  const secondsMatch = String(resolution).match(/^(\d+)S$/i)
  return secondsMatch ? Number(secondsMatch[1]) * 1000 : Number(resolution) * 60_000
}

function aggregateJournalBars(bars: Bar[], resolution: JournalChartResolution): Bar[] {
  const bucketMs = journalResolutionMs(resolution)
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) return bars.map((bar) => ({ ...bar }))

  const aggregated: Bar[] = []
  for (const bar of bars) {
    const bucketTime = Math.floor(bar.time / bucketMs) * bucketMs
    const current = aggregated[aggregated.length - 1]
    if (!current || current.time !== bucketTime) {
      aggregated.push({ ...bar, time: bucketTime })
      continue
    }
    current.high = Math.max(current.high, bar.high)
    current.low = Math.min(current.low, bar.low)
    current.close = bar.close
    if (typeof current.volume === 'number' || typeof bar.volume === 'number') {
      current.volume = Number(current.volume || 0) + Number(bar.volume || 0)
    }
  }
  return aggregated
}

function createJournalChartDatafeed(
  symbol: string,
  bars: Bar[],
  resolutions: JournalChartResolution[]
): IDatafeedChartApi {
  const symbolInfo: LibrarySymbolInfo = {
    name: symbol,
    ticker: symbol,
    symbol,
    description: `${symbol} journal review`,
    type: 'futures',
    session: '24x7',
    timezone: 'America/New_York',
    exchange: 'CME',
    listed_exchange: 'CME',
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    supported_resolutions: resolutions,
    intraday_multipliers: resolutions,
    data_status: 'endofday',
  }

  return {
    onReady(callback) {
      callback({ supported_resolutions: resolutions, supports_quotes: false })
    },
    searchSymbols(_query, _exchange, _type, onResult) {
      onResult([
        {
          symbol,
          full_name: symbol,
          description: symbolInfo.description,
          exchange: 'CME',
          type: 'futures',
        },
      ])
    },
    resolveSymbol(_symbolName, onResolve) {
      onResolve(symbolInfo)
    },
    getBars(_symbolInfo, _resolution, _periodParams, onResult) {
      onResult(
        bars.map((bar) => ({ ...bar })),
        { noData: bars.length === 0 }
      )
    },
    subscribeBars() {},
    unsubscribeBars() {},
  }
}

export default function JournalReviewChart({
  entry,
  isDark,
}: {
  entry: ManualJournalEntry
  isDark: boolean
}) {
  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const mentionedResolutions = useMemo(() => journalChartResolutions(entry), [entry])
  const sourceResolution = mentionedResolutions.some((item) => item.value === '30S') ? '30S' : '1'
  const [resolution, setResolution] = useState<JournalChartResolution>(
    () => mentionedResolutions[0]?.value || '1'
  )
  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false)
  const [favoriteResolutions, setFavoriteResolutions] = useState<JournalChartResolution[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-journal-timeframe-favorites') || '[]')
      return Array.isArray(saved)
        ? saved.filter((value) => JOURNAL_REVIEW_RESOLUTIONS.some((item) => item.value === value))
        : []
    } catch {
      return []
    }
  })
  const chartBars = useMemo(() => aggregateJournalBars(bars, resolution), [bars, resolution])
  const datafeed = useMemo(
    () =>
      createJournalChartDatafeed(
        entry.symbol,
        chartBars,
        JOURNAL_REVIEW_RESOLUTIONS.map((item) => item.value)
      ),
    [entry.symbol, chartBars]
  )
  const chartServices = useMemo(
    () => ({ datafeed, streamConfig: { delayed: true }, accountId: `journal-${entry.id}` }),
    [datafeed, entry.id]
  )

  useEffect(() => {
    try {
      localStorage.setItem('auren-journal-timeframe-favorites', JSON.stringify(favoriteResolutions))
    } catch {
      /* Optional preference. */
    }
  }, [favoriteResolutions])

  useEffect(() => {
    const controller = new AbortController()
    const center = new Date(entry.dateTime).getTime()
    const dayStart = new Date(entry.dateTime)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(entry.dateTime)
    dayEnd.setTime(center + 4 * 60 * 60 * 1000)
    setLoading(true)
    void backtesterAPI
      .getHistory(
        {
          symbol: entry.symbol,
          resolution: sourceResolution,
          from: Math.floor(dayStart.getTime() / 1000),
          to: Math.floor(dayEnd.getTime() / 1000),
          countBack: 1200,
        },
        { signal: controller.signal }
      )
      .then((response) => {
        if (controller.signal.aborted) return
        const normalized = (response.bars || [])
          .map((bar) => ({ ...bar, time: bar.time < 1e12 ? bar.time * 1000 : bar.time }))
          .filter((bar) => bar.time >= dayStart.getTime() && bar.time <= dayEnd.getTime())
          .sort((a, b) => a.time - b.time)
        setBars(normalized)
      })
      .catch(() => {
        if (!controller.signal.aborted) setBars([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [entry.dateTime, entry.symbol, sourceResolution])

  if (loading)
    return (
      <div
        className={`flex h-80 items-center justify-center rounded-lg border text-xs ${isDark ? 'border-[#27272A] bg-[#09090B] text-[#71717A]' : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]'}`}
      >
        Loading {entry.symbol} candles…
      </div>
    )
  if (!bars.length)
    return (
      <div
        className={`flex h-80 flex-col items-center justify-center rounded-lg border px-6 text-center ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
      >
        <p
          className={
            isDark ? 'text-sm font-medium text-[#FAFAFA]' : 'text-sm font-medium text-[#09090B]'
          }
        >
          Historical candles unavailable
        </p>
        <p className="mt-1 text-xs text-[#71717A]">
          Import {entry.symbol} data for this date in Replay Data Management to render the setup
          chart.
        </p>
      </div>
    )

  const minuteKey = (value: string) => {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i)
    if (!match) return ''
    let hour = Number(match[1]) % 12
    if (match[4].toUpperCase() === 'PM') hour += 12
    return `${hour}:${match[2]}:${match[3] || '00'}`
  }
  const timeForClock = (clock: string) => {
    const key = minuteKey(clock)
    if (!key) return Number.NaN
    const [hour, minute, second] = key.split(':').map(Number)
    const target = new Date(entry.dateTime)
    target.setHours(hour, minute, second, 0)
    return target.getTime()
  }
  const indexForClockIn = (clock: string, sourceBars: Bar[]) => {
    const targetTime = timeForClock(clock)
    if (!Number.isFinite(targetTime) || !sourceBars.length) return -1
    return sourceBars.reduce(
      (best, bar, index) =>
        Math.abs(bar.time - targetTime) < Math.abs(sourceBars[best]?.time - targetTime)
          ? index
          : best,
      0
    )
  }
  const indexForClock = (clock: string) => indexForClockIn(clock, bars)
  const indexForDateTime = (value: string) => {
    const target = new Date(value).getTime()
    if (!Number.isFinite(target)) return -1
    return bars.reduce(
      (best, bar, index) =>
        Math.abs(bar.time - target) < Math.abs(bars[best]?.time - target) ? index : best,
      0
    )
  }

  const sweepRows = parseLiquiditySweeps(entry.conditionResponses?.['Liquidity sweep'])
  const sweepConfluenceLabels = String(entry.conditionResponses?.['Sweep confluence'] || '')
    .split(';')
    .map((label) => label.replace(/\s*@\s*[\d,.]+\s*$/, '').trim())
  const sweepLabel = (row: LiquiditySweepRow, index: number) => {
    const confluence = sweepConfluenceLabels[index]
    if (confluence) return confluence.replace(/\s*\+\s*/g, ' · ')
    if (row.sourceLabel) return row.sourceLabel
    const level = row.level === 'high' ? 'High' : 'Low'
    return [row.referenceTime, level].filter(Boolean).join(' · ')
  }
  const pdaRows = parsePdaDeliveries(
    entry.conditionResponses?.['HTF PDA delivery'],
    entry.conditionResponses?.['HTF PDA candles']
  ).filter((row) => row.time || row.timeframe || row.pda || row.candles.length)
  const ifvgParts = String(entry.conditionResponses?.IFVG || '').split(/\s*@\s*/, 2)
  const ifvgTime = ifvgParts[1] || ''
  const entryIndex = indexForDateTime(entry.dateTime)
  const exitIndex = entry.exitDateTime ? indexForDateTime(entry.exitDateTime) : -1
  const pdaIndexes = pdaRows.map((row) => indexForClock(row.time))
  const ifvgIndex = indexForClock(ifvgTime)
  const sweepValidation =
    sweepRows.length > 0 &&
    sweepRows.every((row) => {
      const index = indexForClock(row.sweepTime)
      const price = row.price.trim() ? Number(row.price) : Number.NaN
      if (index < 0 || !row.referenceTime || !Number.isFinite(price)) return false
      return row.level === 'high' ? bars[index].high >= price : bars[index].low <= price
    })
  const pdaValidation =
    pdaRows.length > 0 &&
    pdaRows.every((row, index) =>
      Boolean(row.time && row.timeframe && row.pda && pdaIndexes[index] >= 0)
    )
  const ifvgValidation = Boolean(ifvgParts[0] && ifvgTime && ifvgIndex >= 0)

  const imbalanceZone = (eventIndex: number, label: string, color: string) => {
    if (eventIndex < 0) return null
    const candidateIndexes = [
      eventIndex,
      eventIndex - 1,
      eventIndex + 1,
      eventIndex - 2,
      eventIndex + 2,
    ].filter((index) => index >= 2 && index < bars.length)
    for (const index of candidateIndexes) {
      const first = bars[index - 2]
      const third = bars[index]
      if (third.low > first.high) {
        return {
          startIndex: index - 2,
          endIndex: Math.min(bars.length - 1, index + 7),
          low: first.high,
          high: third.low,
          label,
          color,
          measured: true,
        }
      }
      if (third.high < first.low) {
        return {
          startIndex: index - 2,
          endIndex: Math.min(bars.length - 1, index + 7),
          low: third.high,
          high: first.low,
          label,
          color,
          measured: true,
        }
      }
    }
    const eventBar = bars[eventIndex]
    return eventBar
      ? {
          startIndex: Math.max(0, eventIndex - 1),
          endIndex: Math.min(bars.length - 1, eventIndex + 7),
          low: eventBar.low,
          high: eventBar.high,
          label: `${label} · journaled zone`,
          color,
          measured: false,
        }
      : null
  }

  const clocksFrom = extractClockValues
  const resolutionFromLabel = (value: string): JournalChartResolution => {
    const match = value.match(/\b(\d+)\s*(s|m|h)\b/i)
    if (!match) return '1'
    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    return unit === 's' ? `${amount}S` : unit === 'h' ? String(amount * 60) : String(amount)
  }
  const measuredZoneFromClocks = (
    candleClocks: string[],
    calculationResolution: JournalChartResolution,
    endClock: string,
    label: string,
    color: string
  ) => {
    if (candleClocks.length < 3) return null
    const calculationBars = aggregateJournalBars(bars, calculationResolution)
    const first = calculationBars[indexForClockIn(candleClocks[0], calculationBars)]
    const third = calculationBars[indexForClockIn(candleClocks[2], calculationBars)]
    const startIndex = indexForClock(candleClocks[0])
    const endIndex = indexForClock(endClock || candleClocks[2])
    if (!first || !third || startIndex < 0 || endIndex < 0) return null
    if (third.low > first.high) {
      return {
        startIndex,
        endIndex,
        low: first.high,
        high: third.low,
        label,
        color,
        measured: true,
      }
    }
    if (third.high < first.low) {
      return {
        startIndex,
        endIndex,
        low: third.high,
        high: first.low,
        label,
        color,
        measured: true,
      }
    }
    return null
  }

  const ifvgLabel = `IFVG · ${ifvgParts[0] || 'timeframe not set'}`
  const ifvgCandleClocks = clocksFrom(entry.conditionResponses?.['IFVG zone candles'])
  const ifvgInversionClock = clocksFrom(entry.conditionResponses?.['IFVG inversed'])[0] || ifvgTime
  const pdaZones = pdaRows
    .map((row, index) => {
      const label =
        `HTF PDA ${pdaRows.length > 1 ? index + 1 : ''} · ${[row.timeframe, row.pda].filter(Boolean).join(' · ')}`.replace(
          /\s+·/,
          ' ·'
        )
      return (
        measuredZoneFromClocks(
          row.candles,
          resolutionFromLabel(row.timeframe || '15m'),
          row.time,
          label,
          '#3B82F6'
        ) || imbalanceZone(pdaIndexes[index], label, '#3B82F6')
      )
    })
    .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))
  const measuredIfvgZone = measuredZoneFromClocks(
    ifvgCandleClocks,
    resolutionFromLabel(ifvgParts[0] || '1m'),
    ifvgInversionClock,
    ifvgLabel,
    '#10B981'
  )
  const setupZones = [
    ...pdaZones,
    measuredIfvgZone || imbalanceZone(ifvgIndex, ifvgLabel, '#10B981'),
  ].filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))

  const entryPrice = entry.entryPrice.trim() ? Number(entry.entryPrice) : Number.NaN
  const exitPrice = entry.closePrice.trim() ? Number(entry.closePrice) : Number.NaN
  const exitColor =
    entry.outcome === 'loss' ? '#EF4444' : entry.outcome === 'win' ? '#10B981' : '#A1A1AA'
  const priceText = (price: number) =>
    price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const resolutionMs = journalResolutionMs(resolution)
  const chartTime = (time: number) => Math.floor(time / resolutionMs) * resolutionMs

  const handleWidgetReady = (value: unknown) => {
    const widget = value as BwcWidget
    if (typeof widget.drawShape !== 'function') return
    widget.settings?.merge?.(
      {
        canvas: {
          marginTop: 18,
          marginBottom: 8,
        },
        scales: {
          symbolLabelValue: false,
          symbolLabelLine: false,
          symbolLabelName: false,
          countdownToBarClose: false,
        },
      },
      { skipHistory: true }
    )

    setupZones.forEach((zone) => {
      if (zone.color === '#10B981' && resolutionMs > 60_000) return
      const isHtfPda = zone.color === '#3B82F6'
      const start = bars[zone.startIndex]
      const end = bars[zone.endIndex]
      if (!start || !end) return
      const startTime = chartTime(start.time)
      const endTime = Math.max(chartTime(end.time), startTime + resolutionMs)
      widget.drawShape?.(
        'rectangle',
        [
          { time: Math.floor(startTime / 1000), price: zone.high },
          { time: Math.floor(endTime / 1000), price: zone.low },
        ],
        {
          locked: true,
          props: {
            color: zone.color,
            colorOpacity: 90,
            lineWidth: 1,
            lineStyle: zone.measured ? 0 : 2,
            extendRight: isHtfPda,
            showShapeBackground: true,
            shapeBackgroundColor: zone.color,
            shapeBackgroundOpacity: 12,
            label: zone.label,
            textColor: zone.color,
            textColorOpacity: 100,
            textAlignH: 'center',
            textAlignV: 'middle',
            fontSize: 11,
          },
        }
      )
    })

    sweepRows.forEach((row, index) => {
      const sweepBarIndex = indexForClock(row.sweepTime)
      const referenceBarIndex = indexForClock(row.referenceTime)
      const price = row.price.trim() ? Number(row.price) : Number.NaN
      const sweepBar = bars[sweepBarIndex]
      const referenceBar = bars[referenceBarIndex]
      if (!sweepBar || !referenceBar || !Number.isFinite(price)) return
      const sourceTime = chartTime(referenceBar.time)
      let sweptTime = chartTime(sweepBar.time)
      if (sweptTime === sourceTime) sweptTime = sourceTime + resolutionMs
      const sweepColor = isDark ? '#A1A1AA' : '#52525B'
      widget.drawShape?.(
        'trend-line',
        [
          { time: Math.floor(sourceTime / 1000), price },
          { time: Math.floor(sweptTime / 1000), price },
        ],
        {
          locked: true,
          props: {
            color: sweepColor,
            colorOpacity: 80,
            lineWidth: 1,
            lineStyle: 0,
            extendLeft: false,
            extendRight: false,
            leftEnd: 'normal',
            rightEnd: 'normal',
            showMiddlePoint: false,
            showPriceLabels: false,
            alwaysShowStats: false,
            label: sweepLabel(row, index),
            textColor: sweepColor,
            textColorOpacity: 100,
            textAlignH: 'center',
            textAlignV: 'top',
            fontSize: 10,
          },
        }
      )
    })

    const entryBar = bars[entryIndex]
    if (entryBar && Number.isFinite(entryPrice) && resolutionMs <= 15 * 60_000) {
      widget.drawShape?.(
        entry.side === 'short' ? 'arrow-mark-down' : 'arrow-mark-up',
        [{ time: Math.floor(chartTime(entryBar.time) / 1000), price: entryPrice }],
        {
          locked: true,
          props: {
            color: '#3B82F6',
            colorOpacity: 100,
          },
        }
      )
    }

    const exitBar = bars[exitIndex]
    if (exitBar && Number.isFinite(exitPrice) && resolutionMs <= 15 * 60_000) {
      widget.drawShape?.(
        entry.side === 'short' ? 'arrow-mark-up' : 'arrow-mark-down',
        [{ time: Math.floor(chartTime(exitBar.time) / 1000), price: exitPrice }],
        {
          locked: true,
          props: {
            color: exitColor,
            colorOpacity: 100,
          },
        }
      )
    }

    const eventIndexes = [
      ...sweepRows.map((row) => indexForClock(row.sweepTime)),
      ...pdaIndexes,
      ifvgIndex,
      entryIndex,
      exitIndex,
    ].filter((index) => index >= 0)
    const firstEvent = Math.min(...eventIndexes)
    const lastEvent = Math.max(...eventIndexes)
    const firstEventTime = bars[firstEvent]?.time ?? entryBar?.time
    const lastEventTime = bars[lastEvent]?.time ?? exitBar?.time ?? firstEventTime
    const rangeFromTarget = Number(firstEventTime) - resolutionMs * 6
    const rangeToTarget = Number(lastEventTime) + resolutionMs * 6
    const fromBar = chartBars.reduce(
      (best, bar) =>
        Math.abs(bar.time - rangeFromTarget) < Math.abs(best.time - rangeFromTarget) ? bar : best,
      chartBars[0]
    )
    const toBar = chartBars.reduce(
      (best, bar) =>
        Math.abs(bar.time - rangeToTarget) < Math.abs(best.time - rangeToTarget) ? bar : best,
      chartBars[chartBars.length - 1]
    )
    const activePane = widget.getAllChartPanes?.()[0]
    const hideLivePrice = () =>
      activePane?.series?.applyOptions?.({ priceLineVisible: false, lastValueVisible: false })
    hideLivePrice()
    const timeScale = activePane?.chart?.timeScale?.()
    if (fromBar && toBar && timeScale?.setVisibleRange) {
      const range = { from: Math.floor(fromBar.time / 1000), to: Math.floor(toBar.time / 1000) }
      timeScale.setVisibleRange(range)
      window.setTimeout(() => {
        timeScale.setVisibleRange?.(range)
        activePane?.series?.priceScale?.().applyOptions?.({
          autoScale: true,
          scaleMargins: { top: 0.18, bottom: 0.08 },
        })
        hideLivePrice()
      }, 250)
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
    >
      <div
        className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
      >
        <div>
          <p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
            {entry.symbol} ·{' '}
            {JOURNAL_REVIEW_RESOLUTIONS.find((item) => item.value === resolution)?.label} · setup
            review
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {favoriteResolutions.map((favorite) => {
              const item = JOURNAL_REVIEW_RESOLUTIONS.find((option) => option.value === favorite)
              return item ? (
                <button
                  key={item.value}
                  type="button"
                  aria-label={`Use ${item.label} timeframe`}
                  onClick={() => {
                    setResolution(item.value)
                    setTimeframeMenuOpen(false)
                  }}
                  className={`h-8 min-w-9 rounded-md border px-2 text-[10px] font-semibold ${resolution === item.value ? (isDark ? 'border-[#FAFAFA] bg-[#FAFAFA] text-[#09090B]' : 'border-[#18181B] bg-[#18181B] text-white') : isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#D4D4D8]' : 'border-[#D4D4D8] bg-white text-[#52525B]'}`}
                >
                  {item.label}
                </button>
              ) : null
            })}
            <div className="relative inline-block">
              <button
                type="button"
                aria-label="Chart timeframe"
                aria-haspopup="menu"
                aria-expanded={timeframeMenuOpen}
                onClick={() => setTimeframeMenuOpen((open) => !open)}
                className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
              >
                {JOURNAL_REVIEW_RESOLUTIONS.find((item) => item.value === resolution)?.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[#71717A] transition-transform ${timeframeMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {timeframeMenuOpen && (
                <div
                  role="menu"
                  aria-label="Available chart timeframes"
                  className={`absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border p-2 shadow-xl ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}
                >
                  <p className="px-1 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
                    Timeframe
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {JOURNAL_REVIEW_RESOLUTIONS.map((item) => {
                      const setupTimeframe = mentionedResolutions.some(
                        (mentioned) => mentioned.value === item.value
                      )
                      const favorite = favoriteResolutions.includes(item.value)
                      return (
                        <div key={item.value} className="relative">
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setResolution(item.value)
                              setTimeframeMenuOpen(false)
                            }}
                            className={`h-10 w-full rounded-md pr-6 text-[11px] font-semibold ${resolution === item.value ? (isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white') : isDark ? 'text-[#D4D4D8] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}
                          >
                            {item.label}
                            {setupTimeframe && (
                              <span
                                className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#3B82F6]"
                                aria-label="Used by setup"
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`${favorite ? 'Remove' : 'Add'} ${item.label} ${favorite ? 'from' : 'to'} favorites`}
                            onClick={() =>
                              setFavoriteResolutions((items) =>
                                favorite
                                  ? items.filter((value) => value !== item.value)
                                  : [...items, item.value]
                              )
                            }
                            className={`absolute right-1 top-1/2 flex h-7 w-6 -translate-y-1/2 items-center justify-center rounded ${resolution === item.value ? (isDark ? 'text-[#09090B]' : 'text-white') : 'text-[#71717A] hover:text-[#F59E0B]'}`}
                          >
                            <Star
                              className="h-3.5 w-3.5"
                              fill={favorite ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <p className="px-1 pt-2 text-[9px] text-[#71717A]">
                    Blue dots match this setup. Star timeframes to pin them beside the menu.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['Liquidity sweep', sweepValidation],
            ['HTF PDA', pdaValidation],
            ['IFVG', ifvgValidation],
          ].map(([label, valid]) => (
            <span
              key={String(label)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${valid ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}
            >
              {valid && <Check className="h-3 w-3" />}
              {label} {valid ? 'recorded' : 'incomplete'}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[26rem] min-h-0 sm:h-[32rem]">
        <AurenChart
          symbol={entry.symbol}
          timeframe={resolution}
          isDark={isDark}
          practiceAccountId={`journal-${entry.id}`}
          tradeseaServices={chartServices}
          chrome={false}
          drawings
          persistDrawings={false}
          compact
          onWidgetReady={handleWidgetReady}
          className="journal-bwc-review"
        />
      </div>
      <div
        className={`flex flex-wrap gap-2 border-t px-3 py-3 text-[10px] ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-white'}`}
      >
        {sweepRows.map((row, index) => (
          <span
            key={`${row.sweepTime}-${index}`}
            className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}
          >
            S{index + 1} · {sweepLabel(row, index)} · {priceText(Number(row.price))}
          </span>
        ))}
        {pdaRows.map((row, index) => (
          <span
            key={`${row.time}-${row.timeframe}-${index}`}
            className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-blue-500/25 text-blue-400' : 'border-blue-500/30 text-blue-700'}`}
          >
            PDA {pdaRows.length > 1 ? index + 1 : ''} · {row.time} · {row.timeframe} {row.pda}
          </span>
        ))}
        <span
          className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-emerald-500/25 text-emerald-400' : 'border-emerald-500/30 text-emerald-700'}`}
        >
          IFVG · {ifvgTime} · {ifvgParts[0]}
        </span>
        <span
          className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-blue-500/25 text-blue-400' : 'border-blue-500/30 text-blue-700'}`}
        >
          Entry ·{' '}
          {new Date(entry.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
          · {priceText(entryPrice)}
        </span>
        <span
          className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-emerald-500/25 text-emerald-400' : 'border-emerald-500/30 text-emerald-700'}`}
        >
          Exit ·{' '}
          {entry.exitDateTime
            ? new Date(entry.exitDateTime).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })
            : '—'}{' '}
          · {priceText(exitPrice)}
        </span>
      </div>
    </div>
  )
}
