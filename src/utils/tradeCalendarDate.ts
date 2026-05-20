import { formatLocalDate } from '../services/tradesea/tradeseaTradelensStats'

/**
 * Calendar day key (yyyy-MM-dd) for grouping trades on the stats calendar.
 * Prefer TradeLens session day so Sunday futures sessions are not shifted to Monday in UTC.
 */
export function getTradeCalendarDate(
  trade: {
    entry_time?: string | number
    tradeseaDay?: string
    originalTrade?: { tradeseaDay?: string }
  },
  parseTradeTimestamp?: (timestamp: string | number) => Date | null
): string | null {
  const sessionDay = trade.tradeseaDay ?? trade.originalTrade?.tradeseaDay
  if (sessionDay) {
    const normalized = String(sessionDay).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10)
  }

  if (trade.entry_time == null) return null

  if (parseTradeTimestamp) {
    const parsed = parseTradeTimestamp(trade.entry_time)
    if (parsed) return formatLocalDate(parsed)
  }

  if (typeof trade.entry_time === 'number') {
    const ms =
      trade.entry_time > 1e15
        ? trade.entry_time / 1000
        : trade.entry_time > 1e12
          ? trade.entry_time
          : trade.entry_time * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : formatLocalDate(d)
  }

  const iso = String(trade.entry_time)
  const parsed = new Date(iso)
  if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed)
  if (iso.includes('T')) return iso.split('T')[0]
  if (iso.includes(' ')) return iso.split(' ')[0]
  return iso.length >= 10 ? iso.substring(0, 10) : null
}
