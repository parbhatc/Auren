import { AlertTriangle, BarChart3 } from 'lucide-react'
import { t } from '../../../utils/translator'

export default function PracticeBlownAccountModal({
  isDark,
  isOpen,
  drawdownFloor,
  balance,
  onGoToHub,
  onGoToStats,
}: {
  isDark: boolean
  isOpen: boolean
  drawdownFloor?: number
  balance?: number
  onGoToHub: () => void
  onGoToStats?: () => void
}) {
  if (!isOpen) return null

  const floorText =
    drawdownFloor != null
      ? `$${drawdownFloor.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="practice-blown-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className={`relative w-full max-w-lg rounded-2xl border-2 shadow-2xl overflow-hidden animate-slide-down ${
          isDark ? 'bg-slate-950 border-red-500/40' : 'bg-white border-red-300'
        }`}
      >
        <div
          className={`px-6 sm:px-8 pt-8 pb-4 text-center ${
            isDark ? 'bg-red-950/30' : 'bg-red-50'
          }`}
        >
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}
          >
            <AlertTriangle className={`h-9 w-9 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <h2
            id="practice-blown-title"
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDark ? 'text-red-300' : 'text-red-700'
            }`}
          >
            {t('practice.trade.blownModalTitle')}
          </h2>
        </div>

        <div className={`px-6 sm:px-8 pb-8 space-y-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          <p className="text-base sm:text-lg leading-relaxed text-center">
            {t('practice.trade.blownModalBody')}
          </p>
          {(floorText != null || balance != null) && (
            <div
              className={`rounded-xl px-4 py-3 text-sm space-y-1 ${
                isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-600'
              }`}
            >
              {floorText != null && (
                <p>
                  {t('practice.rules.drawdownFloor')}:{' '}
                  <span className="font-semibold tabular-nums">{floorText}</span>
                </p>
              )}
              {balance != null && (
                <p>
                  {t('practice.hub.balance')}:{' '}
                  <span className="font-semibold tabular-nums text-red-400">
                    ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </p>
              )}
            </div>
          )}
          <p className={`text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('practice.trade.blownModalClosed')}
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
                className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-base bg-red-600 hover:bg-red-500 text-white transition-colors inline-flex items-center justify-center gap-2"
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

