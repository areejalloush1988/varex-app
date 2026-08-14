/* VAREX CORE — SUPABASE AUTH + EMAIL OTP + LOCAL BUSINESS DATA */
const VAREX={
config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},
keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification"},

getData(k){try{const x=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(x)?x:[]}catch(e){console.error(e);return[]}},
saveData(k,d){try{localStorage.setItem(k,JSON.stringify(Array.isArray(d)?d:[]));return true}catch(e){console.error(e);return false}},
getObject(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...f,...x}:{...f}}catch(e){return{...f}}},
saveObject(k,d){try{localStorage.setItem(k,JSON.stringify(d||{}));return true}catch(e){console.error(e);return false}},
generateId(p="VRX"){return`${p}-${Date.now()}-${Math.floor(Math.random()*1e6)}`},
toNumber(v,f=0){v=Number(v);return Number.isFinite(v)?v:f},
positiveNumber(v){return Math.max(0,this.toNumber(v))},
cleanText(v){return String(v??"").trim()},
now(){return new Date().toISOString()},
today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},
normalizeDate(v){if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},
normalizeEmail(v){return this.cleanText(v).toLowerCase()},
normalizeUsername(v){return this.cleanText(v).toLowerCase()},

async authFetch(path,opt={}){
const h={apikey:this.config.supabaseKey,"Content-Type":"application/json",...(opt.headers||{})};
const s=this.getSession();
if(s?.access_token)h.Authorization=`Bearer ${s.access_token}`;
const r=await fetch(this.config.supabaseUrl+path,{...opt,headers:h});
let data={};try{data=await r.json()}catch(e){}
if(!r.ok){
const err=new Error(data.msg||data.message||data.error_description||data.error||"تعذر الاتصال بخدمة الحسابات.");
err.status=r.status;err.data=data;throw err
}
return data
},

mapAuthError(e){
const m=String(e?.message||"").toLowerCase();
if(m.includes("already registered")||m.includes("already been registered")||m.includes("user already registered"))return"البريد الإلكتروني مستخدم بالفعل.";
if(m.includes("invalid login credentials"))return"البريد الإلكتروني أو كلمة المرور غير صحيحة.";
if(m.includes("email not confirmed"))return"البريد الإلكتروني غير مؤكد. يرجى إدخال رمز التحقق المرسل إلى بريدك.";
if(m.includes("token has expired")||m.includes("otp expired"))return"انتهت صلاحية رمز التحقق. اضغط إعادة إرسال الرمز.";
if(m.includes("invalid token")||m.includes("invalid otp")||m.includes("token is invalid"))return"رمز التحقق غير صحيح.";
if(m.includes("password")&&m.includes("6"))return"كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل.";
if(m.includes("rate limit")||m.includes("too many requests"))return"تم إجراء محاولات كثيرة. يرجى الانتظار قليلاً.";
return e?.message||"حدث خطأ في خدمة الحسابات."
},

getSafeUser(u){
if(!u)return null;
const md=u.user_metadata||{};
return{id:u.id,name:md.name||md.full_name||u.name||"المستخدم",username:md.username||u.username||"",email:u.email||"",role:md.role||u.role||"مستخدم",status:"نشط",createdAt:u.created_at||u.createdAt||"",lastLogin:u.last_sign_in_at||u.lastLogin||""}
},

