import { BarChart3, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import type { BacktestSession } from '../../../types/backtester'
import { resolveSessionDisplaySymbol } from '../../../backtester/constants'
import { listCardClass } from '../../../styles/aurenTheme'
import { ghostButtonClass, primaryButtonClass } from '../../../styles/aurenTheme'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'

const SYMBOL_ACCENTS: Record<string, { dark: string; light: string }> = {
  NQ: { dark: 'bg-violet-500/15 text-violet-300 border-violet-500/30', light: 'bg-violet-100 text-violet-700 border-violet-200' },
  MNQ: { dark: 'bg-violet-500/15 text-violet-300 border-violet-500/30', light: 'bg-violet-100 text-violet-700 border-violet-200' },
  ES: { dark: 'bg-sky-500/15 text-sky-300 border-sky-500/30', light: 'bg-sky-100 text-sky-700 border-sky-200' },
  MES: { dark: 'bg-sky-500/15 text-sky-300 border-sky-500/30', light: 'bg-sky-100 text-sky-700 border-sky-200' },
  GC: { dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30', light: 'bg-amber-100 text-amber-800 border-amber-200' },
  MGC: { dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30', light: 'bg-amber-100 text-amber-800 border-amber-200' },
}

function formatSessionDate(startDate: string): string {
  const [y, m, d] = (startDate || '').split('-').map(Number)
  if (!y || !m || !d) return startDate
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatBalance(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BacktesterSessionCard({
  session,
  isDark,
  onPlay,
  onEdit,
  onReset,
  onDelete,
  onStats,
}: {
  session: BacktestSession
  isDark: boolean
  onPlay: () => void
  onEdit: () => void
  onReset: () => void
  onDelete: () => void
  onStats: () => void
}) {
  const initial = session.initialBalance ?? 50000
  const current = session.currentBalance ?? initial
  const pnl = current - initial
  const displaySymbol = resolveSessionDisplaySymbol(session.symbol)
  const symbolStyle = SYMBOL_ACCENTS[displaySymbol] ?? {
    dark: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    light: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <div className={listCardClass(isDark)}>
      <button
        type="button"
        onClick={onPlay}
        className={`flex-1 min-w-0 text-left p-4 transition-colors ${
          isDark ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {session.name}
          </p>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isDark ? symbolStyle.dark : symbolStyle.light}`}>
            {displaySymbol}
          </span>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
            isDark ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {session.timeframe}
          </span>
        </div>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          {formatSessionDate(session.startDate)} · {session.startTime}
        </p>
        <div className={`mt-2 flex flex-wrap gap-4 text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <span>
            {t('backtester.balance', {}, 'Balance')}: ${formatBalance(current)}
          </span>
          <span className={pnl >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}>
            P/L: {pnl >= 0 ? '+' : ''}${formatBalance(Math.abs(pnl))}
          </span>
          {session.results && (
            <span>
              {session.results.totalTrades} trades · {session.results.winRate.toFixed(0)}% win
            </span>
          )}
        </div>
        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {t('backtester.clickToPlay', {}, 'Click to open chart replay')}
        </p>
      </button>

      <div className="flex flex-wrap gap-2 shrink-0 p-4 sm:pl-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay() }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${primaryButtonClass()}`}
        >
          <Play className="w-4 h-4" />
          {t('backtester.play')}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStats() }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${ghostButtonClass(isDark)}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">{t('backtester.nav.stats', {}, 'Stats')}</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${ghostButtonClass(isDark)}`}
          title={t('common.edit', {}, 'Edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReset() }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            isDark
              ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
          }`}
          title={t('backtester.reset')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
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

export function backtesterStatsPath(sessionId: string): string {
  return `${ROUTES.BACKTESTER_STATS}?sessionId=${sessionId}`
}
