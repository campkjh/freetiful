self.addEventListener('push', (event) => {
  let data = { title: '프리티풀', body: '새 알림', event: '' };
  try {
    data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.event || 'default',
    data: { url: (data.data && data.data.url) || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow((event.notification.data && event.notification.data.url) || '/'));
});
