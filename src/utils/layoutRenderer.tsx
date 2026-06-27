import { TradingLayout } from '../types/tradingLayout'

export const renderLayout = (
  layout: TradingLayout,
  chartElement: JSX.Element,
  panelElement: JSX.Element
) => {
  switch (layout.type) {
    case 'chart-left':
      return (
        <div className="w-full h-full">
          {/* Single responsive container - chart rendered once */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6" style={{ height: '100%', minHeight: '600px' }}>
            {/* Chart - single instance, works for both mobile and desktop */}
            <div 
              className="w-full flex flex-col" 
              style={{ 
                gridColumn: `span ${Math.round((layout.chartSize / 100) * 12)}`, 
                height: '100%', 
                minHeight: 0 
              }}
            >
              <div style={{ 
                flex: layout.chartHeight ? `${layout.chartHeight} 1 0%` : '1 1 100%',
                minHeight: 0,
                height: '100%'
              }}>
                {chartElement}
              </div>
              {layout.chartHeight && layout.chartHeight < 100 && (
                <div style={{ 
                  flex: `${100 - layout.chartHeight} 1 0%`,
                  minHeight: 0
                }}></div>
              )}
            </div>
            {/* Panel */}
            <div 
              className="w-full" 
              style={{ 
                gridColumn: `span ${Math.round((layout.panelSize / 100) * 12)}`, 
                height: '100%', 
                minHeight: 0 
              }}
            >
              {panelElement}
            </div>
          </div>
        </div>
      )
    
    case 'chart-right':
      return (
        <div className="w-full h-full">
          {/* Single responsive container - chart rendered once */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6" style={{ height: '100%', minHeight: '600px' }}>
            {/* Panel */}
            <div 
              className="w-full order-2 lg:order-1" 
              style={{ 
                gridColumn: `span ${Math.round((layout.panelSize / 100) * 12)}`, 
                height: '100%', 
                minHeight: 0 
              }}
            >
              {panelElement}
            </div>
            {/* Chart - single instance, works for both mobile and desktop */}
            <div 
              className="w-full flex flex-col order-1 lg:order-2" 
              style={{ 
                gridColumn: `span ${Math.round((layout.chartSize / 100) * 12)}`, 
                height: '100%', 
                minHeight: 0 
              }}
            >
              <div style={{ 
                flex: layout.chartHeight ? `${layout.chartHeight} 1 0%` : '1 1 100%',
                minHeight: 0,
                height: '100%'
              }}>
                {chartElement}
              </div>
              {layout.chartHeight && layout.chartHeight < 100 && (
                <div style={{ 
                  flex: `${100 - layout.chartHeight} 1 0%`,
                  minHeight: 0
                }}></div>
              )}
            </div>
          </div>
        </div>
      )
    
    case 'chart-top':
      return (
        <div className="flex flex-col" style={{ height: '100%', minHeight: '600px' }}>
          <div style={{ 
            flex: `${layout.chartSize} 1 0%`,
            minHeight: '200px',
            overflow: 'hidden'
          }}>{chartElement}</div>
          <div style={{ 
            flex: `${layout.panelSize} 1 0%`,
            minHeight: '150px',
            overflow: 'hidden'
          }}>{panelElement}</div>
        </div>
      )
    
    case 'chart-bottom':
      return (
        <div className="flex flex-col" style={{ height: '100%', minHeight: '600px' }}>
          <div style={{ 
            flex: `${layout.panelSize} 1 0%`,
            minHeight: '150px',
            overflow: 'hidden'
          }}>{panelElement}</div>
          <div style={{ 
            flex: `${layout.chartSize} 1 0%`,
            minHeight: '200px',
            overflow: 'hidden'
          }}>{chartElement}</div>
        </div>
      )
    
    case 'chart-full':
      return (
        <div className="space-y-4 sm:space-y-6">
          <div>{chartElement}</div>
          <div className="max-w-md mx-auto">{panelElement}</div>
        </div>
      )
    
    default:
      return (
        <div className="w-full h-full">
          {/* Single responsive container - chart rendered once */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6" style={{ height: '100%', minHeight: '600px' }}>
            {/* Chart - single instance */}
            <div 
              className="w-full" 
              style={{ 
                gridColumn: `span ${Math.round((layout.chartSize || 66) / 100 * 12)}`,
                height: '100%',
                minHeight: 0
              }}
            >
              {chartElement}
            </div>
            {/* Panel */}
            <div 
              className="w-full" 
              style={{ 
                gridColumn: `span ${Math.round((layout.panelSize || 34) / 100 * 12)}`,
                height: '100%',
                minHeight: 0
              }}
            >
              {panelElement}
            </div>
          </div>
        </div>
      )
  }
}

/** Practice trade: chart fills space; optional fixed-width order pad on the right. */
export const renderPracticeTradeLayout = (
  chartElement: JSX.Element,
  panelElement: JSX.Element | null,
  options?: {
    panelWidth?: number
    mobileScalpBar?: JSX.Element | null
    /** When false, chart uses full height and quick trade sits on the bottom edge (no nav gap). */
    showMobileNav?: boolean
    /** When false, the right column is a bare flex host (nested panels supply their own frames). */
    panelFrame?: boolean
  }
) => {
  const panelWidth = options?.panelWidth ?? 332
  const mobileScalpBar = options?.mobileScalpBar ?? null
  const panelFrame = options?.panelFrame !== false
  const reserveMobileNavGap = Boolean(mobileScalpBar && options?.showMobileNav !== false)
  const mobileNavPadClass = reserveMobileNavGap
    ? 'max-lg:pb-[calc(2.25rem+max(0.25rem,env(safe-area-inset-bottom)))]'
    : ''
  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 min-w-0 w-full h-full gap-0 lg:gap-4 pr-0 lg:pr-2">
      <div
        className={`flex flex-col min-w-0 w-full flex-1 min-h-0 gap-0 lg:gap-3 ${mobileNavPadClass}`}
      >
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {chartElement}
        </div>
        {mobileScalpBar ? (
          <div className="lg:hidden relative z-30 shrink-0 min-h-0">{mobileScalpBar}</div>
        ) : null}
      </div>
      {panelElement != null && (
        <div
          className={
            panelFrame
              ? 'hidden lg:flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90'
              : 'hidden lg:flex h-full min-h-0 shrink-0 flex-col overflow-hidden gap-3'
          }
          style={{ width: panelWidth }}
        >
          {panelElement}
        </div>
      )}
    </div>
  )
}
