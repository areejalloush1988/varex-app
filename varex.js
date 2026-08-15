/* =========================================================
   VAREX CORE
   SUPABASE AUTH + EMAIL OTP + LOCAL BUSINESS DATA
========================================================= */

const VAREX={config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification"},

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
let data={};
try{data=await r.json()}catch(e){}
if(!r.ok){
const err=new Error(data.msg||data.message||data.error_description||data.error||"تعذر الاتصال بخدمة الحسابات.");
err.status=r.status;
err.data=data;
throw err
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
const name=this.cleanText(user.name);
const username=this.normalizeUsername(user.username);
const email=this.normalizeEmail(user.email);
const password=String(user.password||"");
if(!name)return{success:false,message:"الاسم الكامل مطلوب."};
if(username.length<3)return{success:false,message:"اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."};
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{success:false,message:"يرجى إدخال بريد إلكتروني صحيح."};
if(password.length<6)return{success:false,message:"كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل."};

try{
const d=await this.authFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{name,full_name:name,username,role:"مستخدم"}})});
this.setPendingVerification({email,name,username});
if(d?.session?.access_token){
this.storeSession(d.session,false);
return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:false,message:"تم إنشاء الحساب وتأكيد البريد الإلكتروني."}
}
return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:true,email,message:"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async verifyEmailOtp(email,token){
const mail=this.normalizeEmail(email);
const code=this.cleanText(token).replace(/\s+/g,"");
if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
if(!code)return{success:false,message:"يرجى إدخال رمز التحقق."};
try{
const d=await this.authFetch("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"signup",email:mail,token:code})});
if(!d?.user)return{success:false,message:"تعذر تأكيد البريد الإلكتروني."};
if(d?.access_token)this.storeSession({access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in,expires_at:d.expires_at,token_type:d.token_type,user:d.user},false);
this.clearPendingVerification();
sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");
localStorage.removeItem("varex_authenticated");
return{success:true,user:this.getSafeUser(d.user),message:"تم تأكيد البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async resendConfirmation(email){
const mail=this.normalizeEmail(email);
if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
try{
await this.authFetch("/auth/v1/resend",{method:"POST",body:JSON.stringify({type:"signup",email:mail})});
return{success:true,message:"تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async login(login,password,remember=false){
const identifier=this.cleanText(login);
const pw=String(password||"");
if(!identifier||!pw)return{success:false,message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."};
if(!identifier.includes("@"))return{success:false,message:"حالياً سجّل الدخول بالبريد الإلكتروني."};
try{
const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:this.normalizeEmail(identifier),password:pw})});
if(!d.access_token||!d.user)return{success:false,message:"تعذر إنشاء جلسة المستخدم."};
this.storeSession(d,remember);
localStorage.setItem(this.keys.rememberedUser,remember?identifier:"");
this.clearPendingVerification();
return{success:true,user:this.getSafeUser(d.user)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

storeSession(s,remember=false){
const x={access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),token_type:s.token_type||"bearer",user:s.user,remember:Boolean(remember)};
const str=JSON.stringify(x);
if(remember){localStorage.setItem(this.keys.session,str);sessionStorage.removeItem(this.keys.session)}
else{sessionStorage.setItem(this.keys.session,str);localStorage.removeItem(this.keys.session)}
localStorage.setItem(this.keys.cachedUser,JSON.stringify(this.getSafeUser(s.user)));
return x
},

getSession(){
const raw=sessionStorage.getItem(this.keys.session)||localStorage.getItem(this.keys.session);
if(!raw)return null;
try{const s=JSON.parse(raw);return(s?.access_token&&s?.user)?s:null}catch(e){return null}
},

isLoggedIn(){return!!this.getSession()},

getCurrentUser(){
const s=this.getSession();
if(s?.user)return this.getSafeUser(s.user);
try{return JSON.parse(localStorage.getItem(this.keys.cachedUser)||"null")}catch(e){return null}
},

getRememberedUser(){return localStorage.getItem(this.keys.rememberedUser)||""},

async refreshSession(){
const s=this.getSession();
if(!s?.refresh_token)return false;
if((s.expires_at||0)>Math.floor(Date.now()/1000)+60)return true;
try{
const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});
this.storeSession(d,s.remember);
return true
}catch(e){this.logout(false);return false}
},

async logout(redirect=true){
const s=this.getSession();
try{if(s?.access_token)await this.authFetch("/auth/v1/logout",{method:"POST"})}catch(e){}
sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");
localStorage.removeItem("varex_authenticated");
if(redirect)location.replace("./login.html");
return true
},

requireLogin(){
if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage())return true;
if(!this.isLoggedIn()){location.replace("./login.html");return false}
this.refreshSession();
return true
},

