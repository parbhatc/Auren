/** BWC chart id → GET /backtester/history wire form ("4h" not "240", "30s" not "30S"). */
export function formatBacktesterResolutionForApi(resolution: string): string {
  const raw = String(resolution ?? '').trim()
  if (!raw) return '1'

  const upper = raw.toUpperCase()
  if (upper === 'D' || upper === '1D') return '1D'
  if (upper === 'W' || upper === '1W') return '1W'
  if (upper === 'M' || upper === '1M') return '1M'
  if (/^\d+S$/.test(upper)) return `${parseInt(upper.slice(0, -1), 10)}s`
  if (/^\d+s$/.test(raw)) return raw.toLowerCase()
  if (/^\d+h$/i.test(raw)) return raw.toLowerCase()

  const mins = parseInt(raw, 10)
  if (Number.isFinite(mins) && mins >= 60 && mins % 60 === 0) {
    return `${mins / 60}h`
  }
  return raw
}
