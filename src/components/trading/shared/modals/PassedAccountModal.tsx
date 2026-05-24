import { BarChart3, Trophy } from 'lucide-react'
import { t } from '../../../../utils/translator'

export default function PassedAccountModal({
  isDark,
  isOpen,
  balance,
  profitTarget,
  totalProfit,
  onGoToHub,
  onGoToStats,
}: {
  isDark: boolean
  isOpen: boolean
  balance?: number
  profitTarget?: number | null
  totalProfit?: number
  onGoToHub: () => void
  onGoToStats?: () => void
}) {
  if (!isOpen) return null

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="practice-passed-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
      <div
        className={`relative w-full max-w-lg rounded-2xl border-2 shadow-2xl overflow-hidden animate-slide-down ${
          isDark ? 'bg-slate-950 border-emerald-500/40' : 'bg-white border-emerald-300'
        }`}
      >
        <div
          className={`px-6 sm:px-8 pt-8 pb-4 text-center ${
            isDark ? 'bg-emerald-950/30' : 'bg-emerald-50'
          }`}
        >
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
            }`}
          >
            <Trophy className={`h-9 w-9 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <h2
            id="practice-passed-title"
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDark ? 'text-emerald-300' : 'text-emerald-700'
            }`}
          >
            {t('practice.trade.passedModalTitle')}
          </h2>
        </div>

        <div className={`px-6 sm:px-8 pb-8 space-y-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          <p className="text-base sm:text-lg leading-relaxed text-center">
            {t('practice.trade.passedModalBody')}
          </p>
          {(balance != null || profitTarget != null || totalProfit != null) && (
            <div
              className={`rounded-xl px-4 py-3 text-sm space-y-1 ${
                isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-600'
              }`}
            >
              {balance != null && (
                <p>
                  {t('practice.hub.balance')}:{' '}
                  <span className="font-semibold tabular-nums text-emerald-400">{fmt(balance)}</span>
                </p>
              )}
              {totalProfit != null && (
                <p>
                  {t('practice.evalStats.totalPnl')}:{' '}
                  <span className="font-semibold tabular-nums text-emerald-400">
                    {totalProfit >= 0 ? '+' : ''}
                    {fmt(totalProfit)}
                  </span>
                </p>
              )}
              {profitTarget != null && (
                <p>
                  {t('practice.rules.profitTarget')}:{' '}
                  <span className="font-semibold tabular-nums">{fmt(profitTarget)}</span>
                </p>
              )}
            </div>
          )}
          <p className={`text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('practice.trade.passedModalHint')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={onGoToHub}
              className={`flex-1 py-3.5 px-4 rounded-xl font-semibold text-base border transition-colors ${
                isDark
                  ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('practice.trade.backToHub')}
            </button>
            {onGoToStats ? (
              <button
                type="button"
                onClick={onGoToStats}
                className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-base bg-emerald-600 hover:bg-emerald-500 text-white transition-colors inline-flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                {t('practice.trade.statsPage')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
