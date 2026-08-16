/* ========================================================= VAREX CORE ========================================================= */
const VAREX={config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification",subscription:"varex_subscription",subscriptionGate:"varex_subscription_gate"},
getData(k){try{const x=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(x)?x:[]}catch(e){console.error(e);return[]}},
saveData(k,d){try{localStorage.setItem(k,JSON.stringify(Array.isArray(d)?d:[]));return true}catch(e){console.error(e);return false}},
getObject(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...f,...x}:{...f}}catch(e){return{...f}}},
saveObject(k,d){try{localStorage.setItem(k,JSON.stringify(d||{}));return true}catch(e){console.error(e);return false}},
generateId(p="VRX"){return`${p}-${Date.now()}-${Math.floor(Math.random()*1e6)}`},
parseNumber(v,f=0){if(typeof v==="number")return Number.isFinite(v)?v:f;if(v===null||v===undefined||v==="")return f;let x=String(v).trim().replace(/[,\s]/g,"").replace(/[^\d.\-]/g,"");const first=x.indexOf(".");if(first!==-1)x=x.slice(0,first+1)+x.slice(first+1).replace(/\./g,"");const n=Number(x);return Number.isFinite(n)?n:f},
toNumber(v,f=0){return this.parseNumber(v,f)},
positiveNumber(v){return Math.max(0,this.toNumber(v))},
formatNumber(v,decimals=2){const n=this.toNumber(v,0);let d=Number(decimals);if(!Number.isFinite(d))d=2;d=Math.max(0,Math.min(6,d));return n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d})},
formatQuantity(v){const n=this.toNumber(v,0);return n.toLocaleString("en-US",{maximumFractionDigits:3})},
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
let data={};
try{data=await r.json()}catch(e){}
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
if(m.includes("password"))return"كلمة المرور لا تحقق متطلبات الأمان.";
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
try{const x=JSON.parse(localStorage.getItem(this.keys.pendingVerification)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}
},

clearPendingVerification(){try{localStorage.removeItem(this.keys.pendingVerification)}catch(e){}},

async createUser(user={}){
const name=this.cleanText(user.name),username=this.normalizeUsername(user.username),email=this.normalizeEmail(user.email),password=String(user.password||"");

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
const mail=this.normalizeEmail(email),code=this.cleanText(token).replace(/\s+/g,"");

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

return{
success:true,
user:this.getSafeUser(d.user),
message:"تم تأكيد البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول."
}

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async resendConfirmation(email){
const mail=this.normalizeEmail(email);

if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};

try{
await this.authFetch("/auth/v1/resend",{
method:"POST",
body:JSON.stringify({
type:"signup",
email:mail
})
});

return{
success:true,
message:"تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني."
}

}catch(e){
return{
success:false,
message:this.mapAuthError(e)
}
}
},

async login(login,password,remember=false){

const identifier=this.cleanText(login),
pw=String(password||"");

if(!identifier||!pw){
return{
success:false,
message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."
}
}

if(!identifier.includes("@")){
return{
success:false,
message:"حالياً سجّل الدخول بالبريد الإلكتروني."
}
}

try{

const d=await this.authFetch(
"/auth/v1/token?grant_type=password",
{
method:"POST",
body:JSON.stringify({
email:this.normalizeEmail(identifier),
password:pw
})
}
);

if(!d.access_token||!d.user){
return{
success:false,
message:"تعذر إنشاء جلسة المستخدم."
}
}

this.storeSession(d,remember);

localStorage.setItem(
this.keys.rememberedUser,
remember?identifier:""
);

this.clearPendingVerification();

return{
success:true,
user:this.getSafeUser(d.user)
}

}catch(e){

return{
success:false,
message:this.mapAuthError(e)
}

}
},

storeSession(s,remember=false){

const x={
access_token:s.access_token,
refresh_token:s.refresh_token,
expires_in:s.expires_in,
expires_at:s.expires_at||
Math.floor(Date.now()/1000)+(s.expires_in||3600),
token_type:s.token_type||"bearer",
user:s.user,
remember:Boolean(remember)
};

const str=JSON.stringify(x);

if(remember){

localStorage.setItem(
this.keys.session,
str
);

sessionStorage.removeItem(
this.keys.session
);

}else{

sessionStorage.setItem(
this.keys.session,
str
);

localStorage.removeItem(
this.keys.session
);

}

localStorage.setItem(
this.keys.cachedUser,
JSON.stringify(
this.getSafeUser(s.user)
)
);

return x
},

getSession(){

const raw=
sessionStorage.getItem(
this.keys.session
)||
localStorage.getItem(
this.keys.session
);

if(!raw)return null;

try{

const s=JSON.parse(raw);

return(
s?.access_token&&
s?.user
)
?s
:null

}catch(e){

return null

}
},

isLoggedIn(){
return!!this.getSession()
},

getCurrentUser(){

const s=this.getSession();

if(s?.user){
return this.getSafeUser(
s.user
)
}

try{

return JSON.parse(
localStorage.getItem(
this.keys.cachedUser
)||
"null"
)

}catch(e){

return null

}
},

getRememberedUser(){
return localStorage.getItem(
this.keys.rememberedUser
)||""
},

async refreshSession(){

const s=this.getSession();

if(!s?.refresh_token){
return false
}

if(
(s.expires_at||0)>
Math.floor(Date.now()/1000)+60
){
return true
}

try{

const d=
await this.authFetch(
"/auth/v1/token?grant_type=refresh_token",
{
method:"POST",
body:JSON.stringify({
refresh_token:s.refresh_token
})
}
);

this.storeSession(
d,
s.remember
);

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

await this.authFetch(
"/auth/v1/logout",
{
method:"POST"
}
)

}

}catch(e){}

sessionStorage.removeItem(
this.keys.session
);

localStorage.removeItem(
this.keys.session
);

localStorage.removeItem(
this.keys.cachedUser
);

sessionStorage.removeItem(
"varex_authenticated"
);

localStorage.removeItem(
"varex_authenticated"
);

if(redirect){
location.replace(
"./login.html"
)
}

return true
},

requireLogin(){

if(
this.isLoginPage()||
this.isRegisterPage()||
this.isVerifyEmailPage()
){
return true
}

if(!this.isLoggedIn()){

location.replace(
"./login.html"
);

return false

}

this.refreshSession();

return true
},

isLoginPage(){
return location.pathname
.toLowerCase()
.endsWith("login.html")
},

isRegisterPage(){
return location.pathname
.toLowerCase()
.endsWith("register.html")
},

isVerifyEmailPage(){
return location.pathname
.toLowerCase()
.endsWith("verify-email.html")
},

redirectLoggedUser(){

if(
(
this.isLoginPage()||
this.isRegisterPage()
)&&
this.isLoggedIn()
){

location.replace(
"./index.html"
);

return true

}

return false
},

async requestPasswordReset(email){

const mail=
this.normalizeEmail(email);

if(!mail){

return{
success:false,
message:"يرجى إدخال البريد الإلكتروني."
}

}

try{

await this.authFetch(
"/auth/v1/recover",
{
method:"POST",
body:JSON.stringify({
email:mail
})
}
);

return{
success:true,
message:"تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."
}

}catch(e){

return{
success:false,
message:this.mapAuthError(e)
}

}
},

async updateCurrentUser(changes={}){

const s=this.getSession();

if(!s){

return{
success:false,
message:"لا يوجد مستخدم مسجل الدخول."
}

}

const body={};

if(
changes.email!==undefined
){
body.email=
this.normalizeEmail(
changes.email
)
}

const data={};

[
"name",
"username",
"role"
].forEach(k=>{

if(
changes[k]!==undefined
){

data[k]=
this.cleanText(
changes[k]
)

}

});

if(
Object.keys(data).length
){

body.data={
...(s.user.user_metadata||{}),
...data
}

}

try{

const u=
await this.authFetch(
"/auth/v1/user",
{
method:"PUT",
body:JSON.stringify(body)
}
);

s.user=u;

this.storeSession(
s,
s.remember
);

return{
success:true,
user:this.getSafeUser(u)
}

}catch(e){

return{
success:false,
message:this.mapAuthError(e)
}

}
},

