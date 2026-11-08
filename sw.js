/* Offline: aplikacja z sieci, gdy jest dostępna (zawsze świeża), z pamięci podręcznej, gdy offline; słownik i ikony z pamięci. */
const V = 'nt-v66';
const FILES = ['./', 'index.html', 'drive.js', 'config.js', 'manifest.webmanifest', 'rym/idx.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const STATIC = /\.(gz|png)$/;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit && STATIC.test(u.pathname)) return hit;
    try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch (err) { if (hit) return hit; throw err; }
  }));
});
