import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ROUTES, practiceTradeStatsPath } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import type { PracticeAccountStatus } from '../../../constants/practice'

export default function PracticeAccountStatusBar({
  isDark,
  status,
  practiceAccountId,
  navigate,
}: {
  isDark: boolean
  status: Extract<PracticeAccountStatus, 'blown' | 'passed'>
  practiceAccountId: string
  navigate: (path: string) => void
}) {
  const isBlown = status === 'blown'

  return (
    <div
      className={`shrink-0 border-b px-2 py-2 sm:px-3 ${
        isBlown
          ? isDark
            ? 'border-red-500/30 bg-red-950/40'
            : 'border-red-200 bg-red-50'
          : isDark
            ? 'border-emerald-500/30 bg-emerald-950/30'
            : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {isBlown ? (
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}
              aria-hidden
            />
          ) : (
            <CheckCircle2
              className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p
              className={`text-xs sm:text-sm font-semibold ${
                isBlown
                  ? isDark
                    ? 'text-red-200'
                    : 'text-red-800'
                  : isDark
                    ? 'text-emerald-200'
                    : 'text-emerald-800'
              }`}
            >
              {isBlown ? t('practice.trade.blownModalTitle') : t('practice.trade.passedModalTitle')}
            </p>
            <p className={`text-[11px] sm:text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isBlown ? t('practice.trade.blownBannerHint') : t('practice.trade.passedBannerHint')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 sm:ml-auto">
          <button
            type="button"
            onClick={() => navigate(ROUTES.PRACTICE)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isDark
                ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
          >
            {t('practice.trade.backToHub')}
          </button>
          <button
            type="button"
            onClick={() => navigate(practiceTradeStatsPath(practiceAccountId))}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
              isBlown ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {t('practice.trade.statsPage')}
          </button>
        </div>
      </div>
    </div>
  )
}
