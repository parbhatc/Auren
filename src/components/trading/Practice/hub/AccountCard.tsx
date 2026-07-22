import { BarChart3, RotateCcw, Trash2, TrendingUp } from 'lucide-react'
import {
  evaluatePracticeRules,
  getPracticeAccountDisplayTitle,
  getPracticeMarketDataSettings,
  type PracticeAccount,
} from '../../../../constants/practice'
import { formatPracticeDollars } from '../../../../services/practice/practiceRules'
import { t } from '../../../../utils/translator'

export default function AccountCard({
  account,
  isDark,
  onView,
  onTrade,
  onStats,
  onReset,
  onDelete,
}: {
  account: PracticeAccount
  isDark: boolean
  onView: () => void
  onTrade: () => void
  onStats: () => void
  onReset: () => void
  onDelete: () => void
}) {
  const isTerminal = account.status === 'blown' || account.status === 'passed'
  const rules = evaluatePracticeRules(account)
  const title = getPracticeAccountDisplayTitle(account)
  const marketData = getPracticeMarketDataSettings()
  const chartAccountLabel =
    marketData.accountLabel || account.marketDataAccountLabel || '—'
  const statusStyles =
    account.status === 'passed'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : account.status === 'blown'
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : isDark
          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          : 'bg-blue-50 text-blue-700 border-blue-200'

  return (
    <div
      className={`rounded-xl border flex flex-col sm:flex-row sm:items-center gap-4 overflow-hidden transition-colors ${
        isDark
          ? 'bg-[#18181B] border-[#27272A] hover:border-blue-500/50'
          : 'bg-white border-[#E4E4E7] hover:border-blue-600/40'
      }`}
    >
      <button
        type="button"
        onClick={onView}
        className={`flex-1 min-w-0 text-left p-4 transition-colors ${
          isDark ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</p>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusStyles}`}>
            {account.status}
          </span>
        </div>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{chartAccountLabel}</p>
        <div className={`mt-2 flex flex-wrap gap-4 text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <span>
            {t('practice.hub.balance')}: ${formatPracticeDollars(account.balance)}
          </span>
          <span>
            P/L: {rules.totalProfit >= 0 ? '+' : ''}${formatPracticeDollars(rules.totalProfit)}
          </span>
          {account.mode === 'eval' && rules.profitRemaining != null && account.status === 'active' && (
            <span>
              {t('practice.hub.toTarget')}: ${formatPracticeDollars(rules.profitRemaining)}
            </span>
          )}
        </div>
        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {t('practice.hub.viewDetailsHint')}
        </p>
      </button>
      <div className="flex flex-wrap gap-2 shrink-0 p-4 sm:pl-0">
        {account.status === 'active' ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTrade()
              }}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <TrendingUp className="w-4 h-4" />
              {t('practice.hub.trade')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStats()
              }}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isDark
                  ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {t('practice.hub.stats')}
            </button>
          </>
        ) : isTerminal ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStats()
            }}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-medium ${
              account.status === 'blown'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t('practice.hub.stats')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReset()
          }}
          className={`p-2 rounded-lg border transition-colors ${
            isDark
              ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={t('practice.hub.reset')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`p-2 rounded-lg border ${isDark ? 'border-red-900/50 text-red-400' : 'border-red-200 text-red-600'}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
