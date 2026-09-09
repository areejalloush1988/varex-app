/* VAREX native locale loader â€” no external translation service. */
(function(global){
  "use strict";

  const languages=[
    {code:"en",name:"English",dir:"ltr",locale:"en-GB"},
    {code:"ar",name:"Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©",dir:"rtl",locale:"ar-AE"},
    {code:"fa",name:"ÙØ§Ø±Ø³ÛŒ",dir:"rtl",locale:"fa-IR"},
    {code:"ur",name:"Ø§Ø±Ø¯Ùˆ",dir:"rtl",locale:"ur-PK"},
    {code:"zh",name:"ä¸­æ–‡",dir:"ltr",locale:"zh-CN"},
    {code:"ko",name:"í•œêµ­ì–´",dir:"ltr",locale:"ko-KR"},
    {code:"fr",name:"FranÃ§ais",dir:"ltr",locale:"fr-FR"},
    {code:"es",name:"EspaÃ±ol",dir:"ltr",locale:"es-ES"},
    {code:"it",name:"Italiano",dir:"ltr",locale:"it-IT"},
    {code:"he",name:"×¢×‘×¨×™×ª",dir:"rtl",locale:"he-IL"},
    {code:"ru",name:"Ð ÑƒÑÑÐºÐ¸Ð¹",dir:"ltr",locale:"ru-RU"},
    {code:"tr",name:"TÃ¼rkÃ§e",dir:"ltr",locale:"tr-TR"}
  ];
  const byCode=new Map(languages.map(item=>[item.code,item]));
  const cache=new Map();
  const phraseCache=new WeakMap();
  const defaultLanguage="en";
  const localeVersion="20260829-cashier-native-3";
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
    return normalize(query||safeStorage(localStorage,"varexLanguage")||safeStorage(localStorage,"varex_cashier_language")||safeStorage(localStorage,"varex_language")||safeStorage(localStorage,"varex_launcher_language")||defaultLanguage);
  }

  function persist(code){
    const next=normalize(code);
    try{localStorage.setItem("varexLanguage",next);localStorage.setItem("varex_cashier_language",next);localStorage.setItem("varex_language",next);localStorage.setItem("varex_launcher_language",next)}catch(_){}
    try{sessionStorage.setItem("varex_language",next)}catch(_){}
    return next;
  }

  function interpolate(value,variables){
    if(!variables)return value;
    return String(value).replace(/\{([\w-]+)\}/g,(match,key)=>Object.prototype.hasOwnProperty.call(variables,key)?String(variables[key]):match);
  }

  function packFrom(code,data={}){
    const meta=byCode.get(code)||byCode.get(defaultLanguage);
    const bundled=data&&typeof data.messages==="object"&&!Array.isArray(data.messages)?data.messages:{};
    const cashierExtras=global.VAREXCashierLocaleExtras?.[code]||{};
    const messages={...bundled,...cashierExtras};
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
        const response=await fetch(localeUrl,{cache:"force-cache",credentials:"same-origin"});
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

  function translatedFragments(message,active){
    let index=phraseCache.get(active);
    if(!index){
      index=new Map();
      Object.keys(active.messages).filter(key=>/[A-Za-z]/.test(key)&&active.messages[key]!==key).forEach(key=>{const first=key[0],items=index.get(first)||[];items.push(key);index.set(first,items)});
      index.forEach(items=>items.sort((a,b)=>b.length-a.length));phraseCache.set(active,index);
    }
    const source=String(message??"");let output="",cursor=0,unresolved=false;
    const isWord=value=>Boolean(value&&/[\p{L}\p{N}]/u.test(value));
    while(cursor<source.length){
      const candidates=index.get(source[cursor])||[];
      const key=candidates.find(candidate=>source.startsWith(candidate,cursor)&&!(cursor>0&&isWord(source[cursor-1])&&isWord(candidate[0]))&&!(isWord(candidate.at(-1))&&isWord(source[cursor+candidate.length])));
      if(key){output+=active.messages[key];cursor+=key.length;continue}
      const token=source.slice(cursor).match(/^[A-Za-z][A-Za-z0-9&+./-]*/)?.[0];
      if(token){if(!/^(?:VAREX|PayPal|VAT|TRN|AED|USD|SKU|CSV|PDF|A4|AM|PM|kg|mm|ml|ID)$/i.test(token))unresolved=true;output+=token;cursor+=token.length;continue}
      output+=source[cursor++];
    }
    return unresolved?"":output;
  }

  function fallback(message,pack,variables){
    const active=pack&&typeof pack.t==="function"?pack:packFrom(defaultLanguage);
    const value=String(message??"").trim();
    const composed=translatedFragments(value,active);if(composed)return interpolate(composed,variables);
    let key="System Message";
    if(/(?:unable|error|failed|incorrect|invalid|expired|denied|not found|cannot|could not|unavailable)/i.test(value))key="Unable to complete this action.";
    else if(/(?:loading|starting|preparing|verifying|sending|registering|signing|processing|syncing|checking|waiting)/i.test(value))key="Loading...";
    else if(/(?:saved|completed|added|activated|updated|sent|copied|confirmed|deleted|success)/i.test(value))key="Operation Completed";
    else if(/[?ØŸ]$/.test(value)||/(?:confirm|continue|do you want|are you sure)/i.test(value))key="Do you want to continue?";
    return interpolate(active.messages[key]||key,variables);
  }

  function preload(){return Promise.all(languages.map(item=>load(item.code)))}

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

  global.VAREXLocale=Object.freeze({languages,defaultLanguage,normalize,readLanguage,persist,load,preload,translate,fallback,applyDocument,fillSelect,withLanguage,direction:code=>(byCode.get(normalize(code))||byCode.get(defaultLanguage)).dir,locale:code=>(byCode.get(normalize(code))||byCode.get(defaultLanguage)).locale});
})(window);
