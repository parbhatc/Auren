export type AutoRiskPreviewAppearance = {
  label: string
  quantityLabel: string
}

type BwcOrderLine = {
  getPrice: () => number
  setPrice: (price: number) => BwcOrderLine
  setText: (text: string) => BwcOrderLine
  setQuantity: (quantity: string) => BwcOrderLine
  setLineStyle: (style: number) => BwcOrderLine
  setLineLength: (length: number) => BwcOrderLine
  setLineColor: (color: string) => BwcOrderLine
  setBodyBackgroundColor: (color: string) => BwcOrderLine
  setBodyTextColor: (color: string) => BwcOrderLine
  setBodyBorderColor?: (color: string) => BwcOrderLine
  setQuantityBackgroundColor: (color: string) => BwcOrderLine
  setQuantityTextColor: (color: string) => BwcOrderLine
  setQuantityBorderColor?: (color: string) => BwcOrderLine
  setCancelButtonBackgroundColor?: (color: string) => BwcOrderLine
  setCancelButtonBorderColor?: (color: string) => BwcOrderLine
  setCancelButtonIconColor?: (color: string) => BwcOrderLine
  setPillSide?: (side: 'left' | 'right') => BwcOrderLine
  setPillOffset?: (offset: number) => BwcOrderLine
  setPaneIndex?: (paneIndex: number) => BwcOrderLine
  applyAppearance?: (appearance: { text: string; quantityText: string }) => BwcOrderLine
  onMoving: (callback: () => void) => BwcOrderLine
  onMove: (callback: () => void) => BwcOrderLine
  remove: () => void
}

type BwcRiskPreviewWidget = {
  getSymbol?: () => string
  getResolution?: () => string
  chart?: () => {
    createOrderLine?: () => Promise<BwcOrderLine> | BwcOrderLine
  }
  lcChart?: {
    subscribeCrosshairMove?: (callback: (event: { point?: { y?: number }; sourceEvent?: unknown }) => void) => void
    unsubscribeCrosshairMove?: (callback: (event: { point?: { y?: number }; sourceEvent?: unknown }) => void) => void
  }
  series?: {
    coordinateToPrice?: (coordinate: number) => number | null
  }
  onLiveBar?: (callback: () => void) => (() => void) | void
  activatePane?: (paneIndex: number) => Promise<boolean> | boolean | void
  getAllChartPanes?: () => Array<{
    index?: number
    symbol?: string
    resolution?: string
    chart?: {
      subscribeCrosshairMove?: (callback: (event: { point?: { y?: number }; sourceEvent?: unknown }) => void) => void
      unsubscribeCrosshairMove?: (callback: (event: { point?: { y?: number }; sourceEvent?: unknown }) => void) => void
    }
    series?: {
      coordinateToPrice?: (coordinate: number) => number | null
      createOrderLine?: (options: Record<string, unknown>) => {
        applyOptions?: (options: Record<string, unknown>) => void
        _remove?: () => void
      }
      removeOrderLine?: (line: unknown) => void
    }
  }>
}

