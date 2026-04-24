self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '프리티풀', body: '새 알림', event: '', data: {} };
  try {
    data = event.data.json();
  } catch (e) {}

  const payload = data.data || {};
  const url = payload.url || payload.deepLink || '/notifications';
  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.event || 'default',
    data: { url },
    vibrate: [200, 100, 200],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const absoluteUrl = new URL(targetUrl, self.location.origin).href;
    for (const client of allClients) {
      if ('focus' in client && client.url === absoluteUrl) return client.focus();
    }
    return clients.openWindow(targetUrl);
  })());
});