setPendingVerification(data={}){
const x={email:this.normalizeEmail(data.email),name:this.cleanText(data.name),username:this.normalizeUsername(data.username),createdAt:this.now()};
try{localStorage.setItem(this.keys.pendingVerification,JSON.stringify(x));return x}catch(e){return null}
},
getPendingVerification(){try{const x=JSON.parse(localStorage.getItem(this.keys.pendingVerification)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}},
clearPendingVerification(){try{localStorage.removeItem(this.keys.pendingVerification)}catch(e){}},

async createUser(user={}){
const name=this.cleanText(user.name),username=this.normalizeUsername(user.username),email=this.normalizeEmail(user.email),password=String(user.password||"");
if(!name)return{success:false,message:"الاسم الكامل مطلوب."};
if(username.length<3)return{success:false,message:"اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."};
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{success:false,message:"يرجى إدخال بريد إلكتروني صحيح."};
if(password.length<6)return{success:false,message:"كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل."};
try{
const d=await this.authFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{name,full_name:name,username,role:"مستخدم"}})});
this.setPendingVerification({email,name,username});
if(d?.session?.access_token){this.storeSession(d.session,false);return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:false,message:"تم إنشاء الحساب وتأكيد البريد الإلكتروني."}}
return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:true,email,message:"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async verifyEmailOtp(email,token){
const mail=this.normalizeEmail(email),code=this.cleanText(token).replace(/\s+/g,"");
if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
if(!code)return{success:false,message:"يرجى إدخال رمز التحقق."};
try{
const d=await this.authFetch("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"signup",email:mail,token:code})});
if(!d?.user)return{success:false,message:"تعذر تأكيد البريد الإلكتروني."};
if(d?.access_token)this.storeSession({access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in,expires_at:d.expires_at,token_type:d.token_type,user:d.user},false);
this.clearPendingVerification();
sessionStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");localStorage.removeItem("varex_authenticated");
return{success:true,user:this.getSafeUser(d.user),message:"تم تأكيد البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async resendConfirmation(email){
const mail=this.normalizeEmail(email);
if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
try{await this.authFetch("/auth/v1/resend",{method:"POST",body:JSON.stringify({type:"signup",email:mail})});return{success:true,message:"تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني."}}
catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async login(login,password,remember=false){
const identifier=this.cleanText(login),pw=String(password||"");
if(!identifier||!pw)return{success:false,message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."};
if(!identifier.includes("@"))return{success:false,message:"حالياً سجّل الدخول بالبريد الإلكتروني."};
try{
const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:this.normalizeEmail(identifier),password:pw})});
if(!d.access_token||!d.user)return{success:false,message:"تعذر إنشاء جلسة المستخدم."};
this.storeSession(d,remember);localStorage.setItem(this.keys.rememberedUser,remember?identifier:"");this.clearPendingVerification();
return{success:true,user:this.getSafeUser(d.user)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

storeSession(s,remember=false){
const x={access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),token_type:s.token_type||"bearer",user:s.user,remember:Boolean(remember)};
const str=JSON.stringify(x);
if(remember){localStorage.setItem(this.keys.session,str);sessionStorage.removeItem(this.keys.session)}
else{sessionStorage.setItem(this.keys.session,str);localStorage.removeItem(this.keys.session)}
localStorage.setItem(this.keys.cachedUser,JSON.stringify(this.getSafeUser(s.user)));return x
},

getSession(){const raw=sessionStorage.getItem(this.keys.session)||localStorage.getItem(this.keys.session);if(!raw)return null;try{const s=JSON.parse(raw);return s?.access_token&&s?.user?s:null}catch(e){return null}},
isLoggedIn(){return!!this.getSession()},
getCurrentUser(){const s=this.getSession();if(s?.user)return this.getSafeUser(s.user);try{return JSON.parse(localStorage.getItem(this.keys.cachedUser)||"null")}catch(e){return null}},
getRememberedUser(){return localStorage.getItem(this.keys.rememberedUser)||""},

async refreshSession(){
const s=this.getSession();if(!s?.refresh_token)return false;
if((s.expires_at||0)>Math.floor(Date.now()/1000)+60)return true;
try{const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});this.storeSession(d,s.remember);return true}
catch(e){this.logout(false);return false}
},

async logout(redirect=true){
const s=this.getSession();
try{if(s?.access_token)await this.authFetch("/auth/v1/logout",{method:"POST"})}catch(e){}
sessionStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");localStorage.removeItem("varex_authenticated");
if(redirect)location.replace("./login.html");return true
},

