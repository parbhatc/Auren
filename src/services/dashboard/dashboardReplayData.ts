import { getAuthToken } from '../../api/api'
import { backtesterAPI } from '../../api/backtester.api'
import type { PracticeTradeRecord } from '../../api/practice.api'
import type { PracticeDayPnL } from '../../constants/practice'
import type { BacktestSession } from '../../types/backtester'
import { createUserMetadataCache } from '../cache/userMetadataCache'
import { formatLocalDate, parseTradeseaTradeTimestamp } from '../tradesea/tradeseaTradelensStats'
import type { DashboardDayTrade } from './dashboardDayDetails'

export const DASHBOARD_REPLAY_CHANGED_EVENT = 'replaySessionsChanged'
const catalogs = createUserMetadataCache({ getOwner: getAuthToken, ttlMs: 30_000, maxEntries: 1 })

export interface DashboardReplayData {
  session: BacktestSession
  balance: number | null
  initialBalance: number | null
  stats: {
    trades: (PracticeTradeRecord & { id: string })[]
    totalTrades?: number
    winRate?: number
    totalPnl?: number
  }
  days: PracticeDayPnL[]
  dayTrades: (DashboardDayTrade & { date: string })[]
  omittedClosedTrades: boolean
  detailsStatus: 'available' | 'partial' | 'unavailable'
  message: string | null
}

