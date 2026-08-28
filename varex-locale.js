/* VAREX native locale loader — no external translation service. */
(function(global){
  "use strict";

  const languages=[
    {code:"en",name:"English",dir:"ltr",locale:"en-GB"},
    {code:"ar",name:"العربية",dir:"rtl",locale:"ar-AE"},
    {code:"fa",name:"فارسی",dir:"rtl",locale:"fa-IR"},
    {code:"ur",name:"اردو",dir:"rtl",locale:"ur-PK"},
    {code:"zh",name:"中文",dir:"ltr",locale:"zh-CN"},
    {code:"ko",name:"한국어",dir:"ltr",locale:"ko-KR"},
    {code:"it",name:"Italiano",dir:"ltr",locale:"it-IT"},
    {code:"es",name:"Español",dir:"ltr",locale:"es-ES"},
    {code:"he",name:"עברית",dir:"rtl",locale:"he-IL"},
    {code:"fr",name:"Français",dir:"ltr",locale:"fr-FR"},
    {code:"ru",name:"Русский",dir:"ltr",locale:"ru-RU"},
    {code:"tr",name:"Türkçe",dir:"ltr",locale:"tr-TR"}
  ];
  const byCode=new Map(languages.map(item=>[item.code,item]));
  const cache=new Map();
  const defaultLanguage="en";
  const localeVersion="20260828-native-auth2";
  const scriptSource=document.currentScript&&document.currentScript.src?document.currentScript.src:new URL("./varex-locale.js",location.href).href;
  const localeBase=new URL("./locales/",scriptSource);

  function normalize(value){
    const raw=String(value||"").trim().toLowerCase().replace("_","-");
    const alias=raw==="zh-cn"||raw==="zh-hans"?"zh":raw==="iw"?"he":raw.split("-")[0];
    return byCode.has(alias)?alias:defaultLanguage;
  }

  function safeStorage(storage,key){try{return storage.getItem(key)||""}catch(_){return""}}
  function readLanguage(input){
    let query="";
    if(input instanceof URLSearchParams)query=input.get("lang")||"";
    else if(typeof input==="string")query=input;
    else{try{query=new URLSearchParams(location.search).get("lang")||""}catch(_){}}
    return normalize(query||safeStorage(localStorage,"varex_language")||safeStorage(localStorage,"varex_launcher_language")||defaultLanguage);
  }

  function persist(code){
    const next=normalize(code);
    try{localStorage.setItem("varex_language",next);localStorage.setItem("varex_launcher_language",next)}catch(_){}
    try{sessionStorage.setItem("varex_language",next)}catch(_){}
    return next;
  }

  function interpolate(value,variables){
    if(!variables)return value;
    return String(value).replace(/\{([\w-]+)\}/g,(match,key)=>Object.prototype.hasOwnProperty.call(variables,key)?String(variables[key]):match);
  }

  function packFrom(code,data={}){
    const meta=byCode.get(code)||byCode.get(defaultLanguage);
    const messages=data&&typeof data.messages==="object"&&!Array.isArray(data.messages)?data.messages:{};
    return Object.freeze({
      code,
      name:data.name||meta.name,
      dir:data.dir||meta.dir,
      locale:data.locale||meta.locale,
      messages:Object.freeze({...messages}),
      t(message,variables){return interpolate(messages[message]||message,variables)}
    });
  }

  async function load(value){
    const code=normalize(value);
    if(cache.has(code))return cache.get(code);
    const promise=(async()=>{
      try{
        const localeUrl=new URL(`${code}.json`,localeBase);localeUrl.searchParams.set("v",localeVersion);
        const response=await fetch(localeUrl,{cache:"no-store",credentials:"same-origin"});
        if(!response.ok)throw new Error(`Locale ${code} unavailable`);
        return packFrom(code,await response.json());
      }catch(error){
        console.warn("VAREX locale fallback:",code,error);
        return packFrom(code);
      }
    })();
    cache.set(code,promise);
    return promise;
  }

  function translate(message,pack,variables){
    const active=pack&&typeof pack.t==="function"?pack:packFrom(defaultLanguage);
    return active.t(String(message??""),variables);
  }

  function applyDocument(pack){
    const active=pack||packFrom(defaultLanguage);
    document.documentElement.lang=active.code;
    document.documentElement.dir=active.dir;
    document.documentElement.dataset.varexLanguage=active.code;
  }

  function fillSelect(select,selected){
    if(!select)return;
    const code=normalize(selected);
    select.innerHTML=languages.map(item=>`<option value="${item.code}"${item.code===code?" selected":""}>${item.name}</option>`).join("");
    select.value=code;
  }

  function withLanguage(input,language,extras={}){
    const url=input instanceof URL?new URL(input.href):new URL(String(input),location.href);
    url.searchParams.set("lang",normalize(language));
    Object.entries(extras).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")url.searchParams.set(key,String(value))});
    return url;
  }

  global.VAREXLocale=Object.freeze({languages,defaultLanguage,normalize,readLanguage,persist,load,translate,applyDocument,fillSelect,withLanguage,direction:code=>(byCode.get(normalize(code))||byCode.get(defaultLanguage)).dir,locale:code=>(byCode.get(normalize(code))||byCode.get(defaultLanguage)).locale});
})(window);
