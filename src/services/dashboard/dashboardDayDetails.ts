import { practiceAPI, type PracticeTradeRecord } from '../../api/practice.api'
import { tradeseaAPI } from '../../api/tradesea.api'
import type { PracticeAccount } from '../../constants/practice'
import {
  etLocalToUtcMs,
  getNextResetBoundaryMs,
  getPracticeSessionDayKey,
  SESSION_RESET_HOUR,
  SESSION_RESET_MINUTE,
} from '../practice/practiceSessionReset'
import {
  flattenTradelensTradesList,
  formatLocalDate,
  parseTradeseaTradeTimestamp,
  resolveTradelensTradesRanges,
  type TradeseaCalendarDay,
  type TradeseaTradelensDayBucket,
} from '../tradesea/tradeseaTradelensStats'
import type { DashboardAccountSelection } from './dashboardAccountSelection'
import { loadDashboardReplayData, loadDashboardReplaySessions } from './dashboardReplayData'

export interface DashboardDayTrade {
  /** Provider id when reported; otherwise a stable UI row key. */
  id: string
  symbol: string
  direction: 'long' | 'short' | null
  contracts: number | null
  entryPrice: number | null
  exitPrice: number | null
  entryTime: string | null
  exitTime: string | null
  netPnl: number | null
  fees: number | null
}

export interface DashboardDayDetails {
  selection: DashboardAccountSelection
  date: string
  netPnl: number | null
  totalTrades: number | null
  winRate: number | null
  totalFees: number | null
  trades: DashboardDayTrade[]
  detailsStatus: 'available' | 'partial' | 'unavailable'
  message: string | null
}

export interface DashboardDayDetailsOptions {
  signal?: AbortSignal
  /** Dashboard practice cells use the existing 5:59 PM ET session key. */
  dateBasis?: 'calendar' | 'practice-session'
}

function numberOrNull(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    String(value).trim() === ''
  )
    return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function timestamp(value: unknown): Date | null {
  const number = numberOrNull(value)
  if (number == null || number <= 0) return null
  const parsed = parseTradeseaTradeTimestamp(number)
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Daily statistics request aborted.', 'AbortError')
}

function validate(selection: DashboardAccountSelection, date: string): void {
  if (
    !selection.accountId.trim() ||
    !['practice', 'tradesea', 'replay'].includes(selection.source)
  ) {
    throw new TypeError('An explicit account is required for daily statistics.')
  }
  const parsed = new Date(`${date}T12:00:00`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    formatLocalDate(parsed) !== date
  ) {
    throw new RangeError(
      'A valid calendar date is required for daily statistics.'
    )
  }
}

function summarize(trades: DashboardDayTrade[]) {
  const netKnown = trades.every((trade) => trade.netPnl != null)
  return {
    netPnl: netKnown
      ? trades.reduce((sum, trade) => sum + trade.netPnl!, 0)
      : null,
    totalTrades: trades.length,
    winRate: netKnown
      ? trades.length
        ? (trades.filter((trade) => trade.netPnl! > 0).length / trades.length) *
          100
        : 0
      : null,
    totalFees: trades.every((trade) => trade.fees != null)
      ? trades.reduce((sum, trade) => sum + trade.fees!, 0)
      : null,
  }
}

function direction(value: unknown): DashboardDayTrade['direction'] {
  const side = String(value ?? '').toLowerCase()
  return side === 'long' || side === 'short' ? side : null
}

function practiceSessionInterval(date: string): { start: number; end: number } | null {
  const [year, month, day] = date.split('-').map(Number)
  const start = etLocalToUtcMs(year, month, day, SESSION_RESET_HOUR, SESSION_RESET_MINUTE)
  // Weekend dates have no reset boundary of their own; Friday's session
  // continues until Monday's reset, including any DST change in between.
  if (getPracticeSessionDayKey(start) !== date) return null
  return { start, end: getNextResetBoundaryMs(start) }
}

