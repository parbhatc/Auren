import type { BwcWidget } from '../services/chart/bwcDatafeed'

declare global {
  interface Window {
    __AUREN_BWC_WIDGETS__?: Set<BwcWidget>
  }
}

export function registerAurenWidget(widget: BwcWidget): () => void {
  const widgets = window.__AUREN_BWC_WIDGETS__ ?? new Set<BwcWidget>()
  window.__AUREN_BWC_WIDGETS__ = widgets
  widgets.add(widget)
  return () => {
    widgets.delete(widget)
    if (!widgets.size && window.__AUREN_BWC_WIDGETS__ === widgets) {
      delete window.__AUREN_BWC_WIDGETS__
    }
  }
}
