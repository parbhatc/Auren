import { CSSProperties, useEffect, useId, useRef } from 'react'
import type { AurenChartProps, IDatafeedChartApi } from '../../types/chart'
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
import { CHART_ORDER_LINE_THEME } from '../../constants/chartOrderLineTheme'
import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'

type ChartTradeHandler = NonNullable<AurenChartProps['tradeseaTradeHandler']>
export type AurenChartServices = {
  mds?: TradeseaMdsClient
  trades?: unknown
  datafeed: IDatafeedChartApi & {
    refreshMdsSubscriptions?(): void
    clearHistoryCache?(): void
    teardownCandleStreams?(): void
    setChartSymbolChangeRequest?(callback: ((symbol: string) => void) | null): void
  }
  streamConfig: TradeseaStreamConfig | { delayed: boolean }
  accountId: string
}

/** Brief pause after MDS resubscribe before forcing a BWC history reload. */
const CHART_RELOAD_AFTER_MDS_RESUBSCRIBE_MS = 200
const CHART_RELOAD_WIDGET_RETRY_MS = 250
const CHART_RELOAD_WIDGET_RETRY_MAX = 24
const DEV_CHART_CACHE_CLEARED_KEY = 'auren.dev.chart.cache.cleared.v1'

function isLocalDevPracticeTradeRoute(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  return isLocal && window.location.pathname.startsWith('/practice/trade/')
}

function clearLocalDevChartCachesOnce(): boolean {
  if (!isLocalDevPracticeTradeRoute()) return false
  if (typeof window === 'undefined') return false
  if (window.sessionStorage.getItem(DEV_CHART_CACHE_CLEARED_KEY) === '1') return false

  const shouldClearKey = (k: string): boolean => {
    const key = String(k || '').toLowerCase()
    return key.includes('bwc') || key.includes('betterweight') || key.includes('tradingview')
  }

  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i)
      if (!key || !shouldClearKey(key)) continue
      window.localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }

  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i)
      if (!key || !shouldClearKey(key)) continue
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // ignore
  }

  try {
    if (typeof caches !== 'undefined') {
      void caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
    }
  } catch {
    // ignore
  }

  window.sessionStorage.setItem(DEV_CHART_CACHE_CLEARED_KEY, '1')
  return true
}

function purgeOrphanedBwcFloatingToolbars(): void {
  if (typeof document === 'undefined') return
  const selectors = [
    '.tv-floating-toolbar',
    '.tv-drawing-edit-toolbar',
    '.tv-floating-toolbar__hint',
  ]
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el instanceof HTMLElement) {
        el.remove()
      }
    })
  }
}

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

/** BWC persists the last chart symbol per pane under this localStorage key. */
const BWC_PANE_SYMBOLS_KEY = 'tv-pane-symbols'

