import { LogOut } from 'lucide-react'
import { t } from '../../../../utils/translator'
import Logo from '../../../common/Logo'
import { HeaderThemeButton } from '../../shared/header/HeaderThemeButton'
import type { HubTab } from '../../../../types/practiceHub'

export type { HubTab } from '../../../../types/practiceHub'

const BASE_TABS: { id: HubTab; labelKey: string }[] = [
  { id: 'accounts', labelKey: 'practice.hub.nav.accounts' },
  { id: 'settings', labelKey: 'practice.hub.nav.settings' },
]

const ADMIN_TAB: { id: HubTab; labelKey: string } = {
  id: 'admin',
  labelKey: 'practice.hub.nav.admin',
}

function tabActiveClass(id: HubTab, isDark: boolean): string {
  if (id === 'admin') {
    return isDark
      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
      : 'bg-amber-600 text-white shadow-sm'
  }
  return isDark
    ? 'bg-blue-500 text-white'
    : 'bg-white text-blue-700'
}

function HubTabRail({
  activeTab,
  onTabChange,
  isDark,
  showAdmin,
  className = '',
}: {
  activeTab: HubTab
  onTabChange: (tab: HubTab) => void
  isDark: boolean
  showAdmin: boolean
  className?: string
}) {
  const tabs = showAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS

  return (
    <div
      className={`inline-flex w-full sm:w-auto p-1 rounded-xl gap-0.5 ${
        isDark ? 'bg-[#18181B] ring-1 ring-[#27272A]' : 'bg-[#F4F4F5] ring-1 ring-[#E4E4E7]'
      } ${className}`}
    >
      {tabs.map(({ id, labelKey }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              active
                ? tabActiveClass(id, isDark)
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

export default function HubNav({
  isDark,
  toggleTheme,
  activeTab,
  onTabChange,
  onLogout,
  showAdmin,
}: {
  isDark: boolean
  toggleTheme: () => void
  activeTab: HubTab
  onTabChange: (tab: HubTab) => void
  onLogout: () => void
  showAdmin: boolean
}) {
  const shell = isDark
    ? 'border-[#27272A] bg-[#09090B]'
    : 'border-[#E4E4E7] bg-white'

  return (
    <div className={`sticky top-0 z-50 border-b auren-sticky-app-header ${shell}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <header className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={() => onTabChange('accounts')}
            className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Logo isDark={isDark} compact size="sm" />
          </button>

          <nav
            className="hidden sm:flex flex-1 justify-center min-w-0"
            aria-label="Hub sections"
          >
            <HubTabRail
              activeTab={activeTab}
              onTabChange={onTabChange}
              isDark={isDark}
              showAdmin={showAdmin}
            />
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
            <HeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
          </div>
        </header>

        <nav className="sm:hidden pb-3" aria-label="Hub sections">
          <HubTabRail
            activeTab={activeTab}
            onTabChange={onTabChange}
            isDark={isDark}
            showAdmin={showAdmin}
          />
        </nav>
      </div>
    </div>
  )
}
