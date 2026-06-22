/** Minute+ timeframes; sub-minute seconds and tick charts use isolated replay. */
export function isCanonicalResolution(resolution) {
  const raw = String(resolution).trim().toUpperCase()
  if (/^\d+T$/.test(raw)) return false
  const secMatch = /^(\d+)S$/.exec(raw)
  if (secMatch) return Number(secMatch[1]) >= 60
  return true
}

/** Drop the still-open bucket tail from replayed history. */
export function splitHistoryForForming(bars, periodSeconds, nowSec = Math.floor(Date.now() / 1000)) {
  const currentOpen = Math.floor(nowSec / periodSeconds) * periodSeconds
  const last = bars.at(-1)
  if (!last) return { closed: [...bars], partial: null }
  if (Number(last.marker) !== currentOpen) return { closed: [...bars], partial: null }
  return { closed: bars.slice(0, -1), partial: last }
}

export function mergeBarIntoSeries(series, bar) {
  const marker = Number(bar.marker)
  const idx = series.findIndex((row) => Number(row.marker) === marker)
  if (idx >= 0) {
    const next = [...series]
    next[idx] = bar
    return next
  }
  return [...series, bar].sort((a, b) => Number(a.marker) - Number(b.marker))
}
