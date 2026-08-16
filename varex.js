/* ========================================================= VAREX CORE ========================================================= */
const VAREX={
config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},
keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification",subscription:"varex_subscription",subscriptionGate:"varex_subscription_gate",staffUsers:"varexUsers",staffSession:"varex_staff_session",deviceAuth:"varex_device_authorized",deviceOwner:"varex_device_owner"},
getData(k){try{const x=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}},
saveData(k,d){try{localStorage.setItem(k,JSON.stringify(Array.isArray(d)?d:[]));return true}catch(e){return false}},
getObject(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...f,...x}:{...f}}catch(e){return{...f}}},
saveObject(k,d){try{localStorage.setItem(k,JSON.stringify(d||{}));return true}catch(e){return false}},
generateId(p="VRX"){return`${p}-${Date.now()}-${Math.floor(Math.random()*1e6)}`},
parseNumber(v,f=0){if(typeof v==="number")return Number.isFinite(v)?v:f;if(v===null||v===undefined||v==="")return f;let x=String(v).trim().replace(/[,\s]/g,"").replace(/[^\d.\-]/g,"");const i=x.indexOf(".");if(i!==-1)x=x.slice(0,i+1)+x.slice(i+1).replace(/\./g,"");const n=Number(x);return Number.isFinite(n)?n:f},
toNumber(v,f=0){return this.parseNumber(v,f)},
positiveNumber(v){return Math.max(0,this.toNumber(v))},
formatNumber(v,d=2){const n=this.toNumber(v),x=Math.max(0,Math.min(6,Number.isFinite(Number(d))?Number(d):2));return n.toLocaleString("en-US",{minimumFractionDigits:x,maximumFractionDigits:x})},
formatQuantity(v){return this.toNumber(v).toLocaleString("en-US",{maximumFractionDigits:3})},
cleanText(v){return String(v??"").trim()},
now(){return new Date().toISOString()},
today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},
normalizeDate(v){if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},
normalizeEmail(v){return this.cleanText(v).toLowerCase()},
normalizeUsername(v){return this.cleanText(v).toLowerCase()},

async authFetch(path,opt={}){
const h={apikey:this.config.supabaseKey,"Content-Type":"application/json",...(opt.headers||{})},s=this.getSession();
if(s?.access_token)h.Authorization=`Bearer ${s.access_token}`;
const r=await fetch(this.config.supabaseUrl+path,{...opt,headers:h});
let data={};try{data=await r.json()}catch(e){}
if(!r.ok){const e=new Error(data.msg||data.message||data.error_description||data.error||"تعذر الاتصال بخدمة الحسابات.");e.status=r.status;e.data=data;throw e}
return data
},

mapAuthError(e){
const m=String(e?.message||"").toLowerCase();
if(m.includes("already registered"))return"البريد الإلكتروني مستخدم بالفعل.";
if(m.includes("invalid login credentials"))return"البريد الإلكتروني أو كلمة المرور غير صحيحة.";
if(m.includes("email not confirmed"))return"البريد الإلكتروني غير مؤكد.";
if(m.includes("expired"))return"انتهت صلاحية رمز التحقق.";
if(m.includes("invalid otp")||m.includes("invalid token"))return"رمز التحقق غير صحيح.";
if(m.includes("rate limit"))return"تم إجراء محاولات كثيرة. يرجى الانتظار قليلاً.";
return e?.message||"حدث خطأ في خدمة الحسابات."
},

getSafeUser(u){
if(!u)return null;
const m=u.user_metadata||{};
return{id:u.id,name:m.name||m.full_name||u.name||"مالك المنشأة",username:m.username||u.username||"",email:u.email||"",role:m.role||u.role||"مالك",status:"نشط",createdAt:u.created_at||u.createdAt||"",lastLogin:u.last_sign_in_at||u.lastLogin||""}
},

setPendingVerification(d={}){
const x={email:this.normalizeEmail(d.email),name:this.cleanText(d.name),username:this.normalizeUsername(d.username),createdAt:this.now()};
localStorage.setItem(this.keys.pendingVerification,JSON.stringify(x));
return x
},

getPendingVerification(){try{return JSON.parse(localStorage.getItem(this.keys.pendingVerification)||"null")}catch(e){return null}},
clearPendingVerification(){localStorage.removeItem(this.keys.pendingVerification)},