isLoginPage(){return location.pathname.toLowerCase().endsWith("login.html")},
isRegisterPage(){return location.pathname.toLowerCase().endsWith("register.html")},
isVerifyEmailPage(){return location.pathname.toLowerCase().endsWith("verify-email.html")},

redirectLoggedUser(){
if((this.isLoginPage()||this.isRegisterPage())&&this.isLoggedIn()){location.replace("./index.html");return true}
return false
},

async requestPasswordReset(email){
const mail=this.normalizeEmail(email);
if(!mail)return{success:false,message:"يرجى إدخال البريد الإلكتروني."};
try{
await this.authFetch("/auth/v1/recover",{method:"POST",body:JSON.stringify({email:mail})});
return{success:true,message:"تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async updateCurrentUser(changes={}){
const s=this.getSession();
if(!s)return{success:false,message:"لا يوجد مستخدم مسجل الدخول."};
const body={};
if(changes.email!==undefined)body.email=this.normalizeEmail(changes.email);
const data={};
["name","username","role"].forEach(k=>{if(changes[k]!==undefined)data[k]=this.cleanText(changes[k])});
if(Object.keys(data).length)body.data={...(s.user.user_metadata||{}),...data};
try{
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify(body)});
s.user=u;
this.storeSession(s,s.remember);
return{success:true,user:this.getSafeUser(u)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async changePassword(currentPassword,newPassword){
if(String(newPassword||"").length<6)return{success:false,message:"كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."};
const s=this.getSession();
if(!s)return{success:false,message:"يجب تسجيل الدخول أولاً."};
try{
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:String(newPassword)})});
s.user=u;
this.storeSession(s,s.remember);
return{success:true,message:"تم تغيير كلمة المرور بنجاح."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

/* PRODUCTS */

getProducts(){return this.getData(this.keys.products)},
saveProducts(x){return this.saveData(this.keys.products,x)},
getProductById(id){return this.getProducts().find(x=>String(x.id)===String(id))||null},
findProductByBarcode(b){b=this.cleanText(b);return this.getProducts().find(x=>this.cleanText(x.barcode)===b)||null},

addProduct(p={}){
const a=this.getProducts();
const x={...p,id:p.id||this.generateId("PRD"),name:this.cleanText(p.name||p.productName),quantity:this.positiveNumber(p.quantity),price:this.positiveNumber(p.price||p.salePrice),cost:this.positiveNumber(p.cost||p.costPrice),createdAt:p.createdAt||this.now(),updatedAt:this.now()};
a.push(x);
this.saveProducts(a);
return x
},

updateProduct(id,c={}){
const a=this.getProducts();
const i=a.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;
a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};
this.saveProducts(a);
return a[i]
},

deleteProduct(id){
const a=this.getProducts(),b=a.filter(x=>String(x.id)!==String(id));
this.saveProducts(b);
return b.length!==a.length
},

adjustStock(id,n){
const a=this.getProducts();
const i=a.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;
a[i].quantity=Math.max(0,this.toNumber(a[i].quantity)+this.toNumber(n));
a[i].updatedAt=this.now();
this.saveProducts(a);
return a[i]
},

/* SALES */

getSales(){return this.getData(this.keys.sales)},
saveSales(x){return this.saveData(this.keys.sales,x)},
getSaleById(id){return this.getSales().find(x=>String(x.id)===String(id))||null},

addSale(s={}){
const a=this.getSales();
const x={...s,id:s.id||this.generateId("SAL"),invoiceNumber:s.invoiceNumber||`INV-${Date.now()}`,createdAt:s.createdAt||this.now(),date:s.date||this.now(),updatedAt:this.now()};
a.push(x);
this.saveSales(a);
return x
},

deleteSale(id){
const a=this.getSales(),b=a.filter(x=>String(x.id)!==String(id));
this.saveSales(b);
return b.length!==a.length
},

completeSale(s={}){
const items=Array.isArray(s.items)?s.items:[];
if(!items.length)return{success:false,message:"لا توجد منتجات في الفاتورة."};
const p=this.getProducts();

for(const x of items){
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id));
const q=this.positiveNumber(x.quantity||x.qty||1);
if(i>=0&&q>this.toNumber(p[i].quantity))return{success:false,message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")}
}

for(const x of items){
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id));
const q=this.positiveNumber(x.quantity||x.qty||1);
if(i>=0){p[i].quantity=Math.max(0,this.toNumber(p[i].quantity)-q);p[i].updatedAt=this.now()}
}

