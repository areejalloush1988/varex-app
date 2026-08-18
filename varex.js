/* ========================================================= HELPERS ========================================================= */
function varexWait(ms){return new Promise(r=>setTimeout(r,ms))}
const VAREX_PERMISSION_MAP={"index.html":"dashboard","pos.html":"pos","products.html":"products","purchases.html":"products","transfers.html":"products","customers.html":"customers","suppliers.html":"suppliers","accounts.html":"accounts","expenses.html":"accounts","shifts.html":"pos","employees.html":"employees","branches.html":"settings","reports.html":"reports","notifications.html":"dashboard","activity.html":"users","users.html":"users","subscription.html":"__owner__","setting.html":"settings"};
const VAREX_MENU=[["index.html","▦","لوحة التحكم"],["pos.html","🛒","شاشة المبيعات"],["products.html","📦","المنتجات والمخزون"],["purchases.html","🧾","المشتريات"],["transfers.html","🔄","تحويلات المخزون"],["customers.html","👥","العملاء"],["suppliers.html","🚚","الموردون"],["accounts.html","💰","الحسابات"],["expenses.html","💸","المصروفات"],["shifts.html","🕘","ورديات الكاشير"],["employees.html","👤","الموظفون"],["branches.html","🏢","الفروع"],["reports.html","📊","التقارير"],["notifications.html","🔔","مركز التنبيهات"],["activity.html","📋","سجل النشاط"],["users.html","🔐","المستخدمون والصلاحيات"],["subscription.html","💎","الاشتراك والترخيص"],["setting.html","⚙️","الإعدادات"]];

const VAREX_COLORS={
light:{primary:"#172554",primary2:"#213765",dark:"#0f1d43",bg:"#f4f6fb",card:"#ffffff",card2:"#f8fafc",card3:"#eef2f7",field:"#ffffff",border:"#e5eaf2",line:"#edf0f5",text:"#172554",body:"#475569",muted:"#64748b",green:"#16a34a",red:"#dc2626",orange:"#ea580c",blue:"#2563eb"},
dark:{primary:"#172554",primary2:"#213765",dark:"#0f1d43",bg:"#0b1120",card:"#111c33",card2:"#162139",card3:"#1c2945",field:"#17233d",border:"#263550",line:"#263550",text:"#f1f5f9",body:"#cbd5e1",muted:"#94a3b8",green:"#4ade80",red:"#f87171",orange:"#fb923c",blue:"#93c5fd"}
};
window.VAREX_COLORS=VAREX_COLORS;

function varexCurrentFile(){return location.pathname.split("/").pop().toLowerCase()||"index.html"}
function varexCanOpen(file){const u=VAREX.getStaffSession();if(!u)return false;if(u.isOwner)return true;const p=VAREX_PERMISSION_MAP[file];if(!p)return true;if(p==="__owner__")return false;return u.permissions?.includes(p)}
function varexFirstAllowedPage(){for(const[f]of VAREX_MENU)if(varexCanOpen(f))return f;return"index.html"}
function varexCheckCurrentPermission(){const u=VAREX.getStaffSession();if(!u)return false;if(varexCanOpen(varexCurrentFile()))return true;location.replace("./"+varexFirstAllowedPage());return false}

/* ========================== SIDEBAR POSITION ========================== */
const VAREX_SIDEBAR_SCROLL_KEY="varex_sidebar_scroll";

function varexRememberSidebarScroll(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;
sessionStorage.setItem(VAREX_SIDEBAR_SCROLL_KEY,String(nav.scrollTop||0))
}

function varexRestoreSidebarScroll(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;
const y=Number(sessionStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||0);
requestAnimationFrame(()=>requestAnimationFrame(()=>{nav.scrollTop=y}))
}

function varexBindSidebarScroll(){
const nav=document.querySelector(".sidebar .nav");
if(!nav||nav.dataset.varexScrollBound==="1")return;
nav.dataset.varexScrollBound="1";
let timer;
nav.addEventListener("scroll",()=>{
clearTimeout(timer);
timer=setTimeout(varexRememberSidebarScroll,60)
},{passive:true});
nav.addEventListener("click",e=>{
const a=e.target.closest("a[href]");
if(a)varexRememberSidebarScroll()
})
}

window.addEventListener("pagehide",varexRememberSidebarScroll);
window.addEventListener("beforeunload",varexRememberSidebarScroll);

