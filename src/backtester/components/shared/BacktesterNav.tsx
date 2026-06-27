import { Component } from 'react'
import { BarChart3, TrendingUp, Home, RotateCcw } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { TradingNavProps } from '../../../types/common'

/**
 * Backtester Navigation Component
 * Sidebar navigation for large devices, bottom nav for small devices
 */
class BacktesterNav extends Component<TradingNavProps> {
  render() {
    const { isDark, navigate, currentPath } = this.props

    const navItems = [
      { path: ROUTES.BACKTESTER_CHART, label: 'Chart', icon: BarChart3 },
      { path: ROUTES.BACKTESTER_STATS, label: 'Stats', icon: TrendingUp },
      { path: ROUTES.BACKTESTER, label: 'Sessions', icon: RotateCcw },
      { path: ROUTES.HOME, label: 'Home', icon: Home },
    ]

    const isActive = (path: string) => currentPath === path

    // Desktop Sidebar (left)
    const sidebar = (
      <nav
        className={`hidden lg:flex flex-col w-20 xl:w-24 border-r ${
          isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white/80'
        }`}
      >
        <div className="flex flex-col items-center py-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex flex-col items-center gap-1 px-2 py-3 rounded-lg transition-all group ${
                  active
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    )

    // Mobile Bottom Nav
    const bottomNav = (
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 border-t ${
          isDark ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'
        } backdrop-blur-sm z-50`}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all min-w-[60px] ${
                  active
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDark
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    )

    return (
      <>
        {sidebar}
        {bottomNav}
      </>
    )
  }
}

export default BacktesterNav

