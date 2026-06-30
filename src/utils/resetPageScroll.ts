import { MOBILE_TRADE_OVERLAY_BODY_CLASS } from '../constants/mobileTrade'
import { releaseBwcDebugHud } from './bwcDebugHud'
import { releaseBwcTouchScrollLock } from './bwcTouchScrollLock'

/** Restore document scrolling after full-screen trade terminal (mobile). */
export function resetPageScroll(): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')

  releaseBwcTouchScrollLock()
  releaseBwcDebugHud()

  html.style.overflow = ''
  html.style.height = ''
  html.style.position = ''
  html.style.width = ''
  html.style.removeProperty('--mobile-trade-dock-inset')

  body.style.overflow = ''
  body.style.height = ''
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.width = ''
  body.classList.remove(MOBILE_TRADE_OVERLAY_BODY_CLASS)

  if (root) {
    root.style.overflow = ''
    root.style.height = ''
  }

  document.querySelectorAll('.tv-symbol__dropdown.is-portaled').forEach((el) => el.remove())
}

/** Run reset after route transitions / async chart teardown. */
export function schedulePageScrollReset(): void {
  resetPageScroll()
  window.requestAnimationFrame(() => resetPageScroll())
  window.setTimeout(() => resetPageScroll(), 0)
}
