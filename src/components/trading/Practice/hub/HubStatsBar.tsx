import { Activity, CheckCircle2, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import type { PracticeAccount } from '../../../../constants/practice'
import { t } from '../../../../utils/translator'

export default function HubStatsBar({
  accounts,
  isDark,
  marketConnected,
  marketAccountLabel,
}: {
  accounts: PracticeAccount[]
  isDark: boolean
  marketConnected: boolean
  marketAccountLabel?: string
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
    {
      label: t('practice.hub.nav.market'),
      value: marketConnected ? t('practice.hub.nav.connected') : t('practice.hub.nav.disconnected'),
      sub: marketAccountLabel,
      icon: marketConnected ? Wifi : WifiOff,
      accent: marketConnected
        ? isDark
          ? 'text-sky-400'
          : 'text-sky-600'
        : isDark
          ? 'text-amber-400'
          : 'text-amber-600',
      bg: marketConnected
        ? isDark
          ? 'bg-sky-500/10'
          : 'bg-sky-50'
        : isDark
          ? 'bg-amber-500/10'
          : 'bg-amber-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`rounded-xl border p-3 sm:p-4 ${
              isDark
                ? 'border-slate-800/80 bg-slate-900/50'
                : 'border-slate-200/90 bg-white/70'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {card.label}
                </p>
                <p className={`text-lg sm:text-xl font-bold mt-0.5 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {card.value}
                </p>
                {card.sub && (
                  <p className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {card.sub}
                  </p>
                )}
              </div>
              <div className={`p-2 rounded-lg shrink-0 ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.accent}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
