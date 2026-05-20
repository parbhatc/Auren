import { Component, createRef } from 'react'
import { EquityCurveProps, EquityCurveState } from '../../types/common'

class EquityCurve extends Component<EquityCurveProps, EquityCurveState> {
  private svgRef = createRef<SVGSVGElement>()
  private containerRef = createRef<HTMLDivElement>()
  private gradientId = `equityGradient-${Math.random().toString(36).substr(2, 9)}`

  constructor(props: EquityCurveProps) {
    super(props)
    this.state = {
      hoveredIndex: null,
      tooltipPosition: null,
      selectedIndex: null
    }
  }

  handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (this.containerRef.current && this.svgRef.current) {
      const rect = this.containerRef.current.getBoundingClientRect()
      const svgRect = this.svgRef.current.getBoundingClientRect()
      
      // Calculate mouse position relative to SVG viewBox (0-100)
      const x = ((e.clientX - svgRect.left) / svgRect.width) * 100
      
      // Find the closest point
      const { points } = this.getEquityDataAndPoints()
      if (points.length === 0) return
      
      let closestIndex = 0
      let minDistance = Infinity
      
      points.forEach((point, index) => {
        const distance = Math.abs(point.x - x)
        if (distance < minDistance) {
          minDistance = distance
          closestIndex = index
        }
      })
      
      // Only show tooltip if mouse is reasonably close to a point
      if (minDistance < 5) {
        this.setState({
          hoveredIndex: closestIndex,
          tooltipPosition: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          }
        })
      } else {
        this.setState({
          hoveredIndex: null,
          tooltipPosition: null
        })
      }
    }
  }

  handleMouseLeave = () => {
    this.setState({
      hoveredIndex: null,
      tooltipPosition: null
    })
  }

  handlePointClick = (index: number) => {
    this.setState({
      selectedIndex: this.state.selectedIndex === index ? null : index
    })
  }

  getEquityDataAndPoints = () => {
    const { data } = this.props
    const equityData = data || []
    
    if (equityData.length === 0) {
      return { equityData: [], points: [], minValue: 0, maxValue: 0, range: 1, adjustedMin: 0, adjustedMax: 0 }
    }

    const minValue = Math.min(...equityData.map(d => d.value))
    const maxValue = Math.max(...equityData.map(d => d.value))
    const range = maxValue - minValue || 1

    // Add padding to range for better visualization
    const padding = range * 0.1
    const adjustedMin = minValue - padding
    const adjustedMax = maxValue + padding
    const adjustedRange = adjustedMax - adjustedMin

    const width = 100
    const height = 100
    const points = equityData.map((point, index) => {
      const x = equityData.length > 1 
        ? (index / (equityData.length - 1)) * width 
        : width / 2
      const y = height - ((point.value - adjustedMin) / adjustedRange) * height
      return { x, y, ...point }
    })

    return { equityData, points, minValue, maxValue, range: adjustedRange, adjustedMin, adjustedMax }
  }

  render() {
    const { isDark, data, initialBalance, embed } = this.props
    const { hoveredIndex, tooltipPosition, selectedIndex } = this.state
    
    // Generate dummy data if not provided
    const equityData = data || (() => {
      const days = 30
      const points: Array<{ date: string; value: number }> = []
      let currentValue = 10000
      
      for (let i = 0; i < days; i++) {
        const change = (Math.random() * 500 - 200)
        currentValue += change
        points.push({
          date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: Math.max(5000, currentValue)
        })
      }
      return points
    })()

    // Handle empty or single data point
    if (!equityData || equityData.length === 0) {
      return (
        <div 
          ref={this.containerRef}
          className={`w-full h-full rounded-xl p-6 relative flex items-center justify-center ${
            isDark 
              ? 'bg-slate-900/50 border border-slate-800' 
              : 'bg-white border border-slate-200'
          }`}
          style={{ minHeight: '300px' }}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No equity data available
          </p>
        </div>
      )
    }

    const equityDataAndPoints = this.getEquityDataAndPoints()
    const { points, minValue, maxValue, range, adjustedMin, adjustedMax } = equityDataAndPoints
    
    // Ensure we have valid data
    if (points.length === 0) {
      return (
        <div 
          ref={this.containerRef}
          className={`w-full h-full rounded-xl p-6 relative flex items-center justify-center ${
            isDark 
              ? 'bg-slate-900/50 border border-slate-800' 
              : 'bg-white border border-slate-200'
          }`}
          style={{ minHeight: '300px' }}
        >
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No equity data available
          </p>
        </div>
      )
    }

    // Generate smooth path data using quadratic curves
    let pathData = ''
    let areaPathData = ''
    if (points.length > 0) {
      if (points.length === 1) {
        pathData = `M ${points[0].x},${points[0].y} L ${points[0].x},${points[0].y}`
        areaPathData = `M ${points[0].x},${points[0].y} L ${points[0].x},100 L 0,100 Z`
      } else {
        // Use smooth curves for better appearance
        const firstPoint = points[0]
        pathData = `M ${firstPoint.x},${firstPoint.y}`
        
        for (let i = 1; i < points.length; i++) {
          const prevPoint = points[i - 1]
          const currPoint = points[i]
          const nextPoint = points[i + 1]
          
          if (nextPoint) {
            // Use quadratic curve for smooth transitions
            const cpX = (prevPoint.x + currPoint.x) / 2
            const cpY = (prevPoint.y + currPoint.y) / 2
            pathData += ` Q ${cpX},${cpY} ${currPoint.x},${currPoint.y}`
          } else {
            pathData += ` L ${currPoint.x},${currPoint.y}`
          }
        }
        
        areaPathData = `${pathData} L 100,100 L 0,100 Z`
      }
    }

    const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null
    const selectedPoint = selectedIndex !== null ? points[selectedIndex] : null
    const displayPoint = selectedPoint || hoveredPoint

    // Determine color based on balance vs initial balance
    const getLineColor = () => {
      if (!initialBalance || equityData.length === 0) {
        return isDark ? '#10b981' : '#059669'
      }
      const currentBalance = equityData[equityData.length - 1]?.value || initialBalance
      if (currentBalance < initialBalance) {
        return isDark ? '#ef4444' : '#dc2626'
      }
      return isDark ? '#10b981' : '#059669'
    }

    const lineColor = getLineColor()
    const isPositive = !initialBalance || (equityData[equityData.length - 1]?.value || 0) >= initialBalance

    // Calculate percentage change from initial balance
    const getPercentageChange = (value: number) => {
      if (!initialBalance || initialBalance === 0) return 0
      return ((value - initialBalance) / initialBalance) * 100
    }

    const currentBalance = equityData.length > 0 ? equityData[equityData.length - 1]?.value : initialBalance || 0
    const percentageChange = getPercentageChange(currentBalance)

    // Calculate Y-axis labels
    const yAxisLabels = []
    const numLabels = 5
    for (let i = 0; i <= numLabels; i++) {
      const value = adjustedMin + (adjustedMax - adjustedMin) * (1 - i / numLabels)
      yAxisLabels.push(value)
    }

    return (
      <div 
        ref={this.containerRef}
        className={`w-full h-full rounded-xl relative overflow-hidden ${
          isDark 
            ? 'bg-slate-900 border border-slate-800' 
            : 'bg-white border border-slate-200 shadow-sm'
        }`}
        style={{ minHeight: '320px' }}
      >
        {/* Header Section */}
        <div className={`px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className={`flex items-center justify-between ${embed ? 'mb-1' : 'mb-2'}`}>
            {!embed ? (
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Equity Curve
              </h3>
            ) : (
              <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Equity Curve
              </span>
            )}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                isPositive 
                  ? (isDark ? 'bg-emerald-500' : 'bg-emerald-600')
                  : (isDark ? 'bg-red-500' : 'bg-red-600')
              }`}></div>
              <span className={`text-xs font-medium ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                {isPositive ? 'Profit' : 'Loss'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <div className={`text-2xl sm:text-3xl font-bold ${
                currentBalance >= (initialBalance || 0)
                  ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                  : (isDark ? 'text-red-400' : 'text-red-600')
              }`}>
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-xs mt-1 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                Current Balance
              </div>
              {initialBalance && (
                <div className="mt-1">
                  <div className={`text-xs font-medium ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Initial: ${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
            {initialBalance && (
              <div className="ml-auto text-right">
                <div className={`text-lg sm:text-xl font-semibold ${
                  percentageChange >= 0
                    ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                    : (isDark ? 'text-red-400' : 'text-red-600')
                }`}>
                  {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%
                </div>
                <div className={`text-xs mt-1 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  {percentageChange >= 0 ? 'Gain' : 'Loss'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart Area */}
        <div className="relative px-4 sm:px-6 py-4" style={{ height: 'calc(100% - 120px)', minHeight: '200px' }}>
          <svg
            ref={this.svgRef}
            viewBox="0 0 100 100"
            className="w-full h-full cursor-crosshair"
            preserveAspectRatio="none"
            onMouseMove={this.handleMouseMove}
            onMouseLeave={this.handleMouseLeave}
          >
            <defs>
              {/* Gradient for area fill */}
              <linearGradient id={this.gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isPositive 
                  ? (isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)')
                  : (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(220, 38, 38, 0.3)')
                } />
                <stop offset="100%" stopColor={isPositive 
                  ? (isDark ? 'rgba(16, 185, 129, 0)' : 'rgba(16, 185, 129, 0)')
                  : (isDark ? 'rgba(239, 68, 68, 0)' : 'rgba(220, 38, 38, 0)')
                } />
              </linearGradient>
              
              {/* Glow filter for line */}
              <filter id={`glow-${this.gradientId}`}>
                <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke={isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}
                strokeWidth="0.5"
              />
            ))}
            
            {/* Y-axis labels background */}
            {yAxisLabels.map((_value, idx) => {
              const y = 100 - (idx / (yAxisLabels.length - 1)) * 100
              return (
                <g key={`y-label-${idx}`}>
                  <line
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke={isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)'}
                    strokeWidth="0.5"
                    strokeDasharray="1,2"
                  />
                </g>
              )
            })}
            
            {/* Reference line for initial balance */}
            {initialBalance && equityData.length > 0 && (
              <line
                x1="0"
                y1={100 - ((initialBalance - adjustedMin) / range) * 100}
                x2="100"
                y2={100 - ((initialBalance - adjustedMin) / range) * 100}
                stroke={isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'}
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )}
            
            {/* Area fill */}
            {areaPathData && (
              <path
                d={areaPathData}
                fill={`url(#${this.gradientId})`}
                className="transition-opacity duration-300"
              />
            )}
            
            {/* Main line */}
            {pathData && (
              <path
                d={pathData}
                fill="none"
                stroke={lineColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#glow-${this.gradientId})`}
                className="transition-all duration-300"
              />
            )}

            {/* Invisible hit areas */}
            {points.map((point, index) => {
              const nextPoint = points[index + 1]
              if (!nextPoint) return null
              
              return (
                <line
                  key={`hit-${index}`}
                  x1={point.x}
                  y1={point.y}
                  x2={nextPoint.x}
                  y2={nextPoint.y}
                  stroke="transparent"
                  strokeWidth="10"
                  className="cursor-pointer"
                  style={{ pointerEvents: 'all' }}
                />
              )
            })}

            {/* Interactive points */}
            {points.map((point, index) => {
              const isHovered = hoveredIndex === index
              const isSelected = selectedIndex === index
              const shouldShow = isHovered || isSelected
              
              return (
                <g key={index}>
                  {shouldShow && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="7"
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2"
                      opacity="0.4"
                      className="animate-pulse"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={shouldShow ? 4.5 : 0}
                    fill={lineColor}
                    stroke={isDark ? '#0f172a' : '#ffffff'}
                    strokeWidth={shouldShow ? 2 : 0}
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => this.handlePointClick(index)}
                    style={{ 
                      opacity: shouldShow ? 1 : 0,
                      transition: 'all 0.2s ease',
                      filter: shouldShow ? 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' : 'none'
                    }}
                  />
                </g>
              )
            })}

            {/* Guide lines */}
            {displayPoint && (
              <>
                <line
                  x1={displayPoint.x}
                  y1="0"
                  x2={displayPoint.x}
                  y2="100"
                  stroke={isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(148, 163, 184, 0.7)'}
                  strokeWidth={selectedPoint ? "1.5" : "1"}
                  strokeDasharray={selectedPoint ? "2,2" : "4,4"}
                  className="transition-all duration-200"
                />
                <line
                  x1="0"
                  y1={displayPoint.y}
                  x2="100"
                  y2={displayPoint.y}
                  stroke={isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'}
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  className="transition-all duration-200"
                />
              </>
            )}
          </svg>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-4 bottom-4 w-12 sm:w-16 flex flex-col justify-between pointer-events-none">
            {yAxisLabels.map((value, idx) => (
              <div
                key={`y-label-${idx}`}
                className={`text-[9px] sm:text-[10px] font-medium ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                ${(value / 1000).toFixed(1)}K
              </div>
            ))}
          </div>
        </div>
        
        {/* Tooltip */}
        {displayPoint && tooltipPosition && (
          <div
            className={`absolute z-30 px-4 py-3 rounded-lg shadow-2xl border pointer-events-none whitespace-nowrap backdrop-blur-md transition-all duration-200 ${
              selectedPoint 
                ? (isDark ? 'bg-slate-800/98 border-slate-600/70' : 'bg-white/98 border-slate-300/70')
                : (isDark
                  ? 'bg-slate-900/95 border-slate-700/60'
                  : 'bg-white/95 border-slate-300/60')
            }`}
            style={{
              left: `${Math.min(Math.max(tooltipPosition.x, 100), window.innerWidth - 200)}px`,
              top: `${tooltipPosition.y - 90}px`,
              transform: 'translateX(-50%)'
            }}
          >
            {selectedPoint && (
              <div className={`text-[10px] font-semibold mb-1.5 px-2 py-0.5 rounded ${
                isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}>
                SELECTED
              </div>
            )}
            <div className={`text-xs font-medium mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {(() => {
                // Parse date string (YYYY-MM-DD) in local timezone to avoid timezone shifts
                const [year, month, day] = displayPoint.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return date.toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })
              })()}
            </div>
            <div className={`text-xl font-bold mb-1 ${
              displayPoint.value >= (initialBalance || 0)
                ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                : (isDark ? 'text-red-400' : 'text-red-600')
            }`}>
              ${displayPoint.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {initialBalance && (
              <div className={`text-xs font-medium ${
                getPercentageChange(displayPoint.value) >= 0
                  ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                  : (isDark ? 'text-red-400' : 'text-red-600')
              }`}>
                {getPercentageChange(displayPoint.value) >= 0 ? '+' : ''}{getPercentageChange(displayPoint.value).toFixed(2)}%
              </div>
            )}
          </div>
        )}
        
        {/* Footer with stats */}
        <div className={`px-4 sm:px-6 py-3 border-t ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex justify-between items-center text-xs">
            <div>
              <div className={`font-medium mb-0.5 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                Min
              </div>
              <div className={`font-semibold ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                ${minValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            {initialBalance && (
              <div className="text-center">
                <div className={`font-medium mb-0.5 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  Starting
                </div>
                <div className={`font-semibold ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  ${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            )}
            <div className="text-right">
              <div className={`font-medium mb-0.5 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                Max
              </div>
              <div className={`font-semibold ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                ${maxValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default EquityCurve
