let snapshot = { available: false, openPosition: null, trades: [], priority: [2, 1, 3, 4, 5, 6, 7, 8] }
let version = 0
let timer = null
let pending = null
const listeners = new Set()

function authHeaders() {
  try {
    const token = window.localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function fingerprint(value) {
  const open = value?.openPosition
  const tail = value?.trades?.at?.(-1)
  return JSON.stringify([
    value?.updatedAt,
    open?.setupId, open?.entryTime, open?.stop, open?.target,
    value?.trades?.length,
    tail?.setupId, tail?.entryTime, tail?.exitTime, tail?.pnl,
    value?.error,
  ])
}

function publish(next) {
  if (fingerprint(next) !== fingerprint(snapshot)) {
    snapshot = next
    version += 1
    for (const listener of listeners) listener(snapshot, version)
  }
  return snapshot
}

export async function refreshPaperFeed() {
  if (pending) return pending
  const headers = { Accept: 'application/json', ...authHeaders() }
  const fetchPage = async (limit, offset) => {
    const response = await fetch(`/api/custom-setups-paper?limit=${limit}&offset=${offset}`, {
      headers,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Custom Setups paper feed HTTP ${response.status}`)
    const body = await response.json()
    return body?.data ?? null
  }
  pending = fetchPage(500, 0)
    .then(async (newest) => {
      if (!newest) return snapshot
      const totalTrades = Math.max(0, Number(newest.totalTrades) || newest.trades?.length || 0)
      const pages = [newest]
      for (let offset = 500; offset < totalTrades; offset += 500) {
        pages.unshift(await fetchPage(Math.min(500, totalTrades - offset), offset))
      }
      const trades = pages.flatMap((page) => Array.isArray(page?.trades) ? page.trades : [])
      return publish({ ...newest, trades, totalTrades, error: null })
    })
    .catch((error) => publish({
      ...snapshot,
      error: error instanceof Error ? error.message : 'Custom Setups paper feed failed',
    }))
    .finally(() => { pending = null })
  return pending
}

export function startPaperFeedPolling(intervalMs = 2000) {
  if (timer != null) return
  void refreshPaperFeed()
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshPaperFeed()
  }, Math.max(1000, intervalMs))
}

export function subscribePaperFeed(listener) {
  listeners.add(listener)
  // The first request can finish while the chart widget is still booting. A
  // late subscriber must receive that snapshot or its overlay remains cached
  // as empty until the feed changes again.
  listener(snapshot, version)
  return () => listeners.delete(listener)
}

export function getPaperFeedSnapshot() {
  return snapshot
}

export function getPaperFeedVersion() {
  return version
}
