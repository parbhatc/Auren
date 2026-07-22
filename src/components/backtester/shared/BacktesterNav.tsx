import { BarChart3, Database, History } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'

export type BacktesterTab = 'sessions' | 'stats' | 'data'

const TABS = [
  { id: 'sessions' as const, label: 'Replay sessions', route: ROUTES.BACKTESTER, icon: History },
  { id: 'stats' as const, label: 'Replay statistics', route: ROUTES.BACKTESTER_STATS, icon: BarChart3 },
  { id: 'data' as const, label: 'CSV data', route: ROUTES.BACKTESTER_DATA_MANAGEMENT, icon: Database, adminOnly: true },
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
      className={`mb-6 flex w-full min-w-0 gap-1 overflow-x-auto rounded-xl border p-1 ${
        isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
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
            className={`inline-flex min-w-max flex-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
              active
                ? isDark
                  ? 'bg-[#FAFAFA] text-[#09090B]'
                  : 'bg-[#18181B] text-white'
                : isDark
                  ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]'
                  : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
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
