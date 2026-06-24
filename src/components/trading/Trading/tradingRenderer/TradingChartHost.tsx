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
      </div>
    </div>
  )
}
