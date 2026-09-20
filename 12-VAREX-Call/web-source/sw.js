const CACHE = "varex-call-shell-v7";
const SHELL = [
  "/call/",
  "/call/index.html",
  "/call/styles.css?v=20260920-7",
  "/call/app.js?v=20260920-7",
  "/call/manifest.webmanifest?v=20260920-7",
  "/varex-icon-192.png",
  "/varex-icon-512.png",
  "/fonts/noto-kufi-arabic.woff"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("varex-call-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/call/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/call/index.html")));
    return;
  }
  if (!url.pathname.startsWith("/call/") && !url.pathname.startsWith("/varex-icon-") && !url.pathname.startsWith("/fonts/")) return;
  const mustRefresh = url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".webmanifest");
  if (mustRefresh) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    })),
  );
});
