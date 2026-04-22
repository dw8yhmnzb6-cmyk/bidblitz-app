const CACHE_NAME = 'bidblitz-v10-offline-api';
const API_CACHE_NAME = 'bidblitz-api-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// API endpoints to cache for offline access
const CACHEABLE_API_ROUTES = [
  '/api/auctions/active',
  '/api/wallet/balance',
  '/api/auth/me',
  '/api/kids/children',
  '/api/taxi/nearby',
  '/api/food/restaurants',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('BidBlitz: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {
    title: 'BidBlitz Benachrichtigung',
    body: 'Neue Nachricht erhalten',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'default',
    data: {}
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    tag: data.tag || 'default',
    data: data.data || {},
    requireInteraction: data.tag === 'sos_alert', // SOS stays on screen
    vibrate: data.tag === 'sos_alert' ? [200, 100, 200, 100, 200] : [100, 50, 100],
    actions: data.tag === 'sos_alert' ? [
      { action: 'view', title: 'Standort öffnen', icon: '/logo192.png' },
      { action: 'close', title: 'Schließen', icon: '/logo192.png' }
    ] : []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification clicked
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});


// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // CRITICAL: Never cache auth endpoints (login, register, logout)
  if (url.pathname.includes('/api/auth/login') || 
      url.pathname.includes('/api/auth/register') ||
      url.pathname.includes('/api/auth/logout') ||
      url.pathname.includes('/api/auth/refresh') ||
      url.pathname.includes('/api/auth/verify-2fa')) {
    return; // Let browser handle these directly, no caching
  }
  
  // Handle API requests with cache-first for specific routes
  if (url.pathname.includes('/api/')) {
    const isCacheable = CACHEABLE_API_ROUTES.some(route => url.pathname.includes(route));
    
    if (isCacheable) {
      // Network first, fallback to cache, cache response
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response.status === 200) {
              // CRITICAL FIX: Wrap clone in try-catch to prevent "object cannot be cloned" errors
              try {
                const responseClone = response.clone();
                caches.open(API_CACHE_NAME).then((cache) => {
                  // Cache with 5 min expiry header
                  const headers = new Headers(responseClone.headers);
                  headers.set('sw-cache-time', Date.now().toString());
                  const cachedResponse = new Response(responseClone.body, {
                    status: responseClone.status,
                    statusText: responseClone.statusText,
                    headers: headers
                  });
                  cache.put(event.request, cachedResponse);
                }).catch(() => {}); // Silently fail cache write
              } catch (cloneError) {
                console.warn('[SW] Cannot clone response:', event.request.url, cloneError);
              }
            }
            return response;
          })
          .catch(async () => {
            // Offline - return cached API response
            const cached = await caches.match(event.request);
            if (cached) {
              // Check if cache is stale (> 5 min)
              const cacheTime = cached.headers.get('sw-cache-time');
              const age = cacheTime ? (Date.now() - parseInt(cacheTime)) / 1000 : 0;
              
              // Add offline indicator header
              const headers = new Headers(cached.headers);
              headers.set('X-Offline-Cache', 'true');
              headers.set('X-Cache-Age', age.toString());
              
              return new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers: headers
              });
            }
            return new Response(JSON.stringify({ error: 'offline', message: 'Keine Verbindung' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          })
      );
    }
    return; // Don't cache other API requests
  }

  // Handle static assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Neue Benachrichtigung',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      { action: 'open', title: 'Öffnen' },
      { action: 'close', title: 'Schließen' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification('BidBlitz', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Sync any queued transactions when back online
  console.log('BidBlitz: Syncing offline transactions');
}
