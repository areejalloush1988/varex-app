/* =========================================================
   VAREX CORE
   SUPABASE AUTH + EMAIL OTP + LOCAL BUSINESS DATA
   + SUBSCRIPTION & LICENSE SYSTEM
========================================================= */

const VAREX={config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification",subscription:"varex_subscription",subscriptionGate:"varex_subscription_gate"},

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
if(m.includes("password")&&m.includes("6"))return"كلمة المرور لا تحقق متطلبات الأمان.";
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

getPendingVerification(){
try{
const x=JSON.parse(localStorage.getItem(this.keys.pendingVerification)||"null");
return x&&typeof x==="object"?x:null
}catch(e){return null}
},

clearPendingVerification(){
try{localStorage.removeItem(this.keys.pendingVerification)}catch(e){}
},

async createUser(user={}){
const name=this.cleanText(user.name);
const username=this.normalizeUsername(user.username);
const email=this.normalizeEmail(user.email);
const password=String(user.password||"");

if(!name)return{success:false,message:"الاسم الكامل مطلوب."};
if(username.length<3)return{success:false,message:"اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."};
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{success:false,message:"يرجى إدخال بريد إلكتروني صحيح."};
if(password.length<8)return{success:false,message:"كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل."};
if(!/[A-Z]/.test(password))return{success:false,message:"كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل."};
if(!/[a-z]/.test(password))return{success:false,message:"كلمة المرور يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل."};

try{
const d=await this.authFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{name,full_name:name,username,role:"مستخدم"}})});
this.setPendingVerification({email,name,username});

if(d?.session?.access_token){
this.storeSession(d.session,false);
return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:false,message:"تم إنشاء الحساب وتأكيد البريد الإلكتروني."}
}

return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:true,email,message:"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."}

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async verifyEmailOtp(email,token){
const mail=this.normalizeEmail(email);
const code=this.cleanText(token).replace(/\s+/g,"");

if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
if(!code)return{success:false,message:"يرجى إدخال رمز التحقق."};

try{
const d=await this.authFetch("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"signup",email:mail,token:code})});

if(!d?.user)return{success:false,message:"تعذر تأكيد البريد الإلكتروني."};

if(d?.access_token){
this.storeSession({
access_token:d.access_token,
refresh_token:d.refresh_token,
expires_in:d.expires_in,
expires_at:d.expires_at,
token_type:d.token_type,
user:d.user
},false)
}

this.clearPendingVerification();
sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");
localStorage.removeItem("varex_authenticated");

return{success:true,user:this.getSafeUser(d.user),message:"تم تأكيد البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول."}

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async resendConfirmation(email){
const mail=this.normalizeEmail(email);
if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};

try{
await this.authFetch("/auth/v1/resend",{method:"POST",body:JSON.stringify({type:"signup",email:mail})});
return{success:true,message:"تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني."}
}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
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

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

storeSession(s,remember=false){
const x={
access_token:s.access_token,
refresh_token:s.refresh_token,
expires_in:s.expires_in,
expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),
token_type:s.token_type||"bearer",
user:s.user,
remember:Boolean(remember)
};

const str=JSON.stringify(x);

if(remember){
localStorage.setItem(this.keys.session,str);
sessionStorage.removeItem(this.keys.session)
}else{
sessionStorage.setItem(this.keys.session,str);
localStorage.removeItem(this.keys.session)
}

localStorage.setItem(this.keys.cachedUser,JSON.stringify(this.getSafeUser(s.user)));

return x
},

getSession(){
const raw=sessionStorage.getItem(this.keys.session)||localStorage.getItem(this.keys.session);
if(!raw)return null;

try{
const s=JSON.parse(raw);
return(s?.access_token&&s?.user)?s:null
}catch(e){
return null
}
},

isLoggedIn(){
return!!this.getSession()
},

getCurrentUser(){
const s=this.getSession();

if(s?.user)return this.getSafeUser(s.user);

try{
return JSON.parse(localStorage.getItem(this.keys.cachedUser)||"null")
}catch(e){
return null
}
},

getRememberedUser(){
return localStorage.getItem(this.keys.rememberedUser)||""
},

async refreshSession(){
const s=this.getSession();

if(!s?.refresh_token)return false;
if((s.expires_at||0)>Math.floor(Date.now()/1000)+60)return true;

try{
const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});
this.storeSession(d,s.remember);
return true
}catch(e){
this.logout(false);
return false
}
},

async logout(redirect=true){
const s=this.getSession();

try{
if(s?.access_token){
await this.authFetch("/auth/v1/logout",{method:"POST"})
}
}catch(e){}

sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.cachedUser);
sessionStorage.removeItem("varex_authenticated");
localStorage.removeItem("varex_authenticated");

if(redirect){
location.replace("./login.html")
}

return true
},

