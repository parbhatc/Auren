import { Database, History } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { prefetchRouteOnIntent } from '../../../navigation/routeModules'

export type BacktesterTab = 'sessions' | 'data'

const TABS = [
  {
    id: 'sessions' as const,
    label: 'Replay sessions',
    route: ROUTES.BACKTESTER,
    icon: History,
  },
  {
    id: 'data' as const,
    label: 'CSV data',
    route: ROUTES.BACKTESTER_DATA_MANAGEMENT,
    icon: Database,
    adminOnly: true,
  },
]

export default function BacktesterNav({
  isDark,
  navigate,
  activeTab,
  showAdmin = false,
}: {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  activeTab: BacktesterTab
  showAdmin?: boolean
  onLogout?: () => void
}) {
  return (
    <nav
      aria-label="Replay sections"
      className={`mb-7 flex w-full min-w-0 gap-1 overflow-x-auto border-b pb-3 ${
        isDark ? 'border-[var(--app-border)]' : 'border-[var(--app-border)]'
      }`}
    >
      {TABS.filter((tab) => !tab.adminOnly || showAdmin).map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.route)}
            onPointerEnter={() => prefetchRouteOnIntent(tab.route)}
            onFocus={() => prefetchRouteOnIntent(tab.route)}
            onTouchStart={() => prefetchRouteOnIntent(tab.route)}
            className={`inline-flex min-w-max flex-none items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors ${
              active
                ? isDark
                  ? 'bg-[var(--app-button)] text-[var(--app-button-text)]'
                  : 'bg-[var(--app-button)] text-[var(--app-button-text)]'
                : isDark
                  ? 'text-[#A1A1AA] hover:bg-[var(--app-hover)] hover:text-[#FAFAFA]'
                  : 'text-[#52525B] hover:bg-[var(--app-inset)] hover:text-[#09090B]'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