/* ========================== CENTRAL COLORS ========================== */
function varexInstallCentralColors(){
if(document.getElementById("varexCentralColors"))return;
const l=VAREX_COLORS.light,d=VAREX_COLORS.dark,s=document.createElement("style");
s.id="varexCentralColors";
s.textContent=`
:root{
--varex-primary:${l.primary}!important;
--varex-primary-2:${l.primary2}!important;
--varex-dark:${l.dark}!important;
--varex-bg:${l.bg}!important;
--varex-card:${l.card}!important;
--varex-card2:${l.card2}!important;
--varex-card3:${l.card3}!important;
--varex-field:${l.field}!important;
--varex-border:${l.border}!important;
--varex-line:${l.line}!important;
--varex-text:${l.text}!important;
--varex-body:${l.body}!important;
--varex-muted:${l.muted}!important;
--varex-green:${l.green}!important;
--varex-red:${l.red}!important;
--varex-orange:${l.orange}!important;
--varex-blue:${l.blue}!important;

--navy:${l.primary}!important;
--navy2:${l.primary2}!important;
--navy3:${l.primary2}!important;
--navy-dark:${l.dark}!important;
--dark:${l.dark}!important;
--bg:${l.bg}!important;
--card:${l.card}!important;
--card2:${l.card2}!important;
--card3:${l.card3}!important;
--field:${l.field}!important;
--border:${l.border}!important;
--line:${l.line}!important;
--text:${l.text}!important;
--body:${l.body}!important;
--bodytext:${l.body}!important;
--muted:${l.muted}!important;
--green:${l.green}!important;
--red:${l.red}!important;
--orange:${l.orange}!important;
--blue:${l.blue}!important
}

html[data-theme="dark"],html[data-varex-theme="dark"],body.varex-dark{
--varex-primary:${d.primary}!important;
--varex-primary-2:${d.primary2}!important;
--varex-dark:${d.dark}!important;
--varex-bg:${d.bg}!important;
--varex-card:${d.card}!important;
--varex-card2:${d.card2}!important;
--varex-card3:${d.card3}!important;
--varex-field:${d.field}!important;
--varex-border:${d.border}!important;
--varex-line:${d.line}!important;
--varex-text:${d.text}!important;
--varex-body:${d.body}!important;
--varex-muted:${d.muted}!important;
--varex-green:${d.green}!important;
--varex-red:${d.red}!important;
--varex-orange:${d.orange}!important;
--varex-blue:${d.blue}!important;

--navy:${d.primary}!important;
--navy2:${d.primary2}!important;
--navy3:${d.primary2}!important;
--navy-dark:${d.dark}!important;
--dark:${d.dark}!important;
--bg:${d.bg}!important;
--card:${d.card}!important;
--card2:${d.card2}!important;
--card3:${d.card3}!important;
--field:${d.field}!important;
--border:${d.border}!important;
--line:${d.line}!important;
--text:${d.text}!important;
--body:${d.body}!important;
--bodytext:${d.body}!important;
--muted:${d.muted}!important;
--green:${d.green}!important;
--red:${d.red}!important;
--orange:${d.orange}!important;
--blue:${d.blue}!important
}

body{background:var(--varex-bg)!important}
.main{background:var(--varex-bg)!important}
.sidebar{background:linear-gradient(180deg,var(--varex-primary),#13234f 48%,var(--varex-dark))!important}
.hero{background:linear-gradient(135deg,var(--varex-primary),var(--varex-primary-2))!important}
`;
document.head.appendChild(s)
}

/* ========================================================= STAFF ========================================================= */
let varexSelectedStaffId=null,varexStaffLogoutRunning=false;

function varexInstallStaffUI(){
if(document.getElementById("varexStaffOverlay"))return;
const o=document.createElement("div");
o.id="varexStaffOverlay";
o.className="varex-staff-overlay";
o.innerHTML=`<div class="varex-staff-card"><div class="varex-staff-brand">VAREX</div><h2>من سيستخدم النظام؟</h2><p class="varex-staff-sub">اختر حسابك ثم أدخل كلمة المرور.</p><div class="varex-staff-list" id="varexStaffList"></div><div class="varex-staff-password" id="varexStaffPasswordBox"><div class="varex-selected-user" id="varexSelectedStaff">—</div><input id="varexStaffPassword" type="password" autocomplete="current-password" placeholder="كلمة المرور"><div class="varex-staff-error" id="varexStaffError"></div><div class="varex-staff-login-actions"><button id="varexStaffLoginBtn">دخول إلى VAREX</button><button id="varexStaffBackBtn">رجوع</button></div></div></div>`;
document.body.appendChild(o);
document.getElementById("varexStaffBackBtn").onclick=()=>{varexSelectedStaffId=null;document.getElementById("varexStaffPasswordBox").classList.remove("show");document.getElementById("varexStaffPassword").value="";document.getElementById("varexStaffError").textContent=""};
document.getElementById("varexStaffLoginBtn").onclick=varexLoginSelectedStaff;
document.getElementById("varexStaffPassword").addEventListener("keydown",e=>{if(e.key==="Enter")varexLoginSelectedStaff()})
}

