const CACHE_NAME="varex-cache-v21-header-feedback";
const IS_NATIVE_APP=self.location.hostname==="localhost";

const FILES_TO_CACHE=[
"./",
"./index.html",
"./systems.html",
"./novarex.html",
"./real-estate-properties.html",
"./real-estate-owners.html",
"./real-estate-clients.html",
"./real-estate-deals.html",
"./real-estate-contracts.html",
"./real-estate-payments.html",
"./real-estate-maintenance.html",
"./real-estate-employees.html",
"./real-estate-reports.html",
"./real-estate-settings.html",
"./real-estate.css",
"./real-estate.js",
"./varex-real-estate-icon.svg",
"./login.html",
"./register.html",
"./terms.html",
"./privacy.html",
"./pos.html",
"./products.html",
"./customers.html",
"./suppliers.html",
"./accounts.html",
"./employees.html",
"./reports.html",
"./tax-return.html",
"./subscription.html",
"./setting.html",
"./varex.js",
"./varex-hardware.js",
"./varex-i18n.js",
"./varex-navigation.js",
"./varex-theme.css",
"./account-deletion.js",
"./manifest.json",
"./varex-brand-icon.svg",
"./varex-icon-192.png",
"./varex-icon-512.png"
];

self.addEventListener("install",event=>{
if(IS_NATIVE_APP){event.waitUntil(self.registration.unregister());return}
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache=>cache.addAll(FILES_TO_CACHE))
);
self.skipWaiting();
});

self.addEventListener("activate",event=>{
if(IS_NATIVE_APP){event.waitUntil(self.registration.unregister());return}
event.waitUntil(
caches.keys()
.then(names=>Promise.all(
names
.filter(name=>name!==CACHE_NAME)
.map(name=>caches.delete(name))
))
.then(()=>self.clients.claim())
);
});

self.addEventListener("fetch",event=>{
if(IS_NATIVE_APP)return;
if(event.request.method!=="GET")return;

const request=event.request;
const url=new URL(request.url);

if(url.origin!==self.location.origin)return;

if(
request.mode==="navigate"||
url.pathname.endsWith(".html")||
url.pathname.endsWith(".js")||
url.pathname.endsWith(".json")
){
event.respondWith(
fetch(request,{cache:"no-store"})
.then(response=>{
if(response&&response.ok){
const copy=response.clone();
caches.open(CACHE_NAME)
.then(cache=>cache.put(request,copy));
}
return response;
})
.catch(async()=>{
const cached=await caches.match(request);

if(cached)return cached;  

      if(request.mode==="navigate"){  
        return caches.match("./login.html");  
      }  

      return Response.error();  
    })  
);  

return;

}

event.respondWith(
caches.match(request)
.then(cached=>{
if(cached)return cached;

return fetch(request)  
      .then(response=>{  
        if(  
          !response||  
          !response.ok||  
          response.type==="opaque"  
        ){  
          return response;  
        }  

        const copy=response.clone();  

        caches.open(CACHE_NAME)  
          .then(cache=>cache.put(request,copy));  

        return response;  
      });  
  })

);
});
