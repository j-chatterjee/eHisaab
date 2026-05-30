/* ================================================================
   eHisaab – Service Worker
   Strategy:
     • App shell (HTML/CSS/JS/manifest) → Network-first, fallback to cache
     • Google Fonts CSS                 → Network-first, fallback to cache
     • Font files                       → Cache-first (immutable by URL)
     • Everything else                  → Network-first, fallback to cache
   Bump CACHE_NAME version on each deploy to purge old caches.
   ================================================================ */

const CACHE_NAME    = 'ehisaab-v8';
const FONT_CACHE    = 'ehisaab-fonts-v2';

// Files that make up the app shell — cached on install
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// ── Install: pre-cache the app shell ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ── Activate: remove ALL old caches when version changes ─────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
            .map(k  => caches.delete(k))
      )
    ).then(() => self.clients.claim())  // take control immediately
  );
});

// ── Fetch: serve from cache, fall back to network ────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests that aren't fonts
  if (request.method !== 'GET') return;

  // Google Fonts CSS → network-first (so font updates are picked up)
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(networkFirstWithCache(request, FONT_CACHE));
    return;
  }

  // Google Fonts files → cache-first (they're immutable by URL)
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstWithNetwork(request, FONT_CACHE));
    return;
  }

  // App shell files → network-first (get latest from server), fallback to cache when offline
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithCache(request, CACHE_NAME));
    return;
  }

  // Everything else → network-first
  event.respondWith(networkFirstWithCache(request, CACHE_NAME));
});

// ── Helpers ───────────────────────────────────────────────────

/** Serve from cache; if not cached, fetch from network and cache it. */
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Revalidate in background so next visit gets fresh content
    fetchAndCache(request, cacheName).catch(() => {});
    return cached;
  }
  return fetchAndCache(request, cacheName);
}

/** Try network; if offline, fall back to cache. */
async function networkFirstWithCache(request, cacheName) {
  try {
    return await fetchAndCache(request, cacheName);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: return the cached index.html for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    throw new Error('Network unavailable and no cache for: ' + request.url);
  }
}

/** Fetch from network and store in cache. */
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  // Only cache valid, non-opaque responses
  if (response.ok && response.type !== 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
