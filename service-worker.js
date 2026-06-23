// FarmaGest Service Worker v1.0
const CACHE_NAME = 'farmagest-v1';
const BASE = '/FarmaGest-alvirosil';

const ASSETS_ESSENCIAIS = [
  BASE + '/',
  BASE + '/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js'
];

// ── INSTALL: guarda assets essenciais em cache (um a um, para não falhar tudo se 1 recurso externo falhar) ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS_ESSENCIAIS.map(url =>
          fetch(url).then(res => {
            if (res && res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
});

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network first, cache fallback ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase — nunca interceptar (sempre online)
  if (url.hostname.includes('supabase')) return;

  // Navegação (HTML) — Network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(BASE + '/index.html'))
    );
    return;
  }

  // Outros assets — Cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  let data = { title: 'FarmaGest', body: 'Tens uma nova notificação.' };
  try { data = event.data.json(); } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'FarmaGest', {
      body: data.body || '',
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-192.png',
      tag: data.tag || 'farmagest-notif',
      renotify: true,
      data: { url: data.url || BASE + '/' }
    })
  );
});

// ── CLICK em notificação ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || BASE + '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('FarmaGest-alvirosil') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

// ── SYNC em background (quando volta a ter internet) ──
self.addEventListener('sync', event => {
  if (event.tag === 'farmagest-sync') {
    // Notifica todos os clientes para re-sincronizar com Supabase
    event.waitUntil(
      self.clients.matchAll().then(list =>
        list.forEach(c => c.postMessage({ type: 'SYNC_REQUESTED' }))
      )
    );
  }
});