this.saveProducts(p);
return{success:true,sale:this.addSale(s)}
},

/* CUSTOMERS */

getCustomers(){return this.getData(this.keys.customers)},
saveCustomers(x){return this.saveData(this.keys.customers,x)},
addCustomer(x={}){return this._add(this.keys.customers,"CUS",x)},
updateCustomer(id,c={}){return this._update(this.keys.customers,id,c)},
deleteCustomer(id){return this._delete(this.keys.customers,id)},

/* SUPPLIERS */

getSuppliers(){return this.getData(this.keys.suppliers)},
saveSuppliers(x){return this.saveData(this.keys.suppliers,x)},
addSupplier(x={}){return this._add(this.keys.suppliers,"SUP",x)},
updateSupplier(id,c={}){return this._update(this.keys.suppliers,id,c)},
deleteSupplier(id){return this._delete(this.keys.suppliers,id)},

/* EMPLOYEES */

getEmployees(){return this.getData(this.keys.employees)},
saveEmployees(x){return this.saveData(this.keys.employees,x)},
addEmployee(x={}){return this._add(this.keys.employees,"EMP",x)},
updateEmployee(id,c={}){return this._update(this.keys.employees,id,c)},
deleteEmployee(id){return this._delete(this.keys.employees,id)},

/* TRANSACTIONS */

getTransactions(){return this.getData(this.keys.transactions)},
saveTransactions(x){return this.saveData(this.keys.transactions,x)},
addTransaction(x={}){x={...x,amount:this.positiveNumber(x.amount),date:x.date||this.today()};return this._add(this.keys.transactions,"TRX",x)},
updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},
deleteTransaction(id){return this._delete(this.keys.transactions,id)},

/* HELD SALES */

getHeldSales(){return this.getData(this.keys.heldSales)},
saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},
holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},
removeHeldSale(id){return this._delete(this.keys.heldSales,id)},
getHeldSaleById(id){return this.getHeldSales().find(x=>String(x.id)===String(id))||null},

/* HELPERS */

_add(k,p,x={}){
const a=this.getData(k);
const o={...x,id:x.id||this.generateId(p),createdAt:x.createdAt||this.now(),updatedAt:this.now()};
a.push(o);
this.saveData(k,a);
return o
},

_update(k,id,c={}){
const a=this.getData(k),i=a.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;
a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};
this.saveData(k,a);
return a[i]
},

_delete(k,id){
const a=this.getData(k),b=a.filter(x=>String(x.id)!==String(id));
this.saveData(k,b);
return b.length!==a.length
},

/* SETTINGS */

getSettings(){
const d={businessName:"VAREX",currency:"AED",currencySymbol:"د.إ",taxEnabled:true,taxRate:5,lowStockLimit:5,language:"ar"};
const p=this.getObject(this.keys.settings,{});
let l={};
try{
const x=JSON.parse(localStorage.getItem("varexSettings")||"null");
if(x&&typeof x==="object"&&!Array.isArray(x))l=x
}catch(e){}
return{...d,...l,...p}
},

saveSettings(s={}){
const d={...this.getSettings(),...s,updatedAt:this.now()};
const ok=this.saveObject(this.keys.settings,d);
try{localStorage.setItem("varexSettings",JSON.stringify(d))}catch(e){}
return ok
},

money(v){
const s=this.getSettings();
const sym=this.cleanText(s.currencySymbol)||(s.currency==="AED"?"د.إ":s.currency);
return`${this.toNumber(v).toFixed(2)} ${sym}`
},

calculateTax(v){
const s=this.getSettings();
return s.taxEnabled===false?0:this.positiveNumber(v)*this.toNumber(s.taxRate,5)/100
},

getTodaySales(){
const t=this.today();
return this.getSales().filter(s=>this.normalizeDate(s.createdAt||s.date||s.saleDate||s.invoiceDate||"")===t)
},

