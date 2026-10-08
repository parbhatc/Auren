import type { ChartPricePickContext } from '../types/tradePanel'
import { normalizeChartResolution } from '../utils/chartResolution'

type BwcPane = {
  index?: number
  symbol?: string
  resolution?: string
  chart?: {
    subscribeClick?: (handler: (event: { point?: { y?: number } }) => void) => void
    unsubscribeClick?: (handler: (event: { point?: { y?: number } }) => void) => void
  }
  series?: { coordinateToPrice?: (coordinate: number) => number | null }
}

type BwcPaneWidget = {
  getAllChartPanes?: () => BwcPane[]
  getSymbol?: () => string
  getResolution?: () => string
  lcChart?: BwcPane['chart']
  series?: BwcPane['series']
}

export function getBwcActiveResolution(widget: BwcPaneWidget | null | undefined): string {
  try {
    return normalizeChartResolution(widget?.getResolution?.())
  } catch {
    return '1'
  }
}

function getPanes(widget: BwcPaneWidget | null | undefined): BwcPane[] {
  try {
    const panes = widget?.getAllChartPanes?.().filter((pane) => pane?.chart && pane?.series) ?? []
    if (panes.length) return panes
  } catch {
    // Fall through to the legacy single-pane handles.
  }
  return widget?.lcChart && widget?.series
    ? [{
        index: 0,
        symbol: widget.getSymbol?.(),
        resolution: widget.getResolution?.(),
        chart: widget.lcChart,
        series: widget.series,
      }]
    : []
}

export function pickBwcChartPriceOnce(
  widget: BwcPaneWidget | null | undefined,
  snapPrice: (price: number, context: ChartPricePickContext) => number,
  onPrice: (price: number, context: ChartPricePickContext) => void
): (() => void) | null {
  const panes = getPanes(widget)
  const subscriptions: Array<{ pane: BwcPane; handler: (event: { point?: { y?: number } }) => void }> = []
  let active = true

  const cancel = () => {
    if (!active) return
    active = false
    for (const { pane, handler } of subscriptions) pane.chart?.unsubscribeClick?.(handler)
    subscriptions.length = 0
  }

  for (const pane of panes) {
    if (!pane.chart?.subscribeClick || !pane.chart.unsubscribeClick || !pane.series?.coordinateToPrice) continue
    const handler = (event: { point?: { y?: number } }) => {
      const y = event.point?.y
      if (!active || y == null || !Number.isFinite(y)) return
      const rawPrice = pane.series?.coordinateToPrice?.(y)
      if (rawPrice == null || !Number.isFinite(rawPrice)) return
      const context: ChartPricePickContext = {
        paneIndex: Number.isFinite(pane.index) ? Number(pane.index) : 0,
        symbol: String(pane.symbol || widget?.getSymbol?.() || ''),
        resolution: normalizeChartResolution(pane.resolution || widget?.getResolution?.()),
      }
      const price = snapPrice(rawPrice, context)
      if (!Number.isFinite(price)) return
      cancel()
      onPrice(price, context)
    }
    pane.chart.subscribeClick(handler)
    subscriptions.push({ pane, handler })
  }

  return subscriptions.length ? cancel : null
}
