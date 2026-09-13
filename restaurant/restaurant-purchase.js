(function(){
  "use strict";

  const $=selector=>document.querySelector(selector);
  const query=new URLSearchParams(location.search);
  const language=query.get("lang")==="en"?"en":"ar";
  const rtl=language==="ar";
  const copy={
    ar:{
      pageTitle:"شراء نظام VAREX للمطاعم",preview:"معاينة النظام",eyebrow:"نظام إدارة المطاعم المتكامل",
      hero:"شغّل مطعمك بالكامل من نظام واحد واضح.",
      lead:"أدر الكاشير والطلبات والطاولات والحجوزات والمنيو والمطبخ والمخزون والموردين والعملاء والورديات والتقارير من مساحة عمل احترافية واحدة.",
      proofs:[["حساب آمن","استخدم VAREX على أجهزتك من خلال حساب موثّق."],["دفعة واحدة","لا يوجد اشتراك شهري أو سنوي متكرر."],["وصول كامل","ترخيص مدى الحياة مرتبط بحساب مطعمك."]],
      steps:[["أنشئ حسابك","اختر بريدك وكلمة المرور ثم أكّد بريدك الإلكتروني."],["سجّل الدخول إلى VAREX","بعد الدخول سيظهر لك عرض التفعيل مباشرة."],["فعّل الوصول الكامل","ادفع مرة واحدة وافتح جميع صفحات النظام."]],
      lifetime:"وصول مدى الحياة",accessDesc:"وصول كامل لحساب مطعم واحد.",was:"بدلاً من",oneTime:"دفعة واحدة",discount:"خصم 50%",
      benefits:["نظام إدارة مطاعم متكامل","وصول مرتبط بالحساب وتسجيل دخول آمن","قابل للتثبيت على الكمبيوتر والهاتف","من دون رسوم اشتراك متكررة"],
      status:"حالة التفعيل",checking:"جارٍ التحقق من حسابك…",create:"إنشاء حساب جديد",signIn:"لدي حساب VAREX بالفعل",
      pay:"ادفع 399$ بأمان عبر",purchased:"اشتريت مسبقاً؟ سجّل الدخول",different:"استخدام حساب آخر",
      open:"فتح نظام VAREX",dashboard:"الدخول إلى لوحة التحكم",secure:"يؤكد PayPal عملية الدفع بأمان، ولا يستلم VAREX كلمة مرور PayPal الخاصة بك.",
      terms:"الشروط",privacy:"الخصوصية",accountPrompt:"سجّل الدخول أو أنشئ حساباً",
      guestMessage:"أنشئ حسابك أو سجّل الدخول أولاً، وبعدها يظهر عرض الإطلاق لتفعيل النظام الكامل بسعر 399$ بدلاً من 799$.",
      paymentReady:"حسابك جاهز. ادفع 399$ بأمان عبر PayPal لفتح النظام كاملاً.",
      paymentUnavailable:"الدفع عبر PayPal غير متاح مؤقتاً. يرجى المحاولة بعد قليل.",
      confirming:"جارٍ تأكيد دفعة 399$ عبر PayPal…",linking:"تم تأكيد الدفع. جارٍ ربط الوصول الدائم بحسابك.",
      active:"تم تأكيد الدفع وتفعيل وصولك مدى الحياة.",legacy:"هذا الحساب موجود مسبقاً وله وصول كامل إلى النظام.",
      preparing:"جارٍ تجهيز الدفع الآمن عبر PayPal…",connecting:"جارٍ الاتصال بـ PayPal بأمان…",
      cancelled:"تم إلغاء الدفع، ولم يتم خصم أي مبلغ.",verify:"يرجى الانتظار بينما يتحقق VAREX من عملية الدفع.",
      failure:"تعذّر تأكيد عملية الشراء"
    },
    en:{
      pageTitle:"Buy VAREX Restaurant",preview:"Preview the system",eyebrow:"RESTAURANT MANAGEMENT SYSTEM",
      hero:"Run your entire restaurant from one clear system.",
      lead:"Manage POS, orders, tables, reservations, menu, kitchen, inventory, suppliers, customers, shifts and reports from one professional workspace.",
      proofs:[["Secure account","Use VAREX across your devices with a verified account."],["One-time payment","No recurring monthly or annual subscription."],["Full access","Lifetime access linked to your restaurant account."]],
      steps:[["Create your account","Choose your email and password, then verify your email."],["Sign in to VAREX","Your activation offer appears immediately after sign-in."],["Activate full access","Pay once and unlock every system page."]],
      lifetime:"LIFETIME ACCESS",accessDesc:"Full access for one restaurant account.",was:"Was",oneTime:"one time",discount:"50% OFF",
      benefits:["Complete restaurant management system","Account-linked access and secure sign-in","Installable on supported computers and phones","No recurring subscription fee"],
      status:"ACTIVATION STATUS",checking:"Checking your account…",create:"Create a new account",signIn:"I already have a VAREX account",
      pay:"Pay $399 securely with",purchased:"Already purchased? Sign in",different:"Use a different account",
      open:"Open VAREX",dashboard:"Enter the dashboard",secure:"PayPal confirms the completed payment securely. VAREX never receives your PayPal password.",
      terms:"Terms",privacy:"Privacy",accountPrompt:"Sign in or create your account",
      guestMessage:"Create your account or sign in first. The launch offer then unlocks the complete system for $399 instead of $799.",
      paymentReady:"Your account is ready. Pay $399 securely with PayPal to unlock the complete system.",
      paymentUnavailable:"PayPal checkout is temporarily unavailable. Please try again shortly.",
      confirming:"Confirming your $399 payment with PayPal…",linking:"Payment confirmed. VAREX is linking lifetime access to your account.",
      active:"Payment confirmed. Your lifetime access is active.",legacy:"This existing account already has full system access.",
      preparing:"Preparing secure PayPal checkout…",connecting:"Connecting to PayPal securely…",
      cancelled:"Payment was cancelled. No charge was completed.",verify:"Please wait while VAREX verifies the completed payment.",
      failure:"We could not confirm this purchase"
    }
  }[language];

  const prefix=location.pathname==="/restaurant"||location.pathname.startsWith("/restaurant/")?"/restaurant":"";
  const apiPath=`${prefix}/api/restaurant-purchase?lang=${language}`;
  const purchasePath=`${prefix}/purchase.html?lang=${language}`;
  const openPath=prefix?`${prefix}/open-v7.html?lang=${language}`:`./open-v7.html?lang=${language}`;
  let lastStatus=null;

  function setText(selector,value){const node=$(selector);if(node)node.textContent=value}
  function applyLanguage(){
    document.documentElement.lang=language;
    document.documentElement.dir=rtl?"rtl":"ltr";
    document.title=copy.pageTitle;
    setText(".preview-link",copy.preview);setText(".eyebrow",copy.eyebrow);setText("#purchaseTitle",copy.hero);setText(".product-copy .lead",copy.lead);
    const proof=document.querySelectorAll(".product-proof article");
    copy.proofs.forEach((values,index)=>{if(proof[index]){proof[index].querySelector("strong").textContent=values[0];proof[index].querySelector("span").textContent=values[1]}});
    const steps=document.querySelectorAll(".flow > div");
    copy.steps.forEach((values,index)=>{if(steps[index]){steps[index].querySelector("strong").textContent=values[0];steps[index].querySelector("small").textContent=values[1]}});
    setText(".license-pill",copy.lifetime);setText(".checkout-card > p",copy.accessDesc);setText(".discount-pill",copy.discount);
    const original=$(".original-price");if(original)original.childNodes[0].textContent=copy.was+" ";
    const priceSuffix=$(".price > span");if(priceSuffix)priceSuffix.innerHTML="USD<br>"+copy.oneTime;
    document.querySelectorAll(".checkout-card > ul li").forEach((node,index)=>node.textContent=copy.benefits[index]||"");
    setText(".account-state small",copy.status);setText("#accountLabel",copy.checking);setText("#createAccountLink",copy.create);setText("#signInLink",copy.signIn);
    setText("#payButton span",copy.pay);setText("#existingAccountLink",copy.purchased);setText("#signOutButton",copy.different);
    setText("#installLink",copy.open);setText("#openAppLink",copy.dashboard);
    const secure=$(".secure-note");if(secure)secure.childNodes[secure.childNodes.length-1].textContent=" "+copy.secure;
    const footer=document.querySelectorAll(".purchase-footer nav a");if(footer[0])footer[0].textContent=copy.terms;if(footer[1])footer[1].textContent=copy.privacy;
    const preview=$(".preview-link");if(preview)preview.href=`./open-v7.html?preview=1&lang=${language}`;
  }

  function authUrl(page){
    const url=new URL(`./${page}.html`,location.href);
    url.searchParams.set("lang",language);
    url.searchParams.set("return_to",purchasePath);
    return url.href;
  }
  function safePayPalUrl(value){try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="paypal.com"||url.hostname.endsWith(".paypal.com"))}catch{return false}}
  function showMessage(message,type="info"){
    const box=$("#checkoutMessage");
    box.hidden=!message;box.textContent=message||"";box.classList.toggle("is-error",type==="error");
  }
  function setAccount(label,state=""){
    setText("#accountLabel",label);
    $("#accountState").classList.toggle("is-ready",state==="ready");
    $("#accountState").classList.toggle("is-warning",state==="warning");
  }
  function showOnly(id){["guestActions","paymentActions","licensedActions"].forEach(name=>{$("#"+name).hidden=name!==id})}
  async function api(body){
    const response=await fetch(apiPath,{method:body?"POST":"GET",credentials:"include",headers:body?{"content-type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success===false)throw new Error(result.message||copy.paymentUnavailable);
    return result;
  }
  function render(status){
    lastStatus=status;
    $("#checkoutDynamic").setAttribute("aria-busy","false");
    if(status.product?.price)setText("#priceValue",String(status.product.price).replace(/\.00$/,""));
    const oldPrice=$(".original-price del");if(oldPrice&&status.product?.originalPrice)oldPrice.textContent="$"+String(status.product.originalPrice).replace(/\.00$/,"");
    if(status.allowed){
      const identity=[status.user?.name,status.user?.email].filter(Boolean).join(" — ");
      setAccount(identity||"VAREX","ready");
      $("#installLink").href=openPath;$("#openAppLink").href=openPath;showOnly("licensedActions");
      showMessage(status.access?.grandfathered?copy.legacy:copy.active);return;
    }
    if(!status.signedIn){
      setAccount(status.paidAwaitingAccount?copy.linking:copy.accountPrompt,status.paidAwaitingAccount?"warning":"");
      $("#createAccountLink").href=authUrl("register");$("#signInLink").href=authUrl("login");showOnly("guestActions");
      showMessage(status.paidAwaitingAccount?copy.linking:copy.guestMessage);return;
    }
    const identity=[status.user?.name,status.user?.email].filter(Boolean).join(" — ");
    setAccount(identity||copy.paymentReady,"ready");showOnly("paymentActions");
    $("#existingAccountLink").href=authUrl("login");$("#existingAccountLink").hidden=true;$("#signOutButton").hidden=false;
    $("#payButton").disabled=!status.paymentConfigured;
    showMessage(status.paymentConfigured?copy.paymentReady:copy.paymentUnavailable,status.paymentConfigured?"info":"error");
  }
  async function refresh({openAfterClaim=false}={}){
    let status=await api();
    if(status.signedIn&&status.paidAwaitingAccount&&!status.allowed){
      setAccount(copy.linking,"warning");showOnly("");showMessage(copy.linking);
      await api({action:"claim-order"});status=await api();render(status);
      if(status.allowed&&openAfterClaim)setTimeout(()=>location.replace(openPath),650);
      return status;
    }
    render(status);return status;
  }
  async function handleReturn(){
    const payment=query.get("payment"),orderId=query.get("token");
    if(payment==="cancelled"){
      await api({action:"cancel-order"}).catch(()=>{});
      history.replaceState(null,"",purchasePath);showMessage(copy.cancelled,"error");return refresh();
    }
    if(payment!=="success"&&!orderId)return refresh({openAfterClaim:true});
    if(!orderId)throw new Error(copy.failure);
    setAccount(copy.confirming,"warning");showOnly("");showMessage(copy.verify);
    await api({action:"capture-order",orderId});history.replaceState(null,"",purchasePath);return refresh();
  }

  applyLanguage();
  $("#payButton").addEventListener("click",async()=>{
    const button=$("#payButton");if(button.disabled)return;
    button.disabled=true;button.dataset.label=button.innerHTML;button.textContent=copy.preparing;showMessage(copy.connecting);
    try{
      const result=await api({action:"create-order"});
      if(result.alreadyActive||result.paymentComplete){await refresh({openAfterClaim:true});return}
      if(!safePayPalUrl(result.approvalUrl))throw new Error(copy.paymentUnavailable);
      location.assign(result.approvalUrl);
    }catch(error){
      showMessage(error.message||copy.paymentUnavailable,"error");button.disabled=false;
      if(button.dataset.label){button.innerHTML=button.dataset.label;delete button.dataset.label}
    }
  });
  $("#signOutButton").addEventListener("click",async()=>{
    $("#signOutButton").disabled=true;
    try{await fetch(`${prefix}/api/auth/sign-out`,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:"{}"})}catch{}
    location.assign(purchasePath);
  });
  handleReturn().catch(error=>{setAccount(copy.failure,"warning");showMessage(error.message||copy.paymentUnavailable,"error");refresh().catch(()=>{})});
})();
