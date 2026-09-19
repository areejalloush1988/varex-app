const CACHE_NAME = "varex-ai-shell-v64";
const scopeRoot = new URL("./", self.registration.scope);
const scoped = path => new URL(path, scopeRoot).href;
const APP_SHELL = [
  "./legacy-index.html",
  "./app.js",
  "./i18n.js",
  "./command-engine.js",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./install",
  "./install.css",
  "./install.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
].map(scoped);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("varex-ai-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || /\/api\//.test(url.pathname) || request.headers.has("authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(scoped("./legacy-index.html"))) || Response.error();
      })
    );
    return;
  }

  const staticDestination = new Set(["style", "script", "image", "font"]).has(request.destination);
  const staticExtension = /\.(?:css|js|svg|png|webp|woff2?|json|webmanifest)$/i.test(url.pathname);
  if (!staticDestination && !staticExtension) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return (await cache.match(request)) || Response.error();
    }
  })());
});
