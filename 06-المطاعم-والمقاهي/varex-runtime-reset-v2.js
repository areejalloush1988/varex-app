(function(){
  "use strict";
  document.documentElement.classList.add("varex-no-motion");
  try{["varex_re_haptic","varex_dining_haptic","varex_salon_haptic","varex_mobility_haptic"].forEach(function(key){localStorage.setItem(key,"off")});if(navigator.vibrate)navigator.vibrate(0)}catch(error){}
  async function resetRuntime(){if("serviceWorker" in navigator){try{var registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(async function(registration){try{await registration.update()}catch(error){}try{await registration.unregister()}catch(error){}}))}catch(error){}}if("caches" in window){try{var names=await caches.keys();await Promise.all(names.map(function(name){return caches.delete(name)}))}catch(error){}}}
  var installPrompt=null;
  function showInstallButton(){
    if(!installPrompt||window.matchMedia("(display-mode: standalone)").matches||document.getElementById("varexInstallApp"))return;
    var button=document.createElement("button");
    button.type="button";button.id="varexInstallApp";button.textContent="تثبيت التطبيق";
    button.style.cssText="position:fixed;z-index:500;inset-inline-start:18px;bottom:18px;min-height:46px;padding:10px 16px;border:1px solid #fff;border-radius:13px;background:#E56F2D;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.24);font:800 12px Arial,Tahoma,sans-serif;cursor:pointer;animation:none;transition:none";
    button.addEventListener("click",async function(){if(!installPrompt)return;button.disabled=true;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;button.remove()});
    document.body.appendChild(button);
  }
  window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();installPrompt=event;showInstallButton()});
  window.addEventListener("appinstalled",function(){installPrompt=null;var button=document.getElementById("varexInstallApp");if(button)button.remove()});
  resetRuntime();window.addEventListener("load",resetRuntime,{once:true});
})();