function createMultiPanePreview(
  widget: BwcRiskPreviewWidget,
  options: {
    stopLoss: number
    tickSize: number
    appearanceAt: (price: number, context: ChartPricePickContext) => AutoRiskPreviewAppearance
    tickSizeAt?: (context: ChartPricePickContext) => number
  }
): (() => void) | null {
  let panes: NonNullable<ReturnType<NonNullable<BwcRiskPreviewWidget['getAllChartPanes']>>>
  try {
    panes = widget.getAllChartPanes?.() ?? []
  } catch {
    return null
  }
  const usable = panes.filter((pane) =>
    pane.chart?.subscribeCrosshairMove &&
    pane.chart?.unsubscribeCrosshairMove &&
    pane.series?.coordinateToPrice &&
    pane.series?.createOrderLine
  )
  if (!usable.length) return null

  let active = true
  let activePane = -1
  let frame = 0
  let pending: { context: ChartPricePickContext; price: number } | null = null
  const entries = usable.map((pane, position) => {
    const context = {
      paneIndex: Number.isFinite(pane.index) ? Number(pane.index) : position,
      symbol: String(pane.symbol || ''),
      resolution: String(pane.resolution || '1'),
    }
    const appearance = options.appearanceAt(options.stopLoss, context)
    const line = pane.series!.createOrderLine!({
      id: `auto-risk-${Date.now()}-${position}`,
      price: options.stopLoss,
      color: '#f23645',
      lineVisible: false,
      axisLabelVisible: false,
      lineWidth: 1,
      lineStyle: 3,
      pills: {
        visible: false,
        side: 'right',
        offset: 24,
        body: {
          text: appearance.label,
          backgroundColor: '#451a1f',
          textColor: '#fda4af',
          borderColor: 'transparent',
          visible: true,
        },
        quantity: {
          text: appearance.quantityLabel,
          backgroundColor: '#7f1d1d',
          textColor: '#fecdd3',
          borderColor: 'transparent',
          visible: Boolean(appearance.quantityLabel),
        },
        cancel: { visible: false },
      },
    })
    return { pane, context, paneIndex: context.paneIndex, line, handler: null as ((event: { point?: { y?: number } }) => void) | null }
  })

  const render = (context: ChartPricePickContext, price: number) => {
    if (!active) return
    activePane = context.paneIndex
    const appearance = options.appearanceAt(price, context)
    for (const entry of entries) {
      const visible = entry.paneIndex === context.paneIndex
      entry.line.applyOptions?.({
        ...(visible ? { price } : {}),
        lineVisible: visible,
        pills: {
          visible,
          body: { text: appearance.label, visible },
          quantity: { text: appearance.quantityLabel, visible: visible && Boolean(appearance.quantityLabel) },
          cancel: { visible: false },
        },
      })
    }
  }

  for (const entry of entries) {
    entry.handler = (event) => {
      const y = event.point?.y
      if (!active || y == null || !Number.isFinite(y)) return
      const rawPrice = entry.pane.series?.coordinateToPrice?.(y)
      if (rawPrice == null || !Number.isFinite(rawPrice)) return
      const tickSize = Number(options.tickSizeAt?.(entry.context) || options.tickSize)
      const price = tickSize > 0
        ? Number((Math.round(rawPrice / tickSize) * tickSize).toFixed(8))
        : rawPrice
      pending = { context: entry.context, price }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const next = pending
        pending = null
        if (next) render(next.context, next.price)
      })
    }
    entry.pane.chart?.subscribeCrosshairMove?.(entry.handler)
  }

  const liveSubscription = widget.onLiveBar?.(() => {
    if (!active || activePane < 0) return
    const current = entries.find((entry) => entry.paneIndex === activePane)
    const price = Number((current?.line as { options?: () => { price?: number } })?.options?.()?.price)
    if (Number.isFinite(price) && current) render(current.context, price)
  })

  return () => {
    if (!active) return
    active = false
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    pending = null
    if (typeof liveSubscription === 'function') liveSubscription()
    for (const entry of entries) {
      if (entry.handler) entry.pane.chart?.unsubscribeCrosshairMove?.(entry.handler)
      try {
        if (entry.line._remove) entry.line._remove()
        else entry.pane.series?.removeOrderLine?.(entry.line)
      } catch {
        // Pane teardown may already have removed the preview.
      }
    }
  }
}

/**
 * Draw one temporary cursor-following stop line. It deliberately does not use
 * the position overlay, so an armed Auto order never looks like a filled trade.
 */