async changePassword(currentPassword,newPassword){

if(
String(newPassword||"")
.length<6
){

return{
success:false,
message:"كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."
}

}

const s=this.getSession();

if(!s){

return{
success:false,
message:"يجب تسجيل الدخول أولاً."
}

}

try{

const u=
await this.authFetch(
"/auth/v1/user",
{
method:"PUT",
body:JSON.stringify({
password:String(newPassword)
})
}
);

s.user=u;

this.storeSession(
s,
s.remember
);

return{
success:true,
message:"تم تغيير كلمة المرور بنجاح."
}

}catch(e){

return{
success:false,
message:this.mapAuthError(e)
}

}
},

/* SUBSCRIPTION */

getSubscription(){

const d={
plan:"",
planName:"",
status:"inactive",
billingType:"",
price:0,
currency:"AED",
startedAt:"",
expiresAt:"",
lifetime:false,
licenseKey:"",
paymentStatus:"unpaid",
updatedAt:""
};

try{

const x=
JSON.parse(
localStorage.getItem(
this.keys.subscription
)||
"null"
);

return(
x&&
typeof x==="object"&&
!Array.isArray(x)
)
?{...d,...x}
:{...d}

}catch(e){

return{...d}

}
},

saveSubscription(data={}){

const x={
...this.getSubscription(),
...data,
updatedAt:this.now()
};

try{

localStorage.setItem(
this.keys.subscription,
JSON.stringify(x)
);

return x

}catch(e){

return false

}
},

generateLicenseKey(){

const chars=
"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let result="VAREX";

for(let g=0;g<4;g++){

result+="-";

for(let i=0;i<4;i++){

result+=
chars[
Math.floor(
Math.random()*chars.length
)
]

}

}

return result
},

activateSubscription(options={}){

const type=
String(
options.billingType||
options.type||
"monthly"
);

const now=new Date();

let expiresAt="";
let lifetime=false;

if(type==="monthly"){

const expiry=new Date(now);

expiry.setMonth(
expiry.getMonth()+1
);

expiresAt=
expiry.toISOString()

}else if(type==="yearly"){

const expiry=new Date(now);

expiry.setFullYear(
expiry.getFullYear()+1
);

expiresAt=
expiry.toISOString()

}else if(type==="lifetime"){

lifetime=true

}

return this.saveSubscription({

plan:
options.plan||
"business",

planName:
options.planName||
"VAREX Business",

billingType:type,

price:
this.positiveNumber(
options.price
),

currency:
options.currency||
"AED",

status:"active",

paymentStatus:
options.paymentStatus||
"paid",

startedAt:
now.toISOString(),

expiresAt,

lifetime,

licenseKey:
options.licenseKey||
this.generateLicenseKey()

})

},

cancelSubscription(){

return this.saveSubscription({
...this.getSubscription(),
status:"cancelled"
})

},

expireSubscription(){

return this.saveSubscription({
...this.getSubscription(),
status:"expired"
})

},

isSubscriptionActive(){

const s=
this.getSubscription();

if(s.status!=="active"){
return false
}

if(
s.lifetime===true||
s.billingType==="lifetime"
){
return true
}

if(!s.expiresAt){
return false
}

const expiry=
new Date(s.expiresAt);

if(
Number.isNaN(
expiry.getTime()
)
){
return false
}

if(
expiry.getTime()<=
Date.now()
){

this.expireSubscription();

return false

}

return true
},

getSubscriptionDaysRemaining(){

const s=
this.getSubscription();

if(
s.lifetime===true||
s.billingType==="lifetime"
){
return Infinity
}

if(!s.expiresAt){
return 0
}

const expiry=
new Date(s.expiresAt);

if(
Number.isNaN(
expiry.getTime()
)
){
return 0
}

return Math.max(
0,
Math.ceil(
(
expiry.getTime()-
Date.now()
)/
86400000
)
)

},

getSubscriptionStatus(){

const subscription=
this.getSubscription();

return{
...subscription,
active:
this.isSubscriptionActive(),
daysRemaining:
this.getSubscriptionDaysRemaining()
}

},

isSubscriptionPage(){
return location.pathname
.toLowerCase()
.endsWith(
"subscription.html"
)
},

isSubscriptionSuccessPage(){
return location.pathname
.toLowerCase()
.endsWith(
"subscription-success.html"
)
},

isSubscriptionGateEnabled(){
return localStorage.getItem(
this.keys.subscriptionGate
)==="true"
},

enableSubscriptionGate(){

localStorage.setItem(
this.keys.subscriptionGate,
"true"
);

return true
},

disableSubscriptionGate(){

localStorage.setItem(
this.keys.subscriptionGate,
"false"
);

return true
},

requireSubscription(){

if(
!this.isSubscriptionGateEnabled()
){
return true
}

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

location.replace(
"./login.html"
);

return false

}

if(
!this.isSubscriptionActive()
){

location.replace(
"./subscription.html"
);

return false

}

return true
},

/* BUSINESS DATA */

getProducts(){
return this.getData(
this.keys.products
)
},

saveProducts(x){
return this.saveData(
this.keys.products,
x
)
},

getProductById(id){

return this.getProducts()
.find(
x=>
String(x.id)===
String(id)
)||
null

},

findProductByBarcode(b){

b=this.cleanText(b);

return this.getProducts()
.find(
x=>
this.cleanText(x.barcode)===
b
)||
null

},

addProduct(p={}){

const a=
this.getProducts();

const x={
...p,
id:
p.id||
this.generateId("PRD"),
name:
this.cleanText(
p.name||
p.productName
),
quantity:
this.positiveNumber(
p.quantity
),
price:
this.positiveNumber(
p.price||
p.salePrice
),
cost:
this.positiveNumber(
p.cost||
p.costPrice
),
createdAt:
p.createdAt||
this.now(),
updatedAt:
this.now()
};

a.push(x);

this.saveProducts(a);

return x
},

updateProduct(id,c={}){

const a=
this.getProducts();

const i=
a.findIndex(
x=>
String(x.id)===
String(id)
);

if(i<0){
return false
}

a[i]={
...a[i],
...c,
id:a[i].id,
updatedAt:this.now()
};

this.saveProducts(a);

return a[i]
},

deleteProduct(id){

const a=
this.getProducts();

const b=
a.filter(
x=>
String(x.id)!==
String(id)
);

this.saveProducts(b);

return b.length!==a.length
},

adjustStock(id,n){

const a=
this.getProducts();

const i=
a.findIndex(
x=>
String(x.id)===
String(id)
);

if(i<0){
return false
}

a[i].quantity=
Math.max(
0,
this.toNumber(
a[i].quantity
)+
this.toNumber(n)
);

a[i].updatedAt=
this.now();

this.saveProducts(a);

return a[i]
},

getSales(){
return this.getData(
this.keys.sales
)
},

saveSales(x){
return this.saveData(
this.keys.sales,
x
)
},

getSaleById(id){

return this.getSales()
.find(
x=>
String(x.id)===
String(id)
)||
null

},

addSale(s={}){

const a=
this.getSales();

const x={
...s,
id:
s.id||
this.generateId("SAL"),
invoiceNumber:
s.invoiceNumber||
`INV-${Date.now()}`,
createdAt:
s.createdAt||
this.now(),
date:
s.date||
this.now(),
updatedAt:
this.now()
};

a.push(x);

this.saveSales(a);

return x
},

deleteSale(id){

const a=
this.getSales();

const b=
a.filter(
x=>
String(x.id)!==
String(id)
);

this.saveSales(b);

return b.length!==a.length
},

completeSale(s={}){

const items=
Array.isArray(s.items)
?s.items
:[];

if(!items.length){

return{
success:false,
message:"لا توجد منتجات في الفاتورة."
}

}

const p=
this.getProducts();

for(
const x of items
){

const i=
p.findIndex(
y=>
String(y.id)===
String(
x.productId||
x.id
)
);

const q=
this.positiveNumber(
x.quantity||
x.qty||
1
);

if(
i>=0&&
q>
this.toNumber(
p[i].quantity
)
){

return{
success:false,
message:
"الكمية غير متوفرة للمنتج: "+
(p[i].name||"")
}

}

}

for(
const x of items
){

const i=
p.findIndex(
y=>
String(y.id)===
String(
x.productId||
x.id
)
);

const q=
this.positiveNumber(
x.quantity||
x.qty||
1
);

if(i>=0){

p[i].quantity=
Math.max(
0,
this.toNumber(
p[i].quantity
)-q
);

p[i].updatedAt=
this.now()

}

}

this.saveProducts(p);

return{
success:true,
sale:
this.addSale(s)
}

},