requireLogin(){
if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage())return true;

if(!this.isLoggedIn()){
location.replace("./login.html");
return false
}

this.refreshSession();
return true
},

isLoginPage(){return location.pathname.toLowerCase().endsWith("login.html")},
isRegisterPage(){return location.pathname.toLowerCase().endsWith("register.html")},
isVerifyEmailPage(){return location.pathname.toLowerCase().endsWith("verify-email.html")},

redirectLoggedUser(){
if((this.isLoginPage()||this.isRegisterPage())&&this.isLoggedIn()){
location.replace("./index.html");
return true
}
return false
},

async requestPasswordReset(email){
const mail=this.normalizeEmail(email);

if(!mail)return{success:false,message:"يرجى إدخال البريد الإلكتروني."};

try{
await this.authFetch("/auth/v1/recover",{method:"POST",body:JSON.stringify({email:mail})});
return{success:true,message:"تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."}
}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async updateCurrentUser(changes={}){
const s=this.getSession();

if(!s)return{success:false,message:"لا يوجد مستخدم مسجل الدخول."};

const body={};

if(changes.email!==undefined){
body.email=this.normalizeEmail(changes.email)
}

const data={};

["name","username","role"].forEach(k=>{
if(changes[k]!==undefined){
data[k]=this.cleanText(changes[k])
}
});

if(Object.keys(data).length){
body.data={...(s.user.user_metadata||{}),...data}
}

try{
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify(body)});
s.user=u;
this.storeSession(s,s.remember);

return{success:true,user:this.getSafeUser(u)}

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async changePassword(currentPassword,newPassword){
if(String(newPassword||"").length<6){
return{success:false,message:"كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."}
}

const s=this.getSession();

if(!s){
return{success:false,message:"يجب تسجيل الدخول أولاً."}
}

try{
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:String(newPassword)})});
s.user=u;
this.storeSession(s,s.remember);

return{success:true,message:"تم تغيير كلمة المرور بنجاح."}

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

/* =========================================================
   SUBSCRIPTION & LICENSE
========================================================= */

getSubscription(){
const defaults={plan:"",planName:"",status:"inactive",billingType:"",price:0,currency:"AED",startedAt:"",expiresAt:"",lifetime:false,licenseKey:"",paymentStatus:"unpaid",updatedAt:""};

try{
const x=JSON.parse(localStorage.getItem(this.keys.subscription)||"null");

if(x&&typeof x==="object"&&!Array.isArray(x)){
return{...defaults,...x}
}
}catch(e){
console.error(e)
}

return{...defaults}
},

saveSubscription(data={}){
const x={...this.getSubscription(),...data,updatedAt:this.now()};

try{
localStorage.setItem(this.keys.subscription,JSON.stringify(x));
return x
}catch(e){
console.error(e);
return false
}
},

generateLicenseKey(){
const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let result="VAREX";

for(let g=0;g<4;g++){
result+="-";
for(let i=0;i<4;i++){
result+=chars[Math.floor(Math.random()*chars.length)]
}
}
return result
},

activateSubscription(options={}){
const type=String(options.billingType||options.type||"monthly");
const now=new Date();

let expiresAt="";
let lifetime=false;

if(type==="monthly"){
const expiry=new Date(now);
expiry.setMonth(expiry.getMonth()+1);
expiresAt=expiry.toISOString()
}else if(type==="yearly"){
const expiry=new Date(now);
expiry.setFullYear(expiry.getFullYear()+1);
expiresAt=expiry.toISOString()
}else if(type==="lifetime"){
lifetime=true;
expiresAt=""
}

return this.saveSubscription({
plan:options.plan||"business",
planName:options.planName||"VAREX Business",
billingType:type,
price:this.positiveNumber(options.price),
currency:options.currency||"AED",
status:"active",
paymentStatus:options.paymentStatus||"paid",
startedAt:now.toISOString(),
expiresAt,
lifetime,
licenseKey:options.licenseKey||this.generateLicenseKey()
})
},

cancelSubscription(){
return this.saveSubscription({...this.getSubscription(),status:"cancelled"})
},

expireSubscription(){
return this.saveSubscription({...this.getSubscription(),status:"expired"})
},

isSubscriptionActive(){
const s=this.getSubscription();

if(s.status!=="active")return false;
if(s.lifetime===true||s.billingType==="lifetime")return true;
if(!s.expiresAt)return false;

const expiry=new Date(s.expiresAt);

if(Number.isNaN(expiry.getTime()))return false;

if(expiry.getTime()<=Date.now()){
this.expireSubscription();
return false
}

return true
},

getSubscriptionDaysRemaining(){
const s=this.getSubscription();

if(s.lifetime===true||s.billingType==="lifetime")return Infinity;
if(!s.expiresAt)return 0;

const expiry=new Date(s.expiresAt);

if(Number.isNaN(expiry.getTime()))return 0;

return Math.max(0,Math.ceil((expiry.getTime()-Date.now())/86400000))
},

