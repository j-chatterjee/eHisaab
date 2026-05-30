/* ================================================================
   eHisaab � Service Worker  (auto-generated version token below)
   Strategy:
     * App shell (HTML/CSS/JS)  -> NETWORK ONLY when online, cache as offline fallback
     * Google Fonts CSS         -> Network-first, cache fallback
     * Font files               -> Cache-first (immutable content-hash URLs)
     * Everything else          -> Network-first, cache fallback

   HOW UPDATES WORK:
     Every time sw.js is pushed with a new CACHE_VERSION, the browser
     detects the changed SW file, installs the new SW, wipes the old
     cache on activate, claims all tabs, and posts SW_UPDATED so the
     app shows a "Reload for latest version" banner automatically.
     You never need to manually clear cache or hard-refresh.
   ================================================================ */

// Change this string on every deploy to bust old caches.
// Format: YYYY-MM-DD.N  (increment N if you deploy multiple times in one day)
const CACHE_VERSION = '2026-05-30.2';

const CACHE_NAME = 'ehisaab-shell-' + CACHE_VERSION;
const FONT_CACHE = 'ehisaab-fonts-v2';

// Install: activate immediately, skip pre-caching so first load always hits network
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: wipe every old cache, claim all open tabs, notify them to reload
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
        );
      })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Font FILES: cache-first (immutable content-hash URLs)
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Google Fonts CSS: network-first
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(networkFirst(request, FONT_CACHE));
    return;
  }

  // Own app files: network-only (cache: no-store bypasses browser HTTP cache too)
  // Cache saved only as offline fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// Network-only for online; save to SW cache as offline fallback.
// Uses fetch(url, { cache: 'no-store' }) — NOT new Request({ mode:'navigate' })
// because the Fetch spec forbids constructing a Request with mode:'navigate',
// which would throw a TypeError and wrongly trigger the offline fallback.
async function networkOnlyWithOfflineFallback(request) {
  try {
    const response = await fetch(request.url, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Truly offline — serve from SW cache if we have it
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('You are offline. Please check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network-first; if network fails, serve from cache.
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Network unavailable and no cache for: ' + request.url);
  }
}

// Cache-first; if not in cache, fetch and cache it.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
