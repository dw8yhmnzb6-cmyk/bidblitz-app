// BidBlitz Service Worker — build-aware update lifecycle
// - HTML navigations are network-only (offline page fallback) and are never stored in Cache Storage.
// - CRA /static/ assets rely on their content hashes + HTTP immutable caching.
// - Only explicitly safe GET API routes use a network-first offline cache.
// - Auth, wallet, payments, checkout and all mutations bypass the SW entirely.

const swUrl = new URL(self.location.href);
const rawBuildId = swUrl.searchParams.get('v') || 'unversioned';
const BUILD_ID = rawBuildId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
const CACHE_NAME = `bidblitz-static-${BUILD_ID}`;
const API_CACHE_NAME = `bidblitz-api-${BUILD_ID}`;
const OFFLINE_URL = '/offline.html';

const CACHEABLE_API_ROUTES = [
  '/api/food/restaurants',
  '/api/kids/children',
];

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
  '/api/bidblitz-pay',
  '/api/topup',
  '/api/refund',
  '/api/checkout',
  '/api/auctions',
  '/login',
  '/logout',
  '/register',
];

const isBidBlitzCache = (name) =>
  name.startsWith('bidblitz-static-') || name.startsWith('bidblitz-api-');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const oldBidBlitzCaches = cacheNames.filter(
      (name) =>
        isBidBlitzCache(name) &&
        name !== CACHE_NAME &&
        name !== API_CACHE_NAME
    );

    await Promise.all(oldBidBlitzCaches.map((name) => caches.delete(name)));
    await self.clients.claim();

    // Do not show an update banner on a customer's very first visit. An update
    // event is only emitted when this activation actually replaced an older
    // BidBlitz cache generation. version.json remains the authoritative fallback.
    if (oldBidBlitzCaches.length > 0) {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        try {
          client.postMessage({
            type: 'SW_UPDATED',
            buildId: BUILD_ID,
          });
        } catch (error) {
          void error;
        }
      }
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);

  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return;
  }

  if (req.method !== 'GET') return;
  if (req.headers.get('Authorization')) return;

  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_ROUTES.some((route) =>
      url.pathname.startsWith(route)
    );
    if (!isCacheable) return;

    event.respondWith(handleCacheableApi(req));
    return;
  }

  // Never put HTML/app-shell navigations in Cache Storage. A fresh navigation
  // must hit the network so a new index.html can reference the new hashed assets.
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
  }

  // All other same-origin assets are intentionally left to the browser HTTP
  // cache. CRA fingerprints /static/ assets, so long-lived immutable caching is safe.
});

async function handleNavigation(req) {
  try {
    const freshRequest = new Request(req, { cache: 'no-store' });
    return await fetch(freshRequest);
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

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
      } catch (error) {
        void error;
      }
    }
    return res;
  } catch (error) {
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
    } catch (error) {
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
        if (
          client.url === new URL(urlToOpen, self.location.origin).href &&
          'focus' in client
        ) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
      return undefined;
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(Promise.resolve());
  }
});
