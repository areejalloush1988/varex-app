const CACHE="varex-pharmacy-v2-20260822";
const ASSETS=["./","./index.html","./login.html","./register.html","./forgot-password.html","./verify-email.html","./reset-password.html","./app.html","./styles.css","./auth.js","./app.js","./manifest.json","./varex-pharmacy-logo.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("varex-pharmacy-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./login.html"))));
});