getSubscriptionStatus(){
const subscription=this.getSubscription();

return{
...subscription,
active:this.isSubscriptionActive(),
daysRemaining:this.getSubscriptionDaysRemaining()
}
},

isSubscriptionPage(){return location.pathname.toLowerCase().endsWith("subscription.html")},
isSubscriptionSuccessPage(){return location.pathname.toLowerCase().endsWith("subscription-success.html")},

isSubscriptionGateEnabled(){
return localStorage.getItem(this.keys.subscriptionGate)==="true"
},

enableSubscriptionGate(){
localStorage.setItem(this.keys.subscriptionGate,"true");
return true
},

disableSubscriptionGate(){
localStorage.setItem(this.keys.subscriptionGate,"false");
return true
},

requireSubscription(){

if(!this.isSubscriptionGateEnabled())return true;

if(
this.isLoginPage()||
this.isRegisterPage()||
this.isVerifyEmailPage()||
this.isSubscriptionPage()||
this.isSubscriptionSuccessPage()
){
return true
}

if(!this.isLoggedIn()){
location.replace("./login.html");
return false
}

if(!this.isSubscriptionActive()){
location.replace("./subscription.html");
return false
}

return true
},

/* =========================================================
   DATA
========================================================= */

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
const a=this.getProducts();
const b=a.filter(x=>String(x.id)!==String(id));
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
const a=this.getSales();
const b=a.filter(x=>String(x.id)!==String(id));
this.saveSales(b);
return b.length!==a.length
},

completeSale(s={}){
const items=Array.isArray(s.items)?s.items:[];

if(!items.length){
return{success:false,message:"لا توجد منتجات في الفاتورة."}
}

const p=this.getProducts();

for(const x of items){
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id));
const q=this.positiveNumber(x.quantity||x.qty||1);

if(i>=0&&q>this.toNumber(p[i].quantity)){
return{success:false,message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")}
}
}

for(const x of items){
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id));
const q=this.positiveNumber(x.quantity||x.qty||1);

if(i>=0){
p[i].quantity=Math.max(0,this.toNumber(p[i].quantity)-q);
p[i].updatedAt=this.now()
}
}

this.saveProducts(p);
return{success:true,sale:this.addSale(s)}
},

getCustomers(){return this.getData(this.keys.customers)},
saveCustomers(x){return this.saveData(this.keys.customers,x)},
addCustomer(x={}){return this._add(this.keys.customers,"CUS",x)},
updateCustomer(id,c={}){return this._update(this.keys.customers,id,c)},
deleteCustomer(id){return this._delete(this.keys.customers,id)},

getSuppliers(){return this.getData(this.keys.suppliers)},
saveSuppliers(x){return this.saveData(this.keys.suppliers,x)},
addSupplier(x={}){return this._add(this.keys.suppliers,"SUP",x)},
updateSupplier(id,c={}){return this._update(this.keys.suppliers,id,c)},
deleteSupplier(id){return this._delete(this.keys.suppliers,id)},

getEmployees(){return this.getData(this.keys.employees)},
saveEmployees(x){return this.saveData(this.keys.employees,x)},
addEmployee(x={}){return this._add(this.keys.employees,"EMP",x)},
updateEmployee(id,c={}){return this._update(this.keys.employees,id,c)},
deleteEmployee(id){return this._delete(this.keys.employees,id)},

getTransactions(){return this.getData(this.keys.transactions)},
saveTransactions(x){return this.saveData(this.keys.transactions,x)},
addTransaction(x={}){x={...x,amount:this.positiveNumber(x.amount),date:x.date||this.today()};return this._add(this.keys.transactions,"TRX",x)},
updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},
deleteTransaction(id){return this._delete(this.keys.transactions,id)},

getHeldSales(){return this.getData(this.keys.heldSales)},
saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},
holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},
removeHeldSale(id){return this._delete(this.keys.heldSales,id)},
getHeldSaleById(id){return this.getHeldSales().find(x=>String(x.id)===String(id))||null},

_add(k,p,x={}){
const a=this.getData(k);
const o={...x,id:x.id||this.generateId(p),createdAt:x.createdAt||this.now(),updatedAt:this.now()};
a.push(o);
this.saveData(k,a);
return o
},

_update(k,id,c={}){
const a=this.getData(k);
const i=a.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;
a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};
this.saveData(k,a);
return a[i]
},

_delete(k,id){
const a=this.getData(k);
const b=a.filter(x=>String(x.id)!==String(id));
this.saveData(k,b);
return b.length!==a.length
},

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

try{
localStorage.setItem("varexSettings",JSON.stringify(d))
}catch(e){}

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

