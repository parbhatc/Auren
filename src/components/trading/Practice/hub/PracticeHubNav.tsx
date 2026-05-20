import { LogOut } from 'lucide-react'
import { t } from '../../../../utils/translator'
import Logo from '../../../common/Logo'
import { PracticeHeaderThemeButton } from '../PracticeHeaderThemeButton'

export type PracticeHubTab = 'accounts' | 'market' | 'settings'

const TABS: { id: PracticeHubTab; labelKey: string }[] = [
  { id: 'accounts', labelKey: 'practice.hub.nav.accounts' },
  { id: 'market', labelKey: 'practice.hub.nav.market' },
  { id: 'settings', labelKey: 'practice.hub.nav.settings' },
]

function HubTabRail({
  activeTab,
  onTabChange,
  isDark,
  className = '',
}: {
  activeTab: PracticeHubTab
  onTabChange: (tab: PracticeHubTab) => void
  isDark: boolean
  className?: string
}) {
  return (
    <div
      className={`inline-flex w-full sm:w-auto p-1 rounded-xl gap-0.5 ${
        isDark ? 'bg-slate-900/90 ring-1 ring-slate-800' : 'bg-slate-100/90 ring-1 ring-slate-200/80'
      } ${className}`}
    >
      {TABS.map(({ id, labelKey }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              active
                ? isDark
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                  : 'bg-white text-violet-700 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}

export default function PracticeHubNav({
  isDark,
  toggleTheme,
  activeTab,
  onTabChange,
  onLogout,
}: {
  isDark: boolean
  toggleTheme: () => void
  activeTab: PracticeHubTab
  onTabChange: (tab: PracticeHubTab) => void
  onLogout: () => void
}) {
  const shell = isDark
    ? 'border-slate-800/80 bg-slate-950/80 backdrop-blur-xl'
    : 'border-slate-200/80 bg-white/80 backdrop-blur-xl'

  return (
    <div className={`sticky top-0 z-50 border-b ${shell}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <header className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={() => onTabChange('accounts')}
            className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Logo isDark={isDark} compact size="sm" />
          </button>

          <nav
            className="hidden sm:flex flex-1 justify-center min-w-0"
            aria-label="Hub sections"
          >
            <HubTabRail activeTab={activeTab} onTabChange={onTabChange} isDark={isDark} />
          </nav>

          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onLogout}
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
            <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
          </div>
        </header>

        <nav className="sm:hidden pb-3" aria-label="Hub sections">
          <HubTabRail activeTab={activeTab} onTabChange={onTabChange} isDark={isDark} />
        </nav>
      </div>
    </div>
  )
}