async createUser(u={}){
const name=this.cleanText(u.name),username=this.normalizeUsername(u.username),email=this.normalizeEmail(u.email),password=String(u.password||"");
if(!name)return{success:false,message:"الاسم الكامل مطلوب."};
if(username.length<3)return{success:false,message:"اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."};
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{success:false,message:"يرجى إدخال بريد إلكتروني صحيح."};
if(password.length<8)return{success:false,message:"كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل."};
try{
const d=await this.authFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{name,full_name:name,username,role:"مالك"}})});
this.setPendingVerification({email,name,username});
return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:!d?.session?.access_token,email,message:d?.session?.access_token?"تم إنشاء الحساب.":"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async verifyEmailOtp(email,token){
try{
const d=await this.authFetch("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"signup",email:this.normalizeEmail(email),token:this.cleanText(token).replace(/\s+/g,"")})});
this.clearPendingVerification();
sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
return{success:true,user:this.getSafeUser(d.user),message:"تم تأكيد البريد الإلكتروني بنجاح."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async resendConfirmation(email){
try{
await this.authFetch("/auth/v1/resend",{method:"POST",body:JSON.stringify({type:"signup",email:this.normalizeEmail(email)})});
return{success:true,message:"تم إرسال رمز تحقق جديد."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

authorizeDevice(user){
const u=this.getSafeUser(user)||user||{};
const x={authorized:true,ownerId:u.id||"",name:u.name||"مالك المنشأة",username:u.username||"owner",email:this.normalizeEmail(u.email||""),authorizedAt:this.now()};
localStorage.setItem(this.keys.deviceAuth,"true");
localStorage.setItem(this.keys.deviceOwner,JSON.stringify(x));
return x
},

isDeviceAuthorized(){return localStorage.getItem(this.keys.deviceAuth)==="true"&&!!this.getDeviceOwner()},
getDeviceOwner(){try{const x=JSON.parse(localStorage.getItem(this.keys.deviceOwner)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}},
removeDeviceAuthorization(){localStorage.removeItem(this.keys.deviceAuth);localStorage.removeItem(this.keys.deviceOwner);this.clearStaffSession()},

async login(login,password,remember=false){
const email=this.normalizeEmail(login);
if(!email||!password)return{success:false,message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."};
try{
const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password:String(password)})});
if(!d.access_token||!d.user)return{success:false,message:"تعذر إنشاء جلسة المستخدم."};
this.storeSession(d,true);
localStorage.setItem(this.keys.rememberedUser,remember?email:"");
this.authorizeDevice(d.user);
this.clearPendingVerification();
this.clearStaffSession();
return{success:true,user:this.getSafeUser(d.user)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async verifyOwnerPassword(password){
const owner=this.getDeviceOwner();
if(!owner?.email)return{success:false,message:"هذا الجهاز غير مرتبط بحساب المنشأة."};
if(!password)return{success:false,message:"أدخل كلمة مرور المالك."};
try{
const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:owner.email,password:String(password)})});
if(!d?.access_token||!d?.user)return{success:false,message:"تعذر التحقق من حساب المالك."};
this.storeSession(d,true);
this.authorizeDevice(d.user);
return{success:true,user:this.getSafeUser(d.user)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

storeSession(s,remember=true){
const x={access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),token_type:s.token_type||"bearer",user:s.user,remember:Boolean(remember)},str=JSON.stringify(x);
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
try{const s=JSON.parse(raw);return s?.access_token&&s?.user?s:null}catch(e){return null}
},

isLoggedIn(){return!!this.getSession()},

getCurrentUser(){
const s=this.getSession();
if(s?.user)return this.getSafeUser(s.user);
const d=this.getDeviceOwner();
if(d)return{id:d.ownerId,name:d.name,username:d.username,email:d.email,role:"مالك"};
try{return JSON.parse(localStorage.getItem(this.keys.cachedUser)||"null")}catch(e){return null}
},

getRememberedUser(){return localStorage.getItem(this.keys.rememberedUser)||""},

async refreshSession(){
const s=this.getSession();
if(!s?.refresh_token)return false;
if((s.expires_at||0)>Math.floor(Date.now()/1000)+60)return true;
try{
const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});
this.storeSession(d,true);
this.authorizeDevice(d.user);
return true
}catch(e){
sessionStorage.removeItem(this.keys.session);
localStorage.removeItem(this.keys.session);
return false
}
},

async logout(redirect=true){
const s=this.getSession();
try{if(s?.access_token)await this.authFetch("/auth/v1/logout",{method:"POST"})}catch(e){}
this.removeDeviceAuthorization();
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
if(this.isDeviceAuthorized()){
if(this.isLoggedIn())this.refreshSession();
return true
}
if(this.isLoggedIn()){
const u=this.getSession()?.user;
if(u)this.authorizeDevice(u);
return true
}
location.replace("./login.html");
return false
},

isLoginPage(){return location.pathname.toLowerCase().endsWith("login.html")},
isRegisterPage(){return location.pathname.toLowerCase().endsWith("register.html")},
isVerifyEmailPage(){return location.pathname.toLowerCase().endsWith("verify-email.html")},

redirectLoggedUser(){
if((this.isLoginPage()||this.isRegisterPage())&&(this.isLoggedIn()||this.isDeviceAuthorized())){
location.replace("./index.html");
return true
}
return false
},

async requestPasswordReset(email){
try{
await this.authFetch("/auth/v1/recover",{method:"POST",body:JSON.stringify({email:this.normalizeEmail(email)})});
return{success:true,message:"تم إرسال تعليمات استعادة كلمة المرور."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async updateCurrentUser(c={}){
const s=this.getSession();
if(!s)return{success:false,message:"يجب التحقق من حساب المالك أولاً."};
const body={},data={};
if(c.email!==undefined)body.email=this.normalizeEmail(c.email);
["name","username","role"].forEach(k=>{if(c[k]!==undefined)data[k]=this.cleanText(c[k])});
if(Object.keys(data).length)body.data={...(s.user.user_metadata||{}),...data};
try{
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify(body)});
s.user=u;
this.storeSession(s,true);
this.authorizeDevice(u);
return{success:true,user:this.getSafeUser(u)}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

async changePassword(c,n){
if(String(n||"").length<6)return{success:false,message:"كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."};
try{
const s=this.getSession();
if(!s)return{success:false,message:"يجب تسجيل الدخول بحساب المالك أولاً."};
const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:String(n)})});
s.user=u;
this.storeSession(s,true);
return{success:true,message:"تم تغيير كلمة المرور بنجاح."}
}catch(e){return{success:false,message:this.mapAuthError(e)}}
},

/* INTERNAL USERS */
getStaffUsers(){try{const x=JSON.parse(localStorage.getItem(this.keys.staffUsers)||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}},
saveStaffUsers(x){localStorage.setItem(this.keys.staffUsers,JSON.stringify(Array.isArray(x)?x:[]));return true},
getActiveStaffUsers(){return this.getStaffUsers().filter(x=>x.status!=="disabled")},
getStaffSession(){try{const x=JSON.parse(sessionStorage.getItem(this.keys.staffSession)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}},

setStaffSession(u){
const x={id:u.id,name:u.name||"المستخدم",email:u.email||"",username:u.username||"",role:u.role||"custom",permissions:Array.isArray(u.permissions)?u.permissions:[],isOwner:!!u.isOwner,loginAt:this.now()};
sessionStorage.setItem(this.keys.staffSession,JSON.stringify(x));
return x
},

clearStaffSession(){sessionStorage.removeItem(this.keys.staffSession)},
getActiveOperator(){return this.getStaffSession()},
roleName(r){return{owner:"المالك",manager:"المدير",accountant:"المحاسب",cashier:"الكاشير",custom:"مستخدم"}[r]||"مستخدم"},

getOwnerOperator(){
const d=this.getDeviceOwner(),u=this.getCurrentUser()||{};
return{id:"owner",name:d?.name||u.name||"مالك المنشأة",email:d?.email||u.email||"",username:d?.username||u.username||"owner",role:"owner",permissions:["*"],isOwner:true}
},

async hashPassword(v){
const text=String(v||"");
if(window.crypto?.subtle){
const b=new TextEncoder().encode(text),h=await crypto.subtle.digest("SHA-256",b);
return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")
}
let h=5381;
for(let i=0;i<text.length;i++)h=((h<<5)+h)^text.charCodeAt(i);
return"fallback-"+(h>>>0).toString(16)
},

async setStaffPassword(email,password){
const a=this.getStaffUsers(),mail=this.normalizeEmail(email),i=a.findIndex(x=>this.normalizeEmail(x.email)===mail);
if(i<0)return false;
a[i].passwordHash=await this.hashPassword(password);
a[i].passwordUpdatedAt=this.now();
if(!a[i].username)a[i].username=this.normalizeUsername((a[i].name||mail.split("@")[0]).replace(/\s+/g,"."));
this.saveStaffUsers(a);
return true
},

async verifyStaffPassword(u,password){
if(!u?.passwordHash)return{success:false,message:"لم يتم تعيين كلمة مرور لهذا المستخدم. عدّل المستخدم وحدد كلمة مرور ثم احفظ."};
const h=await this.hashPassword(password);
return h===u.passwordHash?{success:true}:{success:false,message:"كلمة المرور غير صحيحة."}
},

hasPermission(p){
const u=this.getStaffSession();
if(!u)return false;
if(u.isOwner||u.permissions?.includes("*"))return true;
return Array.isArray(u.permissions)&&u.permissions.includes(p)
},

/* SUBSCRIPTION */
getSubscription(){const d={plan:"",planName:"",status:"inactive",billingType:"",price:0,currency:"AED",startedAt:"",expiresAt:"",lifetime:false,licenseKey:"",paymentStatus:"unpaid",updatedAt:""};try{const x=JSON.parse(localStorage.getItem(this.keys.subscription)||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...d,...x}:{...d}}catch(e){return{...d}}},
saveSubscription(d={}){const x={...this.getSubscription(),...d,updatedAt:this.now()};localStorage.setItem(this.keys.subscription,JSON.stringify(x));return x},
generateLicenseKey(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let r="VAREX";for(let g=0;g<4;g++){r+="-";for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)]}return r},

activateSubscription(o={}){
const type=String(o.billingType||o.type||"monthly"),now=new Date();
let expiresAt="",lifetime=false;
if(type==="monthly"){const e=new Date(now);e.setMonth(e.getMonth()+1);expiresAt=e.toISOString()}
else if(type==="yearly"){const e=new Date(now);e.setFullYear(e.getFullYear()+1);expiresAt=e.toISOString()}
else if(type==="trial"){const e=new Date(now);e.setDate(e.getDate()+7);expiresAt=e.toISOString()}
else if(type==="lifetime")lifetime=true;
return this.saveSubscription({plan:o.plan||"business",planName:o.planName||"VAREX Business",billingType:type,price:this.positiveNumber(o.price),currency:o.currency||"AED",status:"active",paymentStatus:o.paymentStatus||"paid",startedAt:now.toISOString(),expiresAt,lifetime,licenseKey:o.licenseKey||this.generateLicenseKey()})
},

cancelSubscription(){return this.saveSubscription({...this.getSubscription(),status:"cancelled"})},
expireSubscription(){return this.saveSubscription({...this.getSubscription(),status:"expired"})},

isSubscriptionActive(){
const s=this.getSubscription();
if(s.status!=="active")return false;
if(s.lifetime||s.billingType==="lifetime")return true;
if(!s.expiresAt)return false;
const e=new Date(s.expiresAt);
if(Number.isNaN(e.getTime()))return false;
if(e<=Date.now()){this.expireSubscription();return false}
return true
},

getSubscriptionDaysRemaining(){
const s=this.getSubscription();
if(s.lifetime||s.billingType==="lifetime")return Infinity;
if(!s.expiresAt)return 0;
const e=new Date(s.expiresAt);
return Number.isNaN(e.getTime())?0:Math.max(0,Math.ceil((e-Date.now())/86400000))
},

getSubscriptionStatus(){return{...this.getSubscription(),active:this.isSubscriptionActive(),daysRemaining:this.getSubscriptionDaysRemaining()}},
isSubscriptionPage(){return location.pathname.toLowerCase().endsWith("subscription.html")},
isSubscriptionSuccessPage(){return location.pathname.toLowerCase().endsWith("subscription-success.html")},
isSubscriptionGateEnabled(){return localStorage.getItem(this.keys.subscriptionGate)==="true"},
enableSubscriptionGate(){localStorage.setItem(this.keys.subscriptionGate,"true");return true},
disableSubscriptionGate(){localStorage.setItem(this.keys.subscriptionGate,"false");return true},

requireSubscription(){
if(!this.isSubscriptionGateEnabled())return true;
if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage()||this.isSubscriptionPage()||this.isSubscriptionSuccessPage())return true;
if(!this.isSubscriptionActive()){location.replace("./subscription.html");return false}
return true
},

/* BUSINESS DATA */
getProducts(){return this.getData(this.keys.products)},
saveProducts(x){return this.saveData(this.keys.products,x)},
getProductById(id){return this.getProducts().find(x=>String(x.id)===String(id))||null},
findProductByBarcode(b){return this.getProducts().find(x=>this.cleanText(x.barcode)===this.cleanText(b))||null},

addProduct(p={}){
const a=this.getProducts(),x={...p,id:p.id||this.generateId("PRD"),name:this.cleanText(p.name||p.productName),quantity:this.positiveNumber(p.quantity),price:this.positiveNumber(p.price||p.salePrice),cost:this.positiveNumber(p.cost||p.costPrice),createdAt:p.createdAt||this.now(),updatedAt:this.now()};
a.push(x);this.saveProducts(a);return x
},

updateProduct(id,c={}){
const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));
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
const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;
a[i].quantity=Math.max(0,this.toNumber(a[i].quantity)+this.toNumber(n));
this.saveProducts(a);
return a[i]
},