getTodaySalesTotal(){
return this.getTodaySales().reduce((a,s)=>a+this.toNumber(s.total??s.grandTotal??s.finalTotal??s.netTotal??s.amount??0),0)
},

getStockAlerts(){
const l=this.toNumber(this.getSettings().lowStockLimit,5);
return this.getProducts().filter(p=>this.toNumber(p.quantity)<=this.toNumber(p.minimumStock,l))
},

initialize(){
[this.keys.products,this.keys.sales,this.keys.customers,this.keys.suppliers,this.keys.employees,this.keys.transactions,this.keys.heldSales].forEach(k=>{
if(localStorage.getItem(k)===null)localStorage.setItem(k,"[]")
});
if(localStorage.getItem(this.keys.settings)===null)this.saveSettings(this.getSettings());
return true
}

};

VAREX.initialize();
window.VAREX=VAREX;


/* =========================================================
   UNIFIED VAREX MENU
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

const VAREX_SIDEBAR_SCROLL_KEY="varex_sidebar_scroll_position";

function varexGetSidebar(){return document.querySelector(".sidebar")}

function varexSaveSidebarScroll(){
const sidebar=varexGetSidebar();
if(!sidebar)return;
const value=String(sidebar.scrollTop||0);
try{
sessionStorage.setItem(VAREX_SIDEBAR_SCROLL_KEY,value);
localStorage.setItem(VAREX_SIDEBAR_SCROLL_KEY,value)
}catch(e){}
}

function varexRestoreSidebarScroll(){
const sidebar=varexGetSidebar();
if(!sidebar)return;
let saved=0;
try{saved=Number(sessionStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||localStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||0)}catch(e){}
if(!Number.isFinite(saved)||saved<0)saved=0;

const restore=()=>{
const max=Math.max(0,sidebar.scrollHeight-sidebar.clientHeight);
sidebar.scrollTop=Math.min(saved,max)
};

requestAnimationFrame(()=>requestAnimationFrame(()=>{
restore();
setTimeout(restore,40);
setTimeout(restore,120)
}))
}


/* =========================================================
   BUILD MENU
========================================================= */

function varexBuildMenu(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;

let current=location.pathname.split("/").pop().toLowerCase();
if(!current)current="index.html";

nav.innerHTML=VAREX_MENU.map(item=>{
const[file,icon,title]=item;
const active=current===file.toLowerCase()?" active":"";
return`<a href="./${file}" class="${active.trim()}"><span class="nav-icon">${icon}</span><span class="nav-label">${title}</span></a>`
}).join("");

varexAddSidebarActions()
}


/* =========================================================
   SIDEBAR ACTIONS
========================================================= */

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
<span class="varex-power-icon">⏻</span>
<span>تسجيل الخروج</span>
</button>

<div class="varex-sidebar-bottom-space" aria-hidden="true"></div>
`;

nav.appendChild(box);

varexInstallSharedStyles();

document.getElementById("varexThemeButton")?.addEventListener("click",()=>{
varexSaveSidebarScroll();
varexToggleTheme()
});

document.getElementById("varexLogoutButton")?.addEventListener("click",async()=>{
varexSaveSidebarScroll();
if(confirm("هل تريد تسجيل الخروج من VAREX؟"))await VAREX.logout(true)
});

varexUpdateThemeButton()
}


/* =========================================================
   SHARED SIDEBAR STYLES
========================================================= */

function varexInstallSharedStyles(){

if(document.getElementById("varexSharedStyles"))return;

const style=document.createElement("style");
style.id="varexSharedStyles";

style.textContent=`

:root{
--sidebar-width:265px!important;
}

html{height:100%}
body{min-height:100%}

.main{
margin-right:var(--sidebar-width)!important;
}

.sidebar{
position:fixed!important;
top:0!important;
right:0!important;
bottom:0!important;
width:var(--sidebar-width)!important;
height:100vh!important;
height:100dvh!important;
min-height:100vh!important;
min-height:100dvh!important;
max-height:100vh!important;
max-height:100dvh!important;
display:block!important;
overflow-y:auto!important;
overflow-x:hidden!important;
-webkit-overflow-scrolling:touch!important;
overscroll-behavior-y:contain!important;
overscroll-behavior-x:none!important;
touch-action:pan-y!important;
scroll-behavior:auto!important;
z-index:1000!important;
box-shadow:-4px 0 18px rgba(15,29,67,.10)!important;
}

