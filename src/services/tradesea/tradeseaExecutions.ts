/** Filled trade / execution row from api-trades-r-delprod …/executions */
export interface TradeseaExecution {
  id: string
  instrument: string
  price: number
  /** Unix seconds */
  time: number
  qty: number
  side: 'buy' | 'sell' | string
  orderId: string
  isClose?: boolean
  commission?: number
}

export function parseTradeseaExecutions(data: unknown): TradeseaExecution[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as { s?: string; d?: TradeseaExecution[] }
  if (obj.s !== 'ok' || !Array.isArray(obj.d)) return []
  return obj.d
}

/** TradingView `IExecutionLineAdapter.setTime` expects Unix seconds (UTC). */
export function toChartExecutionTimeSeconds(time: number): number {
  if (!Number.isFinite(time) || time <= 0) return Math.floor(Date.now() / 1000)
  if (time > 1e12) return Math.floor(time / 1000)
  return Math.floor(time)
}

function formatExecutionTime(timeSec: number): string {
  const ms = timeSec > 1e12 ? timeSec : timeSec * 1000
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(timeSec)
  }
}

/** Hover tooltip — keep `setText` empty so only the arrow shows on chart. */
export function formatTradeseaExecutionTooltip(ex: TradeseaExecution): string {
  const side = String(ex.side || '').toLowerCase() === 'sell' ? 'Sell' : 'Buy'
  const lines = [
    `${side} ${ex.qty} @ ${ex.price}`,
    ex.isClose ? 'Close' : 'Open',
    formatExecutionTime(ex.time),
  ]
  if (ex.instrument) lines.push(ex.instrument)
  if (typeof ex.commission === 'number') lines.push(`Commission: $${ex.commission.toFixed(2)}`)
  if (ex.orderId) lines.push(`Order: ${ex.orderId}`)
  return lines.join('\n')
}
