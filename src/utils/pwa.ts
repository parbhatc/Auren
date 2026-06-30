/** True when launched from home screen / installed PWA (no Safari chrome). */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Bottom tab bar is always visible; hide/show nav controls are removed. */
export function isPwaPinnedNav(): boolean {
  return isPwaStandalone()
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

/** Subscribe to browser online/offline changes. Returns an unsubscribe function. */
export function subscribeOnlineStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => onChange(navigator.onLine)
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