return this.getSales().filter(
s=>this.normalizeDate(
s.createdAt||
s.date||
s.saleDate||
s.invoiceDate||
""
)===t
)
},

getTodaySalesTotal(){
return this.getTodaySales().reduce(
(a,s)=>a+this.toNumber(
s.total??
s.grandTotal??
s.finalTotal??
s.netTotal??
s.amount??
0
),0)
},

getStockAlerts(){
const l=this.toNumber(this.getSettings().lowStockLimit,5);
return this.getProducts().filter(
p=>this.toNumber(p.quantity)<=this.toNumber(p.minimumStock,l)
)
},

initialize(){
[
this.keys.products,
this.keys.sales,
this.keys.customers,
this.keys.suppliers,
this.keys.employees,
this.keys.transactions,
this.keys.heldSales
].forEach(k=>{
if(localStorage.getItem(k)===null)localStorage.setItem(k,"[]")
});

if(localStorage.getItem(this.keys.settings)===null){
this.saveSettings(this.getSettings())
}

if(localStorage.getItem(this.keys.subscriptionGate)===null){
localStorage.setItem(this.keys.subscriptionGate,"false")
}

return true
}

};

VAREX.initialize();
window.VAREX=VAREX;


/* =========================================================
   MENU
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
["subscription.html","💎","الاشتراك والترخيص"],
["setting.html","⚙️","الإعدادات"]
];

const VAREX_SIDEBAR_SCROLL_KEY="varex_sidebar_scroll_position";

function varexGetSidebar(){
return document.querySelector(".sidebar")
}

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

try{
saved=Number(
sessionStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||
localStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||
0
)
}catch(e){}

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

function varexBuildMenu(){
const nav=document.querySelector(".sidebar .nav");
if(!nav)return;

let current=location.pathname.split("/").pop().toLowerCase();

if(!current)current="index.html";

if(current==="subscription-success.html"){
current="subscription.html"
}

nav.innerHTML=VAREX_MENU.map(item=>{
const[file,icon,title]=item;
const active=current===file.toLowerCase()?" active":"";

return`
<a href="./${file}" class="${active.trim()}">
<span class="nav-icon">${icon}</span>
<span class="nav-label">${title}</span>
</a>
`
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
varexInstallLogoutUI();

document.getElementById("varexThemeButton")?.addEventListener("click",()=>{
varexSaveSidebarScroll();
varexToggleTheme()
});

document.getElementById("varexLogoutButton")?.addEventListener("click",()=>{
varexSaveSidebarScroll();
varexOpenLogoutDialog()
});

varexUpdateThemeButton()
}


/* =========================================================
   LOGOUT UI
========================================================= */

function varexInstallLogoutUI(){

if(document.getElementById("varexLogoutOverlay"))return;

const overlay=document.createElement("div");

overlay.id="varexLogoutOverlay";
overlay.className="varex-logout-overlay";

overlay.innerHTML=`

<div class="varex-logout-card" id="varexLogoutCard">

<div class="varex-logout-logo-wrap">

<div class="varex-logo-window">

<img
src="./varex-icon-512.png"
alt="VAREX"
class="varex-logout-logo"
id="varexLogoutLogo"
>

</div>

<div
class="varex-logout-fallback-logo"
id="varexLogoutFallbackLogo">
VX
</div>

</div>

<div class="varex-logout-loader" id="varexLogoutLoader"></div>

<div class="varex-logout-success-icon" id="varexLogoutSuccessIcon">
✓
</div>

<h2 class="varex-logout-title" id="varexLogoutTitle">
تسجيل الخروج
</h2>

<p class="varex-logout-message" id="varexLogoutMessage">
هل تريد تسجيل الخروج من VAREX؟
</p>

<div class="varex-logout-progress" id="varexLogoutProgress">
<div class="varex-logout-progress-bar" id="varexLogoutProgressBar"></div>
</div>

<div class="varex-logout-actions" id="varexLogoutActions">

<button
type="button"
class="varex-logout-confirm"
id="varexLogoutConfirm">
نعم، تسجيل الخروج
</button>

<button
type="button"
class="varex-logout-cancel"
id="varexLogoutCancel">
إلغاء
</button>

</div>

</div>

<div class="varex-logout-transition" id="varexLogoutTransition">

<div class="varex-logout-transition-logo">

<div class="varex-transition-image-box">

<div class="varex-transition-logo-window">

<img
src="./varex-icon-512.png"
alt="VAREX"
class="varex-transition-image"
>

</div>

</div>

<div>VAREX</div>

</div>

</div>

`;

document.body.appendChild(overlay);

const logo=document.getElementById("varexLogoutLogo");

logo?.addEventListener("error",()=>{
logo.style.display="none";

const fallback=document.getElementById("varexLogoutFallbackLogo");

if(fallback){
fallback.style.display="flex"
}
});

document.getElementById("varexLogoutCancel")?.addEventListener("click",varexCloseLogoutDialog);
document.getElementById("varexLogoutConfirm")?.addEventListener("click",varexRunLogoutSequence);

overlay.addEventListener("click",event=>{
if(
event.target===overlay&&
!overlay.classList.contains("processing")
){
varexCloseLogoutDialog()
}
});

document.addEventListener("keydown",event=>{
if(
event.key==="Escape"&&
overlay.classList.contains("show")&&
!overlay.classList.contains("processing")
){
varexCloseLogoutDialog()
}
})
}


