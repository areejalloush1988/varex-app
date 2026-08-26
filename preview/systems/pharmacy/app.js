(() => {
  "use strict";

  const DATA_KEY = "varex_pharmacy_data_v1_static_preview";
  const PROFILE_KEY = "varex_pharmacy_profile_static_preview";
  const ZOOM_KEY = "varex_pharmacy_zoom";
  const SOUND_KEY = "varex_pharmacy_sound";
  const OPERATOR_KEY = "varex_pharmacy_operator";
  const $ = id => document.getElementById(id);
  const host = $("pageHost");
  const modal = $("modalLayer");
  const ui = { page: "dashboard", cart: [], vatPeriod: "all", sound: localStorage.getItem(SOUND_KEY) !== "off" };
  const pageMeta = {
    dashboard:["لوحة التحكم","نظرة شاملة على الصيدلية والمخزون والتنبيهات"],pos:["نقطة البيع","بيع الأدوية والمنتجات وإصدار الفاتورة"],
    medicines:["الأدوية والمخزون","إدارة الأصناف والأسعار والكميات والباركود"],batches:["التشغيلات والصلاحية","متابعة أرقام التشغيلات والكميات وتواريخ الانتهاء"],
    purchases:["المشتريات","تسجيل فواتير التوريد وتحديث المخزون"],suppliers:["الموردون","إدارة شركات وموردي الأدوية"],
    customers:["العملاء","بيانات العملاء والتأمين والمشتريات"],prescriptions:["الوصفات الطبية","حفظ الوصفات ومتابعة حالة الصرف"],
    expenses:["المصروفات","تسجيل المصروفات التشغيلية والضريبة"],employees:["الموظفون","إدارة فريق الصيدلية والصلاحيات"],
    vat:["ضريبة القيمة المضافة VAT","ملخص ضريبة المخرجات والمدخلات وصافي الضريبة المستحقة"],
    reports:["التقارير والتحليلات","المبيعات والأرباح والمخزون والصلاحية"],settings:["إعدادات الصيدلية","بيانات المنشأة والضرائب والطباعة والنسخ الاحتياطي"]
  };

  const iso = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0,10); };
  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const num = value => Number(value || 0);
  const money = value => `${num(value).toLocaleString("ar-AE",{minimumFractionDigits:2,maximumFractionDigits:2})} د.إ`;
  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const daysTo = date => Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000);
  const dateAR = date => date ? new Date(`${date}T00:00:00`).toLocaleDateString("ar-AE",{year:"numeric",month:"short",day:"numeric"}) : "—";
  const profile = () => JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

  function seedData() {
    return {
      settings:{pharmacyName:profile().pharmacyName||"صيدلية VAREX",ownerName:profile().ownerName||"مالك الصيدلية",branch:"الفرع الرئيسي",phone:profile().phone||"",email:profile().email||"",trn:"",licenseNo:profile().licenseNo||"",vat:5,lowStock:10,expiryAlert:60,autoPrint:true},
      medicines:[],batches:[],suppliers:[],customers:[],prescriptions:[],purchases:[],sales:[],expenses:[],employees:[]
    };
  }

  let data = (() => {
    try { return JSON.parse(localStorage.getItem(DATA_KEY)) || seedData(); }
    catch (_) { return seedData(); }
  })();

  function persist() { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  if (!localStorage.getItem(DATA_KEY)) persist();

  function operatorChoices() {
    return [
      {id:"owner",name:data.settings.ownerName||"مالك الصيدلية",role:"مالك الصيدلية • صلاحية كاملة"},
      ...data.employees.filter(employee=>employee.status==="نشط").map(employee=>({id:employee.id,name:employee.name,role:`${employee.role} • دوام ${employee.shift}`}))
    ];
  }

  function currentOperator() {
    try {
      const saved=JSON.parse(localStorage.getItem(OPERATOR_KEY)||"null");
      return operatorChoices().find(item=>item.id===saved?.id)||operatorChoices()[0];
    } catch (_) { return operatorChoices()[0]; }
  }

  function updateOperatorUI() {
    const active=currentOperator(),nameNode=$("sidebarUserName");
    if(nameNode)nameNode.textContent=active.name;
  }

  function openSwitchUser() {
    const active=currentOperator();
    const choices=operatorChoices().map(item=>`<button class="operator-option ${item.id===active.id?"selected":""}" type="button" data-operator-id="${escapeHTML(item.id)}"><span class="operator-avatar">${escapeHTML(item.name.trim().charAt(0)||"V")}</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.role)}</small></span><span class="operator-check">${item.id===active.id?"✓":""}</span></button>`).join("");
    openModal("تبديل المستخدم",`<div class="operator-list">${choices}</div>`,`<button class="secondary-btn" id="operatorCancel" type="button">إلغاء</button>`);
    $("operatorCancel").onclick=closeModal;
    $("modalBody").querySelectorAll("[data-operator-id]").forEach(button=>button.onclick=()=>{
      const selected=operatorChoices().find(item=>item.id===button.dataset.operatorId);if(!selected)return;
      localStorage.setItem(OPERATOR_KEY,JSON.stringify({id:selected.id,name:selected.name}));updateOperatorUI();closeModal();toast("success","تم تبديل المستخدم",selected.name);
    });
  }

  function toast(type, title, detail = "") {
    const stack = $("toastStack"), node = document.createElement("div");
    const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
    node.className = `toast ${type}`;
    node.innerHTML = `<div class="toast-icon">${icon}</div><div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(detail)}</span></div>`;
    stack.appendChild(node); setTimeout(() => node.remove(), 3600);
  }

  function clickSound() {
    if (!ui.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = clickSound.ctx || (clickSound.ctx = new Ctx());
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(640, ctx.currentTime);
      gain.gain.setValueAtTime(.018, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .033);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .038);
    } catch (_) {}
  }

  function closeModal() { modal.classList.remove("show"); modal.setAttribute("aria-hidden","true"); }
  function openModal(title, body, actions) {
    $("modalTitle").textContent = title; $("modalBody").innerHTML = body; $("modalActions").innerHTML = actions;
    modal.classList.add("show"); modal.setAttribute("aria-hidden","false");
    setTimeout(() => $("modalBody").querySelector("input,select,textarea")?.focus(), 80);
  }

  function formModal({ title, fields, values = {}, submitText = "حفظ", onSubmit }) {
    const controls = fields.map(field => {
      const value = values[field.name] ?? field.value ?? "", full = field.full ? " full" : "";
      let control;
      if (field.type === "select") control = `<select class="select" name="${field.name}" ${field.required?"required":""}>${field.options.map(o => { const v = typeof o === "string" ? o : o.value, label = typeof o === "string" ? o : o.label; return `<option value="${escapeHTML(v)}" ${String(v)===String(value)?"selected":""}>${escapeHTML(label)}</option>`; }).join("")}</select>`;
      else if (field.type === "textarea") control = `<textarea class="textarea" name="${field.name}" ${field.required?"required":""} placeholder="${escapeHTML(field.placeholder||"")}">${escapeHTML(value)}</textarea>`;
      else if (field.type === "checkbox") control = `<label class="check-line"><input name="${field.name}" type="checkbox" ${value?"checked":""}><span>${escapeHTML(field.checkLabel||field.label)}</span></label>`;
      else control = `<input class="input" name="${field.name}" type="${field.type||"text"}" value="${escapeHTML(value)}" ${field.min!==undefined?`min="${field.min}"`:""} ${field.step?`step="${field.step}"`:""} ${field.required?"required":""} placeholder="${escapeHTML(field.placeholder||"")}">`;
      return `<div class="field${full}">${field.type==="checkbox"?"":`<label>${escapeHTML(field.label)}</label>`}${control}</div>`;
    }).join("");
    openModal(title, `<form id="modalForm"><div class="field-grid">${controls}</div></form>`, `<button class="secondary-btn" type="button" id="modalCancel">إلغاء</button><button class="primary-btn" type="submit" form="modalForm">${escapeHTML(submitText)}</button>`);
    $("modalCancel").onclick = closeModal;
    $("modalForm").onsubmit = event => {
      event.preventDefault();
      const submittedForm = event.currentTarget;
      if (!submittedForm.reportValidity()) return;
      const fd = new FormData(submittedForm), result = {};
      fields.forEach(field => result[field.name] = field.type === "checkbox" ? submittedForm.elements[field.name].checked : fd.get(field.name));
      try {
        const accepted = onSubmit(result);
        if (accepted === false) return;
        if ($("modalForm") === submittedForm) closeModal();
      } catch (error) {
        console.error(error);
        toast("error","تعذر حفظ البيانات",error?.message || "يرجى المحاولة مرة أخرى");
      }
    };
  }

  function confirmModal(title, detail, confirmText = "تأكيد") {
    return new Promise(resolve => {
      openModal(title, `<div class="confirm-copy"><div class="confirm-icon">⚠️</div><h4>${escapeHTML(title)}</h4><p>${escapeHTML(detail)}</p></div>`, `<button class="secondary-btn" id="confirmCancel" type="button">إلغاء</button><button class="danger-btn" id="confirmOkay" type="button">${escapeHTML(confirmText)}</button>`);
      $("confirmCancel").onclick = () => { closeModal(); resolve(false); };
      $("confirmOkay").onclick = () => { closeModal(); resolve(true); };
    });
  }

  function pageHead(extra = "") {
    const [title, sub] = pageMeta[ui.page];
    return `<div class="page-head"><div><h2>${title}</h2><p>${sub}</p></div><div class="page-actions">${extra}</div></div>`;
  }

  function tableShell({search="بحث...",head,rows,empty="لا توجد بيانات"}) {
    return `<div class="table-card"><div class="table-tools"><div class="search-box"><span>⌕</span><input data-filter-input placeholder="${escapeHTML(search)}"></div><small class="muted">${rows ? "استخدم البحث لتصفية النتائج" : ""}</small></div><div class="table-scroll"><table class="data-table"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="20"><div class="empty-state"><div class="empty-icon">📭</div><strong>${escapeHTML(empty)}</strong><span>أضف سجلاً جديداً للبدء</span></div></td></tr>`}</tbody></table></div></div>`;
  }

  function statusBadge(value, good = "نشط") {
    const cls = value === good || value === "مكتملة" || value === "تم الصرف" ? "green" : value.includes?.("انتظار") ? "amber" : "indigo";
    return `<span class="badge ${cls}">${escapeHTML(value)}</span>`;
  }

  function renderDashboard() {
    const todaySales = data.sales.filter(s => s.date === iso()).reduce((a,s)=>a+num(s.total),0);
    const monthSales = data.sales.filter(s => daysTo(s.date) >= -30).reduce((a,s)=>a+num(s.total),0);
    const low = data.medicines.filter(m => num(m.stock) <= num(m.minStock));
    const expiring = data.batches.filter(b => daysTo(b.expiry) >= 0 && daysTo(b.expiry) <= num(data.settings.expiryAlert)).sort((a,b)=>daysTo(a.expiry)-daysTo(b.expiry));
    const invValue = data.medicines.reduce((a,m)=>a+num(m.stock)*num(m.cost),0);
    const bars = Array.from({length:7},(_,i)=>{
      const offset=i-6, date=iso(offset), value=data.sales.filter(s=>s.date===date).reduce((a,s)=>a+num(s.total),0);
      return {date,value,label:new Date(`${date}T00:00:00`).toLocaleDateString("ar-AE",{weekday:"short"})};
    });
    const max = Math.max(...bars.map(x=>x.value),1);
    const alerts = [
      ...expiring.slice(0,3).map(batch => { const med=data.medicines.find(m=>m.id===batch.medicineId); return {icon:"⏳",title:med?.name||"دواء",sub:`التشغيلة ${batch.batchNo}`,value:`${daysTo(batch.expiry)} يوم`}; }),
      ...low.slice(0,3).map(m=>({icon:"📉",title:m.name,sub:"المخزون أقل من الحد المطلوب",value:`${m.stock} عبوة`}))
    ];
    return `${pageHead()}
      <section class="hero"><div class="hero-copy"><span class="hero-kicker">VAREX PHARMACY CONTROL</span><h3>مرحباً في ${escapeHTML(data.settings.pharmacyName)}</h3><p>تابع المبيعات والمخزون وتواريخ الصلاحية من لوحة تشغيل واحدة، مع تنبيهات واضحة تساعد على اتخاذ القرار بسرعة.</p><div class="hero-actions"><button class="hero-btn white" data-go="pos">＋ فاتورة بيع جديدة</button><button class="hero-btn ghost" data-action="add-medicine">＋ إضافة دواء</button></div></div><div class="hero-side"><div class="pharmacy-mark">⚕</div></div></section>
      <section class="stats-grid">
        <article class="stat-card"><div class="stat-top"><div class="stat-icon">💰</div><span class="stat-trend">اليوم</span></div><strong>${money(todaySales)}</strong><span class="label">مبيعات اليوم</span></article>
        <article class="stat-card"><div class="stat-top"><div class="stat-icon">📈</div><span class="stat-trend">30 يوم</span></div><strong>${money(monthSales)}</strong><span class="label">إجمالي المبيعات</span></article>
        <article class="stat-card"><div class="stat-top"><div class="stat-icon">💊</div><span class="stat-trend">${data.medicines.length} صنف</span></div><strong>${money(invValue)}</strong><span class="label">قيمة المخزون بالتكلفة</span></article>
        <article class="stat-card"><div class="stat-top"><div class="stat-icon">⚠️</div><span class="stat-trend">يتطلب متابعة</span></div><strong>${low.length + expiring.length}</strong><span class="label">تنبيهات المخزون والصلاحية</span></article>
      </section>
      <section class="grid-2"><div class="panel"><div class="panel-head"><div><h3>حركة المبيعات خلال 7 أيام</h3><small>القيمة الإجمالية للفواتير</small></div><button data-go="reports">التقرير الكامل</button></div><div class="activity-bars">${bars.map(b=>`<div class="bar-wrap"><div class="bar" title="${money(b.value)}" style="height:${Math.max(5,b.value/max*100)}%"></div><span>${b.label}</span></div>`).join("")}</div></div>
      <div class="panel"><div class="panel-head"><div><h3>تنبيهات مهمة</h3><small>المخزون والصلاحية</small></div><button data-go="batches">عرض الكل</button></div><div class="alert-list">${alerts.length?alerts.map(a=>`<div class="alert-row"><div class="alert-dot">${a.icon}</div><div><strong>${escapeHTML(a.title)}</strong><span>${escapeHTML(a.sub)}</span></div><span class="alert-value">${escapeHTML(a.value)}</span></div>`).join(""):`<div class="empty-state"><div class="empty-icon">✅</div><strong>لا توجد تنبيهات حالياً</strong></div>`}</div></div></section>`;
  }

  function cartTotals() {
    const subtotal = ui.cart.reduce((sum,item)=>sum+num(item.price)*num(item.qty),0);
    const vat = subtotal * num(data.settings.vat) / 100;
    return {subtotal,vat,total:subtotal+vat};
  }

  function renderPOS() {
    const totals = cartTotals();
    const products = data.medicines.filter(m=>num(m.stock)>0).map(m=>`<button class="product-card" data-action="add-cart" data-id="${m.id}" data-filter-item="${escapeHTML(`${m.name} ${m.scientific} ${m.barcode} ${m.category}`.toLowerCase())}"><span class="product-emoji">💊</span><strong>${escapeHTML(m.name)}</strong><small>${escapeHTML(m.scientific)}</small><div class="product-foot"><span class="product-price">${money(m.price)}</span><span class="stock-mini">متوفر ${m.stock}</span></div></button>`).join("");
    const cartRows = ui.cart.map(item=>`<div class="cart-line"><div><strong>${escapeHTML(item.name)}</strong><small>${money(item.price)} للوحدة</small><div class="qty-control"><button data-action="cart-plus" data-id="${item.medicineId}">＋</button><span>${item.qty}</span><button data-action="cart-minus" data-id="${item.medicineId}">−</button></div></div><div class="cart-line-price">${money(item.price*item.qty)}</div></div>`).join("");
    return `${pageHead(`<button class="secondary-btn" data-action="scan-barcode">▣ إدخال باركود</button>`)}<div class="pos-layout"><section class="product-zone"><div class="table-tools panel" style="margin-bottom:13px"><div class="search-box"><span>⌕</span><input data-filter-input placeholder="ابحث بالاسم أو الباركود أو المادة العلمية..."></div><span class="badge indigo">${data.medicines.length} منتج</span></div><div class="product-grid">${products}</div></section>
      <aside class="cart-panel"><div class="cart-head"><h3>فاتورة البيع</h3><span class="cart-count">${ui.cart.reduce((a,x)=>a+x.qty,0)} عنصر</span></div><div class="cart-items">${cartRows||`<div class="cart-empty">🛒<br><br>اختر دواءً لإضافته إلى الفاتورة</div>`}</div><div class="cart-summary"><div class="summary-row"><span>المجموع الفرعي</span><strong>${money(totals.subtotal)}</strong></div><div class="summary-row"><span>الضريبة (${data.settings.vat}%)</span><strong>${money(totals.vat)}</strong></div><div class="summary-row total"><span>الإجمالي</span><strong>${money(totals.total)}</strong></div><button class="checkout-btn" data-action="checkout" ${ui.cart.length?"":"disabled"}>إتمام البيع وطباعة الفاتورة</button></div></aside></div>`;
  }

  function renderMedicines() {
    const rows = data.medicines.map(m=>`<tr data-filter-item="${escapeHTML(`${m.name} ${m.scientific} ${m.barcode} ${m.category}`.toLowerCase())}"><td><div class="med-cell"><div class="med-avatar">💊</div><div><strong>${escapeHTML(m.name)}</strong><small>${escapeHTML(m.scientific)}</small></div></div></td><td dir="ltr">${escapeHTML(m.barcode)}</td><td>${escapeHTML(m.category)}</td><td>${money(m.cost)}</td><td><strong>${money(m.price)}</strong></td><td><span class="badge ${num(m.stock)<=num(m.minStock)?"red":"green"}">${m.stock} عبوة</span></td><td>${m.prescription?'<span class="badge amber">بوصفة</span>':'<span class="badge blue">بدون وصفة</span>'}</td><td><div class="row-actions"><button class="icon-action" data-action="edit-medicine" data-id="${m.id}" title="تعديل">✎</button><button class="icon-action danger" data-action="delete-medicine" data-id="${m.id}" title="حذف">⌫</button></div></td></tr>`).join("");
    return `${pageHead(`<button class="secondary-btn" data-action="export-medicines">⇩ تصدير CSV</button><button class="primary-btn" data-action="add-medicine">＋ إضافة دواء</button>`)}${tableShell({search:"بحث بالاسم أو الباركود أو التصنيف...",head:"<tr><th>الدواء</th><th>الباركود</th><th>التصنيف</th><th>التكلفة</th><th>سعر البيع</th><th>المخزون</th><th>الصرف</th><th>الإجراءات</th></tr>",rows,empty:"لا توجد أدوية"})}`;
  }

  function renderBatches() {
    const rows = [...data.batches].sort((a,b)=>new Date(a.expiry)-new Date(b.expiry)).map(b=>{
      const med=data.medicines.find(m=>m.id===b.medicineId), supplier=data.suppliers.find(s=>s.id===b.supplierId), days=daysTo(b.expiry);
      const badge=days<0?'<span class="badge red">منتهية</span>':days<=num(data.settings.expiryAlert)?`<span class="badge amber">${days} يوم</span>`:'<span class="badge green">صالحة</span>';
      return `<tr data-filter-item="${escapeHTML(`${med?.name} ${b.batchNo} ${supplier?.name}`.toLowerCase())}"><td><div class="med-cell"><div class="med-avatar">🧪</div><div><strong>${escapeHTML(med?.name||"دواء محذوف")}</strong><small>${escapeHTML(med?.scientific||"")}</small></div></div></td><td dir="ltr"><strong>${escapeHTML(b.batchNo)}</strong></td><td>${b.quantity}</td><td>${dateAR(b.received)}</td><td>${dateAR(b.expiry)}</td><td>${escapeHTML(supplier?.name||"—")}</td><td>${badge}</td><td><button class="icon-action danger" data-action="delete-batch" data-id="${b.id}">⌫</button></td></tr>`;
    }).join("");
    const expired=data.batches.filter(b=>daysTo(b.expiry)<0).length, soon=data.batches.filter(b=>daysTo(b.expiry)>=0&&daysTo(b.expiry)<=num(data.settings.expiryAlert)).length;
    return `${pageHead(`<button class="primary-btn" data-action="add-batch">＋ إضافة تشغيلة</button>`)}<section class="stats-grid"><article class="stat-card"><div class="stat-icon">🧪</div><strong>${data.batches.length}</strong><span class="label">إجمالي التشغيلات</span></article><article class="stat-card"><div class="stat-icon">⏳</div><strong>${soon}</strong><span class="label">قريبة الانتهاء</span></article><article class="stat-card"><div class="stat-icon">⛔</div><strong>${expired}</strong><span class="label">منتهية الصلاحية</span></article><article class="stat-card"><div class="stat-icon">✅</div><strong>${data.batches.length-soon-expired}</strong><span class="label">تشغيلات سليمة</span></article></section>${tableShell({search:"بحث باسم الدواء أو رقم التشغيلة...",head:"<tr><th>الدواء</th><th>رقم التشغيلة</th><th>الكمية</th><th>تاريخ الاستلام</th><th>تاريخ الانتهاء</th><th>المورد</th><th>الحالة</th><th>الإجراء</th></tr>",rows,empty:"لا توجد تشغيلات"})}`;
  }

  function renderPurchases() {
    const rows=[...data.purchases].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p=>{
      const supplier=data.suppliers.find(s=>s.id===p.supplierId),med=data.medicines.find(m=>m.id===p.medicineId);
      return `<tr data-filter-item="${escapeHTML(`${p.invoice} ${supplier?.name} ${med?.name}`.toLowerCase())}"><td dir="ltr"><strong>${escapeHTML(p.invoice)}</strong></td><td>${dateAR(p.date)}</td><td>${escapeHTML(supplier?.name||"—")}</td><td>${escapeHTML(med?.name||"—")}</td><td>${p.quantity}</td><td>${money(p.cost)}</td><td>${money(p.vat)}</td><td><strong>${money(num(p.cost)+num(p.vat))}</strong></td><td>${statusBadge(p.status,"مكتملة")}</td></tr>`;
    }).join("");
    return `${pageHead(`<button class="primary-btn" data-action="add-purchase">＋ فاتورة شراء</button>`)}${tableShell({search:"بحث برقم الفاتورة أو المورد أو الدواء...",head:"<tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الدواء</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي</th><th>الحالة</th></tr>",rows,empty:"لا توجد مشتريات"})}`;
  }

  function renderSuppliers() {
    const rows=data.suppliers.map(s=>`<tr data-filter-item="${escapeHTML(`${s.name} ${s.contact} ${s.phone} ${s.email}`.toLowerCase())}"><td><div class="med-cell"><div class="med-avatar">🚚</div><div><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.contact)}</small></div></div></td><td dir="ltr">${escapeHTML(s.phone)}</td><td dir="ltr">${escapeHTML(s.email)}</td><td><strong>${money(s.balance)}</strong></td><td>${statusBadge(s.status)}</td><td><div class="row-actions"><button class="icon-action" data-action="edit-supplier" data-id="${s.id}">✎</button><button class="icon-action danger" data-action="delete-supplier" data-id="${s.id}">⌫</button></div></td></tr>`).join("");
    return `${pageHead(`<button class="primary-btn" data-action="add-supplier">＋ إضافة مورد</button>`)}${tableShell({search:"بحث باسم المورد أو الهاتف...",head:"<tr><th>المورد</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>الرصيد المستحق</th><th>الحالة</th><th>الإجراءات</th></tr>",rows,empty:"لا يوجد موردون"})}`;
  }

  function renderCustomers() {
    const rows=data.customers.map(c=>`<tr data-filter-item="${escapeHTML(`${c.name} ${c.phone} ${c.insurance}`.toLowerCase())}"><td><div class="med-cell"><div class="med-avatar">👤</div><div><strong>${escapeHTML(c.name)}</strong><small>عميل #${escapeHTML(c.id.slice(-4))}</small></div></div></td><td dir="ltr">${escapeHTML(c.phone)}</td><td><span class="badge blue">${escapeHTML(c.insurance)}</span></td><td>${c.visits}</td><td><strong>${money(c.total)}</strong></td><td><div class="row-actions"><button class="icon-action" data-action="edit-customer" data-id="${c.id}">✎</button><button class="icon-action danger" data-action="delete-customer" data-id="${c.id}">⌫</button></div></td></tr>`).join("");
    return `${pageHead(`<button class="primary-btn" data-action="add-customer">＋ إضافة عميل</button>`)}${tableShell({search:"بحث بالاسم أو الهاتف أو التأمين...",head:"<tr><th>العميل</th><th>الهاتف</th><th>التأمين</th><th>عدد الزيارات</th><th>إجمالي المشتريات</th><th>الإجراءات</th></tr>",rows,empty:"لا يوجد عملاء"})}`;
  }

  function renderPrescriptions() {
    const rows=[...data.prescriptions].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>`<tr data-filter-item="${escapeHTML(`${r.number} ${r.patient} ${r.doctor} ${r.items}`.toLowerCase())}"><td dir="ltr"><strong>${escapeHTML(r.number)}</strong></td><td>${escapeHTML(r.patient)}</td><td>${escapeHTML(r.doctor)}</td><td>${dateAR(r.date)}</td><td>${escapeHTML(r.items)}</td><td>${statusBadge(r.status,"تم الصرف")}</td><td><div class="row-actions">${r.status!=="تم الصرف"?`<button class="icon-action" data-action="dispense-prescription" data-id="${r.id}" title="تم الصرف">✓</button>`:""}<button class="icon-action danger" data-action="delete-prescription" data-id="${r.id}">⌫</button></div></td></tr>`).join("");
    return `${pageHead(`<button class="primary-btn" data-action="add-prescription">＋ تسجيل وصفة</button>`)}${tableShell({search:"بحث برقم الوصفة أو المريض أو الطبيب...",head:"<tr><th>رقم الوصفة</th><th>المريض</th><th>الطبيب</th><th>التاريخ</th><th>الأدوية</th><th>الحالة</th><th>الإجراءات</th></tr>",rows,empty:"لا توجد وصفات"})}`;
  }

  function renderExpenses() {
    const rows=[...data.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=>`<tr data-filter-item="${escapeHTML(`${e.category} ${e.description} ${e.method}`.toLowerCase())}"><td>${dateAR(e.date)}</td><td><span class="badge indigo">${escapeHTML(e.category)}</span></td><td>${escapeHTML(e.description)}</td><td>${escapeHTML(e.method)}</td><td>${money(e.amount)}</td><td>${money(e.vat)}</td><td><strong>${money(num(e.amount)+num(e.vat))}</strong></td><td><button class="icon-action danger" data-action="delete-expense" data-id="${e.id}">⌫</button></td></tr>`).join("");
    const total=data.expenses.reduce((a,e)=>a+num(e.amount)+num(e.vat),0);
    return `${pageHead(`<button class="primary-btn" data-action="add-expense">＋ إضافة مصروف</button>`)}<section class="stats-grid"><article class="stat-card"><div class="stat-icon">💳</div><strong>${money(total)}</strong><span class="label">إجمالي المصروفات</span></article><article class="stat-card"><div class="stat-icon">🧾</div><strong>${data.expenses.length}</strong><span class="label">عدد السجلات</span></article><article class="stat-card"><div class="stat-icon">%</div><strong>${money(data.expenses.reduce((a,e)=>a+num(e.vat),0))}</strong><span class="label">ضريبة المدخلات</span></article><article class="stat-card"><div class="stat-icon">📅</div><strong>${money(data.expenses.filter(e=>e.date===iso()).reduce((a,e)=>a+num(e.amount)+num(e.vat),0))}</strong><span class="label">مصروفات اليوم</span></article></section>${tableShell({search:"بحث في المصروفات...",head:"<tr><th>التاريخ</th><th>التصنيف</th><th>البيان</th><th>طريقة الدفع</th><th>المبلغ</th><th>الضريبة</th><th>الإجمالي</th><th>الإجراء</th></tr>",rows,empty:"لا توجد مصروفات"})}`;
  }

  function renderEmployees() {
    const rows=data.employees.map(e=>`<tr data-filter-item="${escapeHTML(`${e.name} ${e.role} ${e.phone} ${e.license}`.toLowerCase())}"><td><div class="med-cell"><div class="med-avatar">👨‍⚕️</div><div><strong>${escapeHTML(e.name)}</strong><small>${escapeHTML(e.role)}</small></div></div></td><td dir="ltr">${escapeHTML(e.phone)}</td><td>${escapeHTML(e.shift)}</td><td dir="ltr">${escapeHTML(e.license)}</td><td>${statusBadge(e.status)}</td><td><div class="row-actions"><button class="icon-action" data-action="edit-employee" data-id="${e.id}">✎</button><button class="icon-action danger" data-action="delete-employee" data-id="${e.id}">⌫</button></div></td></tr>`).join("");
    return `${pageHead(`<button class="primary-btn" data-action="add-employee">＋ إضافة موظف</button>`)}${tableShell({search:"بحث بالاسم أو الوظيفة أو الترخيص...",head:"<tr><th>الموظف</th><th>الهاتف</th><th>الدوام</th><th>رقم الترخيص</th><th>الحالة</th><th>الإجراءات</th></tr>",rows,empty:"لا يوجد موظفون"})}`;
  }

  function reportNumbers() {
    const revenue=data.sales.reduce((a,s)=>a+num(s.total),0),vatOut=data.sales.reduce((a,s)=>a+num(s.vat),0);
    const purchases=data.purchases.reduce((a,p)=>a+num(p.cost)+num(p.vat),0),vatIn=data.purchases.reduce((a,p)=>a+num(p.vat),0)+data.expenses.reduce((a,e)=>a+num(e.vat),0);
    const expenses=data.expenses.reduce((a,e)=>a+num(e.amount)+num(e.vat),0);
    let cogs=0;data.sales.forEach(s=>(s.items||[]).forEach(item=>{const med=data.medicines.find(m=>m.id===item.medicineId);cogs+=num(med?.cost)*num(item.qty)}));
    return {revenue,vatOut,purchases,vatIn,expenses,cogs,net:revenue-cogs-expenses,vatDue:Math.max(0,vatOut-vatIn)};
  }

  function vatReportData() {
    const periodDays={quarter:90,half:183,year:365,all:Infinity}[ui.vatPeriod]??Infinity;
    const inPeriod=date=>periodDays===Infinity||(Date.now()-new Date(`${date}T23:59:59`).getTime())/86400000<=periodDays;
    const sales=data.sales.filter(item=>inPeriod(item.date)),purchases=data.purchases.filter(item=>inPeriod(item.date)),expenses=data.expenses.filter(item=>inPeriod(item.date));
    const taxableSales=sales.reduce((sum,item)=>sum+num(item.subtotal),0),vatOut=sales.reduce((sum,item)=>sum+num(item.vat),0);
    const taxablePurchases=purchases.reduce((sum,item)=>sum+num(item.cost),0)+expenses.reduce((sum,item)=>sum+num(item.amount),0);
    const vatIn=purchases.reduce((sum,item)=>sum+num(item.vat),0)+expenses.reduce((sum,item)=>sum+num(item.vat),0),vatNet=vatOut-vatIn;
    const transactions=[
      ...sales.map(item=>({date:item.date,reference:item.invoice,type:"مبيعات",base:num(item.subtotal),vat:num(item.vat),total:num(item.total)})),
      ...purchases.map(item=>({date:item.date,reference:item.invoice,type:"مشتريات",base:num(item.cost),vat:num(item.vat),total:num(item.cost)+num(item.vat)})),
      ...expenses.map(item=>({date:item.date,reference:item.description,type:"مصروفات",base:num(item.amount),vat:num(item.vat),total:num(item.amount)+num(item.vat)}))
    ].sort((a,b)=>new Date(b.date)-new Date(a.date));
    return {sales,purchases,expenses,taxableSales,taxablePurchases,vatOut,vatIn,vatNet,transactions};
  }

  function renderVAT() {
    const r=vatReportData(),periodLabels={all:"كل الفترات",quarter:"آخر 3 أشهر",half:"آخر 6 أشهر",year:"آخر سنة"};
    const rows=r.transactions.map(item=>`<tr data-filter-item="${escapeHTML(`${item.reference} ${item.type}`.toLowerCase())}"><td>${dateAR(item.date)}</td><td dir="ltr"><strong>${escapeHTML(item.reference)}</strong></td><td><span class="tax-type ${item.type==="مبيعات"?"":"purchase"}"><i></i>${escapeHTML(item.type)}</span></td><td>${money(item.base)}</td><td><strong>${money(item.vat)}</strong></td><td>${money(item.total)}</td></tr>`).join("");
    return `${pageHead(`<div class="vat-period"><select class="select" id="vatPeriod" aria-label="الفترة الضريبية"><option value="all" ${ui.vatPeriod==="all"?"selected":""}>كل الفترات</option><option value="quarter" ${ui.vatPeriod==="quarter"?"selected":""}>آخر 3 أشهر</option><option value="half" ${ui.vatPeriod==="half"?"selected":""}>آخر 6 أشهر</option><option value="year" ${ui.vatPeriod==="year"?"selected":""}>آخر سنة</option></select><button class="secondary-btn" data-action="print-vat">🖨 طباعة</button><button class="primary-btn" data-action="export-vat">⇩ تصدير VAT</button></div>`)}
      <section class="vat-summary"><article class="vat-card"><span>المبيعات الخاضعة للضريبة</span><strong>${money(r.taxableSales)}</strong><small>${r.sales.length} فاتورة بيع • ${periodLabels[ui.vatPeriod]}</small></article><article class="vat-card"><span>ضريبة المخرجات</span><strong>${money(r.vatOut)}</strong><small>الضريبة المحصلة من المبيعات</small></article><article class="vat-card"><span>ضريبة المدخلات القابلة للخصم</span><strong>${money(r.vatIn)}</strong><small>${r.purchases.length+r.expenses.length} حركة شراء ومصروف</small></article><article class="vat-card accent"><span>${r.vatNet>=0?"صافي الضريبة المستحقة":"رصيد ضريبي دائن"}</span><strong>${money(Math.abs(r.vatNet))}</strong><small>المخرجات ناقص المدخلات</small></article></section>
      <section class="panel panel-pad" style="margin-bottom:16px"><div class="grid-equal"><div><span class="muted" style="font-size:9px">قيمة المشتريات والمصروفات قبل الضريبة</span><strong style="display:block;margin-top:5px;font-size:18px;color:var(--indigo-950)">${money(r.taxablePurchases)}</strong></div><div><span class="muted" style="font-size:9px">الرقم الضريبي TRN</span><strong style="display:block;margin-top:5px;font-size:18px;color:var(--indigo-950)" dir="ltr">${escapeHTML(data.settings.trn||"غير مسجل")}</strong></div></div></section>
      ${tableShell({search:"بحث برقم المرجع أو نوع الحركة...",head:"<tr><th>التاريخ</th><th>المرجع</th><th>نوع الحركة</th><th>المبلغ قبل الضريبة</th><th>قيمة VAT</th><th>الإجمالي</th></tr>",rows,empty:"لا توجد حركات ضريبية في هذه الفترة"})}`;
  }

  function renderReports() {
    const r=reportNumbers();
    const topMeds={};data.sales.forEach(s=>(s.items||[]).forEach(item=>{topMeds[item.name]=(topMeds[item.name]||0)+num(item.qty)}));
    const topRows=Object.entries(topMeds).sort((a,b)=>b[1]-a[1]).map(([name,qty],i)=>`<tr data-filter-item="${escapeHTML(name.toLowerCase())}"><td>${i+1}</td><td><strong>${escapeHTML(name)}</strong></td><td>${qty}</td><td><span class="badge indigo">${qty>=3?"مرتفع":"متوسط"}</span></td></tr>`).join("");
    return `${pageHead(`<button class="secondary-btn" data-action="print-report">🖨 طباعة</button><button class="primary-btn" data-action="export-report">⇩ تصدير التقرير</button>`)}
      <section class="report-cards"><article class="report-card"><span class="report-label">إجمالي الإيرادات</span><strong>${money(r.revenue)}</strong><small>مبيعات مسجلة</small></article><article class="report-card"><span class="report-label">تكلفة البضاعة</span><strong>${money(r.cogs)}</strong><small class="warning">حسب تكلفة الأصناف</small></article><article class="report-card"><span class="report-label">المصروفات</span><strong>${money(r.expenses)}</strong><small class="warning">تشمل الضريبة</small></article><article class="report-card"><span class="report-label">صافي الربح التقديري</span><strong class="${r.net>=0?"positive":"negative"}">${money(r.net)}</strong><small>بعد التكلفة والمصروفات</small></article><article class="report-card"><span class="report-label">ضريبة المخرجات</span><strong>${money(r.vatOut)}</strong><small>من المبيعات</small></article><article class="report-card"><span class="report-label">ضريبة مستحقة تقديرياً</span><strong>${money(r.vatDue)}</strong><small>المخرجات ناقص المدخلات</small></article></section>
      <section class="grid-equal"><div class="panel"><div class="panel-head"><div><h3>ملخص مالي</h3><small>كل البيانات المسجلة</small></div></div><div class="alert-list"><div class="alert-row"><div class="alert-dot">💰</div><div><strong>المبيعات</strong><span>${data.sales.length} فاتورة بيع</span></div><span class="alert-value positive">${money(r.revenue)}</span></div><div class="alert-row"><div class="alert-dot">📦</div><div><strong>المشتريات</strong><span>${data.purchases.length} فاتورة توريد</span></div><span class="alert-value">${money(r.purchases)}</span></div><div class="alert-row"><div class="alert-dot">💳</div><div><strong>المصروفات</strong><span>${data.expenses.length} حركة</span></div><span class="alert-value negative">${money(r.expenses)}</span></div><div class="alert-row"><div class="alert-dot">%</div><div><strong>صافي ضريبة القيمة المضافة</strong><span>حساب تقديري</span></div><span class="alert-value">${money(r.vatDue)}</span></div></div></div>
      <div class="table-card"><div class="panel-head"><div><h3>الأدوية الأكثر مبيعاً</h3><small>حسب الكمية</small></div></div><div class="table-scroll"><table class="data-table" style="min-width:500px"><thead><tr><th>#</th><th>الدواء</th><th>الكمية المباعة</th><th>الحركة</th></tr></thead><tbody>${topRows||`<tr><td colspan="4"><div class="empty-state"><strong>لا توجد بيانات كافية</strong></div></td></tr>`}</tbody></table></div></div></section>`;
  }

  function renderSettings() {
    const s=data.settings;
    return `${pageHead(`<button class="primary-btn" type="submit" form="settingsForm">حفظ التغييرات</button>`)}<form id="settingsForm"><section class="settings-grid">
      <article class="settings-card"><h3>بيانات الصيدلية</h3><p>تظهر هذه المعلومات في الفواتير والتقارير.</p><div class="field"><label>اسم الصيدلية</label><input class="input" name="pharmacyName" value="${escapeHTML(s.pharmacyName)}" required></div><div class="field"><label>اسم المالك</label><input class="input" name="ownerName" value="${escapeHTML(s.ownerName)}"></div><div class="field"><label>الفرع</label><input class="input" name="branch" value="${escapeHTML(s.branch)}"></div><div class="field"><label>الهاتف</label><input class="input" name="phone" value="${escapeHTML(s.phone)}" dir="ltr"></div></article>
      <article class="settings-card"><h3>الترخيص والضريبة</h3><p>بيانات الامتثال والفاتورة الضريبية.</p><div class="field"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" value="${escapeHTML(s.email)}" dir="ltr"></div><div class="field"><label>رقم الترخيص</label><input class="input" name="licenseNo" value="${escapeHTML(s.licenseNo)}" dir="ltr"></div><div class="field"><label>الرقم الضريبي TRN</label><input class="input" name="trn" value="${escapeHTML(s.trn)}" dir="ltr"></div><div class="field"><label>نسبة ضريبة القيمة المضافة %</label><input class="input" name="vat" type="number" min="0" step="0.01" value="${s.vat}"></div></article>
      <article class="settings-card"><h3>تنبيهات المخزون والصلاحية</h3><p>حدد متى يظهر التنبيه في لوحة التحكم.</p><div class="field"><label>الحد الافتراضي للمخزون المنخفض</label><input class="input" name="lowStock" type="number" min="0" value="${s.lowStock}"></div><div class="field"><label>التنبيه قبل انتهاء الصلاحية — بالأيام</label><input class="input" name="expiryAlert" type="number" min="1" value="${s.expiryAlert}"></div><div class="setting-switch"><div><strong>الطباعة المباشرة بعد البيع</strong><span>فتح فاتورة الطباعة فور إتمام العملية</span></div><button class="switch ${s.autoPrint?"on":""}" type="button" data-action="toggle-autoprint" aria-label="تبديل الطباعة"></button></div><div class="setting-switch"><div><strong>صوت النقر</strong><span>صوت خفيف عند الضغط على الأزرار</span></div><button class="switch ${ui.sound?"on":""}" type="button" data-action="toggle-sound-setting" aria-label="تبديل الصوت"></button></div></article>
      <article class="settings-card"><h3>النسخ الاحتياطي والبيانات</h3><p>احتفظ بنسخة من بيانات الصيدلية أو استعدها عند الحاجة.</p><button class="secondary-btn full-btn" type="button" data-action="backup-data">⇩ تنزيل نسخة احتياطية</button><button class="secondary-btn full-btn" style="margin-top:9px" type="button" data-action="restore-data">⇧ استعادة نسخة احتياطية</button><input id="restoreFile" type="file" accept="application/json" hidden><button class="danger-btn full-btn" style="margin-top:22px" type="button" data-action="reset-data">إعادة ضبط بيانات النظام</button></article>
    </section></form>`;
  }

  const renderers={dashboard:renderDashboard,pos:renderPOS,medicines:renderMedicines,batches:renderBatches,purchases:renderPurchases,suppliers:renderSuppliers,customers:renderCustomers,prescriptions:renderPrescriptions,expenses:renderExpenses,employees:renderEmployees,vat:renderVAT,reports:renderReports,settings:renderSettings};

  function renderPage(page=ui.page) {
    ui.page=renderers[page]?page:"dashboard";
    host.innerHTML=renderers[ui.page]();
    document.querySelectorAll("[data-page]").forEach(btn=>btn.classList.toggle("active",btn.dataset.page===ui.page));
    document.title=`VAREX | ${pageMeta[ui.page][0]}`;
    if (location.hash !== `#${ui.page}`) history.replaceState(null,"",`#${ui.page}`);
    host.scrollTop=0; window.scrollTo({top:0,behavior:"instant"});
  }

  const medicineCategories=["مسكنات","مضادات حيوية","آلام العضلات","القلب والضغط","السكري","الحساسية","فيتامينات","العناية الشخصية","الأم والطفل","أجهزة طبية","تصنيف آخر"];
  function openMedicine(record=null,prefill={}) {
    formModal({title:record?"تعديل بيانات الدواء":"إضافة دواء جديد",values:record||{minStock:data.settings.lowStock,stock:0,...prefill},fields:[
      {name:"name",label:"الاسم التجاري",required:true},{name:"scientific",label:"الاسم العلمي",required:true},{name:"barcode",label:"الباركود",required:true},{name:"category",label:"التصنيف",type:"select",options:medicineCategories},
      {name:"cost",label:"سعر التكلفة",type:"number",min:0,step:"0.01",required:true},{name:"price",label:"سعر البيع",type:"number",min:0,step:"0.01",required:true},{name:"stock",label:"الكمية الحالية",type:"number",min:0,step:"1",required:true},{name:"minStock",label:"حد المخزون المنخفض",type:"number",min:0,step:"1",required:true},{name:"prescription",label:"يتطلب وصفة طبية",type:"checkbox",checkLabel:"لا يُصرف هذا الدواء إلا بوصفة طبية",full:true}
    ],onSubmit:v=>{
      const clean={...v,name:String(v.name||"").trim(),scientific:String(v.scientific||"").trim(),barcode:String(v.barcode||"").trim(),cost:num(v.cost),price:num(v.price),stock:num(v.stock),minStock:num(v.minStock),prescription:Boolean(v.prescription)};
      if(!clean.name||!clean.scientific||!clean.barcode){toast("error","البيانات غير مكتملة","أدخل اسم الدواء والاسم العلمي والباركود");return false;}
      const duplicate=data.medicines.find(m=>m.id!==record?.id&&String(m.barcode).trim()===clean.barcode);
      if(duplicate){toast("error","الباركود مستخدم مسبقاً",duplicate.name);return false;}
      if(record) Object.assign(record,clean); else data.medicines.unshift({id:id("med"),...clean});
      persist();renderPage("medicines");toast("success",record?"تم تحديث الدواء":"تمت إضافة الدواء",`${clean.name} • ${clean.barcode}`);return true;
    }});
  }

  function openSupplier(record=null) {
    formModal({title:record?"تعديل المورد":"إضافة مورد",values:record||{status:"نشط",balance:0},fields:[
      {name:"name",label:"اسم الشركة / المورد",required:true},{name:"contact",label:"اسم مسؤول التواصل",required:true},{name:"phone",label:"رقم الهاتف",required:true},{name:"email",label:"البريد الإلكتروني",type:"email"},{name:"balance",label:"الرصيد المستحق",type:"number",min:0,step:"0.01"},{name:"status",label:"الحالة",type:"select",options:["نشط","موقوف"]}
    ],onSubmit:v=>{v.balance=num(v.balance);if(record)Object.assign(record,v);else data.suppliers.unshift({id:id("sup"),...v});persist();renderPage();toast("success",record?"تم تحديث المورد":"تمت إضافة المورد",v.name);}});
  }

  function openCustomer(record=null) {
    formModal({title:record?"تعديل العميل":"إضافة عميل",values:record||{insurance:"دفع نقدي",visits:0,total:0},fields:[
      {name:"name",label:"اسم العميل",required:true},{name:"phone",label:"رقم الهاتف",required:true},{name:"insurance",label:"شركة التأمين",required:true},{name:"visits",label:"عدد الزيارات",type:"number",min:0},{name:"total",label:"إجمالي المشتريات",type:"number",min:0,step:"0.01"}
    ],onSubmit:v=>{v.visits=num(v.visits);v.total=num(v.total);if(record)Object.assign(record,v);else data.customers.unshift({id:id("cus"),...v});persist();renderPage();toast("success",record?"تم تحديث العميل":"تمت إضافة العميل",v.name);}});
  }

  function openEmployee(record=null) {
    formModal({title:record?"تعديل الموظف":"إضافة موظف",values:record||{status:"نشط",shift:"صباحية"},fields:[
      {name:"name",label:"اسم الموظف",required:true},{name:"role",label:"المسمى الوظيفي",type:"select",options:["صيدلي مسؤول","صيدلي","فني صيدلة","أمين صندوق","مدير فرع","محاسب"],required:true},{name:"phone",label:"رقم الهاتف",required:true},{name:"shift",label:"فترة الدوام",type:"select",options:["صباحية","مسائية","ليلية","متغيرة"]},{name:"license",label:"رقم الترخيص",placeholder:"—"},{name:"status",label:"الحالة",type:"select",options:["نشط","موقوف"]}
    ],onSubmit:v=>{const clean={...v,name:String(v.name||"").trim(),phone:String(v.phone||"").trim(),license:String(v.license||"").trim()};if(!clean.name||!clean.phone){toast("error","البيانات غير مكتملة","أدخل اسم الموظف ورقم الهاتف");return false;}if(record)Object.assign(record,clean);else data.employees.unshift({id:id("emp"),...clean});persist();renderPage("employees");toast("success",record?"تم تحديث الموظف":"تمت إضافة الموظف",clean.name);return true;}});
  }

  function openBatch() {
    if(!data.medicines.length)return toast("error","لا يمكن إضافة تشغيلة","أضف دواءً أولاً");
    formModal({title:"إضافة تشغيلة دواء",values:{received:iso(),expiry:iso(365),quantity:1},fields:[
      {name:"medicineId",label:"الدواء",type:"select",options:data.medicines.map(m=>({value:m.id,label:m.name})),required:true},{name:"batchNo",label:"رقم التشغيلة",required:true},{name:"quantity",label:"الكمية المستلمة",type:"number",min:1,required:true},{name:"supplierId",label:"المورد",type:"select",options:data.suppliers.length?data.suppliers.map(s=>({value:s.id,label:s.name})):[{value:"",label:"بدون مورد"}]},{name:"received",label:"تاريخ الاستلام",type:"date",required:true},{name:"expiry",label:"تاريخ الانتهاء",type:"date",required:true}
    ],onSubmit:v=>{v.quantity=num(v.quantity);data.batches.unshift({id:id("bat"),...v});const med=data.medicines.find(m=>m.id===v.medicineId);if(med)med.stock=num(med.stock)+v.quantity;persist();renderPage();toast("success","تمت إضافة التشغيلة",`أضيفت ${v.quantity} عبوة إلى المخزون`);}});
  }

  function openPurchase() {
    if(!data.medicines.length||!data.suppliers.length)return toast("error","بيانات ناقصة","أضف دواءً ومورداً قبل تسجيل المشتريات");
    formModal({title:"تسجيل فاتورة شراء",values:{date:iso(),quantity:1,cost:0,vat:0,status:"مكتملة"},fields:[
      {name:"invoice",label:"رقم الفاتورة",value:`PUR-${String(data.purchases.length+1052)}`,required:true},{name:"date",label:"التاريخ",type:"date",required:true},{name:"supplierId",label:"المورد",type:"select",options:data.suppliers.map(s=>({value:s.id,label:s.name}))},{name:"medicineId",label:"الدواء",type:"select",options:data.medicines.map(m=>({value:m.id,label:m.name}))},{name:"quantity",label:"الكمية",type:"number",min:1,required:true},{name:"cost",label:"التكلفة قبل الضريبة",type:"number",min:0,step:"0.01",required:true},{name:"vat",label:"الضريبة",type:"number",min:0,step:"0.01",required:true},{name:"status",label:"الحالة",type:"select",options:["مكتملة","بانتظار الاستلام"]}
    ],onSubmit:v=>{v.quantity=num(v.quantity);v.cost=num(v.cost);v.vat=num(v.vat);data.purchases.unshift({id:id("pur"),...v});if(v.status==="مكتملة"){const med=data.medicines.find(m=>m.id===v.medicineId);if(med)med.stock=num(med.stock)+v.quantity;}persist();renderPage();toast("success","تم تسجيل فاتورة الشراء",v.invoice);}});
  }

  function openPrescription() {
    formModal({title:"تسجيل وصفة طبية",values:{number:`RX-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${String(data.prescriptions.length+1).padStart(2,"0")}`,date:iso(),status:"بانتظار الصرف"},fields:[
      {name:"number",label:"رقم الوصفة",required:true},{name:"date",label:"تاريخ الوصفة",type:"date",required:true},{name:"patient",label:"اسم المريض",required:true},{name:"doctor",label:"اسم الطبيب",required:true},{name:"items",label:"الأدوية الموصوفة",type:"textarea",full:true,required:true},{name:"status",label:"الحالة",type:"select",options:["بانتظار الصرف","تم الصرف","مرفوضة"]}
    ],onSubmit:v=>{data.prescriptions.unshift({id:id("rx"),...v});persist();renderPage();toast("success","تم تسجيل الوصفة",v.number);}});
  }

  function openExpense() {
    formModal({title:"إضافة مصروف",values:{date:iso(),vat:0,method:"نقدي"},fields:[
      {name:"date",label:"التاريخ",type:"date",required:true},{name:"category",label:"التصنيف",type:"select",options:["إيجار","رواتب","كهرباء ومياه","تشغيل","صيانة","تسويق","نقل","مصروف آخر"]},{name:"description",label:"البيان",required:true,full:true},{name:"amount",label:"المبلغ قبل الضريبة",type:"number",min:0,step:"0.01",required:true},{name:"vat",label:"الضريبة",type:"number",min:0,step:"0.01",required:true},{name:"method",label:"طريقة الدفع",type:"select",options:["نقدي","بطاقة","تحويل بنكي","شيك"]}
    ],onSubmit:v=>{v.amount=num(v.amount);v.vat=num(v.vat);data.expenses.unshift({id:id("exp"),...v});persist();renderPage();toast("success","تم تسجيل المصروف",v.description);}});
  }

  function openBarcode(initialBarcode="") {
    formModal({title:"إدخال باركود المنتج",values:{barcode:initialBarcode},fields:[{name:"barcode",label:"امسح الباركود أو اكتبه",required:true,full:true}],submitText:"إضافة إلى الفاتورة",onSubmit:v=>{
      const barcode=String(v.barcode||"").trim();
      const med=data.medicines.find(m=>String(m.barcode).trim()===barcode);
      if(!med){toast("info","باركود جديد","أكمل بيانات الدواء ليتم حفظه في المخزون");openMedicine(null,{barcode});return true;}
      addToCart(med.id);return true;
    }});
  }

  function addToCart(medicineId) {
    const med=data.medicines.find(m=>m.id===medicineId);if(!med)return;
    const item=ui.cart.find(x=>x.medicineId===medicineId),quantity=item?.qty||0;
    if(quantity>=num(med.stock))return toast("error","الكمية غير متوفرة",`المتاح ${med.stock} عبوة`);
    if(item)item.qty++;else ui.cart.push({medicineId:med.id,name:med.name,price:num(med.price),qty:1});
    renderPage("pos");
  }

  function changeCart(medicineId,delta) {
    const item=ui.cart.find(x=>x.medicineId===medicineId);if(!item)return;
    if(delta>0){const med=data.medicines.find(m=>m.id===medicineId);if(item.qty>=num(med?.stock))return toast("error","لا توجد كمية إضافية في المخزون");}
    item.qty+=delta;if(item.qty<=0)ui.cart=ui.cart.filter(x=>x!==item);renderPage("pos");
  }

  function checkout() {
    if(!ui.cart.length)return;
    const totals=cartTotals();
    formModal({title:"إتمام عملية البيع",values:{method:"نقدي",paid:totals.total.toFixed(2),customer:"عميل نقدي"},submitText:"تأكيد وطباعة",fields:[
      {name:"method",label:"طريقة الدفع",type:"select",options:["نقدي","بطاقة","تأمين","تحويل"]},{name:"paid",label:"المبلغ المستلم",type:"number",min:0,step:"0.01",required:true},{name:"customer",label:"اسم العميل"}
    ],onSubmit:v=>{
      const sale={id:id("sal"),invoice:`INV-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${String(data.sales.length+1).padStart(3,"0")}`,date:iso(),time:new Date().toLocaleTimeString("ar-AE",{hour:"2-digit",minute:"2-digit"}),subtotal:totals.subtotal,vat:totals.vat,total:totals.total,method:v.method,customer:v.customer,items:ui.cart.map(x=>({...x}))};
      sale.items.forEach(item=>{const med=data.medicines.find(m=>m.id===item.medicineId);if(med)med.stock=Math.max(0,num(med.stock)-num(item.qty));});
      data.sales.unshift(sale);persist();ui.cart=[];renderPage("pos");toast("success","تمت عملية البيع",sale.invoice);if(data.settings.autoPrint)printInvoice(sale);
    }});
  }

  function printInvoice(sale) {
    const w=window.open("","_blank","width=430,height=720");if(!w)return toast("error","تعذر فتح الطباعة","اسمح بالنوافذ المنبثقة لهذا الموقع");
    const items=(sale.items||[]).map(x=>`<tr><td>${escapeHTML(x.name)}</td><td>${x.qty}</td><td>${money(x.price)}</td><td>${money(x.price*x.qty)}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHTML(sale.invoice)}</title><style>body{font-family:Arial,Tahoma;padding:18px;color:#111;font-size:12px}.head{text-align:center;border-bottom:2px solid #312e81;padding-bottom:12px}.brand{font-size:25px;font-weight:900;letter-spacing:5px;color:#312e81}.sub{font-size:9px;letter-spacing:2px}.info{line-height:1.8;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{padding:7px 3px;border-bottom:1px solid #ddd;text-align:right}.totals{margin-top:12px}.totals div{display:flex;justify-content:space-between;margin:6px 0}.total{font-size:17px;font-weight:900;border-top:2px solid #111;padding-top:8px}.foot{text-align:center;margin-top:22px;color:#555;font-size:10px}@media print{button{display:none}}</style></head><body><div class="head"><div class="brand">VAREX</div><div class="sub">BUSINESS MANAGEMENT SYSTEM</div><h2>${escapeHTML(data.settings.pharmacyName)}</h2></div><div class="info">الفرع: ${escapeHTML(data.settings.branch)}<br>الرقم الضريبي: ${escapeHTML(data.settings.trn)}<br>الفاتورة: ${escapeHTML(sale.invoice)}<br>التاريخ: ${dateAR(sale.date)} — ${escapeHTML(sale.time)}<br>طريقة الدفع: ${escapeHTML(sale.method)}</div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><div><span>المجموع</span><strong>${money(sale.subtotal)}</strong></div><div><span>ضريبة القيمة المضافة</span><strong>${money(sale.vat)}</strong></div><div class="total"><span>الإجمالي</span><strong>${money(sale.total)}</strong></div></div><div class="foot">شكراً لزيارتكم<br>VAREX BUSINESS MANAGEMENT SYSTEM</div><script>onload=()=>{setTimeout(()=>print(),250)}<\/script></body></html>`);w.document.close();
  }

  async function deleteRecord(collection,recordId,label) {
    const ok=await confirmModal("تأكيد الحذف",`سيتم حذف ${label} من النظام. لا يمكن التراجع عن هذا الإجراء.`,"حذف");if(!ok)return;
    data[collection]=data[collection].filter(item=>item.id!==recordId);persist();renderPage();toast("success","تم الحذف",label);
  }

  function downloadFile(name,content,type="text/plain;charset=utf-8") {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);
  }

  function exportCSV(name,headers,rows) {
    const csv="\ufeff"+[headers,...rows].map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");downloadFile(name,csv,"text/csv;charset=utf-8");
  }

  async function handleAction(action,element) {
    const recordId=element.dataset.id;
    switch(action) {
      case "add-medicine": return openMedicine();
      case "edit-medicine": return openMedicine(data.medicines.find(x=>x.id===recordId));
      case "delete-medicine": { const r=data.medicines.find(x=>x.id===recordId);return deleteRecord("medicines",recordId,`الدواء ${r?.name||""}`); }
      case "add-batch": return openBatch();
      case "delete-batch": { const r=data.batches.find(x=>x.id===recordId);return deleteRecord("batches",recordId,`التشغيلة ${r?.batchNo||""}`); }
      case "add-purchase": return openPurchase();
      case "add-supplier": return openSupplier();
      case "edit-supplier": return openSupplier(data.suppliers.find(x=>x.id===recordId));
      case "delete-supplier": { const r=data.suppliers.find(x=>x.id===recordId);return deleteRecord("suppliers",recordId,`المورد ${r?.name||""}`); }
      case "add-customer": return openCustomer();
      case "edit-customer": return openCustomer(data.customers.find(x=>x.id===recordId));
      case "delete-customer": { const r=data.customers.find(x=>x.id===recordId);return deleteRecord("customers",recordId,`العميل ${r?.name||""}`); }
      case "add-prescription": return openPrescription();
      case "delete-prescription": { const r=data.prescriptions.find(x=>x.id===recordId);return deleteRecord("prescriptions",recordId,`الوصفة ${r?.number||""}`); }
      case "dispense-prescription": { const r=data.prescriptions.find(x=>x.id===recordId);if(r){r.status="تم الصرف";persist();renderPage();toast("success","تم تحديث الوصفة","تم تسجيل صرف الوصفة");}return; }
      case "add-expense": return openExpense();
      case "delete-expense": { const r=data.expenses.find(x=>x.id===recordId);return deleteRecord("expenses",recordId,`المصروف ${r?.description||""}`); }
      case "add-employee": return openEmployee();
      case "edit-employee": return openEmployee(data.employees.find(x=>x.id===recordId));
      case "delete-employee": { const r=data.employees.find(x=>x.id===recordId);return deleteRecord("employees",recordId,`الموظف ${r?.name||""}`); }
      case "add-cart": return addToCart(recordId);
      case "cart-plus": return changeCart(recordId,1);
      case "cart-minus": return changeCart(recordId,-1);
      case "checkout": return checkout();
      case "scan-barcode": return openBarcode();
      case "toggle-autoprint": data.settings.autoPrint=!data.settings.autoPrint;persist();renderPage();return toast("success",data.settings.autoPrint?"تم تفعيل الطباعة المباشرة":"تم إيقاف الطباعة المباشرة");
      case "toggle-sound-setting": return toggleSound(true);
      case "backup-data": downloadFile(`varex-pharmacy-backup-${iso()}.json`,JSON.stringify(data,null,2),"application/json");return toast("success","تم تجهيز النسخة الاحتياطية");
      case "restore-data": return $("restoreFile")?.click();
      case "reset-data": { const ok=await confirmModal("إعادة ضبط بيانات النظام","سيتم حذف سجلات التشغيل الحالية وإعادة النظام فارغاً. نزّل نسخة احتياطية أولاً عند الحاجة.","إعادة الضبط");if(ok){data=seedData();persist();renderPage();toast("success","تمت إعادة ضبط بيانات النظام");}return; }
      case "export-medicines": exportCSV(`varex-medicines-${iso()}.csv`,["الاسم التجاري","الاسم العلمي","الباركود","التصنيف","التكلفة","سعر البيع","المخزون","يتطلب وصفة"],data.medicines.map(m=>[m.name,m.scientific,m.barcode,m.category,m.cost,m.price,m.stock,m.prescription?"نعم":"لا"]));return toast("success","تم تصدير قائمة الأدوية");
      case "export-report": { const r=reportNumbers();exportCSV(`varex-pharmacy-report-${iso()}.csv`,["المؤشر","القيمة"],[["الإيرادات",r.revenue],["تكلفة البضاعة",r.cogs],["المصروفات",r.expenses],["صافي الربح",r.net],["ضريبة المخرجات",r.vatOut],["ضريبة المدخلات",r.vatIn],["الضريبة المستحقة",r.vatDue]]);return toast("success","تم تصدير التقرير المالي"); }
      case "export-vat": { const r=vatReportData();exportCSV(`varex-pharmacy-vat-${iso()}.csv`,["التاريخ","المرجع","نوع الحركة","المبلغ قبل الضريبة","قيمة VAT","الإجمالي"],r.transactions.map(item=>[item.date,item.reference,item.type,item.base,item.vat,item.total]));return toast("success","تم تصدير تقرير VAT"); }
      case "print-report": return window.print();
      case "print-vat": return window.print();
    }
  }

  host.addEventListener("click",event=>{
    const go=event.target.closest("[data-go]");if(go)return navigate(go.dataset.go);
    const action=event.target.closest("[data-action]");if(action)handleAction(action.dataset.action,action);
  });

  host.addEventListener("input",event=>{
    if(!event.target.matches("[data-filter-input]"))return;
    const query=event.target.value.trim().toLowerCase();
    host.querySelectorAll("[data-filter-item]").forEach(item=>item.hidden=query&&!item.dataset.filterItem.includes(query));
  });

  host.addEventListener("submit",event=>{
    if(event.target.id!=="settingsForm")return;
    event.preventDefault();const fd=new FormData(event.target);
    Object.assign(data.settings,{pharmacyName:fd.get("pharmacyName").trim(),ownerName:fd.get("ownerName").trim(),branch:fd.get("branch").trim(),phone:fd.get("phone").trim(),email:fd.get("email").trim(),licenseNo:fd.get("licenseNo").trim(),trn:fd.get("trn").trim(),vat:num(fd.get("vat")),lowStock:num(fd.get("lowStock")),expiryAlert:num(fd.get("expiryAlert"))});
    localStorage.setItem(PROFILE_KEY,JSON.stringify({...profile(),pharmacyName:data.settings.pharmacyName,ownerName:data.settings.ownerName,email:data.settings.email,phone:data.settings.phone,licenseNo:data.settings.licenseNo}));
    persist();$("headerPharmacyName").textContent=data.settings.pharmacyName;updateOperatorUI();toast("success","تم حفظ إعدادات الصيدلية");renderPage("settings");
  });

  host.addEventListener("change",event=>{
    if(event.target.id==="vatPeriod"){ui.vatPeriod=event.target.value;renderPage("vat");return;}
    if(event.target.id!=="restoreFile"||!event.target.files?.[0])return;
    const reader=new FileReader();reader.onload=()=>{try{const restored=JSON.parse(reader.result);if(!restored.medicines||!restored.settings)throw new Error();data=restored;persist();renderPage();toast("success","تمت استعادة النسخة الاحتياطية");}catch(_){toast("error","ملف النسخة الاحتياطية غير صالح");}};reader.readAsText(event.target.files[0]);
  });

  function navigate(page) { if(!renderers[page])return;ui.page=page;history.pushState(null,"",`#${page}`);renderPage(page); }

  function applyZoom(value) {
    const allowed=[50,60,70,80,90,100],zoom=allowed.includes(num(value))?num(value):100;
    document.documentElement.style.setProperty("--ui-scale",String(zoom/100));$("zoomSelect").value=String(zoom);localStorage.setItem(ZOOM_KEY,String(zoom));
  }

  function stepZoom(direction) {
    const allowed=[50,60,70,80,90,100],current=num($("zoomSelect").value),index=allowed.indexOf(current),next=allowed[Math.max(0,Math.min(allowed.length-1,index+direction))];applyZoom(next);toast("info",`حجم الشاشة ${next}%`);
  }

  function updateSoundButton() {
    $("soundToggle").classList.toggle("active",ui.sound);$("soundIcon").textContent=ui.sound?"🔊":"🔇";$("soundLabel").textContent=ui.sound?"الصوت":"صامت";
  }

  function toggleSound(fromSettings=false) {
    ui.sound=!ui.sound;localStorage.setItem(SOUND_KEY,ui.sound?"on":"off");updateSoundButton();if(fromSettings)renderPage("settings");toast("info",ui.sound?"تم تشغيل صوت النقر":"تم إيقاف صوت النقر");
  }

  async function logout() {
    const ok=await confirmModal("تسجيل الخروج","سيتم إغلاق جلسة الصيدلية والعودة إلى صفحة تسجيل الدخول.","تسجيل الخروج");if(!ok)return;
    await window.VarexPharmacyAuth?.signOut?.();location.replace("./login.html");
  }

  $("mainNav").addEventListener("click",event=>{const button=event.target.closest("[data-page]");if(button)navigate(button.dataset.page);});
  $("switchUserButton").addEventListener("click",openSwitchUser);
  $("logoutButton").addEventListener("click",logout);
  $("modalClose").addEventListener("click",closeModal);
  modal.addEventListener("click",event=>{if(event.target===modal)closeModal();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&modal.classList.contains("show"))closeModal();});
  $("zoomSelect").addEventListener("change",event=>{applyZoom(event.target.value);toast("info",`حجم الشاشة ${event.target.value}%`);});
  $("zoomIn").addEventListener("click",()=>stepZoom(1));$("zoomOut").addEventListener("click",()=>stepZoom(-1));
  $("soundToggle").addEventListener("click",()=>toggleSound(false));
  $("fullscreenButton").addEventListener("click",async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch(_){toast("error","تعذر تشغيل ملء الشاشة على هذا المتصفح");}});
  document.addEventListener("fullscreenchange",()=>{$("fullscreenButton").classList.toggle("active",Boolean(document.fullscreenElement));});
  document.addEventListener("click",event=>{if(event.target.closest("button,a,select,input[type=checkbox]"))clickSound();},{passive:true});
  addEventListener("hashchange",()=>renderPage(location.hash.slice(1)||"dashboard"));

  function updateClock() {
    const now=new Date();
    $("liveClock").textContent=now.toLocaleTimeString("ar-AE",{hour:"2-digit",minute:"2-digit"});
    $("liveDate").textContent=now.toLocaleDateString("ar-AE",{year:"numeric",month:"2-digit",day:"2-digit"});
  }

  window.VarexPharmacyDevices={
    openBarcodeReader(barcode=""){navigate("pos");setTimeout(()=>openBarcode(String(barcode||"").trim()),0);},
    printCurrent(){window.print();}
  };

  async function init() {
    try {
      const user={id:"static-preview",user_metadata:{full_name:"مستخدم المعاينة",pharmacy_name:"صيدلية VAREX"}};
      const meta=user.user_metadata||{};
      if(meta.pharmacy_name&&!profile().pharmacyName){data.settings.pharmacyName=meta.pharmacy_name;data.settings.ownerName=meta.full_name||data.settings.ownerName;persist();}
      $("headerPharmacyName").textContent=data.settings.pharmacyName;
      applyZoom(localStorage.getItem(ZOOM_KEY)||100);updateSoundButton();updateOperatorUI();updateClock();setInterval(updateClock,30000);
      renderPage(location.hash.slice(1)||"dashboard");
      if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
    } catch(error) { console.error(error);location.replace("./login.html"); }
  }

  init();
})();
