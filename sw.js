// ============================================================
// SQL TUTORIAL - SERVICE WORKER
// Version: 2.0.0 (2026 Edition)
// Provides: Offline support, caching, background sync
// ============================================================

const CACHE_NAME = 'sql-tutorial-v2.0.0';
const RUNTIME_CACHE = 'sql-tutorial-runtime-v2';

// Files to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// External resources to cache when fetched
const CACHE_PATTERNS = [
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
    /cdnjs\.cloudflare\.com/
];

// ============================================================
// INSTALL EVENT - Cache core assets
// ============================================================
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching core assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: Core assets cached');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Cache failed', error);
            })
    );
});

// ============================================================
// ACTIVATE EVENT - Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Delete old versioned caches
                            return cacheName.startsWith('sql-tutorial-') && 
                                   cacheName !== CACHE_NAME &&
                                   cacheName !== RUNTIME_CACHE;
                        })
                        .map((cacheName) => {
                            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activated and controlling');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// ============================================================
// FETCH EVENT - Serve from cache, fallback to network
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        handleFetch(request)
    );
});

// ============================================================
// FETCH HANDLER - Stale-while-revalidate strategy
// ============================================================
async function handleFetch(request) {
    const url = new URL(request.url);
    
    // For navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        return handleNavigationRequest(request);
    }
    
    // For static assets and API calls
    return handleAssetRequest(request);
}

// ============================================================
// NAVIGATION REQUEST HANDLER
// ============================================================
async function handleNavigationRequest(request) {
    try {
        // Try network first for navigation
        const networkResponse = await fetch(request);
        
        // Cache the fresh response
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        console.log('📴 Network failed, serving from cache');
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return cached index.html as fallback
        return caches.match('/index.html');
    }
}

// ============================================================
// ASSET REQUEST HANDLER - Stale-while-revalidate
// ============================================================
async function handleAssetRequest(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Return cached version immediately if available
    const networkFetch = fetch(request)
        .then((networkResponse) => {
            // Update cache with fresh response
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('📴 Network request failed:', request.url);
            return null;
        });
    
    // Return cached response or wait for network
    return cachedResponse || networkFetch;
}

// ============================================================
// BACKGROUND SYNC - For offline actions
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-tutorial-progress') {
        event.waitUntil(syncProgress());
    }
});

async function syncProgress() {
    // Handle any queued offline actions
    console.log('📤 Syncing offline progress...');
    // Implementation for syncing user progress when online
}

// ============================================================
// PUSH NOTIFICATIONS - For updates
// ============================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    console.log('📬 Push notification received:', data);
    
    const options = {
        body: data.body || 'New tutorial content available!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🗄️</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'Open Tutorial'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'SQL Tutorial', options)
    );
});

// ============================================================
// NOTIFICATION CLICK HANDLER
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if none found
                return clients.openWindow(urlToOpen);
            })
    );
});

// ============================================================
// MESSAGE HANDLER - Communication with main thread
// ============================================================
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker received message:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME,
            timestamp: new Date().toISOString()
        });
    }
    
    if (event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(RUNTIME_CACHE)
                .then((cache) => cache.addAll(event.data.urls))
                .then(() => {
                    if (event.ports[0]) {
                        event.ports[0].postMessage({ success: true });
                    }
                })
        );
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => caches.delete(cacheName))
                    );
                })
                .then(() => {
                    if (event.ports[0]) {
                        event.ports[0].postMessage({ success: true });
                    }
                })
        );
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================
self.addEventListener('error', (event) => {
    console.error('❌ Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled Promise Rejection:', event.reason);
});

// ============================================================
// PERIODIC BACKGROUND SYNC - Check for updates
// ============================================================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-updates') {
        event.waitUntil(checkForUpdates());
    }
});

async function checkForUpdates() {
    console.log('🔍 Checking for tutorial updates...');
    // Implementation for checking and caching new content
}

// ============================================================
// LOG SUCCESSFUL INSTALLATION
// ============================================================
console.log('✅ Service Worker script loaded successfully');
console.log('📦 Cache Version:', CACHE_NAME);
