// IronLog service worker — caches the app shell so the tracker works
// offline once it's been opened at least once. Never touches API calls.

const CACHE_NAME = 'ironlog-shell-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept non-GET requests (this includes the POST calls the
  // app makes to api.anthropic.com — those must always go straight to
  // the network, untouched, and Cache.put() would throw on them anyway).
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only manage caching for our own same-origin files. Cross-origin
  // requests (Google Fonts, the Anthropic API) pass straight through
  // to the network as normal fetches.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached → nothing we can do

      // Cache-first for speed and offline support; refresh the cache
      // quietly in the background when online.
      return cached || network;
    })
  );
});
