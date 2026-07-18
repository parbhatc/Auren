function parseRangeBoundary(value, endOfDay) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim())
  if (!dateOnly) return new Date(value).getTime()
  const year = Number(dateOnly[1])
  const month = Number(dateOnly[2]) - 1
  const day = Number(dateOnly[3])
  const parsed = new Date(
    year,
    month,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  )
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return Number.NaN
  }
  return parsed.getTime()
}

function tradeTimestampMs(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw
  if (raw == null || raw === '') return Number.NaN
  const text = String(raw).trim()
  if (!text) return Number.NaN
  const numeric = Number(text)
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
  return new Date(text).getTime()
}

/** Filter entry timestamps against inclusive local date-input boundaries. */
export function filterTradesByDateRange(trades, startDate, endDate) {
  if (!Array.isArray(trades)) return []
  const start = parseRangeBoundary(startDate, false)
  const end = parseRangeBoundary(endDate, true)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return []
  return trades.filter((trade) => {
    const timestamp = tradeTimestampMs(trade?.entry_time)
    return timestamp >= start && timestamp <= end
  })
}

export { parseRangeBoundary, tradeTimestampMs }
