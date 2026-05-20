import { TrendingUp, Calendar, List } from 'lucide-react'
import { StatsTabsProps } from '../../../types/common'

const StatsTabs = ({
  isDark,
  activeTab,
  onTabChange,
  practiceMode,
}: StatsTabsProps & { practiceMode?: boolean }) => {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
    { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
    { id: 'trades' as const, label: 'Trades', icon: List },
  ]

  return (
    <div className={`mb-4 sm:mb-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className="flex gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const activeCls = practiceMode
            ? isDark
              ? 'border-violet-500 text-violet-400'
              : 'border-violet-600 text-violet-600'
            : isDark
              ? 'border-blue-500 text-blue-400'
              : 'border-blue-600 text-blue-600'
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium transition-all border-b-2 ${
                isActive
                  ? activeCls
                  : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default StatsTabs