.sidebar .brand{
position:relative!important;
top:auto!important;
width:100%!important;
height:var(--brand-height,170px)!important;
min-height:var(--brand-height,170px)!important;
max-height:var(--brand-height,170px)!important;
flex:none!important;
}

.sidebar .nav{
position:relative!important;
top:auto!important;
right:auto!important;
bottom:auto!important;
left:auto!important;
width:100%!important;
height:auto!important;
min-height:0!important;
max-height:none!important;
display:block!important;
overflow:visible!important;
padding:16px 14px 0!important;
touch-action:auto!important;
}


/* =========================================================
   MENU CARDS — 3D WITHOUT DROP SHADOW
========================================================= */

.sidebar .nav a{
width:100%!important;
height:50px!important;
min-height:50px!important;
max-height:50px!important;
display:flex!important;
align-items:center!important;
justify-content:flex-start!important;
gap:12px!important;
padding:0 15px!important;
margin:0 0 8px!important;
border-radius:11px!important;
font-family:inherit!important;
font-size:14px!important;
font-weight:600!important;
line-height:1.4!important;
white-space:nowrap!important;
text-decoration:none!important;

background:rgba(255,255,255,.055)!important;
color:#dbeafe!important;

border-top:1px solid rgba(255,255,255,.12)!important;
border-left:1px solid rgba(255,255,255,.08)!important;
border-right:1px solid rgba(0,0,0,.10)!important;
border-bottom:3px solid rgba(5,14,37,.44)!important;

box-shadow:none!important;

transform:translateY(0)!important;

transition:
transform .10s ease,
background .16s ease,
border-color .16s ease,
color .16s ease!important;
}

.sidebar .nav a:hover{
background:rgba(255,255,255,.11)!important;
color:#fff!important;
transform:translateY(-1px)!important;
}

.sidebar .nav a:active{
transform:translateY(2px)!important;
border-bottom-width:1px!important;
margin-bottom:10px!important;
background:rgba(255,255,255,.15)!important;
}

.sidebar .nav a.active{
background:#fff!important;
color:#172554!important;
font-weight:700!important;

border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;

box-shadow:none!important;
}

.sidebar .nav a.active:hover{
background:#f8fafc!important;
color:#172554!important;
}

.sidebar .nav a.active:active{
background:#f1f5f9!important;
border-bottom-width:1px!important;
}

.sidebar .nav a.active .nav-icon,
.sidebar .nav a.active .nav-label{
color:#172554!important;
}


/* LABELS */

.sidebar .nav .nav-label{
font-size:14px!important;
font-weight:600!important;
line-height:1.4!important;
white-space:nowrap!important;
}


/* ICONS */

.sidebar .nav .nav-icon{
width:27px!important;
height:27px!important;
min-width:27px!important;
min-height:27px!important;
display:flex!important;
align-items:center!important;
justify-content:center!important;
font-size:17px!important;
flex-shrink:0!important;
}


/* FOOTER */

.sidebar-footer{
position:relative!important;
width:100%!important;
height:54px!important;
min-height:54px!important;
display:flex!important;
align-items:center!important;
justify-content:center!important;
}


/* ACTION AREA */

.varex-sidebar-actions{
width:100%;
margin-top:18px;
padding-top:15px;
border-top:1px solid rgba(255,255,255,.12);
}


/* =========================================================
   SIDEBAR ACTION BUTTONS — 3D
========================================================= */

.varex-sidebar-actions button{
width:100%;
height:50px;
min-height:50px;
display:flex;
align-items:center;
justify-content:flex-start;
gap:12px;
padding:0 15px;
margin:0 0 9px;
border-radius:11px;
font-family:inherit;
font-size:14px;
font-weight:700;
cursor:pointer;
white-space:nowrap;
box-shadow:none!important;
transform:translateY(0);
transition:
transform .10s ease,
background .16s ease,
color .16s ease,
border-color .16s ease;
}


/* =========================================================
   THEME BUTTON — LIGHT MODE = WHITE
========================================================= */

.varex-theme-button{
background:#fff!important;
color:#172554!important;

border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;
}

.varex-theme-button:hover{
background:#f1f5f9!important;
color:#172554!important;
transform:translateY(-1px);
}

.varex-theme-button:active{
transform:translateY(2px);
border-bottom-width:1px!important;
margin-bottom:11px;
}


/* =========================================================
   LOGOUT BUTTON — WHITE IN BOTH MODES
========================================================= */