function loadBwcSavedSymbol(): string | null {
  try {
    const raw = localStorage.getItem(BWC_PANE_SYMBOLS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Record<string, unknown>
    const sym = data?.['0']
    return typeof sym === 'string' && sym.trim() ? sym.trim().toUpperCase() : null
  } catch {
    return null
  }
}

/**
 * BWC's symbol picker requires a string during boot. A non-empty boot symbol
 * overrides BWC's own saved-symbol restore, so when no symbol prop is given
 * (practice mode) prefer the saved pane symbol; MNQ only for fresh layouts.
 */
function resolveInitialSymbol(symbolProp: string | undefined): string {
  const trimmed = String(symbolProp || '').trim()
  if (!trimmed) return loadBwcSavedSymbol() || 'MNQ'
  return chartSymbolToProductRoot(trimmed) || trimmed
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
  const mdsNeedsHistoryReloadRef = useRef(false)
  const chartReloadPendingRef = useRef(false)
  const chartReloadInFlightRef = useRef(false)
  const chartReloadQueuedRef = useRef(false)
  const runChartReloadRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    // Localhost only: clear stale BWC debug/layout settings and force one reload.
    const didClear = clearLocalDevChartCachesOnce()
    if (didClear) {
      window.location.reload()
    }
  }, [])

  useEffect(() => {
    if (!mds || !datafeedSource) return

    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    let widgetRetryTimer: ReturnType<typeof setTimeout> | null = null
    let widgetRetryCount = 0

    const clearWidgetRetry = () => {
      if (widgetRetryTimer) clearTimeout(widgetRetryTimer)
      widgetRetryTimer = null
      widgetRetryCount = 0
    }

    const scheduleChartReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        void runChartReloadRef.current?.()
      }, CHART_RELOAD_AFTER_MDS_RESUBSCRIBE_MS)
    }

    const scheduleWidgetRetry = () => {
      if (widgetRetryTimer || widgetRetryCount >= CHART_RELOAD_WIDGET_RETRY_MAX) return
      widgetRetryTimer = setTimeout(() => {
        widgetRetryTimer = null
        widgetRetryCount += 1
        void runChartReloadRef.current?.()
      }, CHART_RELOAD_WIDGET_RETRY_MS)
    }

    const runChartReload = async () => {
      const widget = widgetRef.current
      if (!widget?.reset) {
        chartReloadPendingRef.current = true
        scheduleWidgetRetry()
        return
      }
      if (mds.getConnectionState() !== 'connected') {
        chartReloadPendingRef.current = true
        return
      }

      chartReloadPendingRef.current = false
      clearWidgetRetry()

      if (chartReloadInFlightRef.current) {
        chartReloadQueuedRef.current = true
        return
      }
      chartReloadInFlightRef.current = true
      try {
        datafeedSource.refreshMdsSubscriptions?.()
        datafeedSource.clearHistoryCache?.()
        candleDebug.chartReload()
        await widget.reset({ data: true })
        candleDebug.chartReloadDone()
        mdsNeedsHistoryReloadRef.current = false
        // widget.reset replaces the candle listener after the reconnect's
        // first resubscribe burst. Reassert the resulting final registry so a
        // foreground resume cannot restore history but leave live data silent.
        mds.resendAllSubscriptions()
      } catch (err) {
        console.warn('[AurenChart] MDS reconnect chart reload failed:', err)
        chartReloadPendingRef.current = true
        scheduleWidgetRetry()
      } finally {
        chartReloadInFlightRef.current = false
        if (chartReloadQueuedRef.current) {
          chartReloadQueuedRef.current = false
          void runChartReload()
        }
      }
    }

    runChartReloadRef.current = runChartReload

    const offClose = mds.on('close', () => {
      mdsNeedsHistoryReloadRef.current = true
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = null
    })

    // A forced foreground reconnect detaches its old socket deliberately and
    // therefore may not produce a native close event. The connection state
    // transition still marks the chart for a data reset on the new socket.
    let hasConnected = mds.getConnectionState() === 'connected'
    const offConnection = mds.on('connection', (state) => {
      if (state === 'connected') {
        hasConnected = true
        return
      }
      if (!hasConnected) return
      mdsNeedsHistoryReloadRef.current = true
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = null
    })

    const offResubscribed = mds.on('resubscribed', () => {
      if (!mdsNeedsHistoryReloadRef.current) return
      scheduleChartReload()
    })

    return () => {
      offClose()
      offConnection()
      offResubscribed()
      runChartReloadRef.current = null
      if (reloadTimer) clearTimeout(reloadTimer)
      clearWidgetRetry()
    }
  }, [mds, datafeedSource])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    // Defensive cleanup in case a previous chart unmount leaked floating toolbar nodes.
    purgeOrphanedBwcFloatingToolbars()
    shell.innerHTML = chartShellHtml(chartId)
    const mount = shell.querySelector(`#${chartId}`) as HTMLElement | null
    if (!mount) return

    let cancelled = false
    let compactToolbarObserver: MutationObserver | null = null

    if (!datafeedSource) return

    const liveProps = propsRef.current
    const practiceAccountId = String(liveProps.practiceAccountId || '').trim()
    const initialSymbol = resolveInitialSymbol(liveProps.symbol)
    const resolution = String(liveProps.timeframe || '1')
    const theme = liveProps.isDark === false ? 'light' : 'dark'

    if (liveProps.compact) {
      shell.querySelector('.tv-workspace')?.classList.add('tv-workspace--no-draw')
      shell.querySelector('.tv-chart-bottom-bar')?.setAttribute('hidden', '')
      shell.querySelector('.status-line')?.setAttribute('hidden', '')
      purgeOrphanedBwcFloatingToolbars()
      compactToolbarObserver = new MutationObserver(purgeOrphanedBwcFloatingToolbars)
      compactToolbarObserver.observe(document.body, { childList: true, subtree: true })
    }

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
          drawings: liveProps.drawings !== false,
          persistDrawings: liveProps.persistDrawings !== false,
          chrome: liveProps.chrome !== false,
          replay: false,
          contextMenuHiddenActions: liveProps.compact
            ? ['remove-drawings', 'remove-indicators', 'settings']
            : [],
          datafeed,
          orderLineTheme: CHART_ORDER_LINE_THEME,
          onSymbolChange: notifySymbolChange,
        })) as BwcWidget

        if (cancelled) {
          widget.destroy?.()
          return
        }

        widgetRef.current = widget
        await propsRef.current.onWidgetReady?.(widget)

        if (chartReloadPendingRef.current || mdsNeedsHistoryReloadRef.current) {
          void runChartReloadRef.current?.()
        }

        if (!bwcHasOrderLines(widget)) {
          console.warn(
            '[AurenChart] widget.chart().createOrderLine missing — update betterweightchartpro (github:parbhatc/BetterweightChartPro)'
          )
        }
        if (!bwcHasExecutionShapes(widget)) {
          console.warn(
            '[AurenChart] widget.chart().createExecutionShape missing — update betterweightchartpro (github:parbhatc/BetterweightChartPro)'
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
      compactToolbarObserver?.disconnect()
      clearChartContextActions()
      bindBwcTradeContextHooks({
        registerTradeContextActions: () => {},
        clearChartContextActions: () => {},
      })
      widgetRef.current?.destroy?.()
      widgetRef.current = null
      purgeOrphanedBwcFloatingToolbars()
      datafeedSource.teardownCandleStreams?.()
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