getCustomers(){
return this.getData(
this.keys.customers
)
},

saveCustomers(x){
return this.saveData(
this.keys.customers,
x
)
},

addCustomer(x={}){
return this._add(
this.keys.customers,
"CUS",
x
)
},

updateCustomer(id,c={}){
return this._update(
this.keys.customers,
id,
c
)
},

deleteCustomer(id){
return this._delete(
this.keys.customers,
id
)
},

getSuppliers(){
return this.getData(
this.keys.suppliers
)
},

saveSuppliers(x){
return this.saveData(
this.keys.suppliers,
x
)
},

addSupplier(x={}){
return this._add(
this.keys.suppliers,
"SUP",
x
)
},

updateSupplier(id,c={}){
return this._update(
this.keys.suppliers,
id,
c
)
},

deleteSupplier(id){
return this._delete(
this.keys.suppliers,
id
)
},

getEmployees(){
return this.getData(
this.keys.employees
)
},

saveEmployees(x){
return this.saveData(
this.keys.employees,
x
)
},

addEmployee(x={}){
return this._add(
this.keys.employees,
"EMP",
x
)
},

updateEmployee(id,c={}){
return this._update(
this.keys.employees,
id,
c
)
},

deleteEmployee(id){
return this._delete(
this.keys.employees,
id
)
},

getTransactions(){
return this.getData(
this.keys.transactions
)
},

saveTransactions(x){
return this.saveData(
this.keys.transactions,
x
)
},

addTransaction(x={}){

x={
...x,
amount:
this.positiveNumber(
x.amount
),
date:
x.date||
this.today()
};

return this._add(
this.keys.transactions,
"TRX",
x
)

},

updateTransaction(id,c={}){
return this._update(
this.keys.transactions,
id,
c
)
},

deleteTransaction(id){
return this._delete(
this.keys.transactions,
id
)
},

getHeldSales(){
return this.getData(
this.keys.heldSales
)
},

saveHeldSales(x){
return this.saveData(
this.keys.heldSales,
x
)
},

holdSale(x={}){
return this._add(
this.keys.heldSales,
"HOLD",
x
)
},

removeHeldSale(id){
return this._delete(
this.keys.heldSales,
id
)
},

getHeldSaleById(id){

return this.getHeldSales()
.find(
x=>
String(x.id)===
String(id)
)||
null

},

_add(k,p,x={}){

const a=
this.getData(k);

const o={
...x,
id:
x.id||
this.generateId(p),
createdAt:
x.createdAt||
this.now(),
updatedAt:
this.now()
};

a.push(o);

this.saveData(
k,
a
);

return o
},

_update(k,id,c={}){

const a=
this.getData(k);

const i=
a.findIndex(
x=>
String(x.id)===
String(id)
);

if(i<0){
return false
}

a[i]={
...a[i],
...c,
id:a[i].id,
updatedAt:this.now()
};

this.saveData(
k,
a
);

return a[i]
},

_delete(k,id){

const a=
this.getData(k);

const b=
a.filter(
x=>
String(x.id)!==
String(id)
);

this.saveData(
k,
b
);

return b.length!==a.length
},

getSettings(){

const d={
businessName:"VAREX",
currency:"AED",
currencySymbol:"د.إ",
taxEnabled:true,
taxRate:5,
lowStockLimit:5,
language:"ar"
};

const p=
this.getObject(
this.keys.settings,
{}
);

let l={};

try{

const x=
JSON.parse(
localStorage.getItem(
"varexSettings"
)||
"null"
);

if(
x&&
typeof x==="object"&&
!Array.isArray(x)
){
l=x
}

}catch(e){}

return{
...d,
...l,
...p
}

},

saveSettings(s={}){

const d={
...this.getSettings(),
...s,
updatedAt:this.now()
};

const ok=
this.saveObject(
this.keys.settings,
d
);

try{

localStorage.setItem(
"varexSettings",
JSON.stringify(d)
)

}catch(e){}

return ok
},

money(v){

const s=
this.getSettings();

const sym=
this.cleanText(
s.currencySymbol
)||
(
s.currency==="AED"
?"د.إ"
:s.currency
);

return`${this.formatNumber(v,2)} ${sym}`

},

calculateTax(v){

const s=
this.getSettings();

return s.taxEnabled===false
?0
:this.positiveNumber(v)*
this.toNumber(
s.taxRate,
5
)/100
},

getTodaySales(){

const t=
this.today();

return this.getSales()
.filter(
s=>
this.normalizeDate(
s.createdAt||
s.date||
s.saleDate||
s.invoiceDate||
""
)===t
)

},

getTodaySalesTotal(){

return this.getTodaySales()
.reduce(
(a,s)=>
a+
this.toNumber(
s.total??
s.grandTotal??
s.finalTotal??
s.netTotal??
s.amount??
0
),
0
)

},

getStockAlerts(){

const l=
this.toNumber(
this.getSettings()
.lowStockLimit,
5
);

return this.getProducts()
.filter(
p=>
this.toNumber(
p.quantity
)<=
this.toNumber(
p.minimumStock,
l
)
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
]
.forEach(k=>{

if(
localStorage.getItem(k)===
null
){
localStorage.setItem(
k,
"[]"
)
}

});

if(
localStorage.getItem(
this.keys.settings
)===
null
){
this.saveSettings(
this.getSettings()
)
}

if(
localStorage.getItem(
this.keys.subscriptionGate
)===
null
){
localStorage.setItem(
this.keys.subscriptionGate,
"false"
)
}

return true
}

};

VAREX.initialize();
window.VAREX=VAREX;


/* ========================================================= GLOBAL VAREX CONFIRM ========================================================= */

let varexConfirmResolve=null;
let varexConfirmOpen=false;
let varexConfirmBypass=false;
let varexConfirmSource=null;

function varexInstallConfirmUI(){

if(
document.getElementById(
"varexConfirmOverlay"
)
){
return
}

const overlay=
document.createElement(
"div"
);

overlay.id=
"varexConfirmOverlay";

overlay.className=
"varex-confirm-overlay";

overlay.innerHTML=`

<div class="varex-confirm-card">

<div class="varex-confirm-brand">
VAREX
</div>

<div class="varex-confirm-icon">
!
</div>

<h2
class="varex-confirm-title"
id="varexConfirmTitle">
تأكيد العملية
</h2>

<p
class="varex-confirm-message"
id="varexConfirmMessage">
هل تريد متابعة العملية؟
</p>

<div class="varex-confirm-actions">

<button
type="button"
class="varex-confirm-yes"
id="varexConfirmYes">
تأكيد
</button>

<button
type="button"
class="varex-confirm-no"
id="varexConfirmNo">
إلغاء
</button>

</div>

</div>
`;

document.body.appendChild(
overlay
);

document
.getElementById(
"varexConfirmNo"
)
?.addEventListener(
"click",
()=>varexCloseConfirm(false)
);

document
.getElementById(
"varexConfirmYes"
)
?.addEventListener(
"click",
()=>varexCloseConfirm(true)
);

overlay.addEventListener(
"click",
e=>{

if(
e.target===overlay
){
varexCloseConfirm(false)
}

}
);

document.addEventListener(
"keydown",
e=>{

if(
e.key==="Escape"&&
varexConfirmOpen
){
varexCloseConfirm(false)
}

}
)

}


function varexGetConfirmTitle(message=""){

const m=
String(message||"");

if(
m.includes("حذف")
){
return"تأكيد الحذف"
}

if(
m.includes("تعديل")
){
return"تأكيد التعديل"
}

if(
m.includes("إلغاء")
){
return"تأكيد الإلغاء"
}

if(
m.includes("إعادة")||
m.includes("استعادة")
){
return"تأكيد العملية"
}

return"تأكيد العملية"

}