/* =========================================================
   LOGOUT ACTIONS
========================================================= */

function varexOpenLogoutDialog(){

const overlay=document.getElementById("varexLogoutOverlay");

if(!overlay)return;

varexLogoutInProgress=false;

overlay.classList.remove(
"processing",
"finished",
"leaving"
);

document
.getElementById("varexLogoutCard")
?.classList.remove("success");

document
.getElementById("varexLogoutTransition")
?.classList.remove("show");

document.getElementById("varexLogoutTitle").textContent="تسجيل الخروج";

document.getElementById("varexLogoutMessage").textContent=
"هل تريد تسجيل الخروج من VAREX؟";

document.getElementById("varexLogoutActions").style.display="flex";

document.getElementById("varexLogoutLoader").style.display="none";

document.getElementById("varexLogoutSuccessIcon").style.display="none";

document.getElementById("varexLogoutProgress").style.display="none";

document.getElementById("varexLogoutProgressBar").style.width="0%";

overlay.classList.add("show")
}

function varexCloseLogoutDialog(){

const overlay=document.getElementById("varexLogoutOverlay");

if(!overlay)return;

if(overlay.classList.contains("processing"))return;

overlay.classList.remove("show")
}

function varexLogoutWait(ms){
return new Promise(resolve=>setTimeout(resolve,ms))
}

function varexSetLogoutStatus(
titleText,
messageText,
progressValue,
mode="loading"
){

const title=document.getElementById("varexLogoutTitle");
const message=document.getElementById("varexLogoutMessage");
const loader=document.getElementById("varexLogoutLoader");
const success=document.getElementById("varexLogoutSuccessIcon");
const bar=document.getElementById("varexLogoutProgressBar");
const card=document.getElementById("varexLogoutCard");

if(title)title.textContent=titleText;
if(message)message.textContent=messageText;
if(bar)bar.style.width=`${progressValue}%`;

if(mode==="success"){

if(loader)loader.style.display="none";
if(success)success.style.display="flex";

card?.classList.add("success")

}else{

if(success)success.style.display="none";
if(loader)loader.style.display="block";

card?.classList.remove("success")
}
}


/* =========================================================
   LOGOUT SOUND
========================================================= */

function varexPlayLogoutSound(){

try{

const AudioClass=
window.AudioContext||
window.webkitAudioContext;

if(!AudioClass)return;

const context=new AudioClass();
const start=context.currentTime;

[
[523.25,0,.16],
[659.25,.14,.18],
[783.99,.29,.20],
[1046.5,.46,.32]
]
.forEach(([frequency,delay,duration])=>{

const oscillator=context.createOscillator();
const gain=context.createGain();

oscillator.type="sine";
oscillator.frequency.value=frequency;

gain.gain.setValueAtTime(.0001,start+delay);

gain.gain.exponentialRampToValueAtTime(
.055,
start+delay+.025
);

gain.gain.exponentialRampToValueAtTime(
.0001,
start+delay+duration
);

oscillator.connect(gain);
gain.connect(context.destination);

oscillator.start(start+delay);
oscillator.stop(start+delay+duration+.04)

});

setTimeout(()=>{
context.close().catch(()=>{})
},1300)

}catch(e){}
}


/* =========================================================
   LOGOUT SEQUENCE
========================================================= */

let varexLogoutInProgress=false;

async function varexRunLogoutSequence(){

if(varexLogoutInProgress)return;

varexLogoutInProgress=true;

const overlay=document.getElementById("varexLogoutOverlay");
const actions=document.getElementById("varexLogoutActions");
const progress=document.getElementById("varexLogoutProgress");
const transition=document.getElementById("varexLogoutTransition");

if(!overlay){

varexLogoutInProgress=false;

await VAREX.logout(true);

return
}

overlay.classList.add("processing");

if(actions)actions.style.display="none";
if(progress)progress.style.display="block";

varexSetLogoutStatus(
"جاري حفظ البيانات...",
"يرجى الانتظار لحظات.",
38,
"loading"
);

const savingDelay=varexLogoutWait(1750);

const logoutProcess=
VAREX.logout(false)
.catch(()=>true);

await Promise.all([
savingDelay,
logoutProcess
]);

varexSetLogoutStatus(
"تم تسجيل الخروج بنجاح",
"شكراً لاستخدامك نظام VAREX.",
100,
"success"
);

varexPlayLogoutSound();

overlay.classList.add("finished");

await varexLogoutWait(900);

if(transition){
transition.classList.add("show")
}

overlay.classList.add("leaving");

await varexLogoutWait(760);

location.replace("./login.html")
}


