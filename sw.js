'use strict';

const CACHE_NAME = 'trips-tracker-shell-v1';
const RUNTIME_CACHE = 'trips-tracker-runtime-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-icon-512.png',
  './icons/apple-touch-icon.png'
];

/* ===== INSTALL: pre-cache app shell ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ===== ACTIVATE: clean up old caches ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ===== FETCH: routing strategy ===== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept live geocoding/routing API calls — these must always
  // reflect the current network state and should never be served stale.
  if (url.hostname.includes('nominatim.openstreetmap.org') || url.hostname.includes('router.project-osrm.org')) {
    return;
  }

  if (url.origin === self.location.origin) {
    // App shell: cache-first, refresh cache in background
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Third-party CDN assets (fonts, Chart.js, jsPDF, SheetJS, html2canvas, Font Awesome):
  // stale-while-revalidate so the app keeps working offline after first load.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) cache.put(req, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