function varexOpenConfirm(
message,
options={}
){

varexInstallConfirmUI();

const overlay=
document.getElementById(
"varexConfirmOverlay"
);

const title=
document.getElementById(
"varexConfirmTitle"
);

const msg=
document.getElementById(
"varexConfirmMessage"
);

const yes=
document.getElementById(
"varexConfirmYes"
);

const no=
document.getElementById(
"varexConfirmNo"
);

if(title){
title.textContent=
options.title||
varexGetConfirmTitle(message)
}

if(msg){
msg.textContent=
String(
message||
"هل تريد متابعة العملية؟"
)
}

if(yes){
yes.textContent=
options.confirmText||
(
String(message||"")
.includes("حذف")
?"نعم، حذف"
:"تأكيد"
)
}

if(no){
no.textContent=
options.cancelText||
"إلغاء"
}

varexConfirmOpen=true;

overlay?.classList.add(
"show"
);

setTimeout(()=>{
yes?.focus()
},100)

}


function varexCloseConfirm(result){

const overlay=
document.getElementById(
"varexConfirmOverlay"
);

overlay?.classList.remove(
"show"
);

varexConfirmOpen=false;

if(
varexConfirmResolve
){

const resolve=
varexConfirmResolve;

varexConfirmResolve=null;

resolve(Boolean(result))

}

}


function varexConfirm(
message,
options={}
){

return new Promise(resolve=>{

varexConfirmResolve=
resolve;

varexOpenConfirm(
message,
options
)

})

}


window.varexConfirm=
varexConfirm;

VAREX.confirm=
varexConfirm;


/* ========================================================= INTERCEPT OLD BROWSER CONFIRM ========================================================= */

const varexNativeConfirm=
window.confirm.bind(window);

window.confirm=function(message){

if(varexConfirmBypass){
return true
}

varexOpenConfirm(
message||
"هل تريد متابعة العملية؟"
);

return false

};


function varexLooksLikeConfirmAction(el){

if(!el)return false;

const text=
String(
el.textContent||
el.value||
el.getAttribute?.("aria-label")||
el.getAttribute?.("title")||
""
)
.trim()
.toLowerCase();

const cls=
String(
el.className||
""
)
.toLowerCase();

const onclick=
String(
el.getAttribute?.("onclick")||
""
)
.toLowerCase();

if(
onclick.includes("confirm(")
){
return true
}

const words=[
"حذف",
"مسح",
"إلغاء",
"الغاء",
"استعادة",
"إعادة",
"اعادة",
"delete",
"remove",
"cancel",
"reset"
];

return words.some(
w=>
text.includes(w)||
cls.includes(w)
)

}


function varexGuessConfirmMessage(el){

const text=
String(
el.textContent||
el.value||
""
)
.trim();

if(
text.includes("حذف")||
text.includes("مسح")
){
return"هل تريد حذف هذا العنصر؟"
}

if(
text.includes("إلغاء")||
text.includes("الغاء")
){
return"هل تريد إلغاء هذه العملية؟"
}

if(
text.includes("إعادة")||
text.includes("اعادة")||
text.includes("استعادة")
){
return"هل تريد تنفيذ هذه العملية؟"
}

return"هل تريد متابعة هذه العملية؟"

}


function varexInstallConfirmInterceptor(){

if(
window.__varexConfirmInterceptorInstalled
){
return
}

window.__varexConfirmInterceptorInstalled=
true;

document.addEventListener(
"click",
async event=>{

if(varexConfirmBypass){
return
}

const target=
event.target?.closest?.(
"button,a,[role='button'],input[type='button'],input[type='submit']"
);

if(!target){
return
}

if(
target.closest(
"#varexConfirmOverlay,#varexLogoutOverlay"
)
){
return
}

if(
!varexLooksLikeConfirmAction(
target
)
){
return
}

event.preventDefault();
event.stopPropagation();
event.stopImmediatePropagation();

varexConfirmSource=
target;

const approved=
await varexConfirm(
varexGuessConfirmMessage(target)
);

if(!approved){
varexConfirmSource=null;
return
}

varexConfirmBypass=true;

try{

const oldConfirm=
window.confirm;

window.confirm=
()=>true;

if(
target.tagName==="A"&&
target.href
){

if(
target.getAttribute("onclick")
){

target.click()

}else{

location.href=
target.href

}

}else{

target.click()

}

setTimeout(()=>{

window.confirm=
oldConfirm;

varexConfirmBypass=false;

varexConfirmSource=null

},0)

}catch(e){

varexConfirmBypass=false;
varexConfirmSource=null;
window.confirm=
varexNativeConfirm

}

},
true
)

}


/* ========================================================= GLOBAL FINANCIAL NUMBER FORMAT ========================================================= */

const VAREX_FINANCIAL_WORDS=[
"amount","total","subtotal","grandtotal","nettotal","finaltotal",
"price","cost","paid","payment","balance","revenue","income",
"expense","profit","purchase","sales","salary","debt","credit",
"cash","vat","tax",
"مبلغ","اجمالي","إجمالي","المجموع","السعر","سعر","تكلفة",
"التكلفة","مدفوع","المدفوع","دفعة","الدفع","رصيد","الرصيد",
"إيراد","ايراد","مبيعات","مشتريات","مصروف","مصاريف",
"ربح","أرباح","ارباح","راتب","رواتب","دين","ديون",
"نقدي","ضريبة"
];

function varexIsFinancialElement(el){

if(
!el||
el.nodeType!==1
){
return false
}

if(
el.matches(
"[data-varex-money],[data-money],[data-currency],[data-amount]"
)
){
return true
}

const source=[
el.id||"",
el.className||"",
el.getAttribute?.("name")||"",
el.getAttribute?.("data-field")||"",
el.getAttribute?.("data-key")||""
]
.join(" ")
.toLowerCase();

if(
VAREX_FINANCIAL_WORDS
.some(
w=>
source.includes(
String(w)
.toLowerCase()
)
)
){
return true
}

const parentText=
(
el.parentElement?.textContent||
""
)
.slice(0,180)
.toLowerCase();

return VAREX_FINANCIAL_WORDS
.some(
w=>
parentText.includes(
String(w)
.toLowerCase()
)
)

}


function varexExtractFinancialText(text){

const original=
String(
text??""
)
.trim();

if(!original){
return null
}

if(
/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/
.test(original)||
/^\d{1,2}:\d{2}/
.test(original)
){
return null
}

const match=
original.match(
/(-?\d[\d,\s]*(?:\.\d+)?)/
);

if(!match){
return null
}

const raw=
match[1];

const numeric=
VAREX.parseNumber(
raw,
NaN
);

if(
!Number.isFinite(numeric)
){
return null
}

return{
original,
raw,
numeric
}

}


function varexFormatFinancialElement(el){

if(
!el||
el.nodeType!==1
){
return
}

if(
el.matches(
"input,textarea,select,option,script,style"
)||
el.closest(
"script,style"
)
){
return
}

if(
!varexIsFinancialElement(el)
){
return
}

if(
el.children.length>0
){

Array.from(
el.children
)
.forEach(
child=>
varexFormatFinancialElement(
child
)
);

return

}

const data=
varexExtractFinancialText(
el.textContent
);

if(!data){
return
}

const formatted=
VAREX.formatNumber(
data.numeric,
2
);

if(
data.raw===
formatted
){
return
}

el.textContent=
data.original.replace(
data.raw,
formatted
);

el.dataset
.varexNumberFormatted=
"true"

}


function varexFormatFinancialNumbers(root=document){

if(!root){
return
}

const selectors=[
"[data-varex-money]",
"[data-money]",
"[data-currency]",
"[data-amount]",
"[id*='amount' i]",
"[id*='total' i]",
"[id*='price' i]",
"[id*='cost' i]",
"[id*='paid' i]",
"[id*='payment' i]",
"[id*='balance' i]",
"[id*='revenue' i]",
"[id*='income' i]",
"[id*='expense' i]",
"[id*='profit' i]",
"[id*='purchase' i]",
"[id*='sales' i]",
"[class*='amount' i]",
"[class*='total' i]",
"[class*='price' i]",
"[class*='cost' i]",
"[class*='paid' i]",
"[class*='balance' i]",
"[class*='revenue' i]",
"[class*='expense' i]",
"[class*='profit' i]",
".stat-value",
".summary-value",
".money",
".currency",
".financial-value"
]
.join(",");

try{

if(
root.nodeType===1&&
root.matches?.(selectors)
){
varexFormatFinancialElement(
root
)
}

(
root.querySelectorAll?.(
selectors
)||
[]
)
.forEach(
varexFormatFinancialElement
)

}catch(e){}

}