/* =========================================================
   SHARED STYLES
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
transition:transform .10s ease,background .16s ease,border-color .16s ease,color .16s ease!important;
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

.sidebar .nav a.active .nav-icon,
.sidebar .nav a.active .nav-label{
color:#172554!important;
}

.sidebar .nav .nav-label{
font-size:14px!important;
font-weight:600!important;
white-space:nowrap!important;
}

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

.sidebar-footer{
position:relative!important;
width:100%!important;
height:54px!important;
min-height:54px!important;
display:flex!important;
align-items:center!important;
justify-content:center!important;
}

.varex-sidebar-actions{
width:100%;
margin-top:18px;
padding-top:15px;
border-top:1px solid rgba(255,255,255,.12);
}

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
}

.varex-theme-button{
background:#fff!important;
color:#172554!important;
border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;
}

.varex-logout-button{
background:#fff!important;
color:#172554!important;
border-top:1px solid #fff!important;
border-left:1px solid #f8fafc!important;
border-right:1px solid #cbd5e1!important;
border-bottom:3px solid #94a3b8!important;
}

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
background:#f8fafc;
color:#172554;
}

.varex-sidebar-bottom-space{
height:90px;
min-height:90px;
}


/* =========================================================
   LOGOUT OVERLAY
========================================================= */

.varex-logout-overlay{
position:fixed;
inset:0;
z-index:999999;
display:flex;
align-items:center;
justify-content:center;
padding:24px;
background:rgba(4,12,32,.70);
backdrop-filter:blur(10px);
-webkit-backdrop-filter:blur(10px);
opacity:0;
visibility:hidden;
pointer-events:none;
transition:opacity .28s ease,visibility .28s ease;
}

.varex-logout-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto;
}

