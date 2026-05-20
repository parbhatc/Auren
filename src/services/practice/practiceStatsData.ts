import { practiceAPI } from '../../api/practice.api'

import type { PracticeTradeRecord } from '../../api/practice.api'

import type { TradeData } from '../../types/stats'

import { TradeseaStats } from '../stats/TradeseaStats'



function parseTradeTimestamp(ts: number | string | null | undefined): Date | null {

  if (ts == null) return null

  if (typeof ts === 'number') {

    return new Date(ts < 1e12 ? ts * 1000 : ts)

  }

  const d = new Date(ts)

  return Number.isNaN(d.getTime()) ? null : d

}



function formatDateLocal(date: Date): string {

  const y = date.getFullYear()

  const m = String(date.getMonth() + 1).padStart(2, '0')

  const d = String(date.getDate()).padStart(2, '0')

  return `${y}-${m}-${d}`

}



function practiceTradeToTradeData(t: PracticeTradeRecord & { id?: string }): TradeData {

  const entryMs = t.entryTime < 1e12 ? t.entryTime * 1000 : t.entryTime

  const exitMs = t.exitTime < 1e12 ? t.exitTime * 1000 : t.exitTime

  return {

    id: (t as { id?: string }).id,

    symbol: t.symbol,

    entry_price: t.entryPrice,

    exit_price: t.exitPrice,

    contracts: t.contracts,

    direction: t.direction,

    entry_time: new Date(entryMs).toISOString(),

    exit_time: new Date(exitMs).toISOString(),

    pnl: t.pnl,

    originalTrade: t,

  }

}



function filterTradesByDateRange(

  trades: TradeData[],

  dateRange?: { startDate: string; endDate: string }

): TradeData[] {

  const from = String(dateRange?.startDate || '').trim()

  const to = String(dateRange?.endDate || '').trim()

  if (!from || !to) return trades



  const start = new Date(`${from}T00:00:00`).getTime()

  const end = new Date(`${to}T23:59:59.999`).getTime()



  return trades.filter((trade) => {

    const exit = parseTradeTimestamp(trade.exit_time)

    if (!exit) return false

    const t = exit.getTime()

    return t >= start && t <= end

  })

}



function equityCurveFromTrades(trades: TradeData[], startingBalance: number) {

  const byDay = new Map<string, number>()

  for (const trade of trades) {

    const exit = parseTradeTimestamp(trade.exit_time)

    if (!exit) continue

    const day = formatDateLocal(exit)

    byDay.set(day, (byDay.get(day) || 0) + Number(trade.pnl ?? 0))

  }

  const days = [...byDay.keys()].sort()

  let cumulative = startingBalance

  return days.map((date) => {

    cumulative += byDay.get(date) || 0

    return { date, value: cumulative }

  })

}



function calendarDaysFromTrades(trades: TradeData[]) {

  const byDay = new Map<string, { pnl: number; count: number }>()

  for (const trade of trades) {

    const exit = parseTradeTimestamp(trade.exit_time)

    if (!exit) continue

    const date = formatDateLocal(exit)

    const cur = byDay.get(date) || { pnl: 0, count: 0 }

    cur.pnl += Number(trade.pnl ?? 0)

    cur.count += 1

    byDay.set(date, cur)

  }

  return [...byDay.entries()].map(([date, { pnl, count }]) => ({

    date,

    pnl,

    tradeCount: count,

  }))

}



function formatDuration(seconds: number): string {

  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'

  const h = Math.floor(seconds / 3600)

  const m = Math.floor((seconds % 3600) / 60)

  const s = Math.floor(seconds % 60)

  if (h > 0) return `${h}h ${m}m`

  if (m > 0) return `${m}m ${s}s`

  return `${s}s`

}



export async function getPracticeStatsData(

  practiceAccountId: string,

  dateRange?: { startDate: string; endDate: string }

) {

  const res = await practiceAPI.getStats(practiceAccountId)

  const account = res?.account

  const tradeRows = res?.trades



  if (!account && (!tradeRows || tradeRows.length === 0)) {

    return null

  }



  const startingBalance = account?.rules?.startingBalance ?? account?.size ?? 0

  const allTrades = (tradeRows || []).map(practiceTradeToTradeData)

  const trades = filterTradesByDateRange(allTrades, dateRange)



  const calculator = new TradeseaStats()

  let stats = calculator.calculate(trades)



  const realizedFromBalance =

    account != null ? account.balance - startingBalance : Number(res?.totalPnl ?? 0)



  if (trades.length === 0 && realizedFromBalance !== 0) {
    stats = {
      ...stats,
      totalProfit: realizedFromBalance.toFixed(2),
    }
  }



  const calculateTradePnL = (trade: TradeData): number => {

    if (trade.pnl !== undefined && Number.isFinite(Number(trade.pnl))) {

      return Number(trade.pnl)

    }

    return 0

  }



  const equityFromTrades = equityCurveFromTrades(allTrades, startingBalance)

  const equityCurveData =

    equityFromTrades.length > 0

      ? equityFromTrades

      : [

          {

            date: formatDateLocal(new Date()),

            value: account?.balance ?? startingBalance,

          },

        ]



  return {

    trades,

    equityCurveData,

    stats,

    calculateTradePnL,

    parseTradeTimestamp,

    formatDuration,

    initialBalance: startingBalance,

    symbolData: {} as Record<string, { tickSize: number; tickValue: number }>,

    tradeseaCalendarDays: calendarDaysFromTrades(allTrades),

    practiceAccount: account,

    practiceRulesStatus: res?.rulesStatus,

  }

}