getSales(){return this.getData(this.keys.sales)},
saveSales(x){return this.saveData(this.keys.sales,x)},
getSaleById(id){return this.getSales().find(x=>String(x.id)===String(id))||null},

addSale(s={}){
const a=this.getSales(),x={...s,id:s.id||this.generateId("SAL"),invoiceNumber:s.invoiceNumber||`INV-${Date.now()}`,createdAt:s.createdAt||this.now(),date:s.date||this.now(),updatedAt:this.now()};
a.push(x);this.saveSales(a);return x
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
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);
if(i>=0&&q>this.toNumber(p[i].quantity))return{success:false,message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")}
}

for(const x of items){
const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);
if(i>=0)p[i].quantity=Math.max(0,this.toNumber(p[i].quantity)-q)
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
addTransaction(x={}){return this._add(this.keys.transactions,"TRX",{...x,amount:this.positiveNumber(x.amount),date:x.date||this.today()})},
updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},
deleteTransaction(id){return this._delete(this.keys.transactions,id)},

getHeldSales(){return this.getData(this.keys.heldSales)},
saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},
holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},
removeHeldSale(id){return this._delete(this.keys.heldSales,id)},

_add(k,p,x={}){
const a=this.getData(k),o={...x,id:x.id||this.generateId(p),createdAt:x.createdAt||this.now(),updatedAt:this.now()};
a.push(o);this.saveData(k,a);return o
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

getSettings(){
const d={businessName:"VAREX",currency:"AED",currencySymbol:"د.إ",taxEnabled:true,taxRate:5,lowStockLimit:5,language:"ar"},p=this.getObject(this.keys.settings,{});
let l={};
try{l=JSON.parse(localStorage.getItem("varexSettings")||"null")||{}}catch(e){}
return{...d,...l,...p}
},

saveSettings(s={}){
const d={...this.getSettings(),...s,updatedAt:this.now()};
this.saveObject(this.keys.settings,d);
localStorage.setItem("varexSettings",JSON.stringify(d));
return true
},

money(v){
const s=this.getSettings(),sym=this.cleanText(s.currencySymbol)||(s.currency==="AED"?"د.إ":s.currency);
return`${this.formatNumber(v,2)} ${sym}`
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
if(localStorage.getItem(this.keys.subscriptionGate)===null)localStorage.setItem(this.keys.subscriptionGate,"false");
return true
}
};

VAREX.initialize();
window.VAREX=VAREX;

/* ========================================================= HELPERS ========================================================= */
function varexWait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

/* ========================================================= PERMISSIONS ========================================================= */
const VAREX_PERMISSION_MAP={"index.html":"dashboard","pos.html":"pos","products.html":"products","purchases.html":"products","transfers.html":"products","customers.html":"customers","suppliers.html":"suppliers","accounts.html":"accounts","expenses.html":"accounts","shifts.html":"pos","employees.html":"employees","branches.html":"settings","reports.html":"reports","notifications.html":"dashboard","activity.html":"users","users.html":"users","subscription.html":"__owner__","setting.html":"settings"};

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

function varexCurrentFile(){return location.pathname.split("/").pop().toLowerCase()||"index.html"}

function varexCanOpen(file){
const u=VAREX.getStaffSession();
if(!u)return false;
if(u.isOwner)return true;
const p=VAREX_PERMISSION_MAP[file];
if(!p)return true;
if(p==="__owner__")return false;
return u.permissions?.includes(p)
}

function varexFirstAllowedPage(){
for(const [f] of VAREX_MENU)if(varexCanOpen(f))return f;
return"index.html"
}

function varexCheckCurrentPermission(){
const u=VAREX.getStaffSession();
if(!u)return false;
if(varexCanOpen(varexCurrentFile()))return true;
location.replace("./"+varexFirstAllowedPage());
return false
}

/* ========================================================= STAFF LOGIN ========================================================= */
let varexSelectedStaffId=null;
let varexStaffLogoutRunning=false;

function varexInstallStaffUI(){
if(document.getElementById("varexStaffOverlay"))return;

const o=document.createElement("div");
o.id="varexStaffOverlay";
o.className="varex-staff-overlay";

o.innerHTML=`
<div class="varex-staff-card">

<div class="varex-staff-brand">VAREX</div>

<h2>من سيستخدم النظام؟</h2>

<p class="varex-staff-sub">
اختر حسابك ثم أدخل كلمة المرور.
</p>

<div class="varex-staff-list" id="varexStaffList"></div>

<div class="varex-staff-password" id="varexStaffPasswordBox">

<div class="varex-selected-user" id="varexSelectedStaff">—</div>

<input
id="varexStaffPassword"
type="password"
autocomplete="current-password"
placeholder="كلمة المرور">

<div class="varex-staff-error" id="varexStaffError"></div>

<div class="varex-staff-login-actions">

<button id="varexStaffLoginBtn">
دخول إلى VAREX
</button>

<button id="varexStaffBackBtn">
رجوع
</button>

</div>

</div>

</div>
`;

document.body.appendChild(o);

document.getElementById("varexStaffBackBtn").onclick=()=>{
varexSelectedStaffId=null;
document.getElementById("varexStaffPasswordBox").classList.remove("show");
document.getElementById("varexStaffPassword").value="";
document.getElementById("varexStaffError").textContent=""
};

document.getElementById("varexStaffLoginBtn").onclick=varexLoginSelectedStaff;

document.getElementById("varexStaffPassword").addEventListener("keydown",e=>{
if(e.key==="Enter")varexLoginSelectedStaff()
})
}