requireLogin(){
if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage())return true;
if(!this.isLoggedIn()){location.replace("./login.html");return false}
this.refreshSession();return true
},
isLoginPage(){return location.pathname.toLowerCase().endsWith("login.html")},
isRegisterPage(){return location.pathname.toLowerCase().endsWith("register.html")},
isVerifyEmailPage(){return location.pathname.toLowerCase().endsWith("verify-email.html")},
redirectLoggedUser(){if((this.isLoginPage()||this.isRegisterPage())&&this.isLoggedIn()){location.replace("./index.html");return true}return false},

async requestPasswordReset(email){
const mail=this.normalizeEmail(email);if(!mail)return{success:false,message:"يرجى إدخال البريد الإلكتروني."};
try{await this.authFetch("/auth/v1/recover",{method:"POST",body:JSON.stringify({email:mail})});return{success:true,message:"تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."}}
catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async updateCurrentUser(changes={}){
const s=this.getSession();if(!s)return{success:false,message:"لا يوجد مستخدم مسجل الدخول."};
const body={};if(changes.email!==undefined)body.email=this.normalizeEmail(changes.email);
const data={};["name","username","role"].forEach(k=>{if(changes[k]!==undefined)data[k]=this.cleanText(changes[k])});
if(Object.keys(data).length)body.data={...(s.user.user_metadata||{}),...data};
try{const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify(body)});s.user=u;this.storeSession(s,s.remember);return{success:true,user:this.getSafeUser(u)}}
catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async changePassword(currentPassword,newPassword){
if(String(newPassword||"").length<6)return{success:false,message:"كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."};
const s=this.getSession();if(!s)return{success:false,message:"يجب تسجيل الدخول أولاً."};
try{const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:String(newPassword)})});s.user=u;this.storeSession(s,s.remember);return{success:true,message:"تم تغيير كلمة المرور بنجاح."}}
catch(e){return{success:false,message:this.mapAuthError(e)}}
},

getProducts(){return this.getData(this.keys.products)},saveProducts(x){return this.saveData(this.keys.products,x)},
getProductById(id){return this.getProducts().find(x=>String(x.id)===String(id))||null},
findProductByBarcode(b){b=this.cleanText(b);return this.getProducts().find(x=>this.cleanText(x.barcode)===b)||null},

addProduct(p={}){
const a=this.getProducts(),x={...p,id:p.id||this.generateId("PRD"),name:this.cleanText(p.name||p.productName),quantity:this.positiveNumber(p.quantity),price:this.positiveNumber(p.price||p.salePrice),cost:this.positiveNumber(p.cost||p.costPrice),createdAt:p.createdAt||this.now(),updatedAt:this.now()};
a.push(x);this.saveProducts(a);return x
},
updateProduct(id,c={}){const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};this.saveProducts(a);return a[i]},
deleteProduct(id){const a=this.getProducts(),b=a.filter(x=>String(x.id)!==String(id));this.saveProducts(b);return b.length!==a.length},
adjustStock(id,n){const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i].quantity=Math.max(0,this.toNumber(a[i].quantity)+this.toNumber(n));a[i].updatedAt=this.now();this.saveProducts(a);return a[i]},

getSales(){return this.getData(this.keys.sales)},saveSales(x){return this.saveData(this.keys.sales,x)},
getSaleById(id){return this.getSales().find(x=>String(x.id)===String(id))||null},
addSale(s={}){const a=this.getSales(),x={...s,id:s.id||this.generateId("SAL"),invoiceNumber:s.invoiceNumber||`INV-${Date.now()}`,createdAt:s.createdAt||this.now(),date:s.date||this.now(),updatedAt:this.now()};a.push(x);this.saveSales(a);return x},
deleteSale(id){const a=this.getSales(),b=a.filter(x=>String(x.id)!==String(id));this.saveSales(b);return b.length!==a.length},

completeSale(s={}){
const items=Array.isArray(s.items)?s.items:[];if(!items.length)return{success:false,message:"لا توجد منتجات في الفاتورة."};
const p=this.getProducts();
for(const x of items){const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);if(i>=0&&q>this.toNumber(p[i].quantity))return{success:false,message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")}}
for(const x of items){const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);if(i>=0){p[i].quantity=Math.max(0,this.toNumber(p[i].quantity)-q);p[i].updatedAt=this.now()}}
this.saveProducts(p);return{success:true,sale:this.addSale(s)}
},

