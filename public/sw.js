// Service Worker Noto v2 — static export (tanpa API server).
// Cache aset statis agresif; navigasi network-first dengan fallback cache.
const CACHE = 'noto-static-v4'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Aset statis: cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const fresh = await fetch(req)
          if (fresh.ok) cache.put(req, fresh.clone())
          return fresh
        } catch {
          return new Response('Offline', { status: 503 })
        }
      })(),
    )
    return
  }

  // Navigasi halaman: network-first dengan fallback cache
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        try {
          const fresh = await fetch(req)
          if (fresh.ok) cache.put('/', fresh.clone())
          return fresh
        } catch {
          const hit = (await cache.match('/')) || (await cache.match(req))
          return hit || new Response('Offline', { status: 503 })
        }
      })(),
    )
  }
})