function varexRenderStaffUsers(){
varexInstallStaffUI();

const list=document.getElementById("varexStaffList");
const owner=VAREX.getOwnerOperator();
const users=VAREX.getActiveStaffUsers();

list.innerHTML=
`<button class="varex-staff-user owner" onclick="varexSelectStaff('__owner__')">
<span class="varex-staff-avatar">👑</span>
<span>
<strong>${varexEsc(owner.name)}</strong>
<small>المالك / Owner</small>
</span>
</button>`+

users.map(u=>`
<button class="varex-staff-user" onclick="varexSelectStaff('${varexEscAttr(u.id)}')">
<span class="varex-staff-avatar">
${u.role==="cashier"?"🛒":u.role==="accountant"?"💰":u.role==="manager"?"👔":"👤"}
</span>
<span>
<strong>${varexEsc(u.name||u.username||"المستخدم")}</strong>
<small>${VAREX.roleName(u.role)}</small>
</span>
</button>
`).join("")
}

function varexOpenStaffGate(){
varexRenderStaffUsers();

document.getElementById("varexStaffPasswordBox")?.classList.remove("show");

const pass=document.getElementById("varexStaffPassword");
const err=document.getElementById("varexStaffError");
const btn=document.getElementById("varexStaffLoginBtn");

if(pass)pass.value="";
if(err)err.textContent="";

if(btn){
btn.disabled=false;
btn.classList.remove("varex-login-processing","varex-login-success");
btn.textContent="دخول إلى VAREX"
}

varexSelectedStaffId=null;

document.getElementById("varexStaffOverlay")?.classList.remove("varex-login-leaving");
document.getElementById("varexStaffOverlay")?.classList.add("show");

document.body.style.overflow="hidden"
}

function varexCloseStaffGate(){
document.getElementById("varexStaffOverlay")?.classList.remove("show");
document.body.style.overflow=""
}

function varexSelectStaff(id){
varexSelectedStaffId=id;

const u=
id==="__owner__"
?VAREX.getOwnerOperator()
:VAREX.getStaffUsers().find(x=>String(x.id)===String(id));

if(!u||u.status==="disabled")return;

document.getElementById("varexSelectedStaff").textContent=
`${u.name||"المستخدم"} — ${VAREX.roleName(u.role)}`;

document.getElementById("varexStaffPassword").value="";
document.getElementById("varexStaffError").textContent="";

document.getElementById("varexStaffPasswordBox").classList.add("show");

setTimeout(()=>{
document.getElementById("varexStaffPassword")?.focus()
},120)
}

async function varexLoginSelectedStaff(){

const pass=document.getElementById("varexStaffPassword").value;
const err=document.getElementById("varexStaffError");
const btn=document.getElementById("varexStaffLoginBtn");

if(!pass){
err.textContent="أدخل كلمة المرور.";
return
}

if(btn.disabled)return;

err.textContent="";

btn.disabled=true;
btn.classList.remove("varex-login-success");
btn.classList.add("varex-login-processing");

btn.innerHTML=`
<span class="varex-mini-spinner"></span>
<span>جاري تسجيل الدخول...</span>
`;

await varexWait(850);

let result=null;

if(varexSelectedStaffId==="__owner__"){

result=await VAREX.verifyOwnerPassword(pass);

if(result.success){
VAREX.setStaffSession(VAREX.getOwnerOperator())
}

}else{

const u=VAREX.getStaffUsers().find(
x=>String(x.id)===String(varexSelectedStaffId)
);

if(!u){

btn.disabled=false;
btn.classList.remove("varex-login-processing");
btn.textContent="دخول إلى VAREX";

return
}

result=await VAREX.verifyStaffPassword(u,pass);

if(result.success){

u.lastLogin=new Date().toLocaleString("ar-AE");

const a=VAREX.getStaffUsers();
const i=a.findIndex(x=>String(x.id)===String(u.id));

if(i>=0){
a[i].lastLogin=u.lastLogin;
VAREX.saveStaffUsers(a)
}

VAREX.setStaffSession(u)

}

}

if(!result?.success){

await varexWait(350);

btn.disabled=false;
btn.classList.remove("varex-login-processing");
btn.textContent="دخول إلى VAREX";

err.textContent=result?.message||"تعذر تسجيل الدخول.";

return
}

await varexWait(450);

btn.classList.remove("varex-login-processing");
btn.classList.add("varex-login-success");

btn.innerHTML=`
<span>✓</span>
<span>تم تسجيل الدخول بنجاح</span>
`;

await varexWait(950);

const overlay=document.getElementById("varexStaffOverlay");

overlay?.classList.add("varex-login-leaving");

await varexWait(550);

varexCloseStaffGate();

overlay?.classList.remove("varex-login-leaving");

btn.disabled=false;
btn.classList.remove("varex-login-success");
btn.textContent="دخول إلى VAREX";

varexBuildMenu();
varexInstallTopSwitchUserButton();
varexShowCurrentUser();
varexCheckCurrentPermission()
}

function varexSwitchUser(){
VAREX.clearStaffSession();
varexOpenStaffGate()
}

async function varexLogoutCurrentUser(){

if(varexStaffLogoutRunning)return;

const current=VAREX.getStaffSession();

if(!current){
varexOpenStaffGate();
return
}

varexStaffLogoutRunning=true;

const button=document.getElementById("varexStaffLogoutButton");

if(button){
button.disabled=true;
button.classList.add("varex-button-pressing")
}

/* حركة ضغط الزر */
await varexWait(900);

if(button){
button.classList.remove("varex-button-pressing")
}

varexInstallStaffLogoutUI();

const overlay=document.getElementById("varexStaffLogoutOverlay");
const loader=document.getElementById("varexStaffLogoutLoader");
const success=document.getElementById("varexStaffLogoutSuccess");
const title=document.getElementById("varexStaffLogoutTitle");
const message=document.getElementById("varexStaffLogoutMessage");
const bar=document.getElementById("varexStaffLogoutProgressBar");

overlay.classList.remove(
"varex-staff-logout-leaving",
"success"
);

overlay.classList.add("show");

document.body.style.overflow="hidden";

loader.style.display="block";
success.style.display="none";

title.textContent="جاري حفظ البيانات والإعدادات...";
message.textContent="يرجى الانتظار حتى يتم إنهاء جلسة المستخدم بشكل آمن.";

bar.style.width="5%";

await varexWait(650);
bar.style.width="18%";

await varexWait(650);
bar.style.width="34%";

try{

localStorage.setItem(
"varex_last_staff_logout",
JSON.stringify({
id:current.id||"",
name:current.name||"",
role:current.role||"",
loggedOutAt:new Date().toISOString()
})
);

VAREX.saveSettings(
VAREX.getSettings()
);

}catch(e){}

await varexWait(700);
bar.style.width="52%";

await varexWait(700);
bar.style.width="71%";

await varexWait(650);
bar.style.width="88%";

await varexWait(500);
bar.style.width="100%";

await varexWait(500);

VAREX.clearStaffSession();

loader.style.display="none";
success.style.display="flex";

title.textContent="تم تسجيل خروج المستخدم بنجاح";
message.textContent="يمكن الآن اختيار مستخدم آخر للدخول إلى VAREX.";

overlay.classList.add("success");

await varexWait(1200);

overlay.classList.add("varex-staff-logout-leaving");

await varexWait(550);

overlay.classList.remove(
"show",
"success",
"varex-staff-logout-leaving"
);

document.body.style.overflow="";

if(button){
button.disabled=false
}

varexStaffLogoutRunning=false;

varexOpenStaffGate()
}

