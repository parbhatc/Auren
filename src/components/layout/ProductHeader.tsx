import { useContext, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Beaker,
  BookOpen,
  CandlestickChart,
  Activity,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Rewind,
  Settings,
  Shield,
  Sun,
  User,
  Users,
  Wallet,
  Wifi,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getPracticeAccounts,
  getPracticeAccountDisplayTitle,
  getPracticeMarketDataSettings,
  getPracticePropFirmConfig,
  PRACTICE_STORAGE_KEYS,
  type PracticeAccount,
} from '../../constants/practice'
import { ROUTES } from '../../constants/routes'
import { useDisplayUnit, type DisplayUnit } from '../../contexts/DisplayUnitContext'
import { tradeseaAPI, type TradeseaAccount } from '../../api/tradesea.api'
import { authAPI } from '../../api/auth.api'
import { clearAuthToken, getAuthToken } from '../../api/api'
import { ValidatedAuthContext } from '../../contexts/ValidatedAuthContext'
import { LiveTradeViewActive } from '../../contexts/LiveTradeViewContext'
import { prefetchRouteOnIntent } from '../../navigation/routeModules'
import { traceStartup } from '../../services/debug/startupTrace'
import {
  refreshHeaderPracticeCatalog, loadHeaderProviderStatus, subscribeHeaderWorkspaceData,
} from '../../services/dashboard/headerWorkspaceData'
import { saveTradeTradeseaAccount } from '../../constants/trade'
import {
  DASHBOARD_ACCOUNT_CHANGED_EVENT,
  dashboardAccountValue,
  getDashboardAccountSelection,
  parseDashboardAccountValue,
  saveDashboardAccountSelection,
  type DashboardAccountSelection,
} from '../../services/dashboard/dashboardAccountSelection'
import './ProductHeader.css'
import AccountPicker, { type AccountPickerOption } from './AccountPicker'
import type { BacktestSession } from '../../types/backtester'
import {
  DASHBOARD_REPLAY_CHANGED_EVENT,
  loadDashboardReplaySessions,
} from '../../services/dashboard/dashboardReplayData'

type NavItem = {
  id: string
  label: string
  path: string
  matches: string[]
  icon: LucideIcon
  adminOnly?: boolean
}

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { id: 'dashboard', label: 'Overview', path: ROUTES.DASHBOARD, matches: [ROUTES.HOME, ROUTES.DASHBOARD], icon: BarChart3 },
      { id: 'accounts', label: 'Account manager', path: ROUTES.PRACTICE_ACCOUNTS, matches: [ROUTES.PRACTICE_ACCOUNTS], icon: Wallet },
    ],
  },
  {
    label: 'Trading',
    items: [
      { id: 'practice', label: 'Practice', path: ROUTES.PRACTICE, matches: [ROUTES.PRACTICE, ROUTES.PRACTICE_TRADE], icon: CandlestickChart },
      { id: 'live', label: 'Live', path: ROUTES.TRADE, matches: [ROUTES.TRADE], icon: Activity },
      { id: 'replay', label: 'Replay', path: ROUTES.BACKTESTER, matches: [ROUTES.BACKTESTER], icon: Rewind },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'journal', label: 'Journal & Trade Log', path: ROUTES.JOURNAL, matches: [ROUTES.JOURNAL], icon: BookOpen },
      { id: 'analytics', label: 'Playbooks & Analytics', path: ROUTES.ANALYTICS, matches: [ROUTES.ANALYTICS], icon: Beaker },
      { id: 'news', label: 'News Calendar', path: ROUTES.NEWS, matches: [ROUTES.NEWS], icon: Newspaper },
      { id: 'settings', label: 'Settings', path: ROUTES.SETTINGS, matches: [ROUTES.SETTINGS], icon: Settings },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'admin-users', label: 'Users', path: ROUTES.USER_MANAGER, matches: [ROUTES.USER_MANAGER], icon: Users, adminOnly: true },
      { id: 'admin-roles', label: 'Roles & permissions', path: ROUTES.PERMISSION_MANAGER, matches: [ROUTES.PERMISSION_MANAGER], icon: Shield, adminOnly: true },
      { id: 'admin-site', label: 'Site settings', path: ROUTES.ADMIN_SETTINGS, matches: [ROUTES.ADMIN_SETTINGS], icon: Settings, adminOnly: true },
    ],
  },
]

