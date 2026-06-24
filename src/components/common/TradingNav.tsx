import { Component } from 'react'
import { BarChart3, ChevronLeft, Home, PanelRight, Settings2, TrendingUp } from 'lucide-react'
import { ROUTES, practiceTradePath, practiceTradeStatsPath } from '../../constants/routes'
import { getPracticeAccountById } from '../../constants/practice'
import { TradingNavProps } from '../../types/common'

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

    const mobileTabClass = (active: boolean) => {
      const base =
        'relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-md mx-px py-0.5 transition-colors'
      if (active) {
        return `${base} ${isDark ? 'bg-violet-500/12 text-violet-400' : 'bg-violet-100 text-violet-600'}`
      }
      return `${base} ${isDark ? 'text-slate-500 active:text-slate-300' : 'text-slate-500 active:text-slate-700'}`
    }

    const isHomeActive = currentPath === ROUTES.HOME || currentPath.startsWith(`${ROUTES.HOME}?`)

    // Mobile Bottom Nav — compact tab bar
    const bottomNav = showMobileNav ? (
      <nav
        className={`lg:hidden fixed inset-x-0 bottom-0 z-50 border-t transition-all duration-300 ease-in-out ${
          showMobileNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        } ${
          isDark ? 'border-slate-800/80 bg-slate-950/96' : 'border-slate-200/90 bg-white/96'
        } pb-[max(0px,env(safe-area-inset-bottom))]`}
        aria-label="Practice navigation"
      >
        <div className="flex h-9 max-h-9 items-stretch px-1">
          {(isPracticeTrade || isLiveTrade) && (
            <button
              type="button"
              onClick={() => handleNavigate(mobileHomePath)}
              className={mobileTabClass(isHomeActive)}
              aria-label="Home"
              aria-current={isHomeActive ? 'page' : undefined}
            >
              <Home className="h-4 w-4 shrink-0" strokeWidth={isHomeActive ? 2.25 : 2} />
              <span className="max-w-full truncate text-[8px] font-medium leading-none">Home</span>
            </button>
          )}
          {navItems
            .filter((item) => item.label !== 'Stats')
            .map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={mobileTabClass(active)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 2} />
                <span className="max-w-full truncate text-[8px] font-medium leading-none">{item.label}</span>
              </button>
            )
          })}
          {(isPracticeTrade || isLiveTrade) && onPracticeOrder && !isTerminalPracticeAccount && (
            <button
              type="button"
              onClick={onPracticeOrder}
              className={mobileTabClass(practiceOrderActive)}
              aria-label="Trade panel"
              aria-pressed={practiceOrderActive}
            >
              <PanelRight className="h-4 w-4 shrink-0" strokeWidth={practiceOrderActive ? 2.25 : 2} />
              <span className="max-w-full truncate text-[8px] font-medium leading-none">Order</span>
            </button>
          )}
          {showMobileSettings && onPracticeSettings && (
            <button
              type="button"
              onClick={onPracticeSettings}
              className={mobileTabClass(practiceSettingsActive)}
              aria-label="Settings"
              aria-pressed={practiceSettingsActive}
            >
              <Settings2 className="h-4 w-4 shrink-0" strokeWidth={practiceSettingsActive ? 2.25 : 2} />
              <span className="max-w-full truncate text-[8px] font-medium leading-none">Settings</span>
            </button>
          )}
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

