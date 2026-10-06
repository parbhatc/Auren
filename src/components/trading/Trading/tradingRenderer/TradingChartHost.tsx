import type { ReactNode } from 'react'

type TradingChartHostProps = {
  terminalShell: boolean
  isDark: boolean
  chartComponent: ReactNode
  positionSummary?: string | null
}

export function TradingChartHost({
  terminalShell,
  isDark,
  chartComponent,
  positionSummary,
}: TradingChartHostProps) {
  return (
    <div
      data-journal-chart
      className={`trading-chart-host flex flex-col flex-1 min-h-0 h-full overflow-hidden ${
        terminalShell
          ? 'max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent lg:rounded-2xl lg:border lg:border-slate-700/80 lg:bg-slate-900/90'
          : `rounded-lg sm:rounded-xl shadow-lg border ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`
      }`}
    >
      <div className="flex-1 min-h-0 w-full relative">
        {chartComponent || (
          <div className="flex items-center justify-center h-full text-slate-500">
            Chart not available
          </div>
        )}
        {positionSummary ? (
          <div
            className={`pointer-events-none absolute left-3 top-12 z-[80] max-w-[min(32rem,calc(100%-1.5rem))] rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold tabular-nums shadow-lg backdrop-blur ${
              isDark
                ? 'border-violet-500/35 bg-slate-950/85 text-violet-200 shadow-black/30'
                : 'border-violet-300 bg-white/90 text-violet-800 shadow-slate-300/40'
            }`}
            title="Combined mini and micro position"
          >
            {positionSummary}
          </div>
        ) : null}
      </div>
    </div>
  )
}
