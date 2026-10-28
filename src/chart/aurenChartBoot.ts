import type { BwcWidget } from '../services/chart/bwcDatafeed'
import chartAssetVersion from 'virtual:auren-chart-version'
import { registerBwcDebugHudCleanup } from '../utils/bwcDebugHud'

type BwcSdk = {
  bootChart: (options?: Record<string, unknown>) => Promise<BwcWidget>
  registerIndicator: (def: unknown) => void
  registerTradeContextActions: (handlers: Record<string, unknown>) => void
  clearChartContextActions: () => void
  destroyDebugHud?: () => void
}

// The static plugin versions this entire module graph by its contents. Reuse the
// browser cache across page loads, while chart/indicator edits get a new URL.
function withAssetVersion(url: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}bwc=${encodeURIComponent(chartAssetVersion)}`
}

function runtimeImport<T>(url: string): Promise<T> {
  return (new Function('url', 'return import(url)') as (url: string) => Promise<T>)(url)
}

let sdkPromise: Promise<BwcSdk> | null = null
let registrationPromise: Promise<void> | null = null
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
    sdkPromise = runtimeImport<BwcSdk>(withAssetVersion('/chart/sdk.js')).then((sdk) => {
      registerBwcDebugHudCleanup(() => sdk.destroyDebugHud?.())
      return sdk
    }).catch((error) => {
      sdkPromise = null
      throw error
    })
  }
  return sdkPromise
}

export function registerAurenChartIndicators(): Promise<void> {
  if (!registrationPromise) {
    registrationPromise = registerIndicators().catch((error) => {
      registrationPromise = null
      throw error
    })
  }
  return registrationPromise
}

async function registerIndicators(): Promise<void> {
  // Start the indicator and SDK graphs together instead of waiting for the SDK
  // and then starting another round of module downloads.
  const [sdk, fvg, levels, panels, presets, customSetups, niceSweep] = await Promise.all([
    getSdk(),
    runtimeImport<{ default: unknown }>(withAssetVersion('/testing/js/indicators/fvg/FvgIndicator.js')),
    runtimeImport<{ default: unknown }>(withAssetVersion('/testing/js/indicators/levels/LevelsIndicator.js')),
    runtimeImport<{ registerTestingInputPanels: () => void }>(
      withAssetVersion('/testing/js/indicators/inputPanels.js')
    ),
    runtimeImport<{ registerTestingIndicatorPresets: () => void }>(
      withAssetVersion('/testing/js/indicators/presets.js')
    ),
    runtimeImport<{ default: unknown }>(
      withAssetVersion('/auren-indicators/custom-setups/CustomSetupsPaperIndicator.js')
    ),
    runtimeImport<{ default: unknown }>(
      withAssetVersion('/auren-indicators/nice-sweep/NiceSweepIndicator.js')
    ),
  ])
  sdk.registerIndicator(fvg.default)
  sdk.registerIndicator(levels.default)
  sdk.registerIndicator(customSetups.default)
  sdk.registerIndicator(niceSweep.default)
  panels.registerTestingInputPanels()
  presets.registerTestingIndicatorPresets()
  const paperFeed = customSetups as typeof customSetups & {
    startPaperFeedPolling: (intervalMs?: number, shouldPoll?: () => boolean) => void
    refreshPaperFeed: () => Promise<unknown>
    subscribePaperFeed: (listener: () => void) => () => void
  }
  paperFeed.startPaperFeedPolling(30000, hasActivePaperIndicator)
  paperFeedPromise = Promise.resolve(paperFeed)
}

export async function bootChart(options?: Record<string, unknown>): Promise<BwcWidget> {
  const sdk = await getSdk()
  const widget = await sdk.bootChart(options)
  paperWidgets.add(widget)
  const feed = paperFeedPromise ? await paperFeedPromise : null
  const indicatorApi = widget.indicators
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
