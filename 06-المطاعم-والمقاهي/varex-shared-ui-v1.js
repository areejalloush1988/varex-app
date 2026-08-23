(function(){
  "use strict";

  const SUBSCRIPTION_KEY="varex_subscription";
  const SELECTED_PLAN_KEY="varex_selected_plan";
  const SCALE_STEPS=[50,60,70,80,90,100];
  const esc=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  function installStyles(){
    if(document.getElementById("varexSharedUiStyles"))return;
    const style=document.createElement("style");
    style.id="varexSharedUiStyles";
    style.textContent=`
      html,body{max-width:100%;overflow-x:hidden!important;overscroll-behavior-x:none}
      *,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}
      .vx-scale-wrap{position:relative;display:inline-flex;z-index:80}
      .vx-scale-trigger{gap:5px!important;min-width:68px!important;padding-inline:10px!important;white-space:nowrap}
      .vx-scale-trigger svg{width:20px!important;height:20px!important}
      .vx-scale-trigger strong{font-size:12px;direction:ltr}
      .vx-scale-menu{position:absolute;top:calc(100% + 10px);inset-inline-end:0;width:274px;padding:14px;background:#fff;color:#17231d;border:1px solid rgba(26,70,50,.16);border-radius:16px;box-shadow:0 18px 48px rgba(12,35,25,.2);display:none;z-index:9999;direction:rtl}
      .vx-scale-wrap.open .vx-scale-menu{display:block}
      .vx-scale-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .vx-scale-head strong{font-size:14px}.vx-scale-head span{font-size:12px;color:#6b7670}
      .vx-scale-row{display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center}
      .vx-scale-adjust,.vx-scale-preset{border:1px solid rgba(24,74,51,.18);background:#f6faf8;color:#173e2d;border-radius:10px;min-height:40px;font:inherit;font-weight:800;cursor:pointer}
      .vx-scale-adjust:disabled{opacity:.35;cursor:not-allowed}.vx-scale-value{text-align:center;font-weight:900;font-size:20px;direction:ltr}
      .vx-scale-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
      .vx-scale-preset{min-height:34px;font-size:12px}.vx-scale-preset.active{background:var(--vx-accent,#166b45);border-color:var(--vx-accent,#166b45);color:#fff}
      .vx-subscription{--vx-accent:#166b45;display:grid;gap:20px;color:inherit}
      .vx-sub-hero{position:relative;overflow:hidden;padding:30px;border-radius:24px;background:linear-gradient(135deg,var(--vx-accent),color-mix(in srgb,var(--vx-accent) 72%,#101914));color:#fff;box-shadow:0 18px 42px color-mix(in srgb,var(--vx-accent) 24%,transparent)}
      .vx-sub-hero::after{content:"";position:absolute;width:240px;height:240px;border:42px solid rgba(255,255,255,.075);border-radius:50%;inset-inline-end:-90px;top:-100px}
      .vx-sub-eyebrow{display:inline-flex;padding:7px 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.06em}
      .vx-sub-hero h1{margin:15px 0 8px;font-size:clamp(27px,3vw,42px);line-height:1.25}.vx-sub-hero p{max-width:760px;margin:0;opacity:.88;line-height:1.8}
      .vx-sub-status{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:18px}
      .vx-sub-card,.vx-sub-plan{background:var(--panel,#fff);color:var(--text,#183126);border:1px solid rgba(24,74,51,.12);border-radius:20px;box-shadow:0 10px 30px rgba(18,49,35,.07)}
      .vx-sub-card{padding:22px}.vx-sub-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.vx-sub-card h2,.vx-sub-card h3{margin:0 0 6px}.vx-sub-card p{margin:0;color:#69756f;line-height:1.65}
      .vx-sub-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:color-mix(in srgb,var(--vx-accent) 12%,#fff);color:var(--vx-accent);font-size:12px;font-weight:900;white-space:nowrap}.vx-sub-badge i{width:8px;height:8px;border-radius:50%;background:currentColor}
      .vx-sub-status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.vx-sub-status-grid span{padding:13px;border-radius:13px;background:color-mix(in srgb,var(--vx-accent) 6%,#fff);font-size:12px;color:#6c7771}.vx-sub-status-grid strong{display:block;margin-top:5px;color:#173e2d;font-size:14px}
      .vx-license{display:flex;align-items:center;gap:8px;margin-top:15px;padding:11px 12px;border-radius:12px;background:#f4f7f5;direction:ltr}.vx-license code{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis}.vx-license button{border:0;background:var(--vx-accent);color:#fff;padding:8px 12px;border-radius:9px;cursor:pointer}
      .vx-sub-summary{display:grid;place-items:center;text-align:center;min-height:190px}.vx-sub-summary strong{display:block;color:var(--vx-accent);font-size:34px;margin:8px 0}.vx-sub-summary small{color:#69756f}
      .vx-sub-section-head h2{margin:0 0 6px}.vx-sub-section-head p{margin:0;color:#69756f}.vx-sub-plans{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .vx-sub-plan{padding:20px;display:flex;flex-direction:column;min-height:345px}.vx-sub-plan.featured{border:2px solid var(--vx-accent);transform:translateY(-4px)}.vx-sub-plan-tag{align-self:flex-start;padding:5px 9px;border-radius:999px;background:var(--vx-accent);color:#fff;font-size:11px;font-weight:900}.vx-sub-plan h3{font-size:19px;margin:16px 0 4px}.vx-sub-price{display:flex;align-items:flex-end;gap:5px;margin:10px 0 15px}.vx-sub-price strong{font-size:32px;line-height:1;color:var(--vx-accent)}.vx-sub-price span{font-size:12px;color:#758079}
      .vx-sub-plan ul{list-style:none;padding:0;margin:0 0 18px;display:grid;gap:10px;flex:1}.vx-sub-plan li{font-size:13px;line-height:1.45}.vx-sub-plan li::before{content:"✓";color:var(--vx-accent);font-weight:900;margin-inline-end:8px}
      .vx-sub-action{width:100%;border:0;border-radius:12px;min-height:44px;padding:10px 14px;background:var(--vx-accent);color:#fff;font:inherit;font-weight:900;cursor:pointer}.vx-sub-action.secondary{background:color-mix(in srgb,var(--vx-accent) 11%,#fff);color:var(--vx-accent)}.vx-sub-action:disabled{opacity:.55;cursor:not-allowed}
      .vx-shared-confirm{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:20px;background:rgba(6,19,13,.5);backdrop-filter:blur(5px)}
      .vx-shared-confirm-card{width:min(440px,100%);padding:24px;border-radius:20px;background:#fff;color:#193629;box-shadow:0 24px 70px rgba(0,0,0,.25);text-align:center}.vx-shared-confirm-card h3{margin:0 0 10px}.vx-shared-confirm-card p{margin:0;color:#68756f;line-height:1.7}.vx-shared-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.vx-shared-confirm-actions button{border:0;border-radius:11px;min-height:44px;font:inherit;font-weight:900;cursor:pointer}.vx-shared-confirm-actions [data-vx-confirm-accept]{background:var(--vx-accent);color:#fff}.vx-shared-confirm-actions [data-vx-confirm-cancel]{background:#eef3f0;color:#294337}
      .vx-shared-toast{position:fixed;z-index:21000;inset-inline-start:50%;bottom:26px;transform:translateX(-50%);padding:12px 18px;border-radius:12px;background:#132b20;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.2);font-weight:800}
      .vx-sub-nav-icon{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      @media(max-width:1100px){.vx-sub-plans{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){.vx-scale-menu{position:fixed;top:76px;inset-inline:12px;width:auto}.vx-sub-status{grid-template-columns:1fr}.vx-sub-plans{grid-template-columns:1fr}.vx-sub-plan.featured{transform:none}.vx-sub-status-grid{grid-template-columns:1fr}.vx-sub-hero{padding:22px}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function scaleControl(options={}){
    installStyles();
    const t=options.t||((ar)=>ar),buttonClass=options.buttonClass||"",icon=options.icon||"▣";
    return `<div class="vx-scale-wrap" id="vxScaleWrap" style="--vx-accent:${esc(options.accent||"#166b45")}"><button class="${esc(buttonClass)} vx-scale-trigger" id="vxScaleTrigger" type="button" aria-expanded="false" title="${esc(t("حجم الشاشة","Screen size"))}">${icon}<strong id="vxScaleLabel">100%</strong></button><div class="vx-scale-menu" id="vxScaleMenu"><div class="vx-scale-head"><strong>${esc(t("حجم الشاشة","Screen size"))}</strong><span>${esc(t("مناسب للتابلت","Tablet fit"))}</span></div><div class="vx-scale-row"><button class="vx-scale-adjust" type="button" id="vxScaleMinus" aria-label="${esc(t("تصغير","Zoom out"))}">−</button><div class="vx-scale-value" id="vxScaleValue">100%</div><button class="vx-scale-adjust" type="button" id="vxScalePlus" aria-label="${esc(t("تكبير","Zoom in"))}">+</button></div><div class="vx-scale-presets">${SCALE_STEPS.map(value=>`<button class="vx-scale-preset" type="button" data-vx-scale="${value}">${value}%</button>`).join("")}</div></div></div>`;
  }

  function bindScale(options={}){
    installStyles();
    const wrap=document.getElementById("vxScaleWrap"),trigger=document.getElementById("vxScaleTrigger"),target=document.getElementById(options.targetId);
    if(!wrap||!trigger||!target)return;
    const key=options.storageKey||"varex_screen_scale";
    let scale=Number(localStorage.getItem(key));
    if(!SCALE_STEPS.includes(scale))scale=100;
    const apply=value=>{
      scale=SCALE_STEPS.reduce((best,current)=>Math.abs(current-value)<Math.abs(best-value)?current:best,SCALE_STEPS[0]);
      const ratio=scale/100;
      target.style.zoom=String(ratio);
      target.style.width=(100/ratio)+"%";
      target.style.minHeight=(100/ratio)+"vh";
      document.documentElement.style.overflowX="hidden";document.body.style.overflowX="hidden";
      localStorage.setItem(key,String(scale));
      [document.getElementById("vxScaleLabel"),document.getElementById("vxScaleValue")].forEach(node=>{if(node)node.textContent=scale+"%"});
      document.querySelectorAll("[data-vx-scale]").forEach(button=>button.classList.toggle("active",Number(button.dataset.vxScale)===scale));
      const minus=document.getElementById("vxScaleMinus"),plus=document.getElementById("vxScalePlus");if(minus)minus.disabled=scale===SCALE_STEPS[0];if(plus)plus.disabled=scale===SCALE_STEPS[SCALE_STEPS.length-1];
    };
    trigger.addEventListener("click",event=>{event.stopPropagation();wrap.classList.toggle("open");trigger.setAttribute("aria-expanded",String(wrap.classList.contains("open")))});
    document.getElementById("vxScaleMenu")?.addEventListener("click",event=>event.stopPropagation());
    document.querySelectorAll("[data-vx-scale]").forEach(button=>button.addEventListener("click",()=>apply(Number(button.dataset.vxScale))));
    document.getElementById("vxScaleMinus")?.addEventListener("click",()=>apply(SCALE_STEPS[Math.max(0,SCALE_STEPS.indexOf(scale)-1)]));
    document.getElementById("vxScalePlus")?.addEventListener("click",()=>apply(SCALE_STEPS[Math.min(SCALE_STEPS.length-1,SCALE_STEPS.indexOf(scale)+1)]));
    document.addEventListener("click",()=>{wrap.classList.remove("open");trigger.setAttribute("aria-expanded","false")});
    apply(scale);
  }

  function parseStorage(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch(error){return null}}
  function dateText(value,language){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleDateString(language==="en"?"en-GB":"ar-AE",{day:"2-digit",month:"short",year:"numeric"})}
  function subscriptionState(){
    const subscription=parseStorage(SUBSCRIPTION_KEY),selected=parseStorage(SELECTED_PLAN_KEY);
    if(subscription?.status==="active"&&subscription.expiresAt&&!subscription.lifetime&&new Date(subscription.expiresAt).getTime()<Date.now())subscription.status="expired";
    return {subscription,selected};
  }

  function renderSubscription(options={}){
    installStyles();
    const t=options.t||((ar)=>ar),language=t("ar","en"),accent=options.accent||"#166b45",systemName=options.systemName||"VAREX",{subscription,selected}=subscriptionState();
    const active=subscription?.status==="active",trial=active&&subscription?.trial,status=active?t(trial?"تجربة مجانية فعّالة":"الترخيص فعّال",trial?"Free trial active":"License active"):subscription?.status==="expired"?t("انتهى الاشتراك","Subscription expired"):t("لا يوجد اشتراك فعّال","No active subscription");
    const planName=active?(subscription.planName||t("خطة VAREX","VAREX Plan")):(selected?.planName||t("لم يتم اختيار خطة","No plan selected"));
    const expiry=subscription?.lifetime?t("مدى الحياة","Lifetime"):dateText(subscription?.expiresAt,language);
    const days=active&&subscription?.expiresAt?Math.max(0,Math.ceil((new Date(subscription.expiresAt).getTime()-Date.now())/86400000)):0;
    const plans=[
      {id:"trial",name:t("تجربة مجانية","Free Trial"),price:"0",cycle:t("7 أيام","7 days"),features:[t("جميع الأقسام الأساسية","All essential modules"),t("بدون بطاقة دفع","No payment card"),t("تجربة مرة واحدة","One-time trial")]},
      {id:"monthly",name:t("الخطة الشهرية","Monthly Plan"),price:"179",cycle:t("شهرياً","per month"),featured:true,features:[t("تشغيل كل تطبيقات VAREX","Use all VAREX apps"),t("حفظ البيانات والترخيص","Data and license access"),t("تحديثات مستمرة","Continuous updates")]},
      {id:"annual",name:t("الخطة السنوية","Annual Plan"),price:"1,799",cycle:t("سنوياً","per year"),features:[t("أفضل قيمة للشركات","Best value for businesses"),t("كل مزايا الخطة الشهرية","Everything in Monthly"),t("توفير شهرين","Save two months")]},
      {id:"lifetime",name:t("ترخيص مدى الحياة","Lifetime License"),price:"5,999",cycle:t("دفعة واحدة","one-time"),features:[t("ترخيص دائم","Permanent license"),t("بدون تجديد سنوي","No annual renewal"),t("كل أنظمة VAREX","All VAREX systems")]}
    ];
    return `<div class="vx-subscription" style="--vx-accent:${esc(accent)}"><section class="vx-sub-hero"><span class="vx-sub-eyebrow">VAREX · LICENSE CENTER</span><h1>${esc(t("الاشتراك والترخيص","Subscription & Licensing"))}</h1><p>${esc(t("إدارة خطة VAREX والترخيص من داخل هذا التطبيق بنفس نظام الاشتراك الموجود في الكاشير.","Manage your VAREX plan and license from this app with the same subscription system used in POS."))}</p></section><section class="vx-sub-status"><article class="vx-sub-card"><div class="vx-sub-card-head"><div><h2>${esc(t("حالة الترخيص","License Status"))}</h2><p>${esc(systemName)}</p></div><span class="vx-sub-badge"><i></i>${esc(status)}</span></div><div class="vx-sub-status-grid"><span>${esc(t("الخطة الحالية","Current plan"))}<strong>${esc(planName)}</strong></span><span>${esc(t("تاريخ الانتهاء","Expiry date"))}<strong>${esc(expiry)}</strong></span><span>${esc(t("الأيام المتبقية","Days remaining"))}<strong>${active&&subscription?.lifetime?"∞":days}</strong></span></div>${subscription?.licenseKey?`<div class="vx-license"><code>${esc(subscription.licenseKey)}</code><button type="button" data-vx-copy-license>${esc(t("نسخ","Copy"))}</button></div>`:""}</article><article class="vx-sub-card vx-sub-summary"><div><span>${esc(t("نظام ترخيص موحّد","Unified licensing"))}</span><strong>VAREX</strong><small>${esc(t("نفس الخطط في جميع التطبيقات","The same plans in every app"))}</small></div></article></section><div class="vx-sub-section-head"><h2>${esc(t("اختر الخطة المناسبة","Choose your plan"))}</h2><p>${esc(t("يمكن بدء التجربة المجانية فوراً أو اختيار خطة مدفوعة للمتابعة.","Start the free trial now or select a paid plan to continue."))}</p></div><section class="vx-sub-plans">${plans.map(plan=>`<article class="vx-sub-plan ${plan.featured?"featured":""}">${plan.featured?`<span class="vx-sub-plan-tag">${esc(t("الأكثر اختياراً","Most Popular"))}</span>`:""}<h3>${esc(plan.name)}</h3><div class="vx-sub-price"><strong>${esc(plan.price)}</strong><span>${esc(t("د.إ","AED"))} · ${esc(plan.cycle)}</span></div><ul>${plan.features.map(feature=>`<li>${esc(feature)}</li>`).join("")}</ul><button class="vx-sub-action ${plan.id==="trial"?"secondary":""}" type="button" data-vx-plan="${plan.id}" ${plan.id==="trial"&&active?"disabled":""}>${esc(plan.id==="trial"?(active?t("مفعّلة حالياً","Currently active"):t("ابدأ التجربة المجانية","Start Free Trial")):t("اختيار الخطة","Select Plan"))}</button></article>`).join("")}</section></div>`;
  }

  function bindSubscription(options={}){
    const t=options.t||((ar)=>ar),toast=options.toast||(()=>{}),rerender=options.rerender||(()=>{}),openConfirm=options.openConfirm||((title,message,accept)=>accept());
    document.querySelector("[data-vx-copy-license]")?.addEventListener("click",async()=>{const key=subscriptionState().subscription?.licenseKey;if(!key)return;try{await navigator.clipboard.writeText(key);toast(t("تم نسخ مفتاح الترخيص","License key copied"))}catch(error){toast(key)}});
    document.querySelectorAll("[data-vx-plan]").forEach(button=>button.addEventListener("click",()=>{
      const id=button.dataset.vxPlan;
      if(id==="trial"){
        const user=localStorage.getItem("varex_user_email")||localStorage.getItem("varex_business_email")||"local",trialKey="varex_trial_used_"+user.toLowerCase().replace(/[^a-z0-9_-]/g,"_");
        if(localStorage.getItem(trialKey)==="1"){toast(t("تم استخدام التجربة المجانية سابقاً","Free trial was already used"));return}
        openConfirm(t("تفعيل التجربة المجانية؟","Activate free trial?"),t("سيتم تفعيل جميع تطبيقات VAREX لمدة 7 أيام.","All VAREX apps will be activated for 7 days."),()=>{const startedAt=new Date(),expiresAt=new Date(startedAt.getTime()+7*86400000);localStorage.setItem(SUBSCRIPTION_KEY,JSON.stringify({plan:"business",planName:"تجربة VAREX المجانية",billingType:"trial",price:0,currency:"AED",status:"active",paymentStatus:"trial",startedAt:startedAt.toISOString(),expiresAt:expiresAt.toISOString(),lifetime:false,licenseKey:"",trial:true,updatedAt:startedAt.toISOString()}));localStorage.setItem(trialKey,"1");localStorage.removeItem(SELECTED_PLAN_KEY);rerender();toast(t("تم تفعيل التجربة لمدة 7 أيام","7-day trial activated"))});
        return;
      }
      const plan={monthly:["monthly","الخطة الشهرية",179,"month"],annual:["annual","الخطة السنوية",1799,"year"],lifetime:["lifetime","ترخيص مدى الحياة",5999,"lifetime"]}[id];if(!plan)return;
      localStorage.setItem(SELECTED_PLAN_KEY,JSON.stringify({plan:plan[0],planName:plan[1],price:plan[2],currency:"AED",billingType:plan[3],selectedAt:new Date().toISOString()}));rerender();toast(t("تم حفظ الخطة المختارة للمتابعة","Selected plan saved"));
    }));
  }

  function appConfig(){
    const body=document.body;
    if(body.hasAttribute("data-re-page"))return {page:body.dataset.rePage,root:"reApp",shell:".re-app",content:"#reContent",top:".re-top-actions",button:"re-icon-btn",haptic:"#reHaptic",nav:".re-nav",settings:'a[data-route-page="settings"]',title:".re-page-title h2",pageIcon:".re-page-icon",accent:"#166B45",key:"varex_re_screen_scale",name:"VAREX REAL ESTATE"};
    if(body.hasAttribute("data-mobility-page")){const taxi=body.dataset.mobilitySystem==="taxi";return {page:body.dataset.mobilityPage,root:"slApp",shell:".sl-app",content:"#slContent",top:".sl-top-actions",button:"sl-icon-btn",haptic:"#slHaptic",nav:".sl-nav",settings:'a[data-route-page="settings"]',title:".sl-page-title h2",pageIcon:".sl-page-icon",accent:taxi?"#D9A400":"#7048A8",key:taxi?"varex_taxi_screen_scale":"varex_car_screen_scale",name:taxi?"VAREX TAXI":"VAREX CAR RENTAL"};}
    if(body.hasAttribute("data-dining-page")){const restaurant=body.dataset.diningType==="restaurant";return {page:body.dataset.diningPage,root:"slApp",shell:".sl-app",content:"#slContent",top:".sl-top-actions",button:"sl-icon-btn",haptic:"#slHaptic",nav:".sl-nav",settings:'a[data-route-page="settings"]',title:".sl-page-title h2",pageIcon:".sl-page-icon",accent:restaurant?"#B6533E":"#8A5A44",key:restaurant?"varex_restaurant_screen_scale":"varex_cafe_screen_scale",name:restaurant?"VAREX RESTAURANT":"VAREX CAFÉ"};}
    if(body.hasAttribute("data-salon-page")){const women=body.dataset.salonType==="women";return {page:body.dataset.salonPage,root:"slApp",shell:".sl-app",content:"#slContent",top:".sl-top-actions",button:"sl-icon-btn",haptic:"#slHaptic",nav:".sl-nav",settings:'a[data-route-page="settings"]',title:".sl-page-title h2",pageIcon:".sl-page-icon",accent:women?"#C9577A":"#2F80B9",key:women?"varex_women_salon_screen_scale":"varex_men_salon_screen_scale",name:women?"VAREX WOMEN SALON":"VAREX MEN SALON"};}
    return null;
  }

  const screenIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
  const licenseIcon='<svg class="vx-sub-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 5-7 13L5 8zM5 8h14M9 8l3 13 3-13"/></svg>';
  function sharedToast(message){document.getElementById("vxSharedToast")?.remove();const node=document.createElement("div");node.id="vxSharedToast";node.className="vx-shared-toast";node.textContent=message;document.body.appendChild(node);setTimeout(()=>node.remove(),2600)}
  function sharedConfirm(title,message,onAccept,accent,t){document.getElementById("vxSharedConfirm")?.remove();const modal=document.createElement("div");modal.id="vxSharedConfirm";modal.className="vx-shared-confirm";modal.style.setProperty("--vx-accent",accent);modal.innerHTML=`<section class="vx-shared-confirm-card" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(message)}</p><div class="vx-shared-confirm-actions"><button type="button" data-vx-confirm-cancel>${esc(t("إلغاء","Cancel"))}</button><button type="button" data-vx-confirm-accept>${esc(t("تأكيد","Confirm"))}</button></div></section>`;document.body.appendChild(modal);modal.querySelector("[data-vx-confirm-cancel]").addEventListener("click",()=>modal.remove());modal.querySelector("[data-vx-confirm-accept]").addEventListener("click",()=>{modal.remove();onAccept()})}
  function renderSharedSubscription(config,t){const content=document.querySelector(config.content);if(!content)return;content.dataset.vxSubscription="1";content.innerHTML=renderSubscription({accent:config.accent,systemName:config.name,t});bindSubscription({t,toast:sharedToast,openConfirm:(title,message,accept)=>sharedConfirm(title,message,accept,config.accent,t),rerender:()=>renderSharedSubscription(config,t)});const title=document.querySelector(config.title),pageIcon=document.querySelector(config.pageIcon);if(title)title.textContent=t("الاشتراك والترخيص","Subscription & Licensing");if(pageIcon)pageIcon.innerHTML=licenseIcon;document.title=config.name+" | "+t("الاشتراك والترخيص","Subscription & Licensing")}
  function boot(){
    const config=appConfig();if(!config)return;installStyles();
    const language=(localStorage.getItem("varex_language")||localStorage.getItem("varex_launcher_language"))==="en"?"en":"ar",t=(ar,en)=>language==="en"?en:ar;
    const shell=document.querySelector(config.shell),top=document.querySelector(config.top),nav=document.querySelector(config.nav);if(!shell||!top||!nav)return;
    if(!shell.dataset.vxScaleReady){shell.dataset.vxScaleReady="1";const haptic=document.querySelector(config.haptic);(haptic||top.firstElementChild)?.insertAdjacentHTML(haptic?"beforebegin":"beforebegin",scaleControl({t,buttonClass:config.button,icon:screenIcon,accent:config.accent}));bindScale({targetId:shell.id||(shell.id="vxAppShell"),storageKey:config.key})}
    if(!nav.querySelector("[data-vx-subscription-link]")){const link=document.createElement("a");link.href="./subscription.html";link.dataset.vxSubscriptionLink="1";if(config.page==="subscription")link.classList.add("active");link.innerHTML=licenseIcon+`<span>${esc(t("الاشتراك والترخيص","Subscription & Licensing"))}</span>`;const settings=nav.querySelector(config.settings),actions=nav.querySelector(".re-nav-actions,.sl-nav-actions");nav.insertBefore(link,settings||actions||null)}
    if(config.page==="subscription"&&!document.querySelector(config.content)?.dataset.vxSubscription)renderSharedSubscription(config,t);
  }
  let bootQueued=false;const requestBoot=()=>{if(bootQueued)return;bootQueued=true;requestAnimationFrame(()=>{bootQueued=false;boot()})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  new MutationObserver(requestBoot).observe(document.documentElement,{childList:true,subtree:true});

  window.VAREX_UI={scaleControl,bindScale,renderSubscription,bindSubscription,boot};
}());
