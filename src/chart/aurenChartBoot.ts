import type { BwcWidget } from '../services/chart/bwcDatafeed'

type BwcSdk = {
  bootChart: (options?: Record<string, unknown>) => Promise<BwcWidget>
  registerIndicator: (def: unknown) => void
  registerTradeContextActions: (handlers: Record<string, unknown>) => void
  clearChartContextActions: () => void
}

const DEV_IMPORT_NONCE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? String(Date.now())
    : null

function withDevCacheBust(url: string): string {
  if (!DEV_IMPORT_NONCE) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${encodeURIComponent(DEV_IMPORT_NONCE)}`
}

function runtimeImport<T>(url: string): Promise<T> {
  return (new Function('url', 'return import(url)') as (url: string) => Promise<T>)(url)
}

let sdkPromise: Promise<BwcSdk> | null = null
let registered = false
let paperFeedPromise: Promise<{
  startPaperFeedPolling: (intervalMs?: number) => void
  subscribePaperFeed: (listener: () => void) => () => void
}> | null = null

function getSdk(): Promise<BwcSdk> {
  if (!sdkPromise) {
    sdkPromise = runtimeImport<BwcSdk>(withDevCacheBust('/chart/sdk.js'))
  }
  return sdkPromise
}

export async function registerAurenChartIndicators(): Promise<void> {
  if (registered) return
  const sdk = await getSdk()
  const [fvg, levels, panels, presets, customSetups] = await Promise.all([
    runtimeImport<{ default: unknown }>(withDevCacheBust('/testing/js/indicators/fvg/FvgIndicator.js')),
    runtimeImport<{ default: unknown }>(withDevCacheBust('/testing/js/indicators/levels/LevelsIndicator.js')),
    runtimeImport<{ registerTestingInputPanels: () => void }>(
      withDevCacheBust('/testing/js/indicators/inputPanels.js')
    ),
    runtimeImport<{ registerTestingIndicatorPresets: () => void }>(
      withDevCacheBust('/testing/js/indicators/presets.js')
    ),
    runtimeImport<{ default: unknown }>(
      withDevCacheBust('/auren-indicators/custom-setups/CustomSetupsPaperIndicator.js')
    ),
  ])
  sdk.registerIndicator(fvg.default)
  sdk.registerIndicator(levels.default)
  sdk.registerIndicator(customSetups.default)
  panels.registerTestingInputPanels()
  presets.registerTestingIndicatorPresets()
  const paperFeed = customSetups as typeof customSetups & {
    startPaperFeedPolling: (intervalMs?: number) => void
    subscribePaperFeed: (listener: () => void) => () => void
  }
  paperFeed.startPaperFeedPolling(2000)
  paperFeedPromise = Promise.resolve(paperFeed)
  registered = true
}

export async function bootChart(options?: Record<string, unknown>): Promise<BwcWidget> {
  const sdk = await getSdk()
  const widget = await sdk.bootChart(options)
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
  if (unsubscribe && widget.destroy) {
    const originalDestroy = widget.destroy.bind(widget)
    widget.destroy = () => {
      unsubscribe()
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
