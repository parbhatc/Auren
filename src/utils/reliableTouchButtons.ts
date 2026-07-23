/**
 * iOS Safari can cancel the compatibility `click` after a valid button tap
 * when the finger drifts by a few pixels. That is especially noticeable while
 * the chart owns the page touch gesture. Convert a stationary touch into one
 * explicit click instead of waiting for Safari's optional synthesized click.
 */

const TAP_MAX_DRIFT_PX = 14
const DUPLICATE_CLICK_WINDOW_MS = 700

const CHART_TOUCH_BUTTON_SELECTOR = [
  '.tv-toolbar button',
  '.drawing-toolbar button',
  '.tv-chart-bottom-bar button',
  '.tv-floating-toolbar button',
  '.tv-drawing-edit-toolbar button',
].join(', ')

type PendingTap = {
  button: HTMLButtonElement
  x: number
  y: number
}

let installed = false
let lastBridgedButton: HTMLButtonElement | null = null
let lastBridgedAt = 0

function reliableButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null
  const button = target.closest('button')
  if (!(button instanceof HTMLButtonElement) || button.disabled) return null

  // BWC's symbol and timeframe controls already activate on pointerup. Do not
  // bridge them or they would toggle twice.
  if (button.closest('.tv-symbol, .tv-tf')) return null

  // React-owned controls are outside `.tv-app`. Within the chart, limit the
  // bridge to click-only header, drawing, and bottom-toolbar controls.
  if (!button.closest('.tv-app') || button.matches(CHART_TOUCH_BUTTON_SELECTOR)) {
    return button
  }

  return null
}

function changedTouchById(event: TouchEvent, id: number): Touch | null {
  for (let i = 0; i < event.changedTouches.length; i += 1) {
    const touch = event.changedTouches.item(i)
    if (touch?.identifier === id) return touch
  }
  return null
}

/** Install once for the lifetime of the app. */
export function installReliableTouchButtons(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  const pending = new Map<number, PendingTap>()

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        pending.clear()
        return
      }
      const touch = event.changedTouches.item(0)
      const button = reliableButtonFromTarget(event.target)
      if (!touch || !button) return
      pending.set(touch.identifier, {
        button,
        x: touch.clientX,
        y: touch.clientY,
      })
    },
    { capture: true, passive: true }
  )

  document.addEventListener(
    'touchend',
    (event) => {
      for (const [id, start] of pending) {
        const touch = changedTouchById(event, id)
        if (!touch) continue
        pending.delete(id)

        const endButton = reliableButtonFromTarget(event.target)
        const drift = Math.hypot(touch.clientX - start.x, touch.clientY - start.y)
        if (endButton !== start.button || drift > TAP_MAX_DRIFT_PX || !start.button.isConnected) {
          continue
        }

        // Cancels Safari's delayed compatibility click. The explicit click is
        // queued after touch handlers finish, so React and BWC each receive one
        // ordinary click through their existing safe order/navigation paths.
        event.preventDefault()
        const button = start.button
        queueMicrotask(() => {
          if (!button.isConnected || button.disabled) return
          lastBridgedButton = button
          lastBridgedAt = performance.now()
          button.click()
        })
      }
    },
    { capture: true, passive: false }
  )

  document.addEventListener(
    'touchcancel',
    (event) => {
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i)
        if (touch) pending.delete(touch.identifier)
      }
    },
    { capture: true, passive: true }
  )

  // Some Safari builds still emit a trusted compatibility click even when
  // touchend was cancelled. Suppress only that duplicate; synthetic clicks and
  // later deliberate taps remain available.
  document.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted || !lastBridgedButton) return
      const button = reliableButtonFromTarget(event.target)
      if (
        button === lastBridgedButton &&
        performance.now() - lastBridgedAt <= DUPLICATE_CLICK_WINDOW_MS
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
    { capture: true }
  )
}