.varex-logout-button{
background:#fff!important;
color:#172554!important;

border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;
}

.varex-logout-button:hover{
background:#f1f5f9!important;
color:#172554!important;
transform:translateY(-1px);
}

.varex-logout-button:active{
transform:translateY(2px);
border-bottom-width:1px!important;
margin-bottom:11px;
}


/* =========================================================
   POWER ICON — CIRCULAR
========================================================= */

.varex-power-icon{
width:29px;
height:29px;
min-width:29px;
min-height:29px;
border:2px solid #172554;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
font-size:16px;
font-weight:800;
line-height:1;
flex-shrink:0;
background:#f8fafc;
color:#172554;
}


/* SPACE AFTER LOGOUT */

.varex-sidebar-bottom-space{
display:block;
width:100%;
height:90px;
min-height:90px;
pointer-events:none;
}


/* SCROLLBAR */

.sidebar{
scrollbar-width:thin;
scrollbar-color:rgba(255,255,255,.23) transparent;
}

.sidebar::-webkit-scrollbar{width:6px}

.sidebar::-webkit-scrollbar-track{
background:transparent;
}

.sidebar::-webkit-scrollbar-thumb{
background:rgba(255,255,255,.23);
border-radius:10px;
}

.sidebar::-webkit-scrollbar-thumb:hover{
background:rgba(255,255,255,.38);
}

.sidebar .nav::-webkit-scrollbar{
display:none!important;
}


/* TABLET */

@media(max-width:850px){

.sidebar{
position:fixed!important;
right:0!important;
top:0!important;
bottom:0!important;
width:var(--sidebar-width)!important;
height:100dvh!important;
display:block!important;
overflow-y:auto!important;
}

.sidebar .nav{
display:block!important;
overflow:visible!important;
padding:16px 14px 0!important;
}

.sidebar .nav a{
width:100%!important;
min-width:0!important;
margin:0 0 8px!important;
}

.main{
margin-right:var(--sidebar-width)!important;
}

}

`;

document.head.appendChild(style)
}


/* =========================================================
   INSTALL SIDEBAR SCROLL MEMORY
========================================================= */

function varexInstallSidebarScroll(){
const sidebar=varexGetSidebar();
if(!sidebar)return;

varexRestoreSidebarScroll();

let saveTimer=null;

sidebar.addEventListener("scroll",()=>{
clearTimeout(saveTimer);
saveTimer=setTimeout(varexSaveSidebarScroll,25)
},{passive:true});

sidebar.querySelectorAll("a[href]").forEach(link=>{
link.addEventListener("pointerdown",varexSaveSidebarScroll,{passive:true});
link.addEventListener("touchstart",varexSaveSidebarScroll,{passive:true});
link.addEventListener("click",varexSaveSidebarScroll)
});

window.addEventListener("pagehide",varexSaveSidebarScroll);
window.addEventListener("beforeunload",varexSaveSidebarScroll)
}


/* =========================================================
   THEME
========================================================= */

function varexGetTheme(){
const saved=localStorage.getItem("varex_theme");
if(saved==="dark"||saved==="light")return saved;
return(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"
}


/* APPLY THEME */

function varexApplyTheme(theme){
document.documentElement.setAttribute("data-varex-theme",theme);
document.documentElement.setAttribute("data-theme",theme);

if(document.body){
document.body.classList.toggle("varex-dark",theme==="dark")
}

localStorage.setItem("varex_theme",theme);

varexInstallDarkStyles();
varexUpdateThemeButton()
}


/* TOGGLE THEME */

function varexToggleTheme(){
varexApplyTheme(varexGetTheme()==="dark"?"light":"dark")
}


/* UPDATE THEME BUTTON */

function varexUpdateThemeButton(){
const dark=varexGetTheme()==="dark";
const icon=document.getElementById("varexThemeIcon");
const text=document.getElementById("varexThemeText");

if(icon)icon.textContent=dark?"☀️":"🌙";
if(text)text.textContent=dark?"الوضع النهاري":"الوضع الليلي"
}


/* =========================================================
   DARK MODE
========================================================= */

function varexInstallDarkStyles(){

if(document.getElementById("varexDarkStyles"))return;

const style=document.createElement("style");
style.id="varexDarkStyles";

style.textContent=`

body.varex-dark{
background:#081426!important;
color:#f8fafc!important;
}

