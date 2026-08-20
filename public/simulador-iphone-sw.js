const CACHE = 'sra-luck-pwa-v6';
const SHELL = [
  '/simulador-iphone.html',
  '/simulador-iphone.webmanifest',
  '/icons/sra-luck-192.png',
  '/icons/sra-luck-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // APIs, Next.js chunks e páginas reais ficam sempre online-first.
  // Não congelamos /agenda nem /login em cache para evitar dados antigos.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return;
  }

  if (url.pathname === '/simulador-iphone.html' || url.pathname === '/simulador-iphone.webmanifest') {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'Sra. Luck';
  const options = {
    body: data.body || 'Você recebeu uma nova notificação.',
    icon: data.icon || '/icons/sra-luck-192.png',
    badge: data.badge || '/icons/sra-luck-192.png',
    tag: data.tag || 'sra-luck-notificacao',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/agenda', notificationId: data.notificationId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/agenda', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        return existing.focus().then(() => existing.navigate(targetUrl));
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