let varexFinancialObserver=null;
let varexFinancialTimer=null;


function varexInstallFinancialFormatting(){

varexFormatFinancialNumbers(
document
);

if(
varexFinancialObserver
){
return
}

varexFinancialObserver=
new MutationObserver(
mutations=>{

clearTimeout(
varexFinancialTimer
);

varexFinancialTimer=
setTimeout(()=>{

for(
const mutation of mutations
){

if(
mutation.type===
"characterData"
){

const parent=
mutation.target
.parentElement;

if(parent){

varexFormatFinancialNumbers(
parent
)

}

}

if(
mutation.type===
"childList"
){

mutation.addedNodes
.forEach(
node=>{

if(
node.nodeType===1
){

varexFormatFinancialNumbers(
node
)

}

}
)

}

}

},35)

}
);

varexFinancialObserver
.observe(
document.body,
{
subtree:true,
childList:true,
characterData:true
}
)

}


window.varexFormatNumber=
(v,d=2)=>
VAREX.formatNumber(
v,
d
);

window.varexFormatMoney=
v=>
VAREX.money(v);

window.varexParseNumber=
(v,f=0)=>
VAREX.parseNumber(
v,
f
);

window.varexFormatFinancialNumbers=
varexFormatFinancialNumbers;


/* ========================================================= GLOBAL TYPOGRAPHY ========================================================= */

function varexGetTypography(){

let t={};

try{

t=
JSON.parse(
localStorage.getItem(
"varexTypography"
)||
"{}"
)||
{}

}catch(e){}

const oldFamily=
t.fontFamily||
"Arial,Tahoma,sans-serif";

const oldSize=
Math.max(
8,
Math.min(
36,
Number(
t.fontSize||
13
)
)
);

return{

mainFontFamily:
t.mainFontFamily||
oldFamily,

mainFontSize:
Math.max(
12,
Math.min(
48,
Number(
t.mainFontSize||
18
)
)
),

subFontFamily:
t.subFontFamily||
oldFamily,

subFontSize:
Math.max(
8,
Math.min(
36,
Number(
t.subFontSize||
oldSize
)
)
),

bold:
!!t.bold,

italic:
!!t.italic,

underline:
!!t.underline,

align:
[
"right",
"center",
"left"
]
.includes(
t.align
)
?t.align
:"right",

verticalAlign:
[
"top",
"center",
"bottom"
]
.includes(
t.verticalAlign
)
?t.verticalAlign
:"center"

}

}


function varexApplyGlobalTypography(){

const t=
varexGetTypography();

const main=
t.mainFontSize;

const sub=
t.subFontSize;

const small=
Math.max(
8,
sub-2
);

const tiny=
Math.max(
8,
sub-3
);

const hero=
Math.min(
58,
main+7
);

const page=
Math.min(
52,
main+2
);

const section=
Math.min(
48,
main
);

const card=
Math.max(
12,
main-2
);

const vertical=
t.verticalAlign==="top"
?"top"
:t.verticalAlign==="bottom"
?"bottom"
:"middle";

const r=
document.documentElement.style;

r.setProperty(
"--varex-main-font",
t.mainFontFamily
);

r.setProperty(
"--varex-main-size",
main+"px"
);

r.setProperty(
"--varex-sub-font",
t.subFontFamily
);

r.setProperty(
"--varex-sub-size",
sub+"px"
);

r.setProperty(
"--varex-font-align",
t.align
);

r.setProperty(
"--varex-font-valign",
t.verticalAlign
);

let s=
document.getElementById(
"varexGlobalTypographyStyles"
);

if(!s){

s=
document.createElement(
"style"
);

s.id=
"varexGlobalTypographyStyles";

document.head.appendChild(
s
)

}

s.textContent=`

body,input,select,textarea,button,table{
font-family:${t.subFontFamily}!important
}

body{
font-size:${sub}px!important
}

p,label,input,select,textarea,button,td,th,
.nav-label,.system-row,.switch-row,.field,
.activity-text,.activity-text span,
.module p,.panel p,.card p,
.info-chip,.chip,.language-button,
.sidebar .nav a,
.varex-sidebar-actions button,
.modal-content,.modal-box,
.summary,.note,.badge,.status,
.filter,.filters{
font-family:${t.subFontFamily}!important;
font-size:${sub}px!important
}

small,.muted,.stat-small,.activity-time,
.page-name small,.brand-small,
.sidebar-footer,.module small,
.card small,.panel small{
font-family:${t.subFontFamily}!important;
font-size:${small}px!important
}

h1,h2,h3,h4,h5,h6,
.hero h1,.page-name h2,
.panel h2,.card h2,.card h3,
.module h3,.section-header h3,
.stat-value,.summary-title,.modal-title{
font-family:${t.mainFontFamily}!important
}

h1,.hero h1{
font-size:${hero}px!important
}

h2,.page-name h2{
font-size:${page}px!important
}

.panel h2,
.card h2,
.section-header h3{
font-size:${section}px!important
}

h3,
.card h3,
.module h3,
.stat-value{
font-size:${card}px!important
}

.logo,
.varex-logout-brand,
.varex-transition-word,
.varex-confirm-brand{
font-family:${t.mainFontFamily}!important
}

td,th{
vertical-align:${vertical}!important
}

.varex-user-align{
text-align:${t.align}!important
}

body.varex-font-bold h1,
body.varex-font-bold h2,
body.varex-font-bold h3,
body.varex-font-bold h4,
body.varex-font-bold h5,
body.varex-font-bold h6,
body.varex-font-bold p,
body.varex-font-bold label,
body.varex-font-bold td,
body.varex-font-bold th,
body.varex-font-bold input,
body.varex-font-bold select,
body.varex-font-bold textarea{
font-weight:700!important
}

body.varex-font-italic h1,
body.varex-font-italic h2,
body.varex-font-italic h3,
body.varex-font-italic p,
body.varex-font-italic label,
body.varex-font-italic td,
body.varex-font-italic th{
font-style:italic!important
}

body.varex-font-underline h1,
body.varex-font-underline h2,
body.varex-font-underline h3,
body.varex-font-underline p,
body.varex-font-underline label,
body.varex-font-underline td,
body.varex-font-underline th{
text-decoration:underline!important
}

.varex-sub-tiny{
font-size:${tiny}px!important
}
`;

document.body
?.classList.toggle(
"varex-font-bold",
t.bold
);

document.body
?.classList.toggle(
"varex-font-italic",
t.italic
);

document.body
?.classList.toggle(
"varex-font-underline",
t.underline
);

document.querySelectorAll(
".panel p,.card p,.module p,.activity-text,.activity-text span,.system-row,tbody td,.summary,.note,.description,.details"
)
.forEach(
e=>
e.classList.add(
"varex-user-align"
)
)

}


window.varexApplyGlobalTypography=
varexApplyGlobalTypography;


/* ========================================================= MENU ========================================================= */

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

const VAREX_SIDEBAR_SCROLL_KEY=
"varex_sidebar_scroll_position";


function varexGetSidebar(){
return document.querySelector(
".sidebar"
)
}


function varexSaveSidebarScroll(){

const s=
varexGetSidebar();

if(!s){
return
}

const v=
String(
s.scrollTop||
0
);

try{

sessionStorage.setItem(
VAREX_SIDEBAR_SCROLL_KEY,
v
);

localStorage.setItem(
VAREX_SIDEBAR_SCROLL_KEY,
v
)

}catch(e){}

}


function varexRestoreSidebarScroll(){

const s=
varexGetSidebar();

if(!s){
return
}

let v=0;

try{

v=
Number(
sessionStorage.getItem(
VAREX_SIDEBAR_SCROLL_KEY
)||
localStorage.getItem(
VAREX_SIDEBAR_SCROLL_KEY
)||
0
)

}catch(e){}

if(
!Number.isFinite(v)||
v<0
){
v=0
}

const restore=()=>{

s.scrollTop=
Math.min(
v,
Math.max(
0,
s.scrollHeight-
s.clientHeight
)
)

};

requestAnimationFrame(
()=>
requestAnimationFrame(
()=>{

restore();

setTimeout(
restore,
40
);

setTimeout(
restore,
120
)

}
)
)

}


