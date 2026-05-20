import { Component } from 'react'
import { WinRateAnalysisProps } from '../../types/common'

class WinRateAnalysis extends Component<WinRateAnalysisProps> {
  render() {
    const { isDark, data } = this.props
    
    // Generate dummy data if not provided
    const winRateData = data || [
      { label: 'Under 15 sec', rate: Math.random() * 100 },
      { label: '15 - 45 sec', rate: Math.random() * 100 },
      { label: '45 sec - 1 min', rate: Math.random() * 100 },
      { label: '1 min - 2 min', rate: Math.random() * 100 },
      { label: '2 min - 5 min', rate: Math.random() * 100 },
      { label: '5 min - 10 min', rate: Math.random() * 100 },
      { label: '10 min - 30 min', rate: Math.random() * 100 },
      { label: '30 min - 1 hour', rate: Math.random() * 100 },
      { label: '1 hour - 2 hours', rate: Math.random() * 100 },
      { label: '2 hours - 4 hours', rate: Math.random() * 100 },
      { label: '4 hours and up', rate: Math.random() * 100 },
    ]

    return (
      <div className={`rounded-xl p-4 sm:p-6 border transition-colors duration-500 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 transition-colors duration-500 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          Win Rate Analysis
        </h3>
        <p className={`text-xs sm:text-sm mb-3 sm:mb-4 transition-colors duration-500 ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          Win Rate
        </p>
        <div className="space-y-2 sm:space-y-3">
          {winRateData.map((item, idx) => {
            const isPositive = item.rate >= 50
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs sm:text-sm transition-colors duration-500 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {item.label}
                  </span>
                  <span className={`text-xs sm:text-sm font-semibold transition-colors duration-500 ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {item.rate.toFixed(1)}%
                  </span>
                </div>
                <div className={`h-1.5 sm:h-2 rounded-full overflow-hidden transition-colors duration-500 ${
                  isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}>
                  <div
                    className={`h-full transition-all ${
                      isPositive ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

export default WinRateAnalysis

