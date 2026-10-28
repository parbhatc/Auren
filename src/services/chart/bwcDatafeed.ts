import type { Bar, IDatafeedChartApi, LibrarySymbolInfo, ResolutionString } from '../../types/chart'
import { tradeseaResolutionToSeconds } from '../tradesea/tradeseaResolutions'
import { candleDebug } from '../tradesea/candleDebug'
import { librarySymbolDisplayName } from '../tradesea/tradeseaSymbolInfo'
import { traceHistoryRequest } from '../debug/historyRequestTrace'

type BwcResolution = { id: string; label: string; sec: number }

function resolutionLabel(id: string): string {
  const u = id.toUpperCase()
  if (u.endsWith('T')) return `${u.slice(0, -1)} tick`
  if (u.endsWith('S')) return `${u.slice(0, -1)}s`
  if (u === '1D' || u === 'D') return '1D'
  if (u === '1W' || u === 'W') return '1W'
  if (u === '1M' || u === 'M') return '1M'
  const mins = parseInt(id, 10)
  if (Number.isFinite(mins) && mins >= 60 && mins % 60 === 0) return `${mins / 60}h`
  return `${id}m`
}

function secForResolution(id: string): number {
  return tradeseaResolutionToSeconds(id)
}

function buildResolutions(source: IDatafeedChartApi, supported?: string[]): BwcResolution[] {
  const ids = supported?.length ? supported : ['1', '5', '15', '60', '1D']
  return ids.map((id) => ({
    id,
    label: resolutionLabel(id),
    sec: secForResolution(id),
  }))
}

function promisify<T>(fn: (cb: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      fn(resolve)
    } catch (err) {
      reject(err)
    }
  })
}

/** BWC expects Unix seconds; Tradesea feeds use ms (TV-style). */
function barTimeToSec(time: number): number {
  if (!Number.isFinite(time)) return Math.floor(Date.now() / 1000)
  return time > 1e12 ? Math.floor(time / 1000) : Math.floor(time)
}

function normalizeBarForBwc(bar: Bar): Bar {
  return { ...bar, time: barTimeToSec(bar.time) }
}

let chartDatafeedSequence = 0