function varexBuildMenu(){

const nav=
document.querySelector(
".sidebar .nav"
);

if(!nav){
return
}

let current=
location.pathname
.split("/")
.pop()
.toLowerCase()||
"index.html";

if(
current===
"subscription-success.html"
){
current=
"subscription.html"
}

nav.innerHTML=
VAREX_MENU
.map(
([file,icon,title])=>
`
<a
href="./${file}"
class="${current===file.toLowerCase()?"active":""}">
<span class="nav-icon">${icon}</span>
<span class="nav-label">${title}</span>
</a>
`
)
.join("");

varexAddSidebarActions()

}


function varexAddSidebarActions(){

const nav=
document.querySelector(
".sidebar .nav"
);

if(!nav){
return
}

const box=
document.createElement(
"div"
);

box.className=
"varex-sidebar-actions";

box.innerHTML=`

<button
type="button"
class="varex-theme-button"
id="varexThemeButton">

<span
class="nav-icon"
id="varexThemeIcon">
🌙
</span>

<span id="varexThemeText">
الوضع الليلي
</span>

</button>

<button
type="button"
class="varex-logout-button"
id="varexLogoutButton">

<span class="varex-power-icon">
⏻
</span>

<span>
تسجيل الخروج
</span>

</button>

<div
class="varex-sidebar-bottom-space">
</div>
`;

nav.appendChild(
box
);

varexInstallSharedStyles();

varexInstallLogoutUI();

varexInstallConfirmUI();

document
.getElementById(
"varexThemeButton"
)
?.addEventListener(
"click",
()=>{

varexSaveSidebarScroll();

varexToggleTheme()

}
);

document
.getElementById(
"varexLogoutButton"
)
?.addEventListener(
"click",
()=>{

varexSaveSidebarScroll();

varexOpenLogoutDialog()

}
);

varexUpdateThemeButton()

}


/* ========================================================= LOGOUT ========================================================= */

function varexInstallLogoutUI(){

if(
document.getElementById(
"varexLogoutOverlay"
)
){
return
}

const o=
document.createElement(
"div"
);

o.id=
"varexLogoutOverlay";

o.className=
"varex-logout-overlay";

o.innerHTML=`

<div
class="varex-logout-card"
id="varexLogoutCard">

<div class="varex-logout-brand">
VAREX
</div>

<div
class="varex-logout-loader"
id="varexLogoutLoader">
</div>

<div
class="varex-logout-success-icon"
id="varexLogoutSuccessIcon">
✓
</div>

<h2
class="varex-logout-title"
id="varexLogoutTitle">
تسجيل الخروج
</h2>

<p
class="varex-logout-message"
id="varexLogoutMessage">
هل تريد تسجيل الخروج من VAREX؟
</p>

<div
class="varex-logout-progress"
id="varexLogoutProgress">

<div
class="varex-logout-progress-bar"
id="varexLogoutProgressBar">
</div>

</div>

<div
class="varex-logout-actions"
id="varexLogoutActions">

<button
type="button"
class="varex-logout-confirm"
id="varexLogoutConfirm">

<span>⏻</span>

<span>
تأكيد تسجيل الخروج
</span>

</button>

<button
type="button"
class="varex-logout-cancel"
id="varexLogoutCancel">

<span>↩</span>

<span>
البقاء في النظام
</span>

</button>

</div>

</div>

<div
class="varex-logout-transition"
id="varexLogoutTransition">

<div class="varex-transition-word">
VAREX
</div>

</div>
`;

document.body.appendChild(
o
);

document
.getElementById(
"varexLogoutCancel"
)
?.addEventListener(
"click",
varexCloseLogoutDialog
);

document
.getElementById(
"varexLogoutConfirm"
)
?.addEventListener(
"click",
varexRunLogoutSequence
);

o.addEventListener(
"click",
e=>{

if(
e.target===o&&
!o.classList.contains(
"processing"
)
){

varexCloseLogoutDialog()

}

}
)

}


function varexOpenLogoutDialog(){

const o=
document.getElementById(
"varexLogoutOverlay"
);

if(!o){
return
}

varexLogoutInProgress=
false;

o.classList.remove(
"processing",
"finished",
"leaving"
);

document
.getElementById(
"varexLogoutTransition"
)
?.classList.remove(
"show"
);

const t=
document.getElementById(
"varexLogoutTitle"
);

const m=
document.getElementById(
"varexLogoutMessage"
);

const a=
document.getElementById(
"varexLogoutActions"
);

const l=
document.getElementById(
"varexLogoutLoader"
);

const s=
document.getElementById(
"varexLogoutSuccessIcon"
);

const p=
document.getElementById(
"varexLogoutProgress"
);

const b=
document.getElementById(
"varexLogoutProgressBar"
);

if(t){
t.textContent=
"تسجيل الخروج"
}

if(m){
m.textContent=
"هل تريد تسجيل الخروج من VAREX؟"
}

if(a){
a.style.display=
"flex"
}

if(l){
l.style.display=
"none"
}

if(s){
s.style.display=
"none"
}

if(p){
p.style.display=
"none"
}

if(b){
b.style.width=
"0%"
}

o.classList.add(
"show"
)

}


function varexCloseLogoutDialog(){

const o=
document.getElementById(
"varexLogoutOverlay"
);

if(
!o||
o.classList.contains(
"processing"
)
){
return
}

o.classList.remove(
"show"
)

}


function varexLogoutWait(ms){

return new Promise(
r=>
setTimeout(
r,
ms
)
)

}


function varexSetLogoutStatus(
t,
m,
p,
mode="loading"
){

const T=
document.getElementById(
"varexLogoutTitle"
);

const M=
document.getElementById(
"varexLogoutMessage"
);

const L=
document.getElementById(
"varexLogoutLoader"
);

const S=
document.getElementById(
"varexLogoutSuccessIcon"
);

const B=
document.getElementById(
"varexLogoutProgressBar"
);

if(T){
T.textContent=t
}

if(M){
M.textContent=m
}

if(B){
B.style.width=
`${p}%`
}

if(
mode==="success"
){

if(L){
L.style.display=
"none"
}

if(S){
S.style.display=
"flex"
}

}else{

if(S){
S.style.display=
"none"
}

if(L){
L.style.display=
"block"
}

}

}


function varexPlayLogoutSound(){

try{

const A=
window.AudioContext||
window.webkitAudioContext;

if(!A){
return
}

const c=
new A();

const s=
c.currentTime;

[
[523.25,0,.16],
[659.25,.14,.18],
[783.99,.29,.20],
[1046.5,.46,.32]
]
.forEach(
([f,d,u])=>{

const o=
c.createOscillator();

const g=
c.createGain();

o.frequency.value=f;

g.gain.setValueAtTime(
.0001,
s+d
);

g.gain.exponentialRampToValueAtTime(
.055,
s+d+.025
);

g.gain.exponentialRampToValueAtTime(
.0001,
s+d+u
);

o.connect(g);

g.connect(
c.destination
);

o.start(
s+d
);

o.stop(
s+d+u+.04
)

}
);

setTimeout(
()=>
c.close()
.catch(()=>{}),
1300
)

}catch(e){}

}


let varexLogoutInProgress=
false;


async function varexRunLogoutSequence(){

if(
varexLogoutInProgress
){
return
}

varexLogoutInProgress=
true;

const o=
document.getElementById(
"varexLogoutOverlay"
);

const a=
document.getElementById(
"varexLogoutActions"
);

const p=
document.getElementById(
"varexLogoutProgress"
);

const t=
document.getElementById(
"varexLogoutTransition"
);

if(!o){

await VAREX.logout(
true
);

return

}

o.classList.add(
"processing"
);

if(a){
a.style.display=
"none"
}

if(p){
p.style.display=
"block"
}

varexSetLogoutStatus(
"جاري حفظ البيانات...",
"يرجى الانتظار لحظات.",
38,
"loading"
);

await Promise.all([
varexLogoutWait(
1750
),
VAREX.logout(false)
.catch(()=>true)
]);

varexSetLogoutStatus(
"تم تسجيل الخروج بنجاح",
"شكراً لاستخدامك نظام VAREX.",
100,
"success"
);

varexPlayLogoutSound();

await varexLogoutWait(
900
);

if(t){
t.classList.add(
"show"
)
}

await varexLogoutWait(
760
);

location.replace(
"./login.html"
)

}


