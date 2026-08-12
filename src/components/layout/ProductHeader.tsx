import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Beaker,
  BookOpen,
  CandlestickChart,
  ChevronDown,
  Database,
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
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../constants/practice'
import { ROUTES } from '../../constants/routes'
import { useDisplayUnit, type DisplayUnit } from '../../contexts/DisplayUnitContext'
import Logo from '../common/Logo'
import { tradeseaAPI } from '../../api/tradesea.api'
import { authAPI } from '../../api/auth.api'

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
      { id: 'dashboard', label: 'Dashboard', path: ROUTES.DASHBOARD, matches: [ROUTES.HOME, ROUTES.DASHBOARD], icon: BarChart3 },
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
      { id: 'admin-csv', label: 'CSV data', path: ROUTES.BACKTESTER_DATA_MANAGEMENT, matches: [ROUTES.BACKTESTER_DATA_MANAGEMENT], icon: Database, adminOnly: true },
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
    return pathname === match || pathname.startsWith(`${match}/`)
  })
}

export default function ProductHeader({
  isDark,
  toggleTheme,
  sidebarOnly = false,
}: {
  isDark: boolean
  toggleTheme: () => void
  /** Render only the desktop navigation rail. Trading terminals supply their own compact utility bar. */
  sidebarOnly?: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { unit, setUnit } = useDisplayUnit()
  const [accounts, setAccounts] = useState(() => getPracticeAccounts())
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

  useEffect(() => {
    const sync = () => setAccounts(getPracticeAccounts())
    void refreshPracticeFromApi().then(sync).catch(sync)
    window.addEventListener('practiceAccountsChanged', sync)
    return () => window.removeEventListener('practiceAccountsChanged', sync)
  }, [])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('token')
    if (!token) return
    void authAPI.validateToken(token)
      .then((response) => {
        if (active) setIsAdmin(Boolean(response.user?.isAdmin))
      })
      .catch(() => {
        if (active) setIsAdmin(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const syncProviderStatus = async () => {
      const storedId = localStorage.getItem('activePropFirm')
      const firmId = storedId || getPracticeMarketDataSettings().propFirmId
      const config = getPracticePropFirmConfig(firmId)
      if (config.id === 'tradingview') {
        if (active) setProviderStatus({ label: 'TradingView connected', connected: true })
        return
      }
      if (config.id === 'tradesea') {
        try {
          const status = await tradeseaAPI.getConnectionStatus()
          if (active) setProviderStatus({
            label: status.connected ? 'Tradesea connected' : 'Tradesea disconnected',
            connected: Boolean(status.connected),
          })
        } catch {
          if (active) setProviderStatus({ label: 'Tradesea disconnected', connected: false })
        }
        return
      }
      if (active) setProviderStatus({ label: `${config.displayName} connected`, connected: true })
    }
    void syncProviderStatus()
    const sync = () => void syncProviderStatus()
    window.addEventListener('activePropFirmChanged', sync)
    window.addEventListener('practiceSettingsChanged', sync)
    window.addEventListener('refreshPropFirms', sync)
    return () => {
      active = false
      window.removeEventListener('activePropFirmChanged', sync)
      window.removeEventListener('practiceSettingsChanged', sync)
      window.removeEventListener('refreshPropFirms', sync)
    }
  }, [])

  useEffect(() => {
    setProfileOpen(false)
  }, [location.pathname])

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
    const width = collapsed ? '64px' : '232px'
    document.documentElement.style.setProperty('--auren-sidebar-width', width)
    localStorage.setItem('auren-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeId) ?? accounts[0],
    [accounts, activeId]
  )

  const selectAccount = (id: string) => {
    setActiveId(id)
    try {
      localStorage.setItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID, id)
    } catch {
      // Storage is optional.
    }
    window.dispatchEvent(new Event('practiceAccountsChanged'))
  }

  const selectRoute = (path: string) => {
    setSidebarOpen(false)
    setProfileOpen(false)
    navigate(path)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setProfileOpen(false)
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const sidebar = (
    <aside
      aria-label="Primary navigation"
      className={`auren-product-sidebar fixed inset-y-0 left-0 z-[70] flex w-[232px] flex-col border-r transition-[width,transform] duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'lg:w-16' : 'lg:w-[232px]'} ${
        isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-white'
      }`}
    >
      <div
        className={`flex h-16 items-center border-b px-3 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
          isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'
        }`}
      >
        <button
          type="button"
          onClick={() => selectRoute(ROUTES.DASHBOARD)}
          className={`min-w-0 flex-1 overflow-hidden ${collapsed ? 'lg:hidden' : ''}`}
        >
          <Logo isDark={isDark} compact size="sm" />
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          className={`ml-2 rounded-md p-1.5 lg:hidden ${isDark ? 'text-[#A1A1AA] hover:bg-[#18181B]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden rounded-md p-1.5 lg:inline-flex ${collapsed ? 'lg:mx-auto' : 'ml-2'} ${
            isDark ? 'text-[#A1A1AA] hover:bg-[#18181B]' : 'text-[#52525B] hover:bg-[#F4F4F5]'
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_GROUPS.filter((group) => group.items.some((item) => !item.adminOnly || isAdmin)).map((group, groupIndex) => (
          <div key={group.label ?? 'primary'} className={groupIndex === 0 ? '' : 'mt-4'}>
            {group.label ? (
              <p
                className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  collapsed ? 'lg:hidden' : ''
                } ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}
              >
                {group.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                const active = routeIsActive(location.pathname, item.matches)
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    onClick={() => selectRoute(item.path)}
                    className={`group relative flex h-10 w-full items-center overflow-hidden rounded-lg px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] ${
                      collapsed ? 'lg:justify-center lg:px-0' : ''
                    } ${
                      active
                        ? isDark
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-blue-50 text-blue-700'
                        : isDark
                          ? 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]'
                          : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
                    }`}
                  >
                    {active ? (
                      <span
                        className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-600'}`}
                        aria-hidden
                      />
                    ) : null}
                    <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105" strokeWidth={1.75} aria-hidden />
                    <span className={`ml-3 truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`space-y-1 border-t p-2 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
        <div
          className={`flex h-10 items-center rounded-md px-3 text-sm ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
            isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
          }`}
          title={providerStatus.label}
        >
          <Wifi
            className={`h-[18px] w-[18px] shrink-0 ${providerStatus.connected ? 'text-emerald-500' : 'text-amber-500'}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className={`ml-3 truncate ${collapsed ? 'lg:hidden' : ''}`}>{providerStatus.label}</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={`flex h-10 w-full items-center rounded-md px-3 text-sm font-medium ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
            isDark ? 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
          }`}
        >
          {isDark ? (
            <Sun className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
          )}
          <span className={`ml-3 truncate ${collapsed ? 'lg:hidden' : ''}`}>{isDark ? 'Light mode' : 'Dark mode'}</span>
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
          className="fixed inset-0 z-[60] bg-black/55 lg:hidden"
        />
      ) : null}
      {sidebar}

      <header
        className={`sticky top-0 z-50 border-b ${
          isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-white'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border lg:hidden ${
              isDark ? 'border-[#27272A] text-[#A1A1AA]' : 'border-[#E4E4E7] text-[#52525B]'
            }`}
          >
            <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>

          <label className="relative min-w-0 flex-1 sm:max-w-[260px]">
            <span className="sr-only">Active account</span>
            <select
              value={activeAccount?.id ?? ''}
              onChange={(event) => selectAccount(event.target.value)}
              className={`h-9 w-full appearance-none truncate rounded-lg border py-0 pl-3 pr-8 text-xs font-medium outline-none focus:border-blue-500 sm:text-sm ${
                isDark
                  ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]'
                  : 'border-[#E4E4E7] bg-white text-[#09090B]'
              }`}
            >
              {accounts.length === 0 ? <option value="">No practice account</option> : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-[#A1A1AA]" strokeWidth={1.75} aria-hidden />
          </label>

          {activeAccount ? (
            <span
              className={`hidden rounded-md border px-2 py-1 text-[11px] font-semibold capitalize sm:inline-flex ${
                activeAccount.status === 'active'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                  : activeAccount.status === 'passed'
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                    : 'border-red-500/30 bg-red-500/10 text-red-500'
              }`}
            >
              {activeAccount.status}
            </span>
          ) : null}

          <div
            className={`ml-auto flex shrink-0 items-center rounded-lg border p-0.5 ${
              isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#F4F4F5]'
            }`}
            aria-label="Display unit"
          >
            {UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setUnit(item.id)}
                className={`h-7 min-w-7 rounded-md px-1.5 text-[10px] font-semibold sm:px-2 ${
                  unit === item.id
                    ? isDark
                      ? 'bg-[#FAFAFA] text-[#09090B]'
                      : 'bg-[#18181B] text-white'
                    : isDark
                      ? 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      : 'text-[#52525B] hover:text-[#09090B]'
                }`}
                title={item.label}
              >
                {item.compact}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Profile"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                isDark
                  ? 'border-[#3F3F46] bg-[#18181B] text-[#A1A1AA]'
                  : 'border-[#E4E4E7] bg-white text-[#52525B]'
              }`}
            >
              <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
            {profileOpen ? (
              <div
                role="menu"
                className={`absolute right-0 top-10 z-[80] w-52 rounded-lg border p-1 ${
                  isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectRoute(ROUTES.SETTINGS)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    isDark ? 'text-[#FAFAFA] hover:bg-[#27272A]' : 'text-[#09090B] hover:bg-[#F4F4F5]'
                  }`}
                >
                  <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Account settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectRoute(ROUTES.PROPS_SETTINGS)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    isDark ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
                  }`}
                >
                  <Wifi className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Market data
                </button>
                <div className={`my-1 border-t ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`} />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    isDark
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  )
}
