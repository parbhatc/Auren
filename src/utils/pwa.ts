/** True when launched from home screen / installed PWA (no Safari chrome). */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iOS Safari tab — not standalone; user still sees URL bar and bottom toolbar. */
export function isIosSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS || isPwaStandalone()) return false
  return !/crios|fxios|edgios|opios/i.test(ua)
}

export const IOS_PWA_BANNER_DISMISS_KEY = 'auren_ios_pwa_banner_dismissed'
