/* ========================================================= VAREX CORE ========================================================= */
const VAREX={config:{supabaseUrl:"https://eibadfdqzpeigccfdipt.supabase.co",supabaseKey:"sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336"},keys:{products:"varex_products",sales:"varex_sales",customers:"varex_customers",suppliers:"varex_suppliers",employees:"varex_employees",transactions:"varexTransactions",settings:"varex_settings",heldSales:"varex_held_sales",session:"varex_session",rememberedUser:"varex_remembered_user",cachedUser:"varex_cached_user",pendingVerification:"varex_pending_verification",subscription:"varex_subscription",subscriptionGate:"varex_subscription_gate",staffUsers:"varexUsers",staffSession:"varex_staff_session",deviceAuth:"varex_device_authorized",deviceOwner:"varex_device_owner",businessId:"varex_business_id"},cleanText(v){return String(v??"").trim()},normalizeEmail(v){return this.cleanText(v).toLowerCase()},normalizeUsername(v){return this.cleanText(v).toLowerCase()},now(){return new Date().toISOString()},today(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},generateId(p="VRX"){return`${p}-${Date.now()}-${Math.floor(Math.random()*1e6)}`},parseNumber(v,f=0){if(typeof v==="number")return Number.isFinite(v)?v:f;if(v===null||v===undefined||v==="")return f;let x=String(v).trim().replace(/[,\s]/g,"").replace(/[^\d.-]/g,"");const i=x.indexOf(".");if(i!==-1)x=x.slice(0,i+1)+x.slice(i+1).replace(/\./g,"");const n=Number(x);return Number.isFinite(n)?n:f},toNumber(v,f=0){return this.parseNumber(v,f)},positiveNumber(v){return Math.max(0,this.toNumber(v))},formatNumber(v,d=2){const n=this.toNumber(v),x=Math.max(0,Math.min(6,Number.isFinite(Number(d))?Number(d):2));return n.toLocaleString("en-US",{minimumFractionDigits:x,maximumFractionDigits:x})},formatQuantity(v){return this.toNumber(v).toLocaleString("en-US",{maximumFractionDigits:3})},normalizeDate(v){if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},getAccountScope(){const s=this.getSession?.();const id=s?.user?.id||this.getDeviceOwner?.()?.ownerId||"guest";return String(id).replace(/[^a-zA-Z0-9_-]/g,"_")},scopeKey(k){const scoped=new Set([this.keys.products,this.keys.sales,this.keys.customers,this.keys.suppliers,this.keys.employees,this.keys.transactions,this.keys.settings,this.keys.heldSales,this.keys.staffUsers,this.keys.subscription]);return scoped.has(k)?`${k}__${this.getAccountScope()}`:k},getData(k){try{const x=JSON.parse(localStorage.getItem(this.scopeKey(k))||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}},saveData(k,d){try{localStorage.setItem(this.scopeKey(k),JSON.stringify(Array.isArray(d)?d:[]));return true}catch(e){return false}},getObject(k,f={}){try{const x=JSON.parse(localStorage.getItem(this.scopeKey(k))||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...f,...x}:{...f}}catch(e){return{...f}}},saveObject(k,d){try{localStorage.setItem(this.scopeKey(k),JSON.stringify(d||{}));return true}catch(e){return false}},async authFetch(path,opt={}){const h={apikey:this.config.supabaseKey,"Content-Type":"application/json",...(opt.headers||{})},s=this.getSession();if(s?.access_token)h.Authorization=`Bearer ${s.access_token}`;const r=await fetch(this.config.supabaseUrl+path,{...opt,headers:h});let data={};try{data=await r.json()}catch(e){}if(!r.ok){const e=new Error(data.msg||data.message||data.error_description||data.error||"تعذر الاتصال بخدمة الحسابات.");e.status=r.status;e.data=data;throw e}return data},async dbFetch(path,opt={}){let s=this.getSession();if(!s?.access_token)throw new Error("انتهت جلسة المستخدم. يرجى تسجيل الدخول من جديد.");if((s.expires_at||0)<=Math.floor(Date.now()/1000)+60){await this.refreshSession();s=this.getSession()}if(!s?.access_token)throw new Error("تعذر إنشاء جلسة آمنة مع قاعدة البيانات.");const h={apikey:this.config.supabaseKey,Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json",Accept:"application/json",...(opt.headers||{})};const r=await fetch(this.config.supabaseUrl+"/rest/v1/"+path,{...opt,headers:h});const text=await r.text();let data=null;if(text){try{data=JSON.parse(text)}catch(e){data=text}}if(!r.ok){const msg=data?.message||data?.details||data?.hint||data?.code||"تعذر تنفيذ العملية على قاعدة البيانات.";const er=new Error(msg);er.status=r.status;er.data=data;throw er}return data},mapAuthError(e){const m=String(e?.message||"").toLowerCase();if(m.includes("already registered")||m.includes("user already registered"))return"هذا البريد الإلكتروني مرتبط بحساب موجود مسبقاً. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.";if(m.includes("invalid login credentials"))return"البريد الإلكتروني أو كلمة المرور غير صحيحة.";if(m.includes("email not confirmed"))return"البريد الإلكتروني غير مؤكد.";if(m.includes("expired"))return"انتهت صلاحية رمز التحقق.";if(m.includes("invalid otp")||m.includes("invalid token"))return"رمز التحقق غير صحيح.";if(m.includes("rate")||m.includes("security purposes"))return"تم إجراء محاولات كثيرة خلال وقت قصير. يرجى الانتظار قليلاً ثم المحاولة من جديد.";if(m.includes("failed to fetch"))return"تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت ثم إعادة المحاولة.";return e?.message||"حدث خطأ في خدمة الحسابات."},getSafeUser(u){if(!u)return null;const m=u.user_metadata||{};return{id:u.id,name:m.name||m.full_name||u.name||"مالك المنشأة",username:m.username||u.username||"",email:u.email||"",role:m.role||u.role||"مالك",status:"نشط",createdAt:u.created_at||u.createdAt||"",lastLogin:u.last_sign_in_at||u.lastLogin||""}},setPendingVerification(d={}){const x={email:this.normalizeEmail(d.email),name:this.cleanText(d.name),username:this.normalizeUsername(d.username),createdAt:this.now()};localStorage.setItem(this.keys.pendingVerification,JSON.stringify(x));return x},getPendingVerification(){try{return JSON.parse(localStorage.getItem(this.keys.pendingVerification)||"null")}catch(e){return null}},clearPendingVerification(){localStorage.removeItem(this.keys.pendingVerification)},async createUser(u={}){const name=this.cleanText(u.name),username=this.normalizeUsername(u.username),email=this.normalizeEmail(u.email),password=String(u.password||"");if(!name)return{success:false,message:"الاسم الكامل مطلوب."};if(username.length<3)return{success:false,message:"اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{success:false,message:"يرجى إدخال بريد إلكتروني صحيح."};if(password.length<8)return{success:false,message:"كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل."};try{const d=await this.authFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{name,full_name:name,username,role:"مالك"}})});if(d?.user&&!d?.session&&Array.isArray(d?.user?.identities)&&d.user.identities.length===0)return{success:false,message:"هذا البريد الإلكتروني مرتبط بحساب موجود مسبقاً. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد."};this.setPendingVerification({email,name,username});return{success:true,user:this.getSafeUser(d.user),needsEmailConfirmation:!d?.session?.access_token,email,message:d?.session?.access_token?"تم إنشاء الحساب.":"تم إنشاء الحساب. أرسلنا رمز التحقق إلى بريدك الإلكتروني."}}catch(e){return{success:false,message:this.mapAuthError(e)}}},async verifyEmailOtp(email,token){try{const d=await this.authFetch("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"signup",email:this.normalizeEmail(email),token:this.cleanText(token).replace(/\s+/g,"")})});this.clearPendingVerification();sessionStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.session);return{success:true,user:this.getSafeUser(d.user),message:"تم تأكيد البريد الإلكتروني بنجاح."}}catch(e){return{success:false,message:this.mapAuthError(e)}}},async resendConfirmation(email){try{await this.authFetch("/auth/v1/resend",{method:"POST",body:JSON.stringify({type:"signup",email:this.normalizeEmail(email)})});return{success:true,message:"تم إرسال رمز تحقق جديد."}}catch(e){return{success:false,message:this.mapAuthError(e)}}},authorizeDevice(user){const u=this.getSafeUser(user)||user||{},x={authorized:true,ownerId:u.id||"",name:u.name||"مالك المنشأة",username:u.username||"owner",email:this.normalizeEmail(u.email||""),authorizedAt:this.now()};localStorage.setItem(this.keys.deviceAuth,"true");localStorage.setItem(this.keys.deviceOwner,JSON.stringify(x));return x},isDeviceAuthorized(){return localStorage.getItem(this.keys.deviceAuth)==="true"&&!!this.getDeviceOwner()},getDeviceOwner(){try{const x=JSON.parse(localStorage.getItem(this.keys.deviceOwner)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}},removeDeviceAuthorization(){localStorage.removeItem(this.keys.deviceAuth);localStorage.removeItem(this.keys.deviceOwner);this.clearStaffSession()},async login(login,password,remember=false){const email=this.normalizeEmail(login);if(!email||!password)return{success:false,message:"يرجى إدخال البريد الإلكتروني وكلمة المرور."};try{const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password:String(password)})});if(!d.access_token||!d.user)return{success:false,message:"تعذر إنشاء جلسة المستخدم."};this.storeSession(d,true);localStorage.setItem(this.keys.rememberedUser,remember?email:"");this.authorizeDevice(d.user);this.clearPendingVerification();this.clearStaffSession();this.clearBusinessIdCache();return{success:true,user:this.getSafeUser(d.user)}}catch(e){return{success:false,message:this.mapAuthError(e)}}},async verifyOwnerPassword(password){const owner=this.getDeviceOwner();if(!owner?.email)return{success:false,message:"هذا الجهاز غير مرتبط بحساب المنشأة."};if(!password)return{success:false,message:"يرجى إدخال كلمة مرور المالك."};try{const d=await this.authFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:owner.email,password:String(password)})});if(!d?.access_token||!d?.user)return{success:false,message:"تعذر التحقق من حساب المالك."};this.storeSession(d,true);this.authorizeDevice(d.user);return{success:true,user:this.getSafeUser(d.user)}}catch(e){return{success:false,message:this.mapAuthError(e)}}},storeSession(s,remember=true){const x={access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),token_type:s.token_type||"bearer",user:s.user,remember:Boolean(remember)},str=JSON.stringify(x);if(remember){localStorage.setItem(this.keys.session,str);sessionStorage.removeItem(this.keys.session)}else{sessionStorage.setItem(this.keys.session,str);localStorage.removeItem(this.keys.session)}localStorage.setItem(this.keys.cachedUser,JSON.stringify(this.getSafeUser(s.user)));return x},getSession(){const raw=sessionStorage.getItem(this.keys.session)||localStorage.getItem(this.keys.session);if(!raw)return null;try{const s=JSON.parse(raw);return s?.access_token&&s?.user?s:null}catch(e){return null}},isLoggedIn(){return!!this.getSession()},getCurrentUser(){const s=this.getSession();if(s?.user)return this.getSafeUser(s.user);const d=this.getDeviceOwner();if(d)return{id:d.ownerId,name:d.name,username:d.username,email:d.email,role:"مالك"};try{return JSON.parse(localStorage.getItem(this.keys.cachedUser)||"null")}catch(e){return null}},getRememberedUser(){return localStorage.getItem(this.keys.rememberedUser)||""},async refreshSession(){const s=this.getSession();if(!s?.refresh_token)return false;if((s.expires_at||0)>Math.floor(Date.now()/1000)+60)return true;try{const d=await this.authFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:s.refresh_token})});this.storeSession(d,true);this.authorizeDevice(d.user);return true}catch(e){sessionStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.session);return false}},async logout(redirect=true){const s=this.getSession();try{if(s?.access_token)await this.authFetch("/auth/v1/logout",{method:"POST"})}catch(e){}this.removeDeviceAuthorization();sessionStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.session);localStorage.removeItem(this.keys.cachedUser);this.clearBusinessIdCache();sessionStorage.removeItem("varex_authenticated");localStorage.removeItem("varex_authenticated");if(redirect)location.replace("./login.html");return true},requireLogin(){if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage()||this.isResetPasswordPage())return true;if(this.isDeviceAuthorized()){if(this.isLoggedIn())this.refreshSession();return true}if(this.isLoggedIn()){const u=this.getSession()?.user;if(u)this.authorizeDevice(u);return true}location.replace("./login.html");return false},isLoginPage(){return location.pathname.toLowerCase().endsWith("login.html")},isRegisterPage(){return location.pathname.toLowerCase().endsWith("register.html")},isVerifyEmailPage(){return location.pathname.toLowerCase().endsWith("verify-email.html")},isResetPasswordPage(){return location.pathname.toLowerCase().endsWith("reset-password.html")},redirectLoggedUser(){if((this.isLoginPage()||this.isRegisterPage())&&(this.isLoggedIn()||this.isDeviceAuthorized())){location.replace("./index.html");return true}return false},async requestPasswordReset(email){try{const redirect=encodeURIComponent("https://varexapp.com/reset-password.html");await this.authFetch("/auth/v1/recover?redirect_to="+redirect,{method:"POST",body:JSON.stringify({email:this.normalizeEmail(email)})});return{success:true,message:"تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني."}}catch(e){return{success:false,message:this.mapAuthError(e)}}},async updateCurrentUser(c={}){const s=this.getSession();if(!s)return{success:false,message:"يجب التحقق من حساب المالك أولاً."};const body={},data={};if(c.email!==undefined)body.email=this.normalizeEmail(c.email);["name","username","role"].forEach(k=>{if(c[k]!==undefined)data[k]=this.cleanText(c[k])});if(Object.keys(data).length)body.data={...(s.user.user_metadata||{}),...data};try{const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify(body)});s.user=u;this.storeSession(s,true);this.authorizeDevice(u);return{success:true,user:this.getSafeUser(u)}}catch(e){return{success:false,message:this.mapAuthError(e)}}},async changePassword(c,n){if(String(n||"").length<8)return{success:false,message:"كلمة المرور الجديدة يجب أن تحتوي على 8 أحرف على الأقل."};try{const s=this.getSession();if(!s)return{success:false,message:"يجب تسجيل الدخول بحساب المالك أولاً."};const u=await this.authFetch("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:String(n)})});s.user=u;this.storeSession(s,true);return{success:true,message:"تم تغيير كلمة المرور بنجاح."}}catch(e){return{success:false,message:this.mapAuthError(e)}}},

clearBusinessIdCache(){try{const s=this.getSession(),uid=s?.user?.id;if(uid)localStorage.removeItem(`${this.keys.businessId}__${uid}`);localStorage.removeItem(this.keys.businessId)}catch(e){}},
async getCurrentBusinessId(force=false){let s=this.getSession();if(!s?.access_token||!s?.user?.id)throw new Error("لا توجد جلسة مستخدم صالحة.");if((s.expires_at||0)<=Math.floor(Date.now()/1000)+60){const ok=await this.refreshSession();if(!ok)throw new Error("انتهت جلسة المستخدم. يرجى تسجيل الدخول من جديد.");s=this.getSession()}const cacheKey=`${this.keys.businessId}__${s.user.id}`;if(!force){const cached=localStorage.getItem(cacheKey);if(cached)return cached}const result=await this.dbFetch("rpc/get_current_business_id",{method:"POST",body:"{}"});let businessId=null;if(typeof result==="string")businessId=result;else if(Array.isArray(result))businessId=result[0]?.get_current_business_id||result[0]?.business_id||result[0]||null;else if(result&&typeof result==="object")businessId=result.get_current_business_id||result.business_id||result.id||null;if(!businessId)throw new Error("لم يتم العثور على منشأة مرتبطة بهذا الحساب.");businessId=String(businessId).replace(/^"|"$/g,"").trim();if(!businessId)throw new Error("لم يتم العثور على منشأة مرتبطة بهذا الحساب.");localStorage.setItem(cacheKey,businessId);return businessId},

mapDbProduct(row,suppliers={}){if(!row)return null;return{id:row.id,createdAt:row.created_at||"",updatedAt:row.updated_at||"",businessId:row.business_id||"",name:row.name||"",sku:row.sku||"",barcode:row.barcode||"",category:row.category||"",cost:this.toNumber(row.cost),price:this.toNumber(row.price),quantity:this.toNumber(row.quantity),minimumStock:this.toNumber(row.minimum_stock),unit:row.unit||"piece",status:row.status||"active",description:row.description||"",supplierId:row.supplier_id||"",supplier:row.supplier_id?(suppliers[row.supplier_id]||""):"",taxRate:this.toNumber(row.tax_rate),imageUrl:row.image_url||""}},
async getSupplierMap(){try{const rows=await this.dbFetch("suppliers?select=id,name&order=name.asc");const map={};(Array.isArray(rows)?rows:[]).forEach(x=>{if(x?.id)map[x.id]=x.name||""});return map}catch(e){console.warn("VAREX SUPPLIERS MAP:",e);return{}}},
async resolveSupplierIdByName(name){const n=this.cleanText(name);if(!n)return null;const rows=await this.dbFetch("suppliers?select=id,name&name=eq."+encodeURIComponent(n)+"&limit=1");return Array.isArray(rows)&&rows[0]?.id?rows[0].id:null},
async syncProductsFromSupabase(){const[rows,supplierMap]=await Promise.all([this.dbFetch("products?select=*&order=created_at.asc"),this.getSupplierMap()]);const products=(Array.isArray(rows)?rows:[]).map(x=>this.mapDbProduct(x,supplierMap)).filter(Boolean);this.saveProducts(products);return products},
async addProductRemote(p={}){const businessId=await this.getCurrentBusinessId();let supplierId=p.supplierId||null;if(!supplierId&&this.cleanText(p.supplier)){supplierId=await this.resolveSupplierIdByName(p.supplier);if(!supplierId)throw new Error("المورد المكتوب غير موجود في قائمة الموردين. يرجى إضافة المورد أولاً، أو يمكن ترك خانة المورد فارغة.")}const body={business_id:businessId,name:this.cleanText(p.name||p.productName),sku:this.cleanText(p.sku||"")||null,barcode:this.cleanText(p.barcode)||null,category:this.cleanText(p.category)||null,cost:this.positiveNumber(p.cost||p.costPrice),price:this.positiveNumber(p.price||p.salePrice),quantity:this.positiveNumber(p.quantity),minimum_stock:this.positiveNumber(p.minimumStock),unit:this.cleanText(p.unit)||"piece",status:this.cleanText(p.status)||"active",description:this.cleanText(p.description)||null,supplier_id:supplierId,tax_rate:this.positiveNumber(p.taxRate),image_url:this.cleanText(p.imageUrl)||null,updated_at:this.now()};if(!body.name)throw new Error("اسم المنتج مطلوب.");const rows=await this.dbFetch("products?select=*",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});await this.syncProductsFromSupabase();return Array.isArray(rows)&&rows[0]?this.mapDbProduct(rows[0],await this.getSupplierMap()):null},
async updateProductRemote(id,c={}){if(!id)throw new Error("معرّف المنتج غير موجود.");const body={updated_at:this.now()};if(c.name!==undefined)body.name=this.cleanText(c.name);if(c.sku!==undefined)body.sku=this.cleanText(c.sku)||null;if(c.barcode!==undefined)body.barcode=this.cleanText(c.barcode)||null;if(c.category!==undefined)body.category=this.cleanText(c.category)||null;if(c.cost!==undefined)body.cost=this.positiveNumber(c.cost);if(c.price!==undefined)body.price=this.positiveNumber(c.price);if(c.quantity!==undefined)body.quantity=this.positiveNumber(c.quantity);if(c.minimumStock!==undefined)body.minimum_stock=this.positiveNumber(c.minimumStock);if(c.unit!==undefined)body.unit=this.cleanText(c.unit)||"piece";if(c.status!==undefined)body.status=this.cleanText(c.status)||"active";if(c.description!==undefined)body.description=this.cleanText(c.description)||null;if(c.taxRate!==undefined)body.tax_rate=this.positiveNumber(c.taxRate);if(c.imageUrl!==undefined)body.image_url=this.cleanText(c.imageUrl)||null;if(c.supplier!==undefined){const n=this.cleanText(c.supplier);body.supplier_id=n?await this.resolveSupplierIdByName(n):null;if(n&&!body.supplier_id)throw new Error("المورد المكتوب غير موجود في قائمة الموردين.")}await this.dbFetch("products?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(body)});await this.syncProductsFromSupabase();return this.getProductById(id)},
async deleteProductRemote(id){if(!id)return false;await this.dbFetch("products?id=eq."+encodeURIComponent(id),{method:"DELETE",headers:{Prefer:"return=minimal"}});await this.syncProductsFromSupabase();return true},
async adjustStockRemote(id,change){const product=this.getProductById(id)||((await this.syncProductsFromSupabase()).find(x=>String(x.id)===String(id)));if(!product)throw new Error("المنتج غير موجود.");const next=this.toNumber(product.quantity)+this.toNumber(change);if(next<0)throw new Error("الكمية المتوفرة غير كافية.");await this.dbFetch("products?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({quantity:next,updated_at:this.now()})});await this.syncProductsFromSupabase();return this.getProductById(id)},

getProducts(){return this.getData(this.keys.products)},saveProducts(x){return this.saveData(this.keys.products,x)},getProductById(id){return this.getProducts().find(x=>String(x.id)===String(id))||null},findProductByBarcode(b){return this.getProducts().find(x=>this.cleanText(x.barcode)===this.cleanText(b))||null},
addProduct(p={}){const a=this.getProducts(),x={...p,id:p.id||this.generateId("PRD"),name:this.cleanText(p.name||p.productName),quantity:this.positiveNumber(p.quantity),price:this.positiveNumber(p.price||p.salePrice),cost:this.positiveNumber(p.cost||p.costPrice),createdAt:p.createdAt||this.now(),updatedAt:this.now()};a.push(x);this.saveProducts(a);return x},
updateProduct(id,c={}){const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};this.saveProducts(a);return a[i]},
deleteProduct(id){const a=this.getProducts(),b=a.filter(x=>String(x.id)!==String(id));this.saveProducts(b);return b.length!==a.length},
adjustStock(id,n){const a=this.getProducts(),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i].quantity=Math.max(0,this.toNumber(a[i].quantity)+this.toNumber(n));this.saveProducts(a);return a[i]},
getSales(){return this.getData(this.keys.sales)},saveSales(x){return this.saveData(this.keys.sales,x)},getSaleById(id){return this.getSales().find(x=>String(x.id)===String(id))||null},
addSale(s={}){const a=this.getSales(),x={...s,id:s.id||this.generateId("SAL"),invoiceNumber:s.invoiceNumber||`INV-${Date.now()}`,createdAt:s.createdAt||this.now(),date:s.date||this.now(),updatedAt:this.now()};a.push(x);this.saveSales(a);return x},
deleteSale(id){const a=this.getSales(),b=a.filter(x=>String(x.id)!==String(id));this.saveSales(b);return b.length!==a.length},
completeSale(s={}){const items=Array.isArray(s.items)?s.items:[];if(!items.length)return{success:false,message:"لا توجد منتجات في الفاتورة."};const p=this.getProducts();for(const x of items){const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);if(i>=0&&q>this.toNumber(p[i].quantity))return{success:false,message:"الكمية غير متوفرة للمنتج: "+(p[i].name||"")}}for(const x of items){const i=p.findIndex(y=>String(y.id)===String(x.productId||x.id)),q=this.positiveNumber(x.quantity||x.qty||1);if(i>=0)p[i].quantity=Math.max(0,this.toNumber(p[i].quantity)-q)}this.saveProducts(p);return{success:true,sale:this.addSale(s)}},
getCustomers(){return this.getData(this.keys.customers)},saveCustomers(x){return this.saveData(this.keys.customers,x)},addCustomer(x={}){return this._add(this.keys.customers,"CUS",x)},updateCustomer(id,c={}){return this._update(this.keys.customers,id,c)},deleteCustomer(id){return this._delete(this.keys.customers,id)},
getSuppliers(){return this.getData(this.keys.suppliers)},saveSuppliers(x){return this.saveData(this.keys.suppliers,x)},addSupplier(x={}){return this._add(this.keys.suppliers,"SUP",x)},updateSupplier(id,c={}){return this._update(this.keys.suppliers,id,c)},deleteSupplier(id){return this._delete(this.keys.suppliers,id)},
getEmployees(){return this.getData(this.keys.employees)},saveEmployees(x){return this.saveData(this.keys.employees,x)},addEmployee(x={}){return this._add(this.keys.employees,"EMP",x)},updateEmployee(id,c={}){return this._update(this.keys.employees,id,c)},deleteEmployee(id){return this._delete(this.keys.employees,id)},
getTransactions(){return this.getData(this.keys.transactions)},saveTransactions(x){return this.saveData(this.keys.transactions,x)},addTransaction(x={}){return this._add(this.keys.transactions,"TRX",{...x,amount:this.positiveNumber(x.amount),date:x.date||this.today()})},updateTransaction(id,c={}){return this._update(this.keys.transactions,id,c)},deleteTransaction(id){return this._delete(this.keys.transactions,id)},
getHeldSales(){return this.getData(this.keys.heldSales)},saveHeldSales(x){return this.saveData(this.keys.heldSales,x)},holdSale(x={}){return this._add(this.keys.heldSales,"HOLD",x)},removeHeldSale(id){return this._delete(this.keys.heldSales,id)},
_add(k,p,x={}){const a=this.getData(k),o={...x,id:x.id||this.generateId(p),createdAt:x.createdAt||this.now(),updatedAt:this.now()};a.push(o);this.saveData(k,a);return o},
_update(k,id,c={}){const a=this.getData(k),i=a.findIndex(x=>String(x.id)===String(id));if(i<0)return false;a[i]={...a[i],...c,id:a[i].id,updatedAt:this.now()};this.saveData(k,a);return a[i]},
_delete(k,id){const a=this.getData(k),b=a.filter(x=>String(x.id)!==String(id));this.saveData(k,b);return b.length!==a.length},
getSettings(){const d={businessName:"VAREX",currency:"AED",currencySymbol:"د.إ",taxEnabled:true,taxRate:5,lowStockLimit:5,language:"ar"},p=this.getObject(this.keys.settings,{});return{...d,...p}},
saveSettings(s={}){const d={...this.getSettings(),...s,updatedAt:this.now()};this.saveObject(this.keys.settings,d);return true},
money(v){const s=this.getSettings(),sym=this.cleanText(s.currencySymbol)||(s.currency==="AED"?"د.إ":s.currency);return`${this.formatNumber(v,2)} ${sym}`},
calculateTax(v){const s=this.getSettings();return s.taxEnabled===false?0:this.positiveNumber(v)*this.toNumber(s.taxRate,5)/100},
getTodaySales(){const t=this.today();return this.getSales().filter(s=>this.normalizeDate(s.createdAt||s.date||s.saleDate||s.invoiceDate||"")===t)},
getTodaySalesTotal(){return this.getTodaySales().reduce((a,s)=>a+this.toNumber(s.total??s.grandTotal??s.finalTotal??s.netTotal??s.amount??0),0)},
getStockAlerts(){const l=this.toNumber(this.getSettings().lowStockLimit,5);return this.getProducts().filter(p=>this.toNumber(p.quantity)<=this.toNumber(p.minimumStock,l))},

getStaffUsers(){try{const x=JSON.parse(localStorage.getItem(this.scopeKey(this.keys.staffUsers))||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}},
saveStaffUsers(x){localStorage.setItem(this.scopeKey(this.keys.staffUsers),JSON.stringify(Array.isArray(x)?x:[]));return true},
getActiveStaffUsers(){return this.getStaffUsers().filter(x=>x.status!=="disabled")},
getStaffSession(){try{const x=JSON.parse(sessionStorage.getItem(this.keys.staffSession)||"null");return x&&typeof x==="object"?x:null}catch(e){return null}},
setStaffSession(u){const x={id:u.id,name:u.name||"المستخدم",email:u.email||"",username:u.username||"",role:u.role||"custom",permissions:Array.isArray(u.permissions)?u.permissions:[],isOwner:!!u.isOwner,loginAt:this.now()};sessionStorage.setItem(this.keys.staffSession,JSON.stringify(x));return x},
clearStaffSession(){sessionStorage.removeItem(this.keys.staffSession)},getActiveOperator(){return this.getStaffSession()},
roleName(r){return{owner:"المالك",manager:"المدير",accountant:"المحاسب",cashier:"الكاشير",custom:"مستخدم"}[r]||"مستخدم"},
getOwnerOperator(){const d=this.getDeviceOwner(),u=this.getCurrentUser()||{};return{id:"owner",name:d?.name||u.name||"مالك المنشأة",email:d?.email||u.email||"",username:d?.username||u.username||"owner",role:"owner",permissions:["*"],isOwner:true}},
async hashPassword(v){const text=String(v||"");if(window.crypto?.subtle){const b=new TextEncoder().encode(text),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")}let h=5381;for(let i=0;i<text.length;i++)h=((h<<5)+h)^text.charCodeAt(i);return"fallback-"+(h>>>0).toString(16)},
async setStaffPassword(email,password){const a=this.getStaffUsers(),mail=this.normalizeEmail(email),i=a.findIndex(x=>this.normalizeEmail(x.email)===mail);if(i<0)return false;a[i].passwordHash=await this.hashPassword(password);a[i].passwordUpdatedAt=this.now();if(!a[i].username)a[i].username=this.normalizeUsername((a[i].name||mail.split("@")[0]).replace(/\s+/g,"."));this.saveStaffUsers(a);return true},
async verifyStaffPassword(u,password){if(!u?.passwordHash)return{success:false,message:"لم يتم تعيين كلمة مرور لهذا المستخدم. يرجى تعديل المستخدم وتحديد كلمة مرور ثم الحفظ."};const h=await this.hashPassword(password);return h===u.passwordHash?{success:true}:{success:false,message:"كلمة المرور غير صحيحة."}},
hasPermission(p){const u=this.getStaffSession();if(!u)return false;if(u.isOwner||u.permissions?.includes("*"))return true;return Array.isArray(u.permissions)&&u.permissions.includes(p)},

getSubscription(){const d={plan:"",planName:"",status:"inactive",billingType:"",price:0,currency:"AED",startedAt:"",expiresAt:"",lifetime:false,licenseKey:"",paymentStatus:"unpaid",updatedAt:""};try{const x=JSON.parse(localStorage.getItem(this.scopeKey(this.keys.subscription))||"null");return x&&typeof x==="object"&&!Array.isArray(x)?{...d,...x}:{...d}}catch(e){return{...d}}},
saveSubscription(d={}){const x={...this.getSubscription(),...d,updatedAt:this.now()};localStorage.setItem(this.scopeKey(this.keys.subscription),JSON.stringify(x));return x},
generateLicenseKey(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let r="VAREX";for(let g=0;g<4;g++){r+="-";for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)]}return r},
activateSubscription(o={}){const type=String(o.billingType||o.type||"monthly"),now=new Date();let expiresAt="",lifetime=false;if(type==="monthly"){const e=new Date(now);e.setMonth(e.getMonth()+1);expiresAt=e.toISOString()}else if(type==="yearly"){const e=new Date(now);e.setFullYear(e.getFullYear()+1);expiresAt=e.toISOString()}else if(type==="trial"){const e=new Date(now);e.setDate(e.getDate()+7);expiresAt=e.toISOString()}else if(type==="lifetime")lifetime=true;return this.saveSubscription({plan:o.plan||"business",planName:o.planName||"VAREX Business",billingType:type,price:this.positiveNumber(o.price),currency:o.currency||"AED",status:"active",paymentStatus:o.paymentStatus||"paid",startedAt:now.toISOString(),expiresAt,lifetime,licenseKey:o.licenseKey||this.generateLicenseKey()})},
cancelSubscription(){return this.saveSubscription({...this.getSubscription(),status:"cancelled"})},expireSubscription(){return this.saveSubscription({...this.getSubscription(),status:"expired"})},
isSubscriptionActive(){const s=this.getSubscription();if(s.status!=="active")return false;if(s.lifetime||s.billingType==="lifetime")return true;if(!s.expiresAt)return false;const e=new Date(s.expiresAt);if(Number.isNaN(e.getTime()))return false;if(e<=Date.now()){this.expireSubscription();return false}return true},
getSubscriptionDaysRemaining(){const s=this.getSubscription();if(s.lifetime||s.billingType==="lifetime")return Infinity;if(!s.expiresAt)return 0;const e=new Date(s.expiresAt);return Number.isNaN(e.getTime())?0:Math.max(0,Math.ceil((e-Date.now())/86400000))},
getSubscriptionStatus(){return{...this.getSubscription(),active:this.isSubscriptionActive(),daysRemaining:this.getSubscriptionDaysRemaining()}},
isSubscriptionPage(){return location.pathname.toLowerCase().endsWith("subscription.html")},isSubscriptionSuccessPage(){return location.pathname.toLowerCase().endsWith("subscription-success.html")},
isSubscriptionGateEnabled(){return localStorage.getItem(this.keys.subscriptionGate)==="true"},enableSubscriptionGate(){localStorage.setItem(this.keys.subscriptionGate,"true");return true},disableSubscriptionGate(){localStorage.setItem(this.keys.subscriptionGate,"false");return true},
requireSubscription(){if(!this.isSubscriptionGateEnabled())return true;if(this.isLoginPage()||this.isRegisterPage()||this.isVerifyEmailPage()||this.isResetPasswordPage()||this.isSubscriptionPage()||this.isSubscriptionSuccessPage())return true;if(!this.isSubscriptionActive()){location.replace("./subscription.html");return false}return true},
initialize(){[this.keys.products,this.keys.sales,this.keys.customers,this.keys.suppliers,this.keys.employees,this.keys.transactions,this.keys.heldSales].forEach(k=>{const sk=this.scopeKey(k);if(localStorage.getItem(sk)===null)localStorage.setItem(sk,"[]")});return true}};
VAREX.initialize();window.VAREX=VAREX;

/* =========================================================
   VAREX SYSTEM DIALOGS
   نوافذ داخلية بديلة عن alert / confirm / prompt في المتصفح
========================================================= */
(function(){
"use strict";

let dialogQueue=Promise.resolve();
let activeDialog=null;
let previousFocus=null;
let previousBodyOverflow="";

function waitForBody(){
if(document.body)return Promise.resolve();
return new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
}

function addDialogStyles(){
if(document.getElementById("varexSystemDialogStyles"))return;
const style=document.createElement("style");
style.id="varexSystemDialogStyles";
style.textContent=`
#varexSystemDialog[hidden]{display:none!important}
#varexSystemDialog{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,15,35,.68);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:Arial,Tahoma,sans-serif;box-sizing:border-box}
#varexSystemDialog *{box-sizing:border-box}
#varexSystemDialog .varex-dialog-card{width:min(520px,calc(100vw - 32px));max-height:min(680px,calc(100dvh - 32px));overflow:auto;padding:28px;border:1px solid rgba(148,163,184,.28);border-radius:22px;background:#fff;color:#172554;text-align:center;box-shadow:0 30px 90px rgba(2,6,23,.38);animation:varexDialogIn .16s ease-out}
#varexSystemDialog .varex-dialog-brand{display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:32px;margin-bottom:17px;padding:0 15px;border-radius:999px;background:linear-gradient(135deg,#172554,#263d70);color:#fff;font-size:14px;font-weight:900;letter-spacing:2px;direction:ltr}
#varexSystemDialog .varex-dialog-icon{width:58px;height:58px;margin:0 auto 15px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:#eef2ff;color:#172554;font-size:29px;font-weight:900}
#varexSystemDialog .varex-dialog-title{margin:0 0 12px;color:inherit;font-size:21px;line-height:1.4;font-weight:900;text-align:center}
#varexSystemDialog .varex-dialog-message{margin:0 auto;color:#475569;font-size:15px;line-height:1.9;font-weight:700;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere}
#varexSystemDialog .varex-dialog-input-wrap{display:none;margin-top:19px}
#varexSystemDialog[data-kind="prompt"] .varex-dialog-input-wrap{display:block}
#varexSystemDialog .varex-dialog-input{width:100%;height:48px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:12px;outline:none;background:#fff;color:#172554;font:700 14px Arial,Tahoma,sans-serif;text-align:center;direction:auto}
#varexSystemDialog .varex-dialog-input:focus{border-color:#172554;box-shadow:0 0 0 4px rgba(23,37,84,.12)}
#varexSystemDialog .varex-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:24px}
#varexSystemDialog[data-kind="alert"] .varex-dialog-actions{grid-template-columns:1fr}
#varexSystemDialog[data-kind="alert"] .varex-dialog-cancel{display:none}
#varexSystemDialog .varex-dialog-button{min-height:46px;padding:11px 16px;border-radius:12px;font:900 14px Arial,Tahoma,sans-serif;cursor:pointer}
#varexSystemDialog .varex-dialog-confirm{border:1px solid #172554;background:linear-gradient(135deg,#172554,#263d70);color:#fff;box-shadow:0 6px 16px rgba(23,37,84,.22)}
#varexSystemDialog .varex-dialog-cancel{border:1px solid #cbd5e1;background:#f8fafc;color:#334155}
#varexSystemDialog .varex-dialog-button:focus-visible{outline:3px solid rgba(37,99,235,.35);outline-offset:2px}
html[data-theme="dark"] #varexSystemDialog .varex-dialog-card,html[data-varex-theme="dark"] #varexSystemDialog .varex-dialog-card,body.varex-dark #varexSystemDialog .varex-dialog-card{border-color:#334155;background:#111c33;color:#f8fafc}
html[data-theme="dark"] #varexSystemDialog .varex-dialog-message,html[data-varex-theme="dark"] #varexSystemDialog .varex-dialog-message,body.varex-dark #varexSystemDialog .varex-dialog-message{color:#cbd5e1}
html[data-theme="dark"] #varexSystemDialog .varex-dialog-icon,html[data-varex-theme="dark"] #varexSystemDialog .varex-dialog-icon,body.varex-dark #varexSystemDialog .varex-dialog-icon{background:#1e2d4b;color:#dbeafe}
html[data-theme="dark"] #varexSystemDialog .varex-dialog-input,html[data-varex-theme="dark"] #varexSystemDialog .varex-dialog-input,body.varex-dark #varexSystemDialog .varex-dialog-input{border-color:#475569;background:#17233d;color:#f8fafc}
html[data-theme="dark"] #varexSystemDialog .varex-dialog-cancel,html[data-varex-theme="dark"] #varexSystemDialog .varex-dialog-cancel,body.varex-dark #varexSystemDialog .varex-dialog-cancel{border-color:#475569;background:#1b2945;color:#e2e8f0}
@keyframes varexDialogIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media(max-width:520px){#varexSystemDialog{padding:14px}#varexSystemDialog .varex-dialog-card{width:100%;padding:23px 18px;border-radius:18px}#varexSystemDialog .varex-dialog-title{font-size:19px}#varexSystemDialog .varex-dialog-message{font-size:14px}#varexSystemDialog .varex-dialog-actions{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){#varexSystemDialog .varex-dialog-card{animation:none}}
`;
(document.head||document.documentElement).appendChild(style);
}

function createDialog(){
let overlay=document.getElementById("varexSystemDialog");
if(overlay)return overlay;
addDialogStyles();
overlay=document.createElement("div");
overlay.id="varexSystemDialog";
overlay.hidden=true;
overlay.dataset.kind="alert";
overlay.setAttribute("role","dialog");
overlay.setAttribute("aria-modal","true");
overlay.setAttribute("aria-labelledby","varexDialogTitle");
overlay.setAttribute("aria-describedby","varexDialogMessage");
overlay.innerHTML=`<div class="varex-dialog-card" role="document"><div class="varex-dialog-brand">VAREX</div><div class="varex-dialog-icon" aria-hidden="true">!</div><h2 class="varex-dialog-title" id="varexDialogTitle">تنبيه VAREX</h2><div class="varex-dialog-message" id="varexDialogMessage"></div><div class="varex-dialog-input-wrap"><input class="varex-dialog-input" id="varexDialogInput" autocomplete="off"></div><div class="varex-dialog-actions"><button type="button" class="varex-dialog-button varex-dialog-confirm" id="varexDialogConfirm">حسنًا</button><button type="button" class="varex-dialog-button varex-dialog-cancel" id="varexDialogCancel">إلغاء</button></div></div>`;
document.body.appendChild(overlay);
overlay.querySelector("#varexDialogConfirm").addEventListener("click",()=>finishDialog(true));
overlay.querySelector("#varexDialogCancel").addEventListener("click",()=>finishDialog(false));
return overlay;
}

function closeValue(confirmed){
if(!activeDialog)return null;
if(activeDialog.kind==="prompt"){
if(!confirmed)return null;
return activeDialog.overlay.querySelector("#varexDialogInput").value;
}
return activeDialog.kind==="confirm"?Boolean(confirmed):undefined;
}

function finishDialog(confirmed){
if(!activeDialog)return;
const current=activeDialog;
const value=closeValue(confirmed);
activeDialog=null;
current.overlay.hidden=true;
current.overlay.removeAttribute("data-state");
document.body.style.overflow=previousBodyOverflow;
if(previousFocus&&typeof previousFocus.focus==="function"&&document.contains(previousFocus)){
try{previousFocus.focus({preventScroll:true})}catch(e){previousFocus.focus()}
}
previousFocus=null;
current.resolve(value);
}

async function showDialog(kind,message,options={}){
await waitForBody();
return new Promise(resolve=>{
const overlay=createDialog();
const title=overlay.querySelector("#varexDialogTitle");
const text=overlay.querySelector("#varexDialogMessage");
const icon=overlay.querySelector(".varex-dialog-icon");
const input=overlay.querySelector("#varexDialogInput");
const confirmButton=overlay.querySelector("#varexDialogConfirm");
const cancelButton=overlay.querySelector("#varexDialogCancel");
const defaults=kind==="confirm"?{title:"تأكيد الإجراء",icon:"?",confirmText:"تأكيد"}:kind==="prompt"?{title:"تأكيد الهوية",icon:"🔒",confirmText:"متابعة"}:{title:"تنبيه VAREX",icon:"!",confirmText:"حسنًا"};
overlay.dataset.kind=kind;
title.textContent=String(options.title||defaults.title);
text.textContent=String(message??"");
icon.textContent=String(options.icon||defaults.icon);
confirmButton.textContent=String(options.confirmText||defaults.confirmText);
cancelButton.textContent=String(options.cancelText||"إلغاء");
input.value=String(options.defaultValue??"");
input.placeholder=String(options.placeholder||"");
input.type=["text","password","email","number","tel"].includes(options.type)?options.type:"text";
input.maxLength=Number.isFinite(Number(options.maxLength))?Math.max(1,Number(options.maxLength)):256;
previousFocus=document.activeElement;
previousBodyOverflow=document.body.style.overflow;
document.body.style.overflow="hidden";
activeDialog={kind,overlay,resolve};
overlay.hidden=false;
overlay.dataset.state="open";
requestAnimationFrame(()=>{
const target=kind==="prompt"?input:confirmButton;
target.focus({preventScroll:true});
if(kind==="prompt"&&input.value)input.select();
});
});
}

function enqueueDialog(kind,message,options){
const task=()=>showDialog(kind,message,options);
const result=dialogQueue.then(task,task);
dialogQueue=result.then(()=>undefined,()=>undefined);
return result;
}

document.addEventListener("keydown",event=>{
if(!activeDialog)return;
if(event.key==="Tab"){
const focusable=[...activeDialog.overlay.querySelectorAll("input,button")].filter(element=>!element.disabled&&getComputedStyle(element).display!=="none");
if(!focusable.length)return;
const first=focusable[0],last=focusable[focusable.length-1];
if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
return;
}
if(event.key==="Escape"){
event.preventDefault();
event.stopImmediatePropagation();
finishDialog(false);
return;
}
if(event.key==="Enter"){
event.preventDefault();
event.stopImmediatePropagation();
finishDialog(true);
}
},true);

const api={
alert(message,options){return enqueueDialog("alert",message,options)},
confirm(message,options){return enqueueDialog("confirm",message,options)},
prompt(message,options){return enqueueDialog("prompt",message,options)}
};

window.VAREXDialog=api;
window.varexAlert=api.alert;
window.varexConfirm=api.confirm;
window.varexPrompt=api.prompt;
})();

/* ========================================================= FIXED LAYOUT - NO SHAKE ========================================================= */
(function(){
const s=document.createElement("style");
s.id="varexFixedLayoutBoot";
s.textContent=`
:root{--sidebar-width:240px!important;--sidebar:240px!important}
html{width:100%;min-height:100%;overflow-x:hidden}
body{width:100%;min-height:100%;margin:0;overflow-x:hidden}
.sidebar{width:240px!important;min-width:240px!important;max-width:240px!important}
.main{margin-right:240px!important;min-width:0!important}
`;
(document.head||document.documentElement).prepend(s)
})();

/* ========================================================= HELPERS ========================================================= */
function varexWait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
const VAREX_PERMISSION_MAP={"index.html":"dashboard","pos.html":"pos","products.html":"products","purchases.html":"products","transfers.html":"products","customers.html":"customers","suppliers.html":"suppliers","accounts.html":"accounts","expenses.html":"accounts","shifts.html":"pos","employees.html":"employees","branches.html":"settings","reports.html":"reports","notifications.html":"dashboard","activity.html":"users","users.html":"users","subscription.html":"**owner**","setting.html":"settings"};
const VAREX_MENU=[["index.html","▦","لوحة التحكم"],["pos.html","🛒","شاشة المبيعات"],["products.html","📦","المنتجات والمخزون"],["purchases.html","🧾","المشتريات"],["transfers.html","🔄","تحويلات المخزون"],["customers.html","👥","العملاء"],["suppliers.html","🚚","الموردون"],["accounts.html","💰","الحسابات"],["expenses.html","💸","المصروفات"],["shifts.html","🕘","ورديات الكاشير"],["employees.html","👤","الموظفون"],["branches.html","🏢","الفروع"],["reports.html","📊","التقارير"],["notifications.html","🔔","مركز التنبيهات"],["activity.html","📋","سجل النشاط"],["users.html","🔐","المستخدمون والصلاحيات"],["subscription.html","💎","الاشتراك والترخيص"],["setting.html","⚙️","الإعدادات"]];
function varexCurrentFile(){return location.pathname.split("/").pop().toLowerCase()||"index.html"}
function varexCanOpen(file){const u=VAREX.getStaffSession();if(!u)return false;if(u.isOwner)return true;const p=VAREX_PERMISSION_MAP[file];if(!p)return true;if(p==="**owner**")return false;return u.permissions?.includes(p)}
function varexFirstAllowedPage(){for(const[f]of VAREX_MENU)if(varexCanOpen(f))return f;return"index.html"}
function varexCheckCurrentPermission(){const u=VAREX.getStaffSession();if(!u)return false;if(varexCanOpen(varexCurrentFile()))return true;location.replace("./"+varexFirstAllowedPage());return false}

/* ========================================================= STAFF ========================================================= */
let varexSelectedStaffId=null,varexStaffLogoutRunning=false;
function varexInstallStaffUI(){if(document.getElementById("varexStaffOverlay"))return;const o=document.createElement("div");o.id="varexStaffOverlay";o.className="varex-staff-overlay";o.innerHTML=`<div class="varex-staff-card"><div class="varex-staff-brand">VAREX</div><h2>اختيار مستخدم النظام</h2><p class="varex-staff-sub">يرجى اختيار الحساب ثم إدخال كلمة المرور.</p><div class="varex-staff-list" id="varexStaffList"></div><div class="varex-staff-password" id="varexStaffPasswordBox"><div class="varex-selected-user" id="varexSelectedStaff">—</div><input id="varexStaffPassword" type="password" autocomplete="current-password" placeholder="كلمة المرور"><div class="varex-staff-error" id="varexStaffError"></div><div class="varex-staff-login-actions"><button id="varexStaffLoginBtn">دخول إلى VAREX</button><button id="varexStaffBackBtn">رجوع</button></div></div></div>`;document.body.appendChild(o);document.getElementById("varexStaffBackBtn").onclick=()=>{varexSelectedStaffId=null;document.getElementById("varexStaffPasswordBox").classList.remove("show");document.getElementById("varexStaffPassword").value="";document.getElementById("varexStaffError").textContent=""};document.getElementById("varexStaffLoginBtn").onclick=varexLoginSelectedStaff;document.getElementById("varexStaffPassword").addEventListener("keydown",e=>{if(e.key==="Enter")varexLoginSelectedStaff()})}
function varexRenderStaffUsers(){varexInstallStaffUI();const list=document.getElementById("varexStaffList"),owner=VAREX.getOwnerOperator(),users=VAREX.getActiveStaffUsers();list.innerHTML=`<button class="varex-staff-user owner" onclick="varexSelectStaff('__owner__')"><span class="varex-staff-avatar">👑</span><span><strong>${varexEsc(owner.name)}</strong><small>المالك / Owner</small></span></button>`+users.map(u=>`<button class="varex-staff-user" onclick="varexSelectStaff('${varexEscAttr(u.id)}')"><span class="varex-staff-avatar">${u.role==="cashier"?"🛒":u.role==="accountant"?"💰":u.role==="manager"?"👔":"👤"}</span><span><strong>${varexEsc(u.name||u.username||"المستخدم")}</strong><small>${VAREX.roleName(u.role)}</small></span></button>`).join("")}
function varexOpenStaffGate(){varexRenderStaffUsers();document.getElementById("varexStaffPasswordBox")?.classList.remove("show");const pass=document.getElementById("varexStaffPassword"),err=document.getElementById("varexStaffError"),btn=document.getElementById("varexStaffLoginBtn");if(pass)pass.value="";if(err)err.textContent="";if(btn){btn.disabled=false;btn.classList.remove("varex-login-processing","varex-login-success");btn.textContent="دخول إلى VAREX"}varexSelectedStaffId=null;document.getElementById("varexStaffOverlay")?.classList.add("show");document.body.style.overflow="hidden"}
function varexCloseStaffGate(){document.getElementById("varexStaffOverlay")?.classList.remove("show");document.body.style.overflow=""}
function varexSelectStaff(id){varexSelectedStaffId=id;const u=id==="__owner__"?VAREX.getOwnerOperator():VAREX.getStaffUsers().find(x=>String(x.id)===String(id));if(!u||u.status==="disabled")return;document.getElementById("varexSelectedStaff").textContent=`${u.name||"المستخدم"} — ${VAREX.roleName(u.role)}`;document.getElementById("varexStaffPassword").value="";document.getElementById("varexStaffError").textContent="";document.getElementById("varexStaffPasswordBox").classList.add("show");setTimeout(()=>document.getElementById("varexStaffPassword")?.focus(),120)}
async function varexLoginSelectedStaff(){const pass=document.getElementById("varexStaffPassword").value,err=document.getElementById("varexStaffError"),btn=document.getElementById("varexStaffLoginBtn");if(!pass){err.textContent="يرجى إدخال كلمة المرور.";return}if(btn.disabled)return;err.textContent="";btn.disabled=true;btn.innerHTML=`<span class="varex-mini-spinner"></span><span>جاري تسجيل الدخول...</span>`;await varexWait(650);let result;if(varexSelectedStaffId==="__owner__"){result=await VAREX.verifyOwnerPassword(pass);if(result.success)VAREX.setStaffSession(VAREX.getOwnerOperator())}else{const u=VAREX.getStaffUsers().find(x=>String(x.id)===String(varexSelectedStaffId));if(!u){btn.disabled=false;btn.textContent="دخول إلى VAREX";return}result=await VAREX.verifyStaffPassword(u,pass);if(result.success)VAREX.setStaffSession(u)}if(!result?.success){btn.disabled=false;btn.textContent="دخول إلى VAREX";err.textContent=result?.message||"تعذر تسجيل الدخول.";return}btn.innerHTML="✓ تم تسجيل الدخول بنجاح";await varexWait(650);varexCloseStaffGate();btn.disabled=false;btn.textContent="دخول إلى VAREX";varexBuildMenu();varexInstallTopSwitchUserButton();varexShowCurrentUser();varexCheckCurrentPermission()}
function varexSwitchUser(){VAREX.clearStaffSession();varexOpenStaffGate()}
function varexLogoutCurrentUser(){VAREX.clearStaffSession();varexOpenStaffGate()}
window.varexSwitchUser=varexSwitchUser;window.varexLogoutCurrentUser=varexLogoutCurrentUser;
function varexInitStaffAccess(){const session=VAREX.getStaffSession(),users=VAREX.getActiveStaffUsers();if(session){if(session.isOwner)return varexCheckCurrentPermission();const fresh=users.find(x=>String(x.id)===String(session.id));if(!fresh){VAREX.clearStaffSession();varexOpenStaffGate();return false}session.permissions=Array.isArray(fresh.permissions)?fresh.permissions:[];session.role=fresh.role;session.name=fresh.name;VAREX.setStaffSession(session);return varexCheckCurrentPermission()}varexOpenStaffGate();return false}

/* ========================================================= MENU ========================================================= */
function varexBuildMenu(){const nav=document.querySelector(".sidebar .nav");if(!nav)return;const current=varexCurrentFile(),operator=VAREX.getStaffSession();const allowed=VAREX_MENU.filter(([file])=>!operator||varexCanOpen(file));const signature=allowed.map(x=>x[0]).join("|")+"|"+current;if(nav.dataset.varexSignature===signature)return;nav.innerHTML=allowed.map(([file,icon,title])=>`<a href="./${file}" class="${current===file?"active":""}"><span class="nav-icon">${icon}</span><span class="nav-label">${title}</span></a>`).join("");nav.dataset.varexSignature=signature;varexAddSidebarActions()}
function varexAddSidebarActions(){const nav=document.querySelector(".sidebar .nav");if(!nav)return;if(nav.querySelector(".varex-sidebar-actions"))return;const box=document.createElement("div");box.className="varex-sidebar-actions";box.innerHTML=`<button type="button" id="varexStaffLogoutButton"><span class="nav-icon">👤</span><span>تسجيل خروج المستخدم</span></button><button type="button" id="varexLogoutButton"><span class="varex-power-icon">⏻</span><span>تسجيل خروج المنشأة</span></button><div class="varex-sidebar-bottom-space"></div>`;nav.appendChild(box);document.getElementById("varexStaffLogoutButton").onclick=varexLogoutCurrentUser;document.getElementById("varexLogoutButton").onclick=()=>VAREX.logout(true)}
function varexInstallTopSwitchUserButton(){document.querySelectorAll(".top-info").forEach(top=>{if(top.querySelector(".varex-top-switch-user"))return;const btn=document.createElement("button");btn.type="button";btn.className="info-chip varex-top-switch-user";btn.innerHTML="👥 <strong>تبديل المستخدم</strong>";btn.onclick=e=>{e.preventDefault();varexSwitchUser()};top.insertBefore(btn,top.firstChild)})}

/* ========================================================= THEME ========================================================= */
function varexResolveThemeMode(){const m=localStorage.getItem("varexThemeMode");if(m==="dark"||m==="light")return m;if(m==="system")return matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";return localStorage.getItem("varex_theme")||"light"}
function varexGetTheme(){return varexResolveThemeMode()}
function varexApplyTheme(t){document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-varex-theme",t);document.body?.classList.toggle("varex-dark",t==="dark");localStorage.setItem("varex_theme",t);varexUpdateThemeButton()}
function varexToggleTheme(){const n=varexGetTheme()==="dark"?"light":"dark";localStorage.setItem("varexThemeMode",n);varexApplyTheme(n)}
function varexUpdateThemeButton(){const d=varexGetTheme()==="dark",i=document.getElementById("varexThemeIcon"),t=document.getElementById("varexThemeText");if(i)i.textContent=d?"☀️":"🌙";if(t)t.textContent=d?"الوضع النهاري":"الوضع الليلي"}

/* ========================================================= CURRENT USER ========================================================= */
function varexShowCurrentUser(){const u=VAREX.getStaffSession()||VAREX.getOwnerOperator();document.querySelectorAll(".info-chip,.chip").forEach(el=>{if(el.classList.contains("varex-top-switch-user"))return;if(el.textContent.includes("المستخدم")||el.textContent.includes("الحساب")){const s=el.querySelector("strong");if(s)s.textContent=u.name||"المستخدم"}});["sidebarUserName","topUserName","settingsUserName","currentUserName","currentUser"].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=u.name||u.username||"المستخدم"})}
function varexEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function varexEscAttr(v){return varexEsc(v).replace(/`/g,"&#96;")}

/* ========================================================= SHARED STYLES - STABLE 240PX ========================================================= */
function varexInstallSharedStyles(){if(document.getElementById("varexSharedStyles"))return;const s=document.createElement("style");s.id="varexSharedStyles";s.textContent=`
:root{--sidebar-width:240px!important;--sidebar:240px!important}
html{width:100%!important;min-height:100%!important;overflow-x:hidden!important}
body{margin:0!important;width:100%!important;min-height:100%!important;overflow-x:hidden!important}
*,*::before,*::after{box-sizing:border-box!important}
.sidebar{position:fixed!important;top:0!important;right:0!important;bottom:0!important;width:240px!important;min-width:240px!important;max-width:240px!important;height:100vh!important;height:100dvh!important;overflow-y:auto!important;overflow-x:hidden!important;z-index:1000!important}
.main{margin-right:240px!important;min-width:0!important}
.sidebar .nav{width:100%!important;padding:16px 12px 0!important;margin:0!important}
.sidebar .nav a,.varex-sidebar-actions button{width:100%!important;height:48px!important;min-height:48px!important;display:flex!important;align-items:center!important;gap:11px!important;padding:0 14px!important;margin:0 0 5px!important;border-radius:10px!important;font-weight:700!important;box-sizing:border-box!important}
.sidebar .nav a{background:rgba(255,255,255,.055)!important;color:#dbeafe!important;text-decoration:none!important;border:0!important}
.sidebar .nav a:hover{background:rgba(255,255,255,.08)!important;color:#fff!important}
.sidebar .nav a.active{background:#fff!important;color:#172554!important}
.sidebar .nav a,.sidebar .nav a:hover,.sidebar .nav a:focus,.sidebar .nav a:active,.sidebar .nav a.active{transform:none!important;translate:none!important;scale:1!important}
.nav-icon{width:25px!important;min-width:25px!important;flex-shrink:0!important;text-align:center!important}
.nav-label{white-space:nowrap!important;flex-shrink:0!important}
.varex-sidebar-actions{width:100%!important;margin-top:24px!important;padding-top:18px!important;border-top:1px solid rgba(255,255,255,.12)!important}
.varex-sidebar-actions button{background:#fff!important;color:#172554!important;border:1px solid #fff!important;cursor:pointer!important}
.varex-sidebar-bottom-space{height:180px!important;min-height:180px!important}
.varex-power-icon{width:27px;height:27px;border:2px solid #172554;border-radius:50%;display:flex;align-items:center;justify-content:center}
.varex-top-switch-user{border:1px solid #172554!important;cursor:pointer!important}
.varex-staff-overlay{position:fixed;inset:0;z-index:9999999;background:rgba(3,10,28,.84);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility .2s ease}
.varex-staff-overlay.show{opacity:1;visibility:visible;pointer-events:auto}
.varex-staff-card{width:min(560px,96vw);max-height:88vh;overflow-y:auto;background:#fff;border-radius:26px;padding:30px;text-align:center;box-shadow:0 35px 100px rgba(0,0,0,.45)}
.varex-staff-brand{font-size:32px;font-weight:900;letter-spacing:6px;color:#172554;margin-bottom:14px}
.varex-staff-card h2{font-size:22px;color:#172554}
.varex-staff-sub{font-size:12px;color:#64748b;margin:7px 0 20px}
.varex-staff-list{display:grid;gap:10px}
.varex-staff-user{width:100%;min-height:67px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;display:flex;align-items:center;gap:13px;padding:10px 14px;text-align:right;cursor:pointer}
.varex-staff-user.owner{background:#eef2ff}
.varex-staff-avatar{width:43px;height:43px;border-radius:12px;background:#172554;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px}
.varex-staff-user strong{display:block;color:#172554;font-size:13px}
.varex-staff-user small{display:block;color:#64748b;margin-top:3px}
.varex-staff-password{display:none;margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0}
.varex-staff-password.show{display:block}
.varex-selected-user{font-weight:800;color:#172554;margin-bottom:10px}
.varex-staff-password input{width:100%;height:46px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px}
.varex-staff-error{min-height:20px;color:#b91c1c;font-size:11px;margin-top:7px}
.varex-staff-login-actions{display:flex;gap:9px;margin-top:10px}
.varex-staff-login-actions button{flex:1;height:43px;border-radius:9px;font-weight:800;cursor:pointer}
.varex-staff-login-actions button:first-child{background:#172554;color:#fff;border:0}
.varex-staff-login-actions button:last-child{background:#f1f5f9;color:#172554;border:1px solid #cbd5e1}
.varex-mini-spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.38);border-top-color:#fff;display:inline-block;animation:varexMiniSpinner .75s linear infinite}
@keyframes varexMiniSpinner{to{transform:rotate(360deg)}}
body.varex-dark .varex-staff-card{background:#132641;color:#fff}
body.varex-dark .varex-staff-card h2,body.varex-dark .varex-staff-brand,body.varex-dark .varex-selected-user{color:#fff}
body.varex-dark .varex-staff-user{background:#10233d;border-color:#29415f}
body.varex-dark .varex-staff-user strong{color:#fff}
body.varex-dark .varex-staff-user small{color:#cbd5e1}
@media(max-width:750px){.varex-top-switch-user{display:none!important}}
@media(max-width:600px){.varex-staff-card{padding:23px 17px}.varex-staff-login-actions{flex-direction:column}}
`;document.head.prepend(s)}

/* ========================================================= START ========================================================= */
function varexStartUI(){const publicPage=VAREX.isLoginPage()||VAREX.isRegisterPage()||VAREX.isVerifyEmailPage()||VAREX.isResetPasswordPage();if(publicPage)return;if(!VAREX.requireLogin())return;if(!VAREX.requireSubscription())return;varexInstallSharedStyles();varexApplyTheme(varexGetTheme());varexInstallStaffUI();const access=varexInitStaffAccess();varexBuildMenu();varexInstallTopSwitchUserButton();varexShowCurrentUser();if(access!==false)varexCheckCurrentPermission()}
window.addEventListener("focus",()=>{varexApplyTheme(varexGetTheme());varexInstallTopSwitchUserButton();varexShowCurrentUser()});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",varexStartUI,{once:true});else varexStartUI();
/* ================= VAREX THEME + FIXED SIDEBAR SCROLL ================= */
/* ================= VAREX THEME + STABLE SIDEBAR ================= */
(function(){
"use strict";
const THEME_ID="varexCentralTheme",SCROLL_KEY="varex_sidebar_scroll";
function loadTheme(){
let link=document.getElementById(THEME_ID);
if(!link){
link=document.createElement("link");
link.id=THEME_ID;
link.rel="stylesheet";
document.head.appendChild(link);
}
link.href="./varex-theme.css?v=20260818-3";
}
function getNav(){return document.querySelector(".sidebar .nav")}
function getSavedScroll(){
const value=Number(sessionStorage.getItem(SCROLL_KEY)||0);
return Number.isFinite(value)&&value>=0?value:0;
}
function saveScroll(){
const nav=getNav();
if(nav)sessionStorage.setItem(SCROLL_KEY,String(Math.max(0,nav.scrollTop)));
}
function restoreScroll(){
const nav=getNav();
if(!nav)return;
nav.style.scrollBehavior="auto";
nav.scrollTop=getSavedScroll();
}
function prepareNav(){
const nav=getNav();
if(!nav||nav.dataset.varexStableScroll==="true")return;
nav.dataset.varexStableScroll="true";
restoreScroll();
nav.addEventListener("scroll",function(){
sessionStorage.setItem(SCROLL_KEY,String(Math.max(0,nav.scrollTop)));
},{passive:true});
nav.addEventListener("pointerdown",saveScroll,true);
nav.addEventListener("click",function(e){
if(e.target.closest("a[href]"))saveScroll();
},true);
}
function start(){
prepareNav();
if(getNav())return;
const observer=new MutationObserver(function(){
if(getNav()){
observer.disconnect();
prepareNav();
}
});
observer.observe(document.body,{childList:true,subtree:true});
}
loadTheme();
window.addEventListener("pagehide",saveScroll);
window.addEventListener("beforeunload",saveScroll);
if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",start,{once:true});
}else{
start();
}
})();
