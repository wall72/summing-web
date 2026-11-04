// Cache-first app shell. The whole shell is cached atomically per CACHE version, so files from
// different releases are never mixed. Bump CACHE whenever any file in SHELL changes.
const CACHE = 'summing-v6';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'logic.js', 'game.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', event => {
    // `cache: 'reload'` skips the HTTP cache so a new version never stores stale files.
    const requests = SHELL.map(url => new Request(url, { cache: 'reload' }));
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) {
        return;
    }

    event.respondWith(
        caches.open(CACHE)
            .then(cache => cache.match(request.mode === 'navigate' ? './' : request, { ignoreSearch: true }))
            .then(cached => cached || fetch(request))
            .catch(() => Response.error())
    );
});