getCustomers(){return this.getData(this.keys.customers)},saveCustomers(x){return this.saveData(this.keys.customers,x)},addCustomer(x={}){return this._add(this.keys.customers,"CUS",x)},updateCustomer(id,c={}){return this._update(this.keys.customers,id,c)},deleteCustomer(id){return this._delete(this.keys.customers,id)},
getSuppliers(){return this.getData(this.keys.suppliers)},saveSuppliers(x){return this.saveData(this.keys.suppliers,x)},addSupplier(x={}){return this._add(this.keys.suppliers,"SUP",x)},updateSupplier(id,c={}){return this._update(this.keys.suppliers,id,c)},deleteSupplier(id){return this._delete(this.keys.suppliers,id)},
getEmployees(){return this.getData(this.keys.employees)},saveEmployees(x){return this.saveData(this.keys.employees,x)},addEmployee(x={}){return this._add(this.keys.employees,"EMP",x)},updateEmployee(id,c={}){return this._update(this.keys.employees,id,c)},deleteEmployee(id){return this._delete(this.keys.employees,id)},
getTransactions(){return this.getData(this.keys.transactions)},saveTransactions(x){return this.saveData(this.keys.transactions,x)},
addTransaction(x={}){x={...x,amount:this.positiveNumber(x.amount),date:x.date||this.today()};return this._add(this.keys.transactions,"TRX",x)},
updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},deleteTransaction(id){return this._delete(this.keys.transactions,id)},
getHeldSales(){return this.getData(this.keys.heldSales)},saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},removeHeldSale(id){return this._delete(this.keys.heldSales,id)},getHeldSaleById(id){return this.getHeldSales().find(x=>String(x.id)===String(id))||null},

_add(k,p,x={}){const a=this.getData(k),o={...x,id:x.id||this.generateId(p),createdAt:x.createdAt||this.now(),updatedAt:this.now()};a.push(o);this.saveData(k,a);return o},
_update(k,id,c={}){const a=this.getData(k),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};this.saveData(k,a);return a[i]},
_delete(k,id){const a=this.getData(k),b=a.filter(x=>String(x.id)!==String(id));this.saveData(k,b);return b.length!==a.length},

getSettings(){
const d={businessName:"VAREX",currency:"AED",currencySymbol:"د.إ",taxEnabled:true,taxRate:5,lowStockLimit:5,language:"ar"};
const p=this.getObject(this.keys.settings,{});let l={};
try{const x=JSON.parse(localStorage.getItem("varexSettings")||"null");if(x&&typeof x==="object"&&!Array.isArray(x))l=x}catch(e){}
return{...d,...l,...p}
},

saveSettings(s={}){
const d={...this.getSettings(),...s,updatedAt:this.now()},ok=this.saveObject(this.keys.settings,d);
try{localStorage.setItem("varexSettings",JSON.stringify(d))}catch(e){}
return ok
},

money(v){const s=this.getSettings(),sym=this.cleanText(s.currencySymbol)||(s.currency==="AED"?"د.إ":s.currency);return`${this.toNumber(v).toFixed(2)} ${sym}`},
calculateTax(v){const s=this.getSettings();return s.taxEnabled===false?0:this.positiveNumber(v)*this.toNumber(s.taxRate,5)/100},
getTodaySales(){const t=this.today();return this.getSales().filter(s=>this.normalizeDate(s.createdAt||s.date||s.saleDate||s.invoiceDate||"")===t)},
getTodaySalesTotal(){return this.getTodaySales().reduce((a,s)=>a+this.toNumber(s.total??s.grandTotal??s.finalTotal??s.netTotal??s.amount??0),0)},
getStockAlerts(){const l=this.toNumber(this.getSettings().lowStockLimit,5);return this.getProducts().filter(p=>this.toNumber(p.quantity)<=this.toNumber(p.minimumStock,l))},

