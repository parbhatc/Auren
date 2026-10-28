import { BarChart3, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import type { BacktestSession } from '../../../types/backtester'
import { resolveSessionDisplaySymbol } from '../../../backtester/constants'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { prefetchRouteOnIntent } from '../../../navigation/routeModules'

function formatSessionDate(startDate: string): string {
  const [y, m, d] = (startDate || '').split('-').map(Number)
  if (!y || !m || !d) return startDate
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatBalance(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function BacktesterSessionCard({
  session,
  isDark,
  onPlay,
  onEdit,
  onReset,
  onDelete,
  onOverview,
}: {
  session: BacktestSession
  isDark: boolean
  onPlay: () => void
  onEdit: () => void
  onReset: () => void
  onDelete: () => void
  onOverview: () => void
}) {
  const initial = session.initialBalance ?? 50000
  const current = session.currentBalance ?? initial
  const pnl = current - initial
  const displaySymbol = resolveSessionDisplaySymbol(session.symbol)
  const symbolStyle = {
    dark: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    light: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  }
  const ghostButton = isDark
    ? 'border border-[var(--app-border)] text-[#A1A1AA] hover:bg-[var(--app-hover)]'
    : 'border border-[var(--app-border)] text-[#71717A] hover:bg-[var(--app-inset)]'
  const primaryButton = isDark
    ? 'bg-[var(--app-button)] text-[var(--app-button-text)] hover:bg-white'
    : 'bg-[var(--app-button)] text-[var(--app-button-text)] hover:opacity-90'

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[20px] border lg:flex-row lg:items-center ${isDark ? 'border-[var(--app-border)] bg-[var(--app-panel)]' : 'border-[var(--app-border)] bg-white'}`}
    >
      <button
        type="button"
        onClick={onPlay}
        onPointerEnter={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
        onFocus={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
        onTouchStart={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
        className={`flex-1 min-w-0 text-left p-5 sm:p-6 transition-colors ${
          isDark ? 'hover:bg-zinc-800/80' : 'hover:bg-zinc-50'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}
          >
            {session.name}
          </p>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isDark ? symbolStyle.dark : symbolStyle.light}`}
          >
            {displaySymbol}
          </span>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-zinc-700/50 text-zinc-400 border-zinc-600'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
            }`}
          >
            {session.timeframe}
          </span>
        </div>
        <p
          className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}
        >
          {formatSessionDate(session.startDate)} · {session.startTime}
        </p>
        <div
          className={`mt-2 flex flex-wrap gap-4 text-sm tabular-nums ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
        >
          <span>
            {t('backtester.balance', {}, 'Balance')}: ${formatBalance(current)}
          </span>
          <span
            className={
              pnl > 0
                ? isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
                : pnl < 0
                  ? isDark
                    ? 'text-red-400'
                    : 'text-red-600'
                  : 'text-zinc-500'
            }
          >
            P/L: {pnl > 0 ? '+' : pnl < 0 ? '-' : ''}$
            {formatBalance(Math.abs(pnl))}
          </span>
          {session.results && (
            <span>
              {session.results.totalTrades} trades ·{' '}
              <span
                className={
                  session.results.winRate > 0
                    ? isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-600'
                    : 'text-zinc-500'
                }
              >
                {session.results.winRate.toFixed(0)}% win
              </span>
            </span>
          )}
        </div>
        <p
          className={`text-[10px] mt-2 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}
        >
          {t('backtester.clickToPlay', {}, 'Click to open chart replay')}
        </p>
      </button>

      <div className="flex flex-wrap gap-2 shrink-0 px-5 pb-5 lg:p-4 lg:pl-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          onPointerEnter={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
          onFocus={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
          onTouchStart={() => prefetchRouteOnIntent(ROUTES.BACKTESTER_CHART)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium ${primaryButton}`}
        >
          <Play className="w-4 h-4" />
          {t('backtester.play')}
        </button>
        <button
          type="button"
          aria-label="View results in Overview"
          onClick={(e) => {
            e.stopPropagation()
            onOverview()
          }}
          onPointerEnter={() => prefetchRouteOnIntent(ROUTES.DASHBOARD)}
          onFocus={() => prefetchRouteOnIntent(ROUTES.DASHBOARD)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${ghostButton}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">View results</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${ghostButton}`}
          title={t('common.edit', {}, 'Edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReset()
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            isDark
              ? 'border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/10'
              : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}
          title={t('backtester.reset')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            isDark
              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
              : 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
          title={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
