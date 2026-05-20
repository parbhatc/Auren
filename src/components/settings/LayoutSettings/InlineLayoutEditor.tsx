import { useState, useCallback, ReactElement, useRef, useEffect } from 'react'
import { RotateCcw, Save, BarChart3, Pause, SkipForward, Move } from 'lucide-react'
import { TradingLayout, InlineLayoutEditorProps, InlineLayoutEditorPropsWithComponents } from '../../../types/tradingLayout'
import { renderLayout } from '../../../utils/layoutRenderer'
import { saveLayout } from '../../../utils/tradingLayoutStorage'
import ContractQuantityControl from '../../common/ContractQuantityControl'
import TradeButtons from '../../common/TradeButtons'
import PositionButtons from '../../common/PositionButtons'

const InlineLayoutEditor = ({
  isDark,
  currentLayout,
  layoutCategory,
  onLayoutChange,
  onReset,
  chartComponent,
  panelComponent,
}: InlineLayoutEditorPropsWithComponents) => {
  const [hasChanges, setHasChanges] = useState(false)
  const [isDragging, setIsDragging] = useState<'chart' | 'panel' | null>(null)
  const [isResizing, setIsResizing] = useState<'chart' | 'panel' | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; layout: TradingLayout } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; layout: TradingLayout; direction: 'width' | 'height' | 'both' } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragThreshold = 20 // Minimum pixels to trigger layout change
  const [isMobile, setIsMobile] = useState(false)
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Mobile-friendly drag threshold (lower for easier triggering)
  const mobileDragThreshold = isMobile ? 15 : dragThreshold

  // Render actual chart component or fallback
  const renderChart = () => {
    if (chartComponent) {
      return (
        <div 
          className="w-full h-full" 
          style={{ 
            pointerEvents: 'auto', 
            height: '100%', 
            width: '100%',
            minHeight: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {chartComponent}
        </div>
      )
    }
    
    // Fallback template
    return (
      <div
        className={`w-full h-full flex flex-col rounded-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700'
            : 'bg-white/90 border-slate-200'
        }`}
        style={{ height: '100%', minHeight: '100%' }}
      >
        <div className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'} relative`}>
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="chart-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#chart-grid)" />
            </svg>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <BarChart3 className={`w-16 h-16 ${isDark ? 'text-blue-400/20' : 'text-blue-600/10'}`} />
          </div>
        </div>
      </div>
    )
  }

  // Render actual panel component or fallback
  const renderPanel = () => {
    if (panelComponent) {
      return (
        <div className="w-full h-full overflow-auto" style={{ pointerEvents: 'auto' }}>
          {panelComponent}
        </div>
      )
    }
    
    // Fallback template
    if (layoutCategory === 'backtester') {
      return (
        <div className={`w-full h-full flex flex-col space-y-3 sm:space-y-4 overflow-auto`}>
          <div
            className={`rounded-lg sm:rounded-xl shadow-lg border overflow-visible ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            <div className={`p-3 sm:p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Playback Controls
              </h3>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <button className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  isDark
                    ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Replay</span>
                </button>
                <button className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  isDark
                    ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/70 border border-blue-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                }`}>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                <button className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  isDark
                    ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}>
                  <SkipForward className="w-4 h-4" />
                  <span>Next</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div className={`w-full h-full flex flex-col space-y-3 sm:space-y-4 overflow-auto`}>
          <div
            className={`rounded-lg sm:rounded-xl shadow-lg border flex flex-col ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            <div className={`p-3 sm:p-4 border-b flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Trade
              </h3>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0">
              <ContractQuantityControl
                quantity={1}
                onQuantityChange={() => {}}
                onQuantityUpdate={() => {}}
                onQuantityInputChange={() => {}}
                onQuantityBlur={() => {}}
                isDark={isDark}
              />
              <TradeButtons
                onBuy={() => {}}
                onSell={() => {}}
                isDark={isDark}
              />
              <PositionButtons
                onClose={() => {}}
                onReverse={() => {}}
                onFlatten={() => {}}
                isDark={isDark}
              />
            </div>
          </div>
        </div>
      )
    }
  }

  const handleSave = useCallback(() => {
    saveLayout(currentLayout, layoutCategory)
    setHasChanges(false)
  }, [currentLayout, layoutCategory])

  // Handle drag start - drag component to change layout position (mouse and touch)
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, component: 'chart' | 'panel') => {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent body scroll on mobile while dragging
    if ('touches' in e) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      
      // Haptic feedback on mobile devices (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate(10)
      }
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsDragging(component)
    setDragStart({ x: clientX, y: clientY, layout: currentLayout })
  }, [currentLayout])


  // Simplified drag handler - change layout position
  const handleDrag = useCallback((deltaX: number, deltaY: number) => {
    if (!dragStart) return
    
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)
    
    // Use mobile-friendly threshold
    const threshold = isMobile ? mobileDragThreshold : dragThreshold
    
    // Only change layout if drag exceeds threshold
    if (absDeltaX < threshold && absDeltaY < threshold) return
    
    const isHorizontalDrag = absDeltaX > absDeltaY
    const currentType = dragStart.layout.type
    
    let newLayout: TradingLayout = { ...dragStart.layout }
    
    if (isHorizontalDrag) {
      // Horizontal drag - switch to left/right layout
      if (currentType === 'chart-top' || currentType === 'chart-bottom' || currentType === 'chart-full') {
        newLayout = {
          type: deltaX > 0 ? 'chart-right' : 'chart-left',
          chartSize: 66,
          panelSize: 34,
        }
      } else if (currentType === 'chart-left' && deltaX > threshold) {
        newLayout = {
          ...newLayout,
          type: 'chart-right',
        }
      } else if (currentType === 'chart-right' && deltaX < -threshold) {
        newLayout = {
          ...newLayout,
          type: 'chart-left',
        }
      }
    } else {
      // Vertical drag - switch to top/bottom layout
      if (currentType === 'chart-left' || currentType === 'chart-right' || currentType === 'chart-full') {
        newLayout = {
          type: deltaY > 0 ? 'chart-bottom' : 'chart-top',
          chartSize: 70,
          panelSize: 30,
        }
      } else if (currentType === 'chart-top' && deltaY > threshold) {
        newLayout = {
          ...newLayout,
          type: 'chart-bottom',
        }
      } else if (currentType === 'chart-bottom' && deltaY < -threshold) {
        newLayout = {
          ...newLayout,
          type: 'chart-top',
        }
      }
    }
    
    if (newLayout.type !== currentType) {
      onLayoutChange(newLayout)
      setHasChanges(true)
      setDragStart({ ...dragStart, layout: newLayout })
      
      // Haptic feedback on layout change (mobile)
      if (isMobile && 'vibrate' in navigator) {
        navigator.vibrate(20)
      }
    }
  }, [dragStart, dragThreshold, mobileDragThreshold, isMobile, onLayoutChange])

  // Simplified resize handler - always resizes both width and height simultaneously
  const handleResize = useCallback((deltaX: number, deltaY: number) => {
    if (!resizeStart || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const isHorizontalLayout = resizeStart.layout.type === 'chart-left' || resizeStart.layout.type === 'chart-right'
    
    let newLayout: TradingLayout = { ...resizeStart.layout }
    const containerWidth = containerRect.width
    const containerHeight = containerRect.height
    
    if (isHorizontalLayout) {
      // For horizontal layouts, resize both width (chartSize) and height (chartHeight)
      const chartWidth = resizeStart.layout.chartSize
      const currentChartHeight = resizeStart.layout.chartHeight || 100
      
      // Determine delta direction based on which component is being resized
      const widthDelta = isResizing === 'chart' ? deltaX : -deltaX
      const heightDelta = isResizing === 'chart' ? deltaY : -deltaY
      
      const newChartWidth = Math.max(20, Math.min(80, chartWidth + (widthDelta / containerWidth) * 100))
      const newChartHeight = Math.max(30, Math.min(100, currentChartHeight + (heightDelta / containerHeight) * 100))
      
      newLayout = {
        ...newLayout,
        chartSize: newChartWidth,
        panelSize: 100 - newChartWidth,
        chartHeight: newChartHeight,
      }
    } else {
      // For vertical layouts, resize chartSize/panelSize (which controls height split)
      // Width is full width, so we only adjust the height split
      const chartSize = resizeStart.layout.chartSize
      const heightDelta = isResizing === 'chart' ? deltaY : -deltaY
      const newChartSize = Math.max(20, Math.min(80, chartSize + (heightDelta / containerHeight) * 100))
      
      newLayout = {
        ...newLayout,
        chartSize: newChartSize,
        panelSize: 100 - newChartSize,
      }
    }
    
    onLayoutChange(newLayout)
    setHasChanges(true)
    setResizeStart({ ...resizeStart, layout: newLayout })
  }, [resizeStart, isResizing, onLayoutChange])

  // Handle mouse/touch move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        handleDrag(deltaX, deltaY)
      } else if (isResizing && resizeStart) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        handleResize(deltaX, deltaY)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      e.preventDefault()
      
      const clientX = e.touches[0].clientX
      const clientY = e.touches[0].clientY
      
      if (isDragging && dragStart) {
        const deltaX = clientX - dragStart.x
        const deltaY = clientY - dragStart.y
        handleDrag(deltaX, deltaY)
      } else if (isResizing && resizeStart) {
        const deltaX = clientX - resizeStart.x
        const deltaY = clientY - resizeStart.y
        handleResize(deltaX, deltaY)
      }
    }

    const handleEnd = () => {
      // Restore body scroll on mobile
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      
      setIsDragging(null)
      setIsResizing(null)
      setDragStart(null)
      setResizeStart(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      document.addEventListener('touchcancel', handleEnd)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleEnd)
        document.removeEventListener('touchcancel', handleEnd)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, handleDrag, handleResize])

  return (
    <div className="w-full h-full flex flex-col">
      {/* Editor Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="w-full sm:w-auto">
          <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="hidden sm:inline">💡 Drag blue/green buttons to reposition • Drag colored edges to resize • Changes save automatically</span>
            <span className="sm:hidden">💡 Drag buttons to move • Drag edges to resize</span>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={onReset}
            className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 ${
              isDark
                ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
            } transition-all`}
          >
            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Reset</span>
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 ${
                isDark
                  ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70 border border-green-700'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              } transition-all`}
            >
              <Save className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      <div
        className={`flex-1 rounded-lg sm:rounded-xl shadow-lg border ${
          isDark ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm' : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
        style={{ 
          minHeight: '600px',
          width: '100%',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Use renderLayout directly for rendering */}
        <div ref={containerRef} className="w-full h-full relative">
          {renderLayout(
            currentLayout,
            <div className="relative group" style={{ height: '100%', width: '100%', overflow: 'visible', position: 'relative' }}>
              {/* Enhanced drag handle - larger and more visible for mobile */}
              <div
                className={`absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 sm:px-4 sm:py-2.5 rounded-lg cursor-move select-none transition-all shadow-md ${
                  isDark 
                    ? 'bg-blue-600/90 hover:bg-blue-500 active:bg-blue-400 text-white border-2 border-blue-400' 
                    : 'bg-blue-500/90 hover:bg-blue-600 active:bg-blue-700 text-white border-2 border-blue-400'
                } ${isDragging === 'chart' ? 'ring-4 ring-blue-300/50 shadow-xl scale-110 opacity-100' : 'hover:shadow-lg hover:scale-105 active:scale-95'}`}
                style={{ 
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  minWidth: isMobile ? '56px' : '44px', // Larger touch target on mobile
                  minHeight: isMobile ? '56px' : '44px',
                  zIndex: 100,
                  cursor: 'grab',
                  ...(isDragging === 'chart' && { cursor: 'grabbing' }),
                }}
                onMouseDown={(e) => handleDragStart(e, 'chart')}
                onTouchStart={(e) => handleDragStart(e, 'chart')}
                title="Drag to reposition layout"
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Move className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
                  <span className={`${isMobile ? 'text-sm' : 'text-xs sm:text-sm'} font-medium ${isMobile ? '' : 'hidden sm:inline'}`}>
                    {isMobile ? 'Drag' : 'Drag'}
                  </span>
                </div>
              </div>

              {/* Enhanced resize handles - separate width and height handles */}
              {(() => {
                const isHorizontalLayout = currentLayout.type === 'chart-left' || currentLayout.type === 'chart-right'
                
                return (
                  <>
                    {/* Width resize handle - right edge for horizontal layouts - resizes both width and height */}
                    {isHorizontalLayout && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 right-0 ${isMobile ? 'w-12 h-20' : 'w-6 sm:w-8 h-12 sm:h-16'} cursor-nwse-resize flex items-center justify-center rounded-l-lg transition-all ${
                          isDark 
                            ? 'bg-blue-600/90 hover:bg-blue-500 active:bg-blue-400 border-2 border-blue-400 text-white' 
                            : 'bg-blue-500/90 hover:bg-blue-600 active:bg-blue-700 border-2 border-blue-400 text-white'
                        } ${isResizing === 'chart' ? 'ring-4 ring-blue-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px', // Larger touch target on mobile
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('chart')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('chart')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag to resize width and height"
                      >
                        <div className="flex flex-col gap-1">
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                        </div>
                      </div>
                    )}
                    
                    {/* Height resize handle - bottom edge for vertical layouts - resizes height */}
                    {!isHorizontalLayout && (
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${isMobile ? 'w-20 h-12' : 'w-12 sm:w-16 h-6 sm:h-8'} cursor-ns-resize flex items-center justify-center rounded-t-lg transition-all ${
                          isDark 
                            ? 'bg-blue-600/90 hover:bg-blue-500 active:bg-blue-400 border-2 border-blue-400 text-white' 
                            : 'bg-blue-500/90 hover:bg-blue-600 active:bg-blue-700 border-2 border-blue-400 text-white'
                        } ${isResizing === 'chart' ? 'ring-4 ring-blue-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px',
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('chart')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('chart')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag to resize height"
                      >
                        <div className="flex gap-1">
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                        </div>
                      </div>
                    )}
                    
                    {/* Height resize handle for horizontal layouts (chart height) - resizes both width and height */}
                    {isHorizontalLayout && (
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${isMobile ? 'w-20 h-12' : 'w-12 sm:w-16 h-6 sm:h-8'} cursor-nwse-resize flex items-center justify-center rounded-t-lg transition-all ${
                          isDark 
                            ? 'bg-purple-600/90 hover:bg-purple-500 active:bg-purple-400 border-2 border-purple-400 text-white' 
                            : 'bg-purple-500/90 hover:bg-purple-600 active:bg-purple-700 border-2 border-purple-400 text-white'
                        } ${isResizing === 'chart' ? 'ring-4 ring-purple-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px',
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('chart')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('chart')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag to resize width and height"
                      >
                        <div className="flex gap-1">
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                        </div>
                      </div>
                    )}
                    
                    {/* Corner resize handle - bottom-right for simultaneous width/height resize */}
                    {isHorizontalLayout && (
                      <div
                        className={`absolute bottom-0 right-0 ${isMobile ? 'w-14 h-14' : 'w-8 sm:w-10 h-8 sm:h-10'} cursor-nwse-resize flex items-center justify-center rounded-tl-lg transition-all ${
                          isDark 
                            ? 'bg-blue-600/90 hover:bg-blue-500 active:bg-blue-400 border-2 border-blue-400 text-white' 
                            : 'bg-blue-500/90 hover:bg-blue-600 active:bg-blue-700 border-2 border-blue-400 text-white'
                        } ${isResizing === 'chart' ? 'ring-4 ring-blue-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px',
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('chart')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('chart')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag corner to resize width and height"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex gap-0.5">
                            <div className={`w-1.5 h-1.5 rounded-sm ${isDark ? 'bg-white' : 'bg-white'}`} />
                            <div className={`w-1.5 h-1.5 rounded-sm ${isDark ? 'bg-white/50' : 'bg-white/50'}`} />
                          </div>
                          <div className="flex gap-0.5">
                            <div className={`w-1.5 h-1.5 rounded-sm ${isDark ? 'bg-white/50' : 'bg-white/50'}`} />
                            <div className={`w-1.5 h-1.5 rounded-sm ${isDark ? 'bg-white' : 'bg-white'}`} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
              
              {/* Visual feedback when dragging */}
              {isDragging === 'chart' && (
                <>
                  <div className={`absolute inset-0 z-40 pointer-events-none border-4 ${
                    isDark ? 'border-blue-400/50' : 'border-blue-500/50'
                  } rounded-lg bg-blue-500/10 animate-pulse`} />
                  {isMobile && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-4 py-2 rounded-lg ${
                      isDark ? 'bg-blue-600/90 text-white' : 'bg-blue-500/90 text-white'
                    } text-sm font-medium shadow-lg`}>
                      Dragging...
                    </div>
                  )}
                </>
              )}
              
              {/* Visual feedback when resizing */}
              {isResizing === 'chart' && (
                <>
                  <div className={`absolute inset-0 z-40 pointer-events-none border-4 ${
                    isDark ? 'border-blue-400/50' : 'border-blue-500/50'
                  } rounded-lg bg-blue-500/10 animate-pulse`} />
                  {isMobile && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-4 py-2 rounded-lg ${
                      isDark ? 'bg-blue-600/90 text-white' : 'bg-blue-500/90 text-white'
                    } text-sm font-medium shadow-lg`}>
                      Resizing...
                    </div>
                  )}
                </>
              )}
              
              {renderChart()}
            </div>,
            <div className="relative group" style={{ height: '100%', width: '100%', overflow: 'visible', position: 'relative' }}>
              {/* Enhanced drag handle - larger and more visible for mobile */}
              <div
                className={`absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 sm:px-4 sm:py-2.5 rounded-lg cursor-move select-none transition-all shadow-md ${
                  isDark 
                    ? 'bg-green-600/90 hover:bg-green-500 active:bg-green-400 text-white border-2 border-green-400' 
                    : 'bg-green-500/90 hover:bg-green-600 active:bg-green-700 text-white border-2 border-green-400'
                } ${isDragging === 'panel' ? 'ring-4 ring-green-300/50 shadow-xl scale-110 opacity-100' : 'hover:shadow-lg hover:scale-105 active:scale-95'}`}
                style={{ 
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  minWidth: isMobile ? '56px' : '44px', // Larger touch target on mobile
                  minHeight: isMobile ? '56px' : '44px',
                  zIndex: 100,
                  cursor: 'grab',
                  ...(isDragging === 'panel' && { cursor: 'grabbing' }),
                }}
                onMouseDown={(e) => handleDragStart(e, 'panel')}
                onTouchStart={(e) => handleDragStart(e, 'panel')}
                title="Drag to reposition layout"
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Move className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
                  <span className={`${isMobile ? 'text-sm' : 'text-xs sm:text-sm'} font-medium ${isMobile ? '' : 'hidden sm:inline'}`}>
                    {isMobile ? 'Drag' : 'Drag'}
                  </span>
                </div>
              </div>

              {/* Enhanced resize handles */}
              {(() => {
                const isHorizontalLayout = currentLayout.type === 'chart-left' || currentLayout.type === 'chart-right'
                
                return (
                  <>
                    {/* Width resize handle - left edge for horizontal layouts - resizes both width and height */}
                    {isHorizontalLayout && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 left-0 ${isMobile ? 'w-12 h-20' : 'w-6 sm:w-8 h-12 sm:h-16'} cursor-nwse-resize flex items-center justify-center rounded-r-lg transition-all ${
                          isDark 
                            ? 'bg-green-600/90 hover:bg-green-500 active:bg-green-400 border-2 border-green-400 text-white' 
                            : 'bg-green-500/90 hover:bg-green-600 active:bg-green-700 border-2 border-green-400 text-white'
                        } ${isResizing === 'panel' ? 'ring-4 ring-green-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px',
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('panel')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('panel')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag to resize width and height"
                      >
                        <div className="flex flex-col gap-1">
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                        </div>
                      </div>
                    )}
                    
                    {/* Height resize handle - top edge for vertical layouts - resizes height */}
                    {!isHorizontalLayout && (
                      <div
                        className={`absolute top-0 left-1/2 -translate-x-1/2 ${isMobile ? 'w-20 h-12' : 'w-12 sm:w-16 h-6 sm:h-8'} cursor-ns-resize flex items-center justify-center rounded-b-lg transition-all ${
                          isDark 
                            ? 'bg-green-600/90 hover:bg-green-500 active:bg-green-400 border-2 border-green-400 text-white' 
                            : 'bg-green-500/90 hover:bg-green-600 active:bg-green-700 border-2 border-green-400 text-white'
                        } ${isResizing === 'panel' ? 'ring-4 ring-green-300/50 scale-110 opacity-100' : 'opacity-100 hover:opacity-100 active:scale-95'}`}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          minWidth: isMobile ? '56px' : '44px',
                          minHeight: isMobile ? '56px' : '44px',
                          zIndex: 100,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsResizing('panel')
                          setResizeStart({ x: e.clientX, y: e.clientY, layout: currentLayout, direction: 'both' })
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // Prevent body scroll during resize
                          document.body.style.overflow = 'hidden'
                          document.body.style.touchAction = 'none'
                          
                          // Haptic feedback
                          if ('vibrate' in navigator) {
                            navigator.vibrate(10)
                          }
                          
                          setIsResizing('panel')
                          setResizeStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, layout: currentLayout, direction: 'both' })
                        }}
                        title="Drag to resize height"
                      >
                        <div className="flex gap-1">
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                          <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-white' : 'bg-white'}`} />
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
              
              {/* Visual feedback when dragging */}
              {isDragging === 'panel' && (
                <>
                  <div className={`absolute inset-0 z-40 pointer-events-none border-4 ${
                    isDark ? 'border-green-400/50' : 'border-green-500/50'
                  } rounded-lg bg-green-500/10 animate-pulse`} />
                  {isMobile && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-4 py-2 rounded-lg ${
                      isDark ? 'bg-green-600/90 text-white' : 'bg-green-500/90 text-white'
                    } text-sm font-medium shadow-lg`}>
                      Dragging...
                    </div>
                  )}
                </>
              )}
              
              {/* Visual feedback when resizing */}
              {isResizing === 'panel' && (
                <div className={`absolute inset-0 z-40 pointer-events-none border-4 ${
                  isDark ? 'border-green-400/50' : 'border-green-500/50'
                } rounded-lg bg-green-500/10`} />
              )}
              
              {renderPanel()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InlineLayoutEditor