/** Bridge a TradingView-style datafeed to BetterweightChartPro createCustomDatafeed. */
export function createBwcDatafeed(source: IDatafeedChartApi) {
  // The source belongs to the account session and can outlive several chart
  // mounts. Keep the subscriptions owned by this view separate from its cache
  // and from subscriptions belonging to other chart panes/views.
  const barListeners = new Set<string>()
  const quoteListeners = new Set<string>()
  // BWC uses pane-local IDs such as "pane-0" in every widget.
  const listenerPrefix = `auren-chart-${++chartDatafeedSequence}:`
  const sourceListener = (listenerGuid: string) => `${listenerPrefix}${listenerGuid}`
  let disposed = false
  let cachedConfig: {
    resolutions: BwcResolution[]
    supported_resolutions: string[]
    default_resolution: string
    supports_quotes: boolean
  } | null = null

  return {
    supportsQuotes: typeof source.subscribeQuotes === 'function',

    onReady() {
      if (cachedConfig) return Promise.resolve(cachedConfig)
      return promisify<Record<string, unknown>>((cb) => source.onReady(cb)).then((cfg) => {
        const supported = (cfg.supported_resolutions as string[] | undefined) ?? ['1', '5', '15', '60', '1D']
        const supportsQuotes =
          cfg.supports_quotes === true ||
          (cfg.supports_quotes !== false && typeof source.subscribeQuotes === 'function')
        cachedConfig = {
          resolutions: buildResolutions(source, supported),
          supported_resolutions: supported,
          default_resolution: supported.includes('1') ? '1' : supported[0],
          supports_quotes: supportsQuotes,
        }
        return cachedConfig
      })
    },

    searchSymbols(userInput: string, exchange = '', symbolType = '', limit = 25) {
      return new Promise<unknown[]>((resolve) => {
        source.searchSymbols(userInput, exchange, symbolType, resolve)
      })
    },

    resolveSymbol(symbolName: string) {
      return new Promise<LibrarySymbolInfo>((resolve, reject) => {
        source.resolveSymbol(symbolName, resolve, reject)
      })
    },

    getBars(
      symbolInfo: LibrarySymbolInfo | null | undefined,
      resolution: string,
      periodParams: {
        from?: number
        to?: number
        countBack?: number
        firstDataRequest?: boolean
        requestReason?: string
        refresh?: boolean
      } = {}
    ) {
      if (!symbolInfo) {
        return Promise.resolve({ bars: [], noData: true })
      }
      const now = Math.floor(Date.now() / 1000)
      const from = periodParams.from ?? now - 86400 * 7
      const to = periodParams.to ?? now
      const chartSymbol = librarySymbolDisplayName(symbolInfo)
      const barSec = secForResolution(resolution)
      const requestBars =
        periodParams.countBack != null
          ? Math.max(1, periodParams.countBack)
          : Math.max(1, Math.ceil((to - from) / barSec) + 2)
      candleDebug.bwcGetBarsRequest({
        chartSymbol,
        resolution,
        bars: requestBars,
        fromSec: from,
        toSec: to,
      })
      const finishTrace = traceHistoryRequest({
        kind: 'logical', symbol: chartSymbol, resolution, from, to,
        countBack: requestBars, reason: periodParams.requestReason ?? (periodParams.firstDataRequest ? 'chart.initial' : 'chart.history'),
      })
      return new Promise<{ bars: Bar[]; noData?: boolean }>((resolve, reject) => {
        source.getBars(
          symbolInfo,
          resolution as ResolutionString,
          {
            from,
            to,
            countBack: periodParams.countBack,
            firstDataRequest: periodParams.firstDataRequest,
            requestReason: periodParams.requestReason ?? (periodParams.firstDataRequest ? 'chart.initial' : 'chart.history'),
            refresh: periodParams.refresh,
          },
          (bars, meta) => {
            const normalized = bars.map(normalizeBarForBwc)
            finishTrace({ bars: normalized.length })
            candleDebug.bwcGetBarsResult({
              chartSymbol,
              resolution,
              bars: normalized.length,
              firstTimeSec: normalized[0]?.time,
              lastTimeSec: normalized[normalized.length - 1]?.time,
              noData: meta.noData,
            })
            resolve({
              bars: normalized,
              noData: meta.noData,
            })
          },
          (error) => {
            finishTrace({ error: true })
            reject(error)
          }
        )
      })
    },

    subscribeBars(
      symbolInfo: LibrarySymbolInfo,
      resolution: string,
      onTick: (bar: Bar) => void,
      listenerGuid: string
    ) {
      if (disposed) return
      barListeners.add(listenerGuid)
      const chartSymbol = librarySymbolDisplayName(symbolInfo)
      candleDebug.bwcSubscribeBars({
        chartSymbol,
        resolution,
        listenerGuid,
      })
      source.subscribeBars(
        symbolInfo,
        resolution as ResolutionString,
        (bar) => {
          if (!disposed && barListeners.has(listenerGuid)) onTick(normalizeBarForBwc(bar))
        },
        sourceListener(listenerGuid)
      )
    },

    unsubscribeBars(listenerGuid: string) {
      if (barListeners.delete(listenerGuid)) source.unsubscribeBars(sourceListener(listenerGuid))
    },

    getQuotes(symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[]) {
      if (typeof source.getQuotes !== 'function') return Promise.resolve([])
      return source.getQuotes(symbolInfos)
    },

    subscribeQuotes(
      symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[],
      onQuotes: (quotes: unknown[]) => void,
      listenerGuid: string
    ) {
      if (disposed) return
      quoteListeners.add(listenerGuid)
      const list = Array.isArray(symbolInfos) ? symbolInfos : [symbolInfos]
      const info = list[0]
      if (info) {
        candleDebug.bwcSubscribeQuotes({
          chartSymbol: librarySymbolDisplayName(info),
          listenerGuid,
        })
      }
      source.subscribeQuotes?.(symbolInfos, (quotes) => {
        if (!disposed && quoteListeners.has(listenerGuid)) onQuotes(quotes)
      }, sourceListener(listenerGuid))
    },

    unsubscribeQuotes(listenerGuid: string) {
      if (quoteListeners.delete(listenerGuid)) source.unsubscribeQuotes?.(sourceListener(listenerGuid))
    },

    /** Detach this chart without clearing the retained account datafeed. */
    dispose() {
      if (disposed) return
      disposed = true
      for (const listenerGuid of barListeners) source.unsubscribeBars(sourceListener(listenerGuid))
      for (const listenerGuid of quoteListeners) source.unsubscribeQuotes?.(sourceListener(listenerGuid))
      barListeners.clear()
      quoteListeners.clear()
    },
  }
}

