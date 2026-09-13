(function(){
  "use strict";
  var query=new URLSearchParams(location.search);
  var language=(query.get("lang")||localStorage.getItem("varex_language")||navigator.language||"ar").toLowerCase().split("-")[0]==="en"?"en":"ar";
  var copy={
    ar:{title:"تحميل نظام VAREX للمطاعم",brand:"RESTAURANT MANAGEMENT SYSTEM",eyebrow:"نسخة VAREX الرسمية",heading:"نظام المطاعم جاهز على كل أجهزتك.",lead:"حمّل نظام VAREX للمطاعم على جهازك. عند فتح التطبيق سجّل الدخول أو أنشئ حسابًا جديدًا، ويمكنك معاينة النظام كاملًا أولًا.",install:"تحميل التطبيق",preview:"معاينة النظام",login:"تسجيل الدخول أو إنشاء حساب",phone:"عاين النظام، أنشئ حسابك، ثم فعّل الوصول الكامل بسعر 399$.",footer:"VAREX — نظام إدارة الأعمال",privacy:"الخصوصية",terms:"الشروط",ios:"في Safari اضغط المشاركة، ثم «إضافة إلى الشاشة الرئيسية».",manual:"افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",prompt:"جارٍ فتح نافذة التثبيت…",started:"بدأ تثبيت التطبيق بنجاح.",cancelled:"تم إلغاء التثبيت. يمكنك المحاولة مرة ثانية.",chrome:"افتح هذا الرابط في Chrome لتثبيت VAREX."},
    en:{title:"Download VAREX Restaurant",brand:"RESTAURANT MANAGEMENT SYSTEM",eyebrow:"OFFICIAL VAREX APP",heading:"Your restaurant system, ready on every device.",lead:"Install VAREX Restaurant on your device. When it opens, sign in or create a new account. You can also preview the complete system first.",install:"Download the app",preview:"Preview the system",login:"Sign in or create an account",phone:"Preview the system, create your account, then unlock full access for $399.",footer:"VAREX — BUSINESS MANAGEMENT SYSTEM",privacy:"Privacy",terms:"Terms",ios:"In Safari, tap Share, then Add to Home Screen.",manual:"Open the browser menu and choose Install app or Add to Home Screen.",prompt:"Opening the installation window…",started:"Installation started successfully.",cancelled:"Installation was cancelled. You can try again.",chrome:"Open this link in Chrome to install VAREX."}
  };
  var deferredPrompt=null;
  var button=document.getElementById("installButton");
  var preview=document.getElementById("previewButton");
  var login=document.getElementById("loginButton");
  var select=document.getElementById("installLanguage");
  var status=document.getElementById("installStatus");
  function set(id,value){var node=document.getElementById(id);if(node)node.textContent=value}
  function urlFor(file,params){var url=new URL("./"+file,location.href);Object.keys(params||{}).forEach(function(key){url.searchParams.set(key,String(params[key]))});return url}
  function apply(next){language=next==="en"?"en":"ar";var text=copy[language];document.documentElement.lang=language;document.documentElement.dir=language==="ar"?"rtl":"ltr";document.title=text.title;set("brandSubtitle",text.brand);set("eyebrowText",text.eyebrow);set("heroTitle",text.heading);set("heroLead",text.lead);set("installText",text.install);set("previewText",text.preview);set("loginButton",text.login);set("phoneCaption",text.phone);set("footerBrand",text.footer);set("privacyLink",text.privacy);set("termsLink",text.terms);if(select)select.value=language;preview.href=urlFor("open-v7.html",{preview:"1",lang:language,return:urlFor("install.html",{lang:language}).href}).href;login.href=urlFor("login.html",{lang:language,return_to:urlFor("purchase.html",{lang:language}).pathname+"?lang="+language}).href;document.getElementById("privacyLink").href=urlFor("privacy.html",{lang:language}).href;document.getElementById("termsLink").href=urlFor("terms.html",{lang:language}).href;try{localStorage.setItem("varex_language",language)}catch(ignore){}}
  function show(message){status.textContent=message;status.hidden=false}
  function installed(){return window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}
  function launch(){location.replace(urlFor("launch",{source:"installed-app",lang:language}).href)}
  var ua=navigator.userAgent||"";
  var isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  var isAndroid=/Android/i.test(ua);
  var isEmbedded=/\bwv\b|; wv\)|FBAN|FBAV|Instagram|TikTok|ChatGPT|Line\//i.test(ua);
  async function startInstall(){
    var text=copy[language];
    if(installed()){launch();return}
    if(isIOS){show(text.ios);return}
    if(isAndroid&&isEmbedded){show(text.chrome);return}
    if(!deferredPrompt){show(text.manual);return}
    button.disabled=true;show(text.prompt);
    try{await deferredPrompt.prompt();var choice=await deferredPrompt.userChoice;deferredPrompt=null;show(choice&&choice.outcome==="accepted"?text.started:text.cancelled);if(choice&&choice.outcome==="accepted")setTimeout(launch,250)}catch(error){show(text.manual)}finally{button.disabled=false}
  }
  window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();deferredPrompt=event});
  window.addEventListener("appinstalled",function(){deferredPrompt=null;show(copy[language].started);setTimeout(launch,250)});
  button.addEventListener("click",startInstall);
  select.addEventListener("change",function(){apply(select.value)});
  apply(language);
  if("serviceWorker" in navigator){var sw=urlFor("sw.js");navigator.serviceWorker.register(sw.href,{scope:new URL("./",location.href).pathname,updateViaCache:"none"}).then(function(reg){return reg.update()}).catch(function(){})}
})();
