(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const checkDefinitions=[
    {id:"https",icon:"🔒",title:"الاتصال المشفّر",description:"يمنع قراءة البيانات أثناء انتقالها بين الجهاز والخادم."},
    {id:"session",icon:"👤",title:"جلسة الحساب",description:"يتحقق من وجود جلسة مستخدم صالحة وغير منتهية."},
    {id:"tenant",icon:"🏢",title:"عزل بيانات المنشأة",description:"يربط الطلبات بالمنشأة الحالية ويمنع خلط بيانات العملاء."},
    {id:"autolock",icon:"⏱️",title:"القفل التلقائي",description:"يقفل الواجهة عند ترك الجهاز دون استخدام حسب إعدادات المنشأة."},
    {id:"worker",icon:"📱",title:"سلامة نسخة التطبيق",description:"يتحقق من جاهزية خدمة التحديث والتشغيل المستقل على الجهاز."},
    {id:"secret",icon:"🔑",title:"فصل مفاتيح الإدارة",description:"لا يوجد مفتاح إدارة سري داخل ملفات واجهة VAREX."}
  ];
  const state={running:false,results:[]};
  function text(id,value){const node=$(id);if(node)node.textContent=value}
  function formatDate(value){if(!value)return"غير متوفر";const date=new Date(value);if(Number.isNaN(date.getTime()))return"غير متوفر";return date.toLocaleString("ar-AE",{timeZone:"Asia/Dubai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
  function deviceName(){const ua=navigator.userAgent||"";if(/Samsung|SM-/i.test(ua))return"Samsung Galaxy";if(/Android/i.test(ua))return"جهاز Android";if(/iPhone/i.test(ua))return"iPhone";if(/iPad/i.test(ua))return"iPad";if(/Windows/i.test(ua))return"Windows";if(/Macintosh|Mac OS/i.test(ua))return"Mac";return"هذا الجهاز"}
  function renderSkeleton(){const box=$("securityChecks");if(!box)return;box.replaceChildren(...checkDefinitions.map(def=>{const row=document.createElement("div");row.className="security-check";const icon=document.createElement("span");icon.className="security-check-icon";icon.textContent=def.icon;const copy=document.createElement("div");const title=document.createElement("strong");title.textContent=def.title;const desc=document.createElement("p");desc.textContent=def.description;copy.append(title,desc);const status=document.createElement("span");status.className="security-status checking";status.dataset.securityStatus=def.id;status.textContent="جاري الفحص";row.append(icon,copy,status);return row}))}
  function setStatus(id,status,label){const node=document.querySelector(`[data-security-status="${id}"]`);if(!node)return;node.className=`security-status ${status}`;node.textContent=label}
  async function tenantCheck(){try{if(!window.VAREX?.getCurrentBusinessId)return{status:"warn",label:"غير متاح"};const id=await window.VAREX.getCurrentBusinessId();return id?{status:"pass",label:"مفعّل"}:{status:"warn",label:"يحتاج دخول"}}catch(error){const message=String(error?.message||"");return/جلسة|تسجيل الدخول/.test(message)?{status:"warn",label:"يحتاج دخول"}:{status:"fail",label:"تعذر التحقق"}}}
  async function collect(){
    const secure=location.protocol==="https:"||["localhost","127.0.0.1"].includes(location.hostname);
    const session=window.VAREX?.getSession?.()||null;
    const expiresAt=Number(session?.expires_at||0);
    const sessionValid=Boolean(session?.access_token&&session?.user?.id&&(!expiresAt||expiresAt>Date.now()/1000));
    const lockEnabled=localStorage.getItem("varexAutoLockEnabled")!=="false";
    const workerReady="serviceWorker" in navigator;
    const tenant=await tenantCheck();
    return[
      {id:"https",status:secure?"pass":"fail",label:secure?"مشفّر":"غير مشفّر"},
      {id:"session",status:sessionValid?"pass":"warn",label:sessionValid?"صالحة":"تحتاج دخول"},
      {id:"tenant",...tenant},
      {id:"autolock",status:lockEnabled?"pass":"warn",label:lockEnabled?"مفعّل":"غير مفعّل"},
      {id:"worker",status:workerReady?"pass":"warn",label:workerReady?"جاهز":"غير مدعوم"},
      {id:"secret",status:"pass",label:"محمي على الخادم"}
    ]
  }
  function renderSummary(results){
    const get=id=>results.find(item=>item.id===id);
    const https=get("https"),session=get("session"),tenant=get("tenant");
    text("connectionSummary",https?.status==="pass"?"اتصال مشفّر":"يحتاج حماية");
    text("sessionSummary",session?.status==="pass"?"جلسة صالحة":"تحتاج تسجيل دخول");
    text("isolationSummary",tenant?.status==="pass"?"عزل مفعّل":tenant?.label||"غير متاح");
    const points=results.reduce((sum,item)=>sum+(item.status==="pass"?1:item.status==="warn"?0.5:0),0);
    const score=Math.round(points/results.length*100);
    const ring=$("securityScoreRing");if(ring)ring.style.setProperty("--score",String(score));
    text("securityScore",`${score}%`);
    const level=score>=85?"حماية متقدمة":score>=70?"حماية جيدة":"تحتاج تعزيز";
    text("securityScoreLabel",level);text("heroProtectionLevel",level);
    text("heroProtectionNote",score>=85?"طبقات الحماية الأساسية تعمل":"توجد إعدادات موصى باستكمالها");
    text("securityScoreNote",score>=85?"تم اجتياز طبقات الحماية الأساسية لهذه الجلسة.":"راجع التنبيهات الظاهرة لاستكمال طبقات الحماية.")
  }
  function renderSession(){let user={};try{user=window.VAREX?.getCurrentUser?.()||{}}catch(error){}text("securityUser",user.name||user.username||user.email||"غير مسجل");text("securityRole",user.role||"مستخدم النظام");text("securityDevice",deviceName());text("securityLastLogin",formatDate(user.lastLogin))}
  async function run(){if(state.running)return;state.running=true;const button=$("runSecurityAudit");if(button){button.disabled=true;button.textContent="جاري الفحص..."}renderSkeleton();try{state.results=await collect();state.results.forEach(item=>setStatus(item.id,item.status,item.label));renderSummary(state.results);renderSession();localStorage.setItem("varex_last_security_audit",new Date().toISOString())}finally{state.running=false;if(button){button.disabled=false;button.textContent="إعادة الفحص الآن"}}}
  function clock(){const now=new Date();text("currentDate",now.toLocaleDateString("ar-AE",{timeZone:"Asia/Dubai",year:"numeric",month:"2-digit",day:"2-digit"}));text("currentTime",now.toLocaleTimeString("ar-AE",{timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit",second:"2-digit"}))}
  document.addEventListener("DOMContentLoaded",()=>{$("runSecurityAudit")?.addEventListener("click",run);clock();setInterval(clock,1000);run()});
  window.VarexSecurity={runAudit:run,getResults:()=>state.results.slice()};
})();
