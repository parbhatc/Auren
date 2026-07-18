import { CalculatedStats, TradeData } from '../stats/StatsCalculator'

export interface TradeseaCalendarDay {
  pnl: number
  tradesCount: number
  tradeWinPer: number
  date: string
}

export interface TradeseaTradelensDashboard {
  totalPnl?: { value?: number }
  tradeWinPer?: { value?: number }
  profitFactor?: { value?: string | number }
  avgWinAndLoss?: {
    avgWin?: number
    avgLoss?: number
    avgWinLossRatio?: string | number
  }
  totalNumberOfTrades?: number
  avgWinningTrade?: number
  avgLosingTrade?: number
  bestTrade?: number
  worstTrade?: number
  dailyNetCumulativePnl?: Array<{ value: number; date: string }>
  dailyAccountBalance?: Array<{ value: number; date: string }>
  tradeDurationAnalysis?: Array<{ timeDuration: string; tradePer: number; avgNetPnl?: number }>
  winRateAnalysis?: Array<{ timeDuration: string; winRate: number }>
  pnlAndTradeCountCalendar?: TradeseaCalendarDay[]
}

export interface TradeseaTradelensDayBucket {
  date?: string
  trades?: TradeseaTradelensTrade[]
  netPnl?: number
  totalTrades?: number
}

export interface TradeseaTradelensTrade {
  /** Session day from TradeLens day bucket (yyyy-MM-dd). */
  tradeseaDay?: string
  id?: string
  side?: string
  instrument?: string
  quantity?: number
  entryPrice?: number
  exitPrice?: number
  enteredAt?: number
  exitedAt?: number
  tradeDuration?: number
  pnl?: number
  netPnl?: number
  commission?: number
  totalCharges?: number
  singlePointValue?: number
}

/** TradeLens timestamps are microseconds since epoch. */
export function tradeseaMicrosToIso(micros: number | null | undefined): string | null {
  if (micros == null || !Number.isFinite(Number(micros))) return null
  const parsed = new Date(Number(micros) / 1000)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmdDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim())
  if (!match) return null
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(match[1]) ||
    parsed.getMonth() !== Number(match[2]) - 1 ||
    parsed.getDate() !== Number(match[3])
  ) {
    return null
  }
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

/** TradeLens v2/trades allows at most 7 calendar days per request (e.g. 2026-05-12 → 2026-05-18). */
export const TRADELENS_MAX_TRADES_DAYS = 7

/**
 * TradeLens v2/trades: `to` cannot be in the future; `from` must be in the current month.
 * Splits the allowed span into consecutive 7-day chunks (inclusive).
 */
export function resolveTradelensTradesRanges(
  from: string,
  to: string
): Array<{ from: string; to: string }> {
  const fromD = parseYmdDate(from)
  const toD = parseYmdDate(to)
  if (!fromD || !toD) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let end = toD
  if (end > today) end = today

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)

  let start = fromD
  if (start < monthStart) start = monthStart

  if (start > end) return []

  const ranges: Array<{ from: string; to: string }> = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setDate(chunkEnd.getDate() + TRADELENS_MAX_TRADES_DAYS - 1)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())
    ranges.push({ from: formatLocalDate(cursor), to: formatLocalDate(chunkEnd) })
    cursor = new Date(chunkEnd)
    cursor.setDate(cursor.getDate() + 1)
  }
  return ranges
}

/** @deprecated Use resolveTradelensTradesRanges — kept for single-range callers. */
export function clampTradelensTradesRange(
  from: string,
  to: string
): { from: string; to: string } | null {
  const ranges = resolveTradelensTradesRanges(from, to)
  return ranges.length > 0 ? ranges[ranges.length - 1]! : null
}

export function monthDateRangeLocal(
  year: number,
  monthIndex: number
): { startDate: string; endDate: string } {
  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 0)
  return { startDate: formatLocalDate(monthStart), endDate: formatLocalDate(monthEnd) }
}