/* ========================================================= SHARED STYLES ========================================================= */

function varexInstallSharedStyles(){

if(
document.getElementById(
"varexSharedStyles"
)
){
return
}

const s=
document.createElement(
"style"
);

s.id=
"varexSharedStyles";

s.textContent=`

:root{
--sidebar-width:265px!important
}

html{
height:100%
}

body{
min-height:100%
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
display:block!important;
overflow-y:auto!important;
overflow-x:hidden!important;
-webkit-overflow-scrolling:touch!important;
overscroll-behavior-y:contain!important;
z-index:1000!important
}

.sidebar .brand{
position:relative!important;
width:100%!important;
height:var(--brand-height,170px)!important;
min-height:var(--brand-height,170px)!important
}

.sidebar .nav{
width:100%!important;
height:auto!important;
display:block!important;
overflow:visible!important;
padding:16px 14px 0!important
}

.sidebar .nav a{
width:100%!important;
height:50px!important;
display:flex!important;
align-items:center!important;
gap:12px!important;
padding:0 15px!important;
margin:0 0 8px!important;
border-radius:11px!important;
text-decoration:none!important;
background:rgba(255,255,255,.055)!important;
color:#dbeafe!important;
border-top:1px solid rgba(255,255,255,.12)!important;
border-left:1px solid rgba(255,255,255,.08)!important;
border-right:1px solid rgba(0,0,0,.10)!important;
border-bottom:3px solid rgba(5,14,37,.44)!important
}

.sidebar .nav a.active{
background:#fff!important;
color:#172554!important;
border-bottom:3px solid #94a3b8!important
}

.sidebar .nav a.active .nav-icon,
.sidebar .nav a.active .nav-label{
color:#172554!important
}

.sidebar .nav .nav-icon{
width:27px!important;
height:27px!important;
display:flex!important;
align-items:center!important;
justify-content:center!important;
font-size:17px!important
}

.varex-sidebar-actions{
width:100%;
margin-top:18px;
padding-top:15px;
border-top:1px solid rgba(255,255,255,.12)
}

.varex-sidebar-actions button{
width:100%;
height:50px;
display:flex;
align-items:center;
gap:12px;
padding:0 15px;
margin:0 0 9px;
border-radius:11px;
font-family:inherit;
font-weight:700;
cursor:pointer
}

.varex-theme-button,
.varex-logout-button{
background:#fff!important;
color:#172554!important;
border:1px solid #fff!important;
border-bottom:3px solid #94a3b8!important
}

.varex-power-icon{
width:29px;
height:29px;
border:2px solid #172554;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
background:#f8fafc;
color:#172554
}

.varex-sidebar-bottom-space{
display:block!important;
width:100%!important;
height:calc(230px + env(safe-area-inset-bottom))!important;
min-height:calc(230px + env(safe-area-inset-bottom))!important;
flex:0 0 calc(230px + env(safe-area-inset-bottom))!important;
pointer-events:none!important
}


/* CONFIRM WINDOW */

.varex-confirm-overlay{
position:fixed;
inset:0;
z-index:999998;
display:flex;
align-items:center;
justify-content:center;
padding:24px;
background:rgba(4,12,32,.72);
backdrop-filter:blur(10px);
-webkit-backdrop-filter:blur(10px);
opacity:0;
visibility:hidden;
pointer-events:none;
transition:.25s
}

.varex-confirm-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}

.varex-confirm-card{
width:min(520px,calc(100vw - 34px));
padding:32px 30px 28px;
border-radius:24px;
background:#fff;
border:1px solid #e2e8f0;
box-shadow:0 30px 90px rgba(2,8,23,.42);
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-align:center;
transform:scale(.95) translateY(12px);
transition:.28s
}

.varex-confirm-overlay.show .varex-confirm-card{
transform:scale(1) translateY(0)
}

.varex-confirm-brand{
direction:ltr;
font-size:29px;
font-weight:900;
letter-spacing:6px;
color:#172554;
margin-bottom:19px
}

.varex-confirm-icon{
width:54px;
height:54px;
border-radius:50%;
background:#eef2ff;
color:#172554;
display:flex;
align-items:center;
justify-content:center;
font-size:28px;
font-weight:900;
margin-bottom:16px
}

.varex-confirm-title{
font-size:22px;
font-weight:900;
color:#172554;
margin-bottom:10px
}

.varex-confirm-message{
font-size:14px;
line-height:1.9;
color:#475569;
white-space:pre-wrap
}

.varex-confirm-actions{
display:flex;
width:100%;
gap:13px;
margin-top:26px
}

.varex-confirm-actions button{
flex:1;
height:52px;
border-radius:12px;
font-family:inherit;
font-size:13px;
font-weight:800;
cursor:pointer
}

.varex-confirm-yes{
background:#172554;
color:#fff;
border:1px solid #172554;
box-shadow:0 6px 0 #0f1d43
}

.varex-confirm-no{
background:#fff;
color:#172554;
border:1px solid #cbd5e1;
box-shadow:0 6px 0 #b8c3d2
}

.varex-confirm-actions button:active{
transform:translateY(4px);
box-shadow:0 1px 0 rgba(0,0,0,.18)
}


/* LOGOUT */

.varex-logout-overlay{
position:fixed;
inset:0;
z-index:999999;
display:flex;
align-items:center;
justify-content:center;
padding:24px;
background:rgba(4,12,32,.76);
backdrop-filter:blur(11px);
opacity:0;
visibility:hidden;
pointer-events:none;
transition:.28s
}

.varex-logout-overlay.show{
opacity:1;
visibility:visible;
pointer-events:auto
}

.varex-logout-card{
width:min(600px,calc(100vw - 40px));
min-height:390px;
padding:40px 42px 35px;
border-radius:28px;
background:linear-gradient(160deg,#fff,#f8fafc);
box-shadow:0 38px 110px rgba(2,8,23,.45);
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-align:center;
transform:scale(.94) translateY(15px);
opacity:0;
transition:.35s
}

.varex-logout-overlay.show .varex-logout-card{
transform:scale(1);
opacity:1
}

.varex-logout-brand{
direction:ltr;
font-size:38px;
font-weight:900;
letter-spacing:7px;
color:#172554;
margin-bottom:31px
}

.varex-logout-loader{
display:none;
width:52px;
height:52px;
margin:2px auto 20px;
border-radius:50%;
border:4px solid #dbe3ef;
border-top-color:#172554;
animation:varexLogoutSpin .72s linear infinite
}

@keyframes varexLogoutSpin{
to{
transform:rotate(360deg)
}
}

.varex-logout-success-icon{
display:none;
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
font-weight:900
}

.varex-logout-title{
font-size:26px;
font-weight:900;
color:#172554;
margin-bottom:12px
}

.varex-logout-message{
font-size:13px;
line-height:1.9;
color:#64748b
}

.varex-logout-progress{
display:none;
width:84%;
height:8px;
margin-top:27px;
border-radius:30px;
background:#e2e8f0;
overflow:hidden
}

.varex-logout-progress-bar{
width:0;
height:100%;
background:linear-gradient(90deg,#172554,#31548c);
transition:.65s
}

.varex-logout-actions{
width:100%;
display:flex;
gap:15px;
margin-top:32px
}

.varex-logout-actions button{
flex:1;
height:57px;
border-radius:14px;
font-family:inherit;
font-weight:800;
cursor:pointer;
display:flex;
align-items:center;
justify-content:center;
gap:9px
}

.varex-logout-confirm{
background:#172554;
color:#fff;
border:1px solid #172554;
box-shadow:0 7px 0 #0b1737
}

.varex-logout-cancel{
background:#fff;
color:#172554;
border:1px solid #cbd5e1;
box-shadow:0 6px 0 #b8c3d2
}

.varex-logout-transition{
position:absolute;
inset:0;
z-index:50;
display:flex;
align-items:center;
justify-content:center;
background:linear-gradient(145deg,#172554,#0f1d43);
transform:translateX(-105%);
transition:.72s
}

.varex-logout-transition.show{
transform:translateX(0)
}

.varex-transition-word{
font-size:44px!important;
font-weight:900!important;
letter-spacing:10px!important;
color:#fff!important;
direction:ltr!important
}

.varex-money,
.money,
.financial-value,
.summary-value,
.stat-value{
font-variant-numeric:tabular-nums;
direction:ltr
}

body.varex-dark .varex-confirm-card{
background:#132641;
border-color:#29415f
}

body.varex-dark .varex-confirm-brand,
body.varex-dark .varex-confirm-title{
color:#fff!important
}

body.varex-dark .varex-confirm-message{
color:#cbd5e1!important
}

body.varex-dark .varex-confirm-icon{
background:#1c365a;
color:#fff
}

body.varex-dark .varex-confirm-no{
background:#172c48;
color:#fff;
border-color:#35506f;
box-shadow:0 6px 0 #091728
}

@media(max-width:600px){

.main{
padding-bottom:160px!important
}

.content,
main.content,
.page-content,
.main-content{
padding-bottom:160px!important
}

.varex-sidebar-bottom-space{
height:calc(220px + env(safe-area-inset-bottom))!important;
min-height:calc(220px + env(safe-area-inset-bottom))!important;
flex-basis:calc(220px + env(safe-area-inset-bottom))!important
}

.varex-confirm-actions{
flex-direction:column
}

.varex-logout-card{
width:calc(100vw - 26px);
min-height:380px;
padding:32px 22px 28px
}

.varex-logout-actions{
flex-direction:column
}

}
`;

document.head.appendChild(
s
)

}


