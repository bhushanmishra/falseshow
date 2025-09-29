// Service Worker for False Show PWA

const CACHE_NAME = 'false-show-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/play.html',
    '/css/styles.css',
    '/css/game.css',
    '/js/app.js',
    '/js/cards.js',
    '/js/game-engine.js',
    '/js/multiplayer.js',
    '/js/ui.js',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                //console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        //console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
    // Skip caching for Trystero WebRTC connections
    if (event.request.url.includes('esm.run') ||
        event.request.url.includes('unpkg.com') ||
        event.request.url.includes('cdn.') ||
        event.request.url.includes('wss://') ||
        event.request.url.includes('ws://') ||
        event.request.url.includes('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Don't cache chrome-extension URLs
                    if (event.request.url.startsWith('chrome-extension://')) {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                }).catch(() => {
                    // Offline fallback
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// Background sync for game state
self.addEventListener('sync', event => {
    if (event.tag === 'sync-game-state') {
        event.waitUntil(syncGameState());
    }
});

async function syncGameState() {
    // This would sync any pending game actions when connection is restored
    //console.log('Syncing game state...');
}