body.varex-dark .main,
body.varex-dark main,
body.varex-dark .content{
background:#081426!important;
color:#f8fafc!important;
}

body.varex-dark .topbar{
background:#101f38!important;
border-color:#263955!important;
color:#f8fafc!important;
}

body.varex-dark .panel,
body.varex-dark .card,
body.varex-dark .stat,
body.varex-dark .stat-card,
body.varex-dark .summary-card,
body.varex-dark .dashboard-card,
body.varex-dark .widget,
body.varex-dark .box,
body.varex-dark .section-card,
body.varex-dark .table-card,
body.varex-dark .modal-box,
body.varex-dark .modal-content{
background:#132641!important;
border-color:#29415f!important;
color:#f8fafc!important;
box-shadow:0 5px 20px rgba(0,0,0,.18)!important;
}

body.varex-dark h1,
body.varex-dark h2,
body.varex-dark h3,
body.varex-dark h4,
body.varex-dark h5,
body.varex-dark h6,
body.varex-dark .hero h1,
body.varex-dark .page-name h2,
body.varex-dark .panel h2,
body.varex-dark .card h2,
body.varex-dark .card h3,
body.varex-dark .stat strong{
color:#fff!important;
}

body.varex-dark p,
body.varex-dark small,
body.varex-dark label,
body.varex-dark .muted,
body.varex-dark .hero p,
body.varex-dark .page-name small,
body.varex-dark .stat span{
color:#cbd5e1!important;
}

body.varex-dark input,
body.varex-dark select,
body.varex-dark textarea{
background:#0e2039!important;
border-color:#35506f!important;
color:#fff!important;
}

body.varex-dark input::placeholder,
body.varex-dark textarea::placeholder{
color:#8293aa!important;
}

body.varex-dark input:focus,
body.varex-dark select:focus,
body.varex-dark textarea:focus{
border-color:#6b8bb1!important;
box-shadow:0 0 0 3px rgba(96,165,250,.10)!important;
}

body.varex-dark table{
background:#132641!important;
color:#f8fafc!important;
}

body.varex-dark thead,
body.varex-dark th{
background:#0e2039!important;
color:#dbeafe!important;
border-color:#29415f!important;
}

body.varex-dark td{
background:#132641!important;
color:#e2e8f0!important;
border-color:#29415f!important;
}

body.varex-dark tbody tr:hover td{
background:#182e4c!important;
}

body.varex-dark .chip,
body.varex-dark .info-chip{
background:#162b48!important;
border-color:#304967!important;
color:#cbd5e1!important;
}

body.varex-dark .chip strong,
body.varex-dark .info-chip strong{
color:#fff!important;
}

body.varex-dark .page-icon{
background:#1b3150!important;
color:#fff!important;
}

body.varex-dark .note,
body.varex-dark .system-info,
body.varex-dark .security-note,
body.varex-dark .security-status,
body.varex-dark .summary{
background:#10233d!important;
border-color:#2b4463!important;
color:#dbeafe!important;
}

body.varex-dark .switch-row{
color:#e2e8f0!important;
border-color:#29415f!important;
}

body.varex-dark .filters{
border-color:#29415f!important;
}

body.varex-dark .secondary,
body.varex-dark .mini,
body.varex-dark .reset{
background:#1a3150!important;
border-color:#35506f!important;
color:#f8fafc!important;
}

body.varex-dark .secondary:hover,
body.varex-dark .mini:hover,
body.varex-dark .reset:hover{
background:#203b5e!important;
}

