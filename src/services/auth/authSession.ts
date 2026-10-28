export const AUTH_FRESH_MS = 60_000
export const AUTH_MAX_VERIFIED_MS = 5 * 60_000
const AUTH_RETRY_MS = 30_000

export type AuthValidation = { success: boolean; user?: { isAdmin?: boolean } }
export type AuthSnapshot<T extends AuthValidation> = {
  token: string | null
  phase: 'anonymous' | 'checking' | 'ready' | 'unavailable'
  value: T | null
  checkedAt: number | null
  refreshing: boolean
  error: unknown
}

/** Decode expiry only to shorten a verified session's lifetime, never to authorize it. */
export function authTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' && Number.isFinite(json.exp) ? json.exp * 1000 : null
  } catch {
    return null
  }
}

function authStatus(error: unknown): number | undefined {
  const failure = error as { response?: { status?: number }; status?: number }
  return failure?.response?.status ?? failure?.status
}

function superseded(): DOMException {
  return new DOMException('Authentication changed during validation', 'AbortError')
}

function ownValidation<T extends AuthValidation>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T
  const freeze = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    for (const child of Object.values(node)) freeze(child)
    Object.freeze(node)
  }
  freeze(copy)
  return copy
}

/** One current identity in memory. An unverified token never creates a verified value. */
export function createAuthSession<T extends AuthValidation>(options: {
  readToken(): string | null
  validate(token: string): Promise<T>
  clearToken(token: string): void
  now?: () => number
  isVisible?: () => boolean
  trace?: (phase: string) => void
}) {
  const now = options.now ?? Date.now
  const listeners = new Set<() => void>()
  let generation = 0
  let cached: { token: string; value: T; checkedAt: number; expiresAt: number } | null = null
  let pending: { token: string; generation: number; promise: Promise<T> } | null = null
  let nextAttemptAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let lastReturnAt = -Infinity
  let snapshot: AuthSnapshot<T> = {
    token: options.readToken(), phase: 'checking', value: null, checkedAt: null, refreshing: false, error: null,
  }
  if (!snapshot.token) snapshot = { ...snapshot, phase: 'anonymous' }
  snapshot = Object.freeze(snapshot)

  const publish = (next: AuthSnapshot<T>) => {
    snapshot = Object.freeze(next)
    for (const listener of listeners) listener()
  }
  const cancelTimer = () => { if (timer !== null) clearTimeout(timer); timer = null }
  const usable = () => Boolean(cached && cached.token === snapshot.token && now() < cached.expiresAt)
  const fresh = () => usable() && now() - cached!.checkedAt < AUTH_FRESH_MS

  const sync = (): AuthSnapshot<T> => {
    const token = options.readToken()
    if (token !== snapshot.token) {
      generation += 1
      pending = null
      cached = null
      nextAttemptAt = 0
      lastReturnAt = -Infinity
      cancelTimer()
      publish({ token, phase: token ? 'checking' : 'anonymous', value: null, checkedAt: null, refreshing: false, error: null })
    } else if (snapshot.value && !usable()) {
      publish({ ...snapshot, phase: snapshot.error ? 'unavailable' : 'checking', value: null, refreshing: Boolean(pending) })
    }
    return snapshot
  }

  const rejectToken = (token: string) => {
    if (options.readToken() !== token) return
    generation += 1
    pending = null
    cached = null
    nextAttemptAt = 0
    cancelTimer()
    options.clearToken(token)
    sync()
    if (snapshot.token === token) {
      publish({ token, phase: 'anonymous', value: null, checkedAt: null, refreshing: false, error: null })
    }
  }

  const schedule = () => {
    cancelTimer()
    if (!running || !snapshot.token || options.isVisible?.() === false) return
    const due = nextAttemptAt > now() ? Math.min(nextAttemptAt, snapshot.value ? cached!.expiresAt : Infinity)
      : cached ? Math.min(cached.checkedAt + AUTH_FRESH_MS, cached.expiresAt) : now()
    timer = setTimeout(() => {
      timer = null
      sync()
      if (options.isVisible?.() !== false && snapshot.token) void ensure(snapshot.token, { force: true }).catch(() => undefined)
    }, Math.max(1, due - now()))
  }

  const ensure = (requestedToken = options.readToken(), config?: { force?: boolean }): Promise<T> => {
    sync()
    if (!requestedToken || requestedToken !== snapshot.token || snapshot.phase === 'anonymous') return Promise.reject(superseded())
    if (pending?.token === requestedToken) return !config?.force && usable() ? Promise.resolve(cached!.value) : pending.promise
    if (!config?.force && fresh()) return Promise.resolve(cached!.value)
    if (!config?.force && nextAttemptAt > now() && snapshot.error) {
      return usable() ? Promise.resolve(cached!.value) : Promise.reject(snapshot.error)
    }
    const requestGeneration = generation
    const isCurrent = () => requestGeneration === generation && options.readToken() === requestedToken
    const retainedValue = !config?.force && usable() ? cached!.value : null
    publish({ ...snapshot, phase: usable() ? 'ready' : 'checking', value: usable() ? cached!.value : null, refreshing: true })
    options.trace?.('auth-start')
    const promise = Promise.resolve().then(() => options.validate(requestedToken)).then((value) => {
      if (!isCurrent()) throw superseded()
      if (!value.success || !value.user) throw { status: 401, message: 'Authentication is no longer valid' }
      const ownedValue = ownValidation(value)
      const checkedAt = now()
      cached = { token: requestedToken, value: ownedValue, checkedAt,
        expiresAt: Math.min(checkedAt + AUTH_MAX_VERIFIED_MS, authTokenExpiry(requestedToken) ?? Infinity) }
      const verifiedUsable = usable()
      nextAttemptAt = verifiedUsable ? 0 : checkedAt + AUTH_RETRY_MS
      options.trace?.('auth-ready')
      publish({ token: requestedToken, phase: verifiedUsable ? 'ready' : 'unavailable', value: verifiedUsable ? ownedValue : null,
        checkedAt, refreshing: false, error: verifiedUsable ? null : new Error('Session verification has expired') })
      return ownedValue
    }).catch((error) => {
      if (!isCurrent()) throw superseded()
      options.trace?.('auth-error')
      if (authStatus(error) === 401 || authStatus(error) === 403) {
        rejectToken(requestedToken)
      } else {
        nextAttemptAt = now() + AUTH_RETRY_MS
        publish({ token: requestedToken, phase: usable() ? 'ready' : 'unavailable', value: usable() ? cached!.value : null,
          checkedAt: cached?.checkedAt ?? null, refreshing: false, error })
      }
      throw error
    }).finally(() => {
      if (pending?.generation === requestGeneration && pending.token === requestedToken) pending = null
      if (requestGeneration === generation) schedule()
    })
    pending = { token: requestedToken, generation: requestGeneration, promise }
    if (retainedValue) {
      void promise.catch(() => undefined)
      return Promise.resolve(retainedValue)
    }
    return promise
  }

  const returned = () => {
    sync()
    if (!snapshot.token || options.isVisible?.() === false) return
    // Focus and visibilitychange commonly arrive together for one return.
    if (now() - lastReturnAt < 5_000) return
    lastReturnAt = now()
    void ensure(snapshot.token, { force: true }).catch(() => undefined)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    sync, ensure, rejectToken, returned,
    start() { running = true; sync(); schedule() },
    stop() { running = false; cancelTimer() },
  }
}