function numeric(value: unknown): number | null {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function parsedTime(value: unknown): Date | null {
  if (value == null || value === '') return null
  const number = numeric(value)
  const result = number != null ? parseTradeseaTradeTimestamp(number) : new Date(String(value))
  return result && Number.isFinite(result.getTime()) ? result : null
}

function assertCurrent(owner: string | null, signal?: AbortSignal) {
  if (signal?.aborted || owner !== getAuthToken())
    throw new DOMException('Replay statistics request superseded.', 'AbortError')
}

/** Navigation metadata only; neither positions nor trading authorization. */
export function loadDashboardReplaySessions(options: { force?: boolean; signal?: AbortSignal } = {}): Promise<BacktestSession[]> {
  if (!getAuthToken()) return Promise.resolve([])
  return catalogs.read('sessions', async () => {
    const response = await backtesterAPI.getSessions()
    if (!response.success || !Array.isArray(response.sessions)) throw new Error('Replay sessions could not be loaded.')
    return response.sessions
  }, options)
}

export function invalidateDashboardReplaySessions(): void {
  catalogs.invalidate()
}

/** Explicit-session, read-only replay adapter. The stats endpoint's realizedPnL
 * is scoped to the mutable replay date, so lifetime P&L uses reported balances.
 * Realized calendar buckets use the local EXIT day, matching daily details. */
export async function loadDashboardReplayData(
  session: BacktestSession,
  options: { signal?: AbortSignal } = {},
): Promise<DashboardReplayData> {
  const owner = getAuthToken()
  assertCurrent(owner, options.signal)
  if (!owner || !session.id.trim()) throw new TypeError('A signed-in replay session is required.')
  const [tradesResult, symbolsResult, balanceResult] = await Promise.allSettled([
    backtesterAPI.getTrades({ sessionId: session.id }),
    backtesterAPI.getSymbolData(),
    backtesterAPI.getSessionStats(session.id),
  ])
  assertCurrent(owner, options.signal)
  const tradesResponse = tradesResult.status === 'fulfilled' ? tradesResult.value : null
  const symbolsResponse = symbolsResult.status === 'fulfilled' ? symbolsResult.value : null
  const balances = balanceResult.status === 'fulfilled' && balanceResult.value.success ? balanceResult.value : null
  const balance = numeric(balances?.balance)
  const initialBalance = numeric(balances?.initialBalance)
  const symbols = symbolsResponse?.success ? symbolsResponse.symbols as Record<string, {
    tickSize?: number; tickValue?: number; totalFees?: number
  }> : {}
  const available = tradesResponse?.success && Array.isArray(tradesResponse.trades)
  const dayTrades: DashboardReplayData['dayTrades'] = []
  const normalized: DashboardReplayData['stats']['trades'] = []
  let omittedClosed = false
  let closedCount = 0
  for (const row of available ? tradesResponse.trades : []) {
    // getTrades is session-filtered server-side; also reject accidental mixed rows.
    if (row.session_id !== session.id || row.exit_price == null) continue
    closedCount += 1
    const entry = parsedTime(row.entry_time)
    const exit = parsedTime(row.exit_time)
    const entryPrice = numeric(row.entry_price)
    const exitPrice = numeric(row.exit_price)
    const contracts = numeric(row.contracts)
    const direction = String(row.direction).toLowerCase()
    if (!entry || !exit || entryPrice == null || exitPrice == null || contracts == null || contracts === 0 || !['long', 'short'].includes(direction)) {
      omittedClosed = true
      continue
    }
    const config = symbols?.[row.symbol]
    const tickSize = numeric(config?.tickSize)
    const tickValue = numeric(config?.tickValue)
    const feePerContract = numeric(config?.totalFees)
    const quantity = Math.abs(contracts)
    const gross = tickSize != null && tickSize > 0 && tickValue != null
      ? (direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice) / tickSize * tickValue * quantity
      : null
    const fees = feePerContract != null && feePerContract >= 0 ? feePerContract * quantity : null
    const netPnl = gross != null && fees != null && Number.isFinite(gross - fees) ? gross - fees : null
    dayTrades.push({
      id: row.id, symbol: row.symbol, direction: direction as 'long' | 'short', contracts: quantity,
      entryPrice, exitPrice, entryTime: entry.toISOString(), exitTime: exit.toISOString(),
      netPnl, fees, date: formatLocalDate(exit),
    })
    if (netPnl != null) normalized.push({
      id: row.id, symbol: row.symbol, direction: direction as 'long' | 'short', contracts: quantity,
      entryPrice, exitPrice, pnl: gross!, fees: fees!,
      entryTime: entry.getTime() / 1000, exitTime: exit.getTime() / 1000,
    })
  }
  dayTrades.sort((a, b) => a.entryTime.localeCompare(b.entryTime))
  normalized.sort((a, b) => a.entryTime - b.entryTime)
  const complete = Boolean(available) && !omittedClosed && normalized.length === dayTrades.length
  const dayMap = new Map<string, { pnl: number; known: boolean }>()
  for (const trade of dayTrades) {
    const current = dayMap.get(trade.date) ?? { pnl: 0, known: true }
    current.known &&= trade.netPnl != null
    current.pnl += trade.netPnl ?? 0
    dayMap.set(trade.date, current)
  }
  const days = omittedClosed ? [] : [...dayMap].filter(([, day]) => day.known).map(([date, day]) => ({ date, pnl: day.pnl })).sort((a, b) => a.date.localeCompare(b.date))
  const totalPnl = balance != null && initialBalance != null ? balance - initialBalance
    : complete ? normalized.reduce((sum, trade) => sum + trade.pnl - trade.fees!, 0) : undefined
  const message = !available ? 'Replay closed trades could not be loaded.'
    : !complete ? 'Some replay trade details or symbol fees are unavailable; incomplete totals are left blank.'
    : !balances ? 'The replay balance could not be loaded.' : null
  return {
    session, balance, initialBalance,
    stats: {
      trades: complete ? normalized : [], ...(available ? { totalTrades: closedCount } : {}),
      ...(complete ? { winRate: dayTrades.length ? dayTrades.filter((trade) => trade.netPnl! > 0).length / dayTrades.length * 100 : 0 } : {}),
      ...(totalPnl != null ? { totalPnl } : {}),
    },
    days, dayTrades, omittedClosedTrades: omittedClosed,
    detailsStatus: !available ? 'unavailable' : complete ? 'available' : 'partial', message,
  }
}
