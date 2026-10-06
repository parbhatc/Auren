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
  applyAppearance?: (appearance: { text: string; quantityText: string }) => BwcOrderLine
  onMoving: (callback: () => void) => BwcOrderLine
  onMove: (callback: () => void) => BwcOrderLine
  remove: () => void
}

type BwcRiskPreviewWidget = {
  chart?: () => {
    createOrderLine?: () => Promise<BwcOrderLine> | BwcOrderLine
  }
  lcChart?: {
    subscribeCrosshairMove?: (callback: (event: { point?: { y?: number } }) => void) => void
    unsubscribeCrosshairMove?: (callback: (event: { point?: { y?: number } }) => void) => void
  }
  series?: {
    coordinateToPrice?: (coordinate: number) => number | null
  }
  onLiveBar?: (callback: () => void) => (() => void) | void
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
    appearanceAt: (price: number) => AutoRiskPreviewAppearance
  }
): () => void {
  let active = true
  let line: BwcOrderLine | null = null
  let moveFrame = 0
  let pendingPrice: number | null = null
  let forceAppearance = false
  let renderedPrice = options.stopLoss
  let offLiveBar: (() => void) | null = null
  const crosshair = widget?.lcChart
  const series = widget?.series

  const scheduleRender = (price: number, force = false) => {
    pendingPrice = price
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
      applyAppearance(line, nextPrice)
    })
  }

  const followCursor = (event: { point?: { y?: number } }) => {
    const y = event.point?.y
    if (!active || !line || y == null || !Number.isFinite(y)) return
    const rawPrice = series?.coordinateToPrice?.(y)
    if (rawPrice == null || !Number.isFinite(rawPrice)) return
    const tickSize = Number(options.tickSize)
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
    offLiveBar?.()
    offLiveBar = null
    try {
      line?.remove()
    } catch {
      // The chart may already have removed the temporary line during teardown.
    }
    line = null
  }

  const applyAppearance = (target: BwcOrderLine, price: number) => {
    const appearance = options.appearanceAt(price)
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
      applyAppearance(created, options.stopLoss)
      crosshair?.subscribeCrosshairMove?.(followCursor)
      const liveSubscription = widget?.onLiveBar?.(() => scheduleRender(renderedPrice, true))
      offLiveBar = typeof liveSubscription === 'function' ? liveSubscription : null
    })
    .catch(() => {
      active = false
      line = null
    })

  return remove
}
