/** True when launched from home screen / installed web app (no browser chrome). */
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
