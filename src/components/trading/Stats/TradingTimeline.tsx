import { Component } from 'react'
import { TradingTimelineProps } from '../../../types/common'

class TradingTimeline extends Component<TradingTimelineProps> {
  render() {
    const {
      isDark,
      trades,
      profit,
      date,
      symbolData,
      selectedTimelinePoint,
      onPointClick,
      onPointClose,
      calculateTradePnL,
      parseTradeTimestamp
    } = this.props

    // Sort trades by entry time
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
      const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
      return timeA - timeB
    })

    // Get time range for the day
    const entryTimes = sortedTrades.map(t => parseTradeTimestamp(t.entry_time)).filter(Boolean) as Date[]
    if (entryTimes.length === 0) return null

    const minTime = new Date(Math.min(...entryTimes.map(d => d.getTime())))
    const maxTime = new Date(Math.max(...entryTimes.map(d => d.getTime())))
    
    // Extend range by 1 hour on each side for better visualization
    minTime.setHours(minTime.getHours() - 1)
    maxTime.setHours(maxTime.getHours() + 1)
    
    const timeRange = maxTime.getTime() - minTime.getTime()
    
    // Calculate cumulative P&L
    let cumulativePnL = 0
    const timelinePoints = sortedTrades.map((trade, index) => {
      const entryTime = parseTradeTimestamp(trade.entry_time)
      if (!entryTime) return null
      
      const grossPnl = calculateTradePnL(trade)
      // Get fees - use trade.fees when present, else symbol data
      let fees = 0
      if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
        fees = trade.fees || trade.originalTrade?.fees || 0
      } else {
      const symbol = trade.symbol || ''
      const symbolInfo = symbolData?.[symbol]
      const totalFees = symbolInfo?.totalFees || 0
        fees = totalFees * Math.abs(trade.contracts || 0)
      }
      const netPnl = grossPnl - fees
      cumulativePnL += netPnl
      
      const x = ((entryTime.getTime() - minTime.getTime()) / timeRange) * 100
      
      return {
        x,
        y: cumulativePnL,
        trade,
        netPnl,
        entryTime,
        index
      }
    }).filter(Boolean) as Array<{
      x: number
      y: number
      trade: any
      netPnl: number
      entryTime: Date
      index: number
    }>

    if (timelinePoints.length === 0) return null

    // Calculate P&L range with padding for better visualization
    const minPnL = Math.min(0, ...timelinePoints.map(p => p.y))
    const maxPnL = Math.max(0, ...timelinePoints.map(p => p.y))
    const pnlRange = maxPnL - minPnL || 1
    
    // Add padding to range (10% on each side)
    const padding = pnlRange * 0.1
    const adjustedMinPnL = minPnL - padding
    const adjustedMaxPnL = maxPnL + padding
    const adjustedPnLRange = adjustedMaxPnL - adjustedMinPnL || 1
    
    const height = 100
    const width = 100

    // Convert points to SVG coordinates
    const svgPoints = timelinePoints.map(point => {
      const svgY = height - ((point.y - adjustedMinPnL) / adjustedPnLRange) * height
      return {
        x: point.x,
        y: svgY,
        trade: point.trade,
        netPnl: point.netPnl,
        entryTime: point.entryTime,
        index: point.index,
        cumulativePnL: point.y
      }
    })

    // Generate smooth curve path using quadratic curves
    let pathData = ''
    let areaPathData = ''
    
    if (svgPoints.length === 1) {
      const point = svgPoints[0]
      pathData = `M ${point.x},${point.y} L ${point.x},${point.y}`
      areaPathData = `M ${point.x},${point.y} L ${point.x},${height} L 0,${height} Z`
    } else if (svgPoints.length > 1) {
      const firstPoint = svgPoints[0]
      pathData = `M ${firstPoint.x},${firstPoint.y}`
      
      for (let i = 1; i < svgPoints.length; i++) {
        const prevPoint = svgPoints[i - 1]
        const currPoint = svgPoints[i]
        const nextPoint = svgPoints[i + 1]
        
        if (nextPoint) {
          const cpX = (prevPoint.x + currPoint.x) / 2
          const cpY = (prevPoint.y + currPoint.y) / 2
          pathData += ` Q ${cpX},${cpY} ${currPoint.x},${currPoint.y}`
        } else {
          pathData += ` L ${currPoint.x},${currPoint.y}`
        }
      }
      
      areaPathData = `${pathData} L ${width},${height} L 0,${height} Z`
    }

    // Format time range
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }
    
    const firstTime = parseTradeTimestamp(sortedTrades[0]?.entry_time)
    const lastTime = parseTradeTimestamp(sortedTrades[sortedTrades.length - 1]?.entry_time)
    const timeRangeStr = firstTime && lastTime
      ? (sortedTrades.length === 1 || formatTime(firstTime) === formatTime(lastTime))
        ? formatTime(firstTime)
        : `${formatTime(firstTime)} - ${formatTime(lastTime)}`
      : '—'

    return (
      <div className={`rounded-lg p-4 border ${
        isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`text-sm font-semibold mb-4 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}>
          Trading Timeline
        </div>
        <div className="relative h-32 sm:h-40">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`timelineGradient-${date}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={profit >= 0 
                  ? (isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)')
                  : (isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)')
                } />
                <stop offset="100%" stopColor={isDark ? 'rgba(0, 0, 0, 0)' : 'rgba(255, 255, 255, 0)'} />
              </linearGradient>
            </defs>
            
            {/* Zero line */}
            <line
              x1="0"
              y1={height - ((0 - adjustedMinPnL) / adjustedPnLRange) * height}
              x2="100"
              y2={height - ((0 - adjustedMinPnL) / adjustedPnLRange) * height}
              stroke={isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            
            {/* Area fill */}
            {areaPathData && (
              <path
                d={areaPathData}
                fill={`url(#timelineGradient-${date})`}
              />
            )}
            
            {/* Main curve line */}
            {pathData && (
              <path
                d={pathData}
                fill="none"
                stroke={profit >= 0 
                  ? (isDark ? '#10b981' : '#059669')
                  : (isDark ? '#ef4444' : '#dc2626')
                }
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.2))' }}
              />
            )}
            
            {/* Trade points */}
            {svgPoints.map((point) => {
              const isSelected = selectedTimelinePoint?.trade === point.trade
              return (
                <g key={point.index}>
                  {isSelected && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill="none"
                      stroke={point.netPnl >= 0 
                        ? (isDark ? '#10b981' : '#059669')
                        : (isDark ? '#ef4444' : '#dc2626')
                      }
                      strokeWidth="2"
                      opacity="0.4"
                      className="animate-pulse"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? "5" : "4"}
                    fill={point.netPnl >= 0 
                      ? (isDark ? '#10b981' : '#059669')
                      : (isDark ? '#ef4444' : '#dc2626')
                    }
                    stroke={isDark ? '#0f172a' : '#ffffff'}
                    strokeWidth={isSelected ? "2.5" : "2"}
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => {
                      onPointClick({
                        trade: point.trade,
                        netPnl: point.netPnl,
                        entryTime: point.entryTime,
                        cumulativePnL: point.cumulativePnL
                      })
                    }}
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.6))' }}
                  />
                </g>
              )
            })}
          </svg>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs">
          <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
            {timeRangeStr}
          </span>
          <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
            Cumulative P&L
          </span>
        </div>
        
        {/* Timeline Point Tooltip */}
        {selectedTimelinePoint && (
          <div className={`mt-4 p-4 rounded-lg border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-sm font-semibold ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                Trade Details
              </h4>
              <button
                onClick={onPointClose}
                className={`text-slate-400 hover:text-slate-600 transition-colors`}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Symbol:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {selectedTimelinePoint.trade.symbol || '—'}
                </span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Direction:</span>
                <span className={`ml-2 font-medium ${
                  selectedTimelinePoint.trade.direction?.toLowerCase() === 'long'
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {selectedTimelinePoint.trade.direction?.toUpperCase() || '—'}
                </span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Size:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {Math.abs(selectedTimelinePoint.trade.contracts || 0)}
                </span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Entry:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {selectedTimelinePoint.trade.entry_price?.toFixed(2) || '—'}
                </span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Exit:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {selectedTimelinePoint.trade.exit_price?.toFixed(2) || '—'}
                </span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Time:</span>
                <span className={`ml-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {selectedTimelinePoint.entryTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
              </div>
              <div className="col-span-2">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Result:</span>
                <span className={`ml-2 text-base font-bold ${
                  selectedTimelinePoint.netPnl >= 0
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {selectedTimelinePoint.netPnl >= 0 ? 'WIN' : 'LOSS'} - ${Math.abs(selectedTimelinePoint.netPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default TradingTimeline

