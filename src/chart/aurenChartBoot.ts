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

function getSdk(): Promise<BwcSdk> {
  if (!sdkPromise) {
    sdkPromise = runtimeImport<BwcSdk>(withDevCacheBust('/chart/sdk.js'))
  }
  return sdkPromise
}

export async function registerAurenChartIndicators(): Promise<void> {
  if (registered) return
  const sdk = await getSdk()
  const [fvg, levels, panels] = await Promise.all([
    runtimeImport<{ default: unknown }>(withDevCacheBust('/testing/js/indicators/fvg/FvgIndicator.js')),
    runtimeImport<{ default: unknown }>(withDevCacheBust('/testing/js/indicators/levels/LevelsIndicator.js')),
    runtimeImport<{ registerTestingInputPanels: () => void }>(
      withDevCacheBust('/testing/js/indicators/inputPanels.js')
    ),
  ])
  sdk.registerIndicator(fvg.default)
  sdk.registerIndicator(levels.default)
  panels.registerTestingInputPanels()
  registered = true
}

export async function bootChart(options?: Record<string, unknown>): Promise<BwcWidget> {
  const sdk = await getSdk()
  return sdk.bootChart(options)
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
