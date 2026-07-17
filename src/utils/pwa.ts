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

/**
 * Permanently retire legacy PWA workers/caches. Auren still exposes a web-app
 * manifest for installable presentation, but all application files are served
 * directly by Nginx and must update normally on refresh.
 */
export async function retireLegacyPwaCaches(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch (error) {
    console.warn('[PWA] Could not unregister legacy service workers:', error)
  }

  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch (error) {
    console.warn('[PWA] Could not clear legacy Cache Storage:', error)
  }
}