export function createBwcAutoRiskPreview(
  widget: BwcRiskPreviewWidget | null | undefined,
  options: {
    stopLoss: number
    tickSize: number
    appearanceAt: (price: number, context: ChartPricePickContext) => AutoRiskPreviewAppearance
    tickSizeAt?: (context: ChartPricePickContext) => number
  }
): () => void {
  // Newer BWC builds can move the managed order-line adapter between panes.
  // Keep the direct per-series fallback for older builds only.
  const multiPanePreview = widget && !widget.activatePane
    ? createMultiPanePreview(widget, options)
    : null
  if (multiPanePreview) return multiPanePreview

  let active = true
  let line: BwcOrderLine | null = null
  let moveFrame = 0
  let pendingPrice: number | null = null
  let forceAppearance = false
  let renderedPrice = options.stopLoss
  let renderedContext: ChartPricePickContext = {
    paneIndex: 0,
    symbol: String(widget?.getSymbol?.() || ''),
    resolution: String(widget?.getResolution?.() || '1'),
  }
  let offLiveBar: (() => void) | null = null
  const paneCrosshairs: Array<{
    chart: NonNullable<NonNullable<ReturnType<NonNullable<BwcRiskPreviewWidget['getAllChartPanes']>>>[number]['chart']>
    handler: (event: { point?: { y?: number }; sourceEvent?: unknown }) => void
  }> = []
  const crosshair = widget?.lcChart
  const series = widget?.series

  const scheduleRender = (price: number, context = renderedContext, force = false) => {
    pendingPrice = price
    renderedContext = context
    forceAppearance ||= force
    if (moveFrame) return
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0
      if (!active || !line || pendingPrice == null) return
      const nextPrice = pendingPrice
      pendingPrice = null
      const shouldRefreshAppearance = forceAppearance || nextPrice !== renderedPrice
      forceAppearance = false
      if (!shouldRefreshAppearance) return
      if (nextPrice !== renderedPrice) {
        renderedPrice = nextPrice
        line.setPrice(nextPrice)
      }
      applyAppearance(line, nextPrice, renderedContext)
    })
  }

  const followCursor = (event: { point?: { y?: number } }) => {
    const y = event.point?.y
    if (!active || !line || y == null || !Number.isFinite(y)) return
    const rawPrice = series?.coordinateToPrice?.(y)
    if (rawPrice == null || !Number.isFinite(rawPrice)) return
    const tickSize = Number(options.tickSizeAt?.(renderedContext) || options.tickSize)
    const price = tickSize > 0
      ? Number((Math.round(rawPrice / tickSize) * tickSize).toFixed(8))
      : rawPrice
    scheduleRender(price)
  }

  const remove = () => {
    if (!active) return
    active = false
    if (moveFrame) cancelAnimationFrame(moveFrame)
    moveFrame = 0
    pendingPrice = null
    forceAppearance = false
    crosshair?.unsubscribeCrosshairMove?.(followCursor)
    for (const subscription of paneCrosshairs) {
      subscription.chart.unsubscribeCrosshairMove?.(subscription.handler)
    }
    paneCrosshairs.length = 0
    offLiveBar?.()
    offLiveBar = null
    try {
      line?.remove()
    } catch {
      // The chart may already have removed the temporary line during teardown.
    }
    line = null
  }

  const applyAppearance = (target: BwcOrderLine, price: number, context: ChartPricePickContext) => {
    const appearance = options.appearanceAt(price, context)
    if (target.applyAppearance) {
      target.applyAppearance({
        text: appearance.label,
        quantityText: appearance.quantityLabel,
      })
    } else {
      target.setText(appearance.label).setQuantity(appearance.quantityLabel)
    }
  }

  let chart: ReturnType<NonNullable<BwcRiskPreviewWidget['chart']>> | null = null
  try {
    chart = widget?.chart?.() ?? null
  } catch {
    chart = null
  }

  if (!chart?.createOrderLine) {
    active = false
    return () => {}
  }

  void Promise.resolve(chart.createOrderLine())
    .then((created) => {
      if (!active) {
        created.remove()
        return
      }
      line = created
      created
        .setPrice(options.stopLoss)
        .setLineStyle(3)
        .setLineLength(21)
        .setLineColor('#f23645')
        .setBodyBackgroundColor('#451a1f')
        .setBodyTextColor('#fda4af')
        .setQuantityBackgroundColor('#7f1d1d')
        .setQuantityTextColor('#fecdd3')
      created.setBodyBorderColor?.('transparent')
      created.setQuantityBorderColor?.('transparent')
      // A preview is not an order or position. Hide the cancel/X segment;
      // keyboard Escape is the cancellation affordance.
      created.setCancelButtonBackgroundColor?.('transparent')
      created.setCancelButtonBorderColor?.('transparent')
      created.setCancelButtonIconColor?.('transparent')
      created.setPillSide?.('right')
      created.setPillOffset?.(24)
      applyAppearance(created, options.stopLoss, renderedContext)
      let panes: ReturnType<NonNullable<BwcRiskPreviewWidget['getAllChartPanes']>> = []
      try {
        panes = widget?.getAllChartPanes?.() ?? []
      } catch {
        panes = []
      }
      if (created.setPaneIndex && panes.length > 1) {
        for (const [position, pane] of panes.entries()) {
          if (!pane.chart?.subscribeCrosshairMove || !pane.chart.unsubscribeCrosshairMove || !pane.series?.coordinateToPrice) continue
          const paneIndex = Number.isFinite(pane.index) ? Number(pane.index) : position
          const paneContext: ChartPricePickContext = {
            paneIndex,
            symbol: String(pane.symbol || ''),
            resolution: String(pane.resolution || '1'),
          }
          const handler = (event: { point?: { y?: number }; sourceEvent?: unknown }) => {
            // Layout crosshair sync emits a second synthetic event on the peer
            // pane. Only the pane receiving the real pointer event may own the
            // Auto preview, otherwise both panes fight over the same line.
            if (!event.sourceEvent) return
            const y = event.point?.y
            if (!active || !line || y == null || !Number.isFinite(y)) return
            const rawPrice = pane.series?.coordinateToPrice?.(y)
            if (rawPrice == null || !Number.isFinite(rawPrice)) return
            line.setPaneIndex?.(paneIndex)
            const tickSize = Number(options.tickSizeAt?.(paneContext) || options.tickSize)
            const price = tickSize > 0
              ? Number((Math.round(rawPrice / tickSize) * tickSize).toFixed(8))
              : rawPrice
            scheduleRender(price, paneContext)
          }
          pane.chart.subscribeCrosshairMove(handler)
          paneCrosshairs.push({ chart: pane.chart, handler })
        }
      } else {
        crosshair?.subscribeCrosshairMove?.(followCursor)
      }
      const liveSubscription = widget?.onLiveBar?.(() => scheduleRender(renderedPrice, renderedContext, true))
      offLiveBar = typeof liveSubscription === 'function' ? liveSubscription : null
    })
    .catch(() => {
      active = false
      line = null
    })

  return remove
}
import type { ChartPricePickContext } from '../types/tradePanel'
