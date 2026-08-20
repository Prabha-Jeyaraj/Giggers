// Giggers Service Worker — Live Network
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  return;
});