body.varex-dark .primary,
body.varex-dark .save{
background:linear-gradient(135deg,#244a78,#18345a)!important;
color:#fff!important;
}

body.varex-dark .modal,
body.varex-dark .modal-bg,
body.varex-dark .modal-overlay{
background-color:rgba(2,8,23,.76)!important;
}

body.varex-dark .empty{
color:#94a3b8!important;
}


/* =========================================================
   SIDEBAR DARK MODE
========================================================= */

body.varex-dark .sidebar{
background:linear-gradient(180deg,#172554 0%,#13234f 48%,#0f1d43 100%)!important;
color:#fff!important;
}

body.varex-dark .sidebar .brand{
border-color:rgba(255,255,255,.10)!important;
}

body.varex-dark .sidebar .logo{
color:#fff!important;
}

body.varex-dark .sidebar .brand-small{
color:#e2e8f0!important;
}

body.varex-dark .sidebar .system-status,
body.varex-dark .sidebar .store-status{
color:#d1fae5!important;
}


/* =========================================================
   MENU CARDS DARK MODE
========================================================= */

body.varex-dark .sidebar .nav a{
background:rgba(255,255,255,.05)!important;
color:#dbeafe!important;

border-top:1px solid rgba(255,255,255,.11)!important;
border-left:1px solid rgba(255,255,255,.07)!important;
border-right:1px solid rgba(0,0,0,.12)!important;
border-bottom:3px solid rgba(4,11,30,.55)!important;

box-shadow:none!important;
}

body.varex-dark .sidebar .nav a:hover{
background:rgba(255,255,255,.10)!important;
color:#fff!important;
}

body.varex-dark .sidebar .nav a:active{
background:rgba(255,255,255,.14)!important;
border-bottom-width:1px!important;
}

body.varex-dark .sidebar .nav a.active{
background:#fff!important;
color:#172554!important;

border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;

box-shadow:none!important;
}

body.varex-dark .sidebar .nav a.active .nav-icon,
body.varex-dark .sidebar .nav a.active .nav-label{
color:#172554!important;
}

body.varex-dark .sidebar-footer{
color:#94a3b8!important;
border-color:rgba(255,255,255,.10)!important;
}

body.varex-dark .varex-sidebar-actions{
border-color:rgba(255,255,255,.12)!important;
}


/* =========================================================
   THEME BUTTON — DARK MODE = NAVY
========================================================= */

body.varex-dark .varex-theme-button{
background:#172554!important;
color:#fff!important;

border-top:1px solid #324675!important;
border-left:1px solid #293d6c!important;
border-right:1px solid #0d193b!important;
border-bottom:3px solid #08132f!important;

box-shadow:none!important;
}

body.varex-dark .varex-theme-button:hover{
background:#1e3362!important;
color:#fff!important;
}

body.varex-dark .varex-theme-button:active{
background:#203765!important;
border-bottom-width:1px!important;
}


/* =========================================================
   LOGOUT — WHITE ALSO IN DARK MODE
========================================================= */

body.varex-dark .varex-logout-button{
background:#fff!important;
color:#172554!important;

border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;

box-shadow:none!important;
}

body.varex-dark .varex-logout-button:hover{
background:#f1f5f9!important;
color:#172554!important;
}

body.varex-dark .varex-logout-button:active{
background:#e2e8f0!important;
border-bottom-width:1px!important;
}

body.varex-dark .varex-power-icon{
background:#f8fafc!important;
color:#172554!important;
border-color:#172554!important;
}


/* SCROLLBAR */

body.varex-dark hr{
border-color:#29415f!important;
}

body.varex-dark ::-webkit-scrollbar{
width:8px;
height:8px;
}

body.varex-dark ::-webkit-scrollbar-track{
background:#0b192d;
}

body.varex-dark ::-webkit-scrollbar-thumb{
background:#324b69;
border-radius:10px;
}

body.varex-dark ::-webkit-scrollbar-thumb:hover{
background:#45617f;
}

`;

document.head.appendChild(style)
}


/* =========================================================
   CURRENT USER
========================================================= */

function varexShowCurrentUser(){
const user=VAREX.getCurrentUser();
if(!user)return;

document.querySelectorAll(".info-chip,.chip").forEach(el=>{
if(el.textContent.includes("المستخدم")){
const strong=el.querySelector("strong");
if(strong)strong.textContent=user.name||user.username||"المستخدم"
}
});

const sidebarName=document.getElementById("sidebarUserName");
if(sidebarName)sidebarName.textContent=user.name||user.username||user.email||"المستخدم";

const sidebarRole=document.getElementById("sidebarUserRole");
if(sidebarRole)sidebarRole.textContent=user.role||"مستخدم";

const topUser=document.getElementById("topUserName");
if(topUser)topUser.textContent=user.name||user.username||user.email||"المستخدم"
}


/* =========================================================
   START SHARED VAREX UI
========================================================= */

function varexStartUI(){

const publicPage=VAREX.isLoginPage()||VAREX.isRegisterPage()||VAREX.isVerifyEmailPage();

if(publicPage)return;

varexBuildMenu();

varexApplyTheme(varexGetTheme());

varexShowCurrentUser();

varexInstallSidebarScroll()
}


/* =========================================================
   START
========================================================= */

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",varexStartUI)
}else{
varexStartUI()
}
