const CACHE_NAME="varex-cache-v36-organized-systems";
const IS_NATIVE_APP=self.location.hostname==="localhost";

const FILES_TO_CACHE=[
"./",
"./index.html",
"./systems.html",
"./business-setup.html",
"./02-إدارة-العقارات/novarex.html",
"./02-إدارة-العقارات/real-estate-properties.html",
"./02-إدارة-العقارات/real-estate-owners.html",
"./02-إدارة-العقارات/real-estate-clients.html",
"./02-إدارة-العقارات/real-estate-deals.html",
"./02-إدارة-العقارات/real-estate-contracts.html",
"./02-إدارة-العقارات/real-estate-payments.html",
"./02-إدارة-العقارات/real-estate-maintenance.html",
"./02-إدارة-العقارات/real-estate-employees.html",
"./02-إدارة-العقارات/real-estate-reports.html",
"./02-إدارة-العقارات/real-estate-settings.html",
"./02-إدارة-العقارات/real-estate.css",
"./02-إدارة-العقارات/real-estate.js",
"./02-إدارة-العقارات/varex-real-estate-icon.svg",
"./05-الصالونات-والسبا/salons.html",
"./05-الصالونات-والسبا/salon-women.html",
"./05-الصالونات-والسبا/salon-men.html",
"./05-الصالونات-والسبا/salon-appointments.html",
"./05-الصالونات-والسبا/salon-clients.html",
"./05-الصالونات-والسبا/salon-services.html",
"./05-الصالونات-والسبا/salon-staff.html",
"./05-الصالونات-والسبا/salon-facilities.html",
"./05-الصالونات-والسبا/salon-pos.html",
"./05-الصالونات-والسبا/salon-inventory.html",
"./05-الصالونات-والسبا/salon-commissions.html",
"./05-الصالونات-والسبا/salon-reports.html",
"./05-الصالونات-والسبا/salon-settings.html",
"./05-الصالونات-والسبا/salon.css",
"./05-الصالونات-والسبا/salon.js",
"./05-الصالونات-والسبا/varex-salon-icon.svg",
"./06-المطاعم-والمقاهي/dining.html",
"./06-المطاعم-والمقاهي/restaurant.html",
"./06-المطاعم-والمقاهي/cafe.html",
"./06-المطاعم-والمقاهي/dining-pos.html",
"./06-المطاعم-والمقاهي/dining-orders.html",
"./06-المطاعم-والمقاهي/dining-tables.html",
"./06-المطاعم-والمقاهي/dining-menu.html",
"./06-المطاعم-والمقاهي/dining-kitchen.html",
"./06-المطاعم-والمقاهي/dining-clients.html",
"./06-المطاعم-والمقاهي/dining-staff.html",
"./06-المطاعم-والمقاهي/dining-inventory.html",
"./06-المطاعم-والمقاهي/dining-suppliers.html",
"./06-المطاعم-والمقاهي/dining-reports.html",
"./06-المطاعم-والمقاهي/dining-settings.html",
"./06-المطاعم-والمقاهي/dining.css",
"./06-المطاعم-والمقاهي/dining.js",
"./06-المطاعم-والمقاهي/varex-dining-icon.svg",
"./03-إدارة-تأجير-السيارات/car-rental.html",
"./03-إدارة-تأجير-السيارات/car-rental-fleet.html",
"./03-إدارة-تأجير-السيارات/car-rental-reservations.html",
"./03-إدارة-تأجير-السيارات/car-rental-contracts.html",
"./03-إدارة-تأجير-السيارات/car-rental-customers.html",
"./03-إدارة-تأجير-السيارات/car-rental-inspections.html",
"./03-إدارة-تأجير-السيارات/car-rental-payments.html",
"./03-إدارة-تأجير-السيارات/car-rental-fines.html",
"./03-إدارة-تأجير-السيارات/car-rental-maintenance.html",
"./03-إدارة-تأجير-السيارات/car-rental-staff.html",
"./03-إدارة-تأجير-السيارات/car-rental-reports.html",
"./03-إدارة-تأجير-السيارات/car-rental-settings.html",
"./04-كار-ليفت/taxi.html",
"./04-كار-ليفت/taxi-dispatch.html",
"./04-كار-ليفت/taxi-trips.html",
"./04-كار-ليفت/taxi-drivers.html",
"./04-كار-ليفت/taxi-fleet.html",
"./04-كار-ليفت/taxi-customers.html",
"./04-كار-ليفت/taxi-bookings.html",
"./04-كار-ليفت/taxi-payments.html",
"./04-كار-ليفت/taxi-maintenance.html",
"./04-كار-ليفت/taxi-staff.html",
"./04-كار-ليفت/taxi-reports.html",
"./04-كار-ليفت/taxi-settings.html",
"./03-إدارة-تأجير-السيارات/mobility.css",
"./04-كار-ليفت/mobility.css",
"./03-إدارة-تأجير-السيارات/mobility.js",
"./04-كار-ليفت/mobility.js",
"./03-إدارة-تأجير-السيارات/varex-car-rental-icon.svg",
"./04-كار-ليفت/varex-taxi-icon.svg",
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
"./security-center.html",
"./varex-security.js",
"./varex-ai-assistant.html",
"./varex-ai.js",
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
