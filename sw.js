const CACHE_NAME = "varex-cache-v2";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./pos.html",
    "./products.html",
    "./customers.html",
    "./suppliers.html",
    "./accounts.html",
    "./employees.html",
    "./reports.html",
    "./setting.html",
    "./varex.js",
    "./manifest.json",
    "./varex-icon-192.png",
    "./varex-icon-512.png"
];

/* ==========================================
   INSTALL
========================================== */
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
    );

    self.skipWaiting();
});

/* ==========================================
   ACTIVATE
========================================== */
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            return cacheName !== CACHE_NAME;
                        })
                        .map(cacheName => {
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

/* ==========================================
   FETCH
========================================== */
self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {

                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type === "opaque"
                        ) {
                            return networkResponse;
                        }

                        const responseToCache =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(
                                    event.request,
                                    responseToCache
                                );
                            });

                        return networkResponse;
                    });
            })
    );
});
