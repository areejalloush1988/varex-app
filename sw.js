const CACHE_NAME = "varex-cache-v1";

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
    "./manifest.json"
];

/* تثبيت الـ Service Worker */
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
    );

    self.skipWaiting();
});

/* تفعيل النسخة الجديدة وحذف الكاش القديم */
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );
        })
    );

    self.clients.claim();
});

/* تشغيل الملفات من الكاش عند الحاجة */
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
                        return networkResponse;
                    });
            })
    );
});