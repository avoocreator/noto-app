// Service worker Noto: cache aset statis agar aplikasi terbuka offline. Data catatan tidak lewat sini.
const CACHE = 'noto-v3-static';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest']).catch(() => undefined)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Supabase dll. tidak di-cache
  // navigasi: jaringan dulu, jatuh ke cache saat offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('./', c)); return r; }).catch(() => caches.match('./')));
    return;
  }
  // aset: cache dulu, perbarui di latar belakang
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; }).catch(() => hit);
      return hit || net;
    }),
  );
});
