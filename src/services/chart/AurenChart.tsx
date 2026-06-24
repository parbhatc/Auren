import { CSSProperties, useEffect, useId, useRef } from 'react'
import type { AurenChartProps } from '../../types/chart'
import { TradeseaDatafeed } from '../tradesea/TradeseaDatafeed'
import { TradeseaMdsClient } from '../tradesea/TradeseaMdsClient'
import type { TradeseaStreamConfig } from '../../api/tradesea.api'
import {
  bwcHasExecutionShapes,
  bwcHasOrderLines,
  createBwcDatafeed,
  type BwcWidget,
} from './bwcDatafeed'
import { loadAurenChartBoot } from './loadAurenChartBoot'
import {
  bindBwcTradeContextHooks,
  clearChartContextActions,
  registerTradeContextActions,
} from '../../components/common/aurenTradeContextMenu'
import { setupChartKeyboardShortcuts } from '../../components/common/chartKeyboardShortcuts'
import { schedulePageScrollReset } from '../../utils/resetPageScroll'
import { debugPracticeChartSymbol } from '../tradesea/practiceChartSymbolDebug'
import { candleDebug } from '../tradesea/candleDebug'
import { DEFAULT_PRACTICE_CHART_SYMBOL } from '../../constants/practice'
import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'

type ChartTradeHandler = NonNullable<AurenChartProps['tradeseaTradeHandler']>
export type AurenChartServices = {
  mds?: TradeseaMdsClient
  trades?: unknown
  datafeed: TradeseaDatafeed
  streamConfig: TradeseaStreamConfig | { delayed: boolean }
  accountId: string
}

/** After MDS resubscribeAll (~150ms) before forcing a BWC history reload. */
const CHART_RELOAD_AFTER_MDS_OPEN_MS = 500

function chartShellHtml(chartId: string): string {
  return `
    <div class="tv-app" style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0">
      <header class="tv-toolbar" aria-label="Chart toolbar">
        <div class="tv-toolbar__left">
          <div class="tv-symbol" id="symbol-picker">
            <button type="button" class="tv-symbol__trigger" id="symbol-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="tv-symbol__ticker" id="symbol-ticker">—</span>
              <svg class="tv-symbol__chev" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path fill="currentColor" d="M1 1l4 4 4-4"/></svg>
            </button>
            <div class="tv-symbol__dropdown" id="symbol-dropdown" hidden>
              <input type="text" class="tv-symbol__search" id="symbol-search" placeholder="Search symbol…" autocomplete="off" spellcheck="false" />
              <ul class="tv-symbol__list" id="symbol-list" role="listbox"></ul>
            </div>
          </div>
          <div class="tv-toolbar__sep" aria-hidden="true"></div>
          <div id="timeframe-picker" class="tv-tf"></div>
        </div>
        <div class="tv-toolbar__right"></div>
      </header>
      <div class="tv-workspace" style="flex:1;min-height:0">
        <aside id="drawing-toolbar" class="drawing-toolbar" aria-label="Drawing tools"></aside>
        <main class="tv-stage" aria-busy="true" style="flex:1;min-height:0">
          <div class="app-loader app-loader--hidden" id="app-loader" role="status" aria-label="Loading chart">
            <div class="app-loader__spinner" aria-hidden="true"></div>
          </div>
          <div class="tv-chart-wrap" style="height:100%">
            <div class="tv-chart-wrap__stage" style="height:100%">
              <div class="tv-watermark" aria-hidden="true"><span class="tv-watermark__text" id="watermark"></span></div>
              <div id="${chartId}" style="width:100%;height:100%"></div>
              <div class="status-line tv-ohlc" id="ohlc" aria-live="polite"></div>
            </div>
            <footer class="tv-chart-bottom-bar" aria-label="Chart bottom bar">
              <div class="tv-chart-bottom-bar__grow"></div>
              <div class="tv-chart-bottom-bar__right" id="chart-bottom-toolbar"></div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  `
}

function resolveInitialSymbol(symbolProp: string | undefined): string {
  const trimmed = String(symbolProp || '').trim()
  if (trimmed) {
    return chartSymbolToProductRoot(trimmed) || trimmed
  }
  return chartSymbolToProductRoot(DEFAULT_PRACTICE_CHART_SYMBOL) || 'MNQ'
}

function wireTradeContextActions(handler: ChartTradeHandler): void {
  const placeLimit = handler.placeLimitOrder?.bind(handler)

  registerTradeContextActions({
    onMarketBuy: (quantity) => {
      void handler.logButtonPress?.('Buy', { quantity, orderType: 'market' })
    },
    onMarketSell: (quantity) => {
      void handler.logButtonPress?.('Sell', { quantity, orderType: 'market' })
    },
    onLimitBuy: placeLimit
      ? (quantity, limitPrice) => {
          void placeLimit('buy', quantity, limitPrice)
        }
      : undefined,
    onStopSell: placeLimit
      ? (quantity, stopPrice) => {
          void placeLimit('sell', quantity, stopPrice)
        }
      : undefined,
  })
}

