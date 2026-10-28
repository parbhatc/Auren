import { type ReactNode, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { getAuthToken } from '../../../api/api'
import { ROUTES } from '../../../constants/routes'
import { getTradeTradeseaAccount } from '../../../constants/trade'
import { getLiveTradePropFirmId } from '../../../utils/liveTrade'
import { createLiveTradeViewRetention } from '../../../services/trading/liveTradeViewRetention'
import { LiveTradeViewActive } from '../../../contexts/LiveTradeViewContext'

/** Retain the actual widget, not just HTTP responses, during a short hub visit. */
export default function LiveTradeViewRetention({ children }: { children: ReactNode }) {
  const location = useLocation()
  const active = location.pathname === ROUTES.TRADE
  // Other chart routes can share provider/replay state. Retain only the
  // Dashboard round trip; release Live before any other workspace mounts.
  const eligible = active || location.pathname === ROUTES.DASHBOARD || location.pathname === ROUTES.HOME
  const controller = useRef<ReturnType<typeof createLiveTradeViewRetention> | null>(null)
  if (!controller.current) controller.current = createLiveTradeViewRetention()
  const cache = controller.current
  const view = useSyncExternalStore(cache.subscribe, cache.snapshot, cache.snapshot)
  const wrapper = useRef<HTMLDivElement>(null)
  const currentLocation = useRef({ active, eligible })
  currentLocation.current = { active, eligible }
  const identity = () => ({ token: getAuthToken(), firmId: getLiveTradePropFirmId(),
    accountId: getTradeTradeseaAccount().accountId, mode: 'live' as const })

  useLayoutEffect(() => {
    const sync = () => cache.update({ ...currentLocation.current, identity: identity() })
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('tradeTradeseaAccountChanged', sync)
    window.addEventListener('liveTradePropFirmChanged', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('tradeTradeseaAccountChanged', sync)
      window.removeEventListener('liveTradePropFirmChanged', sync)
    }
  }, [cache])
  // Suspense hides an already mounted tree by cleaning up its layout effects.
  // Retained chart state belongs to a real unmount, not a temporary lazy-route
  // hide. Passive cleanup also leaves the same controller usable in StrictMode.
  useEffect(() => () => cache.dispose(), [cache])
  useLayoutEffect(() => { cache.update({ active, eligible, identity: identity() }) }, [cache, active, eligible, location.key])
  useLayoutEffect(() => { wrapper.current?.toggleAttribute('inert', !active) }, [active, view?.key])

  const current = identity()
  if (!view || !eligible || !current.token || view.identity.token !== current.token || view.identity.firmId !== current.firmId
    || (!active && view.identity.accountId !== current.accountId)) return null

  return <LiveTradeViewActive.Provider value={active}>
    <div ref={wrapper} data-auren-retained-trade="true" aria-hidden={!active}
      style={active ? undefined : { position: 'fixed', inset: 0, width: '100%', height: '100dvh',
        visibility: 'hidden', pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}>
      <div key={view.key}>{children}</div>
    </div>
  </LiveTradeViewActive.Provider>
}
