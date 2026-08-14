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
if(m.includes("invalid token")||m.includes("invalid otp")||m.includes("token is invalid"))return"رمز التحقق غير صحيح. تأكد من الرمز وحاول مرة أخرى.";
if(m.includes("password")&&m.includes("6"))return"كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل.";
if(m.includes("rate limit")||m.includes("too many requests"))return"تم إجراء محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.";
return e?.message||"حدث خطأ في خدمة الحسابات."
},

getSafeUser(u){
if(!u)return null;
const md=u.user_metadata||{};
return{id:u.id,name:md.name||md.full_name||u.name||"المستخدم",username:md.username||u.username||"",email:u.email||"",role:md.role||u.role||"مستخدم",status:"نشط",createdAt:u.created_at||u.createdAt||"",lastLogin:u.last_sign_in_at||u.lastLogin||""}
},

setPendingVerification(data={}){
const x={email:this.normalizeEmail(data.email),name:this.cleanText(data.name),username:this.normalizeUsername(data.username),createdAt:this.now()};
try{localStorage.setItem(this.keys.pendingVerification,JSON.stringify(x));return x}catch(e){console.error(e);return null}
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
if(password.length<6)return{success:false,message:"كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل."};

try{
const d=await this.authFetch("/auth/v1/signup",{
method:"POST",
body:JSON.stringify({
email:email,
password:password,
data:{
name:name,
full_name:name,
username:username,
role:"مستخدم"
}
})
});

this.setPendingVerification({email,name,username});

if(d?.session?.access_token){
this.storeSession(d.session,false);
return{
success:true,
user:this.getSafeUser(d.user),
needsEmailConfirmation:false,
message:"تم إنشاء الحساب وتأكيد البريد الإلكتروني."
}
}

return{
success:true,
user:this.getSafeUser(d.user),
needsEmailConfirmation:true,
email:email,
message:"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."
};

}catch(e){
console.error("VAREX signup:",e);
return{success:false,message:this.mapAuthError(e)}
}
},

async verifyEmailOtp(email,token){
const mail=this.normalizeEmail(email);
const code=this.cleanText(token).replace(/\s+/g,"");

if(!mail)return{success:false,message:"البريد الإلكتروني غير موجود."};
if(!code)return{success:false,message:"يرجى إدخال رمز التحقق."};

try{
const d=await this.authFetch("/auth/v1/verify",{
method:"POST",
body:JSON.stringify({
type:"signup",
email:mail,
token:code
})
});

if(!d?.user){
return{success:false,message:"تعذر تأكيد البريد الإلكتروني."}
}

if(d?.access_token){
const session={
access_token:d.access_token,
refresh_token:d.refresh_token,
expires_in:d.expires_in,
expires_at:d.expires_at,
token_type:d.token_type,
user:d.user
};
this.storeSession(session,false)
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
};

}catch(e){
console.error("VAREX verify OTP:",e);
return{success:false,message:this.mapAuthError(e)}
}
},

async resendConfirmation(email){
const mail=this.normalizeEmail(email);

if(!mail){
return{success:false,message:"البريد الإلكتروني غير موجود."}
}

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
};

}catch(e){
console.error("VAREX resend confirmation:",e);
return{success:false,message:this.mapAuthError(e)}
}
},