async function loadPracticeDay(
  selection: DashboardAccountSelection,
  date: string,
  options: DashboardDayDetailsOptions
): Promise<DashboardDayDetails> {
  const stats = (await practiceAPI.getStats(selection.accountId)) as {
    account?: PracticeAccount
    trades?: (PracticeTradeRecord & { id?: string })[]
  }
  abortIfNeeded(options.signal)
  const calendarPnl =
    options.dateBasis === 'practice-session'
      ? numberOrNull(
          stats.account?.dayPnL?.find((day) => day.date === date)?.pnl
        )
      : null
  if (!Array.isArray(stats.trades))
    return {
      selection,
      date,
      netPnl: calendarPnl,
      totalTrades: null,
      winRate: null,
      totalFees: null,
      trades: [],
      detailsStatus: 'unavailable',
      message: 'Closed trade details were not returned for this account.',
    }
  const sessionInterval = options.dateBasis === 'practice-session' ? practiceSessionInterval(date) : undefined
  const trades: DashboardDayTrade[] = []
  for (const [index, trade] of stats.trades.entries()) {
    const exit = timestamp(trade.exitTime)
    // Never assign an open/missing-exit record to the entry day.
    if (!exit || numberOrNull(trade.exitPrice) == null) continue
    if (options.dateBasis === 'practice-session') {
      const exitMs = exit.getTime()
      if (!sessionInterval || exitMs < sessionInterval.start || exitMs >= sessionInterval.end) continue
    } else if (formatLocalDate(exit) !== date) continue
    const fees = numberOrNull(trade.fees)
    const grossPnl = numberOrNull(trade.pnl)
    const contracts = numberOrNull(trade.contracts)
    trades.push({
      id: trade.id || `practice:${selection.accountId}:${date}:${index}`,
      symbol: trade.symbol || '',
      direction: direction(trade.direction),
      contracts: contracts == null ? null : Math.abs(contracts),
      entryPrice: numberOrNull(trade.entryPrice),
      exitPrice: numberOrNull(trade.exitPrice),
      entryTime: timestamp(trade.entryTime)?.toISOString() ?? null,
      exitTime: exit.toISOString(),
      netPnl: grossPnl != null && fees != null ? grossPnl - fees : null,
      fees,
    })
  }
  trades.sort((a, b) => String(a.exitTime).localeCompare(String(b.exitTime)))
  const summary = summarize(trades)
  const mismatch =
    calendarPnl != null &&
    summary.netPnl != null &&
    Math.abs(calendarPnl - summary.netPnl) > 0.005
  const incomplete =
    summary.netPnl == null || summary.totalFees == null || mismatch
  return {
    selection,
    date,
    ...summary,
    netPnl: calendarPnl ?? summary.netPnl,
    trades,
    detailsStatus: incomplete ? 'partial' : 'available',
    message: mismatch
      ? 'The recorded session total differs from the returned closed trades.'
      : incomplete
        ? 'Some trade amounts or fees were not reported; unavailable amounts are left blank.'
        : null,
  }
}