function varexRenderStaffUsers(){
varexInstallStaffUI();
const list=document.getElementById("varexStaffList"),owner=VAREX.getOwnerOperator(),users=VAREX.getActiveStaffUsers();
list.innerHTML=`<button class="varex-staff-user owner" onclick="varexSelectStaff('__owner__')"><span class="varex-staff-avatar">👑</span><span><strong>${varexEsc(owner.name)}</strong><small>المالك / Owner</small></span></button>`+users.map(u=>`<button class="varex-staff-user" onclick="varexSelectStaff('${varexEscAttr(u.id)}')"><span class="varex-staff-avatar">${u.role==="cashier"?"🛒":u.role==="accountant"?"💰":u.role==="manager"?"👔":"👤"}</span><span><strong>${varexEsc(u.name||u.username||"المستخدم")}</strong><small>${VAREX.roleName(u.role)}</small></span></button>`).join("")
}

function varexOpenStaffGate(){
varexRenderStaffUsers();
document.getElementById("varexStaffPasswordBox")?.classList.remove("show");
const pass=document.getElementById("varexStaffPassword"),err=document.getElementById("varexStaffError"),btn=document.getElementById("varexStaffLoginBtn");
if(pass)pass.value="";
if(err)err.textContent="";
if(btn){btn.disabled=false;btn.classList.remove("varex-login-processing","varex-login-success");btn.textContent="دخول إلى VAREX"}
varexSelectedStaffId=null;
document.getElementById("varexStaffOverlay")?.classList.remove("varex-login-leaving");
document.getElementById("varexStaffOverlay")?.classList.add("show");
document.body.style.overflow="hidden"
}

function varexCloseStaffGate(){document.getElementById("varexStaffOverlay")?.classList.remove("show");document.body.style.overflow=""}

function varexSelectStaff(id){
varexSelectedStaffId=id;
const u=id==="__owner__"?VAREX.getOwnerOperator():VAREX.getStaffUsers().find(x=>String(x.id)===String(id));
if(!u||u.status==="disabled")return;
document.getElementById("varexSelectedStaff").textContent=`${u.name||"المستخدم"} — ${VAREX.roleName(u.role)}`;
document.getElementById("varexStaffPassword").value="";
document.getElementById("varexStaffError").textContent="";
document.getElementById("varexStaffPasswordBox").classList.add("show");
setTimeout(()=>document.getElementById("varexStaffPassword")?.focus(),120)
}

async function varexLoginSelectedStaff(){
const pass=document.getElementById("varexStaffPassword").value,err=document.getElementById("varexStaffError"),btn=document.getElementById("varexStaffLoginBtn");
if(!pass){err.textContent="أدخل كلمة المرور.";return}
if(btn.disabled)return;
err.textContent="";
btn.disabled=true;
btn.classList.add("varex-login-processing");
btn.innerHTML=`<span class="varex-mini-spinner"></span><span>جاري تسجيل الدخول...</span>`;
await varexWait(500);
let result;
if(varexSelectedStaffId==="__owner__"){
result=await VAREX.verifyOwnerPassword(pass);
if(result.success)VAREX.setStaffSession(VAREX.getOwnerOperator())
}else{
const u=VAREX.getStaffUsers().find(x=>String(x.id)===String(varexSelectedStaffId));
if(!u)return;
result=await VAREX.verifyStaffPassword(u,pass);
if(result.success)VAREX.setStaffSession(u)
}
if(!result?.success){
btn.disabled=false;
btn.classList.remove("varex-login-processing");
btn.textContent="دخول إلى VAREX";
err.textContent=result?.message||"تعذر تسجيل الدخول.";
return
}
btn.classList.remove("varex-login-processing");
btn.classList.add("varex-login-success");
btn.innerHTML="<span>✓</span><span>تم تسجيل الدخول بنجاح</span>";
await varexWait(700);
varexCloseStaffGate();
btn.disabled=false;
btn.textContent="دخول إلى VAREX";
varexBuildMenu();
varexInstallTopSwitchUserButton();
varexShowCurrentUser();
varexRestoreSidebarScroll();
varexCheckCurrentPermission()
}

