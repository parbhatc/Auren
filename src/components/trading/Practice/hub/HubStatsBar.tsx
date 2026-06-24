import { Activity, CheckCircle2, TrendingUp } from 'lucide-react'
import type { PracticeAccount } from '../../../../constants/practice'
import { t } from '../../../../utils/translator'

export default function HubStatsBar({
  accounts,
  isDark,
}: {
  accounts: PracticeAccount[]
  isDark: boolean
}) {
  const active = accounts.filter((a) => a.status === 'active').length
  const passed = accounts.filter((a) => a.status === 'passed').length
  const blown = accounts.filter((a) => a.status === 'blown').length

  const cards = [
    {
      label: t('practice.hub.active'),
      value: String(active),
      icon: Activity,
      accent: isDark ? 'text-violet-400' : 'text-violet-600',
      bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
    },
    {
      label: t('practice.hub.passed'),
      value: String(passed),
      icon: CheckCircle2,
      accent: isDark ? 'text-emerald-400' : 'text-emerald-600',
      bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    },
    {
      label: t('practice.hub.blown'),
      value: String(blown),
      icon: TrendingUp,
      accent: isDark ? 'text-red-400' : 'text-red-600',
      bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`rounded-xl border p-2.5 sm:p-4 min-w-0 ${
              isDark
                ? 'border-slate-800/80 bg-slate-900/50'
                : 'border-slate-200/90 bg-white/70'
            }`}
          >
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              <div className="min-w-0">
                <p className={`text-[9px] sm:text-xs font-medium uppercase tracking-wide truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {card.label}
                </p>
                <p className={`text-base sm:text-xl font-bold mt-0.5 tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {card.value}
                </p>
              </div>
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${card.bg}`}>
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${card.accent}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
