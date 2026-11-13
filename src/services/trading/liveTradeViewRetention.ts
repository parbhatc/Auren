import { LIVE_TRADE_IDLE_MS, type LiveTradeSessionIdentity } from './liveTradeSession'

export type RetainedTradeView = {
  key: number
  identity: LiveTradeSessionIdentity
  expiresAt: number | null
}

type ViewLocation = { active: boolean; eligible: boolean; identity: LiveTradeSessionIdentity }

/** Keep one chart view warm, without crossing account/auth/provider boundaries. */
export function createLiveTradeViewRetention(idleMs = LIVE_TRADE_IDLE_MS) {
  return createTradeViewRetention('live', idleMs)
}

export function createTradeViewRetention(mode: LiveTradeSessionIdentity['mode'], idleMs = LIVE_TRADE_IDLE_MS) {
  let view: RetainedTradeView | null = null
  let sequence = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  const publish = (next: RetainedTradeView | null) => {
    if (view === next) return
    view = next
    for (const listener of listeners) listener()
  }
  const cancelTimer = () => { if (timer) clearTimeout(timer); timer = null }
  const clear = () => { cancelTimer(); publish(null) }
  return {
    snapshot: () => view,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    update({ active, eligible, identity }: ViewLocation) {
      // Practice loads its account catalog before the provider is known.
      const firmMatches = view?.identity.firmId === identity.firmId
        || (mode === 'practice' && active && view?.identity.firmId === '')
      const authMatches = view?.identity.token === identity.token && firmMatches
        && view?.identity.mode === identity.mode
      if (!eligible || !identity.token || identity.mode !== mode) { clear(); return }
      // Account selection inside the active terminal owns its normal provider
      // transition. An inactive terminal cannot follow a dashboard selection.
      if (view && (!authMatches || (!active && view.identity.accountId !== identity.accountId)
        || (view.expiresAt !== null && view.expiresAt <= Date.now()))) clear()
      if (active) {
        cancelTimer()
        if (!view) publish({ key: ++sequence, identity: { ...identity }, expiresAt: null })
        else if (view.expiresAt !== null || view.identity.accountId !== identity.accountId
          || view.identity.firmId !== identity.firmId) {
          publish({ ...view, identity: { ...identity }, expiresAt: null })
        }
      } else if (view && view.expiresAt === null) {
        publish({ ...view, expiresAt: Date.now() + idleMs })
        timer = setTimeout(clear, idleMs)
      }
    },
    dispose() { clear(); listeners.clear() },
  }
}
