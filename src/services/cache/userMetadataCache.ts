type Entry = {
  value?: unknown
  expiresAt: number
  pending?: Promise<unknown>
  controller: AbortController
}

const aborted = () => new DOMException('Metadata read superseded', 'AbortError')
// These endpoints return JSON catalogs. Give each consumer its own records so
// an editor or sort cannot change another page's cached metadata.
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

function consume<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  if (signal.aborted) return Promise.reject(aborted())
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(aborted()) }
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    signal.addEventListener('abort', onAbort, { once: true })
    pending.then((value) => { cleanup(); resolve(value) }, (error) => { cleanup(); reject(error) })
  })
}

/** Bounded, memory-only read metadata; never use for auth, positions or orders. */
export function createUserMetadataCache(options: {
  getOwner: () => string | null
  ttlMs: number
  maxEntries?: number
}) {
  let owner: string | null = null
  let revision = 0
  const entries = new Map<string, Entry>()
  const clear = () => {
    revision += 1
    for (const entry of entries.values()) entry.controller.abort()
    entries.clear()
  }
  const syncOwner = () => {
    const current = options.getOwner()
    if (current !== owner) { clear(); owner = current }
    return current
  }
  return {
    invalidate() { syncOwner(); clear() },
    read<T>(key: string, load: (signal: AbortSignal) => Promise<T>, readOptions: {
      signal?: AbortSignal
      force?: boolean
      cacheable?: (value: T) => boolean
    } = {}): Promise<T> {
      const requestOwner = syncOwner()
      if (readOptions.signal?.aborted) return Promise.reject(aborted())
      if (readOptions.force) {
        entries.get(key)?.controller.abort()
        entries.delete(key)
      }
      let entry = entries.get(key)
      if (entry && !entry.pending && entry.expiresAt <= Date.now()) {
        entries.delete(key)
        entry = undefined
      }
      if (!entry) {
        entry = { expiresAt: 0, controller: new AbortController() }
        const candidate = entry
        const requestRevision = revision
        const current = () => options.getOwner() === requestOwner && requestRevision === revision && !candidate.controller.signal.aborted
        const pending = Promise.resolve().then(() => {
          if (!current()) throw aborted()
          return load(candidate.controller.signal)
        }).then((value) => {
          if (!current()) throw aborted()
          if (requestOwner && entries.get(key) === candidate && (readOptions.cacheable?.(value) ?? true)) {
            candidate.value = copy(value)
            candidate.expiresAt = Date.now() + options.ttlMs
          } else if (entries.get(key) === candidate) entries.delete(key)
          return value
        }).catch((error) => {
          if (entries.get(key) === candidate) entries.delete(key)
          throw current() ? error : aborted()
        }).finally(() => { candidate.pending = undefined })
        candidate.pending = pending
        entries.set(key, candidate)
        while (entries.size > (options.maxEntries ?? 8)) entries.delete(entries.keys().next().value)
      } else {
        entries.delete(key)
        entries.set(key, entry)
      }
      const result = entry.pending ?? Promise.resolve(entry.value as T)
      const consumerRevision = revision
      const consumerEntry = entry
      return consume(result as Promise<T>, readOptions.signal).then((value) => {
        if (options.getOwner() !== requestOwner || consumerRevision !== revision || consumerEntry.controller.signal.aborted) throw aborted()
        return copy(value)
      })
    },
  }
}