.varex-logout-card{
position:relative;
width:min(560px,calc(100vw - 44px));
min-height:410px;
padding:40px 40px 34px;
border-radius:27px;
background:linear-gradient(160deg,#fff 0%,#f8fafc 100%);
border:1px solid rgba(255,255,255,.90);
box-shadow:
0 34px 100px rgba(2,8,23,.40),
0 12px 34px rgba(15,23,42,.20);
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-align:center;
overflow:hidden;
}


/* =========================================================
   LOGO — VISUAL CENTER FIX
========================================================= */

.varex-logout-logo-wrap{
position:relative!important;
z-index:2!important;
width:112px!important;
height:112px!important;
min-width:112px!important;
min-height:112px!important;
max-width:112px!important;
max-height:112px!important;
margin:0 auto 28px!important;
padding:0!important;
border-radius:50%!important;
background:linear-gradient(145deg,#172554,#213765)!important;
box-shadow:
0 9px 0 #0f1d43,
0 20px 34px rgba(23,37,84,.30)!important;
overflow:hidden!important;
display:block!important;
}

.varex-logo-window{
position:absolute!important;
inset:0!important;
width:100%!important;
height:100%!important;
overflow:hidden!important;
border-radius:50%!important;
}

.varex-logout-logo,
#varexLogoutLogo{
display:block!important;
position:absolute!important;

top:50%!important;
left:50%!important;

right:auto!important;
bottom:auto!important;

width:150px!important;
height:150px!important;

min-width:150px!important;
min-height:150px!important;

max-width:none!important;
max-height:none!important;

margin:0!important;
padding:0!important;

border:0!important;
border-radius:0!important;

object-fit:cover!important;

/*
   54% بدلاً من 50% لنعالج الفراغ البصري
   الموجود داخل ملف PNG نفسه.
*/
object-position:50% 54%!important;

transform:
translate(-50%,-50%)
scale(1.17)!important;

transform-origin:center center!important;

vertical-align:middle!important;
float:none!important;
}

.varex-logout-fallback-logo{
display:none;
position:absolute!important;
inset:0!important;
width:100%!important;
height:100%!important;
align-items:center!important;
justify-content:center!important;
font-size:28px!important;
font-weight:900!important;
color:#fff!important;
direction:ltr!important;
}


/* =========================================================
   LOADER
========================================================= */

.varex-logout-loader{
display:none;
position:relative;
z-index:2;
width:52px;
height:52px;
margin:2px auto 20px;
border-radius:50%;
border:4px solid #dbe3ef;
border-top-color:#172554;
animation:varexLogoutSpin .72s linear infinite;
}

@keyframes varexLogoutSpin{
to{transform:rotate(360deg)}
}

.varex-logout-success-icon{
display:none;
position:relative;
z-index:2;
width:56px;
height:56px;
margin:2px auto 19px;
border-radius:50%;
align-items:center;
justify-content:center;
background:#dcfce7;
border:2px solid #22c55e;
color:#15803d;
font-size:29px;
font-weight:900;
}

.varex-logout-title{
position:relative;
z-index:2;
font-size:25px;
font-weight:900;
color:#172554;
margin:0 0 11px;
}

.varex-logout-message{
position:relative;
z-index:2;
max-width:410px;
font-size:13px;
line-height:1.9;
color:#64748b;
margin:0;
}

.varex-logout-progress{
display:none;
position:relative;
z-index:2;
width:84%;
height:8px;
margin-top:27px;
border-radius:30px;
background:#e2e8f0;
overflow:hidden;
}

.varex-logout-progress-bar{
width:0;
height:100%;
border-radius:30px;
background:linear-gradient(90deg,#172554,#31548c);
transition:width .65s ease;
}

.varex-logout-actions{
position:relative;
z-index:2;
width:100%;
display:flex;
gap:14px;
margin-top:32px;
}

.varex-logout-actions button{
flex:1;
height:52px;
border-radius:12px;
font-family:inherit;
font-size:13px;
font-weight:800;
cursor:pointer;
}

.varex-logout-confirm{
background:linear-gradient(135deg,#172554,#213765);
color:#fff;
border:1px solid #172554;
box-shadow:
0 7px 0 #0f1d43,
0 14px 22px rgba(23,37,84,.22);
}

.varex-logout-cancel{
background:#fff;
color:#172554;
border:1px solid #cbd5e1;
box-shadow:
0 6px 0 #cbd5e1,
0 12px 18px rgba(15,23,42,.09);
}


/* =========================================================
   TRANSITION
========================================================= */

.varex-logout-transition{
position:absolute;
inset:0;
z-index:50;
display:flex;
align-items:center;
justify-content:center;
background:
radial-gradient(circle at center,rgba(59,130,246,.20),transparent 38%),
linear-gradient(145deg,#172554,#0f1d43);
transform:translateX(-105%);
transition:transform .72s cubic-bezier(.65,.05,.22,1);
}

.varex-logout-transition.show{
transform:translateX(0);
}

.varex-logout-transition-logo{
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
gap:15px;
}

.varex-transition-image-box{
position:relative!important;
width:112px!important;
height:112px!important;
min-width:112px!important;
min-height:112px!important;
overflow:hidden!important;
border-radius:50%!important;
}

.varex-transition-logo-window{
position:absolute!important;
inset:0!important;
width:100%!important;
height:100%!important;
overflow:hidden!important;
border-radius:50%!important;
}

.varex-transition-image{
display:block!important;
position:absolute!important;

top:50%!important;
left:50%!important;

width:150px!important;
height:150px!important;

min-width:150px!important;
min-height:150px!important;

max-width:none!important;
max-height:none!important;

margin:0!important;
padding:0!important;

object-fit:cover!important;
object-position:50% 54%!important;

transform:
translate(-50%,-50%)
scale(1.17)!important;

transform-origin:center center!important;

filter:
drop-shadow(0 10px 25px rgba(0,0,0,.28));
}

.varex-logout-transition-logo > div:last-child{
font-size:36px;
font-weight:900;
letter-spacing:7px;
color:#fff;
direction:ltr;
}


/* =========================================================
   MOBILE
========================================================= */

@media(max-width:600px){

.varex-logout-card{
width:calc(100vw - 28px);
min-height:390px;
padding:34px 22px 28px;
}

.varex-logout-actions{
flex-direction:column;
}

.varex-logout-actions button{
width:100%;
flex:none;
}

.varex-logout-logo-wrap{
width:100px!important;
height:100px!important;
min-width:100px!important;
min-height:100px!important;
max-width:100px!important;
max-height:100px!important;
}

.varex-logout-logo,
#varexLogoutLogo{
width:136px!important;
height:136px!important;
min-width:136px!important;
min-height:136px!important;
object-position:50% 54%!important;
transform:
translate(-50%,-50%)
scale(1.17)!important;
}

}

`;

document.head.appendChild(style)
}


/* =========================================================
   SIDEBAR SCROLL
========================================================= */

function varexInstallSidebarScroll(){

const sidebar=varexGetSidebar();

if(!sidebar)return;

varexRestoreSidebarScroll();

let saveTimer=null;

sidebar.addEventListener("scroll",()=>{

clearTimeout(saveTimer);

saveTimer=setTimeout(
varexSaveSidebarScroll,
25
)

},{passive:true});

sidebar
.querySelectorAll("a[href]")
.forEach(link=>{

link.addEventListener(
"pointerdown",
varexSaveSidebarScroll,
{passive:true}
);

link.addEventListener(
"touchstart",
varexSaveSidebarScroll,
{passive:true}
);

link.addEventListener(
"click",
varexSaveSidebarScroll
)

});

window.addEventListener(
"pagehide",
varexSaveSidebarScroll
);

window.addEventListener(
"beforeunload",
varexSaveSidebarScroll
)
}


/* =========================================================
   THEME
========================================================= */

function varexGetTheme(){

const saved=
localStorage.getItem("varex_theme");

if(
saved==="dark"||
saved==="light"
){
return saved
}

return(
window.matchMedia&&
window.matchMedia(
"(prefers-color-scheme: dark)"
).matches
)
?"dark"
:"light"
}

function varexApplyTheme(theme){

document.documentElement
.setAttribute(
"data-varex-theme",
theme
);

document.documentElement
.setAttribute(
"data-theme",
theme
);

if(document.body){

document.body.classList.toggle(
"varex-dark",
theme==="dark"
)

}

localStorage.setItem(
"varex_theme",
theme
);

varexInstallDarkStyles();

varexUpdateThemeButton()
}

function varexToggleTheme(){

varexApplyTheme(
varexGetTheme()==="dark"
?"light"
:"dark"
)
}

function varexUpdateThemeButton(){

const dark=
varexGetTheme()==="dark";

const icon=
document.getElementById(
"varexThemeIcon"
);

const text=
document.getElementById(
"varexThemeText"
);

if(icon){
icon.textContent=
dark
?"☀️"
:"🌙"
}

if(text){
text.textContent=
dark
?"الوضع النهاري"
:"الوضع الليلي"
}
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
}

body.varex-dark h1,
body.varex-dark h2,
body.varex-dark h3,
body.varex-dark h4,
body.varex-dark h5,
body.varex-dark h6{
color:#fff!important;
}

body.varex-dark p,
body.varex-dark small,
body.varex-dark label,
body.varex-dark .muted{
color:#cbd5e1!important;
}

body.varex-dark input,
body.varex-dark select,
body.varex-dark textarea{
background:#0e2039!important;
border-color:#35506f!important;
color:#fff!important;
}

body.varex-dark .chip,
body.varex-dark .info-chip{
background:#fff!important;
color:#172554!important;
}

body.varex-dark .sidebar{
background:
linear-gradient(
180deg,
#172554 0%,
#13234f 48%,
#0f1d43 100%
)!important;
color:#fff!important;
}

body.varex-dark .sidebar .nav a.active{
background:#fff!important;
color:#172554!important;
}

body.varex-dark .varex-theme-button{
background:#172554!important;
color:#fff!important;
border-color:#324675!important;
}

body.varex-dark .varex-logout-button{
background:#fff!important;
color:#172554!important;
}

body.varex-dark .varex-logout-card{
background:
linear-gradient(
160deg,
#132641,
#0f2039
)!important;
border-color:#29415f!important;
}

body.varex-dark .varex-logout-title{
color:#fff!important;
}

body.varex-dark .varex-logout-message{
color:#cbd5e1!important;
}

body.varex-dark .varex-logout-progress{
background:#29415f!important;
}

body.varex-dark .varex-logout-progress-bar{
background:
linear-gradient(
90deg,
#60a5fa,
#dbeafe
)!important;
}

body.varex-dark .varex-logout-loader{
border-color:#29415f!important;
border-top-color:#fff!important;
}

body.varex-dark .varex-logout-cancel{
background:#172c48!important;
color:#fff!important;
border-color:#35506f!important;
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

document
.querySelectorAll(
".info-chip,.chip"
)
.forEach(el=>{

if(
el.textContent.includes(
"المستخدم"
)
){

const strong=
el.querySelector("strong");

if(strong){

strong.textContent=
user.name||
user.username||
"المستخدم"

}

}

});

const sidebarName=
document.getElementById(
"sidebarUserName"
);

if(sidebarName){

sidebarName.textContent=
user.name||
user.username||
user.email||
"المستخدم"

}

const sidebarRole=
document.getElementById(
"sidebarUserRole"
);

if(sidebarRole){

sidebarRole.textContent=
user.role||
"مستخدم"

}

const topUser=
document.getElementById(
"topUserName"
);

if(topUser){

topUser.textContent=
user.name||
user.username||
user.email||
"المستخدم"

}
}


/* =========================================================
   START
========================================================= */

function varexStartUI(){

const publicPage=
VAREX.isLoginPage()||
VAREX.isRegisterPage()||
VAREX.isVerifyEmailPage();

if(publicPage)return;

if(!VAREX.requireSubscription())return;

varexBuildMenu();

varexApplyTheme(
varexGetTheme()
);

varexShowCurrentUser();

varexInstallSidebarScroll()
}

if(document.readyState==="loading"){

document.addEventListener(
"DOMContentLoaded",
varexStartUI
)

}else{

varexStartUI()

}