window.varexSwitchUser=varexSwitchUser;
window.varexLogoutCurrentUser=varexLogoutCurrentUser;

function varexInitStaffAccess(){

const session=VAREX.getStaffSession();
const users=VAREX.getActiveStaffUsers();

if(session){

if(session.isOwner){
return varexCheckCurrentPermission()
}

const fresh=users.find(
x=>String(x.id)===String(session.id)
);

if(!fresh){

VAREX.clearStaffSession();
varexOpenStaffGate();

return false
}

session.permissions=
Array.isArray(fresh.permissions)
?fresh.permissions
:[];

session.role=fresh.role;
session.name=fresh.name;
session.username=fresh.username||"";

VAREX.setStaffSession(session);

return varexCheckCurrentPermission()

}

varexOpenStaffGate();

return false
}

function varexInstallStaffPasswordCapture(){

if(window.__varexStaffPasswordCapture)return;

window.__varexStaffPasswordCapture=true;

document.addEventListener("click",e=>{

const b=e.target?.closest?.("button");
const oc=String(b?.getAttribute?.("onclick")||"");

if(!b||!oc.includes("saveUser"))return;

const pass=document.getElementById("temporaryPassword")?.value||"";
const email=document.getElementById("userEmail")?.value?.trim()||"";

if(pass&&email){

setTimeout(()=>{
VAREX.setStaffPassword(email,pass)
},200)

}

},true)
}

/* ========================================================= STAFF LOGOUT ANIMATION ========================================================= */
function varexInstallStaffLogoutUI(){

if(document.getElementById("varexStaffLogoutOverlay"))return;

const o=document.createElement("div");

o.id="varexStaffLogoutOverlay";
o.className="varex-staff-logout-overlay";

o.innerHTML=`
<div class="varex-staff-logout-card">

<div class="varex-staff-logout-brand">
VAREX
</div>

<div
class="varex-staff-logout-loader"
id="varexStaffLogoutLoader">
</div>

<div
class="varex-staff-logout-success"
id="varexStaffLogoutSuccess">
✓
</div>

<h2 id="varexStaffLogoutTitle">
جاري حفظ البيانات والإعدادات...
</h2>

<p id="varexStaffLogoutMessage">
يرجى الانتظار.
</p>

<div class="varex-staff-logout-progress">

<div
class="varex-staff-logout-progress-bar"
id="varexStaffLogoutProgressBar">
</div>

</div>

</div>
`;

document.body.appendChild(o)
}

/* ========================================================= CONFIRM ========================================================= */
let varexConfirmResolve=null;
let varexConfirmBypass=false;

function varexInstallConfirmUI(){

if(document.getElementById("varexConfirmOverlay"))return;

const o=document.createElement("div");

o.id="varexConfirmOverlay";
o.className="varex-confirm-overlay";

o.innerHTML=`
<div class="varex-confirm-card">

<div class="varex-confirm-brand">VAREX</div>

<div class="varex-confirm-icon">!</div>

<h2 id="varexConfirmTitle">
تأكيد العملية
</h2>

<p id="varexConfirmMessage">
هل تريد متابعة العملية؟
</p>

<div class="varex-confirm-actions">

<button id="varexConfirmYes">
تأكيد
</button>

<button id="varexConfirmNo">
إلغاء
</button>

</div>

</div>
`;

document.body.appendChild(o);

document.getElementById("varexConfirmYes").onclick=
()=>varexCloseConfirm(true);

document.getElementById("varexConfirmNo").onclick=
()=>varexCloseConfirm(false)
}

function varexOpenConfirm(m,o={}){

varexInstallConfirmUI();

document.getElementById("varexConfirmTitle").textContent=
o.title||
(
String(m).includes("حذف")
?"تأكيد الحذف"
:String(m).includes("إلغاء")
?"تأكيد الإلغاء"
:"تأكيد العملية"
);

document.getElementById("varexConfirmMessage").textContent=
m||"هل تريد متابعة العملية؟";

document.getElementById("varexConfirmYes").textContent=
o.confirmText||
(
String(m).includes("حذف")
?"نعم، حذف"
:"تأكيد"
);

document.getElementById("varexConfirmOverlay").classList.add("show")
}

function varexCloseConfirm(r){

document.getElementById("varexConfirmOverlay")?.classList.remove("show");

if(varexConfirmResolve){

const x=varexConfirmResolve;

varexConfirmResolve=null;

x(!!r)

}
}

function varexConfirm(m,o={}){
return new Promise(r=>{
varexConfirmResolve=r;
varexOpenConfirm(m,o)
})
}

window.varexConfirm=VAREX.confirm=varexConfirm;

window.confirm=function(m){

if(varexConfirmBypass)return true;

varexOpenConfirm(
m||"هل تريد متابعة العملية؟"
);

return false
};

function varexLooksLikeConfirmAction(el){

const t=String(el?.textContent||el?.value||"").toLowerCase();
const c=String(el?.className||"").toLowerCase();
const oc=String(el?.getAttribute?.("onclick")||"").toLowerCase();

return oc.includes("confirm(")||
["حذف","مسح","إلغاء","الغاء","استعادة","إعادة","delete","remove","cancel","reset"]
.some(w=>t.includes(w)||c.includes(w))
}

function varexGuessConfirmMessage(el){

const t=String(el?.textContent||"");

if(t.includes("حذف")||t.includes("مسح")){
return"هل تريد حذف هذا العنصر؟"
}

if(t.includes("إلغاء")||t.includes("الغاء")){
return"هل تريد إلغاء هذه العملية؟"
}

return"هل تريد متابعة هذه العملية؟"
}

function varexInstallConfirmInterceptor(){

if(window.__varexConfirmInterceptorInstalled)return;

window.__varexConfirmInterceptorInstalled=true;

document.addEventListener("click",async e=>{

if(varexConfirmBypass)return;

const t=e.target?.closest?.(
"button,a,[role='button'],input[type='button'],input[type='submit']"
);

if(
!t||
t.closest(
"#varexConfirmOverlay,#varexLogoutOverlay,#varexStaffOverlay,#varexStaffLogoutOverlay"
)||
!varexLooksLikeConfirmAction(t)
){
return
}

e.preventDefault();
e.stopPropagation();
e.stopImmediatePropagation();

if(!await varexConfirm(varexGuessConfirmMessage(t)))return;

varexConfirmBypass=true;

const old=window.confirm;

window.confirm=()=>true;

try{

t.click()

}finally{

setTimeout(()=>{

window.confirm=old;
varexConfirmBypass=false

},0)

}

},true)
}

/* ========================================================= FINANCIAL FORMAT ========================================================= */
function varexFormatFinancialNumbers(root=document){

const sel="[data-varex-money],[data-money],[data-currency],[data-amount],[id*='amount' i],[id*='total' i],[id*='price' i],[id*='cost' i],[id*='paid' i],[id*='balance' i],[class*='amount' i],[class*='total' i],[class*='price' i],[class*='cost' i],.stat-value,.summary-value,.money,.currency,.financial-value";

(root.querySelectorAll?.(sel)||[]).forEach(el=>{

if(
el.matches("input,textarea,select,option")||
el.children.length
){
return
}

const m=String(el.textContent||"").match(
/-?\d[\d,\s]*(?:\.\d+)?/
);

if(!m)return;

const n=VAREX.parseNumber(m[0],NaN);

if(Number.isFinite(n)){
el.textContent=
el.textContent.replace(
m[0],
VAREX.formatNumber(n,2)
)
}

})
}

