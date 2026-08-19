(function(){
"use strict";

const VERSION="20260820-account-deletion1";
let modal=null;
let previousFocus=null;
let busy=false;
let resendTimer=null;
let resendSeconds=0;
let ownerEmail="";
let deletionStarted=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const byId=id=>document.getElementById(id);

function maskEmail(value){
const email=String(value||"").trim();
const parts=email.split("@");
if(parts.length!==2)return email;
const name=parts[0],visible=name.slice(0,Math.min(2,name.length));
return `${visible}${"•".repeat(Math.max(3,name.length-visible))}@${parts[1]}`;
}

function addStyles(){
if(byId("varexAccountDeletionStyles"))return;
const style=document.createElement("style");
style.id="varexAccountDeletionStyles";
style.textContent=`
.vad-overlay[hidden]{display:none!important}.vad-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(8,15,35,.68);backdrop-filter:blur(7px);direction:rtl}.vad-card{width:min(570px,100%);max-height:calc(100vh - 36px);overflow:auto;border:1px solid rgba(148,163,184,.35);border-radius:22px;background:#fff;color:#172554;box-shadow:0 28px 80px rgba(2,6,23,.4);font-family:inherit}.vad-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px 17px;border-bottom:1px solid #e2e8f0}.vad-title-wrap{display:flex;align-items:center;gap:13px}.vad-icon{display:grid;place-items:center;flex:0 0 44px;height:44px;border-radius:14px;background:#fee2e2;color:#b91c1c;font-size:22px}.vad-head h2{margin:0;font-size:20px;color:#172554}.vad-head p{margin:5px 0 0;color:#64748b;font-size:11px}.vad-close{width:34px;height:34px;border:0;border-radius:10px;background:#f1f5f9;color:#475569;font-size:19px;cursor:pointer}.vad-close:disabled{opacity:.35;cursor:not-allowed}.vad-body{padding:22px 24px 24px}.vad-step{display:none}.vad-step.is-active{display:block}.vad-stage{display:flex;align-items:center;gap:8px;margin-bottom:15px;color:#64748b;font-size:11px;font-weight:800}.vad-stage span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#172554;color:#fff}.vad-warning{padding:14px 15px;border:1px solid #fecaca;border-radius:13px;background:#fff7f7;color:#991b1b;font-size:12px;line-height:1.8}.vad-warning strong{display:block;margin-bottom:2px;font-size:13px}.vad-field{margin-top:17px}.vad-field label{display:block;margin-bottom:7px;color:#334155;font-size:12px;font-weight:800}.vad-field input[type=password],.vad-field input[type=text]{width:100%;height:48px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:0 14px;background:#fff;color:#0f172a;font:inherit;font-size:15px;outline:none;transition:.15s}.vad-field input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}.vad-check{display:flex;align-items:flex-start;gap:10px;margin-top:16px;padding:13px;border-radius:12px;background:#f8fafc;color:#475569;font-size:11px;line-height:1.7;cursor:pointer}.vad-check input{flex:0 0 18px;width:18px;height:18px;margin-top:1px;accent-color:#172554}.vad-actions{display:flex;gap:10px;margin-top:20px}.vad-btn{min-height:45px;border:0;border-radius:11px;padding:0 18px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.vad-btn:disabled{opacity:.55;cursor:not-allowed}.vad-btn-primary{flex:1;background:#172554;color:#fff;box-shadow:0 5px 0 #0f1d43}.vad-btn-danger{flex:1;background:#b91c1c;color:#fff;box-shadow:0 5px 0 #7f1d1d}.vad-btn-light{background:#e2e8f0;color:#334155}.vad-btn-link{min-height:auto;padding:6px;background:transparent;color:#1d4ed8}.vad-spinner{display:inline-block;width:15px;height:15px;margin-left:8px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;vertical-align:-3px;animation:vad-spin .7s linear infinite}.vad-message{display:none;margin-top:13px;padding:11px 13px;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:11px;line-height:1.7}.vad-message.is-visible{display:block}.vad-email-box{margin:14px 0;padding:13px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;color:#1e3a8a;font-size:13px;font-weight:900;direction:ltr}.vad-otp{text-align:center!important;direction:ltr;letter-spacing:12px;font-size:22px!important;font-weight:900;padding-left:26px!important}.vad-help{margin:10px 0 0;text-align:center;color:#64748b;font-size:11px;line-height:1.7}.vad-resend{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:11px;color:#64748b}.vad-processing{text-align:center;padding:8px 0 3px}.vad-loader{position:relative;width:74px;height:74px;margin:0 auto 18px;border:6px solid #dbeafe;border-top-color:#172554;border-radius:50%;animation:vad-spin .8s linear infinite}.vad-loader:after{content:"";position:absolute;inset:17px;border-radius:50%;background:#dcfce7}.vad-processing h3,.vad-success h3,.vad-failure h3{margin:0 0 7px;color:#172554;font-size:19px}.vad-status{min-height:20px;color:#64748b;font-size:12px}.vad-progress{height:10px;margin-top:19px;overflow:hidden;border-radius:999px;background:#e2e8f0}.vad-progress-bar{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#172554);transition:width .45s ease}.vad-progress-number{margin-top:8px;color:#334155;font-size:12px;font-weight:900;direction:ltr}.vad-protocol{display:grid;gap:9px;margin-top:18px;text-align:right}.vad-protocol-row{display:flex;align-items:center;gap:9px;color:#94a3b8;font-size:11px}.vad-protocol-row span{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e2e8f0;color:#64748b;font-size:10px}.vad-protocol-row.is-done{color:#166534}.vad-protocol-row.is-done span{background:#dcfce7;color:#15803d}.vad-success,.vad-failure{text-align:center;padding:10px 0}.vad-result-icon{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 17px;border-radius:50%;background:#dcfce7;color:#15803d;font-size:32px}.vad-failure .vad-result-icon{background:#fee2e2;color:#b91c1c}.vad-result-copy{margin:0 auto;max-width:430px;color:#64748b;font-size:12px;line-height:1.8}.vad-version{display:none}.vad-no-scroll{overflow:hidden!important}@keyframes vad-spin{to{transform:rotate(360deg)}}
html[data-theme=dark] .vad-card{background:#111827;color:#f8fafc;border-color:#334155}.vad-card .vad-version{content:"${VERSION}"}html[data-theme=dark] .vad-head{border-color:#334155}html[data-theme=dark] .vad-head h2,html[data-theme=dark] .vad-processing h3,html[data-theme=dark] .vad-success h3,html[data-theme=dark] .vad-failure h3{color:#f8fafc}html[data-theme=dark] .vad-head p,html[data-theme=dark] .vad-help,html[data-theme=dark] .vad-status,html[data-theme=dark] .vad-result-copy{color:#94a3b8}html[data-theme=dark] .vad-close,html[data-theme=dark] .vad-btn-light{background:#334155;color:#f8fafc}html[data-theme=dark] .vad-field label{color:#cbd5e1}html[data-theme=dark] .vad-field input[type=password],html[data-theme=dark] .vad-field input[type=text]{background:#0f172a;border-color:#475569;color:#f8fafc}html[data-theme=dark] .vad-check{background:#1e293b;color:#cbd5e1}html[data-theme=dark] .vad-email-box{background:#172554;border-color:#1e40af;color:#dbeafe}html[data-theme=dark] .vad-progress{background:#334155}@media(max-width:520px){.vad-overlay{padding:10px}.vad-card{border-radius:17px}.vad-head,.vad-body{padding:18px}.vad-actions{flex-direction:column-reverse}.vad-btn{width:100%}.vad-otp{letter-spacing:8px}}
`;
document.head.appendChild(style);
}

function createModal(){
if(modal)return modal;
addStyles();
modal=document.createElement("div");
modal.id="varexAccountDeletionModal";
modal.className="vad-overlay";
modal.hidden=true;
modal.innerHTML=`
<section class="vad-card" role="dialog" aria-modal="true" aria-labelledby="vadTitle" aria-describedby="vadSubtitle">
  <header class="vad-head">
    <div class="vad-title-wrap"><div class="vad-icon">🗑️</div><div><h2 id="vadTitle">حذف حساب المنشأة</h2><p id="vadSubtitle">تحقق آمن قبل الحذف النهائي</p></div></div>
    <button type="button" class="vad-close" id="vadClose" aria-label="إغلاق">×</button>
  </header>
  <div class="vad-body">
    <div class="vad-step" id="vadIdentityStep">
      <div class="vad-stage"><span>1</span> التحقق من حساب المالك</div>
      <div class="vad-warning"><strong>هذه العملية نهائية ولا يمكن التراجع عنها.</strong>سيتم حذف حساب المنشأة والبيانات المرتبطة به، ثم إغلاق حساب الدخول.</div>
      <form id="vadIdentityForm" novalidate>
        <div class="vad-field"><label for="vadPassword">كلمة مرور المالك</label><input id="vadPassword" type="password" autocomplete="current-password" placeholder="يرجى إدخال كلمة مرور المالك"></div>
        <label class="vad-check"><input id="vadAcknowledge" type="checkbox"><span>أفهم أن الحذف نهائي وأن استعادة بيانات المنشأة لن تكون ممكنة بعد اكتمال العملية.</span></label>
        <div class="vad-message" id="vadIdentityMessage" role="alert"></div>
        <div class="vad-actions"><button type="button" class="vad-btn vad-btn-light" id="vadCancel">إلغاء</button><button type="submit" class="vad-btn vad-btn-primary" id="vadSendOtp">إرسال رمز التحقق</button></div>
      </form>
    </div>
    <div class="vad-step" id="vadOtpStep">
      <div class="vad-stage"><span>2</span> تأكيد الرمز المرسل إلى البريد</div>
      <p class="vad-help">تم إرسال رمز من 6 أرقام إلى بريد حساب المالك:</p>
      <div class="vad-email-box" id="vadMaskedEmail"></div>
      <form id="vadOtpForm" novalidate>
        <div class="vad-field"><label for="vadOtp">رمز التحقق</label><input id="vadOtp" class="vad-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-describedby="vadOtpHelp"></div>
        <p class="vad-help" id="vadOtpHelp">يرجى إدخال الرمز قبل انتهاء صلاحيته. لن يبدأ الحذف قبل التحقق منه.</p>
        <div class="vad-resend"><span>لم يصل الرمز؟</span><button type="button" class="vad-btn vad-btn-link" id="vadResend">إعادة الإرسال</button></div>
        <div class="vad-message" id="vadOtpMessage" role="alert"></div>
        <div class="vad-actions"><button type="button" class="vad-btn vad-btn-light" id="vadBack">رجوع</button><button type="submit" class="vad-btn vad-btn-danger" id="vadConfirmDelete">تحقق وبدء الحذف</button></div>
      </form>
    </div>
    <div class="vad-step" id="vadProcessingStep">
      <div class="vad-stage"><span>3</span> تنفيذ الحذف الآمن</div>
      <div class="vad-processing">
        <div class="vad-loader" aria-hidden="true"></div>
        <h3>جاري حذف الحساب</h3>
        <div class="vad-status" id="vadStatus" aria-live="polite">جاري تثبيت التحقق الآمن...</div>
        <div class="vad-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="vad-progress-bar" id="vadProgressBar"></div></div>
        <div class="vad-progress-number" id="vadProgressNumber">0%</div>
        <div class="vad-protocol">
          <div class="vad-protocol-row" id="vadProtocolVerify"><span>1</span>تأكيد هوية المالك ورمز البريد</div>
          <div class="vad-protocol-row" id="vadProtocolData"><span>2</span>إزالة بيانات المنشأة بأمان</div>
          <div class="vad-protocol-row" id="vadProtocolAccount"><span>3</span>إغلاق حساب الدخول وإنهاء الجلسات</div>
        </div>
      </div>
    </div>
    <div class="vad-step" id="vadSuccessStep">
      <div class="vad-success"><div class="vad-result-icon">✓</div><h3>اكتمل حذف الحساب</h3><p class="vad-result-copy">تم حذف حساب المنشأة وإغلاق حساب الدخول. سيتم الانتقال إلى صفحة تسجيل الدخول.</p></div>
    </div>
    <div class="vad-step" id="vadFailureStep">
      <div class="vad-failure"><div class="vad-result-icon">!</div><h3>لم تكتمل عملية الحذف</h3><p class="vad-result-copy" id="vadFailureMessage"></p><div class="vad-actions"><button type="button" class="vad-btn vad-btn-light" id="vadFailureClose">إغلاق</button><button type="button" class="vad-btn vad-btn-primary" id="vadRetry">إعادة المحاولة</button></div></div>
    </div>
  </div>
</section>`;
document.body.appendChild(modal);
bindEvents();
return modal;
}

function setStep(name){
modal.querySelectorAll(".vad-step").forEach(step=>step.classList.remove("is-active"));
byId(`vad${name}Step`)?.classList.add("is-active");
}

function setMessage(id,message){
const node=byId(id);if(!node)return;
node.textContent=message||"";
node.classList.toggle("is-visible",Boolean(message));
}

function setButtonBusy(button,isBusy,label){
if(!button)return;
if(!button.dataset.label)button.dataset.label=button.textContent;
button.disabled=isBusy;
button.innerHTML=isBusy?`<span class="vad-spinner"></span>${label}`:button.dataset.label;
}

function stopResendTimer(){
if(resendTimer)clearInterval(resendTimer);
resendTimer=null;
}

function startResendTimer(seconds=60){
stopResendTimer();
resendSeconds=seconds;
const button=byId("vadResend");
const tick=()=>{
if(!button)return;
if(resendSeconds<=0){button.disabled=false;button.textContent="إعادة الإرسال";stopResendTimer();return}
button.disabled=true;button.textContent=`إعادة الإرسال (${resendSeconds})`;resendSeconds-=1;
};
tick();resendTimer=setInterval(tick,1000);
}

function resetModal(){
busy=false;deletionStarted=false;ownerEmail="";stopResendTimer();
byId("vadPassword").value="";byId("vadAcknowledge").checked=false;byId("vadOtp").value="";
setMessage("vadIdentityMessage","");setMessage("vadOtpMessage","");
byId("vadClose").disabled=false;byId("vadClose").hidden=false;
setButtonBusy(byId("vadSendOtp"),false,"");setButtonBusy(byId("vadConfirmDelete"),false,"");
setStep("Identity");setProgress(0,"جاري تثبيت التحقق الآمن...");
modal.querySelectorAll(".vad-protocol-row").forEach(row=>row.classList.remove("is-done"));
}

function open(){
createModal();resetModal();previousFocus=document.activeElement;modal.hidden=false;document.body.classList.add("vad-no-scroll");
requestAnimationFrame(()=>byId("vadPassword")?.focus());
}

function close(){
if(busy)return;
stopResendTimer();modal.hidden=true;document.body.classList.remove("vad-no-scroll");
if(previousFocus?.focus)previousFocus.focus();
}

async function submitIdentity(event){
event.preventDefault();if(busy)return;
const password=byId("vadPassword").value,acknowledged=byId("vadAcknowledge").checked,button=byId("vadSendOtp");
setMessage("vadIdentityMessage","");
if(!password){setMessage("vadIdentityMessage","يرجى إدخال كلمة مرور المالك.");byId("vadPassword").focus();return}
if(!acknowledged){setMessage("vadIdentityMessage","يرجى تأكيد فهم أن عملية الحذف نهائية.");byId("vadAcknowledge").focus();return}
if(!window.VAREX?.verifyOwnerPassword||!VAREX.prepareBusinessAccountDeletion||!VAREX.requestAccountDeletionOtp){setMessage("vadIdentityMessage","خدمة التحقق الآمن غير متوفرة في هذا الإصدار.");return}
busy=true;setButtonBusy(button,true,"جاري التحقق...");
try{
const verified=await VAREX.verifyOwnerPassword(password);byId("vadPassword").value="";
if(!verified?.success){setMessage("vadIdentityMessage",verified?.message||"تعذر التحقق من حساب المالك.");return}
setButtonBusy(button,true,"جاري تجهيز الحذف الآمن...");
const prepared=await VAREX.prepareBusinessAccountDeletion();
if(!prepared?.success){setMessage("vadIdentityMessage",prepared?.message||"تعذر تجهيز طلب الحذف الآمن.");return}
setButtonBusy(button,true,"جاري إرسال الرمز...");
const sent=await VAREX.requestAccountDeletionOtp();
if(!sent?.success){setMessage("vadIdentityMessage",sent?.message||"تعذر إرسال رمز التحقق.");return}
ownerEmail=sent.email||verified?.user?.email||"";byId("vadMaskedEmail").textContent=maskEmail(ownerEmail);
setStep("Otp");startResendTimer(60);requestAnimationFrame(()=>byId("vadOtp")?.focus());
}catch(error){setMessage("vadIdentityMessage",error?.message||"حدث خطأ أثناء التحقق.")}
finally{busy=false;setButtonBusy(button,false,"")}
}

async function resendOtp(){
if(busy||resendSeconds>0)return;
setMessage("vadOtpMessage","");busy=true;
const button=byId("vadResend");button.disabled=true;button.textContent="جاري الإرسال...";
try{
const result=await VAREX.requestAccountDeletionOtp();
if(!result?.success){setMessage("vadOtpMessage",result?.message||"تعذر إعادة إرسال الرمز.");button.disabled=false;button.textContent="إعادة الإرسال";return}
ownerEmail=result.email||ownerEmail;byId("vadMaskedEmail").textContent=maskEmail(ownerEmail);byId("vadOtp").value="";startResendTimer(60);byId("vadOtp").focus();
}catch(error){setMessage("vadOtpMessage",error?.message||"تعذر إعادة إرسال الرمز.");button.disabled=false;button.textContent="إعادة الإرسال"}
finally{busy=false}
}

async function submitOtp(event){
event.preventDefault();if(busy)return;
const token=byId("vadOtp").value.replace(/\D/g,""),button=byId("vadConfirmDelete");
setMessage("vadOtpMessage","");
if(token.length!==6){setMessage("vadOtpMessage","يرجى إدخال رمز التحقق المكوّن من 6 أرقام.");byId("vadOtp").focus();return}
busy=true;setButtonBusy(button,true,"جاري التحقق...");
try{
const result=await VAREX.verifyAccountDeletionOtp(token);
if(!result?.success){setMessage("vadOtpMessage",result?.message||"رمز التحقق غير صحيح.");busy=false;setButtonBusy(button,false,"");byId("vadOtp").select();return}
await runDeletion();
}catch(error){busy=false;setButtonBusy(button,false,"");setMessage("vadOtpMessage",error?.message||"تعذر التحقق من الرمز.")}
}

function setProgress(value,status){
const safe=Math.max(0,Math.min(100,Math.round(value)));
const bar=byId("vadProgressBar"),number=byId("vadProgressNumber"),container=bar?.parentElement;
if(bar)bar.style.width=`${safe}%`;if(number)number.textContent=`${safe}%`;if(container)container.setAttribute("aria-valuenow",String(safe));
if(status&&byId("vadStatus"))byId("vadStatus").textContent=status;
if(safe>=18)byId("vadProtocolVerify")?.classList.add("is-done");
if(safe>=72)byId("vadProtocolData")?.classList.add("is-done");
if(safe>=96)byId("vadProtocolAccount")?.classList.add("is-done");
}

async function runDeletion(){
deletionStarted=true;busy=true;stopResendTimer();setStep("Processing");byId("vadClose").disabled=true;byId("vadClose").hidden=true;
setProgress(12,"تم تأكيد الرمز. جاري إنشاء اتصال حذف آمن...");await sleep(350);setProgress(22,"جاري قفل عملية الحذف ومنع التنفيذ المكرر...");
let progress=22;
const progressTimer=setInterval(()=>{
progress=Math.min(84,progress+(progress<55?5:2));
const status=progress<45?"جاري التحقق من ملكية المنشأة...":progress<72?"جاري إزالة بيانات المنشأة بأمان...":"جاري إغلاق حساب الدخول...";
setProgress(progress,status);
},420);
let result;
try{
result=await Promise.all([VAREX.deleteBusinessAccount(),sleep(1800)]).then(values=>values[0]);
}catch(error){result={success:false,message:error?.message||"تعذر إكمال الحذف."}}
clearInterval(progressTimer);
if(!result?.success){
busy=false;byId("vadClose").disabled=false;byId("vadClose").hidden=false;
byId("vadFailureMessage").textContent=result?.message||"تعذر إكمال العملية. يمكن إعادة المحاولة ما دامت جلسة التحقق صالحة.";
byId("vadRetry").textContent=result?.retryable===false?"بدء التحقق من جديد":"إعادة المحاولة";
byId("vadRetry").dataset.mode=result?.retryable===false?"identity":"delete";
setStep("Failure");return;
}
setProgress(92,"تم حذف بيانات المنشأة. جاري إنهاء الجلسات...");await sleep(450);setProgress(100,"اكتملت عملية الحذف بنجاح.");await sleep(450);
setStep("Success");
try{VAREX.clearDeletedAccountLocalData?.()}catch(error){}
await sleep(1800);location.replace("./login.html?account_deleted=1");
}

async function retryDeletion(){
if(busy)return;
if(byId("vadRetry").dataset.mode==="identity"){
resetModal();requestAnimationFrame(()=>byId("vadPassword")?.focus());return;
}
busy=true;await runDeletion();
}

function bindEvents(){
byId("vadClose").addEventListener("click",close);byId("vadCancel").addEventListener("click",close);byId("vadFailureClose").addEventListener("click",close);
byId("vadIdentityForm").addEventListener("submit",submitIdentity);byId("vadOtpForm").addEventListener("submit",submitOtp);byId("vadResend").addEventListener("click",resendOtp);byId("vadRetry").addEventListener("click",retryDeletion);
byId("vadBack").addEventListener("click",()=>{if(busy)return;stopResendTimer();setStep("Identity");setMessage("vadIdentityMessage","");requestAnimationFrame(()=>byId("vadPassword")?.focus())});
byId("vadOtp").addEventListener("input",event=>{event.target.value=event.target.value.replace(/\D/g,"").slice(0,6);setMessage("vadOtpMessage","")});
modal.addEventListener("click",event=>{if(event.target===modal)close()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!modal.hidden)close()});
}

function install(){createModal();window.VarexAccountDeletion={open,close}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
window.deleteAccountRequest=open;
})();
