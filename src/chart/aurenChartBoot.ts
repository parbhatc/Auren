import type { BwcWidget } from '../services/chart/bwcDatafeed'

type BwcSdk = {
  bootChart: (options?: Record<string, unknown>) => Promise<BwcWidget>
  registerIndicator: (def: unknown) => void
  registerTradeContextActions: (handlers: Record<string, unknown>) => void
  clearChartContextActions: () => void
}

// Dynamic imports are outside Vite's hashed bundle graph. Give every page load a
// fresh root URL so Chrome never reuses a corrupt disk-cache entry for the BWC
// module graph. Production builds also stamp the graph's transitive imports in
// vite.bwcStatic.ts.
const IMPORT_NONCE = typeof window !== 'undefined' ? String(Date.now()) : null

function withCacheBust(url: string): string {
  if (!IMPORT_NONCE) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${encodeURIComponent(IMPORT_NONCE)}`
}

function runtimeImport<T>(url: string): Promise<T> {
  return (new Function('url', 'return import(url)') as (url: string) => Promise<T>)(url)
}

let sdkPromise: Promise<BwcSdk> | null = null
let registered = false
const paperWidgets = new Set<BwcWidget>()
const hasActivePaperIndicator = () => [...paperWidgets].some((widget) =>
  widget.indicators?.list?.().some((instance) => instance.defId === 'custom-setups-paper')
)
let paperFeedPromise: Promise<{
  startPaperFeedPolling: (intervalMs?: number, shouldPoll?: () => boolean) => void
  refreshPaperFeed: () => Promise<unknown>
  subscribePaperFeed: (listener: () => void) => () => void
}> | null = null

function getSdk(): Promise<BwcSdk> {
  if (!sdkPromise) {
    sdkPromise = runtimeImport<BwcSdk>(withCacheBust('/chart/sdk.js'))
  }
  return sdkPromise
}

export async function registerAurenChartIndicators(): Promise<void> {
  if (registered) return
  const sdk = await getSdk()
  const [fvg, levels, panels, presets, customSetups] = await Promise.all([
    runtimeImport<{ default: unknown }>(withCacheBust('/testing/js/indicators/fvg/FvgIndicator.js')),
    runtimeImport<{ default: unknown }>(withCacheBust('/testing/js/indicators/levels/LevelsIndicator.js')),
    runtimeImport<{ registerTestingInputPanels: () => void }>(
      withCacheBust('/testing/js/indicators/inputPanels.js')
    ),
    runtimeImport<{ registerTestingIndicatorPresets: () => void }>(
      withCacheBust('/testing/js/indicators/presets.js')
    ),
    runtimeImport<{ default: unknown }>(
      withCacheBust('/auren-indicators/custom-setups/CustomSetupsPaperIndicator.js')
    ),
  ])
  sdk.registerIndicator(fvg.default)
  sdk.registerIndicator(levels.default)
  sdk.registerIndicator(customSetups.default)
  panels.registerTestingInputPanels()
  presets.registerTestingIndicatorPresets()
  const paperFeed = customSetups as typeof customSetups & {
    startPaperFeedPolling: (intervalMs?: number, shouldPoll?: () => boolean) => void
    refreshPaperFeed: () => Promise<unknown>
    subscribePaperFeed: (listener: () => void) => () => void
  }
  paperFeed.startPaperFeedPolling(30000, hasActivePaperIndicator)
  paperFeedPromise = Promise.resolve(paperFeed)
  registered = true
}

export async function bootChart(options?: Record<string, unknown>): Promise<BwcWidget> {
  const sdk = await getSdk()
  const widget = await sdk.bootChart(options)
  paperWidgets.add(widget)
  const feed = paperFeedPromise ? await paperFeedPromise : null
  const indicatorApi = widget.indicators as {
    list?: () => Array<{ instanceId: string; defId: string }>
    patch?: (instanceId: string, patch: Record<string, unknown>) => void
  } | undefined
  const unsubscribe = feed?.subscribePaperFeed(() => {
    for (const instance of indicatorApi?.list?.() ?? []) {
      if (instance.defId === 'custom-setups-paper') indicatorApi?.patch?.(instance.instanceId, {})
    }
  })
  if (hasActivePaperIndicator()) void feed?.refreshPaperFeed()
  if (unsubscribe && widget.destroy) {
    const originalDestroy = widget.destroy.bind(widget)
    widget.destroy = () => {
      unsubscribe()
      paperWidgets.delete(widget)
      originalDestroy()
    }
  }
  return widget
}

export async function getBwcHostHooks(): Promise<{
  registerTradeContextActions: BwcSdk['registerTradeContextActions']
  clearChartContextActions: BwcSdk['clearChartContextActions']
}> {
  const sdk = await getSdk()
  return {
    registerTradeContextActions: sdk.registerTradeContextActions.bind(sdk),
    clearChartContextActions: sdk.clearChartContextActions.bind(sdk),
  }
}
