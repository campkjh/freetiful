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
  const chatRoomId = payload.chatRoomId || payload.roomId || payload.chat_room_id || payload.room_id;
  const url =
    payload.url ||
    payload.link ||
    payload.deepLink ||
    payload.deeplink ||
    payload.launchURL ||
    payload.launchUrl ||
    (chatRoomId ? `/chat/${chatRoomId}` : null) ||
    (data.event === 'chat' ? '/chat' : '/notifications');
  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.notificationId || `${data.event || 'default'}:${url}`,
    data: { url, payload },
    vibrate: [200, 100, 200],
    renotify: false,
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
      const clientUrl = new URL(client.url);
      if (clientUrl.origin !== self.location.origin) continue;
      if ('navigate' in client) {
        await client.navigate(absoluteUrl);
        return client.focus();
      }
      if ('focus' in client && client.url === absoluteUrl) return client.focus();
    }
    return clients.openWindow(absoluteUrl);
  })());
});
