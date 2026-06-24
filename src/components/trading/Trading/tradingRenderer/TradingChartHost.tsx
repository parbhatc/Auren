import type { ReactNode } from 'react'

type TradingChartHostProps = {
  terminalShell: boolean
  isDark: boolean
  chartComponent: ReactNode
}

export function TradingChartHost({
  terminalShell,
  isDark,
  chartComponent,
}: TradingChartHostProps) {
  return (
    <div
      className={`trading-chart-host flex flex-col flex-1 min-h-0 h-full overflow-hidden ${
        terminalShell
          ? 'rounded-2xl border border-slate-700/80 bg-slate-900/90'
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
      </div>
    </div>
  )
}