function varexInstallFinancialFormatting(){

varexFormatFinancialNumbers(document);

new MutationObserver(()=>{

clearTimeout(window.__vft);

window.__vft=setTimeout(()=>{

varexFormatFinancialNumbers(document)

},50)

}).observe(document.body,{
subtree:true,
childList:true,
characterData:true
})
}

window.varexFormatNumber=(v,d=2)=>VAREX.formatNumber(v,d);
window.varexFormatMoney=v=>VAREX.money(v);
window.varexParseNumber=(v,f=0)=>VAREX.parseNumber(v,f);
window.varexFormatFinancialNumbers=varexFormatFinancialNumbers;

/* ========================================================= TYPOGRAPHY ========================================================= */
function varexGetTypography(){

let t={};

try{
t=JSON.parse(localStorage.getItem("varexTypography")||"{}")||{}
}catch(e){}

const f=t.fontFamily||"Arial,Tahoma,sans-serif";
const z=Math.max(8,Math.min(36,Number(t.fontSize||13)));

return{
mainFontFamily:t.mainFontFamily||f,
mainFontSize:Math.max(12,Math.min(48,Number(t.mainFontSize||18))),
subFontFamily:t.subFontFamily||f,
subFontSize:Math.max(8,Math.min(36,Number(t.subFontSize||z))),
bold:!!t.bold,
italic:!!t.italic,
underline:!!t.underline
}
}

function varexApplyGlobalTypography(){

const t=varexGetTypography();
const r=document.documentElement.style;

r.setProperty("--varex-main-font",t.mainFontFamily);
r.setProperty("--varex-main-size",t.mainFontSize+"px");
r.setProperty("--varex-sub-font",t.subFontFamily);
r.setProperty("--varex-sub-size",t.subFontSize+"px");

let s=document.getElementById("varexGlobalTypographyStyles");

if(!s){

s=document.createElement("style");

s.id="varexGlobalTypographyStyles";

document.head.appendChild(s)

}

s.textContent=`
body,input,select,textarea,button,table{
font-family:${t.subFontFamily}!important
}

body{
font-size:${t.subFontSize}px!important
}

p,label,input,select,textarea,button,td,th,.nav-label,.chip,.info-chip{
font-size:${t.subFontSize}px!important
}

h1,h2,h3,h4,h5,h6,.logo{
font-family:${t.mainFontFamily}!important
}

h1,.hero h1{
font-size:${Math.min(58,t.mainFontSize+7)}px!important
}

h2,.page-name h2{
font-size:${Math.min(52,t.mainFontSize+2)}px!important
}
`;

document.body?.classList.toggle("varex-font-bold",t.bold);
document.body?.classList.toggle("varex-font-italic",t.italic);
document.body?.classList.toggle("varex-font-underline",t.underline)
}

window.varexApplyGlobalTypography=varexApplyGlobalTypography;

/* ========================================================= MENU ========================================================= */
const VAREX_SIDEBAR_SCROLL_KEY="varex_sidebar_scroll_position";

function varexGetSidebar(){
return document.querySelector(".sidebar")
}

function varexSaveSidebarScroll(){

const s=varexGetSidebar();

if(s){

sessionStorage.setItem(
VAREX_SIDEBAR_SCROLL_KEY,
String(s.scrollTop||0)
);

localStorage.setItem(
VAREX_SIDEBAR_SCROLL_KEY,
String(s.scrollTop||0)
)

}
}

function varexRestoreSidebarScroll(){

const s=varexGetSidebar();

if(!s)return;

const v=Number(
sessionStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||
localStorage.getItem(VAREX_SIDEBAR_SCROLL_KEY)||
0
);

setTimeout(()=>{

s.scrollTop=
Math.min(
v,
Math.max(0,s.scrollHeight-s.clientHeight)
)

},40)
}

function varexBuildMenu(){

const nav=document.querySelector(".sidebar .nav");

if(!nav)return;

const current=varexCurrentFile();
const operator=VAREX.getStaffSession();

nav.innerHTML=
VAREX_MENU
.filter(([file])=>!operator||varexCanOpen(file))
.map(([file,icon,title])=>`
<a
href="./${file}"
class="${current===file?"active":""}">
<span class="nav-icon">${icon}</span>
<span class="nav-label">${title}</span>
</a>
`)
.join("");

varexAddSidebarActions()
}

function varexAddSidebarActions(){

const nav=document.querySelector(".sidebar .nav");

if(!nav)return;

const box=document.createElement("div");

box.className="varex-sidebar-actions";

box.innerHTML=`
<button type="button" id="varexThemeButton">
<span class="nav-icon" id="varexThemeIcon">🌙</span>
<span id="varexThemeText">الوضع الليلي</span>
</button>

<button type="button" id="varexStaffLogoutButton">
<span class="nav-icon">👤</span>
<span>تسجيل خروج المستخدم</span>
</button>

<button type="button" id="varexLogoutButton">
<span class="varex-power-icon">⏻</span>
<span>تسجيل خروج المنشأة</span>
</button>

<div class="varex-sidebar-bottom-space"></div>
`;

nav.appendChild(box);

varexInstallSharedStyles();
varexInstallLogoutUI();

document.getElementById("varexThemeButton").onclick=
varexToggleTheme;

document.getElementById("varexStaffLogoutButton").onclick=
varexLogoutCurrentUser;

document.getElementById("varexLogoutButton").onclick=
varexOpenLogoutDialog;

varexUpdateThemeButton()
}

/* ========================================================= TOP SWITCH USER ========================================================= */
function varexInstallTopSwitchUserButton(){

document.querySelectorAll(".top-info").forEach(top=>{

let btn=
top.querySelector(".varex-top-switch-user");

if(!btn){

btn=document.createElement("button");

btn.type="button";

btn.className=
"info-chip varex-top-switch-user";

btn.innerHTML=`
<span>👥</span>
<strong>تبديل المستخدم</strong>
`;

btn.onclick=e=>{

e.preventDefault();
e.stopPropagation();

varexSwitchUser()

};

top.insertBefore(
btn,
top.firstChild
)

}

})
}

/* ========================================================= LOGOUT BUSINESS ========================================================= */
function varexInstallLogoutUI(){

if(document.getElementById("varexLogoutOverlay"))return;

const o=document.createElement("div");

o.id="varexLogoutOverlay";
o.className="varex-logout-overlay";

o.innerHTML=`
<div class="varex-logout-card">

<div class="varex-logout-brand">
VAREX
</div>

<h2>
تسجيل خروج المنشأة
</h2>

<p>
سيتم الخروج من حساب المنشأة بالكامل. للدخول إلى هذه المنشأة مرة أخرى ستحتاج إلى البريد الإلكتروني وكلمة مرور المالك.
</p>

<div class="varex-logout-actions">

<button id="varexLogoutConfirm">
تأكيد تسجيل خروج المنشأة
</button>

<button id="varexLogoutCancel">
البقاء في النظام
</button>

</div>

</div>
`;

document.body.appendChild(o);

document.getElementById("varexLogoutCancel").onclick=
()=>o.classList.remove("show");

document.getElementById("varexLogoutConfirm").onclick=
async()=>{

const b=document.getElementById("varexLogoutConfirm");

if(b.disabled)return;

b.disabled=true;

b.textContent=
"جاري تسجيل الخروج...";

await VAREX.logout(true)

}
}