initialize(){
[this.keys.products,this.keys.sales,this.keys.customers,this.keys.suppliers,this.keys.employees,this.keys.transactions,this.keys.heldSales].forEach(k=>{if(localStorage.getItem(k)===null)localStorage.setItem(k,"[]")});
if(localStorage.getItem(this.keys.settings)===null)this.saveSettings(this.getSettings());
return true
}
};

VAREX.initialize();
window.VAREX=VAREX;


/* =========================================================
   VAREX UNIFIED SIDEBAR
========================================================= */

const VAREX_MENU=[
["index.html","▦","لوحة التحكم"],
["pos.html","🛒","شاشة المبيعات"],
["products.html","📦","المنتجات والمخزون"],
["purchases.html","🧾","المشتريات"],
["transfers.html","🔄","تحويلات المخزون"],
["customers.html","👥","العملاء"],
["suppliers.html","🚚","الموردون"],
["accounts.html","💰","الحسابات"],
["expenses.html","💸","المصروفات"],
["shifts.html","🕘","ورديات الكاشير"],
["employees.html","👤","الموظفون"],
["branches.html","🏢","الفروع"],
["reports.html","📊","التقارير"],
["notifications.html","🔔","مركز التنبيهات"],
["activity.html","📋","سجل النشاط"],
["users.html","🔐","المستخدمون والصلاحيات"],
["setting.html","⚙️","الإعدادات"]
];

function varexBuildMenu(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;

let current=(location.pathname.split("/").pop()||"index.html").toLowerCase();
if(current==="")current="index.html";

nav.innerHTML=VAREX_MENU.map(item=>{
const [file,icon,title]=item;
const active=current===file.toLowerCase()?" active":"";
return `<a href="./${file}" class="${active.trim()}">
<span class="nav-icon">${icon}</span>
<span>${title}</span>
</a>`;
}).join("");

varexAddSidebarActions();
}

function varexAddSidebarActions(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;

const box=document.createElement("div");
box.className="varex-sidebar-actions";

box.innerHTML=`
<button type="button" class="varex-theme-button" id="varexThemeButton">
<span class="nav-icon" id="varexThemeIcon">🌙</span>
<span id="varexThemeText">الوضع الليلي</span>
</button>

<button type="button" class="varex-logout-button" id="varexLogoutButton">
<span class="nav-icon">⏻</span>
<span>تسجيل الخروج</span>
</button>
`;

nav.appendChild(box);

const style=document.createElement("style");
style.textContent=`
.varex-sidebar-actions{
margin-top:15px;
padding-top:14px;
border-top:1px solid rgba(255,255,255,.12)
}
.varex-sidebar-actions button{
width:100%;
height:48px;
display:flex;
align-items:center;
justify-content:flex-start;
gap:11px;
padding:0 14px;
margin:0 0 5px;
border:0;
border-radius:10px;
font-family:inherit;
font-size:13px;
font-weight:600;
cursor:pointer;
white-space:nowrap
}
.varex-theme-button{
background:rgba(255,255,255,.08);
color:#dbeafe
}
.varex-theme-button:hover{
background:rgba(255,255,255,.14);
color:#fff
}
.varex-logout-button{
background:rgba(220,38,38,.13);
color:#fecaca
}
.varex-logout-button:hover{
background:#dc2626;
color:#fff
}
`;
document.head.appendChild(style);

document.getElementById("varexThemeButton")?.addEventListener("click",varexToggleTheme);
document.getElementById("varexLogoutButton")?.addEventListener("click",async()=>{
if(confirm("هل تريد تسجيل الخروج من VAREX؟")){
await VAREX.logout(true);
}
});

varexUpdateThemeButton();
}


/* =========================================================
   LIGHT / DARK MODE
========================================================= */

function varexGetTheme(){
const saved=localStorage.getItem("varex_theme");
if(saved==="dark"||saved==="light")return saved;

/* First visit follows device preference */
return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches
?"dark"
:"light";
}

function varexApplyTheme(theme){
document.documentElement.setAttribute("data-varex-theme",theme);
document.body?.classList.toggle("varex-dark",theme==="dark");
localStorage.setItem("varex_theme",theme);
varexInstallDarkStyles();
varexUpdateThemeButton();
}