async login(login,password,remember=false){
const identifier=this.cleanText(login);
const pw=String(password||"");

if(!identifier||!pw)return{success:false,message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."};

if(!identifier.includes("@")){
return{success:false,message:"حالياً سجّل الدخول بالبريد الإلكتروني."}
}

try{
const d=await this.authFetch("/auth/v1/token?grant_type=password",{
method:"POST",
body:JSON.stringify({
email:this.normalizeEmail(identifier),
password:pw
})
});

if(!d.access_token||!d.user){
return{success:false,message:"تعذر إنشاء جلسة المستخدم."}
}

this.storeSession(d,remember);
localStorage.setItem(this.keys.rememberedUser,remember?identifier:"");
this.clearPendingVerification();

return{
success:true,
user:this.getSafeUser(d.user)
};

}catch(e){
console.error("VAREX login:",e);
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
return s?.access_token&&s?.user?s:null
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
const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{
method:"POST",
body:JSON.stringify({refresh_token:s.refresh_token})
});
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

isLoginPage(){
return location.pathname.toLowerCase().endsWith("login.html")
},

isRegisterPage(){
return location.pathname.toLowerCase().endsWith("register.html")
},

isVerifyEmailPage(){
return location.pathname.toLowerCase().endsWith("verify-email.html")
},

redirectLoggedUser(){
if((this.isLoginPage()||this.isRegisterPage())&&this.isLoggedIn()){
location.replace("./index.html");
return true
}
return false
},

async requestPasswordReset(email){
const mail=this.normalizeEmail(email);

if(!mail){
return{success:false,message:"يرجى إدخال البريد الإلكتروني."}
}

try{
await this.authFetch("/auth/v1/recover",{
method:"POST",
body:JSON.stringify({email:mail})
});

return{
success:true,
message:"تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني."
};

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

async updateCurrentUser(changes={}){
const s=this.getSession();

if(!s){
return{success:false,message:"لا يوجد مستخدم مسجل الدخول."}
}

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
const u=await this.authFetch("/auth/v1/user",{
method:"PUT",
body:JSON.stringify(body)
});

s.user=u;
this.storeSession(s,s.remember);

return{
success:true,
user:this.getSafeUser(u)
};

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
const u=await this.authFetch("/auth/v1/user",{
method:"PUT",
body:JSON.stringify({
password:String(newPassword)
})
});

s.user=u;
this.storeSession(s,s.remember);

return{
success:true,
message:"تم تغيير كلمة المرور بنجاح."
};

}catch(e){
return{success:false,message:this.mapAuthError(e)}
}
},

getProducts(){return this.getData(this.keys.products)},
saveProducts(x){return this.saveData(this.keys.products,x)},
getProductById(id){return this.getProducts().find(x=>String(x.id)===String(id))||null},
findProductByBarcode(b){b=this.cleanText(b);return this.getProducts().find(x=>this.cleanText(x.barcode)===b)||null},

addProduct(p={}){
const a=this.getProducts();
const x={
...p,
id:p.id||this.generateId("PRD"),
name:this.cleanText(p.name||p.productName),
quantity:this.positiveNumber(p.quantity),
price:this.positiveNumber(p.price||p.salePrice),
cost:this.positiveNumber(p.cost||p.costPrice),
createdAt:p.createdAt||this.now(),
updatedAt:this.now()
};
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
const x={
...s,
id:s.id||this.generateId("SAL"),
invoiceNumber:s.invoiceNumber||`INV-${Date.now()}`,
createdAt:s.createdAt||this.now(),
date:s.date||this.now(),
updatedAt:this.now()
};
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
return{
success:false,
message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")
}
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

return{
success:true,
sale:this.addSale(s)
}
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

addTransaction(x={}){
x={
...x,
amount:this.positiveNumber(x.amount),
date:x.date||this.today()
};
return this._add(this.keys.transactions,"TRX",x)
},

updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},
deleteTransaction(id){return this._delete(this.keys.transactions,id)},

getHeldSales(){return this.getData(this.keys.heldSales)},
saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},
holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},
removeHeldSale(id){return this._delete(this.keys.heldSales,id)},
getHeldSaleById(id){return this.getHeldSales().find(x=>String(x.id)===String(id))||null},

_add(k,p,x={}){
const a=this.getData(k);
const o={
...x,
id:x.id||this.generateId(p),
createdAt:x.createdAt||this.now(),
updatedAt:this.now()
};
a.push(o);
this.saveData(k,a);
return o
},

_update(k,id,c={}){
const a=this.getData(k);
const i=a.findIndex(x=>String(x.id)===String(id));

if(i<0)return false;

a[i]={
...a[i],
...c,
id:a[i].id,
updatedAt:this.now()
};

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
const d={
businessName:"VAREX",
currency:"AED",
currencySymbol:"د.إ",
taxEnabled:true,
taxRate:5,
lowStockLimit:5,
language:"ar"
};

const p=this.getObject(this.keys.settings,{});
let l={};

try{
const x=JSON.parse(localStorage.getItem("varexSettings")||"null");
if(x&&typeof x==="object"&&!Array.isArray(x))l=x
}catch(e){}

return{...d,...l,...p}
},

saveSettings(s={}){
const d={
...this.getSettings(),
...s,
updatedAt:this.now()
};

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
[
this.keys.products,
this.keys.sales,
this.keys.customers,
this.keys.suppliers,
this.keys.employees,
this.keys.transactions,
this.keys.heldSales
].forEach(k=>{
if(localStorage.getItem(k)===null){
localStorage.setItem(k,"[]")
}
});

if(localStorage.getItem(this.keys.settings)===null){
this.saveSettings(this.getSettings())
}

return true
}
};

VAREX.initialize();
window.VAREX=VAREX;
