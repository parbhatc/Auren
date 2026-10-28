/** Bounded, credential-free history diagnostics; recording never changes reads. */
export function createHistoryRequestTrace(limit = 300, now = Date.now) {
  let sequence = 0
  const counts = { logical: 0, wire: 0, cache: 0, joined: 0, retries: 0, failed: 0 }
  const events = []
  const series = new Map()
  return {
    start(detail) {
      const { kind, symbol, resolution, from, to, countBack, reason, attempt } = detail
      if (!(kind in counts) || kind === 'failed' || kind === 'retries') throw new Error('Unknown history trace kind')
      counts[kind] += 1
      if (kind === 'wire' && attempt > 0) counts.retries += 1
      const key = JSON.stringify([symbol, resolution])
      if (!series.has(key)) series.set(key, { symbol, resolution, logical: 0, wire: 0, cache: 0, joined: 0, bars: 0 })
      const row = series.get(key)
      row[kind] += 1
      const event = { id: ++sequence, kind, symbol, resolution, from, to, countBack, reason, attempt, startedAt: now(), status: 'pending' }
      events.push(event)
      if (events.length > limit) events.shift()
      let ended = false
      return (result = {}) => {
        if (ended) return
        ended = true
        event.status = result.error ? 'failed' : 'complete'
        event.durationMs = Math.max(0, now() - event.startedAt)
        event.bars = result.bars
        if (result.error) counts.failed += 1
        if (kind === 'wire' && Number.isFinite(result.bars)) row.bars += result.bars
      }
    },
    snapshot() {
      return { counts: { ...counts }, series: [...series.values()].map(row => ({ ...row })), events: events.map(event => ({ ...event })) }
    },
  }
}