function varexOpenLogoutDialog(){

varexInstallLogoutUI();

document
.getElementById("varexLogoutOverlay")
?.classList.add("show")
}

/* ========================================================= STYLES ========================================================= */
function varexInstallSharedStyles(){

if(document.getElementById("varexSharedStyles"))return;

const s=document.createElement("style");

s.id="varexSharedStyles";

s.textContent=`

:root{
--sidebar-width:265px!important
}

.main{
margin-right:var(--sidebar-width)!important;
padding-bottom:180px!important
}

.content,
main.content,
.page-content,
.main-content{
padding-bottom:180px!important
}

.sidebar{
position:fixed!important;
top:0!important;
right:0!important;
bottom:0!important;
width:var(--sidebar-width)!important;
height:100dvh!important;
overflow-y:auto!important;
overflow-x:hidden!important;
z-index:1000!important
}

.sidebar .nav{
width:100%!important;
padding:16px 14px 0!important
}

.sidebar .nav a,
.varex-sidebar-actions button{
width:100%!important;
height:50px!important;
display:flex!important;
align-items:center!important;
gap:12px!important;
padding:0 15px!important;
margin-bottom:8px!important;
border-radius:11px!important;
font-weight:700!important
}

.sidebar .nav a{
background:rgba(255,255,255,.055)!important;
color:#dbeafe!important;
text-decoration:none!important;
border-bottom:3px solid rgba(5,14,37,.44)!important
}

.sidebar .nav a.active{
background:#fff!important;
color:#172554!important;
border-bottom-color:#94a3b8!important
}

.varex-sidebar-actions{
margin-top:18px;
padding-top:15px;
border-top:1px solid rgba(255,255,255,.12)
}

.varex-sidebar-actions button{
background:#fff!important;
color:#172554!important;
border:1px solid #fff!important;
border-bottom:3px solid #94a3b8!important;
cursor:pointer;
transition:
transform .2s ease,
box-shadow .2s ease,
opacity .2s ease!important
}

.varex-sidebar-actions button:active{
transform:translateY(3px)
}

#varexStaffLogoutButton.varex-button-pressing{
transform:translateY(6px)!important;
box-shadow:0 1px 0 #94a3b8!important;
opacity:.92!important
}

.varex-power-icon{
width:29px;
height:29px;
border:2px solid #172554;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center
}

.varex-sidebar-bottom-space{
height:230px!important;
min-height:230px!important
}

.varex-top-switch-user{
border:1px solid #172554!important;
cursor:pointer!important;
font-family:inherit!important
}

.varex-top-switch-user span{
margin-left:6px
}

.varex-top-switch-user strong{
margin:0!important
}

/* STAFF SELECT */

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
pointer-events:none;
transition:
opacity .42s ease,
visibility .42s ease
}

.varex-staff-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}

.varex-staff-overlay.varex-login-leaving{
opacity:0!important
}

.varex-staff-card{
width:min(560px,96vw);
max-height:88vh;
overflow-y:auto;
background:#fff;
border-radius:26px;
padding:30px;
box-shadow:0 35px 100px rgba(0,0,0,.45);
text-align:center;
transition:
transform .48s cubic-bezier(.2,.8,.2,1),
opacity .4s ease
}

.varex-staff-overlay.varex-login-leaving .varex-staff-card{
transform:scale(.97) translateY(-12px);
opacity:0
}

.varex-staff-brand{
font-size:32px;
font-weight:900;
letter-spacing:6px;
color:#172554;
direction:ltr;
margin-bottom:14px
}

.varex-staff-card h2{
font-size:22px;
color:#172554
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
transition:.18s
}

.varex-staff-user:hover{
border-color:#172554;
transform:translateY(-2px);
box-shadow:0 6px 0 #cbd5e1
}

.varex-staff-user:active{
transform:translateY(3px);
box-shadow:0 1px 0 #cbd5e1
}

.varex-staff-user.owner{
background:#eef2ff
}

.varex-staff-avatar{
width:43px;
height:43px;
border-radius:12px;
background:#172554;
color:#fff;
display:flex;
align-items:center;
justify-content:center;
font-size:20px
}

.varex-staff-user strong{
display:block;
color:#172554;
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
display:block;
animation:varexPasswordOpen .3s ease
}

@keyframes varexPasswordOpen{
from{
opacity:0;
transform:translateY(10px)
}
to{
opacity:1;
transform:translateY(0)
}
}

.varex-selected-user{
font-weight:800;
color:#172554;
margin-bottom:10px
}

.varex-staff-password input{
width:100%;
height:46px;
border:1px solid #cbd5e1;
border-radius:10px;
padding:0 12px;
font-size:14px
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
background:#172554;
color:#fff;
border:0;
display:flex;
align-items:center;
justify-content:center;
gap:8px;
transition:
transform .18s ease,
background .25s ease
}

.varex-staff-login-actions button:first-child:active{
transform:translateY(3px)
}

.varex-staff-login-actions button:last-child{
background:#f1f5f9;
color:#172554;
border:1px solid #cbd5e1
}

#varexStaffLoginBtn.varex-login-processing{
background:#172554!important;
color:#fff!important;
cursor:wait!important
}

#varexStaffLoginBtn.varex-login-success{
background:#15803d!important;
color:#fff!important
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

@keyframes varexMiniSpinner{
to{
transform:rotate(360deg)
}
}

/* USER LOGOUT PROCESS */

.varex-staff-logout-overlay{
position:fixed;
inset:0;
z-index:10000000;
background:rgba(3,10,28,.86);
backdrop-filter:blur(12px);
display:flex;
align-items:center;
justify-content:center;
padding:20px;
opacity:0;
visibility:hidden;
pointer-events:none;
transition:
opacity .42s ease,
visibility .42s ease
}

.varex-staff-logout-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}

.varex-staff-logout-overlay.varex-staff-logout-leaving{
opacity:0!important
}

.varex-staff-logout-card{
width:min(520px,94vw);
min-height:340px;
background:#fff;
border-radius:26px;
padding:35px;
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-align:center;
box-shadow:0 35px 100px rgba(0,0,0,.45);
transition:
transform .45s ease,
opacity .4s ease
}

.varex-staff-logout-overlay.varex-staff-logout-leaving
.varex-staff-logout-card{
transform:scale(.97) translateY(-10px);
opacity:0
}

.varex-staff-logout-brand{
font-size:31px;
font-weight:900;
letter-spacing:6px;
direction:ltr;
color:#172554;
margin-bottom:24px
}

.varex-staff-logout-loader{
width:52px;
height:52px;
border-radius:50%;
border:4px solid #dbe3ef;
border-top-color:#172554;
margin-bottom:20px;
animation:varexLogoutSpin .8s linear infinite
}

@keyframes varexLogoutSpin{
to{
transform:rotate(360deg)
}
}

.varex-staff-logout-success{
display:none;
width:58px;
height:58px;
border-radius:50%;
align-items:center;
justify-content:center;
background:#dcfce7;
border:2px solid #22c55e;
color:#15803d;
font-size:30px;
font-weight:900;
margin-bottom:20px;
animation:varexSuccessPop .4s ease
}

@keyframes varexSuccessPop{
from{
opacity:0;
transform:scale(.65)
}
to{
opacity:1;
transform:scale(1)
}
}

.varex-staff-logout-card h2{
font-size:21px;
color:#172554;
margin-bottom:10px
}

.varex-staff-logout-card p{
font-size:12px;
line-height:1.8;
color:#64748b
}

.varex-staff-logout-progress{
width:82%;
height:8px;
border-radius:20px;
background:#e2e8f0;
overflow:hidden;
margin-top:26px
}

.varex-staff-logout-progress-bar{
width:0;
height:100%;
background:linear-gradient(90deg,#172554,#31548c);
transition:width .7s ease
}

/* CONFIRM + BUSINESS LOGOUT */

.varex-confirm-overlay,
.varex-logout-overlay{
position:fixed;
inset:0;
z-index:9999998;
background:rgba(4,12,32,.75);
display:flex;
align-items:center;
justify-content:center;
padding:20px;
opacity:0;
visibility:hidden;
pointer-events:none;
transition:.25s
}

.varex-confirm-overlay.show,
.varex-logout-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}

.varex-confirm-card,
.varex-logout-card{
width:min(520px,94vw);
background:#fff;
border-radius:24px;
padding:32px;
text-align:center;
box-shadow:0 30px 90px rgba(0,0,0,.4)
}

.varex-confirm-brand,
.varex-logout-brand{
font-size:29px;
font-weight:900;
letter-spacing:6px;
color:#172554;
direction:ltr;
margin-bottom:17px
}

.varex-confirm-icon{
width:52px;
height:52px;
border-radius:50%;
background:#eef2ff;
color:#172554;
display:flex;
align-items:center;
justify-content:center;
margin:0 auto 14px;
font-size:25px;
font-weight:900
}

.varex-confirm-actions,
.varex-logout-actions{
display:flex;
gap:12px;
margin-top:24px
}

.varex-confirm-actions button,
.varex-logout-actions button{
flex:1;
height:50px;
border-radius:11px;
font-weight:800;
cursor:pointer
}

.varex-confirm-actions button:first-child,
.varex-logout-actions button:first-child{
background:#172554;
color:#fff;
border:0
}

.varex-confirm-actions button:last-child,
.varex-logout-actions button:last-child{
background:#fff;
color:#172554;
border:1px solid #cbd5e1
}

/* DARK */

body.varex-dark .varex-staff-card,
body.varex-dark .varex-confirm-card,
body.varex-dark .varex-logout-card,
body.varex-dark .varex-staff-logout-card{
background:#132641;
color:#fff
}

body.varex-dark .varex-staff-card h2,
body.varex-dark .varex-staff-brand,
body.varex-dark .varex-selected-user,
body.varex-dark .varex-confirm-brand,
body.varex-dark .varex-logout-brand,
body.varex-dark .varex-staff-logout-brand,
body.varex-dark .varex-staff-logout-card h2{
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

body.varex-dark .varex-staff-logout-card p{
color:#cbd5e1
}

body.varex-dark .varex-staff-logout-progress{
background:#29415f
}

body.varex-dark .varex-staff-logout-loader{
border-color:#29415f;
border-top-color:#fff
}

@media(max-width:750px){
.varex-top-switch-user{
display:none!important
}
}

@media(max-width:600px){

.varex-staff-card{
padding:23px 17px
}

.varex-confirm-actions,
.varex-logout-actions,
.varex-staff-login-actions{
flex-direction:column
}

.varex-staff-logout-card{
min-height:310px;
padding:28px 20px
}

}
`;

document.head.appendChild(s)
}

