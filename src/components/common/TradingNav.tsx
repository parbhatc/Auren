import { Component } from 'react'
import { BarChart3, TrendingUp, ChevronLeft, Newspaper, PanelRight } from 'lucide-react'
import { ROUTES, practiceTradePath, practiceTradeStatsPath, practiceTradeNewsPath } from '../../constants/routes'
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
    const isPracticeHub = currentPath === ROUTES.HOME
    const practiceAccount = practiceAccountId ? getPracticeAccountById(practiceAccountId) : null
    const isTerminalPracticeAccount =
      practiceAccount?.status === 'blown' || practiceAccount?.status === 'passed'

    const practiceNavItems =
      isPracticeTrade && practiceAccountId
        ? [
            { path: practiceTradePath(practiceAccountId), label: 'Chart', icon: BarChart3 },
            { path: practiceTradeStatsPath(practiceAccountId), label: 'Stats', icon: TrendingUp },
            { path: practiceTradeNewsPath(practiceAccountId), label: 'News', icon: Newspaper },
          ]
        : []

    const navItems = isPracticeTrade
      ? isTerminalPracticeAccount
        ? practiceNavItems.filter((item) => item.label !== 'Chart')
        : practiceNavItems
      : [{ path: ROUTES.HOME, label: 'Hub', icon: BarChart3 }]

    const isActive = (path: string) => {
      if (isPracticeTrade && practiceAccountId) {
        if (path === practiceTradeStatsPath(practiceAccountId)) {
          return currentPath.endsWith('/stats')
        }
        if (path === practiceTradeNewsPath(practiceAccountId)) {
          return currentPath.endsWith('/news')
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
      const accent = isDark ? 'text-violet-400' : 'text-violet-600'
      const idle = isDark ? 'text-slate-500 active:text-slate-300' : 'text-slate-500 active:text-slate-700'
      return `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-px py-1 transition-colors ${
        active ? accent : idle
      }`
    }

    // Mobile Bottom Nav — compact tab bar
    const bottomNav = showMobileNav ? (
      <nav
        className={`lg:hidden fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-md transition-all duration-300 ease-in-out ${
          showMobileNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        } ${
          isDark ? 'border-slate-800/90 bg-slate-950/92' : 'border-slate-200/90 bg-white/92'
        } pb-[max(0.25rem,env(safe-area-inset-bottom))]`}
        aria-label="Practice navigation"
      >
        <div className="flex h-11 max-h-11 items-stretch px-0.5">
          {onToggleNav && (
            <button
              type="button"
              onClick={onToggleNav}
              className={mobileTabClass(false)}
              title="Hide navigation"
              aria-label="Hide navigation"
            >
              <ChevronLeft className="h-[18px] w-[18px] rotate-90 shrink-0" strokeWidth={2} />
              <span className="max-w-full truncate text-[9px] font-medium leading-none">Hide</span>
            </button>
          )}
          {navItems.map((item) => {
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
                {active ? (
                  <span
                    className={`absolute top-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full ${
                      isDark ? 'bg-violet-400' : 'bg-violet-600'
                    }`}
                  />
                ) : null}
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} />
                <span className="max-w-full truncate text-[9px] font-medium leading-none">{item.label}</span>
              </button>
            )
          })}
          {isPracticeTrade && onPracticeOrder && !isTerminalPracticeAccount && (
            <button
              type="button"
              onClick={onPracticeOrder}
              className={mobileTabClass(practiceOrderActive)}
              aria-label="Trade panel"
              aria-pressed={practiceOrderActive}
            >
              {practiceOrderActive ? (
                <span
                  className={`absolute top-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full ${
                    isDark ? 'bg-violet-400' : 'bg-violet-600'
                  }`}
                />
              ) : null}
              <PanelRight className="h-[18px] w-[18px] shrink-0" strokeWidth={practiceOrderActive ? 2.25 : 2} />
              <span className="max-w-full truncate text-[9px] font-medium leading-none">Order</span>
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

