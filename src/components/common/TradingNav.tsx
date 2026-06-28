import { Component, type ReactNode } from 'react'
import { BarChart3, ChevronDown, ChevronLeft, Home, PanelRight, Settings2, TrendingUp } from 'lucide-react'
import { ROUTES, practiceTradePath, practiceTradeStatsPath } from '../../constants/routes'
import { getPracticeAccountById } from '../../constants/practice'
import { TradingNavProps } from '../../types/common'
import { isPwaPinnedNav } from '../../utils/pwa'

/**
 * Trading Navigation Component
 * Sidebar navigation for large devices, bottom nav for small devices
 */
class TradingNav extends Component<TradingNavProps> {
  render() {
    const {
      isDark,
      navigate,
      currentPath,
      onToggleNav,
      preserveQueryParams,
      showDesktopNav = true,
      showMobileNav = true,
      compact = false,
      onPracticeOrder,
      practiceOrderActive = false,
      onPracticeSettings,
      practiceSettingsActive = false,
      showMobileSettings = false,
      mobileHomePath = ROUTES.HOME,
    } = this.props

    const handleNavigate = (path: string) => {
      if (preserveQueryParams && window.location.search) {
        navigate(`${path}${window.location.search}`)
      } else {
        navigate(path)
      }
    }

    const practiceTradeMatch = currentPath.match(/^\/practice\/trade\/([^/]+)/)
    const practiceAccountId = practiceTradeMatch?.[1]
    const isPracticeTrade = Boolean(practiceAccountId)
    const isLiveTrade = currentPath === ROUTES.TRADE
    const isPracticeHub = currentPath === ROUTES.HOME
    const practiceAccount = practiceAccountId ? getPracticeAccountById(practiceAccountId) : null
    const isTerminalPracticeAccount =
      practiceAccount?.status === 'blown' || practiceAccount?.status === 'passed'

    const practiceNavItems =
      isPracticeTrade && practiceAccountId
        ? [
            { path: practiceTradePath(practiceAccountId), label: 'Chart', icon: BarChart3 },
            { path: practiceTradeStatsPath(practiceAccountId), label: 'Stats', icon: TrendingUp },
          ]
        : []

    const navItems = isPracticeTrade
      ? isTerminalPracticeAccount
        ? practiceNavItems.filter((item) => item.label !== 'Chart')
        : practiceNavItems
      : isLiveTrade
        ? [{ path: ROUTES.TRADE, label: 'Chart', icon: BarChart3 }]
        : [{ path: ROUTES.HOME, label: 'Hub', icon: BarChart3 }]

    const isActive = (path: string) => {
      if (isLiveTrade && path === ROUTES.TRADE) {
        return currentPath === ROUTES.TRADE
      }
      if (isPracticeTrade && practiceAccountId) {
        if (path === practiceTradeStatsPath(practiceAccountId)) {
          return currentPath.endsWith('/stats')
        }
        if (path === practiceTradePath(practiceAccountId)) {
          return (
            currentPath.startsWith(practiceTradePath(practiceAccountId)) &&
            !currentPath.endsWith('/stats') &&
            !currentPath.endsWith('/news') &&
            !currentPath.endsWith('/pad')
          )
        }
      }
      return currentPath === path
    }

    // Desktop Sidebar (left)
    const sidebar = showDesktopNav ? (
      <nav
        className={`hidden lg:flex flex-col border-r sticky top-0 self-start transition-all duration-300 ease-in-out ${
          compact ? 'w-11' : 'w-16'
        } ${isDark ? 'border-slate-700 bg-slate-950/95' : 'border-slate-200 bg-white/80'}`}
        style={{ height: '100vh', overflowY: 'auto' }}
      >
        <div className="flex flex-col items-center w-full">
          {onToggleNav && (
            <div
              className={`w-full border-b flex items-center justify-center ${
                isDark ? 'border-slate-700' : 'border-slate-200'
              } ${compact ? 'h-10' : 'h-14 sm:h-16'}`}
            >
              <button
                onClick={onToggleNav}
                className={`flex items-center justify-center p-1.5 rounded transition-all ${
                  isDark ? 'hover:bg-slate-900 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                }`}
                title="Hide Navigation"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className={`flex flex-col items-center w-full ${compact ? 'py-1 gap-0.5' : 'py-2 space-y-1'}`}>
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center justify-center transition-all ${
                    compact
                      ? `h-9 ${
                          active
                            ? isDark
                              ? 'text-violet-400 bg-slate-900'
                              : 'text-violet-600 bg-violet-50'
                            : isDark
                              ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                              : 'text-slate-500 hover:bg-slate-100'
                        }`
                      : `flex-col gap-1 px-2 py-2 rounded-lg ${
                          active
                            ? isDark
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500 text-white'
                            : isDark
                              ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4" />
                  {!compact && <span className="text-[10px] font-medium">{item.label}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    ) : null

    const pwaNav = isPwaPinnedNav()

    const mobileTabClass = (active: boolean) => {
      const base = pwaNav
        ? 'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 transition-colors'
        : 'relative flex h-full min-w-0 flex-1 items-center justify-center rounded-md transition-colors'
      if (active) {
        return `${base} ${isDark ? 'text-violet-400' : 'text-violet-600'}`
      }
      return `${base} ${isDark ? 'text-slate-500 active:text-slate-300' : 'text-slate-500 active:text-slate-700'}`
    }

    const mobileTabLabel = 'max-w-[3.25rem] truncate text-[9px] font-medium leading-none'

    const isHomeActive = currentPath === ROUTES.HOME || currentPath.startsWith(`${ROUTES.HOME}?`)

    const mobileShell = isDark
      ? 'border-slate-800/80 bg-slate-950'
      : 'border-slate-200/90 bg-white'

    const mobileDivider = isDark ? 'bg-slate-700/60' : 'bg-slate-200'

    const renderMobileTab = (
      key: string,
      label: string,
      icon: ReactNode,
      onClick: () => void,
      active: boolean,
      options?: { pressed?: boolean }
    ) => (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className={mobileTabClass(active)}
        aria-label={label}
        title={label}
        aria-current={active ? 'page' : undefined}
        aria-pressed={options?.pressed}
      >
        {active ? (
          <span
            className={`absolute left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full ${
              pwaNav ? 'top-0.5' : 'bottom-1'
            } ${isDark ? 'bg-violet-400' : 'bg-violet-600'}`}
            aria-hidden
          />
        ) : null}
        {icon}
        {pwaNav ? <span className={mobileTabLabel}>{label}</span> : null}
      </button>
    )

    // Mobile Bottom Nav (positioned by .auren-mobile-bottom-bar wrapper)
    const bottomNav = showMobileNav ? (
      <nav
        className={`lg:hidden w-full border-t pb-[env(safe-area-inset-bottom,0px)] ${mobileShell}`}
        aria-label="Practice navigation"
      >
        <div
          className={`flex items-stretch px-1 ${
            pwaNav ? 'h-[3.25rem] max-h-[3.25rem]' : 'h-10 max-h-10'
          }`}
        >
          {onToggleNav && !pwaNav ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleNav()
                }}
                className={`flex h-full w-11 shrink-0 items-center justify-center rounded-md transition-colors ${
                  isDark
                    ? 'text-slate-500 active:bg-white/5 active:text-slate-300'
                    : 'text-slate-500 active:bg-slate-100 active:text-slate-700'
                }`}
                aria-label="Hide navigation"
                title="Hide navigation"
              >
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
              </button>
              <div
                className={`my-2 w-px shrink-0 ${mobileDivider}`}
                aria-hidden
              />
            </>
          ) : null}

          <div className="flex min-w-0 flex-1 items-stretch">
            {(isPracticeTrade || isLiveTrade) &&
              renderMobileTab(
                'home',
                'Home',
                <Home className="h-4 w-4 shrink-0" strokeWidth={isHomeActive ? 2.25 : 2} />,
                () => handleNavigate(mobileHomePath),
                isHomeActive
              )}
            {navItems
              .filter((item) => item.label !== 'Stats')
              .map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return renderMobileTab(
                  item.path,
                  item.label,
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 2} />,
                  () => handleNavigate(item.path),
                  active
                )
              })}
            {(isPracticeTrade || isLiveTrade) && onPracticeOrder && !isTerminalPracticeAccount &&
              renderMobileTab(
                'order',
                'Order',
                <PanelRight
                  className="h-4 w-4 shrink-0"
                  strokeWidth={practiceOrderActive ? 2.25 : 2}
                />,
                onPracticeOrder,
                practiceOrderActive,
                { pressed: practiceOrderActive }
              )}
            {showMobileSettings && onPracticeSettings &&
              renderMobileTab(
                'settings',
                'Settings',
                <Settings2
                  className="h-4 w-4 shrink-0"
                  strokeWidth={practiceSettingsActive ? 2.25 : 2}
                />,
                onPracticeSettings,
                practiceSettingsActive,
                { pressed: practiceSettingsActive }
              )}
          </div>
        </div>
      </nav>
    ) : null

    return (
      <>
        {sidebar}
        {bottomNav}
      </>
    )
  }
}

export default TradingNav

