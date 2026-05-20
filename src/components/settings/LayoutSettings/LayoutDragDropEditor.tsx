import { useState, useEffect, useCallback } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import { Monitor, RotateCcw, Save, Pause, SkipForward, BarChart3, Minus, Plus } from 'lucide-react'

// LayoutItem type definition - using any to bypass type checking issues with react-grid-layout types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LayoutItem = any
import { TradingLayout, LayoutType, LayoutDragDropEditorProps } from '../../../types/tradingLayout'
import { saveLayout, LayoutType as StorageLayoutType } from '../../../utils/tradingLayoutStorage'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const LayoutDragDropEditor = ({
  isDark,
  currentLayout,
  layoutCategory,
  onLayoutChange,
  onReset,
}: LayoutDragDropEditorProps) => {
  const { isDark: themeIsDark } = useTheme()
  const colors = getThemeColors(themeIsDark)
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Convert TradingLayout to GridLayout format - more flexible
  const convertToGridLayout = useCallback((layout: TradingLayout): LayoutItem[] => {
    const layouts: LayoutItem[] = []
    
    if (layout.type === 'chart-full') {
      layouts.push({
        i: 'chart',
        x: 0,
        y: 0,
        w: 12,
        h: 8,
        minW: 4,
        minH: 3,
      })
      return layouts
    }

    // For horizontal layouts (chart-left, chart-right)
    if (layout.type === 'chart-left' || layout.type === 'chart-right') {
      const chartWidth = Math.round((layout.chartSize / 100) * 12)
      const panelWidth = 12 - chartWidth
      const chartHeight = layout.chartHeight ? Math.round((layout.chartHeight / 100) * 8) : 8
      
      if (layout.type === 'chart-left') {
        layouts.push({
          i: 'chart',
          x: 0,
          y: 0,
          w: chartWidth,
          h: chartHeight,
          minW: 4,
          minH: 3,
        })
        layouts.push({
          i: 'panel',
          x: chartWidth,
          y: 0,
          w: panelWidth,
          h: 8,
          minW: 3,
          minH: 3,
        })
      } else {
        layouts.push({
          i: 'panel',
          x: 0,
          y: 0,
          w: panelWidth,
          h: 8,
          minW: 3,
          minH: 3,
        })
        layouts.push({
          i: 'chart',
          x: panelWidth,
          y: 0,
          w: chartWidth,
          h: chartHeight,
          minW: 4,
          minH: 3,
        })
      }
    } else {
      // Vertical layouts (chart-top, chart-bottom)
      const chartHeight = Math.round((layout.chartSize / 100) * 8)
      const panelHeight = 8 - chartHeight
      
      if (layout.type === 'chart-top') {
        layouts.push({
          i: 'chart',
          x: 0,
          y: 0,
          w: 12,
          h: chartHeight,
          minW: 6,
          minH: 3,
        })
        layouts.push({
          i: 'panel',
          x: 0,
          y: chartHeight,
          w: 12,
          h: panelHeight,
          minW: 6,
          minH: 3,
        })
      } else {
        layouts.push({
          i: 'panel',
          x: 0,
          y: 0,
          w: 12,
          h: panelHeight,
          minW: 6,
          minH: 3,
        })
        layouts.push({
          i: 'chart',
          x: 0,
          y: panelHeight,
          w: 12,
          h: chartHeight,
          minW: 6,
          minH: 3,
        })
      }
    }

    return layouts
  }, [])

  // Convert GridLayout back to TradingLayout - supports any position
  const convertFromGridLayout = useCallback((layouts: LayoutItem[]): TradingLayout => {
    const chartLayout = layouts.find((l) => l.i === 'chart')
    const panelLayout = layouts.find((l) => l.i === 'panel')

    if (!chartLayout) {
      return { type: 'chart-full', chartSize: 100, panelSize: 0 }
    }

    if (!panelLayout) {
      return { type: 'chart-full', chartSize: 100, panelSize: 0 }
    }

    // Determine layout type based on positions
    const chartX = chartLayout.x
    const chartY = chartLayout.y
    const panelX = panelLayout.x
    const panelY = panelLayout.y

    let layoutType: LayoutType
    let chartSize: number
    let panelSize: number
    let chartHeight: number | undefined

    // Check if layouts are side-by-side (horizontal) or stacked (vertical)
    const isHorizontal = chartLayout.w < 12 && panelLayout.w < 12
    const isVertical = chartLayout.w === 12 && panelLayout.w === 12

    if (isVertical) {
      // Vertical layout
      if (chartY < panelY) {
        layoutType = 'chart-top'
      } else {
        layoutType = 'chart-bottom'
      }
      chartSize = Math.round((chartLayout.h / 8) * 100)
      panelSize = Math.round((panelLayout.h / 8) * 100)
    } else if (isHorizontal) {
      // Horizontal layout
      if (chartX < panelX) {
        layoutType = 'chart-left'
      } else {
        layoutType = 'chart-right'
      }
      chartSize = Math.round((chartLayout.w / 12) * 100)
      panelSize = Math.round((panelLayout.w / 12) * 100)
      
      // Calculate chart height if chart doesn't take full height
      if (chartLayout.h < 8) {
        chartHeight = Math.round((chartLayout.h / 8) * 100)
      }
    } else {
      // Fallback to chart-left
      layoutType = 'chart-left'
      chartSize = Math.round((chartLayout.w / 12) * 100)
      panelSize = Math.round((panelLayout.w / 12) * 100)
      if (chartLayout.h < 8) {
        chartHeight = Math.round((chartLayout.h / 8) * 100)
      }
    }

    return {
      type: layoutType,
      chartSize,
      panelSize,
      chartHeight,
    }
  }, [])

  useEffect(() => {
    const initialLayout = convertToGridLayout(currentLayout)
    setGridLayout(initialLayout)
    setHasChanges(false)
  }, [currentLayout, convertToGridLayout])

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      const layoutArray = Array.isArray(newLayout) ? newLayout : [newLayout]
      setGridLayout(layoutArray as LayoutItem[])
      setHasChanges(true)
      
      const updatedTradingLayout = convertFromGridLayout(layoutArray)
      onLayoutChange(updatedTradingLayout)
    },
    [convertFromGridLayout, onLayoutChange]
  )

  const handleSave = useCallback(() => {
    const updatedLayout = convertFromGridLayout(gridLayout)
    saveLayout(updatedLayout, layoutCategory)
    setHasChanges(false)
  }, [gridLayout, convertFromGridLayout, layoutCategory])

  const getGridWidth = () => {
    if (typeof window === 'undefined') return 1200
    return Math.min(window.innerWidth - 128, 1200)
  }

  const [gridWidth, setGridWidth] = useState(getGridWidth())

  useEffect(() => {
    const handleResize = () => {
      setGridWidth(getGridWidth())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Render realistic chart template with actual colors
  const renderChartTemplate = () => {
    return (
      <div
        className={`w-full h-full flex flex-col rounded-lg border-2 overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-blue-500/50 shadow-lg'
            : 'bg-white/90 border-blue-300 shadow-md'
        }`}
      >
        {/* Chart Header */}
        <div className={`p-2 border-b ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-blue-200 bg-blue-50/50'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Monitor className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              TradingView Chart
            </span>
          </div>
          <div className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-blue-100 text-blue-700'}`}>
            MNQ • 1m
          </div>
        </div>
        
        {/* Chart Area - Realistic */}
        <div className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'} relative overflow-hidden`}>
          {/* Simulated chart grid */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Simulated candlesticks */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 p-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div
                key={i}
                className={`w-3 ${i % 3 === 0 ? 'h-8' : i % 2 === 0 ? 'h-12' : 'h-6'} ${
                  i % 3 === 0
                    ? isDark ? 'bg-red-500/60' : 'bg-red-500/40'
                    : isDark ? 'bg-emerald-500/60' : 'bg-emerald-500/40'
                } rounded-sm`}
              />
            ))}
          </div>
          
          {/* Center indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 className={`w-12 h-12 ${isDark ? 'text-blue-400/30' : 'text-blue-600/20'}`} />
          </div>
        </div>
      </div>
    )
  }

  const renderPanelTemplate = () => {
    if (layoutCategory === 'backtester') {
      return (
        <div
          className={`w-full h-full flex flex-col rounded-lg border-2 overflow-hidden ${
            isDark
              ? 'bg-slate-800/90 border-slate-500/50 shadow-lg'
              : 'bg-white/90 border-slate-300 shadow-md'
          }`}
        >
          {/* Account Info Bar */}
          <div className={`p-2 border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Balance</div>
                <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>$50,000.00</div>
              </div>
              <div className={`h-6 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>RP&L</div>
                <div className={`font-bold text-green-500`}>+$1,234.56</div>
              </div>
              <div className={`h-6 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>UP&L</div>
                <div className={`font-bold text-red-500`}>-$123.45</div>
              </div>
            </div>
          </div>

          {/* Playback Controls */}
          <div className={`p-2 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Playback Controls
            </div>
            <div className="flex gap-1.5">
              <button className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                <RotateCcw className="w-3 h-3 mx-auto" />
              </button>
              <button className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium ${
                isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}>
                <Pause className="w-3 h-3 mx-auto" />
              </button>
              <button className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                <SkipForward className="w-3 h-3 mx-auto" />
              </button>
            </div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 4, 8].map((speed) => (
                <button
                  key={speed}
                  className={`flex-1 px-1 py-1 rounded text-[9px] ${
                    speed === 1
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                      : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
          
          {/* Trade Section */}
          <div className={`p-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} flex-1`}>
            <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Trade
            </div>
            
            {/* Contract Quantity */}
            <div className={`mb-2 p-1.5 rounded ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <div className={`text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Quantity</div>
              <div className="flex items-center gap-1">
                <button className={`p-0.5 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                  <Minus className={`w-3 h-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                </button>
                <input
                  type="text"
                  value="1"
                  readOnly
                  className={`w-full text-center text-xs font-semibold bg-transparent ${isDark ? 'text-white' : 'text-slate-900'}`}
                />
                <button className={`p-0.5 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                  <Plus className={`w-3 h-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                </button>
              </div>
            </div>
            
            {/* Buy/Sell Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button className={`py-2 rounded text-xs font-semibold ${
                isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
              }`}>
                Buy
              </button>
              <button className={`py-2 rounded text-xs font-semibold ${
                isDark ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
              }`}>
                Sell
              </button>
            </div>
            
            {/* Position Buttons */}
            <div className="space-y-1">
              <button className={`w-full py-1.5 rounded text-[10px] ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                Close Position
              </button>
              <button className={`w-full py-1.5 rounded text-[10px] ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                Reverse Position
              </button>
            </div>
          </div>
          
          {/* Economic News */}
          <div className={`p-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Economic News
            </div>
            <div className="space-y-1">
              {[1, 2].map((i) => (
                <div key={i} className={`p-1 rounded text-[9px] ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                  <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {i === 1 ? 'Fed Interest Rate Decision' : 'Non-Farm Payrolls'}
                  </div>
                  <div className={`text-[8px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {i === 1 ? '2:00 PM EST' : '8:30 AM EST'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div
          className={`w-full h-full flex flex-col rounded-lg border-2 overflow-hidden ${
            isDark
              ? 'bg-slate-800/90 border-slate-500/50 shadow-lg'
              : 'bg-white/90 border-slate-300 shadow-md'
          }`}
        >
          {/* Account Info Bar */}
          <div className={`p-2 border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Balance</div>
                <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>$50,000.00</div>
              </div>
              <div className={`h-6 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>RP&L</div>
                <div className={`font-bold text-green-500`}>+$1,234.56</div>
              </div>
              <div className={`h-6 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
              <div>
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>UP&L</div>
                <div className={`font-bold text-red-500`}>-$123.45</div>
              </div>
            </div>
          </div>

          {/* Trade Section */}
          <div className={`p-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} flex-1`}>
            <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Trade
            </div>
            
            {/* Contract Quantity */}
            <div className={`mb-2 p-1.5 rounded ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <div className={`text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Quantity</div>
              <div className="flex items-center gap-1">
                <button className={`p-0.5 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                  <Minus className={`w-3 h-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                </button>
                <input
                  type="text"
                  value="1"
                  readOnly
                  className={`w-full text-center text-xs font-semibold bg-transparent ${isDark ? 'text-white' : 'text-slate-900'}`}
                />
                <button className={`p-0.5 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`}>
                  <Plus className={`w-3 h-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                </button>
              </div>
            </div>
            
            {/* Buy/Sell Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button className={`py-2 rounded text-xs font-semibold ${
                isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
              }`}>
                Buy
              </button>
              <button className={`py-2 rounded text-xs font-semibold ${
                isDark ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
              }`}>
                Sell
              </button>
            </div>
            
            {/* Position Buttons */}
            <div className="space-y-1 mb-2">
              <button className={`w-full py-1.5 rounded text-[10px] ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                Close Position
              </button>
              <button className={`w-full py-1.5 rounded text-[10px] ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                Reverse Position
              </button>
              <button className={`w-full py-1.5 rounded text-[10px] ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
              }`}>
                Flatten All
              </button>
            </div>
          </div>
          
          {/* Economic News */}
          <div className={`p-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Economic News
            </div>
            <div className="space-y-1">
              {[1, 2].map((i) => (
                <div key={i} className={`p-1 rounded text-[9px] ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                  <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {i === 1 ? 'Fed Interest Rate Decision' : 'Non-Farm Payrolls'}
                  </div>
                  <div className={`text-[8px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {i === 1 ? '2:00 PM EST' : '8:30 AM EST'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Visual Layout Editor
          </h3>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Drag panels anywhere • Resize by dragging edges • Changes save automatically
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${colors.button.primary} transition-all`}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${colors.button.success} transition-all`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
        </div>
      </div>

      <div
        className={`rounded-lg border-2 p-4 ${
          isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
        style={{ minHeight: '600px' }}
      >
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore - react-grid-layout type definitions issue with Layout vs LayoutItem[] and cols prop */}
        <GridLayout
          {...({
            className: "layout",
            layout: gridLayout as any,
            cols: 12,
            rowHeight: 60,
            width: gridWidth,
            onLayoutChange: handleLayoutChange as any,
            isDraggable: true,
            isResizable: true,
            compactType: null,
            preventCollision: false,
            margin: [8, 8],
            allowOverlap: false
          } as any)}
        >
          {gridLayout.map((item) => (
            <div key={item.i}>
              {item.i === 'chart' ? renderChartTemplate() : renderPanelTemplate()}
            </div>
          ))}
        </GridLayout>
      </div>

      {/* Layout Info */}
      <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Layout Type:</span>
            <span className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentLayout.type.replace('chart-', '').charAt(0).toUpperCase() + 
               currentLayout.type.replace('chart-', '').slice(1)}
            </span>
          </div>
          <div>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Chart Size:</span>
            <span className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentLayout.chartSize}%
            </span>
          </div>
          <div>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Panel Size:</span>
            <span className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentLayout.panelSize}%
            </span>
          </div>
          {currentLayout.chartHeight && (
            <div>
              <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Chart Height:</span>
              <span className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentLayout.chartHeight}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LayoutDragDropEditor
