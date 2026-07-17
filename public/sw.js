/* Legacy PWA retirement worker. Keep this file until old installations update. */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))),
      self.clients.claim(),
    ]).then(() =>
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url))
      })
    )
  )
})