/* ========================================================= SIDEBAR SCROLL ========================================================= */

function varexInstallSidebarScroll(){

const s=
varexGetSidebar();

if(!s){
return
}

varexRestoreSidebarScroll();

let t=null;

s.addEventListener(
"scroll",
()=>{

clearTimeout(t);

t=
setTimeout(
varexSaveSidebarScroll,
25
)

},
{
passive:true
}
);

s.querySelectorAll(
"a[href]"
)
.forEach(
l=>{

l.addEventListener(
"pointerdown",
varexSaveSidebarScroll,
{
passive:true
}
);

l.addEventListener(
"touchstart",
varexSaveSidebarScroll,
{
passive:true
}
);

l.addEventListener(
"click",
varexSaveSidebarScroll
)

}
);

window.addEventListener(
"pagehide",
varexSaveSidebarScroll
);

window.addEventListener(
"beforeunload",
varexSaveSidebarScroll
)

}


/* ========================================================= THEME ========================================================= */

function varexResolveThemeMode(){

const mode=
localStorage.getItem(
"varexThemeMode"
);

if(
mode==="dark"
){
return"dark"
}

if(
mode==="light"
){
return"light"
}

if(
mode==="system"
){

return(
window.matchMedia&&
window.matchMedia(
"(prefers-color-scheme: dark)"
)
.matches
)
?"dark"
:"light"

}

const old=
localStorage.getItem(
"varex_theme"
);

if(
old==="dark"||
old==="light"
){
return old
}

return(
window.matchMedia&&
window.matchMedia(
"(prefers-color-scheme: dark)"
)
.matches
)
?"dark"
:"light"

}


function varexGetTheme(){
return varexResolveThemeMode()
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

document.body
?.classList.toggle(
"varex-dark",
theme==="dark"
);

localStorage.setItem(
"varex_theme",
theme
);

varexInstallDarkStyles();

varexUpdateThemeButton()

}


function varexToggleTheme(){

const next=
varexGetTheme()==="dark"
?"light"
:"dark";

localStorage.setItem(
"varexThemeMode",
next
);

varexApplyTheme(
next
)

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
i.textContent=
d
?"☀️"
:"🌙"
}

if(t){
t.textContent=
d
?"الوضع النهاري"
:"الوضع الليلي"
}

}


function varexInstallDarkStyles(){

if(
document.getElementById(
"varexDarkStyles"
)
){
return
}

const s=
document.createElement(
"style"
);

s.id=
"varexDarkStyles";

s.textContent=`

body.varex-dark{
background:#081426!important;
color:#f8fafc!important
}

body.varex-dark .main,
body.varex-dark main,
body.varex-dark .content{
background:#081426!important;
color:#f8fafc!important
}

body.varex-dark .topbar{
background:#101f38!important;
border-color:#263955!important;
color:#f8fafc!important
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
color:#f8fafc!important
}

body.varex-dark h1,
body.varex-dark h2,
body.varex-dark h3,
body.varex-dark h4,
body.varex-dark h5,
body.varex-dark h6{
color:#fff!important
}

body.varex-dark p,
body.varex-dark small,
body.varex-dark label,
body.varex-dark .muted{
color:#cbd5e1!important
}

body.varex-dark input,
body.varex-dark select,
body.varex-dark textarea{
background:#0e2039!important;
border-color:#35506f!important;
color:#fff!important
}

body.varex-dark table{
background:#132641!important;
color:#f8fafc!important
}

body.varex-dark thead,
body.varex-dark th{
background:#0e2039!important;
color:#dbeafe!important
}

body.varex-dark td{
background:#132641!important;
color:#e2e8f0!important
}

body.varex-dark .chip,
body.varex-dark .info-chip{
background:#fff!important;
color:#172554!important
}

body.varex-dark .chip strong,
body.varex-dark .info-chip strong{
color:#172554!important
}

body.varex-dark .varex-logout-card{
background:linear-gradient(
160deg,
#132641,
#0f2039
);
color:#fff
}

body.varex-dark .varex-logout-brand,
body.varex-dark .varex-logout-title{
color:#fff!important
}

body.varex-dark .varex-logout-message{
color:#cbd5e1!important
}
`;

document.head.appendChild(
s
)

}


/* ========================================================= CURRENT USER ========================================================= */

function varexShowCurrentUser(){

const u=
VAREX.getCurrentUser();

if(!u){
return
}

document.querySelectorAll(
".info-chip,.chip"
)
.forEach(
el=>{

if(
el.textContent.includes(
"المستخدم"
)
){

const s=
el.querySelector(
"strong"
);

if(s){

s.textContent=
u.name||
u.username||
"المستخدم"

}

}

}
);

[
"sidebarUserName",
"topUserName",
"settingsUserName",
"currentUserName"
]
.forEach(
id=>{

const e=
document.getElementById(
id
);

if(e){

e.textContent=
u.name||
u.username||
u.email||
"المستخدم"

}

}
);

const r=
document.getElementById(
"sidebarUserRole"
);

if(r){

r.textContent=
u.role||
"مستخدم"

}

}


/* ========================================================= START ========================================================= */

function varexStartUI(){

const publicPage=
VAREX.isLoginPage()||
VAREX.isRegisterPage()||
VAREX.isVerifyEmailPage();

if(publicPage){
return
}

if(
!VAREX.requireSubscription()
){
return
}

varexBuildMenu();

varexApplyTheme(
varexGetTheme()
);

varexApplyGlobalTypography();

varexShowCurrentUser();

varexInstallSidebarScroll();

varexInstallFinancialFormatting();

varexInstallConfirmUI();

varexInstallConfirmInterceptor();

setTimeout(
()=>{
varexFormatFinancialNumbers(
document
)
},
100
);

setTimeout(
()=>{
varexFormatFinancialNumbers(
document
)
},
500
)

}


window.addEventListener(
"storage",
e=>{

if(
e.key===
"varexTypography"
){
varexApplyGlobalTypography()
}

if(
e.key===
"varexThemeMode"
){

varexApplyTheme(
varexGetTheme()
)

}

}
);


window.addEventListener(
"focus",
()=>{

varexApplyGlobalTypography();

varexApplyTheme(
varexGetTheme()
);

setTimeout(
()=>{
varexFormatFinancialNumbers(
document
)
},
50
)

}
);


if(
window.matchMedia
){

const varexSystemTheme=
window.matchMedia(
"(prefers-color-scheme: dark)"
);

varexSystemTheme
.addEventListener?.(
"change",
()=>{

if(
(
localStorage.getItem(
"varexThemeMode"
)||
"system"
)==="system"
){

varexApplyTheme(
varexGetTheme()
)

}

}
)

}


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