/* ========================================================= THEME + SIDEBAR ========================================================= */
function varexInstallSidebarScroll(){

const s=varexGetSidebar();

if(!s)return;

varexRestoreSidebarScroll();

s.addEventListener(
"scroll",
varexSaveSidebarScroll,
{passive:true}
);

window.addEventListener(
"pagehide",
varexSaveSidebarScroll
)
}

function varexResolveThemeMode(){

const m=
localStorage.getItem(
"varexThemeMode"
);

if(m==="dark"||m==="light"){
return m
}

if(m==="system"){
return matchMedia(
"(prefers-color-scheme:dark)"
).matches
?"dark"
:"light"
}

return localStorage.getItem(
"varex_theme"
)||
"light"
}

function varexGetTheme(){
return varexResolveThemeMode()
}

function varexApplyTheme(t){

document.documentElement.setAttribute(
"data-theme",
t
);

document.documentElement.setAttribute(
"data-varex-theme",
t
);

document.body?.classList.toggle(
"varex-dark",
t==="dark"
);

localStorage.setItem(
"varex_theme",
t
);

varexUpdateThemeButton()
}

function varexToggleTheme(){

const n=
varexGetTheme()==="dark"
?"light"
:"dark";

localStorage.setItem(
"varexThemeMode",
n
);

varexApplyTheme(n)
}

function varexUpdateThemeButton(){

const d=
varexGetTheme()==="dark";

const i=
document.getElementById(
"varexThemeIcon"
);

const t=
document.getElementById(
"varexThemeText"
);

if(i){
i.textContent=d?"☀️":"🌙"
}

if(t){
t.textContent=d
?"الوضع النهاري"
:"الوضع الليلي"
}
}

/* ========================================================= CURRENT OPERATOR ========================================================= */
function varexShowCurrentUser(){

const u=
VAREX.getStaffSession()||
VAREX.getOwnerOperator();

document.querySelectorAll(
".info-chip,.chip"
)
.forEach(el=>{

if(
el.classList.contains(
"varex-top-switch-user"
)
){
return
}

if(
el.textContent.includes("المستخدم")||
el.textContent.includes("الحساب")
){

const s=
el.querySelector("strong");

if(s){
s.textContent=
u.name||
"المستخدم"
}

}

});

[
"sidebarUserName",
"topUserName",
"settingsUserName",
"currentUserName",
"currentUser"
]
.forEach(id=>{

const e=
document.getElementById(id);

if(e){
e.textContent=
u.name||
u.username||
"المستخدم"
}

});

const r=
document.getElementById(
"sidebarUserRole"
);

if(r){
r.textContent=
VAREX.roleName(u.role)
}
}

function varexEsc(v){
return String(v??"")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;")
}

function varexEscAttr(v){
return varexEsc(v).replace(/`/g,"")
}

/* ========================================================= START ========================================================= */
function varexStartUI(){

const publicPage=
VAREX.isLoginPage()||
VAREX.isRegisterPage()||
VAREX.isVerifyEmailPage();

if(publicPage)return;

if(!VAREX.requireLogin())return;

if(!VAREX.requireSubscription())return;

varexInstallSharedStyles();

varexInstallStaffUI();

varexInstallStaffLogoutUI();

varexInstallConfirmUI();

varexInstallLogoutUI();

varexApplyTheme(
varexGetTheme()
);

varexApplyGlobalTypography();

varexInstallStaffPasswordCapture();

varexBuildMenu();

varexInstallTopSwitchUserButton();

varexInstallSidebarScroll();

varexInstallFinancialFormatting();

varexInstallConfirmInterceptor();

varexInitStaffAccess();

varexBuildMenu();

varexInstallTopSwitchUserButton();

varexShowCurrentUser()
}

window.addEventListener("storage",e=>{

if(e.key==="varexTypography"){
varexApplyGlobalTypography()
}

if(e.key==="varexThemeMode"){
varexApplyTheme(
varexGetTheme()
)
}

if(e.key===VAREX.keys.staffUsers){

const s=
VAREX.getStaffSession();

if(
s&&
!s.isOwner
){

const u=
VAREX.getStaffUsers()
.find(
x=>
String(x.id)===
String(s.id)
);

if(
!u||
u.status==="disabled"
){
varexLogoutCurrentUser()
}

}

}
});

window.addEventListener("focus",()=>{

varexApplyGlobalTypography();

varexApplyTheme(
varexGetTheme()
);

varexFormatFinancialNumbers(
document
);

varexInstallTopSwitchUserButton();

varexShowCurrentUser()
});

if(
document.readyState===
"loading"
){

document.addEventListener(
"DOMContentLoaded",
varexStartUI
)

}else{

varexStartUI()

}
