(function(){
  "use strict";

  const appearanceKey="varex_cafe_appearance";
  const themeColors={orange:"#C75A1B",coffee:"#8A4B2A",olive:"#6F7A3D",teal:"#2F6F68",plum:"#76506F",navy:"#243B67",royal:"#2F5FA7",berry:"#9A3E68",maroon:"#7A2639",graphite:"#4B5057",emerald:"#2F7A56",forest:"#3F6842",mint:"#4F8D78",cyan:"#287C91",sky:"#4B86B4",indigo:"#4B4F9A",violet:"#6C4AA1",lavender:"#8A6CAD",magenta:"#A43D82",rose:"#B44F65",coral:"#C65F4A",brick:"#A44832",red:"#B43B32",gold:"#B88422",mustard:"#A87A18",sand:"#A66E45",caramel:"#B86B31",steel:"#567488",slate:"#5E6878",charcoal:"#343A40"};
  const root=document.documentElement;
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  function mix(hex,target,ratio){
    const source=String(hex).replace("#","");
    const base=[parseInt(source.slice(0,2),16),parseInt(source.slice(2,4),16),parseInt(source.slice(4,6),16)];
    const end=target==="white"?[255,255,255]:[0,0,0];
    return "#"+base.map((value,index)=>Math.round(value+(end[index]-value)*ratio).toString(16).padStart(2,"0")).join("");
  }
  function applyAppearance(name,color){
    const primary=color||themeColors[name]||themeColors.orange;
    const theme=themeColors[name]?name:"orange";
    [["--green",primary],["--green-mid",mix(primary,"white",.17)],["--green-dark",mix(primary,"black",.38)],["--green-deeper",mix(primary,"black",.58)],["--green-soft",mix(primary,"white",.88)]].forEach(([key,value])=>root.style.setProperty(key,value));
    root.dataset.authAppearance=theme;
    if(themeMeta)themeMeta.content=primary;
    const icon=`/icons/cafe/${theme}-192.png?v=${theme}`;
    document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(node=>node.setAttribute("href",icon));
    let manifest=document.querySelector('link[rel="manifest"]');
    if(!manifest){manifest=document.createElement("link");manifest.setAttribute("rel","manifest");document.head.appendChild(manifest)}
    manifest.setAttribute("href",`/api/cafe-manifest?theme=${encodeURIComponent(theme)}`);
  }
  const savedTheme=localStorage.getItem(appearanceKey)||"orange";
  applyAppearance(savedTheme,themeColors[savedTheme]);
  fetch("/api/cafe-settings",{cache:"no-store"}).then(response=>response.ok?response.json():null).then(settings=>{
    const name=themeColors[settings?.theme]?settings.theme:"orange";
    localStorage.setItem(appearanceKey,name);
    applyAppearance(name,themeColors[name]);
  }).catch(()=>{});

  const page=document.body.dataset.authPage||"";
  const $=selector=>document.querySelector(selector);
  const $$=selector=>Array.from(document.querySelectorAll(selector));
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const eyeOpen='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  const eyeClosed='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2c.5-.1.9-.2 1.4-.2 6 0 9.5 6 9.5 6a17 17 0 0 1-2.4 3.2M6.2 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const icons={
    mail:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    lock:'<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    cafe:'<svg viewBox="0 0 24 24"><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M8 3v2M12 3v2"/></svg>'
  };

  function message(type,text){
    const box=$("#authMessage");
    if(!box)return;
    box.className="auth-message show "+type;
    box.textContent=text;
  }

  function clearMessage(){
    const box=$("#authMessage");
    if(box)box.className="auth-message";
  }

  function busy(button,on,label){
    if(!button)return;
    button.disabled=on;
    if(on){
      button.dataset.label=button.innerHTML;
      button.innerHTML='<span class="auth-spinner"></span><span>'+label+'</span>';
    }else if(button.dataset.label){
      button.innerHTML=button.dataset.label;
      delete button.dataset.label;
    }
  }

  function strong(value){
    return value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value);
  }

  function wirePasswordRules(){
    const input=$("#authNewPassword");
    if(!input)return;
    const tests=[value=>value.length>=8,value=>/[A-Z]/.test(value),value=>/[a-z]/.test(value),value=>/[0-9]/.test(value),value=>/[^A-Za-z0-9]/.test(value)];
    const update=()=>$$('[data-password-rule]').forEach((node,index)=>node.classList.toggle("ok",tests[index](input.value)));
    input.addEventListener("input",update);
    update();
  }

  $$('[data-toggle-password]').forEach(button=>{
    const input=document.getElementById(button.dataset.togglePassword);
    button.innerHTML=eyeOpen;
    button.addEventListener("click",()=>{
      const show=input.type==="password";
      input.type=show?"text":"password";
      button.innerHTML=show?eyeClosed:eyeOpen;
      button.setAttribute("aria-label",show?"إخفاء كلمة المرور":"إظهار كلمة المرور");
    });
  });
  $$('[data-field-icon]').forEach(node=>node.insertAdjacentHTML("afterbegin",icons[node.dataset.fieldIcon]||""));
  wirePasswordRules();

  function setupLogin(){
    const form=$("#authLoginForm");
    if(!form)return;
    const remembered=window.VAREX?.getRememberedUser?.();
    if(remembered){$("#authEmail").value=remembered;$("#authRemember").checked=true;}
    const query=new URLSearchParams(location.search);
    if(query.get("verified")==="1")message("success","تم تأكيد البريد. أصبح تسجيل الدخول إلى نظام المقاهي متاحاً.");
    if(query.get("created")==="1")message("success","تم إنشاء الحساب. أصبح تسجيل الدخول متاحاً.");
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const button=$("#authSubmit"),email=$("#authEmail").value.trim(),password=$("#authPassword").value;
      if(!email||!password){message("error","يرجى إدخال البريد الإلكتروني وكلمة المرور.");return;}
      busy(button,true,"جاري تسجيل الدخول...");
      const started=Date.now();
      try{
        const result=await window.VAREX.login(email,password,$("#authRemember").checked);
        const remaining=Math.max(0,2200-(Date.now()-started));if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        if(!result.success){message("error",result.message||"تعذر تسجيل الدخول.");return;}
        message("success","تم تسجيل الدخول بنجاح. جاري فتح نظام المقاهي...");
        setTimeout(()=>location.replace("./open-v7.html"),450);
      }catch(error){message("error","تعذر الاتصال بخدمة الحسابات. يرجى إعادة المحاولة.");}
      finally{busy(button,false);}
    });
  }

  function setupRegister(){
    const form=$("#authRegisterForm");
    if(!form)return;
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const button=$("#authSubmit");
      const name=$("#authCafeName").value.trim();
      const email=$("#authEmail").value.trim().toLowerCase();
      const password=$("#authNewPassword").value;
      const confirm=$("#authConfirmPassword").value;
      if(name.length<2){message("error","يرجى إدخال اسم المقهى.");return;}
      if(!emailPattern.test(email)){message("error","يرجى إدخال بريد إلكتروني صحيح.");return;}
      if(!strong(password)){message("error","كلمة المرور يجب أن تحقق جميع شروط الأمان الظاهرة.");return;}
      if(password!==confirm){message("error","تأكيد كلمة المرور غير مطابق.");return;}
      busy(button,true,"جاري إنشاء الحساب وإرسال الرمز...");
      const started=Date.now();
      try{
        const create=window.VAREX.createUserWithConsent||window.VAREX.createUser;
        const result=await create.call(window.VAREX,{name,email,password});
        const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        if(!result?.success){message("error",result?.message||"تعذر إنشاء الحساب.");return;}
        window.VAREX.setPendingVerification?.({email,name});
        if(result.needsEmailConfirmation===false){
          message("success","تم إنشاء الحساب بنجاح. جاري الانتقال إلى تسجيل الدخول...");
          setTimeout(()=>location.replace("./login.html?created=1"),900);
          return;
        }
        message("success","تم إنشاء الحساب وإرسال رمز OTP إلى البريد المسجل.");
        setTimeout(()=>location.replace("./verify-email.html?email="+encodeURIComponent(email)),700);
      }catch(error){const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));message("error",error?.message||"تعذر إنشاء الحساب الآن. يرجى إعادة المحاولة.");}
      finally{busy(button,false);}
    });
  }

  function setupOtpInputs(inputs){
    const fill=value=>{
      const digits=String(value||"").replace(/\D/g,"").slice(0,6).split("");
      inputs.forEach((input,index)=>{input.value=digits[index]||"";});
      inputs[Math.min(digits.length,5)]?.focus();
    };
    inputs.forEach((input,index)=>{
      input.addEventListener("input",event=>{
        const digits=event.target.value.replace(/\D/g,"");
        if(digits.length>1){fill(digits);return;}
        event.target.value=digits;
        if(digits&&index<inputs.length-1)inputs[index+1].focus();
      });
      input.addEventListener("keydown",event=>{
        if(event.key==="Backspace"&&!input.value&&index>0)inputs[index-1].focus();
        if(event.key==="ArrowLeft"&&index>0)inputs[index-1].focus();
        if(event.key==="ArrowRight"&&index<inputs.length-1)inputs[index+1].focus();
      });
      input.addEventListener("paste",event=>{
        const value=event.clipboardData?.getData("text")||"";
        if(/\d/.test(value)){event.preventDefault();fill(value);}
      });
    });
  }

  function setupVerify(){
    const form=$("#authVerifyForm");
    if(!form)return;
    const pending=window.VAREX.getPendingVerification?.()||{};
    const query=new URLSearchParams(location.search);
    const email=(query.get("email")||pending.email||"").trim().toLowerCase();
    const inputs=$$('.auth-otp-input');
    const submit=$("#authSubmit"),resend=$("#authResend"),timer=$("#authResendTimer");
    $("#authVerifyEmail").textContent=email||"البريد غير محدد";
    setupOtpInputs(inputs);
    if(!email){
      message("error","تعذّر العثور على البريد المطلوب تأكيده. يمكن العودة إلى إنشاء الحساب وإدخال البيانات من جديد.");
      submit.disabled=true;resend.disabled=true;
      return;
    }
    let remaining=0,interval=0;
    const renderTimer=()=>{
      resend.disabled=remaining>0;
      timer.textContent=remaining>0?"يمكن الإرسال بعد "+remaining+" ثانية":"";
      if(remaining<=0&&interval){clearInterval(interval);interval=0;}
    };
    const startCooldown=seconds=>{
      remaining=seconds;renderTimer();
      if(interval)clearInterval(interval);
      interval=setInterval(()=>{remaining-=1;renderTimer();},1000);
    };
    startCooldown(60);
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const token=inputs.map(input=>input.value).join("");
      if(!/^\d{6}$/.test(token)){message("error","يرجى إدخال رمز OTP المكون من 6 أرقام.");inputs.find(input=>!input.value)?.focus();return;}
      busy(submit,true,"جاري تأكيد البريد...");
      try{
        const result=await window.VAREX.verifyEmailOtp(email,token);
        if(!result?.success){message("error",result?.message||"رمز التحقق غير صحيح أو انتهت صلاحيته.");return;}
        $("#authVerifyContent").hidden=true;
        $("#authVerifySuccess").hidden=false;
        setTimeout(()=>location.replace("./login.html?verified=1"),1800);
      }catch(error){message("error",error?.message||"تعذر تأكيد الرمز الآن. يرجى إعادة المحاولة.");}
      finally{busy(submit,false);}
    });
    resend.addEventListener("click",async()=>{
      if(remaining>0||resend.disabled)return;
      clearMessage();resend.disabled=true;resend.textContent="جاري الإرسال...";
      try{
        const result=await window.VAREX.resendConfirmation(email);
        message(result?.success?"success":"error",result?.message||"تعذر إعادة إرسال الرمز.");
        if(result?.success)startCooldown(60);
      }catch(error){message("error","تعذر إعادة إرسال الرمز الآن.");}
      finally{resend.textContent="إعادة إرسال الرمز";renderTimer();}
    });
    inputs[0]?.focus();
  }

  function setupForgot(){
    const form=$("#authForgotForm");
    if(!form)return;
    const remembered=window.VAREX?.getRememberedUser?.();
    if(remembered)$("#authEmail").value=remembered;
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const button=$("#authSubmit"),email=$("#authEmail").value.trim();
      if(!emailPattern.test(email)){message("error","يرجى إدخال بريد إلكتروني صحيح.");return;}
      busy(button,true,"جاري إرسال الرمز...");
      try{
        const result=await window.VAREX.requestPasswordReset(email);
        message(result.success?"success":"error",result.message||"تعذر إرسال رمز الاستعادة.");
        if(result.success)setTimeout(()=>location.replace("./reset-password.html?email="+encodeURIComponent(email)),900);
      }catch(error){message("error","تعذر الاتصال بخدمة الحسابات. يرجى إعادة المحاولة.");}
      finally{busy(button,false);}
    });
  }

  function setupChange(){
    const form=$("#authChangeForm");
    if(!form)return;
    if(!window.VAREX?.isLoggedIn?.()&&!window.VAREX?.isDeviceAuthorized?.()){
      message("error","يجب تسجيل الدخول أولاً لتغيير كلمة المرور.");
      form.querySelectorAll("input,button").forEach(node=>node.disabled=true);
      return;
    }
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const button=$("#authSubmit"),current=$("#authCurrentPassword").value,next=$("#authNewPassword").value,confirm=$("#authConfirmPassword").value;
      if(!current){message("error","يرجى إدخال كلمة المرور الحالية.");return;}
      if(!strong(next)){message("error","كلمة المرور الجديدة يجب أن تحقق جميع شروط الأمان الظاهرة.");return;}
      if(next!==confirm){message("error","تأكيد كلمة المرور غير مطابق.");return;}
      if(current===next){message("error","يرجى استخدام كلمة مرور جديدة مختلفة عن الحالية.");return;}
      busy(button,true,"جاري التحقق والحفظ...");
      try{
        const verify=await window.VAREX.verifyOwnerPassword(current);
        if(!verify.success){message("error",verify.message||"كلمة المرور الحالية غير صحيحة.");return;}
        const result=await window.VAREX.changePassword(current,next);
        if(!result.success){message("error",result.message||"تعذر تغيير كلمة المرور.");return;}
        form.reset();message("success","تم تغيير كلمة المرور بنجاح. ستبقى جلستك الحالية فعّالة.");
      }catch(error){message("error","تعذر تغيير كلمة المرور الآن. يرجى إعادة المحاولة.");}
      finally{busy(button,false);}
    });
  }

  async function setupLogout(){
    const status=$("#authLogoutStatus");
    try{
      if(window.VAREX?.logout)await window.VAREX.logout(false);
      if(status)status.textContent="تم إنهاء الجلسة وحماية بيانات شركة التاكسي على هذا الجهاز.";
    }catch(error){if(status)status.textContent="تم إغلاق الجلسة المحلية. أصبح تسجيل الدخول متاحاً.";}
  }

  function setupReset(){
    const form=$("#authResetForm");
    if(!form)return;
    const query=new URLSearchParams(location.search);
    const email=(query.get("email")||localStorage.getItem("varex_cafe_reset_email")||"").trim().toLowerCase();
    if(email&&$("#authResetEmail"))$("#authResetEmail").value=email;
    form.addEventListener("submit",async event=>{
      event.preventDefault();clearMessage();
      const button=$("#authSubmit"),accountEmail=$("#authResetEmail").value.trim().toLowerCase(),otp=$("#authResetOtp").value.trim(),next=$("#authNewPassword").value,confirm=$("#authConfirmPassword").value;
      if(!emailPattern.test(accountEmail)){message("error","يرجى إدخال بريد إلكتروني صحيح.");return;}
      if(!/^\d{6}$/.test(otp)){message("error","يرجى إدخال رمز OTP المكوّن من 6 أرقام.");return;}
      if(!strong(next)){message("error","كلمة المرور الجديدة يجب أن تحقق جميع شروط الأمان الظاهرة.");return;}
      if(next!==confirm){message("error","تأكيد كلمة المرور غير مطابق.");return;}
      busy(button,true,"جاري حفظ كلمة المرور...");
      const started=Date.now();
      try{
        const result=await window.VAREX.resetPasswordWithOtp(accountEmail,otp,next);
        const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        if(!result?.success)throw new Error(result?.message||"تعذر تغيير كلمة المرور.");
        form.hidden=true;
        message("success","تم تغيير كلمة المرور بنجاح. أصبح تسجيل الدخول بالكلمة الجديدة متاحاً.");
        $("#authLoginAfterReset").hidden=false;
      }catch(error){
        const remaining=Math.max(0,2000-(Date.now()-started));if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        const text=String(error?.message||"");
        message("error",/expired|otp|token/i.test(text)?"رمز التحقق غير صحيح أو انتهت صلاحيته. يمكن طلب رمز جديد.":text);
      }finally{busy(button,false);}
    });
  }

  if(!window.VAREX&&page!=="logout")return;
  if(page==="login")setupLogin();
  if(page==="register")setupRegister();
  if(page==="verify")setupVerify();
  if(page==="forgot")setupForgot();
  if(page==="change")setupChange();
  if(page==="logout")setupLogout();
  if(page==="reset")setupReset();
})();