const UNITS: { id: DisplayUnit; label: string; compact: string }[] = [
  { id: 'usd', label: 'Dollars', compact: '$' },
  { id: 'r', label: 'R-Multiple', compact: 'R' },
  { id: 'points', label: 'Ticks / Points', compact: 'Pts' },
  { id: 'percent', label: '% Return', compact: '%' },
]

function accountLabel(account: PracticeAccount): string {
  return getPracticeAccountDisplayTitle(account)
}

function routeIsActive(pathname: string, matches: string[]): boolean {
  return matches.some((match) => {
    if (match === ROUTES.HOME) return pathname === ROUTES.HOME
    if (match === ROUTES.PRACTICE) return pathname === ROUTES.PRACTICE
    return pathname === match || pathname.startsWith(`${match}/`)
  })
}

export default function ProductHeader({
  isDark,
  toggleTheme,
  sidebarOnly = false,
  marketDataStatus,
}: {
  isDark: boolean
  toggleTheme: () => void
  /** Render only the desktop navigation rail. Trading terminals supply their own compact utility bar. */
  sidebarOnly?: boolean
  /** A terminal supplies its real stream state instead of probing linked credentials. */
  marketDataStatus?: { label: string; connected: boolean }
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboard = location.pathname === ROUTES.HOME || location.pathname === ROUTES.DASHBOARD
  const isReplayWorkspace = location.pathname === ROUTES.BACKTESTER || location.pathname.startsWith(`${ROUTES.BACKTESTER}/`)
  const validatedAuth = useContext(ValidatedAuthContext)
  const viewActive = useContext(LiveTradeViewActive)
  const { unit, setUnit } = useDisplayUnit()
  const [accounts, setAccounts] = useState(() => getPracticeAccounts())
  const [tradeseaAccounts, setTradeseaAccounts] = useState<TradeseaAccount[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('auren-sidebar-collapsed')
    if (saved != null) return saved === '1'
    return location.pathname.includes('/trade/') || location.pathname === ROUTES.TRADE
  })
  const [providerStatus, setProviderStatus] = useState({ label: 'Market data', connected: false })
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) || getPracticeAccounts()[0]?.id || ''
    } catch {
      return getPracticeAccounts()[0]?.id || ''
    }
  })
  const [dashboardSelection, setDashboardSelection] = useState<DashboardAccountSelection | null>(() =>
    getDashboardAccountSelection()
  )
  const [replaySessions, setReplaySessions] = useState<BacktestSession[]>([])

  useEffect(() => {
    if (sidebarOnly) return
    let active = true
    let requestId = 0
    let observedOwner = getAuthToken()
    const load = async (force = false) => {
      const owner = getAuthToken()
      const request = ++requestId
      if (owner !== observedOwner) {
        observedOwner = owner
        setReplaySessions([])
      }
      if (!owner) { setReplaySessions([]); return }
      const isCurrent = () => active && request === requestId && owner === getAuthToken()
      try {
        const sessions = await loadDashboardReplaySessions({ force })
        if (isCurrent()) setReplaySessions(sessions)
      } catch {
        if (isCurrent()) setReplaySessions([])
      }
    }
    const replayChanged = () => {
      void load()
    }
    void load()
    const unsubscribe = subscribeHeaderWorkspaceData((change) => { if (change === 'all') void load() })
    window.addEventListener(DASHBOARD_REPLAY_CHANGED_EVENT, replayChanged)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener(DASHBOARD_REPLAY_CHANGED_EVENT, replayChanged)
    }
  }, [sidebarOnly])

  useEffect(() => {
    // Terminals render their own account selector; this header only shows the
    // navigation rail, so it must not start a second account-catalog refresh.
    if (sidebarOnly) return
    let active = true
    const sync = () => {
      if (!active) return
      if (!localStorage.getItem('token')) { setAccounts([]); return }
      setAccounts(getPracticeAccounts())
      try {
        const savedId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID)
        if (savedId) setActiveId(savedId)
      } catch {
        // Storage is optional.
      }
    }
    const refresh = () => {
      const owner = localStorage.getItem('token')
      if (!owner) { if (active) setAccounts([]); return }
      const current = () => active && owner === localStorage.getItem('token')
      void refreshHeaderPracticeCatalog().then(() => { if (current()) sync() }).catch((error) => {
        if (current() && !(error instanceof Error && error.name === 'AbortError')) sync()
      })
    }
    refresh()
    const unsubscribe = subscribeHeaderWorkspaceData((change) => { if (change === 'all') refresh() })
    window.addEventListener('practiceAccountsChanged', sync)
    return () => { active = false; unsubscribe(); window.removeEventListener('practiceAccountsChanged', sync) }
  }, [sidebarOnly])

  useEffect(() => {
    if (sidebarOnly || !isDashboard) return
    let active = true
    let requestId = 0
    const loadAccounts = async () => {
      const request = ++requestId
      const owner = localStorage.getItem('token')
      const isCurrent = () => active && request === requestId && owner === localStorage.getItem('token')
      if (!owner) { setTradeseaAccounts([]); return }
      try {
        const response = await tradeseaAPI.getAccounts()
        if (!isCurrent()) return
        const liveAccounts = response.connected && Array.isArray(response.accounts)
          ? response.accounts.filter((account) => !account.isArchived)
          : []
        setTradeseaAccounts(liveAccounts)
        // The dashboard data loader resolves missing selections. The header
        // only reflects it; competing fallback writes restarted that loader.
        setDashboardSelection(getDashboardAccountSelection())
      } catch {
        if (isCurrent()) setTradeseaAccounts([])
      }
    }
    const syncSelection = () => setDashboardSelection(getDashboardAccountSelection())
    void loadAccounts()
    window.addEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, syncSelection)
    window.addEventListener('refreshPropFirms', loadAccounts)
    return () => {
      active = false
      window.removeEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, syncSelection)
      window.removeEventListener('refreshPropFirms', loadAccounts)
    }
  }, [isDashboard, sidebarOnly])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('token')
    if (!token) {
      setIsAdmin(false)
      return
    }
    if (validatedAuth?.token === token) {
      setIsAdmin(validatedAuth.isAdmin)
      return
    }
    void authAPI.validateToken(token)
      .then((response) => {
        if (active && localStorage.getItem('token') === token) setIsAdmin(Boolean(response.user?.isAdmin))
      })
      .catch(() => {
        if (active && localStorage.getItem('token') === token) setIsAdmin(false)
      })
    return () => {
      active = false
    }
  }, [validatedAuth])

  useEffect(() => {
    if (marketDataStatus) return
    let active = true
    let requestId = 0
    const syncProviderStatus = async () => {
      const request = ++requestId
      const owner = localStorage.getItem('token')
      if (!owner) { if (active) setProviderStatus({ label: 'Market data', connected: false }); return }
      const storedId = localStorage.getItem('activePropFirm')
      const firmId = storedId || getPracticeMarketDataSettings().propFirmId
      const config = getPracticePropFirmConfig(firmId)
      const isCurrent = () => active && request === requestId && owner === localStorage.getItem('token')
      try {
        const status = await loadHeaderProviderStatus(firmId)
        if (isCurrent()) setProviderStatus(status)
      } catch (error) {
        if (isCurrent() && !(error instanceof Error && error.name === 'AbortError')) {
          setProviderStatus({ label: `${config.displayName} disconnected`, connected: false })
        }
      }
    }
    void syncProviderStatus()
    const unsubscribe = subscribeHeaderWorkspaceData(() => { void syncProviderStatus() })
    return () => {
      active = false
      unsubscribe()
    }
  }, [Boolean(marketDataStatus)])

  useEffect(() => {
    setProfileOpen(false)
    if (viewActive === false) return
    const route = NAV_GROUPS.flatMap((group) => group.items).find((item) => routeIsActive(location.pathname, item.matches))
    if (route) traceStartup(`route-shell:${route.id}`)
  }, [location.pathname, viewActive])

  useEffect(() => {
    if (!sidebarOpen) return

    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    }

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    return () => {
      html.style.overflow = previous.htmlOverflow
      html.style.overscrollBehavior = previous.htmlOverscrollBehavior
      body.style.overflow = previous.bodyOverflow
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior
    }
  }, [sidebarOpen])

  useEffect(() => {
    const width = collapsed ? '72px' : '248px'
    document.documentElement.style.setProperty('--auren-sidebar-width', width)
    localStorage.setItem('auren-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const activeAccount = useMemo(() => {
    const id = isDashboard && dashboardSelection?.source === 'practice'
      ? dashboardSelection.accountId
      : activeId
    return accounts.find((account) => account.id === id) ?? accounts[0]
  }, [accounts, activeId, dashboardSelection, isDashboard])

  const activeTradeseaAccount = useMemo(
    () => isDashboard && dashboardSelection?.source === 'tradesea'
      ? tradeseaAccounts.find((account) => account.id === dashboardSelection.accountId) ?? null
      : null,
    [dashboardSelection, isDashboard, tradeseaAccounts]
  )

  const accountOptions = useMemo<AccountPickerOption[]>(() => [
    ...(!isReplayWorkspace ? accounts.map((account) => ({
      value: isDashboard ? dashboardAccountValue({ source: 'practice', accountId: account.id }) : account.id,
      label: accountLabel(account),
      group: 'Practice accounts',
      description: `${account.mode === 'eval' ? 'Evaluation' : 'Funded'} · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(account.rules.startingBalance)} plan`,
      status: account.status,
      platform: 'practice' as const,
    })) : []),
    ...(isDashboard ? tradeseaAccounts.map((account) => ({
      value: dashboardAccountValue({ source: 'tradesea', accountId: account.id }),
      label: account.name || account.externalAccountId || account.id,
      group: 'Tradesea accounts',
      description: account.accountType ? `${account.accountType} account` : 'Trading account',
      platform: 'tradesea' as const,
    })) : []),
    ...replaySessions.map((session) => ({
      value: dashboardAccountValue({ source: 'replay', accountId: session.id }),
      label: session.name || 'Replay session',
      group: 'Replay accounts',
      description: [session.symbol, session.startDate].filter(Boolean).join(' · '),
      platform: 'replay' as const,
    })),
  ], [accounts, isDashboard, isReplayWorkspace, tradeseaAccounts, replaySessions])
  const activeReplaySession = replaySessions.find((session) => dashboardSelection?.source === 'replay' && session.id === dashboardSelection.accountId) ?? replaySessions[0]
  const accountPickerValue = isReplayWorkspace
    ? activeReplaySession ? dashboardAccountValue({ source: 'replay', accountId: activeReplaySession.id }) : ''
    : isDashboard
    ? dashboardSelection ? dashboardAccountValue(dashboardSelection) : ''
    : activeAccount?.id ?? ''

  const selectAccount = (id: string) => {
    const replaySelection = parseDashboardAccountValue(id)?.source === 'replay'
    if (isDashboard || replaySelection) {
      const selection = parseDashboardAccountValue(id)
      if (!selection) return
      setDashboardSelection(selection)
      saveDashboardAccountSelection(selection)
      if (selection.source === 'replay') {
        if (!isDashboard && !isReplayWorkspace) navigate(ROUTES.DASHBOARD)
        return
      }
      if (selection.source === 'tradesea') {
        const tradeseaAccount = tradeseaAccounts.find((account) => account.id === selection.accountId)
        if (tradeseaAccount) {
          saveTradeTradeseaAccount(tradeseaAccount.id, tradeseaAccount.name || tradeseaAccount.label)
        }
        return
      }
      id = selection.accountId
    }
    setActiveId(id)
    try {
      localStorage.setItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID, id)
    } catch {
      // Storage is optional.
    }
    window.dispatchEvent(new Event('practiceAccountsChanged'))
  }

  const selectRoute = (path: string) => {
    const route = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.path === path)
    if (route) traceStartup(`route-start:${route.id}`)
    setSidebarOpen(false)
    setProfileOpen(false)
    navigate(path)
  }

  const handleLogout = () => {
    clearAuthToken()
    setProfileOpen(false)
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const displayedProviderStatus = marketDataStatus ?? providerStatus
  const currentNavItem = NAV_GROUPS.flatMap((group) => group.items)
    .find((item) => routeIsActive(location.pathname, item.matches))
  const sidebar = (
    <aside
      aria-label="Primary navigation"
      data-theme={isDark ? 'dark' : 'light'}
      className={`auren-product-sidebar ${sidebarOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
    >
      <div className="auren-sidebar-top">
        <button
          type="button"
          onClick={() => selectRoute(ROUTES.DASHBOARD)}
          aria-label="Auren dashboard"
          className="auren-sidebar-brand"
        >
          <span className="auren-sidebar-brand-mark"><BarChart3 strokeWidth={1.8} aria-hidden /></span>
          <span className="auren-sidebar-wordmark">Auren<span>TRADING WORKSPACE</span></span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          className="auren-shell-icon-button auren-sidebar-mobile-close"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="auren-shell-icon-button auren-sidebar-collapse"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      <nav className="auren-sidebar-navigation">
        {NAV_GROUPS.filter((group) => group.items.some((item) => !item.adminOnly || isAdmin)).map((group) => (
          <div key={group.label ?? 'primary'} className="auren-sidebar-group">
            {group.label ? <p className="auren-sidebar-group-label">{group.label}</p> : null}
            <div className="auren-sidebar-items">
              {group.items.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                const active = routeIsActive(location.pathname, item.matches)
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => selectRoute(item.path)}
                    onPointerEnter={() => prefetchRouteOnIntent(item.path)}
                    onFocus={() => prefetchRouteOnIntent(item.path)}
                    onTouchStart={() => prefetchRouteOnIntent(item.path)}
                    className={`auren-sidebar-nav-item ${active ? 'is-active' : ''} ${item.id === 'dashboard' ? 'is-dashboard' : ''}`}
                  >
                    <Icon className="auren-sidebar-nav-icon" strokeWidth={1.65} aria-hidden />
                    <span className="auren-sidebar-label">{item.label}</span>
                    {active ? <span className="auren-sidebar-active-dot" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="auren-sidebar-bottom">
        <div
          className={`auren-sidebar-connection ${displayedProviderStatus.connected ? 'is-connected' : ''}`}
          title={displayedProviderStatus.label}
        >
          <span className="auren-sidebar-connection-icon"><Wifi strokeWidth={1.75} aria-hidden /></span>
          <span className="auren-sidebar-label auren-sidebar-connection-copy">
            <span>Market connection</span>
            <strong>{displayedProviderStatus.label}</strong>
          </span>
          <span className="auren-sidebar-connection-dot" aria-hidden />
        </div>
        <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="auren-sidebar-theme">
          {isDark ? <Sun strokeWidth={1.75} aria-hidden /> : <Moon strokeWidth={1.75} aria-hidden />}
          <span className="auren-sidebar-label">{isDark ? 'Light appearance' : 'Dark appearance'}</span>
        </button>
      </div>
    </aside>
  )

  if (sidebarOnly) return sidebar

  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
          className="auren-sidebar-overlay"
        />
      ) : null}
      {sidebar}

      <header className="auren-product-header" data-theme={isDark ? 'dark' : 'light'}>
        <div className="auren-product-header-inner">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="auren-shell-icon-button auren-header-mobile-menu"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </button>

          <div className="auren-header-heading">
            <span>Workspace</span>
            <strong>{currentNavItem?.label || 'Auren'}</strong>
          </div>

          <AccountPicker
            key={location.pathname}
            options={accountOptions}
            value={accountPickerValue}
            onChange={(id) => { if (id !== accountPickerValue) selectAccount(id) }}
            emptyLabel={isReplayWorkspace ? 'Select replay account' : isDashboard ? 'Select account' : 'No practice account'}
          />

          {isReplayWorkspace || isDashboard && dashboardSelection?.source === 'replay' ? (
            <span className="auren-header-status is-provider">Replay</span>
          ) : activeTradeseaAccount ? (
            <span className="auren-header-status is-provider">
              Tradesea
            </span>
          ) : activeAccount ? (
            <span className={`auren-header-status is-${activeAccount.status}`}>
              <span aria-hidden />{activeAccount.status}
            </span>
          ) : null}

          <div className="auren-header-units" aria-label="Display unit">
            {UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setUnit(item.id)}
                aria-pressed={unit === item.id}
                className={unit === item.id ? 'is-active' : ''}
                title={item.label}
              >
                {item.compact}
              </button>
            ))}
          </div>

          <div className="auren-header-profile">
            <button
              type="button"
              aria-label="Profile"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
              className="auren-header-profile-button"
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </button>
            {profileOpen ? (
              <div role="menu" className="auren-header-profile-menu">
                <p>YOUR WORKSPACE</p>
                <button type="button" role="menuitem" onClick={() => selectRoute(ROUTES.SETTINGS)}>
                  <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />Account settings
                </button>
                <button type="button" role="menuitem" onClick={() => selectRoute(ROUTES.PROPS_SETTINGS)}>
                  <Wifi className="h-4 w-4" strokeWidth={1.75} aria-hidden />Connections
                </button>
                <div className="auren-header-menu-divider" />
                <button type="button" role="menuitem" onClick={handleLogout} className="is-danger">
                  <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  )
}
