self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Pathsharer', {
      body: payload.body || 'Open Pathsharer to find co-passengers.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: payload.data?.kind || 'pathsharer-notification',
      data: payload.data || { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.focus().then(() => existing.navigate(target));
      }
      return self.clients.openWindow(target);
    })
  );
});