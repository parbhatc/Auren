import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpenCheck, Check, ChevronDown, ChevronLeft, ChevronRight, ShieldCheck, Trash2, X } from 'lucide-react'
import {
  journalAPI,
  type JournalEntryRecord,
  type JournalRiskLeg,
  type JournalRiskMode,
  type JournalRiskPlan,
  type JournalStrategyRecord,
} from '../../../api/journal.api'
import type { BacktestSession } from '../../../types/backtester'
import {
  isReplayJournalEnabled,
  REPLAY_JOURNAL_PREFERENCE_EVENT,
} from '../../../features/journal/replayJournalPreference'

type ConditionType =
  | 'boolean'
  | 'time'
  | 'timeframe'
  | 'timeframe_time'
  | 'liquidity_sweep'
  | 'pda_delivery'
  | 'text'
  | 'number'

type PlaybookCondition = { id: string; label: string; type: ConditionType }

export type ReplayJournalSnapshot = {
  kind: 'cursor' | 'open_position' | 'closed_trade'
  symbol: string
  side: 'long' | 'short'
  entryPrice: string
  closePrice: string
  size: string
  pnl: string
  outcome: JournalEntryRecord['outcome']
  entryDateTime: string
  exitDateTime: string
  cursorDateTime: string
  chartResolution: string
  barHigh: string
  barLow: string
  availableBars: Array<{ dateTime: string; label: string; time: string; open: string; high: string; low: string; close: string }>
  stopLossPrice: string
  takeProfitPrice: string
  sourceTradeId?: string
}

type Props = {
  isDark: boolean
  session: BacktestSession
  navigate: (path: string) => void
  getSnapshot: (preferExecution: boolean) => ReplayJournalSnapshot
  openRequest?: number
}

type ReplayJournalDraft = {
  strategyId: string
  responses: Record<string, string | boolean>
  riskPlan: JournalRiskPlan
  notes: string
}

const TIMEFRAMES = ['30s', '1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1D']
const PDA_TYPES = ['FVG', 'Inversion FVG', 'Order Block', 'Breaker Block', 'Mitigation Block', 'Rejection Block', 'Liquidity Void', 'Other PDA']
const VALID_TYPES: ConditionType[] = ['boolean', 'time', 'timeframe', 'timeframe_time', 'liquidity_sweep', 'pda_delivery', 'text', 'number']

const blankRiskLeg = (): JournalRiskLeg => ({ mode: 'none', value: '', price: '', basis: '', timeframe: '' })
const blankRiskPlan = (): JournalRiskPlan => ({
  stopLoss: blankRiskLeg(),
  breakEven: { ...blankRiskLeg(), enabled: false },
  takeProfit: blankRiskLeg(),
})

