export type LiveTradeSessionIdentity = {
  token: string | null
  firmId: string
  accountId: string
  mode: 'live' | 'practice'
}

export const LIVE_TRADE_WARM_MS = 10 * 60_000
// Keep an exact ten-minute return from racing browser scheduling and cleanup.
// The widget and connection share this deadline so neither expires first.
export const LIVE_TRADE_IDLE_MS = LIVE_TRADE_WARM_MS + 30_000

type Owner = { cleanup(): void }
type SessionOptions = {
  owner: Owner
  getIdentity(): LiveTradeSessionIdentity
  isReusable(): boolean
  load(assertCurrent: () => void): Promise<void>
}

type Entry = SessionOptions & {
  identity: LiveTradeSessionIdentity
  ready: Promise<void>
  state: 'pending' | 'ready'
  users: number
  timer: ReturnType<typeof setTimeout> | null
  expiresAt: number | null
}

function sameIdentity(a: LiveTradeSessionIdentity, b: LiveTradeSessionIdentity, includeAccount = true): boolean {
  return a.token === b.token && a.firmId === b.firmId && a.mode === b.mode
    && (!includeAccount || a.accountId === b.accountId)
}

/** Own only a short-lived in-memory connection, never trading requests or credentials on disk. */
export function createLiveTradeSessionCache(idleMs = LIVE_TRADE_IDLE_MS) {
  let entry: Entry | null = null

  const invalidate = (owner?: Owner, dispose = true) => {
    const previous = entry
    if (!previous || (owner && previous.owner !== owner)) return
    entry = null
    if (previous.timer) clearTimeout(previous.timer)
    if (dispose) previous.owner.cleanup()
  }

  const current = (candidate: Entry): boolean => entry === candidate && Boolean(candidate.identity.token)
    && candidate.identity.mode === 'live'
    && sameIdentity(candidate.identity, candidate.getIdentity(), candidate.state === 'ready')

  const sync = () => {
    if (entry && ((!entry.users && entry.expiresAt != null && entry.expiresAt <= Date.now())
      || !current(entry) || (entry.state === 'ready' && !entry.isReusable()))) invalidate()
  }

  const acquire = (options: SessionOptions) => {
    sync()
    const identity = options.getIdentity()
    if (entry && (entry.owner !== options.owner || !sameIdentity(entry.identity, identity))) {
      invalidate()
    }
    if (!entry) {
      const candidate: Entry = {
        ...options, identity, state: 'pending', users: 0, timer: null, expiresAt: null, ready: Promise.resolve(),
      }
      entry = candidate
      const assertCurrent = () => {
        if (!current(candidate)) throw new DOMException('Live session superseded', 'AbortError')
      }
      candidate.ready = Promise.resolve().then(async () => {
        assertCurrent()
        await options.load(assertCurrent)
        assertCurrent()
        if (!options.isReusable()) throw new Error('Live market-data connection is not ready')
        candidate.identity = options.getIdentity()
        candidate.state = 'ready'
      }).catch((error) => {
        if (entry === candidate) invalidate()
        throw error
      })
    }
    const retained = entry
    if (retained.timer) clearTimeout(retained.timer)
    retained.timer = null
    retained.expiresAt = null
    retained.users += 1
    let released = false
    return {
      ready: retained.ready,
      release() {
        if (released) return
        released = true
        retained.users -= 1
        if (entry !== retained || retained.users > 0) return
        const identity = retained.getIdentity()
        if (!sameIdentity(retained.identity, identity, false) || !identity.token || identity.mode !== 'live'
          || (retained.state === 'ready' && !retained.isReusable())) {
          invalidate()
          return
        }
        // A selection made inside Live becomes the identity retained on exit.
        if (retained.state === 'ready') retained.identity = { ...retained.identity, accountId: identity.accountId }
        retained.expiresAt = Date.now() + idleMs
        retained.timer = setTimeout(() => {
          if (entry === retained && retained.users === 0) invalidate()
        }, idleMs)
      },
    }
  }

  return { acquire, invalidate, sync }
}

const liveTradeSessions = createLiveTradeSessionCache()
export const acquireLiveTradeSession = liveTradeSessions.acquire
export const invalidateLiveTradeSession = liveTradeSessions.invalidate
export const syncLiveTradeSession = liveTradeSessions.sync
