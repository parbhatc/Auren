import { createHistoryRequestTrace } from '../../../shared/historyRequestTrace.js'

type HistoryRead = {
  kind: 'logical' | 'wire' | 'cache' | 'joined'
  symbol: string
  resolution: string
  from?: number
  to?: number
  countBack?: number
  reason?: string
  attempt?: number
}

const trace = createHistoryRequestTrace()
const brokers = new Map<number, Record<string, number | boolean>>()
const resumes: Record<string, unknown>[] = []
let nextBroker = 0
let publishTimer: ReturnType<typeof setTimeout> | null = null

function schedulePublish() {
  if (typeof document === 'undefined' || publishTimer !== null) return
  publishTimer = setTimeout(() => {
    publishTimer = null
    let element = document.getElementById('auren-history-diagnostics')
    if (!element) {
      element = document.createElement('script')
      element.id = 'auren-history-diagnostics'
      element.setAttribute('type', 'application/json')
      document.body.append(element)
    }
    element.textContent = JSON.stringify({ ...trace.snapshot(), brokers: [...brokers].map(([id, stats]) => ({ id, ...stats })), resumes })
  }, 100)
}

/** Bounded lifecycle evidence for background/reconnect checks in development. */
export function traceChartResume(
  phase: string,
  detail: { backgroundMs?: number; snapshot?: unknown; report?: unknown } = {},
  loadedPanes?: Array<{ symbol?: string; resolution?: string; bars?: Array<{ time: number }> }>,
) {
  if (!import.meta.env.DEV) return
  const source = (detail.report ?? detail.snapshot) as { panes?: unknown[] } | undefined
  const fields = ['index', 'symbol', 'resolution', 'lastTime', 'fromTime', 'toTime', 'beforeBars', 'afterBars', 'firstTimeBefore', 'firstTimeAfter', 'repairedBars', 'requests']
  const panes = (source?.panes ?? []).slice(0, 16).map((value) => {
    const row = value as Record<string, unknown>
    return Object.fromEntries(fields.filter((field) => typeof row[field] === 'string' || (typeof row[field] === 'number' && Number.isFinite(row[field]))).map((field) => [field, row[field]]))
  })
  const timelines = loadedPanes?.slice(0, 16).map((pane) => ({
    symbol: pane.symbol, resolution: pane.resolution, count: pane.bars?.length ?? 0,
    firstTime: pane.bars?.[0]?.time, lastTime: pane.bars?.[pane.bars.length - 1]?.time,
    recentTimes: pane.bars?.slice(-128).map((bar) => bar.time) ?? [],
  }))
  resumes.push({ phase, at: Date.now(), ...(detail.backgroundMs == null ? {} : { backgroundMs: detail.backgroundMs }), ...(panes.length ? { panes } : {}), ...(timelines ? { timelines } : {}) })
  if (resumes.length > 40) resumes.shift()
  schedulePublish()
}

export function trackHistoryBroker(broker?: {
  subscribe(listener: (stats: Record<string, number>) => void): () => void
}) {
  if (!import.meta.env.DEV || !broker?.subscribe) return () => {}
  const id = ++nextBroker
  const unsubscribe = broker.subscribe((stats) => {
    const safe = Object.fromEntries(Object.entries(stats).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)))
    brokers.set(id, { ...safe, active: true })
    if (brokers.size > 8) brokers.delete(brokers.keys().next().value!)
    schedulePublish()
  })
  return () => {
    unsubscribe()
    const stats = brokers.get(id)
    if (stats) brokers.set(id, { ...stats, active: false })
    schedulePublish()
  }
}

/** Dev-only DOM diagnostics expose counts/ranges, never URLs or connection IDs. */
export function traceHistoryRequest(detail: HistoryRead) {
  if (!import.meta.env.DEV) return (_result?: { bars?: number; error?: boolean }) => {}
  const finish = trace.start(detail)
  schedulePublish()
  return (result?: { bars?: number; error?: boolean }) => {
    finish(result)
    schedulePublish()
  }
}
