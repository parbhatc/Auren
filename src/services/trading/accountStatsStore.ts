/**
 * External store for the live account stats shown in the trade header
 * (BAL / RP&L / UP&L). This exists so a fast-moving unrealized-PnL stream can
 * update ONLY the small stats readout via `useSyncExternalStore`, instead of
 * calling `setState` on the whole trading terminal — re-rendering/repainting
 * the terminal on every ~1¢ move was costing ~50ms/commit and collapsing the
 * chart FPS while a position was open.
 *
 * Single-terminal assumption: the app shows one active account terminal at a
 * time, so a module-level snapshot is sufficient. The active handler publishes;
 * `publishAccountStats` dedupes by value so identical pushes are free and never
 * notify subscribers.
 */
export type AccountStatsSnapshot = {
  balance: number
  rpl: number
  upl: number
  hasOpenPosition: boolean
}

let snapshot: AccountStatsSnapshot = {
  balance: 0,
  rpl: 0,
  upl: 0,
  hasOpenPosition: false,
}

const listeners = new Set<() => void>()

export function publishAccountStats(next: AccountStatsSnapshot): void {
  if (
    next.balance === snapshot.balance &&
    next.rpl === snapshot.rpl &&
    next.upl === snapshot.upl &&
    next.hasOpenPosition === snapshot.hasOpenPosition
  ) {
    return
  }
  snapshot = next
  for (const listener of listeners) listener()
}

/** Stable reference between publishes — required by useSyncExternalStore. */
export function getAccountStatsSnapshot(): AccountStatsSnapshot {
  return snapshot
}

export function subscribeAccountStats(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
