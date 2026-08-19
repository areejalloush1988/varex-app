const CACHE_NAME="varex-cache-v9-neutral";

const FILES_TO_CACHE=[
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

self.addEventListener("install",event=>{
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache=>cache.addAll(FILES_TO_CACHE))
);
self.skipWaiting();
});

self.addEventListener("activate",event=>{
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
