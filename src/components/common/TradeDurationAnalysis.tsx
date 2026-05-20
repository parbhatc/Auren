import { Component } from 'react'
import { TradeDurationAnalysisProps } from '../../types/common'

class TradeDurationAnalysis extends Component<TradeDurationAnalysisProps> {
  render() {
    const { isDark, data } = this.props
    
    // Generate dummy data if not provided
    const durationData = data || [
      { label: 'Under 15 sec', count: Math.floor(Math.random() * 20) },
      { label: '15 - 45 sec', count: Math.floor(Math.random() * 30) },
      { label: '45 sec - 1 min', count: Math.floor(Math.random() * 25) },
      { label: '1 min - 2 min', count: Math.floor(Math.random() * 35) },
      { label: '2 min - 5 min', count: Math.floor(Math.random() * 40) },
      { label: '5 min - 10 min', count: Math.floor(Math.random() * 30) },
      { label: '10 min - 30 min', count: Math.floor(Math.random() * 20) },
      { label: '30 min - 1 hour', count: Math.floor(Math.random() * 15) },
      { label: '1 hour - 2 hours', count: Math.floor(Math.random() * 10) },
      { label: '2 hours - 4 hours', count: Math.floor(Math.random() * 8) },
      { label: '4 hours and up', count: Math.floor(Math.random() * 5) },
    ]

    const maxCount = Math.max(...durationData.map(d => d.count), 1)

    return (
      <div className={`rounded-xl p-4 sm:p-6 border transition-colors duration-500 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 transition-colors duration-500 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          Trade Duration Analysis
        </h3>
        <p className={`text-xs sm:text-sm mb-3 sm:mb-4 transition-colors duration-500 ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          Trade Count
        </p>
        <div className="space-y-2 sm:space-y-3">
          {durationData.map((item, idx) => {
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs sm:text-sm transition-colors duration-500 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {item.label}
                  </span>
                  <span className={`text-xs sm:text-sm font-semibold transition-colors duration-500 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {item.count}
                  </span>
                </div>
                <div className={`h-1.5 sm:h-2 rounded-full overflow-hidden transition-colors duration-500 ${
                  isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}>
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${percentage}%` }}
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

export default TradeDurationAnalysis