function varexSwitchUser(){VAREX.clearStaffSession();varexOpenStaffGate()}
function varexLogoutCurrentUser(){VAREX.clearStaffSession();varexOpenStaffGate()}
window.varexSwitchUser=varexSwitchUser;
window.varexLogoutCurrentUser=varexLogoutCurrentUser;

function varexInitStaffAccess(){
const session=VAREX.getStaffSession(),users=VAREX.getActiveStaffUsers();
if(session){
if(session.isOwner)return varexCheckCurrentPermission();
const fresh=users.find(x=>String(x.id)===String(session.id));
if(!fresh){VAREX.clearStaffSession();varexOpenStaffGate();return false}
session.permissions=Array.isArray(fresh.permissions)?fresh.permissions:[];
session.role=fresh.role;
session.name=fresh.name;
VAREX.setStaffSession(session);
return varexCheckCurrentPermission()
}
varexOpenStaffGate();
return false
}

/* ========================================================= MENU ========================================================= */
function varexBuildMenu(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;
const oldScroll=nav.scrollTop||Number(sessionStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||0);
const current=varexCurrentFile(),operator=VAREX.getStaffSession();
nav.innerHTML=VAREX_MENU.filter(([file])=>!operator||varexCanOpen(file)).map(([file,icon,title])=>`<a href="./${file}" class="${current===file?"active":""}"><span class="nav-icon">${icon}</span><span class="nav-label">${title}</span></a>`).join("");
varexAddSidebarActions();
varexBindSidebarScroll();
requestAnimationFrame(()=>{nav.scrollTop=oldScroll})
}

function varexAddSidebarActions(){
const nav=document.querySelector(".sidebar .nav");
if(!nav||nav.querySelector(".varex-sidebar-actions"))return;
const box=document.createElement("div");
box.className="varex-sidebar-actions";
box.innerHTML=`<button type="button" id="varexThemeButton"><span class="nav-icon" id="varexThemeIcon">🌙</span><span id="varexThemeText">الوضع الليلي</span></button><button type="button" id="varexStaffLogoutButton"><span class="nav-icon">👤</span><span>تسجيل خروج المستخدم</span></button><button type="button" id="varexLogoutButton"><span class="varex-power-icon">⏻</span><span>تسجيل خروج المنشأة</span></button><div class="varex-sidebar-bottom-space"></div>`;
nav.appendChild(box);
varexInstallSharedStyles();
document.getElementById("varexThemeButton").onclick=varexToggleTheme;
document.getElementById("varexStaffLogoutButton").onclick=varexLogoutCurrentUser;
document.getElementById("varexLogoutButton").onclick=()=>VAREX.logout(true);
varexUpdateThemeButton()
}

function varexInstallTopSwitchUserButton(){
document.querySelectorAll(".top-info").forEach(top=>{
if(top.querySelector(".varex-top-switch-user"))return;
const btn=document.createElement("button");
btn.type="button";
btn.className="info-chip varex-top-switch-user";
btn.innerHTML="<span>👥</span><strong>تبديل المستخدم</strong>";
btn.onclick=e=>{e.preventDefault();varexSwitchUser()};
top.insertBefore(btn,top.firstChild)
})
}

/* ========================================================= THEME ========================================================= */
function varexResolveThemeMode(){
const m=localStorage.getItem("varexThemeMode");
if(m==="dark"||m==="light")return m;
if(m==="system")return matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";
return localStorage.getItem("varex_theme")||"light"
}
function varexGetTheme(){return varexResolveThemeMode()}
function varexApplyTheme(t){
document.documentElement.setAttribute("data-theme",t);
document.documentElement.setAttribute("data-varex-theme",t);
document.body?.classList.toggle("varex-dark",t==="dark");
localStorage.setItem("varex_theme",t);
varexUpdateThemeButton()
}
function varexToggleTheme(){
const n=varexGetTheme()==="dark"?"light":"dark";
localStorage.setItem("varexThemeMode",n);
varexApplyTheme(n)
}
function varexUpdateThemeButton(){
const d=varexGetTheme()==="dark",i=document.getElementById("varexThemeIcon"),t=document.getElementById("varexThemeText");
if(i)i.textContent=d?"☀️":"🌙";
if(t)t.textContent=d?"الوضع النهاري":"الوضع الليلي"
}