async function loadTradeseaDay(
  selection: DashboardAccountSelection,
  date: string,
  options: DashboardDayDetailsOptions
): Promise<DashboardDayDetails> {
  const body = {
    accountId: selection.accountId,
    from: date,
    to: date,
    timezoneOffset: new Date().getTimezoneOffset(),
  }
  const range = resolveTradelensTradesRanges(date, date).find(
    (item) => item.from === date && item.to === date
  )
  const [calendarResult, tradesResult] = await Promise.allSettled([
    tradeseaAPI.getTradelensCalendar(body),
    range ? tradeseaAPI.getTradelensTrades(body) : Promise.resolve(null),
  ])
  abortIfNeeded(options.signal)
  const calendarResponse =
    calendarResult.status === 'fulfilled' ? calendarResult.value : null
  const calendar =
    calendarResponse?.s === 'success' && calendarResponse.success !== false
      ? calendarResponse.d?.pnlAndTradeCountCalendar
      : undefined
  const day: TradeseaCalendarDay | undefined = Array.isArray(calendar)
    ? calendar.find((item) => String(item.date).split('T')[0] === date)
    : undefined
  const tradesResponse =
    tradesResult.status === 'fulfilled' ? tradesResult.value : null
  const buckets =
    tradesResponse?.s === 'success' && tradesResponse.success !== false
      ? tradesResponse.d?.tradesList
      : undefined
  const detailsAvailable = Array.isArray(buckets)
  const trades: DashboardDayTrade[] = []
  for (const [index, trade] of flattenTradelensTradesList(
    detailsAvailable ? (buckets as TradeseaTradelensDayBucket[]) : undefined
  ).entries()) {
    const exit = timestamp(trade.exitedAt)
    if (!exit || numberOrNull(trade.exitPrice) == null) continue
    // Preserve TradeLens' authoritative day bucket, including its timezone/session
    // boundaries. Use local exit date only when that bucket was not supplied.
    if ((trade.tradeseaDay || formatLocalDate(exit)) !== date) continue
    const contracts = numberOrNull(trade.quantity)
    trades.push({
      id: trade.id || `tradesea:${selection.accountId}:${date}:${index}`,
      symbol: trade.instrument || '',
      direction: direction(trade.side),
      contracts: contracts == null ? null : Math.abs(contracts),
      entryPrice: numberOrNull(trade.entryPrice),
      exitPrice: numberOrNull(trade.exitPrice),
      entryTime: timestamp(trade.enteredAt)?.toISOString() ?? null,
      exitTime: exit.toISOString(),
      // Existing TradeLens conversion treats pnl as net when netPnl is absent.
      // Charges remain informational and must never be subtracted a second time.
      netPnl: numberOrNull(trade.netPnl) ?? numberOrNull(trade.pnl),
      fees: numberOrNull(trade.totalCharges) ?? numberOrNull(trade.commission),
    })
  }
  trades.sort((a, b) => String(a.exitTime).localeCompare(String(b.exitTime)))
  const summary = summarize(trades)
  const totalTrades =
    numberOrNull(day?.tradesCount) ??
    (detailsAvailable ? summary.totalTrades : null)
  const netPnl =
    numberOrNull(day?.pnl) ?? (detailsAvailable ? summary.netPnl : null)
  const winRate =
    numberOrNull(day?.tradeWinPer) ??
    (detailsAvailable ? summary.winRate : null)
  const mismatch =
    (totalTrades != null && totalTrades !== trades.length) ||
    (netPnl != null &&
      summary.netPnl != null &&
      Math.abs(netPnl - summary.netPnl) > 0.005)
  const complete =
    detailsAvailable &&
    !mismatch &&
    summary.netPnl != null &&
    summary.totalFees != null
  const message = !range
    ? 'TradeLens provides detailed trades only for the current month through today. Reported calendar totals are shown when available.'
    : !detailsAvailable
      ? 'Detailed closed trades could not be loaded. Reported calendar totals are shown when available.'
      : mismatch
        ? 'The reported calendar totals differ from the returned closed trades; the calendar totals are preserved.'
        : !complete
          ? 'Some trade amounts or fees were not reported; unavailable amounts are left blank.'
          : null
  return {
    selection,
    date,
    netPnl,
    totalTrades,
    winRate,
    totalFees: detailsAvailable && !mismatch ? summary.totalFees : null,
    trades,
    detailsStatus: !detailsAvailable
      ? 'unavailable'
      : complete
        ? 'available'
        : 'partial',
    message,
  }
}

async function loadReplayDay(
  selection: DashboardAccountSelection,
  date: string,
  options: DashboardDayDetailsOptions,
): Promise<DashboardDayDetails> {
  const sessions = await loadDashboardReplaySessions({ signal: options.signal })
  const session = sessions.find((item) => item.id === selection.accountId)
  if (!session) throw new Error('The replay session is no longer available.')
  const replay = await loadDashboardReplayData(session, options)
  abortIfNeeded(options.signal)
  const trades = replay.dayTrades.filter((trade) => trade.date === date).map(({ date: _date, ...trade }) => trade)
  const available = replay.detailsStatus !== 'unavailable' && !replay.omittedClosedTrades
  const summary = summarize(trades)
  return {
    selection, date,
    netPnl: available ? summary.netPnl : null,
    totalTrades: available ? summary.totalTrades : null,
    winRate: available ? summary.winRate : null,
    totalFees: available ? summary.totalFees : null,
    trades,
    detailsStatus: replay.detailsStatus === 'available' && summary.netPnl != null && summary.totalFees != null ? 'available' : replay.detailsStatus,
    message: replay.message,
  }
}

/** Read-only, explicit-account day loader. Existing API clients cannot cancel
 * HTTP requests, so signal checks suppress completion after cancellation. */
export async function loadDashboardDayDetails(
  selection: DashboardAccountSelection,
  date: string,
  options: DashboardDayDetailsOptions = {}
): Promise<DashboardDayDetails> {
  validate(selection, date)
  abortIfNeeded(options.signal)
  if (selection.source === 'replay') return loadReplayDay(selection, date, options)
  return selection.source === 'practice'
    ? loadPracticeDay(selection, date, options)
    : loadTradeseaDay(selection, date, options)
}
