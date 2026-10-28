/** Development-only timings. Never retain request queries, tokens or account IDs. */
const milestones: Array<{ phase: string; ms: number }> = []
const apiReads: Array<{ endpoint: string; startMs: number; durationMs: number; resolution?: string }> = []
const chartAssets = { requests: 0, transferredBytes: 0, decodedBytes: 0 }
const appAssets = { requests: 0, transferredBytes: 0, decodedBytes: 0 }
let publishTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

const round = (value: number) => Math.round(value * 10) / 10

function publish() {
  if (typeof document === 'undefined' || publishTimer !== null) return
  publishTimer = setTimeout(() => {
    publishTimer = null
    let node = document.getElementById('auren-startup-diagnostics')
    if (!node) {
      node = document.createElement('script')
      node.id = 'auren-startup-diagnostics'
      node.setAttribute('type', 'application/json')
      document.body.append(node)
    }
    node.textContent = JSON.stringify({ milestones, apiReads, chartAssets, appAssets })
  }, 50)
}

export function traceStartup(phase: string) {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return
  milestones.push({ phase, ms: round(performance.now()) })
  if (milestones.length > 80) milestones.shift()
  publish()
}

export function installStartupTrace() {
  if (!import.meta.env.DEV || installed || typeof PerformanceObserver === 'undefined') return
  installed = true
  traceStartup('app-start')
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      const url = new URL(entry.name, window.location.href)
      // Plain-HTTP Replay deliberately bypasses the dev proxy for large CSV
      // responses. Count that one known backend endpoint without retaining URLs.
      const sameOrigin = url.origin === window.location.origin
      const replayBackend = window.location.protocol === 'http:' && url.protocol === 'http:'
        && url.hostname === window.location.hostname
        && url.port === String(import.meta.env.VITE_API_PORT || '3001')
        && url.pathname === '/api/backtester/history'
      if (!sameOrigin && !replayBackend) continue
      // Only these fixed route names can appear in the DOM diagnostics.
      const endpoint = [
        '/api/roles/status', '/api/auth/validate', '/api/props',
        '/api/tradesea/connection', '/api/tradesea/accounts',
        '/api/tradesea/stream-config', '/api/tradesea/proxy/udf/history',
        '/api/tradesea/proxy/udf/symbols', '/api/tradesea/proxy/udf/search',
        '/api/economic-news/events', '/api/practice/accounts',
        '/api/trading-journal/entries', '/api/trading-journal/strategies',
        '/api/trading-journal/building-blocks', '/api/trading-journal/analytics',
        '/api/backtester/sessions', '/api/backtester/symbols', '/api/backtester/symbol-data',
        '/api/backtester/history',
      ].find((path) => url.pathname === path)
      if (endpoint) {
        const resolution = url.searchParams.get('resolution')?.toUpperCase()
        const safeResolution = endpoint.endsWith('/history') && resolution
          && ['1S', '5S', '10S', '15S', '30S', '1', '2', '3', '5', '10', '15', '30', '60', '120', '240', '1D', '1W', '1M'].includes(resolution)
          ? resolution : undefined
        apiReads.push({ endpoint, startMs: round(entry.startTime), durationMs: round(entry.duration),
          ...(safeResolution ? { resolution: safeResolution } : {}) })
        if (apiReads.length > 100) apiReads.shift()
      }
      if (/^\/(?:chart|js|vendor|testing\/js|auren-indicators)\/.+\.m?js$/.test(url.pathname)) {
        chartAssets.requests += 1
        chartAssets.transferredBytes += entry.transferSize || 0
        chartAssets.decodedBytes += entry.decodedBodySize || 0
      }
      if (/^\/(?:src|assets|node_modules)\/.+\.(?:[jt]sx?|mjs)$/.test(url.pathname)) {
        appAssets.requests += 1
        appAssets.transferredBytes += entry.transferSize || 0
        appAssets.decodedBytes += entry.decodedBodySize || 0
      }
    }
    publish()
  })
  observer.observe({ type: 'resource', buffered: true })
  import.meta.hot?.dispose(() => observer.disconnect())
}