/* ========================================================= CURRENT USER ========================================================= */
function varexShowCurrentUser(){
const u=VAREX.getStaffSession()||VAREX.getOwnerOperator();
document.querySelectorAll(".info-chip,.chip").forEach(el=>{
if(el.classList.contains("varex-top-switch-user"))return;
if(el.textContent.includes("المستخدم")||el.textContent.includes("الحساب")){
const s=el.querySelector("strong");
if(s)s.textContent=u.name||"المستخدم"
}});
["sidebarUserName","topUserName","settingsUserName","currentUserName","currentUser"].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=u.name||u.username||"المستخدم"})
}

function varexEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function varexEscAttr(v){return varexEsc(v).replace(/`/g,"")}

/* ========================================================= SHARED STYLES ========================================================= */
function varexInstallSharedStyles(){
if(document.getElementById("varexSharedStyles"))return;
const s=document.createElement("style");
s.id="varexSharedStyles";
s.textContent=`
html{
overflow-y:scroll!important;
scrollbar-gutter:stable!important;
overflow-x:hidden!important
}
body{
overflow-x:hidden!important;
min-width:0!important
}
:root{
--sidebar-width:265px!important
}
.main{
margin-right:var(--sidebar-width)!important;
padding-bottom:180px!important;
min-width:0!important;
transition:none!important
}
.sidebar{
position:fixed!important;
top:0!important;
right:0!important;
bottom:0!important;
width:var(--sidebar-width)!important;
height:100dvh!important;
overflow:hidden!important;
z-index:1000!important;
display:flex!important;
flex-direction:column!important;
transition:none!important;
contain:layout paint!important
}
.sidebar .brand{
flex:0 0 auto!important
}
.sidebar .sidebar-footer{
flex:0 0 auto!important
}
.sidebar .nav{
width:100%!important;
flex:1 1 auto!important;
min-height:0!important;
padding:16px 14px 0!important;
overflow-y:auto!important;
overflow-x:hidden!important;
overscroll-behavior:contain!important;
scroll-behavior:auto!important;
scrollbar-gutter:stable!important;
transition:none!important;
contain:layout style!important
}
.sidebar .nav a,
.varex-sidebar-actions button{
width:100%!important;
height:50px!important;
min-height:50px!important;
max-height:50px!important;
display:flex!important;
align-items:center!important;
gap:12px!important;
padding:0 15px!important;
margin:0 0 8px 0!important;
border-radius:11px!important;
font-weight:700!important;
transform:none!important;
transition:background-color .12s ease,color .12s ease,border-color .12s ease!important;
will-change:auto!important
}
.sidebar .nav a{
background:rgba(255,255,255,.055)!important;
color:#dbeafe!important;
text-decoration:none!important;
border-bottom:3px solid rgba(5,14,37,.44)!important
}
.sidebar .nav a:hover{
transform:none!important;
background:rgba(255,255,255,.10)!important
}
.sidebar .nav a:active{
transform:none!important
}
.sidebar .nav a.active{
background:#fff!important;
color:var(--varex-primary)!important;
border-bottom-color:#94a3b8!important;
transform:none!important
}
.varex-sidebar-actions{
margin-top:18px!important;
padding-top:15px!important;
border-top:1px solid rgba(255,255,255,.12)!important
}
.varex-sidebar-actions button{
background:#fff!important;
color:var(--varex-primary)!important;
border:1px solid #fff!important;
border-bottom:3px solid #94a3b8!important;
cursor:pointer!important
}
.varex-sidebar-actions button:hover,
.varex-sidebar-actions button:active{
transform:none!important
}
.varex-sidebar-bottom-space{
height:180px!important;
min-height:180px!important
}
.varex-top-switch-user{
border:1px solid var(--varex-primary)!important;
cursor:pointer!important
}
.topbar,
.hero,
.panel,
.stat,
.card,
.content,
.page-name,
.top-info,
.info-chip,
.chip{
will-change:auto!important
}
.topbar,
.hero,
.panel,
.stat,
.card{
transition:background-color .15s ease,color .15s ease,border-color .15s ease!important
}
.info-chip,
.chip,
.varex-top-switch-user{
transform:none!important
}
.info-chip:hover,
.info-chip:active,
.chip:hover,
.chip:active,
.varex-top-switch-user:hover,
.varex-top-switch-user:active{
transform:none!important
}
.varex-staff-overlay{
position:fixed;
inset:0;
z-index:9999999;
background:rgba(3,10,28,.84);
backdrop-filter:blur(12px);
display:flex;
align-items:center;
justify-content:center;
padding:20px;
opacity:0;
visibility:hidden;
pointer-events:none
}
.varex-staff-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}
.varex-staff-card{
width:min(560px,96vw);
max-height:88vh;
overflow-y:auto;
background:#fff;
border-radius:26px;
padding:30px;
text-align:center;
box-shadow:0 35px 100px rgba(0,0,0,.45)
}
.varex-staff-brand{
font-size:32px;
font-weight:900;
letter-spacing:6px;
color:var(--varex-primary);
margin-bottom:14px
}
.varex-staff-card h2{
font-size:22px;
color:var(--varex-primary)
}
.varex-staff-sub{
font-size:12px;
color:#64748b;
margin:7px 0 20px
}
.varex-staff-list{
display:grid;
gap:10px
}
.varex-staff-user{
width:100%;
min-height:67px;
border:1px solid #e2e8f0;
border-radius:14px;
background:#f8fafc;
display:flex;
align-items:center;
gap:13px;
padding:10px 14px;
text-align:right;
cursor:pointer;
transform:none!important
}
.varex-staff-user.owner{
background:#eef2ff
}
.varex-staff-avatar{
width:43px;
height:43px;
border-radius:12px;
background:var(--varex-primary);
color:#fff;
display:flex;
align-items:center;
justify-content:center;
font-size:20px
}
.varex-staff-user strong{
display:block;
color:var(--varex-primary);
font-size:13px
}
.varex-staff-user small{
display:block;
color:#64748b;
margin-top:3px
}
.varex-staff-password{
display:none;
margin-top:18px;
padding-top:18px;
border-top:1px solid #e2e8f0
}
.varex-staff-password.show{
display:block
}
.varex-selected-user{
font-weight:800;
color:var(--varex-primary);
margin-bottom:10px
}
.varex-staff-password input{
width:100%;
height:46px;
border:1px solid #cbd5e1;
border-radius:10px;
padding:0 12px
}
.varex-staff-error{
min-height:20px;
color:#b91c1c;
font-size:11px;
margin-top:7px
}
.varex-staff-login-actions{
display:flex;
gap:9px;
margin-top:10px
}
.varex-staff-login-actions button{
flex:1;
height:43px;
border-radius:9px;
font-weight:800;
cursor:pointer
}
.varex-staff-login-actions button:first-child{
background:var(--varex-primary);
color:#fff;
border:0
}
.varex-staff-login-actions button:last-child{
background:#f1f5f9;
color:var(--varex-primary);
border:1px solid #cbd5e1
}
.varex-mini-spinner{
width:16px;
height:16px;
border-radius:50%;
border:2px solid rgba(255,255,255,.38);
border-top-color:#fff;
display:inline-block;
animation:varexMiniSpinner .75s linear infinite
}
@keyframes varexMiniSpinner{to{transform:rotate(360deg)}}
body.varex-dark .varex-staff-card{
background:#132641;
color:#fff
}
body.varex-dark .varex-staff-card h2,
body.varex-dark .varex-staff-brand,
body.varex-dark .varex-selected-user{
color:#fff
}
body.varex-dark .varex-staff-user{
background:#10233d;
border-color:#29415f
}
body.varex-dark .varex-staff-user strong{
color:#fff
}
body.varex-dark .varex-staff-user small{
color:#cbd5e1
}
@media(max-width:750px){
.varex-top-switch-user{display:none!important}
}
@media(max-width:600px){
.varex-staff-card{padding:23px 17px}
.varex-staff-login-actions{flex-direction:column}
}
`;
document.head.appendChild(s)
}

/* ========================================================= START ========================================================= */
function varexStartUI(){
const publicPage=VAREX.isLoginPage()||VAREX.isRegisterPage()||VAREX.isVerifyEmailPage()||VAREX.isResetPasswordPage();
if(publicPage)return;
if(!VAREX.requireLogin())return;
if(!VAREX.requireSubscription())return;

varexInstallCentralColors();
varexInstallSharedStyles();
varexInstallStaffUI();
varexApplyTheme(varexGetTheme());

varexInitStaffAccess();
varexBuildMenu();
varexInstallTopSwitchUserButton();
varexShowCurrentUser();
varexBindSidebarScroll();
varexRestoreSidebarScroll()
}

window.addEventListener("focus",()=>{
varexApplyTheme(varexGetTheme());
varexInstallTopSwitchUserButton();
varexShowCurrentUser()
});

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",varexStartUI);
else varexStartUI();
