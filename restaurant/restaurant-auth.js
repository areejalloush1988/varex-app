(function(){
  "use strict";

  var KEYS={
    pending:"varex_restaurant_pending_verification",
    remembered:"varex_restaurant_remembered_email",
    cached:"varex_restaurant_cached_user",
    deviceAuth:"varex_restaurant_device_authorized",
    deviceOwner:"varex_restaurant_device_owner",
    staffSession:"varex_restaurant_staff_session"
  };

  function clean(value){return String(value==null?"":value).trim()}
  function email(value){return clean(value).toLowerCase()}
  function isPublicPreview(){return new URLSearchParams(location.search).get("preview")==="1"||(location.hostname==="app.varexapp.com"&&location.pathname.startsWith("/restaurant/"))}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function withMinimumDelay(task,ms){
    var started=Date.now(),value,error;
    try{value=await task}catch(err){error=err}
    var remaining=Math.max(0,(Number(ms)||0)-(Date.now()-started));
    if(remaining)await sleep(remaining);
    if(error)throw error;
    return value;
  }
  function strongPassword(value){
    var password=String(value||"");
    return password.length>=8&&/[A-Z]/.test(password)&&/[a-z]/.test(password)&&/[0-9]/.test(password)&&/[^A-Za-z0-9]/.test(password);
  }
  function passwordChecks(value){
    var password=String(value||"");
    return{length:password.length>=8,upper:/[A-Z]/.test(password),lower:/[a-z]/.test(password),number:/[0-9]/.test(password),symbol:/[^A-Za-z0-9]/.test(password)};
  }
  function mapError(error){
    var text=String(error&&error.message||error||"").toLowerCase();
    if(text.indexOf("invalid email or password")!==-1||text.indexOf("invalid_email_or_password")!==-1||text.indexOf("invalid credentials")!==-1)return"البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if(text.indexOf("email not verified")!==-1||text.indexOf("email_not_verified")!==-1||text.indexOf("email not confirmed")!==-1)return"يجب تأكيد البريد الإلكتروني أولاً باستخدام رمز OTP.";
    if(text.indexOf("already")!==-1||text.indexOf("user exists")!==-1)return"هذا البريد الإلكتروني مرتبط بحساب مطاعم موجود مسبقاً.";
    if(text.indexOf("otp")!==-1||text.indexOf("token")!==-1||text.indexOf("expired")!==-1)return"رمز التحقق غير صحيح أو انتهت صلاحيته.";
    if(text.indexOf("password")!==-1&&(text.indexOf("short")!==-1||text.indexOf("weak")!==-1))return"كلمة المرور لا تحقق شروط الأمان المطلوبة.";
    if(text.indexOf("rate")!==-1||text.indexOf("security purposes")!==-1||text.indexOf("انتظري دقيقة")!==-1)return"تم طلب رسائل كثيرة خلال وقت قصير. انتظري قليلاً ثم أعيدي المحاولة.";
    if(text.indexOf("failed to fetch")!==-1||text.indexOf("network")!==-1)return"تعذر الاتصال بخدمة الحسابات. تحققي من الإنترنت ثم أعيدي المحاولة.";
    return clean(error&&error.message)||"حدث خطأ في خدمة حسابات المطاعم.";
  }
  async function api(path,options){
    options=options||{};
    var response=await fetch(path,{
      method:options.method||"GET",
      credentials:"include",
      headers:{"Content-Type":"application/json","X-Client-Info":"varex-restaurant-auth/2.0"},
      body:options.body===undefined?undefined:JSON.stringify(options.body)
    });
    var data={};
    try{data=await response.json()}catch(ignore){}
    if(!response.ok){
      var message=data.message||data.error_description||data.error||"تعذر تنفيذ طلب الحساب.";
      var err=new Error(String(message));err.status=response.status;err.data=data;throw err;
    }
    return data;
  }
  function safeUser(user){
    if(!user)return null;
    return{id:user.id||"",email:user.email||"",name:user.name||"مالك المنشأة",username:(user.email||"").split("@")[0],role:"مالك"};
  }
  function setPending(data){
    var value={email:email(data&&data.email),name:clean(data&&data.name),purpose:clean(data&&data.purpose)||"verify",createdAt:new Date().toISOString()};
    localStorage.setItem(KEYS.pending,JSON.stringify(value));return value;
  }
  function getPending(){try{return JSON.parse(localStorage.getItem(KEYS.pending)||"null")}catch(ignore){return null}}
  function clearPending(){localStorage.removeItem(KEYS.pending)}
  function cacheUser(user){
    var safe=safeUser(user);if(!safe)return null;
    localStorage.setItem(KEYS.cached,JSON.stringify(safe));
    localStorage.setItem(KEYS.deviceAuth,"true");
    localStorage.setItem(KEYS.deviceOwner,JSON.stringify({authorized:true,ownerId:safe.id,name:safe.name,username:safe.username,email:safe.email,authorizedAt:new Date().toISOString()}));
    return safe;
  }
  function cachedUser(){try{return JSON.parse(localStorage.getItem(KEYS.cached)||"null")}catch(ignore){return null}}
  function clearSession(){
    [localStorage,sessionStorage].forEach(function(store){
      [KEYS.cached,KEYS.deviceAuth,KEYS.deviceOwner,KEYS.staffSession,"varex_session","varex_cached_user","varex_device_authorized","varex_device_owner","varex_staff_session","varex_authenticated"].forEach(function(key){store.removeItem(key)});
    });
  }
  function clearLegacyState(){
    [localStorage,sessionStorage].forEach(function(store){
      ["varex_session","varex_cached_user","varex_device_authorized","varex_device_owner","varex_staff_session","varex_authenticated","varex_pending_verification"].forEach(function(key){store.removeItem(key)});
    });
  }
  async function hasSession(){
    try{var data=await api("/api/auth/get-session");if(data&&data.user){cacheUser(data.user);return true}}catch(ignore){}
    clearSession();return false;
  }
  function safeReturnTo(value){
    var target=clean(value);
    if(!target||target.charAt(0)!=="/"||target.indexOf("//")===0)return"/open-v7.html";
    if(target.indexOf("/login.html")===0||target.indexOf("/register.html")===0)return"/open-v7.html";
    return target;
  }
  function requireSession(){
    if(isPublicPreview())return true;
    hasSession().then(function(valid){if(!valid){var target=location.pathname+location.search;location.replace("/login.html?session_expired=1&return_to="+encodeURIComponent(safeReturnTo(target)))}});
    return true;
  }
  async function signIn(credentials){
    var userEmail=email(credentials&&credentials.email),password=String(credentials&&credentials.password||"");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail))throw new Error("يرجى إدخال بريد إلكتروني صحيح.");
    if(password.length<8)throw new Error("كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.");
    var data=await api("/api/auth/sign-in/email",{method:"POST",body:{email:userEmail,password:password,rememberMe:Boolean(credentials&&credentials.remember)}});
    if(!data.user)throw new Error("تعذر إنشاء جلسة تسجيل الدخول.");
    var user=cacheUser(data.user);
    localStorage.setItem(KEYS.remembered,credentials&&credentials.remember?userEmail:"");clearPending();return user;
  }
  async function signUp(details){
    var fullName=clean(details&&details.name),userEmail=email(details&&details.email),password=String(details&&details.password||"");
    if(fullName.length<2)throw new Error("يرجى إدخال الاسم الكامل.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail))throw new Error("يرجى إدخال بريد إلكتروني صحيح.");
    if(!strongPassword(password))throw new Error("كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير وصغير، ورقم، ورمز خاص.");
    var data=await api("/api/auth/sign-up/email",{method:"POST",body:{name:fullName,email:userEmail,password:password,rememberMe:false}});
    setPending({email:userEmail,name:fullName,purpose:"verify"});
    await api("/api/varex-auth/send-otp",{method:"POST",body:{email:userEmail,purpose:"verify"}});
    return{needsConfirmation:true,email:userEmail,user:safeUser(data.user)};
  }
  async function verifySignupOtp(userEmail,token){
    var value=clean(token).replace(/\s+/g,"");
    if(!/^\d{6}$/.test(value))throw new Error("يرجى إدخال رمز التحقق المكوّن من 6 أرقام.");
    var data=await api("/api/varex-auth/verify-email",{method:"POST",body:{email:email(userEmail),otp:value}});
    clearSession();clearPending();return safeUser(data.user);
  }
  async function resendSignupOtp(userEmail){
    await api("/api/varex-auth/send-otp",{method:"POST",body:{email:email(userEmail),purpose:"verify"}});return true;
  }
  async function requestPasswordReset(userEmail){
    var normalized=email(userEmail);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error("يرجى إدخال بريد إلكتروني صحيح.");
    setPending({email:normalized,purpose:"reset"});
    await api("/api/varex-auth/send-otp",{method:"POST",body:{email:normalized,purpose:"reset"}});return true;
  }
  async function updateRecoveredPassword(userEmail,otp,password){
    if(!strongPassword(password))throw new Error("كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير وصغير، ورقم، ورمز خاص.");
    await api("/api/varex-auth/reset-password",{method:"POST",body:{email:email(userEmail),otp:clean(otp),password:String(password)}});
    clearSession();clearPending();return true;
  }
  async function logout(){
    try{await api("/api/auth/sign-out",{method:"POST",body:{}})}catch(ignore){}
    clearSession();return true;
  }

  if(!isPublicPreview())clearLegacyState();
  window.RestaurantAuth={
    keys:KEYS,sleep:sleep,withMinimumDelay:withMinimumDelay,strongPassword:strongPassword,passwordChecks:passwordChecks,mapError:mapError,
    getSession:cachedUser,hasSession:hasSession,setPending:setPending,getPending:getPending,clearPending:clearPending,signIn:signIn,signUp:signUp,
    verifySignupOtp:verifySignupOtp,resendSignupOtp:resendSignupOtp,requestPasswordReset:requestPasswordReset,updateRecoveredPassword:updateRecoveredPassword,
    requireSession:requireSession,safeReturnTo:safeReturnTo,logout:logout,clearSession:clearSession,rememberedEmail:function(){return localStorage.getItem(KEYS.remembered)||""}
  };
})();
