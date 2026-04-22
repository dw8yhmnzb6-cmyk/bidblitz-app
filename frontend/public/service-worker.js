// BidBlitz Service Worker — Hardened v12
// - Only caches explicitly safe GET endpoints
// - Auth, payments, admin, wallet, and all mutating requests bypass the SW entirely
// - Prevents "object cannot be cloned" errors by never intercepting auth/mutations

const CACHE_NAME = 'bidblitz-static-v12';
const API_CACHE_NAME = 'bidblitz-api-v12';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// Explicit allow-list: ONLY these GET endpoints may be cached.
// Anything not in this list is passed straight to the network.
const CACHEABLE_API_ROUTES = [
  '/api/auctions/active',
  '/api/auctions/feed',
  '/api/food/restaurants',
  '/api/kids/children',
  // NOTE: Do NOT add wallet, transactions, auth, admin, payments, stripe, p2p,
  // notifications, flights, or hotels — they must always be fresh.
];

// Explicit hard block-list: these NEVER go through SW cache, even on GET.
const NEVER_CACHE_PREFIXES = [
  '/api/auth',
  '/api/admin',
  '/api/wallet',
  '/api/payments',
  '/api/stripe',
  '/api/p2p',
  '/api/transactions',
  '/api/notifications',
  '/api/flights',
  '/api/hotels',
  '/api/sabre',
  '/api/pay',
  '/api/topup',
  '/api/refund',
  '/api/checkout',
  '/login',
  '/logout',
  '/register',
];

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle http(s) — ignore chrome-extension, data:, ws:, etc.
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);

  // 1) HARD BLOCK-LIST: never intercept. Let browser do its thing.
  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // 2) Skip ALL non-GET requests (POST/PUT/PATCH/DELETE/OPTIONS) — browser handles directly.
  if (req.method !== 'GET') return;

  // 3) Skip requests with Authorization header or credentials=include user-triggered mutations.
  //    (Safe-guard: cookies are already handled by browser on navigation.)
  if (req.headers.get('Authorization')) return;

  // 4) Same-origin API: only cache the explicit allow-list.
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_ROUTES.some((route) => url.pathname.startsWith(route));
    if (!isCacheable) return; // Let network handle it directly.

    event.respondWith(handleCacheableApi(req));
    return;
  }

  // 5) Static assets (same-origin): network-first, fallback to cache, fallback to offline page.
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticAsset(req));
  }
});

async function handleCacheableApi(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      try {
        const clone = res.clone();
        const cache = await caches.open(API_CACHE_NAME);
        const headers = new Headers(clone.headers);
        headers.set('sw-cache-time', Date.now().toString());
        const cached = new Response(await clone.blob(), {
          status: clone.status,
          statusText: clone.statusText,
          headers,
        });
        cache.put(req, cached).catch(() => {});
      } catch (e) {
        /* swallow clone errors silently */
      }
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Offline-Cache', 'true');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Keine Verbindung' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleStaticAsset(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      try {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
      } catch (e) {
        /* swallow clone errors */
      }
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
    }
    return new Response('Offline', { status: 503 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let data = {
    title: 'BidBlitz',
    body: 'Neue Nachricht',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data || {},
    requireInteraction: data.tag === 'sos_alert',
    vibrate: data.tag === 'sos_alert' ? [200, 100, 200, 100, 200] : [100, 50, 100],
    actions:
      data.tag === 'sos_alert'
        ? [
            { action: 'view', title: 'Standort öffnen' },
            { action: 'close', title: 'Schließen' },
          ]
        : [
            { action: 'open', title: 'Öffnen' },
            { action: 'close', title: 'Schließen' },
          ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC (placeholder for queued offline actions)
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(Promise.resolve());
  }
});
