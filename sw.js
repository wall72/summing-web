// Stale-while-revalidate for the app shell. Bump CACHE when shipping incompatible changes.
const CACHE = 'summing-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'logic.js', 'game.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) {
        return;
    }

    event.respondWith(
        caches.open(CACHE).then(async cache => {
            const cached = await cache.match(event.request);
            const network = fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
