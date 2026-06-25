/** True while the BWC chart time scale is being dragged. */
export function isBwcChartPanning(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & {
    __BWC_WIDGET__?: { isChartPanning?: () => boolean }
    __BWC_UI__?: { chartPanning?: boolean }
  }
  if (w.__BWC_WIDGET__?.isChartPanning?.()) return true
  return Boolean(w.__BWC_UI__?.chartPanning)
}

const panEndWaiters: Array<() => void> = []
let panWaitScheduled = false

/** Run once after the user finishes panning the chart. */
export function whenBwcPanEnds(fn: () => void): void {
  if (!isBwcChartPanning()) {
    fn()
    return
  }
  panEndWaiters.push(fn)
  if (panWaitScheduled) return
  panWaitScheduled = true
  const tick = () => {
    if (isBwcChartPanning()) {
      requestAnimationFrame(tick)
      return
    }
    panWaitScheduled = false
    const waiters = panEndWaiters.splice(0, panEndWaiters.length)
    for (const run of waiters) {
      try {
        run()
      } catch {
        /* ignore */
      }
    }
  }
  requestAnimationFrame(tick)
}
