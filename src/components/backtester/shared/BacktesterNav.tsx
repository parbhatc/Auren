import { LogOut, Home } from 'lucide-react'
import Logo from '../../common/Logo'
import { HeaderThemeButton } from '../../trading/shared/header/HeaderThemeButton'
import { ROUTES } from '../../../constants/routes'
import { tabRailActiveClass, tabRailClass } from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'

export type BacktesterTab = 'sessions' | 'stats' | 'data'

const TABS: { id: BacktesterTab; labelKey: string; route: string; adminOnly?: boolean }[] = [
  { id: 'sessions', labelKey: 'replay.hub.mode', route: '/?mode=replay' },
  { id: 'stats', labelKey: 'replay.nav.stats', route: ROUTES.BACKTESTER_STATS },
  { id: 'data', labelKey: 'replay.nav.data', route: ROUTES.BACKTESTER_DATA_MANAGEMENT, adminOnly: true },
]

function tabLabel(key: string, fallback: string): string {
  const translated = t(key)
  return translated === key ? fallback : translated
}

function BacktesterTabRail({
  activeTab,
  onTabChange,
  isDark,
  showAdmin,
  className = '',
}: {
  activeTab: BacktesterTab
  onTabChange: (tab: BacktesterTab, route: string) => void
  isDark: boolean
  showAdmin: boolean
  className?: string
}) {
  const tabs = TABS.filter((tab) => !tab.adminOnly || showAdmin)

  return (
    <div className={`${tabRailClass(isDark)} ${className}`}>
      {tabs.map(({ id, labelKey, route }) => {
        const active = activeTab === id
        const tone = id === 'data' ? 'amber' : 'violet'
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id, route)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              active
                ? tabRailActiveClass(isDark, tone)
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tabLabel(labelKey, id.charAt(0).toUpperCase() + id.slice(1))}
          </button>
        )
      })}
    </div>
  )
}

export default function BacktesterNav({
  isDark,
  toggleTheme,
  navigate,
  activeTab,
  showAdmin = false,
  onLogout,
}: {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  activeTab: BacktesterTab
  showAdmin?: boolean
  onLogout?: () => void
}) {
  const shell = isDark
    ? 'border-slate-800/80 bg-slate-950/80 backdrop-blur-xl'
    : 'border-slate-200/80 bg-white/80 backdrop-blur-xl'

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
      return
    }
    localStorage.removeItem('token')
    navigate(ROUTES.LOGIN)
  }

  return (
    <div className={`sticky top-0 z-50 border-b ${shell}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <header className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={() => navigate('/?mode=replay')}
            className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Logo isDark={isDark} compact size="sm" />
          </button>

          <nav className="hidden sm:flex flex-1 justify-center min-w-0" aria-label="Backtester sections">
            <BacktesterTabRail
              activeTab={activeTab}
              onTabChange={(_tab, route) => navigate(route)}
              isDark={isDark}
              showAdmin={showAdmin}
            />
          </nav>

          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => navigate(ROUTES.HOME)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isDark
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={t('practice.hub.nav.accounts')}
            >
              <Home className="w-4 h-4" aria-hidden />
              {tabLabel('replay.nav.practice', 'Practice')}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
              }`}
              aria-label={t('common.logout')}
              title={t('common.logout')}
            >
              <LogOut className="w-4 h-4" aria-hidden />
            </button>
            <HeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
          </div>
        </header>

        <nav className="sm:hidden pb-3" aria-label="Backtester sections">
          <BacktesterTabRail
            activeTab={activeTab}
            onTabChange={(_tab, route) => navigate(route)}
            isDark={isDark}
            showAdmin={showAdmin}
          />
        </nav>
      </div>
    </div>
  )
}
