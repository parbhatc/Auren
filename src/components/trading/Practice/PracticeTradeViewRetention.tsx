import { lazy, useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation, useMatch } from 'react-router-dom'
import { getAuthToken } from '../../../api/api'
import { getPracticeAccountById, getPracticeMarketDataSettings, normalizePracticePropFirmId, PRACTICE_STORAGE_KEYS } from '../../../constants/practice'
import { ROUTES } from '../../../constants/routes'
import { LiveTradeViewActive } from '../../../contexts/LiveTradeViewContext'
import { routeModules } from '../../../navigation/routeModules'
import { subscribeAuthEvents } from '../../../services/auth/authEvents'
import { createTradeViewRetention } from '../../../services/trading/liveTradeViewRetention'
import ProtectedRoute from '../../common/ProtectedRoute'

const PracticeTerminalPage = lazy(routeModules.practice)

function getIdentity(requestedAccountId?: string) {
  const token = getAuthToken()
  const accountId = token ? requestedAccountId ?? localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) ?? '' : ''
  const account = accountId ? getPracticeAccountById(accountId) : null
  // Use the resolved account's provider once the catalog is available.
  const firmId = account ? normalizePracticePropFirmId(account.propFirmId || getPracticeMarketDataSettings().propFirmId) : ''
  return { token, accountId, firmId, mode: 'practice' as const }
}

export default function PracticeTradeViewRetention() {
  const location = useLocation()
  const canonical = useMatch(ROUTES.PRACTICE)
  const deepLink = useMatch(`${ROUTES.PRACTICE_TRADE}/:practiceAccountId`)
  const active = Boolean(canonical || deepLink)
  const eligible = active || location.pathname === ROUTES.DASHBOARD || location.pathname === ROUTES.HOME
  const requestedAccountId = deepLink?.params.practiceAccountId
  const controller = useRef<ReturnType<typeof createTradeViewRetention> | null>(null)
  if (!controller.current) controller.current = createTradeViewRetention('practice')
  const cache = controller.current
  const view = useSyncExternalStore(cache.subscribe, cache.snapshot, cache.snapshot)
  const wrapper = useRef<HTMLDivElement>(null)
  const lastRequestedAccountId = useRef<string>()
  const currentLocation = useRef({ active, eligible })
  currentLocation.current = { active, eligible }
  const onAccountResolved = useCallback((accountId: string | null) => {
    if (!currentLocation.current.active) return
    cache.update({
      ...currentLocation.current,
      identity: getIdentity(lastRequestedAccountId.current ?? accountId ?? undefined),
    })
  }, [cache])

  useLayoutEffect(() => {
    const sync = () => cache.update({ ...currentLocation.current, identity: getIdentity(lastRequestedAccountId.current) })
    window.addEventListener('storage', sync)
    window.addEventListener('practiceAccountsChanged', sync)
    window.addEventListener('practiceSettingsChanged', sync)
    const unsubscribe = subscribeAuthEvents((event) => { if (event.kind === 'token-change') sync() })
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('practiceAccountsChanged', sync)
      window.removeEventListener('practiceSettingsChanged', sync)
      unsubscribe()
    }
  }, [cache])
  useEffect(() => () => cache.dispose(), [cache])
  useLayoutEffect(() => {
    if (active) lastRequestedAccountId.current = requestedAccountId
    cache.update({ active, eligible, identity: getIdentity(lastRequestedAccountId.current) })
  }, [active, cache, eligible, location.key, requestedAccountId])
  useLayoutEffect(() => { wrapper.current?.toggleAttribute('inert', !active) }, [active, view?.key])

  const identity = getIdentity(active ? requestedAccountId : lastRequestedAccountId.current)
  if (active && !identity.token) return <ProtectedRoute>{null}</ProtectedRoute>
  const firmMatches = view?.identity.firmId === identity.firmId || (active && view?.identity.firmId === '')
  if (!view || !eligible || view.identity.token !== identity.token || !firmMatches
    || (!active && view.identity.accountId !== identity.accountId)) return null

  return (
    <LiveTradeViewActive.Provider value={active}>
      <div
        ref={wrapper}
        data-auren-retained-practice="true"
        aria-hidden={!active}
        style={active ? undefined : {
          position: 'fixed', inset: 0, width: '100%', height: '100dvh',
          visibility: 'hidden', pointerEvents: 'none', zIndex: -1, overflow: 'hidden',
        }}
      >
        <ProtectedRoute key={view.key}>
          <PracticeTerminalPage
            practiceAccountId={active ? requestedAccountId : lastRequestedAccountId.current}
            viewActive={active}
            onAccountResolved={onAccountResolved}
          />
        </ProtectedRoute>
      </div>
    </LiveTradeViewActive.Provider>
  )
}
