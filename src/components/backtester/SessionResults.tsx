import { Component } from 'react'
import { SessionResultsProps } from '../../types/backtester'
import { t } from '../../utils/translator'

class SessionResults extends Component<SessionResultsProps> {
  render() {
    const { isDark, results } = this.props

    const cards = [
      { label: t('backtester.totalTrades'), value: String(results.totalTrades) },
      { label: t('backtester.winRate'), value: `${results.winRate.toFixed(1)}%` },
      {
        label: t('backtester.profit'),
        value: `$${results.profit.toFixed(2)}`,
        tone: results.profit >= 0 ? 'emerald' : 'red',
      },
      { label: t('backtester.maxDrawdown'), value: `${results.maxDrawdown.toFixed(1)}%` },
    ]

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-3 sm:p-4 ${
              isDark ? 'border-slate-800/80 bg-slate-900/50' : 'border-slate-200/90 bg-white/70'
            }`}
          >
            <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {card.label}
            </p>
            <p
              className={`text-base sm:text-lg font-bold mt-1 tabular-nums ${
                card.tone === 'emerald'
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                  : card.tone === 'red'
                    ? isDark ? 'text-red-400' : 'text-red-600'
                    : isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    )
  }
}

export default SessionResults
