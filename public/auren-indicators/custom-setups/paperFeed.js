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
  ])
}

export async function refreshPaperFeed() {
  if (pending) return pending
  pending = fetch('/api/custom-setups-paper?limit=1000', {
    headers: { Accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Custom Setups paper feed HTTP ${response.status}`)
      const body = await response.json()
      const next = body?.data ?? snapshot
      if (fingerprint(next) !== fingerprint(snapshot)) {
        snapshot = next
        version += 1
        for (const listener of listeners) listener(snapshot, version)
      }
      return snapshot
    })
    .catch(() => snapshot)
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
  return () => listeners.delete(listener)
}

export function getPaperFeedSnapshot() {
  return snapshot
}

export function getPaperFeedVersion() {
  return version
}
