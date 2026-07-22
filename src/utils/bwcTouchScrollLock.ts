/**
 * BetterweightChartPro calls mountAppTouchScrollLock() on boot but never releases it on
 * destroy — this leaves `html.tv-app--touch` and a capture-phase touchmove blocker.
 */

const BWC_TOUCH_HTML_CLASS = 'tv-app--touch'

const trackedTouchMoveHandlers = new Set<EventListener>()
let interceptInstalled = false

function isDocumentCaptureTouchMove(
  target: EventTarget,
  type: string,
  options?: boolean | AddEventListenerOptions
): boolean {
  if (type !== 'touchmove' || target !== document) return false
  if (options === true) return true
  if (options && typeof options === 'object') return Boolean(options.capture)
  return false
}

/** Track BWC touch scroll locks so we can release them when leaving the trade terminal. */
export function installBwcTouchScrollLockIntercept(): void {
  if (interceptInstalled || typeof document === 'undefined') return
  interceptInstalled = true

  const proto = Document.prototype
  const origAdd = proto.addEventListener
  const origRemove = proto.removeEventListener

  proto.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (listener && typeof listener === 'function' && isDocumentCaptureTouchMove(this, type, options)) {
      trackedTouchMoveHandlers.add(listener)
    }
    return origAdd.call(this, type, listener, options)
  }

  proto.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    if (listener && typeof listener === 'function' && type === 'touchmove' && this === document) {
      trackedTouchMoveHandlers.delete(listener)
    }
    return origRemove.call(this, type, listener, options)
  }
}

export function releaseBwcTouchScrollLock(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove(BWC_TOUCH_HTML_CLASS)
  for (const handler of trackedTouchMoveHandlers) {
    document.removeEventListener('touchmove', handler, { capture: true })
  }
  trackedTouchMoveHandlers.clear()
}