export type BwcChartApi = {
  symbol: () => string
  resolution: () => string
  setSymbol: (sym: string, cb?: () => void) => void
  createOrderLine: () => Promise<unknown>
  createExecutionShape?: () => Promise<unknown>
}

export type BwcWidget = {
  datafeed?: {
    historyCache?: {
      subscribe(listener: (stats: Record<string, number>) => void): () => void
    }
  }
  chart: () => BwcChartApi
  indicators?: {
    list?: () => Array<{
      instanceId: string
      defId: string
      paneIndex?: number
      inputs?: Record<string, unknown>
      style?: Record<string, unknown>
    }>
    patch?: (instanceId: string, patch: Record<string, unknown>) => void
  }
  getSymbol?: () => string
  getResolution?: () => string
  setSymbol?: (symbol: string) => void | Promise<void>
  /** Opaque, widget-local checkpoints captured before a live feed can miss bars. */
  captureResumeState?: () => unknown
  recover?: (opts?: { since?: unknown; shouldContinue?: () => boolean }) => Promise<unknown>
  reload?: (opts?: { force?: boolean }) => void | Promise<unknown>
  reset?: (opts?: {
    price?: boolean
    time?: boolean
    data?: boolean
    viewport?: boolean
  }) => void | Promise<unknown>
  destroy?: () => void
  onChartReady?: (cb: () => void) => void
  onShortcut?: (shortcut: (string | number)[], cb: () => void) => void
  onLiveBar?: (cb: (bar: { close?: number; open?: number }) => void) => () => void
  isChartPanning?: () => boolean
  replay?: import('./bwcReplayApi').BwcReplayApi
  toolbar?: import('./bwcToolbarApi').BwcToolbarApi
  getSymbolInfo?: () => Record<string, unknown> | null | undefined
  getBars?: () => Array<{ close?: number; open?: number }>
  settings?: {
    merge?: (patch: Record<string, Record<string, unknown>>, opts?: { skipHistory?: boolean }) => void
  }
  drawShape?: (
    shape: string,
    points: Array<{ time: number; price: number }>,
    opts?: { paneIndex?: number; locked?: boolean; props?: Record<string, unknown> }
  ) => unknown
  getAllChartPanes?: () => Array<{
    symbol?: string
    resolution?: string
    bars?: Array<{ time: number }>
    chart?: { timeScale?: () => { setVisibleRange?: (range: { from: number; to: number }) => void } }
    series?: {
      applyOptions?: (options: Record<string, unknown>) => void
      priceScale?: () => { applyOptions?: (options: Record<string, unknown>) => void }
    }
  }>
  positionOverlay?: {
    buy: (priceOrOpts?: number | { price?: number; qty?: number }) => Promise<unknown>
    sell: (priceOrOpts?: number | { price?: number; qty?: number }) => Promise<unknown>
    clear: () => void
    modifyPosition?: (opts: { entry: number; qty: number }) => Promise<unknown> | unknown
    refreshLayout?: () => number
    getPosition: () => { entry: number; qty: number; stopLoss: number | null; takeProfit: number | null } | null
    setTheme?: (theme: Record<string, string>) => Record<string, string>
    getTheme?: () => Record<string, string>
  }
  setOrderLineTheme?: (theme: Record<string, string>) => Record<string, string>
  getOrderLineTheme?: () => Record<string, string>
  [key: string]: unknown
}

/** Requires recent betterweightchartpro (trade overlays + host hooks). */
export function getBwcChartApi(widget: BwcWidget | null | undefined): BwcChartApi | null {
  if (!widget || typeof widget.chart !== 'function') return null
  try {
    return widget.chart()
  } catch {
    return null
  }
}

export function bwcHasOrderLines(widget: BwcWidget | null | undefined): boolean {
  const chart = getBwcChartApi(widget)
  return typeof chart?.createOrderLine === 'function'
}

export function bwcHasExecutionShapes(widget: BwcWidget | null | undefined): boolean {
  const chart = getBwcChartApi(widget)
  return typeof chart?.createExecutionShape === 'function'
}