function varexToggleTheme(){
varexApplyTheme(varexGetTheme()==="dark"?"light":"dark");
}

function varexUpdateThemeButton(){
const dark=varexGetTheme()==="dark";
const icon=document.getElementById("varexThemeIcon");
const text=document.getElementById("varexThemeText");

if(icon)icon.textContent=dark?"☀️":"🌙";
if(text)text.textContent=dark?"الوضع النهاري":"الوضع الليلي";
}

function varexInstallDarkStyles(){
if(document.getElementById("varexDarkStyles"))return;

const style=document.createElement("style");
style.id="varexDarkStyles";

style.textContent=`
body.varex-dark{
background:#0b1220!important;
color:#e5e7eb!important
}

body.varex-dark .main{
background:#0b1220!important
}

body.varex-dark .topbar,
body.varex-dark .panel,
body.varex-dark .stat,
body.varex-dark .modal{
background:#111827!important;
border-color:#263244!important;
color:#e5e7eb!important
}

body.varex-dark .hero h1,
body.varex-dark .page-name h2,
body.varex-dark .panel h2,
body.varex-dark .stat strong,
body.varex-dark label{
color:#f8fafc!important
}

body.varex-dark .hero p,
body.varex-dark .page-name small,
body.varex-dark .stat span{
color:#94a3b8!important
}

body.varex-dark input,
body.varex-dark select,
body.varex-dark textarea,
body.varex-dark .chip,
body.varex-dark .info-chip,
body.varex-dark .secondary,
body.varex-dark .summary,
body.varex-dark .note,
body.varex-dark .system-info,
body.varex-dark .security-note{
background:#182235!important;
border-color:#334155!important;
color:#e5e7eb!important
}

body.varex-dark th{
background:#182235!important;
color:#cbd5e1!important;
border-color:#334155!important
}

body.varex-dark td{
color:#cbd5e1!important;
border-color:#263244!important
}

body.varex-dark .page-icon{
background:#1e293b!important
}

body.varex-dark .sidebar{
background:linear-gradient(180deg,#ffffff 0%,#f8fafc 48%,#eef2f7 100%)!important;
color:#172554!important
}

body.varex-dark .sidebar .logo{
color:#172554!important
}

body.varex-dark .sidebar .brand-small{
color:#475569!important
}

body.varex-dark .sidebar .system-status{
color:#15803d!important
}

body.varex-dark .sidebar .nav a{
color:#334155!important
}

body.varex-dark .sidebar .nav a:hover{
background:#e2e8f0!important;
color:#172554!important
}

body.varex-dark .sidebar .nav a.active{
background:#172554!important;
color:#fff!important
}

body.varex-dark .sidebar-footer{
color:#64748b!important;
border-color:#dbe1ea!important
}

body.varex-dark .varex-sidebar-actions{
border-color:#dbe1ea!important
}

body.varex-dark .varex-theme-button{
background:#e2e8f0!important;
color:#172554!important
}

body.varex-dark .varex-logout-button{
background:#fee2e2!important;
color:#b91c1c!important
}
`;

document.head.appendChild(style);
}


/* =========================================================
   CURRENT USER IN TOP BAR
========================================================= */

function varexShowCurrentUser(){
const user=VAREX.getCurrentUser();
if(!user)return;

document.querySelectorAll(".info-chip,.chip").forEach(el=>{
if(el.textContent.includes("المستخدم")){
const strong=el.querySelector("strong");
if(strong)strong.textContent=user.name||user.username||"المستخدم";
}
});
}


/* =========================================================
   START SHARED UI
========================================================= */

function varexStartUI(){
const publicPage=
VAREX.isLoginPage()||
VAREX.isRegisterPage()||
VAREX.isVerifyEmailPage();

if(publicPage)return;

varexBuildMenu();
varexApplyTheme(varexGetTheme());
varexShowCurrentUser();
}

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",varexStartUI);
}else{
varexStartUI();
}