function conditionsFor(strategy?: JournalStrategyRecord): PlaybookCondition[] {
  if (!strategy) return []
  let raw: unknown = strategy.entry_conditions
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = [] }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((value, index) => {
    if (value && typeof value === 'object') {
      const item = value as Partial<PlaybookCondition>
      const label = String(item.label || `Condition ${index + 1}`)
      return {
        id: String(item.id || `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`),
        label,
        type: VALID_TYPES.includes(item.type as ConditionType) ? item.type as ConditionType : 'text',
      }
    }
    const label = String(value || `Condition ${index + 1}`)
    return { id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`, label, type: 'text' as const }
  })
}

function clockFromInput(value: string): string {
  if (!value) return ''
  const [hourText, minute = '00', second = ''] = value.split(':')
  const hour = Number(hourText)
  return `${hour % 12 || 12}:${minute}${second ? `:${second}` : ''} ${hour >= 12 ? 'PM' : 'AM'}`
}

function clockFromDateTime(value: string): string {
  const clock = value.match(/T(\d{2}:\d{2}(?::\d{2})?)/)?.[1] || ''
  return clockFromInput(clock)
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-[11px] font-medium text-[#71717A]">{label}{children}</label>
}

function isValidPivot(
  bars: ReplayJournalSnapshot['availableBars'],
  index: number,
  side: 'high' | 'low',
  leftStrength: number,
  rightStrength: number,
): boolean {
  if (index < leftStrength || index + rightStrength >= bars.length) return false
  const value = Number(bars[index]?.[side])
  if (!Number.isFinite(value)) return false
  for (let offset = 1; offset <= leftStrength; offset += 1) {
    const neighbor = Number(bars[index - offset]?.[side])
    if (!Number.isFinite(neighbor) || (side === 'high' ? value <= neighbor : value >= neighbor)) return false
  }
  for (let offset = 1; offset <= rightStrength; offset += 1) {
    const neighbor = Number(bars[index + offset]?.[side])
    if (!Number.isFinite(neighbor) || (side === 'high' ? value <= neighbor : value >= neighbor)) return false
  }
  return true
}

function timeframeLabel(value: string): string {
  const normalized = String(value || '').trim().toLowerCase()
  if (/^\d+$/.test(normalized)) {
    const minutes = Number(normalized)
    if (minutes === 1440) return '1D'
    if (minutes % 60 === 0) return `${minutes / 60}h`
    return `${minutes}m`
  }
  if (normalized.endsWith('d')) return `${Number(normalized.slice(0, -1)) || 1}D`
  return normalized
}

type ReplayBarOption = ReplayJournalSnapshot['availableBars'][number]
type LiquiditySweepSource = 'pivot' | 'london' | 'asia'
type SessionRange = {
  key: string
  label: string
  sourceLabel: string
  referenceBar: ReplayBarOption
  price: string
}

const LIQUIDITY_SESSIONS: Record<Exclude<LiquiditySweepSource, 'pivot'>, { label: string; hours: string; startHour: number; endHour: number }> = {
  london: { label: 'London', hours: '2:00–5:00 AM', startHour: 2, endHour: 5 },
  asia: { label: 'Asia', hours: '8:00 PM–12:00 AM', startHour: 20, endHour: 24 },
}

type ValidPda = {
  kind: string
  direction: 'bullish' | 'bearish'
  candles: ReplayBarOption[]
  lower: number
  upper: number
  detail: string
}

function resolutionSeconds(value: string): number {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized.endsWith('s')) return Number(normalized.slice(0, -1)) || 0
  if (normalized.endsWith('m')) return (Number(normalized.slice(0, -1)) || 0) * 60
  if (normalized.endsWith('h')) return (Number(normalized.slice(0, -1)) || 0) * 3600
  if (normalized.endsWith('d')) return (Number(normalized.slice(0, -1)) || 0) * 86400
  return (Number(normalized) || 0) * 60
}

function aggregateReplayBars(
  bars: ReplayJournalSnapshot['availableBars'],
  sourceResolution: string,
  targetResolution: string,
): ReplayJournalSnapshot['availableBars'] {
  const sourceSec = resolutionSeconds(sourceResolution)
  const targetSec = resolutionSeconds(targetResolution)
  if (!sourceSec || !targetSec || targetSec < sourceSec) return []
  if (targetSec === sourceSec) return bars
  const grouped = new Map<number, ReplayJournalSnapshot['availableBars']>()
  bars.forEach((bar) => {
    const parsed = new Date(bar.dateTime)
    const timestamp = parsed.getTime()
    if (!Number.isFinite(timestamp)) return
    const localDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
    const secondsIntoDay = parsed.getHours() * 3600 + parsed.getMinutes() * 60 + parsed.getSeconds()
    const bucket = localDay + Math.floor(secondsIntoDay / targetSec) * targetSec * 1000
    const group = grouped.get(bucket) || []
    group.push(bar)
    grouped.set(bucket, group)
  })
  return [...grouped.entries()].sort(([a], [b]) => a - b).map(([bucket, group]) => {
    const first = group[0]
    const last = group[group.length - 1]
    const date = new Date(bucket)
    const dateTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
    return {
      dateTime,
      label: date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      time: dateTime.split('T')[1],
      open: first.open,
      high: String(Math.max(...group.map((bar) => Number(bar.high)))),
      low: String(Math.min(...group.map((bar) => Number(bar.low)))),
      close: last.close,
    }
  })
}

function completedSessionRanges(
  bars: ReplayJournalSnapshot['availableBars'],
  source: Exclude<LiquiditySweepSource, 'pivot'>,
  side: 'high' | 'low',
  cursorDateTime: string,
  sourceResolution: string,
): SessionRange[] {
  const session = LIQUIDITY_SESSIONS[source]
  const cursorTime = new Date(cursorDateTime).getTime()
  const barMs = resolutionSeconds(sourceResolution) * 1000
  if (!Number.isFinite(cursorTime) || !barMs || barMs > 60 * 60 * 1000) return []

  const byDay = new Map<string, ReplayJournalSnapshot['availableBars']>()
  bars.forEach((bar) => {
    const date = new Date(bar.dateTime)
    if (!Number.isFinite(date.getTime())) return
    const hour = date.getHours()
    if (hour < session.startHour || hour >= session.endHour) return
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const group = byDay.get(day) || []
    group.push(bar)
    byDay.set(day, group)
  })

  return [...byDay.entries()].flatMap(([day, group]) => {
    const [year, month, date] = day.split('-').map(Number)
    const rangeStart = new Date(year, month - 1, date, session.startHour).getTime()
    const rangeEnd = new Date(year, month - 1, date + (session.endHour === 24 ? 1 : 0), session.endHour % 24).getTime()
    const orderedGroup = [...group].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    const firstBarTime = new Date(orderedGroup[0]?.dateTime).getTime()
    const lastBarTime = new Date(orderedGroup[orderedGroup.length - 1]?.dateTime).getTime()
    const coversFullRange = firstBarTime <= rangeStart && lastBarTime + barMs >= rangeEnd
    if (cursorTime < rangeEnd || !orderedGroup.length || !coversFullRange) return []
    const referenceBar = orderedGroup.reduce((best, bar) => {
      const next = Number(bar[side])
      const current = Number(best[side])
      if (!Number.isFinite(next)) return best
      if (!Number.isFinite(current) || (side === 'high' ? next > current : next < current)) return bar
      return best
    }, orderedGroup[0])
    const price = referenceBar[side]
    if (!Number.isFinite(Number(price))) return []
    return [{
      key: `${source}-${day}-${side}`,
      label: `${new Date(year, month - 1, date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${session.label} ${session.hours}`,
      sourceLabel: `${session.label} ${session.hours} ${side === 'high' ? 'High' : 'Low'}`,
      referenceBar,
      price,
    }]
  }).sort((a, b) => new Date(a.referenceBar.dateTime).getTime() - new Date(b.referenceBar.dateTime).getTime())
}

function candleNumbers(bar?: ReplayBarOption) {
  if (!bar) return null
  const open = Number(bar.open)
  const high = Number(bar.high)
  const low = Number(bar.low)
  const close = Number(bar.close)
  return [open, high, low, close].every(Number.isFinite) ? { open, high, low, close } : null
}

function detectFvg(bars: ReplayJournalSnapshot['availableBars'], index: number): ValidPda | null {
  const first = bars[index]
  const middle = bars[index + 1]
  const third = bars[index + 2]
  if (!first || !middle || !third) return null
  const a = candleNumbers(first)
  const c = candleNumbers(third)
  if (!a || !c) return null
  if (c.low > a.high) return { kind: 'FVG', direction: 'bullish', candles: [first, middle, third], lower: a.high, upper: c.low, detail: 'Three-candle imbalance' }
  if (c.high < a.low) return { kind: 'FVG', direction: 'bearish', candles: [first, middle, third], lower: c.high, upper: a.low, detail: 'Three-candle imbalance' }
  return null
}

function detectPda(bars: ReplayJournalSnapshot['availableBars'], index: number, pdaType: string): ValidPda | null {
  const normalized = pdaType.trim().toLowerCase()
  if (normalized === 'fvg' || normalized === 'inversion fvg') return detectFvg(bars, index)

  const first = bars[index]
  const second = bars[index + 1]
  const third = bars[index + 2]
  const a = candleNumbers(first)
  const b = candleNumbers(second)
  const c = candleNumbers(third)
  if (!first || !a) return null

  if (normalized === 'order block' && second && third && b && c) {
    if (a.close < a.open && Math.max(b.close, c.close) > a.high) return { kind: pdaType, direction: 'bullish', candles: [first, second, third], lower: a.low, upper: a.open, detail: 'Last bearish candle before bullish displacement' }
    if (a.close > a.open && Math.min(b.close, c.close) < a.low) return { kind: pdaType, direction: 'bearish', candles: [first, second, third], lower: a.open, upper: a.high, detail: 'Last bullish candle before bearish displacement' }
  }

  if (normalized === 'breaker block' && second && third && b && c) {
    if (a.close < a.open && b.low < a.low && c.close > a.high) return { kind: pdaType, direction: 'bullish', candles: [first, second, third], lower: a.low, upper: a.high, detail: 'Bearish block swept, then closed above' }
    if (a.close > a.open && b.high > a.high && c.close < a.low) return { kind: pdaType, direction: 'bearish', candles: [first, second, third], lower: a.low, upper: a.high, detail: 'Bullish block swept, then closed below' }
  }

  if (normalized === 'mitigation block' && second && third && b && c) {
    if (a.close < a.open && b.low >= a.low && c.close > a.high) return { kind: pdaType, direction: 'bullish', candles: [first, second, third], lower: a.low, upper: a.open, detail: 'Protected bearish candle followed by bullish displacement' }
    if (a.close > a.open && b.high <= a.high && c.close < a.low) return { kind: pdaType, direction: 'bearish', candles: [first, second, third], lower: a.open, upper: a.high, detail: 'Protected bullish candle followed by bearish displacement' }
  }

  if (normalized === 'rejection block') {
    const body = Math.max(Math.abs(a.close - a.open), Number.EPSILON)
    const lowerWick = Math.min(a.open, a.close) - a.low
    const upperWick = a.high - Math.max(a.open, a.close)
    const midpoint = (a.high + a.low) / 2
    if (lowerWick >= body * 1.5 && a.close >= midpoint) return { kind: pdaType, direction: 'bullish', candles: [first], lower: a.low, upper: Math.min(a.open, a.close), detail: 'Lower rejection wick is at least 1.5x the body' }
    if (upperWick >= body * 1.5 && a.close <= midpoint) return { kind: pdaType, direction: 'bearish', candles: [first], lower: Math.max(a.open, a.close), upper: a.high, detail: 'Upper rejection wick is at least 1.5x the body' }
  }

  if (normalized === 'liquidity void' && second && third && b && c) {
    const values = [a, b, c]
    const strongBodies = values.every((bar) => Math.abs(bar.close - bar.open) >= (bar.high - bar.low) * 0.6)
    if (strongBodies && values.every((bar) => bar.close > bar.open) && a.close < b.close && b.close < c.close) return { kind: pdaType, direction: 'bullish', candles: [first, second, third], lower: Math.min(a.open, a.close), upper: Math.max(c.open, c.close), detail: 'Three consecutive displacement candles' }
    if (strongBodies && values.every((bar) => bar.close < bar.open) && a.close > b.close && b.close > c.close) return { kind: pdaType, direction: 'bearish', candles: [first, second, third], lower: Math.min(c.open, c.close), upper: Math.max(a.open, a.close), detail: 'Three consecutive displacement candles' }
  }
  return null
}

function ValidatedPdaPicker({
  availableBars,
  chartResolution,
  timeframe,
  pdaType,
  inputClass,
  isDark,
  mode = 'tap',
  cursorClock,
  onCapture,
}: {
  availableBars: ReplayJournalSnapshot['availableBars']
  chartResolution: string
  timeframe: string
  pdaType: string
  inputClass: string
  isDark: boolean
  mode?: 'tap' | 'inversion'
  cursorClock: string
  onCapture: (pda: ValidPda) => void
}) {
  const bars = useMemo(() => aggregateReplayBars(availableBars, chartResolution, timeframe), [availableBars, chartResolution, timeframe])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const requiredCandles = pdaType === 'Rejection Block' ? 1 : 3
  useEffect(() => setSelectedIndex(Math.max(0, bars.length - requiredCandles - 1)), [bars.length, timeframe, pdaType, requiredCandles])
  const maxStart = Math.max(0, bars.length - requiredCandles - 1)
  const safeIndex = Math.min(selectedIndex, maxStart)
  const selected = bars[safeIndex]
  const pda = detectPda(bars, safeIndex, pdaType)
  const cursorBar = bars[bars.length - 1]
  const cursor = candleNumbers(cursorBar)
  const afterFormation = Boolean(pda && cursorBar && new Date(cursorBar.dateTime).getTime() > new Date(pda.candles[pda.candles.length - 1].dateTime).getTime())
  const tapped = Boolean(pda && cursor && afterFormation && cursor.low <= pda.upper && cursor.high >= pda.lower)
  const inversed = Boolean(pda && cursor && afterFormation && (pda.direction === 'bullish' ? cursor.close < pda.lower : cursor.close > pda.upper))
  const confirmed = mode === 'inversion' ? inversed : tapped
  const canCapture = Boolean(pda && confirmed)
  const selectDateTime = (dateTime: string) => {
    const target = new Date(dateTime).getTime()
    if (!Number.isFinite(target)) return
    let closest = 0
    let distance = Infinity
    bars.slice(0, Math.max(0, bars.length - requiredCandles)).forEach((bar, index) => {
      const nextDistance = Math.abs(new Date(bar.dateTime).getTime() - target)
      if (nextDistance < distance) { closest = index; distance = nextDistance }
    })
    setSelectedIndex(closest)
  }

  if (!timeframe) return null
  if (!bars.length) return <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-500">This timeframe is finer than the loaded chart data. Switch the chart to {timeframe} first, then reopen the journal.</p>
  if (bars.length <= requiredCandles) return <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-500">Advance replay until {requiredCandles} completed source candle{requiredCandles === 1 ? '' : 's'} and one later confirmation candle are loaded.</p>
  return <div className={`rounded-lg border p-3 ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-[#FAFAFA]'}`}>
    <p className="mb-2 text-[10px] text-[#71717A]">Select the source candle. Its structure and the replay-cursor confirmation are checked automatically.</p>
    <div className="grid grid-cols-[auto_1fr_auto] gap-2"><button type="button" aria-label={`Previous ${pdaType} source candle`} disabled={safeIndex === 0} onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))} className={`h-9 w-9 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><ChevronLeft className="mx-auto h-4 w-4" /></button><input type="datetime-local" step="1" aria-label={`${pdaType} first candle date and time`} value={selected?.dateTime || ''} onChange={(event) => selectDateTime(event.target.value)} className={`${inputClass} min-w-0 w-full`} /><button type="button" aria-label={`Next ${pdaType} source candle`} disabled={safeIndex >= maxStart} onClick={() => setSelectedIndex((index) => Math.min(maxStart, index + 1))} className={`h-9 w-9 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><ChevronRight className="mx-auto h-4 w-4" /></button></div>
    <select aria-label={`All ${pdaType} source candles`} value={selected?.dateTime || ''} onChange={(event) => selectDateTime(event.target.value)} className={`${inputClass} mt-2 w-full`}>{bars.slice(0, Math.max(0, bars.length - requiredCandles)).map((bar, index) => { const candidate = detectPda(bars, index, pdaType); return <option key={bar.dateTime} value={bar.dateTime}>{bar.label}{candidate ? ` · Valid ${candidate.direction} ${pdaType}` : ` · Not a ${pdaType}`}</option> })}</select>
    {pda ? <div className={`mt-2 rounded-lg border p-2 text-[11px] ${confirmed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}><p className="font-semibold">Valid {pda.direction} {pdaType} · {pda.lower.toLocaleString()}–{pda.upper.toLocaleString()}</p><p className="mt-0.5">{pda.detail} · {pda.candles.map((bar) => clockFromInput(bar.time)).join(' · ')}</p><p className="mt-1">{mode === 'inversion' ? (inversed ? `Inversion confirmed at ${cursorClock}` : `No confirming close through the zone at ${cursorClock}`) : (tapped ? `Zone tapped at ${cursorClock}` : `Zone not touched at ${cursorClock}`)}</p></div> : <p className="mt-2 text-[11px] text-red-500">The selected candle{requiredCandles > 1 ? ' sequence does' : ' does'} not form a valid {pdaType}.</p>}
    <button type="button" disabled={!canCapture} onClick={() => pda && onCapture(pda)} className={`mt-2 h-9 w-full rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{mode === 'inversion' ? `Capture validated inversion · ${cursorClock}` : `Capture validated tap · ${cursorClock}`}</button>
  </div>
}

function LiquiditySweepField({
  condition,
  value,
  setValue,
  inputClass,
  isDark,
  availableBars,
  chartResolution,
  defaultBias,
  fallback,
}: {
  condition: PlaybookCondition
  value: string | boolean | undefined
  setValue: (value: string | boolean) => void
  inputClass: string
  isDark: boolean
  availableBars: ReplayJournalSnapshot['availableBars']
  chartResolution: string
  defaultBias: 'long' | 'short'
  fallback: ReplayJournalSnapshot['availableBars'][number]
}) {
  const bars = availableBars.length ? availableBars : [fallback]
  const normalizedChartTimeframe = timeframeLabel(chartResolution)
  const [bias, setBias] = useState<'long' | 'short'>(defaultBias)
  const [source, setSource] = useState<LiquiditySweepSource>('pivot')
  const [timeframe, setTimeframe] = useState(TIMEFRAMES.includes(normalizedChartTimeframe) ? normalizedChartTimeframe : '1m')
  const [leftStrength, setLeftStrength] = useState(1)
  const [rightStrength, setRightStrength] = useState(1)
  const pivotSide = bias === 'long' ? 'low' as const : 'high' as const
  const referenceBars = useMemo(() => aggregateReplayBars(bars, chartResolution, timeframe), [bars, chartResolution, timeframe])
  const pivotCandidates = useMemo(
    () => referenceBars.filter((_, index) => isValidPivot(referenceBars, index, pivotSide, leftStrength, rightStrength)),
    [leftStrength, pivotSide, referenceBars, rightStrength],
  )
  const [selectedPivotIndex, setSelectedPivotIndex] = useState(0)
  const sessionRanges = useMemo(
    () => source === 'pivot' ? [] : completedSessionRanges(bars, source, pivotSide, fallback.dateTime, chartResolution),
    [bars, chartResolution, fallback.dateTime, pivotSide, source],
  )
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)
  useEffect(() => setBias(defaultBias), [defaultBias])
  useEffect(() => setSelectedPivotIndex(Math.max(0, pivotCandidates.length - 1)), [bias, leftStrength, pivotCandidates.length, rightStrength, timeframe])
  useEffect(() => setSelectedSessionIndex(Math.max(0, sessionRanges.length - 1)), [bias, sessionRanges.length, source])
  const safePivotIndex = Math.min(selectedPivotIndex, Math.max(0, pivotCandidates.length - 1))
  const selectedPivot = pivotCandidates[safePivotIndex]
  const safeSessionIndex = Math.min(selectedSessionIndex, Math.max(0, sessionRanges.length - 1))
  const selectedSession = sessionRanges[safeSessionIndex]
  const rows = String(value || '').split('\n').filter(Boolean).map((line) => {
    const [sweepTime = '', referenceTime = '', level = 'high', price = '', sourceLabel = ''] = line.split('|').map((part) => part.trim())
    return { sweepTime, referenceTime, level, price, sourceLabel }
  })
  const update = (next: typeof rows) => setValue(next.map((row) => `${row.sweepTime} | ${row.referenceTime} | ${row.level} | ${row.price} | ${row.sourceLabel}`).join('\n'))
  const selectPivotDateTime = (dateTime: string) => {
    const target = new Date(dateTime).getTime()
    if (!Number.isFinite(target)) return
    let closest = 0
    let distance = Infinity
    pivotCandidates.forEach((bar, index) => {
      const nextDistance = Math.abs(new Date(bar.dateTime).getTime() - target)
      if (nextDistance < distance) {
        closest = index
        distance = nextDistance
      }
    })
    setSelectedPivotIndex(closest)
  }
  const pivotPrice = Number(selectedPivot?.[pivotSide])
  const cursorExtreme = Number(pivotSide === 'low' ? fallback.low : fallback.high)
  const sweepConfirmed = Boolean(selectedPivot && Number.isFinite(pivotPrice) && Number.isFinite(cursorExtreme) && (pivotSide === 'low' ? cursorExtreme <= pivotPrice : cursorExtreme >= pivotPrice))
  const sessionPrice = Number(selectedSession?.price)
  const sessionSweepConfirmed = Boolean(selectedSession && Number.isFinite(sessionPrice) && Number.isFinite(cursorExtreme) && (pivotSide === 'low' ? cursorExtreme <= sessionPrice : cursorExtreme >= sessionPrice))
  const capturePivot = () => selectedPivot && update([...rows, {
    sweepTime: clockFromDateTime(fallback.dateTime) || fallback.time || fallback.label,
    referenceTime: selectedPivot.label || selectedPivot.dateTime,
    level: pivotSide,
    price: selectedPivot[pivotSide],
    sourceLabel: `${timeframe} ${pivotSide === 'high' ? 'High' : 'Low'}`,
  }])
  const captureSession = () => selectedSession && update([...rows, {
    sweepTime: clockFromDateTime(fallback.dateTime) || fallback.time || fallback.label,
    referenceTime: selectedSession.referenceBar.label || selectedSession.referenceBar.dateTime,
    level: pivotSide,
    price: selectedSession.price,
    sourceLabel: selectedSession.sourceLabel,
  }])

  return <div className="space-y-3">
    {rows.map((row, index) => <div key={index} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div><p className={`text-xs font-medium ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{row.sweepTime} · swept {row.sourceLabel || row.level}{row.price ? ` at ${Number(row.price).toLocaleString()}` : ''}</p>{row.referenceTime && <p className="mt-0.5 text-[10px] text-[#71717A]">Source {row.referenceTime}</p>}</div><button type="button" aria-label={`Remove ${condition.label} ${index + 1}`} onClick={() => update(rows.filter((_, rowIndex) => rowIndex !== index))} className="h-8 w-8 shrink-0 rounded-lg text-[#71717A] hover:bg-red-500/10 hover:text-red-500"><Trash2 className="mx-auto h-3.5 w-3.5" /></button></div>)}

    <div role="group" aria-label="Liquidity sweep bias" className={`grid grid-cols-2 gap-1 rounded-lg border p-1 ${isDark ? 'border-[#3F3F46] bg-[#121215]' : 'border-[#D4D4D8] bg-[#FAFAFA]'}`}><button type="button" onClick={() => setBias('long')} className={`h-9 rounded-md text-xs font-semibold ${bias === 'long' ? 'bg-blue-500/10 text-blue-500 ring-1 ring-inset ring-blue-500/40' : 'text-[#71717A]'}`}>Long bias · sweep low</button><button type="button" onClick={() => setBias('short')} className={`h-9 rounded-md text-xs font-semibold ${bias === 'short' ? 'bg-blue-500/10 text-blue-500 ring-1 ring-inset ring-blue-500/40' : 'text-[#71717A]'}`}>Short bias · sweep high</button></div>

    <div role="group" aria-label="Liquidity sweep source" className={`grid grid-cols-3 gap-1 rounded-lg border p-1 ${isDark ? 'border-[#3F3F46] bg-[#121215]' : 'border-[#D4D4D8] bg-[#FAFAFA]'}`}>
      {([['pivot', 'Pivot'], ['london', 'London · 2–5 AM'], ['asia', 'Asia · 8 PM–12 AM']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setSource(value)} className={`min-h-9 rounded-md px-2 text-[11px] font-semibold ${source === value ? 'bg-blue-500/10 text-blue-500 ring-1 ring-inset ring-blue-500/40' : 'text-[#71717A]'}`}>{label}</button>)}
    </div>

    <div className={`rounded-lg border p-3 ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-[#FAFAFA]'}`}>
      {source === 'pivot' ? <>
      <p className="mb-3 text-[10px] text-[#71717A]">Choose the sweep timeframe, then select the confirmed candle that created the {pivotSide}. Default validation is 1 candle left and 1 right.</p>
      <div className="grid grid-cols-3 gap-2"><FieldShell label="Sweep timeframe"><select aria-label="Liquidity sweep timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className={`${inputClass} mt-1 w-full`}>{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select></FieldShell><FieldShell label="Pivot left"><input type="number" inputMode="numeric" min="1" max="50" aria-label="Liquidity pivot left strength" value={leftStrength} onChange={(event) => setLeftStrength(Math.max(1, Math.min(50, Math.floor(Number(event.target.value) || 1))))} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Pivot right"><input type="number" inputMode="numeric" min="1" max="50" aria-label="Liquidity pivot right strength" value={rightStrength} onChange={(event) => setRightStrength(Math.max(1, Math.min(50, Math.floor(Number(event.target.value) || 1))))} className={`${inputClass} mt-1 w-full`} /></FieldShell></div>
      {!referenceBars.length ? <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-500">The loaded chart resolution cannot build {timeframe}. Switch the chart to {timeframe} or a finer timeframe.</p> : !pivotCandidates.length ? <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-500">No confirmed {timeframe} pivot {pivotSide}s are loaded with {leftStrength}L/{rightStrength}R strength.</p> : <>
        <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2"><button type="button" aria-label="Previous valid liquidity level" disabled={safePivotIndex === 0} onClick={() => setSelectedPivotIndex((index) => Math.max(0, index - 1))} className={`h-9 w-9 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><ChevronLeft className="mx-auto h-4 w-4" /></button><input type="datetime-local" step="1" aria-label="Reference pivot date and time" value={selectedPivot?.dateTime || ''} onChange={(event) => selectPivotDateTime(event.target.value)} className={`${inputClass} min-w-0 w-full`} /><button type="button" aria-label="Next valid liquidity level" disabled={safePivotIndex >= pivotCandidates.length - 1} onClick={() => setSelectedPivotIndex((index) => Math.min(pivotCandidates.length - 1, index + 1))} className={`h-9 w-9 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><ChevronRight className="mx-auto h-4 w-4" /></button></div>
        <select aria-label="Valid liquidity pivot candles" value={selectedPivot?.dateTime || ''} onChange={(event) => selectPivotDateTime(event.target.value)} className={`${inputClass} mt-2 w-full`}>{pivotCandidates.map((bar) => <option key={`${bar.dateTime}-${bar[pivotSide]}`} value={bar.dateTime}>{bar.label} · {timeframe} {pivotSide} {bar[pivotSide]}</option>)}</select>
        {selectedPivot && <div className={`mt-2 rounded-lg border p-2 text-[11px] ${sweepConfirmed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}><p className="font-semibold">Valid {leftStrength}L/{rightStrength}R {timeframe} pivot {pivotSide} · {Number(selectedPivot[pivotSide]).toLocaleString()}</p><p className="mt-1">{sweepConfirmed ? `Current replay candle swept this ${pivotSide}.` : `Current replay candle has not traded through this ${pivotSide}.`}</p></div>}
        <button type="button" disabled={!sweepConfirmed} onClick={capturePivot} className={`mt-2 h-9 w-full rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{sweepConfirmed ? `Add valid ${timeframe} ${pivotSide} sweep` : `No ${pivotSide} sweep at current cursor`}</button>
      </>}
      </> : <>
        <p className="mb-3 text-[10px] text-[#71717A]">The {LIQUIDITY_SESSIONS[source].label} range uses replay-chart time. Its completed {pivotSide} is calculated from {LIQUIDITY_SESSIONS[source].hours}, then checked against the current candle.</p>
        {!sessionRanges.length ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-500">No completed {LIQUIDITY_SESSIONS[source].label} range is loaded. Use a 1-hour or finer chart and load bars covering {LIQUIDITY_SESSIONS[source].hours}.</p> : <>
          <select aria-label={`${LIQUIDITY_SESSIONS[source].label} liquidity range`} value={selectedSession?.key || ''} onChange={(event) => setSelectedSessionIndex(Math.max(0, sessionRanges.findIndex((range) => range.key === event.target.value)))} className={`${inputClass} w-full`}>{sessionRanges.map((range) => <option key={range.key} value={range.key}>{range.label} · {pivotSide} {Number(range.price).toLocaleString()}</option>)}</select>
          {selectedSession && <div className={`mt-2 rounded-lg border p-2 text-[11px] ${sessionSweepConfirmed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}><p className="font-semibold">{selectedSession.sourceLabel} · {Number(selectedSession.price).toLocaleString()}</p><p className="mt-0.5">Range extreme formed at {selectedSession.referenceBar.label}.</p><p className="mt-1">{sessionSweepConfirmed ? `Current replay candle swept this ${pivotSide}.` : `Current replay candle has not traded through this ${pivotSide}.`}</p></div>}
          <button type="button" disabled={!sessionSweepConfirmed} onClick={captureSession} className={`mt-2 h-9 w-full rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{sessionSweepConfirmed ? `Add ${LIQUIDITY_SESSIONS[source].label} ${pivotSide} sweep` : `No ${LIQUIDITY_SESSIONS[source].label} ${pivotSide} sweep at current cursor`}</button>
        </>}
      </>}
    </div>
  </div>
}

function PdaDeliveryField({
  condition,
  value,
  setValue,
  inputClass,
  isDark,
  cursorClock,
  availableBars,
  chartResolution,
}: {
  condition: PlaybookCondition
  value: string | boolean | undefined
  setValue: (value: string | boolean) => void
  inputClass: string
  isDark: boolean
  cursorClock: string
  availableBars: ReplayJournalSnapshot['availableBars']
  chartResolution: string
}) {
  const [timeframe, setTimeframe] = useState('')
  const [pdaType, setPdaType] = useState('')
  const [customPda, setCustomPda] = useState('')
  const rows = String(value || '').split('\n').filter(Boolean).map((line) => {
    const [time = '', rowTimeframe = '', pda = '', source = ''] = line.split(/\s*@\s*/, 4)
    return { time, timeframe: rowTimeframe, pda, source }
  })
  const update = (next: typeof rows) => setValue(next.map((row) => `${row.time} @ ${row.timeframe} @ ${row.pda} @ ${row.source}`).join('\n'))
  const captureValidated = (pda: ValidPda) => {
    const source = `${pda.candles.map((bar) => bar.label || bar.dateTime).join(', ')} | zone ${pda.lower}–${pda.upper}`
    update([...rows, { time: cursorClock, timeframe, pda: `${pda.direction} ${pdaType}`, source }])
  }
  const captureCustom = () => {
    const name = customPda.trim()
    if (!timeframe || !name) return
    update([...rows, { time: cursorClock, timeframe, pda: name, source: 'Custom PDA — not structurally validated' }])
  }
  const selectedIsCustom = pdaType === 'Other PDA'

  return <div className="space-y-2">
    {rows.map((row, index) => <div key={`${row.time}-${row.timeframe}-${index}`} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div><p className={`text-xs font-medium ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{row.time} · {row.timeframe} {row.pda}</p>{row.source && <p className="mt-0.5 text-[10px] text-[#71717A]">Source: {row.source}</p>}</div><button type="button" aria-label={`Remove ${condition.label} ${index + 1}`} onClick={() => update(rows.filter((_, rowIndex) => rowIndex !== index))} className="h-8 w-8 shrink-0 rounded-lg text-[#71717A] hover:bg-red-500/10 hover:text-red-500"><Trash2 className="mx-auto h-3.5 w-3.5" /></button></div>)}
    <div className="grid grid-cols-2 gap-2"><select aria-label={`${condition.label} timeframe`} value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className={inputClass}><option value="">Timeframe</option>{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select><select aria-label={`${condition.label} type`} value={pdaType} onChange={(event) => setPdaType(event.target.value)} className={inputClass}><option value="">PDA type</option>{PDA_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
    {selectedIsCustom && <div className="flex gap-2"><input aria-label="Custom PDA name" placeholder="Name the PDA" value={customPda} onChange={(event) => setCustomPda(event.target.value)} className={`${inputClass} min-w-0 flex-1`} /><button type="button" disabled={!timeframe || !customPda.trim()} onClick={captureCustom} className={`h-9 rounded-lg px-3 text-xs font-semibold disabled:opacity-35 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Record tap · {cursorClock}</button></div>}
    {timeframe && pdaType && !selectedIsCustom && <ValidatedPdaPicker availableBars={availableBars} chartResolution={chartResolution} timeframe={timeframe} pdaType={pdaType} inputClass={inputClass} isDark={isDark} mode={pdaType === 'Inversion FVG' ? 'inversion' : 'tap'} cursorClock={cursorClock} onCapture={captureValidated} />}
  </div>
}

function IfvgConditionField({
  condition,
  value,
  setValue,
  inputClass,
  isDark,
  cursorClock,
  availableBars,
  chartResolution,
}: {
  condition: PlaybookCondition
  value: string | boolean | undefined
  setValue: (value: string | boolean) => void
  inputClass: string
  isDark: boolean
  cursorClock: string
  availableBars: ReplayJournalSnapshot['availableBars']
  chartResolution: string
}) {
  const [storedTimeframe = '', inversionTime = '', source = '', zone = ''] = String(value || '').split(/\s*@\s*/, 4)
  const [timeframe, setTimeframe] = useState(storedTimeframe)
  const capture = (fvg: ValidPda) => setValue(`${timeframe} @ ${cursorClock} @ ${fvg.candles.map((bar) => bar.label || bar.dateTime).join(', ')} @ ${fvg.lower}–${fvg.upper}`)
  return <div className="space-y-2">
    {inversionTime && <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div><p className={`text-xs font-medium ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{storedTimeframe} IFVG · inversed {inversionTime}</p><p className="mt-0.5 text-[10px] text-[#71717A]">Source: {source}{zone ? ` · zone ${zone}` : ''}</p></div><button type="button" aria-label={`Clear ${condition.label}`} onClick={() => { setValue(''); setTimeframe('') }} className="h-8 w-8 rounded-lg text-[#71717A] hover:bg-red-500/10 hover:text-red-500"><Trash2 className="mx-auto h-3.5 w-3.5" /></button></div>}
    <select aria-label={`${condition.label} timeframe`} value={timeframe} onChange={(event) => { setTimeframe(event.target.value); setValue('') }} className={`${inputClass} w-full`}><option value="">Choose originating FVG timeframe</option>{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select>
    {timeframe && <ValidatedPdaPicker availableBars={availableBars} chartResolution={chartResolution} timeframe={timeframe} pdaType="FVG" inputClass={inputClass} isDark={isDark} mode="inversion" cursorClock={cursorClock} onCapture={capture} />}
  </div>
}

function ConditionField({
  condition,
  value,
  setValue,
  inputClass,
  isDark,
  cursorClock,
  cursorHigh,
  cursorLow,
  availableBars,
  chartResolution,
  defaultBias,
}: {
  condition: PlaybookCondition
  value: string | boolean | undefined
  setValue: (value: string | boolean) => void
  inputClass: string
  isDark: boolean
  cursorClock: string
  cursorHigh: string
  cursorLow: string
  availableBars: ReplayJournalSnapshot['availableBars']
  chartResolution: string
  defaultBias: 'long' | 'short'
}) {
  if (condition.type === 'boolean') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((choice) => <button key={String(choice)} type="button" onClick={() => setValue(choice)} className={`h-9 rounded-lg border text-xs font-medium ${value === choice ? 'border-blue-500 bg-blue-500/10 text-blue-500' : isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}>{choice ? 'Yes' : 'No'}</button>)}
      </div>
    )
  }

  if (condition.type === 'time') {
    return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setValue(cursorClock)} className={`h-9 rounded-lg px-3 text-xs font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Mark now · {cursorClock}</button>{value && <span className="text-xs text-blue-500">Captured {String(value)}</span>}</div>
  }

  if (condition.type === 'timeframe') {
    return <select aria-label={condition.label} value={String(value || '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} w-full`}>{<option value="">Select timeframe</option>}{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select>
  }

  if (condition.type === 'timeframe_time') {
    if (/\b(?:ifvg|inversion\s+fvg)\b/i.test(condition.label)) {
      return <IfvgConditionField condition={condition} value={value} setValue={setValue} inputClass={inputClass} isDark={isDark} cursorClock={cursorClock} availableBars={availableBars} chartResolution={chartResolution} />
    }
    const [timeframe = '', time = ''] = String(value || '').split(/\s*@\s*/, 2)
    return <div className="flex flex-wrap gap-2"><select aria-label={`${condition.label} timeframe`} value={timeframe} onChange={(event) => setValue(`${event.target.value} @ ${time}`)} className={`${inputClass} min-w-28 flex-1`}><option value="">Choose timeframe</option>{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select><button type="button" disabled={!timeframe} aria-label={`Capture ${condition.label} now`} onClick={() => setValue(`${timeframe} @ ${cursorClock}`)} className={`h-9 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{time ? `Captured ${time}` : `Confirm now · ${cursorClock}`}</button></div>
  }

  if (condition.type === 'liquidity_sweep') {
    return <LiquiditySweepField condition={condition} value={value} setValue={setValue} inputClass={inputClass} isDark={isDark} availableBars={availableBars} chartResolution={chartResolution} defaultBias={defaultBias} fallback={{ dateTime: '', label: cursorClock, time: cursorClock, open: '', high: cursorHigh, low: cursorLow, close: '' }} />
  }

  if (condition.type === 'pda_delivery') {
    return <PdaDeliveryField condition={condition} value={value} setValue={setValue} inputClass={inputClass} isDark={isDark} cursorClock={cursorClock} availableBars={availableBars} chartResolution={chartResolution} />
  }

  if (condition.type === 'number') return <input type="number" aria-label={condition.label} value={String(value || '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} w-full`} />
  return <textarea aria-label={condition.label} rows={2} placeholder="Record what happened" value={String(value || '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} h-auto min-h-16 w-full resize-y py-2`} />
}

function RiskEditor({ label, value, onChange, inputClass }: { label: string; value: JournalRiskLeg; onChange: (value: JournalRiskLeg) => void; inputClass: string }) {
  const modes: { value: JournalRiskMode; label: string }[] = [
    { value: 'none', label: 'Not set' },
    { value: 'dynamic', label: 'Dynamic structure / zone' },
    { value: 'fixed', label: 'Fixed price' },
    { value: 'strict_r', label: 'Strict R multiple' },
    { value: 'manual', label: 'Custom rule' },
  ]
  return <div className="grid gap-2 sm:grid-cols-4"><FieldShell label={`${label} type`}><select aria-label={`${label} type`} value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value as JournalRiskMode })} className={`${inputClass} mt-1 w-full`}>{modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></FieldShell>{value.mode !== 'none' && <><FieldShell label={value.mode === 'fixed' ? 'Price' : value.mode === 'strict_r' ? 'R multiple' : 'Rule / trigger'}><input aria-label={`${label} value`} inputMode={value.mode === 'fixed' || value.mode === 'strict_r' ? 'decimal' : 'text'} value={value.mode === 'fixed' ? value.price || '' : value.value || ''} onChange={(event) => onChange(value.mode === 'fixed' ? { ...value, price: event.target.value } : { ...value, value: event.target.value })} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Basis"><input aria-label={`${label} basis`} placeholder="FVG, swing, range…" value={value.basis || ''} onChange={(event) => onChange({ ...value, basis: event.target.value })} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Timeframe"><select aria-label={`${label} timeframe`} value={value.timeframe || ''} onChange={(event) => onChange({ ...value, timeframe: event.target.value })} className={`${inputClass} mt-1 w-full`}><option value="">Any</option>{TIMEFRAMES.map((tf) => <option key={tf}>{tf}</option>)}</select></FieldShell></>}</div>
}

export default function ReplayJournalCapture({ isDark, session, navigate, getSnapshot, openRequest = 0 }: Props) {
  const draftKey = `auren:replay-journal-draft:${session.id}`
  const [enabled, setEnabled] = useState(isReplayJournalEnabled)
  const [open, setOpen] = useState(false)
  const [strategies, setStrategies] = useState<JournalStrategyRecord[]>([])
  const [strategyId, setStrategyId] = useState('')
  const [snapshot, setSnapshot] = useState<ReplayJournalSnapshot | null>(null)
  const [executionSnapshot, setExecutionSnapshot] = useState<ReplayJournalSnapshot | null>(null)
  const [responses, setResponses] = useState<Record<string, string | boolean>>({})
  const [riskPlan, setRiskPlan] = useState<JournalRiskPlan>(blankRiskPlan)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<JournalEntryRecord | null>(null)

  useEffect(() => {
    const sync = (event: Event) => setEnabled((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled ?? isReplayJournalEnabled())
    window.addEventListener(REPLAY_JOURNAL_PREFERENCE_EVENT, sync)
    return () => window.removeEventListener(REPLAY_JOURNAL_PREFERENCE_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!open || saved) return
    const draft: ReplayJournalDraft = { strategyId, responses, riskPlan, notes }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // The editor still works when local storage is unavailable.
    }
  }, [draftKey, notes, open, responses, riskPlan, saved, strategyId])

  const selectedStrategy = strategies.find((strategy) => strategy.id === strategyId)
  const conditions = useMemo(() => conditionsFor(selectedStrategy), [selectedStrategy])
  const inputClass = `h-9 appearance-none rounded-lg border px-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`

  const applySnapshot = (next: ReplayJournalSnapshot) => {
    setSnapshot(next)
    setRiskPlan({
      stopLoss: next.stopLossPrice ? { ...blankRiskLeg(), mode: 'fixed', price: next.stopLossPrice } : blankRiskLeg(),
      breakEven: { ...blankRiskLeg(), enabled: false },
      takeProfit: next.takeProfitPrice ? { ...blankRiskLeg(), mode: 'fixed', price: next.takeProfitPrice } : blankRiskLeg(),
    })
  }

  const openCapture = async () => {
    const cursor = getSnapshot(false)
    const execution = getSnapshot(true)
    setExecutionSnapshot(execution.kind === 'cursor' ? null : execution)
    applySnapshot(execution.kind === 'cursor' ? cursor : execution)
    setOpen(true)
    setSaved(null)
    setError('')
    let stored: Partial<ReplayJournalDraft> | null = null
    try {
      stored = JSON.parse(localStorage.getItem(draftKey) || 'null')
    } catch {
      stored = null
    }
    setResponses(stored?.responses && typeof stored.responses === 'object' ? stored.responses : {})
    setNotes(typeof stored?.notes === 'string' ? stored.notes : '')
    if (stored?.riskPlan) setRiskPlan(stored.riskPlan)
    try {
      const next = await journalAPI.listStrategies()
      setStrategies(next)
      const storedStrategyId = typeof stored?.strategyId === 'string' ? stored.strategyId : ''
      setStrategyId(storedStrategyId && next.some((item) => item.id === storedStrategyId) ? storedStrategyId : next[0]?.id || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load playbooks')
    }
  }

  useEffect(() => {
    if (!openRequest || !enabled || open) return
    void openCapture()
  }, [openRequest])

  const save = async () => {
    if (!snapshot || !selectedStrategy) {
      setError('Choose a playbook before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const entry = await journalAPI.createEntry({
        id: '',
        strategyId: selectedStrategy.id,
        playbook: selectedStrategy.name,
        dateTime: snapshot.entryDateTime || snapshot.cursorDateTime,
        exitDateTime: snapshot.exitDateTime,
        symbol: snapshot.symbol,
        side: snapshot.side,
        entryPrice: snapshot.entryPrice,
        closePrice: snapshot.closePrice,
        size: snapshot.size,
        pnl: snapshot.pnl,
        outcome: snapshot.outcome,
        conditionResponses: responses,
        source: 'replay',
        sourceSessionId: session.id,
        sourceTradeId: snapshot.sourceTradeId,
        sourceContext: {
          sessionName: session.name,
          cursorTime: snapshot.cursorDateTime,
          chartResolution: snapshot.chartResolution,
          snapshotKind: snapshot.kind,
          stopLossPrice: snapshot.stopLossPrice,
          takeProfitPrice: snapshot.takeProfitPrice,
        },
        riskPlan,
        notes,
      })
      try {
        localStorage.removeItem(draftKey)
      } catch {
        // Saving succeeded; stale local draft cleanup is best effort.
      }
      setSaved(entry)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save journal entry')
    } finally {
      setSaving(false)
    }
  }

  const snapshotLabel = snapshot?.kind === 'closed_trade' ? 'Last closed replay trade' : snapshot?.kind === 'open_position' ? 'Open replay position' : 'Current replay cursor'
  const cursorClock = clockFromDateTime(snapshot?.cursorDateTime || '')

  const keepDraft = () => {
    const draft: ReplayJournalDraft = { strategyId, responses, riskPlan, notes }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // The current in-memory draft remains available until navigation.
    }
    setOpen(false)
  }

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // Resetting the in-memory form is still useful without storage access.
    }
    setResponses({})
    setRiskPlan(blankRiskPlan())
    setNotes('')
    setSaved(null)
    setOpen(false)
  }

  return <>
    {enabled && <button type="button" aria-label="Open replay journal" title="Open replay journal" onClick={() => void openCapture()} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:border-blue-500 hover:text-blue-400' : 'border-[#D4D4D8] text-[#52525B] hover:border-blue-600 hover:text-blue-600'}`}><BookOpenCheck className="h-4 w-4" /></button>}

    {open && <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div role="dialog" aria-modal="true" aria-label="Replay journal capture" className={`flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border sm:rounded-2xl ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-white'}`}>
        <header className={`flex items-start justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-500">Progressive replay capture</p><h2 className={`mt-1 text-base font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Add evidence as the replay develops</h2><p className="mt-1 text-xs text-[#71717A]">Save progress, advance the chart, and reopen this session draft. Fields always come from the selected playbook.</p></div><button type="button" aria-label="Close replay journal" onClick={keepDraft} className="h-8 w-8 rounded-lg text-[#71717A] hover:bg-[#27272A]"><X className="mx-auto h-4 w-4" /></button></header>

        {saved ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><Check className="h-6 w-6" /></span><h3 className={`mt-4 text-lg font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Journal entry saved</h3><p className="mt-2 max-w-md text-sm text-[#71717A]">Only this entry was added. Replay executions are never imported automatically.</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => navigate(`/journal/${saved.id}`)} className={`h-9 rounded-lg px-4 text-xs font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Review entry</button><button type="button" onClick={() => setOpen(false)} className={`h-9 rounded-lg border px-4 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}>Keep replaying</button></div></div> : <>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <section className={`rounded-xl border p-3 sm:p-4 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{snapshotLabel}</p><p className="mt-1 text-[11px] text-[#71717A]">{snapshot?.symbol} · {snapshot?.chartResolution || 'chart TF'} · {snapshot?.cursorDateTime} · H {snapshot?.barHigh || '—'} / L {snapshot?.barLow || '—'}</p></div>{executionSnapshot && <button type="button" onClick={() => applySnapshot(snapshot?.kind === 'cursor' ? executionSnapshot : getSnapshot(false))} className="h-8 rounded-lg border border-blue-500/30 px-2.5 text-[11px] font-medium text-blue-500">Use {snapshot?.kind === 'cursor' ? 'execution' : 'current cursor'}</button>}</div><details className="mt-3"><summary className="cursor-pointer text-[11px] font-medium text-[#71717A]">Edit automatic execution details</summary><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6"><FieldShell label="Side"><select aria-label="Replay journal side" value={snapshot?.side || 'long'} onChange={(event) => setSnapshot((current) => current ? { ...current, side: event.target.value as 'long' | 'short' } : current)} className={`${inputClass} mt-1 w-full`}><option value="long">Long</option><option value="short">Short</option></select></FieldShell><FieldShell label="Entry"><input aria-label="Replay journal entry price" inputMode="decimal" value={snapshot?.entryPrice || ''} onChange={(event) => setSnapshot((current) => current ? { ...current, entryPrice: event.target.value } : current)} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Close"><input aria-label="Replay journal close price" inputMode="decimal" value={snapshot?.closePrice || ''} onChange={(event) => setSnapshot((current) => current ? { ...current, closePrice: event.target.value } : current)} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Size"><input aria-label="Replay journal size" inputMode="decimal" value={snapshot?.size || ''} onChange={(event) => setSnapshot((current) => current ? { ...current, size: event.target.value } : current)} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Net P&L"><input aria-label="Replay journal pnl" inputMode="decimal" value={snapshot?.pnl || ''} onChange={(event) => setSnapshot((current) => current ? { ...current, pnl: event.target.value } : current)} className={`${inputClass} mt-1 w-full`} /></FieldShell><FieldShell label="Outcome"><select aria-label="Replay journal outcome" value={snapshot?.outcome || 'planned'} onChange={(event) => setSnapshot((current) => current ? { ...current, outcome: event.target.value as JournalEntryRecord['outcome'] } : current)} className={`${inputClass} mt-1 w-full`}><option value="planned">Planned / missed</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></FieldShell></div></details></section>

            <section className="mt-5"><div className="flex items-end justify-between gap-3"><div><h3 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>What happened?</h3><p className="mt-1 text-xs text-[#71717A]">Tap a choice as each confluence appears. Replay supplies the time and candle prices.</p></div>{strategies.length > 0 && <div className="relative min-w-48"><select aria-label="Replay journal playbook" value={strategyId} onChange={(event) => { setStrategyId(event.target.value); setResponses({}) }} className={`${inputClass} w-full appearance-none pr-8`}>{strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-[#71717A]" /></div>}</div>{strategies.length === 0 ? <div className={`mt-3 rounded-xl border p-4 text-xs ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}>No playbooks are available. <button type="button" onClick={() => navigate('/analytics')} className="font-semibold text-blue-500">Create a playbook</button> first so replay capture stays strategy-driven.</div> : <div className="mt-3 space-y-3">{conditions.length === 0 ? <p className="rounded-lg border border-[#3F3F46] p-3 text-xs text-[#71717A]">This playbook has no conditions yet. You can still finish a replay journal using its automatic execution.</p> : conditions.map((condition) => <fieldset key={condition.id} className={`rounded-xl border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><legend className={`px-1 text-xs font-semibold ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}>{condition.label}</legend><ConditionField condition={condition} value={responses[condition.label]} setValue={(value) => setResponses((current) => ({ ...current, [condition.label]: value }))} inputClass={inputClass} isDark={isDark} cursorClock={cursorClock} cursorHigh={snapshot?.barHigh || ''} cursorLow={snapshot?.barLow || ''} availableBars={snapshot?.availableBars || []} chartResolution={snapshot?.chartResolution || '1'} defaultBias={snapshot?.side || 'long'} /></fieldset>)}</div>}</section>

            <details className={`mt-5 rounded-xl border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><summary className={`cursor-pointer text-xs font-semibold ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" />Optional risk, targets, and notes</span></summary><div className="mt-4 space-y-3"><div className={`rounded-xl border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><RiskEditor label="Stop loss" value={riskPlan.stopLoss} onChange={(stopLoss) => setRiskPlan((current) => ({ ...current, stopLoss }))} inputClass={inputClass} /></div><div className={`rounded-xl border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><label className={`mb-3 flex items-center justify-between text-xs font-semibold ${isDark ? 'text-[#D4D4D8]' : 'text-[#27272A]'}`}><span>Move to breakeven</span><input type="checkbox" role="switch" aria-label="Breakeven enabled" checked={riskPlan.breakEven.enabled} onChange={(event) => setRiskPlan((current) => ({ ...current, breakEven: { ...current.breakEven, enabled: event.target.checked, mode: event.target.checked && current.breakEven.mode === 'none' ? 'dynamic' : current.breakEven.mode } }))} className="h-4 w-4 accent-blue-600" /></label>{riskPlan.breakEven.enabled && <RiskEditor label="Breakeven" value={riskPlan.breakEven} onChange={(breakEven) => setRiskPlan((current) => ({ ...current, breakEven: { ...current.breakEven, ...breakEven } }))} inputClass={inputClass} />}</div><div className={`rounded-xl border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><RiskEditor label="Take profit" value={riskPlan.takeProfit} onChange={(takeProfit) => setRiskPlan((current) => ({ ...current, takeProfit }))} inputClass={inputClass} /></div><FieldShell label="Review notes"><textarea aria-label="Replay journal notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context about the setup or management…" className={`${inputClass} mt-1 h-auto min-h-20 w-full resize-y py-2`} /></FieldShell></div></details>
            {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500" role="alert">{error}</p>}
          </div>
          <footer className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><button type="button" onClick={discardDraft} className="h-9 rounded-lg px-2 text-xs font-medium text-[#71717A] hover:text-red-500">Discard draft</button><p className="hidden text-[11px] text-[#71717A] lg:block">This session draft survives refreshes. Finish only when the setup review is complete.</p><div className="ml-auto flex gap-2"><button type="button" onClick={keepDraft} className={`h-9 rounded-lg border px-3 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}>Save progress</button><button type="button" disabled={saving || !selectedStrategy} onClick={() => void save()} className={`h-9 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{saving ? 'Saving…' : 'Finish journal'}</button></div></footer>
        </>}
      </div>
    </div>}
  </>
}
