const CACHE_NAME = "varex-cache-v3";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./login.html",
    "./register.html",
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
   DELETE OLD CACHES
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


    const request = event.request;

    const url = new URL(request.url);


    /* ======================================
       HTML + JAVASCRIPT
       NETWORK FIRST

       Always try to get the newest version.
    ====================================== */

    if (
        request.mode === "navigate" ||
        url.pathname.endsWith(".html") ||
        url.pathname.endsWith(".js")
    ) {

        event.respondWith(

            fetch(request)

                .then(networkResponse => {

                    if (
                        networkResponse &&
                        networkResponse.status === 200
                    ) {

                        const responseToCache =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {

                                cache.put(
                                    request,
                                    responseToCache
                                );

                            });

                    }

                    return networkResponse;

                })

                .catch(() => {

                    return caches.match(request)
                        .then(cachedResponse => {

                            if (cachedResponse) {
                                return cachedResponse;
                            }

                            if (request.mode === "navigate") {

                                return caches.match(
                                    "./login.html"
                                );

                            }

                            return Response.error();

                        });

                })

        );

        return;
    }


    /* ======================================
       STATIC FILES
       CACHE FIRST
    ====================================== */

    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)

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
                                    request,
                                    responseToCache
                                );

                            });


                        return networkResponse;

                    });

            })

    );

});
