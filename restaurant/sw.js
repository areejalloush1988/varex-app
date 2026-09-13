const CACHE_NAME="varex-restaurant-storefront-v1";
const ROOT_PATH=new URL("./",self.location.href).pathname.replace(/\/$/,"");
const asset=path=>`${ROOT_PATH}/${String(path).replace(/^\/+/,"")}`;
const OFFLINE_SHELL=[
  asset("install.html"),asset("login.html"),asset("register.html"),asset("purchase.html"),
  asset("manifest.json"),asset("restaurant-auth.css?v=1"),asset("restaurant-purchase.css?v=1"),
  asset("restaurant-auth.js?v=3"),asset("restaurant-install.js?v=1"),asset("restaurant-purchase.js?v=1"),
  asset("varex-restaurant-brand.svg"),asset("varex-restaurant-icon-192-v2.png"),asset("varex-restaurant-icon-512-v2.png")
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(OFFLINE_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name!==CACHE_NAME).map(name=>caches.delete(name)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(request).then(response=>{if(response.ok&&request.mode!=="navigate"&&/\.(?:css|js|png|svg|json)$/i.test(url.pathname)){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response}).catch(async()=>{const cached=await caches.match(request);if(cached)return cached;if(request.mode==="navigate"){const login=await caches.match(asset("login.html"));if(login)return login}return Response.error()}));
});