export function parseTradeseaTradeTimestamp(
  timestamp: number | string | null | undefined
): Date | null {
  if (timestamp == null) return null
  if (typeof timestamp === 'number') {
    if (timestamp > 1e15) return new Date(timestamp / 1000)
    if (timestamp > 1e12) return new Date(timestamp)
    return new Date(timestamp * 1000)
  }
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function tradeseaTradeDurationSeconds(trade: TradeseaTradelensTrade): number | null {
  if (trade.tradeDuration != null && Number.isFinite(trade.tradeDuration)) {
    return Number(trade.tradeDuration) / 1_000_000
  }
  const entry = parseTradeseaTradeTimestamp(trade.enteredAt)
  const exit = parseTradeseaTradeTimestamp(trade.exitedAt)
  if (!entry || !exit) return null
  return Math.max(0, (exit.getTime() - entry.getTime()) / 1000)
}

export function flattenTradelensTradesList(
  tradesList: TradeseaTradelensDayBucket[] | null | undefined
): TradeseaTradelensTrade[] {
  const out: TradeseaTradelensTrade[] = []
  for (const day of tradesList || []) {
    if (!Array.isArray(day?.trades)) continue
    const tradeseaDay = String(day.date || '').split('T')[0] || undefined
    for (const trade of day.trades) {
      if (!trade) continue
      const side = trade.side ? String(trade.side).toLowerCase() : trade.side
      // Do not mutate API/cache objects while preparing UI rows.
      out.push(
        tradeseaDay || side !== trade.side
          ? { ...trade, side, ...(tradeseaDay ? { tradeseaDay } : {}) }
          : trade
      )
    }
  }
  return out
}

export function convertTradeseaTradelensTrade(trade: TradeseaTradelensTrade): TradeData {
  const side = String(trade.side || '').toLowerCase()
  const pointValue = Number(trade.singlePointValue) || 1
  return {
    entry_price: trade.entryPrice ?? 0,
    exit_price: trade.exitPrice ?? null,
    contracts: Math.abs(trade.quantity ?? 1),
    direction: side === 'short' ? 'short' : 'long',
    entry_time: tradeseaMicrosToIso(trade.enteredAt),
    exit_time: tradeseaMicrosToIso(trade.exitedAt),
    symbol: trade.instrument || '',
    tradeseaDay: trade.tradeseaDay,
    originalTrade: trade,
    pnl: trade.netPnl ?? trade.pnl ?? 0,
    // pnl is already net of commission; avoid double-subtracting in calendar/day dialogs.
    fees: 0,
    tickValue: pointValue,
  }
}

export interface DayStatsPayload {
  date: string
  day: number
  profit: number
  totalTrades: number
  totalContracts: number
  longTrades: number
  shortTrades: number
  longContracts: number
  shortContracts: number
  wins: number
  losses: number
  totalFees: number
  trades: TradeData[]
}

export function buildDayStatsPayload(
  dateStr: string,
  day: number,
  dayTrades: TradeData[],
  calculateTradePnL: (trade: TradeData) => number
): DayStatsPayload {
  let dayProfit = 0
  let totalContracts = 0
  let longTradeCount = 0
  let shortTradeCount = 0
  let longContracts = 0
  let shortContracts = 0
  let wins = 0
  let totalFeesDay = 0

  // One pass replaces repeated filters/reductions and calculates each trade P&L once.
  for (const trade of dayTrades) {
    const grossPnl = calculateTradePnL(trade)
    const pnlFees = Number(trade.fees ?? trade.originalTrade?.fees ?? 0) || 0
    dayProfit += grossPnl - pnlFees
    if (grossPnl - pnlFees > 0) wins += 1

    const contracts = Math.abs(Number(trade.contracts) || 0)
    totalContracts += contracts
    const direction = trade.direction?.toLowerCase()
    if (direction === 'long') {
      longTradeCount += 1
      longContracts += contracts
    } else if (direction === 'short') {
      shortTradeCount += 1
      shortContracts += contracts
    }

    const charges =
      trade.originalTrade?.totalCharges ??
      trade.originalTrade?.commission ??
      trade.fees ??
      0
    totalFeesDay += Number(charges) || 0
  }

  return {
    date: dateStr,
    day,
    profit: dayProfit,
    totalTrades: dayTrades.length,
    totalContracts,
    longTrades: longTradeCount,
    shortTrades: shortTradeCount,
    longContracts,
    shortContracts,
    wins,
    losses: dayTrades.length - wins,
    totalFees: totalFeesDay,
    trades: dayTrades,
  }
}

export function equityCurveFromDashboard(
  series: Array<{ value: number; date: string }> | null | undefined
): Array<{ date: string; value: number }> {
  if (!Array.isArray(series) || series.length === 0) return []
  return series.map((point) => ({
    date: String(point.date || '').split('T')[0],
    value: Number(point.value) || 0,
  }))
}

export function formatTradeseaDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'
  const totalSeconds = Math.round(seconds)
  if (totalSeconds < 60) return `${totalSeconds}s`
  if (totalSeconds < 3600) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (secs > 0) return `${hours}h ${minutes}m ${secs}s`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/** Map TradeLens dashboard payload → overview stats cards. */
export function statsFromTradelensDashboard(
  dashboard: TradeseaTradelensDashboard | null | undefined
): CalculatedStats {
  const totalTrades = Number(dashboard?.totalNumberOfTrades) || 0
  const winPer = Number(dashboard?.tradeWinPer?.value) || 0
  const totalPnl = Number(dashboard?.totalPnl?.value) || 0
  const avgWin = Number(
    dashboard?.avgWinAndLoss?.avgWin ?? dashboard?.avgWinningTrade ?? 0
  )
  const avgLoss = Number(
    dashboard?.avgWinAndLoss?.avgLoss ?? dashboard?.avgLosingTrade ?? 0
  )
  const wins = totalTrades > 0 ? Math.round((totalTrades * winPer) / 100) : 0
  const losses = Math.max(0, totalTrades - wins)
  const pf = dashboard?.profitFactor?.value
  const ratio = dashboard?.avgWinAndLoss?.avgWinLossRatio

  return {
    totalTrades,
    winRate: winPer.toFixed(1),
    totalProfit: totalPnl.toFixed(2),
    avgWin: avgWin.toFixed(2),
    avgLoss: avgLoss.toFixed(2),
    largestWin: Number(dashboard?.bestTrade ?? 0).toFixed(2),
    largestLoss: Number(dashboard?.worstTrade ?? 0).toFixed(2),
    profitFactor: pf != null && pf !== '' ? String(pf) : '0.00',
    avgWinLossFactor:
      ratio != null && ratio !== '' ? String(ratio) : pf != null ? String(pf) : '0.00',
    sharpeRatio: '0.00',
    wins,
    losses,
  }
}

export function durationAnalysisFromDashboard(
  dashboard: TradeseaTradelensDashboard | null | undefined
): Array<{ label: string; count: number }> {
  const rows = dashboard?.tradeDurationAnalysis
  const totalTrades = Number(dashboard?.totalNumberOfTrades) || 0
  if (!Array.isArray(rows) || totalTrades === 0) return []
  return rows.map((row) => ({
    label: String(row.timeDuration || ''),
    count: Math.max(0, Math.round((Number(row.tradePer || 0) / 100) * totalTrades)),
  }))
}

export function winRateAnalysisFromDashboard(
  dashboard: TradeseaTradelensDashboard | null | undefined
): Array<{ label: string; rate: number }> {
  const rows = dashboard?.winRateAnalysis
  if (!Array.isArray(rows)) return []
  return rows.map((row) => ({
    label: String(row.timeDuration || ''),
    rate: Number(row.winRate) || 0,
  }))
}

/** Placeholder rows from calendarDaysToSyntheticTrades — not real executions. */
export function isSyntheticTradeseaTrade(trade: {
  symbol?: string
  entry_price?: number
  exit_price?: number | null
}): boolean {
  return String(trade.symbol || '').toUpperCase() === 'TRADESEA'
}

/** One synthetic trade per reported fill so calendar cells show correct trade counts. */
export function calendarDaysToSyntheticTrades(
  days: TradeseaCalendarDay[] | null | undefined
): TradeData[] {
  const out: TradeData[] = []
  for (const day of days || []) {
    const dateStr = String(day.date || '').split('T')[0]
    const count = Math.max(0, Math.floor(Number(day.tradesCount) || 0))
    if (!dateStr || count === 0) continue
    const totalPnl = Number(day.pnl) || 0
    const perTradePnl = count > 0 ? totalPnl / count : 0
    const iso = `${dateStr}T12:00:00.000Z`
    for (let i = 0; i < count; i++) {
      out.push({
        entry_price: 1,
        exit_price: 1,
        contracts: 1,
        direction: perTradePnl >= 0 ? 'long' : 'short',
        entry_time: iso,
        exit_time: iso,
        symbol: 'TRADESEA',
        pnl: perTradePnl,
        fees: 0,
      })
    }
  }
  return out
}

export function buildTradeseaSymbolData(trades: TradeData[]): Record<
  string,
  { tickSize: number; tickValue: number; totalFees?: number }
> {
  const symbolData: Record<string, { tickSize: number; tickValue: number; totalFees?: number }> =
    {}
  // Populate on first sight in O(n); Set + find was O(n × unique symbols).
  for (const trade of trades) {
    const symbol = String(trade.symbol || '')
    if (!symbol || symbolData[symbol]) continue
    const pointValue = Number((trade as any)?.tickValue) || 1
    const tickSize = symbol.startsWith('M') ? 0.25 : 0.25
    symbolData[symbol] = {
      tickSize,
      tickValue: pointValue,
      totalFees: 0,
    }
  }
  return symbolData
}
