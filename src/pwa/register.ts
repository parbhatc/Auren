import { registerSW } from 'virtual:pwa-register'

/** Register the production service worker (precache + offline shell). */
export function registerAppServiceWorker(): void {
  if (!import.meta.env.PROD) return

  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[pwa] App shell cached — offline ready')
    },
    onRegistered(registration) {
      if (!registration) return
      // Check for updates when the tab becomes visible again.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      })
    },
  })
}
