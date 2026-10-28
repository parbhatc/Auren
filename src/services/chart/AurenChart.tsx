import { CSSProperties, useContext, useEffect, useId, useRef } from 'react'
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
import { createChartResumeRecovery } from './chartResumeRecovery'
import {
  bindBwcTradeContextHooks,
  clearChartContextActions,
  registerTradeContextActions,
  requestChartAutoTrade,
} from '../../components/common/aurenTradeContextMenu'
import { setupChartKeyboardShortcuts } from '../../components/common/chartKeyboardShortcuts'
import { schedulePageScrollReset } from '../../utils/resetPageScroll'
import { debugPracticeChartSymbol } from '../tradesea/practiceChartSymbolDebug'
import { candleDebug } from '../tradesea/candleDebug'
import { CHART_ORDER_LINE_THEME } from '../../constants/chartOrderLineTheme'
import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'
import { registerAurenWidget } from '../../chart/aurenWidgetRegistry'
import { trackHistoryBroker, traceChartResume } from '../debug/historyRequestTrace'
import { LiveTradeViewActive } from '../../contexts/LiveTradeViewContext'

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

function purgeOrphanedBwcFloatingToolbars(compactShell?: HTMLElement): void {
  if (typeof document === 'undefined') return
  const compactOwner = compactShell?.querySelector('.tv-app')?.getAttribute('data-bwc-chart-host')
  const selectors = [
    '.tv-floating-toolbar',
    '.tv-drawing-edit-toolbar',
    '.tv-floating-toolbar__hint',
  ]
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el instanceof HTMLElement) {
        // Another chart may be retained behind the current route. Its owned
        // toolbars follow that widget's lifecycle, including hidden/visible.
        if (el.hasAttribute('data-bwc-portal-owned') &&
          (!compactOwner || el.getAttribute('data-bwc-portal-owned') !== compactOwner)) return
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
 * (practice mode) prefer the saved pane symbol; NQ only for fresh layouts.
 */
function resolveInitialSymbol(symbolProp: string | undefined): string {
  const trimmed = String(symbolProp || '').trim()
  if (!trimmed) return loadBwcSavedSymbol() || 'NQ'
  return chartSymbolToProductRoot(trimmed) || trimmed
}

function wireTradeContextActions(handler: ChartTradeHandler, accountId?: string): void {
  const placeLimit = handler.placeLimitOrder?.bind(handler)

  registerTradeContextActions({
    onMarketBuy: (quantity) => {
      void handler.logButtonPress?.('Buy', { quantity, orderType: 'market' })
    },
    onMarketSell: (quantity) => {
      void handler.logButtonPress?.('Sell', { quantity, orderType: 'market' })
    },
    onAutoBuy: () => requestChartAutoTrade('buy', accountId),
    onAutoSell: () => requestChartAutoTrade('sell', accountId),
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
  const viewActive = useContext(LiveTradeViewActive)
  const recoveryRef = useRef<ReturnType<typeof createChartResumeRecovery> | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<BwcWidget | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const uid = useId().replace(/:/g, '')
  const chartId = `auren-chart-${uid}`

  const datafeedSource = (props.tradeseaServices as AurenChartServices | null | undefined)?.datafeed
  const mds = (props.tradeseaServices as AurenChartServices | null | undefined)?.mds
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
    const recovery = createChartResumeRecovery({
      connection: mds,
      datafeed: datafeedSource,
      getWidget: () => widgetRef.current,
      viewActive,
      onReloadStart: () => candleDebug.chartReload(),
      onReloadDone: () => candleDebug.chartReloadDone(),
      onError: (error) => console.warn('[AurenChart] incremental history recovery failed:', error),
      onTrace: (phase, detail) => traceChartResume(phase, detail,
        import.meta.env.DEV && phase === 'complete' ? widgetRef.current?.getAllChartPanes?.() : undefined),
    })
    runChartReloadRef.current = recovery.reloadPending
    recoveryRef.current = recovery
    return () => {
      runChartReloadRef.current = null
      recovery.dispose()
      if (recoveryRef.current === recovery) recoveryRef.current = null
    }
  }, [mds, datafeedSource])

  useEffect(() => { recoveryRef.current?.setViewActive(viewActive) }, [viewActive])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    // Defensive cleanup in case a previous chart unmount leaked floating toolbar nodes.
    purgeOrphanedBwcFloatingToolbars()
    shell.innerHTML = chartShellHtml(chartId)
    const mount = shell.querySelector(`#${chartId}`) as HTMLElement | null
    if (!mount) return

    let cancelled = false
    let chartDatafeed: ReturnType<typeof createBwcDatafeed> | null = null
    let chartHandler: ChartTradeHandler | undefined
    let unregisterWidget: (() => void) | null = null
    let stopHistoryStats: (() => void) | null = null
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
      purgeOrphanedBwcFloatingToolbars(shell)
      compactToolbarObserver = new MutationObserver(() => purgeOrphanedBwcFloatingToolbars(shell))
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
        chartHandler = handler

        const notifySymbolChange = (sym: string) => {
          if (cancelled) return
          handler?.handleSymbolChange(sym)
          propsRef.current.onSymbolChange?.(sym)
        }

        const datafeed = createBwcDatafeed(datafeedSource)
        chartDatafeed = datafeed
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
        stopHistoryStats = trackHistoryBroker(widget.datafeed?.historyCache)
        unregisterWidget = registerAurenWidget(widget)
        await propsRef.current.onWidgetReady?.(widget)
        if (cancelled) return

        void runChartReloadRef.current?.()

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
          wireTradeContextActions(handler, liveProps.practiceAccountId || liveProps.accountId)
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
        chartDatafeed?.dispose()
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
      unregisterWidget?.()
      unregisterWidget = null
      if (widgetRef.current) chartHandler?.detachChart?.(widgetRef.current)
      widgetRef.current?.destroy?.()
      stopHistoryStats?.()
      stopHistoryStats = null
      widgetRef.current = null
      purgeOrphanedBwcFloatingToolbars()
      // The session retains history/symbol caches and live connections while
      // navigating away. Release only this widget's bar and quote listeners.
      chartDatafeed?.dispose()
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
    wireTradeContextActions(handler, props.practiceAccountId || props.accountId)
  }, [props.accountId, props.practiceAccountId, props.tradeseaTradeHandler])

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
