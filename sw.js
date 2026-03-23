/* ========= MTSM Service Worker — Offline Support ========= */
'use strict';

const CACHE_NAME = 'mtsm-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './engine.js',
  './ui.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Pre-cache all game assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful GET responses for Google Fonts etc.
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // If both cache and network fail, return the cached index page
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