export default function AurenChart(props: AurenChartProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<BwcWidget | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const uid = useId().replace(/:/g, '')
  const chartId = `auren-chart-${uid}`

  const datafeedSource = (props.tradeseaServices as AurenChartServices | null | undefined)?.datafeed
  const mds = (props.tradeseaServices as AurenChartServices | null | undefined)?.mds
  const mdsHadConnectedRef = useRef(false)
  const chartReloadInFlightRef = useRef(false)
  const chartReloadQueuedRef = useRef(false)

  useEffect(() => {
    if (!mds || !datafeedSource) return
    if (mds.getConnectionState() === 'connected') {
      mdsHadConnectedRef.current = true
    }

    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const runChartReload = async () => {
      const widget = widgetRef.current
      if (!widget?.reset) return
      if (chartReloadInFlightRef.current) {
        chartReloadQueuedRef.current = true
        return
      }
      chartReloadInFlightRef.current = true
      try {
        datafeedSource.clearHistoryCache()
        candleDebug.chartReload()
        await widget.reset({ data: true })
        candleDebug.chartReloadDone()
      } catch (err) {
        console.warn('[AurenChart] MDS reconnect chart reload failed:', err)
      } finally {
        chartReloadInFlightRef.current = false
        if (chartReloadQueuedRef.current) {
          chartReloadQueuedRef.current = false
          void runChartReload()
        }
      }
    }

    const off = mds.on('open', () => {
      if (!mdsHadConnectedRef.current) {
        mdsHadConnectedRef.current = true
        return
      }
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        void runChartReload()
      }, CHART_RELOAD_AFTER_MDS_OPEN_MS)
    })

    return () => {
      off()
      if (reloadTimer) clearTimeout(reloadTimer)
    }
  }, [mds, datafeedSource])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    shell.innerHTML = chartShellHtml(chartId)
    const mount = shell.querySelector(`#${chartId}`) as HTMLElement | null
    if (!mount) return

    let cancelled = false

    if (!datafeedSource) return

    const liveProps = propsRef.current
    const practiceAccountId = String(liveProps.practiceAccountId || '').trim()
    const initialSymbol = resolveInitialSymbol(liveProps.symbol)
    const resolution = String(liveProps.timeframe || '1')
    const theme = liveProps.isDark === false ? 'light' : 'dark'

    debugPracticeChartSymbol('AurenChart.init', { initialSymbol, resolution, practiceAccountId }, { force: true })

    void (async () => {
      try {
        const {
          registerAurenChartIndicators,
          bootChart,
          registerTradeContextActions: bwcRegisterTradeContext,
          clearChartContextActions: bwcClearTradeContext,
        } = await loadAurenChartBoot()

        bindBwcTradeContextHooks({
          registerTradeContextActions: bwcRegisterTradeContext,
          clearChartContextActions: bwcClearTradeContext,
        })

        await registerAurenChartIndicators()
        if (cancelled) return

        const handler = propsRef.current.tradeseaTradeHandler

        const notifySymbolChange = (sym: string) => {
          if (cancelled) return
          handler?.handleSymbolChange(sym)
          propsRef.current.onSymbolChange?.(sym)
        }

        const datafeed = createBwcDatafeed(datafeedSource)
        const widget = (await bootChart({
          mount,
          symbol: initialSymbol,
          resolution,
          theme,
          drawings: true,
          chrome: true,
          replay: false,
          datafeed,
          onSymbolChange: notifySymbolChange,
        })) as BwcWidget

        if (cancelled) {
          widget.destroy?.()
          return
        }

        widgetRef.current = widget

        if (!bwcHasOrderLines(widget)) {
          console.warn(
            '[AurenChart] widget.chart().createOrderLine missing — update betterweightchart (github:parbhatc/BetterweightChart)'
          )
        }
        if (!bwcHasExecutionShapes(widget)) {
          console.warn(
            '[AurenChart] widget.chart().createExecutionShape missing — update betterweightchart (github:parbhatc/BetterweightChart)'
          )
        }

        if (handler) {
          wireTradeContextActions(handler)
        }

        handler?.onReady(widget, datafeedSource)
        setupChartKeyboardShortcuts(widget)
        datafeedSource.setChartSymbolChangeRequest?.((symbol) => {
          const next = chartSymbolToProductRoot(symbol) || symbol
          if (!next || next === widget.getSymbol?.()) return
          void widget.setSymbol(next)
        })

        const sym = widget.getSymbol?.() ?? initialSymbol
        const res = widget.getResolution?.() ?? resolution
        candleDebug.chartReady(sym, res)
        notifySymbolChange(sym)

        await propsRef.current.onChartReady?.()
      } catch (err) {
        console.error('[AurenChart] boot failed:', err)
      }
    })()

    return () => {
      cancelled = true
      clearChartContextActions()
      bindBwcTradeContextHooks({
        registerTradeContextActions: () => {},
        clearChartContextActions: () => {},
      })
      widgetRef.current?.destroy?.()
      widgetRef.current = null
      datafeedSource.teardownCandleStreams()
      datafeedSource.setChartSymbolChangeRequest?.(null)
      schedulePageScrollReset()
    }
  }, [chartId, datafeedSource, props.practiceAccountId])

  useEffect(() => {
    const widget = widgetRef.current
    if (!widget?.setSymbol) return

    const nextSymbol = resolveInitialSymbol(props.symbol)
    const current = widget.getSymbol?.()
    if (!nextSymbol || nextSymbol === current) return

    void widget.setSymbol(nextSymbol)
  }, [props.symbol, props.tradeseaServices])

  useEffect(() => {
    const handler = props.tradeseaTradeHandler
    if (!handler || !widgetRef.current) return
    wireTradeContextActions(handler)
  }, [props.tradeseaTradeHandler])

  const { style, className } = props
  return (
    <div
      ref={shellRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...style,
      } as CSSProperties}
    />
  )
}

export {
  prepareTradeseaChartServices,
  teardownTradeseaChartServices,
  type TradeseaChartServices,
} from '../tradesea/TradeseaChart'
