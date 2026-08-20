// Giggers Service Worker — Push Notifications & Live Network
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

// Pass all fetch requests directly through to network without stale disk caching
self.addEventListener('fetch', (event) => {
  // Let the browser handle standard live network requests directly
  return;
});

// ─────────────────────────────────────────────────────────────
// WEB PUSH NOTIFICATION LISTENERS
// ─────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ Giggers Notification',
    body: 'You have a new update on Giggers!',
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/notifications',
    tag: 'giggers-alert',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (err) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: {
      url: data.url,
      ...data.data,
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Or open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

