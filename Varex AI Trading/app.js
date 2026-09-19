(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const app = {
    profile: null,
    state: null,
    version: 0,
    broker: null,
    supportedMarkets: [],
    markets: [],
    selectedMarket: null,
    users: [],
    view: "dashboard",
    tradeSide: "buy",
    marketError: "",
    usersLoading: false,
  };
  let pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
  let toastTimer = 0;
  let confirmResolve = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }
  function money(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
  }
  function compactMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(number);
  }
  function pct(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
  }
  function localDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("ar-AE", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  }
  function roleLabel(role) {
    return ({ developer: "مطوّر", trader: "متداول", viewer: "مشاهِد" })[role] || "مستخدم";
  }
  function directionLabel(direction) {
    return ({ buy: "شراء", sell: "بيع", wait: "انتظار" })[direction] || "انتظار";
  }
  function showToast(message, type = "success") {
    if (type !== "error" && app.state?.settings?.notifications === false) return;
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast show ${type === "error" ? "error" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = "toast"; }, 3600);
  }
  function showAuthMessage(message = "", type = "error") {
    const target = $("#authMessage");
    target.textContent = message;
    target.className = `auth-message${message ? " show" : ""}${type === "success" ? " success" : ""}`;
  }
  function setBusy(form, active, label = "جاري التنفيذ…") {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (active) {
      button.dataset.label = button.textContent;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }
  async function runForm(form, task, label) {
    setBusy(form, true, label);
    showAuthMessage();
    try { return await task(); }
    catch (error) { showAuthMessage(error.message || "تعذر إكمال الطلب."); throw error; }
    finally { setBusy(form, false); }
  }
  async function request(path, options = {}) {
    const init = { credentials: "include", ...options, headers: { "Content-Type": "application/json", "X-Client-Info": "varex-ai-trading/2.0", ...(options.headers || {}) } };
    const response = await fetch(path, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.message || "تعذر إكمال الطلب.");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }
  function authRequest(path, body, method = "POST") {
    return request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  function tradingPost(action, body = {}) {
    return request("/api/trading", { method: "POST", body: JSON.stringify({ action, ...body }) });
  }
  function passwordStrong(value) {
    const password = String(value || "");
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
  }
  function showAuthPane(id) {
    $$(".auth-pane").forEach((pane) => pane.classList.toggle("hidden", pane.id !== id));
    showAuthMessage();
  }
  function closeMenu() {
    $("#sidebar").classList.remove("open");
    $("#drawerBackdrop").classList.remove("show");
  }
  function openMenu() {
    $("#sidebar").classList.add("open");
    $("#drawerBackdrop").classList.add("show");
  }
  function greeting() {
    return "صباح الخير";
  }
  function initials(name) {
    return String(name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  }

  async function init() {
    bindAuth();
    bindShell();
    try {
      const session = await authRequest("/api/auth/get-session", undefined, "GET");
      if (session?.user) await enterApp();
      else showLoggedOut();
    } catch {
      showLoggedOut();
    }
  }
  function showLoggedOut(message = "") {
    $("#loadingScreen").classList.add("hidden");
    $("#appShell").classList.add("hidden");
    $("#authScreen").classList.remove("hidden");
    showAuthPane("loginForm");
    if (message) showAuthMessage(message);
  }
  async function enterApp() {
    $("#loadingScreen").classList.remove("hidden");
    try {
      const bootstrap = await request("/api/trading");
      app.profile = bootstrap.profile;
      app.state = bootstrap.state;
      app.version = bootstrap.version;
      app.broker = bootstrap.broker;
      app.supportedMarkets = bootstrap.supportedMarkets || [];
      $("#authScreen").classList.add("hidden");
      $("#appShell").classList.remove("hidden");
      applyIdentity();
      await loadMarkets(app.state.selectedSymbol, true);
      render();
    } catch (error) {
      if (error.status === 401) return showLoggedOut("سجّل الدخول للمتابعة.");
      showLoggedOut(error.message);
    } finally {
      $("#loadingScreen").classList.add("hidden");
    }
  }
  function applyIdentity() {
    const profile = app.profile;
    $("#topUserName").textContent = profile.displayName;
    $("#topUserRole").textContent = roleLabel(profile.role);
    $("#avatar").textContent = initials(profile.displayName);
    $("#usersNav").classList.toggle("hidden", !profile.canManageUsers);
    $("#brokerLabel").textContent = app.broker?.label || "غير مربوط بوسيط";
    $("#dateLabel").textContent = new Date().toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    document.documentElement.classList.toggle("compact-mode", app.state?.settings?.compactMode === true);
  }

  function bindAuth() {
    document.addEventListener("click", (event) => {
      const switcher = event.target.closest("[data-auth-pane]");
      if (switcher) showAuthPane(switcher.dataset.authPane);
    });
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, data = new FormData(form);
      try {
        await runForm(form, async () => {
          await authRequest("/api/auth/sign-in/email", { email: String(data.get("email")).trim().toLowerCase(), password: String(data.get("password")), rememberMe: Boolean(data.get("remember")) });
          await enterApp();
        }, "جاري تسجيل الدخول…");
      } catch {}
    });
    $("#registerPane").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, data = new FormData(form);
      const displayName = String(data.get("displayName") || "").trim(), email = String(data.get("email") || "").trim().toLowerCase(), password = String(data.get("password") || "");
      if (displayName.length < 2) return showAuthMessage("أدخل اسم مستخدم واضحاً.");
      if (!passwordStrong(password)) return showAuthMessage("كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص، و8 أحرف على الأقل.");
      try {
        await runForm(form, async () => {
          await authRequest("/api/auth/sign-up/email", { name: displayName, email, password, rememberMe: false });
          await authRequest("/api/trading-auth/send-otp", { email, password, purpose: "verify" });
          pendingAuth = { purpose: "signup", email, password, displayName, otp: "" };
          $("#otpEmail").textContent = email;
          showAuthPane("otpPane");
          showAuthMessage("أرسلنا رمز التحقق إلى بريدك.", "success");
        }, "جاري إنشاء الحساب…");
      } catch {}
    });
    $("#recoverPane").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, email = String(new FormData(form).get("email") || "").trim().toLowerCase();
      try {
        await runForm(form, async () => {
          await authRequest("/api/trading-auth/send-otp", { email, purpose: "reset" });
          pendingAuth = { purpose: "recovery", email, password: "", displayName: "", otp: "" };
          $("#otpEmail").textContent = email;
          showAuthPane("otpPane");
          showAuthMessage("إذا كان الحساب مسجلاً فسيصل رمز الاستعادة إلى البريد.", "success");
        }, "جاري إرسال الرمز…");
      } catch {}
    });
    $("#otpPane").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, otp = String(new FormData(form).get("otp") || "").replace(/\D/g, "");
      if (otp.length !== 6) return showAuthMessage("أدخل رمزاً من 6 أرقام.");
      if (pendingAuth.purpose === "recovery") {
        pendingAuth.otp = otp;
        showAuthPane("resetPane");
        return;
      }
      try {
        await runForm(form, async () => {
          await authRequest("/api/trading-auth/verify-email", { email: pendingAuth.email, otp, password: pendingAuth.password, displayName: pendingAuth.displayName });
          $("#loginForm [name=email]").value = pendingAuth.email;
          pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
          showAuthPane("loginForm");
          showAuthMessage("تم تأكيد الحساب. يمكنك تسجيل الدخول الآن.", "success");
        }, "جاري تأكيد الحساب…");
      } catch {}
    });
    $("#resendOtp").addEventListener("click", async () => {
      if (!pendingAuth.email) return showAuthMessage("ابدأ العملية من جديد.");
      try {
        await authRequest("/api/trading-auth/send-otp", { email: pendingAuth.email, password: pendingAuth.password || undefined, purpose: pendingAuth.purpose === "recovery" ? "reset" : "verify" });
        showAuthMessage("تم إرسال رمز جديد.", "success");
      } catch (error) { showAuthMessage(error.message); }
    });
    $("#resetPane").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, password = String(new FormData(form).get("password") || "");
      if (!passwordStrong(password)) return showAuthMessage("كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص.");
      try {
        await runForm(form, async () => {
          await authRequest("/api/trading-auth/reset-password", { email: pendingAuth.email, otp: pendingAuth.otp, password });
          $("#loginForm [name=email]").value = pendingAuth.email;
          pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
          showAuthPane("loginForm");
          showAuthMessage("تم تحديث كلمة المرور. سجّل الدخول الآن.", "success");
        }, "جاري حفظ كلمة المرور…");
      } catch {}
    });
  }

  function bindShell() {
    $("#menuButton").addEventListener("click", openMenu);
    $("#closeMenu").addEventListener("click", closeMenu);
    $("#drawerBackdrop").addEventListener("click", closeMenu);
    $("#userMenuButton").addEventListener("click", () => goTo("settings"));
    $("#mainNav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) goTo(button.dataset.view);
    });
    $(".sidebar-bottom").addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) goTo(button.dataset.view);
    });
    $("#pageActions").addEventListener("click", handleActionClick);
    $("#viewRoot").addEventListener("click", handleActionClick);
    $("#viewRoot").addEventListener("submit", handleSubmit);
    $("#confirmCancel").addEventListener("click", () => resolveConfirm(false));
    $("#confirmAccept").addEventListener("click", () => resolveConfirm(true));
  }
  function goTo(view) {
    if (view === "users" && !app.profile.canManageUsers) return;
    app.view = view;
    $$(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    closeMenu();
    if (view === "users" && !app.users.length) loadUsers();
    else render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resolveConfirm(value) {
    $("#confirmModal").classList.add("hidden");
    if (confirmResolve) confirmResolve(value);
    confirmResolve = null;
  }
  function confirmAction(title, text) {
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    $("#confirmModal").classList.remove("hidden");
    return new Promise((resolve) => { confirmResolve = resolve; });
  }

  async function loadMarkets(symbol = "BTC-USD", initial = false) {
    try {
      const board = await request(`/api/trading?action=markets&symbol=${encodeURIComponent(symbol)}`);
      app.markets = board.markets || [];
      app.selectedMarket = app.markets.find((market) => market.symbol === board.selected) || app.markets[0] || null;
      app.marketError = "";
      $("#marketStatus").classList.add("live");
      $("#marketStatus").innerHTML = "<i></i> بيانات سوق حية";
    } catch (error) {
      app.marketError = error.message;
      app.markets = [];
      app.selectedMarket = null;
      $("#marketStatus").classList.remove("live");
      $("#marketStatus").textContent = "السوق غير متاح";
      if (!initial) showToast(error.message, "error");
    }
  }
  async function refreshMarkets(symbol = app.state.selectedSymbol) {
    const button = $('[data-action="refresh-markets"]');
    if (button) button.disabled = true;
    await loadMarkets(symbol);
    render();
  }
  function getMarket(symbol) {
    return app.markets.find((market) => market.symbol === symbol);
  }
  function unrealizedFor(trade) {
    const market = getMarket(trade.symbol);
    if (!market || trade.status !== "open") return 0;
    const direction = trade.side === "buy" ? 1 : -1;
    return direction * ((market.price - trade.entryPrice) / trade.entryPrice) * trade.amount;
  }
  function accountMetrics() {
    const trades = app.state.trades || [], closed = trades.filter((trade) => trade.status === "closed"), open = trades.filter((trade) => trade.status === "open");
    const realized = closed.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const unrealized = open.reduce((sum, trade) => sum + unrealizedFor(trade), 0);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayPnl = closed.filter((trade) => trade.closedAt && new Date(trade.closedAt) >= todayStart).reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const wins = closed.filter((trade) => trade.pnl > 0).length;
    const losses = closed.filter((trade) => trade.pnl < 0).length;
    const balance = Number(app.state.balanceCents || 0) / 100;
    return { trades, closed, open, realized, unrealized, todayPnl, wins, losses, winRate: closed.length ? wins / closed.length * 100 : 0, balance, equity: balance + unrealized };
  }

  function headerForView() {
    const map = {
      dashboard: [`${greeting()}، ${app.profile.displayName}`, "ملخص حي لحسابك الورقي وقراراتك المحفوظة."],
      intelligence: ["فرص الذكاء", "تحليل احتمالي مبني على أسعار السوق الحية وحركة آخر 24 ساعة."],
      trades: ["الصفقات", "افتح وأغلق صفقات ورقية بأسعار حية وراجع سجلها الكامل."],
      risk: ["مركز المخاطر", "حدود حقيقية يطبقها الخادم قبل السماح بأي صفقة ورقية."],
      watchlist: ["قائمة المراقبة", "اختر الأسواق التي تريد متابعتها واحفظها في حسابك."],
      reports: ["التقارير", "نتائج محسوبة من صفقات حسابك المحفوظة فقط."],
      users: ["المستخدمون", "أضف مستخدمين وحدد صلاحية التداول أو المشاهدة."],
      settings: ["الإعدادات", "إدارة اسم المستخدم والتفضيلات وجلسة الحساب."],
    };
    const [title, subtitle] = map[app.view] || map.dashboard;
    $("#pageTitle").textContent = title;
    $("#pageSubtitle").textContent = subtitle;
    const actions = {
      dashboard: '<button class="primary-button" data-action="refresh-markets">↻ تحديث الأسعار</button>',
      intelligence: '<button class="primary-button" data-action="analyze-current">✦ تحليل السوق المحدد</button>',
      reports: '<button class="primary-button" data-action="export-report">⇩ تصدير CSV</button>',
    };
    $("#pageActions").innerHTML = actions[app.view] || "";
  }
  function render() {
    if (!app.state || !app.profile) return;
    document.documentElement.classList.toggle("compact-mode", app.state.settings.compactMode === true);
    headerForView();
    const renderers = { dashboard: renderDashboard, intelligence: renderIntelligence, trades: renderTrades, risk: renderRisk, watchlist: renderWatchlist, reports: renderReports, users: renderUsers, settings: renderSettings };
    $("#viewRoot").innerHTML = (renderers[app.view] || renderDashboard)();
  }
  function statCard(icon, label, value, note, valueClass = "") {
    return `<article class="stat-card"><header><span>${escapeHtml(label)}</span><span class="stat-icon">${icon}</span></header><strong class="${valueClass}">${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }
  function marketTabs() {
    if (!app.markets.length) return "";
    return `<div class="market-tabs">${app.markets.map((market) => `<button class="${market.symbol === app.selectedMarket?.symbol ? "active" : ""}" data-market="${market.symbol}">${market.label}</button>`).join("")}</div>`;
  }
  function chartSvg(market) {
    const candles = Array.isArray(market?.candles) ? market.candles : [];
    if (candles.length < 2) return '<div class="empty"><span>⌁</span><p>لا تتوفر شموع سعرية حالياً.</p></div>';
    const closes = candles.map((candle) => Number(candle.close)), min = Math.min(...closes), max = Math.max(...closes), span = Math.max(max - min, max * .001);
    const points = closes.map((close, index) => {
      const x = 18 + index * (724 / Math.max(1, closes.length - 1));
      const y = 210 - ((close - min) / span) * 174;
      return [x, y];
    });
    const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L742,222 L18,222 Z`;
    return `<svg viewBox="0 0 760 230" role="img" aria-label="حركة السعر الحية"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5b82e" stop-opacity=".3"/><stop offset="1" stop-color="#f5b82e" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line x1="18" y1="38" x2="742" y2="38"/><line x1="18" y1="96" x2="742" y2="96"/><line x1="18" y1="154" x2="742" y2="154"/><line x1="18" y1="212" x2="742" y2="212"/></g><path class="chart-area" d="${area}"></path><path class="chart-line" d="${line}"></path></svg>`;
  }
  function marketPanel() {
    if (app.marketError) return `<article class="panel"><div class="empty"><span>!</span><p>${escapeHtml(app.marketError)}</p><button class="small-button" data-action="refresh-markets">إعادة المحاولة</button></div></article>`;
    const market = app.selectedMarket;
    if (!market) return '<article class="panel"><div class="empty"><span>⌁</span><p>جاري تحميل السوق…</p></div></article>';
    return `<article class="panel">
      ${marketTabs()}
      <div class="market-summary"><div class="asset-title"><span class="coin">${escapeHtml(market.icon)}</span><span><b>${escapeHtml(market.label)}</b><small>${escapeHtml(market.name)} · Coinbase Exchange</small></span></div><div class="market-price"><b>${money(market.price)}</b><small class="${market.changePct >= 0 ? "positive" : "negative"}">${pct(market.changePct)}</small></div></div>
      <div class="chart-wrap">${chartSvg(market)}</div>
      <div class="market-details"><span><small>افتتاح 24 س</small><b>${money(market.open)}</b></span><span><small>أعلى سعر</small><b>${money(market.high)}</b></span><span><small>أدنى سعر</small><b>${money(market.low)}</b></span><span><small>الحجم التقديري</small><b>${compactMoney(market.volumeUsd)}</b></span></div>
    </article>`;
  }
  function renderRecentTrades(limit = 5) {
    const trades = app.state.trades.slice(0, limit);
    if (!trades.length) return '<div class="empty"><span>▣</span><p>لا توجد صفقات بعد. افتح أول صفقة ورقية من بطاقة التنفيذ.</p></div>';
    return `<div class="list">${trades.map((trade) => `<div class="list-row"><span><strong>${escapeHtml(trade.symbol)}</strong><small class="muted"> · ${localDate(trade.openedAt, true)}</small></span><span class="badge ${trade.side}">${directionLabel(trade.side)}</span><span class="${trade.status === "closed" ? (trade.pnl >= 0 ? "positive" : "negative") : "muted"}">${trade.status === "closed" ? money(trade.pnl) : "مفتوحة"}</span><button class="small-button" data-view="trades">التفاصيل</button></div>`).join("")}</div>`;
  }
  function tradeTicket() {
    const canTrade = app.profile.canTrade, marketOptions = app.markets.map((market) => `<option value="${market.symbol}" ${market.symbol === app.state.selectedSymbol ? "selected" : ""}>${market.label}</option>`).join("");
    const selected = getMarket(app.state.selectedSymbol) || app.selectedMarket;
    return `<article class="panel"><header class="panel-head"><div><h2>فتح صفقة ورقية</h2><p>السعر يؤخذ من السوق عند تأكيد الطلب.</p></div><span class="badge pending">PAPER</span></header>
      ${canTrade ? `<form class="trade-ticket" id="tradeForm">
        <label class="control">السوق<select name="symbol">${marketOptions}</select></label>
        <div class="side-picker"><button type="button" class="${app.tradeSide === "buy" ? "active" : ""}" data-side="buy">↗ شراء</button><button type="button" class="${app.tradeSide === "sell" ? "active" : ""}" data-side="sell">↘ بيع</button></div>
        <label class="control">حجم الصفقة بالدولار<input name="amount" type="number" min="25" step="25" value="500" required></label>
        <div class="trade-summary"><p><span>السعر المعروض</span><b>${selected ? money(selected.price) : "يؤخذ عند التنفيذ"}</b></p><p><span>حد الصفقات المفتوحة</span><b>${app.state.risk.maxOpenTrades}</b></p><p><span>المخاطرة لكل صفقة</span><b>${app.state.risk.riskPerTradePct}%</b></p></div>
        <button class="primary-button" type="submit">فتح صفقة ${app.tradeSide === "buy" ? "شراء" : "بيع"} ورقية</button>
      </form>` : '<div class="notice">صلاحية هذا الحساب مشاهدة فقط. المطوّر يستطيع تغييرها من شاشة المستخدمين.</div>'}
    </article>`;
  }
  function renderDashboard() {
    const metrics = accountMetrics(), dailyRisk = metrics.todayPnl < 0 && metrics.balance ? Math.abs(metrics.todayPnl) / metrics.balance * 100 : 0;
    return `<section class="stats-grid">
      ${statCard("▣", "الرصيد الورقي", money(metrics.balance), "الرصيد المحفوظ في حسابك")}
      ${statCard("$", "صافي اليوم", money(metrics.todayPnl), metrics.closed.length ? "من الصفقات المغلقة اليوم" : "لا توجد صفقات مغلقة اليوم", metrics.todayPnl >= 0 ? "positive" : "negative")}
      ${statCard("⌁", "صفقات مفتوحة", String(metrics.open.length), `الحد المسموح ${app.state.risk.maxOpenTrades}`)}
      ${statCard("◇", "استخدام حد الخسارة", `${dailyRisk.toFixed(2)}%`, `من حد يومي ${app.state.risk.maxDailyLossPct}%`, dailyRisk >= app.state.risk.maxDailyLossPct ? "negative" : "")}
    </section>
    <section class="content-grid">${marketPanel()}${tradeTicket()}</section>
    <section class="panel"><header class="panel-head"><div><h2>آخر الصفقات</h2><p>بيانات فعلية من سجل حسابك الورقي.</p></div><button class="small-button" data-view="trades">عرض الكل</button></header>${renderRecentTrades()}</section>`;
  }

  function analysisCard(analysis) {
    if (!analysis) return '<div class="empty"><span>✦</span><p>لم تنفذ أي تحليل بعد. اختر سوقاً واضغط تحليل.</p></div>';
    const colorClass = analysis.direction === "wait" ? "muted" : analysis.direction === "buy" ? "positive" : "negative";
    return `<div class="signal-card"><div class="signal-main"><small>${escapeHtml(analysis.symbol)} · ${localDate(analysis.createdAt, true)}</small><strong class="${colorClass}">${directionLabel(analysis.direction)}</strong><span class="muted">المحرك: ${escapeHtml(analysis.engine || "VAREX")}</span></div><span class="score-ring" style="--score:${Number(analysis.confidence || 0) * 3.6}deg"><b>${Number(analysis.confidence || 0)}%</b></span></div>
      <ul class="reasons">${(analysis.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      <div class="level-grid"><span><small>سعر التحليل</small><b>${money(analysis.price)}</b></span><span><small>الهدف الاحتمالي</small><b class="positive">${money(analysis.target)}</b></span><span><small>وقف مقترح</small><b class="negative">${money(analysis.stop)}</b></span></div>
      <p class="notice">${escapeHtml(analysis.disclaimer || "التحليل احتمالي وليس ضماناً للربح.")}</p>`;
  }
  function renderIntelligence() {
    const latest = app.state.analyses[0], opportunities = app.markets.map((market) => {
      const direction = market.changePct >= 1 ? "buy" : market.changePct <= -1 ? "sell" : "wait";
      const confidence = Math.max(52, Math.min(92, Math.round(56 + Math.abs(market.changePct) * 7)));
      return `<div class="list-row"><span><strong>${escapeHtml(market.label)}</strong><small class="muted"> · ${pct(market.changePct)}</small></span><span class="badge ${direction}">${directionLabel(direction)}</span><span>${confidence}% رصد أولي</span><button class="small-button" data-analyze="${market.symbol}">تحليل كامل</button></div>`;
    }).join("");
    const history = app.state.analyses.slice(0, 8);
    return `<section class="content-grid"><article class="panel"><header class="panel-head"><div><h2>التحليل الأخير</h2><p>يُنشأ على الخادم من بيانات السوق الحية.</p></div></header>${analysisCard(latest)}</article>
      <article class="panel"><header class="panel-head"><div><h2>الرصد الحالي</h2><p>قراءة أولية لحركة 24 ساعة.</p></div></header>${opportunities || '<div class="empty"><p>الأسعار غير متاحة.</p></div>'}</article></section>
      <section class="panel"><header class="panel-head"><div><h2>سجل التحليلات</h2><p>محفوظ في حسابك.</p></div></header>${history.length ? `<div class="analysis-history">${history.map((item) => `<div class="analysis-item"><p><b>${escapeHtml(item.symbol)}</b><span class="badge ${item.direction}">${directionLabel(item.direction)}</span><small>${localDate(item.createdAt, true)}</small></p><strong>${Number(item.confidence || 0)}%</strong></div>`).join("")}</div>` : '<div class="empty"><p>لا يوجد سجل تحليل بعد.</p></div>'}</section>`;
  }

  function renderTrades() {
    const trades = app.state.trades;
    const rows = trades.map((trade) => {
      const currentPnl = trade.status === "open" ? unrealizedFor(trade) : trade.pnl;
      return `<tr><td dir="ltr"><b>${escapeHtml(trade.symbol)}</b></td><td><span class="badge ${trade.side}">${directionLabel(trade.side)}</span></td><td dir="ltr">${money(trade.amount)}</td><td dir="ltr">${money(trade.entryPrice)}</td><td dir="ltr">${trade.exitPrice ? money(trade.exitPrice) : getMarket(trade.symbol) ? money(getMarket(trade.symbol).price) : "—"}</td><td class="${currentPnl >= 0 ? "positive" : "negative"}" dir="ltr">${money(currentPnl)}</td><td>${trade.status === "open" ? '<span class="badge active">مفتوحة</span>' : '<span class="badge pending">مغلقة</span>'}</td><td>${trade.status === "open" && app.profile.canTrade ? `<button class="small-button danger" data-close-trade="${trade.id}">إغلاق</button>` : "—"}</td></tr>`;
    }).join("");
    return `<section class="content-grid">${tradeTicket()}<article class="panel"><header class="panel-head"><div><h2>قواعد التنفيذ</h2><p>تُطبق على الخادم قبل فتح الصفقة.</p></div></header><div class="toggle-row"><p><b>الحد الأقصى المفتوح</b><small>لا يمكن تجاوزه</small></p><strong>${app.state.risk.maxOpenTrades}</strong></div><div class="toggle-row"><p><b>حجم الصفقة</b><small>حتى 25% من الرصيد</small></p><strong>25%</strong></div><div class="toggle-row"><p><b>وقف تلقائي</b><small>محفوظ مع الصفقة</small></p><span class="badge ${app.state.risk.autoStop ? "active" : "inactive"}">${app.state.risk.autoStop ? "مفعّل" : "متوقف"}</span></div></article></section>
      <section class="panel"><header class="panel-head"><div><h2>سجل الصفقات</h2><p>${trades.length} صفقة محفوظة.</p></div></header><div class="table-wrap">${trades.length ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>الحجم</th><th>الدخول</th><th>الخروج / الحالي</th><th>النتيجة</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty"><span>▣</span><p>لا توجد صفقات بعد.</p></div>'}</div></section>`;
  }

  function renderRisk() {
    const metrics = accountMetrics(), lossToday = Math.min(0, metrics.todayPnl), used = metrics.balance ? Math.abs(lossToday) / metrics.balance * 100 : 0;
    return `<section class="stats-grid">
      ${statCard("◇", "حد الخسارة اليومي", `${app.state.risk.maxDailyLossPct}%`, "يمنع فتح صفقة بعد بلوغه")}
      ${statCard("⌁", "المستخدم اليوم", `${used.toFixed(2)}%`, lossToday ? money(lossToday) : "لا توجد خسارة محققة", used >= app.state.risk.maxDailyLossPct ? "negative" : "positive")}
      ${statCard("▣", "حد الصفقات", String(app.state.risk.maxOpenTrades), `${metrics.open.length} مفتوحة حالياً`)}
      ${statCard("%", "مخاطرة الصفقة", `${app.state.risk.riskPerTradePct}%`, "من الرصيد الورقي")}
    </section>
    <section class="content-grid equal-grid"><form class="panel" id="riskForm"><header class="panel-head"><div><h2>حدود المخاطر</h2><p>تُحفظ وتُطبق فوراً.</p></div></header><div class="form-grid">
      <label class="control">حد الخسارة اليومي %<input name="maxDailyLossPct" type="number" min=".5" max="20" step=".5" value="${app.state.risk.maxDailyLossPct}"></label>
      <label class="control">أقصى صفقات مفتوحة<input name="maxOpenTrades" type="number" min="1" max="10" step="1" value="${app.state.risk.maxOpenTrades}"></label>
      <label class="control">مخاطرة الصفقة %<input name="riskPerTradePct" type="number" min=".25" max="5" step=".25" value="${app.state.risk.riskPerTradePct}"></label>
    </div><div class="toggle-row"><p><b>تحديد وقف خسارة</b><small>يحفظ مستوى وقف محسوباً مع كل صفقة جديدة</small></p><button type="button" class="switch ${app.state.risk.autoStop ? "on" : ""}" data-toggle-risk="autoStop"><i></i></button></div><button class="primary-button" type="submit">حفظ حدود المخاطر</button></form>
      <article class="panel"><header class="panel-head"><div><h2>حالة الحماية</h2><p>ملخص القرارات الحالية.</p></div></header><div class="notice">حد الخسارة وعدد الصفقات وحجم الصفقة تُفحص على الخادم، لذلك لا يمكن تجاوزها بتعديل الواجهة.</div><div class="toggle-row"><p><b>القدرة على التداول</b><small>حسب دور المستخدم</small></p><span class="badge ${app.profile.canTrade ? "active" : "inactive"}">${app.profile.canTrade ? "مسموح" : "مشاهدة فقط"}</span></div><div class="toggle-row"><p><b>الوسيط المالي</b><small>لا توجد أوامر مالية</small></p><span class="badge pending">غير مربوط</span></div></article></section>`;
  }

  function renderWatchlist() {
    const cards = app.supportedMarkets.map((item) => {
      const market = getMarket(item.symbol), checked = app.state.watchlist.includes(item.symbol);
      return `<label class="watch-card"><input type="checkbox" name="symbols" value="${item.symbol}" ${checked ? "checked" : ""}><span class="coin">${escapeHtml(item.icon)}</span><p><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.name)}</small></p><span><b>${market ? money(market.price) : "—"}</b><small class="${market?.changePct >= 0 ? "positive" : "negative"}">${market ? pct(market.changePct) : "غير متاح"}</small></span></label>`;
    }).join("");
    return `<form class="panel" id="watchlistForm"><header class="panel-head"><div><h2>الأسواق المتاحة</h2><p>اختر سوقاً واحداً على الأقل.</p></div><button class="primary-button" type="submit">حفظ القائمة</button></header><div class="watch-grid">${cards}</div></form>`;
  }

  function renderReports() {
    const metrics = accountMetrics();
    const bySymbol = {};
    metrics.closed.forEach((trade) => { bySymbol[trade.symbol] = (bySymbol[trade.symbol] || 0) + Number(trade.pnl || 0); });
    const maxAbs = Math.max(1, ...Object.values(bySymbol).map((value) => Math.abs(value)));
    const bars = Object.entries(bySymbol).map(([symbol, value]) => `<div class="bar-row"><b>${escapeHtml(symbol)}</b><span class="bar-track"><i style="width:${Math.max(4, Math.abs(value) / maxAbs * 100)}%;background:${value >= 0 ? "" : "var(--red)"}"></i></span><strong class="${value >= 0 ? "positive" : "negative"}">${money(value)}</strong></div>`).join("");
    const rows = metrics.closed.map((trade) => `<tr><td dir="ltr">${escapeHtml(trade.symbol)}</td><td>${directionLabel(trade.side)}</td><td dir="ltr">${money(trade.amount)}</td><td dir="ltr">${money(trade.pnl)}</td><td>${localDate(trade.closedAt, true)}</td></tr>`).join("");
    return `<section class="stats-grid">${statCard("$", "الربح والخسارة المحققة", money(metrics.realized), "من كل الصفقات المغلقة", metrics.realized >= 0 ? "positive" : "negative")}${statCard("%", "نسبة النجاح", `${metrics.winRate.toFixed(1)}%`, `${metrics.wins} رابحة · ${metrics.losses} خاسرة`)}${statCard("▣", "صفقات مغلقة", String(metrics.closed.length), "ضمن الحساب الحالي")}${statCard("⌁", "القيمة الورقية", money(metrics.equity), "الرصيد مع النتائج غير المحققة")}</section>
      <section class="content-grid equal-grid"><article class="panel"><header class="panel-head"><div><h2>النتيجة حسب السوق</h2><p>صفقات مغلقة فقط.</p></div></header><div class="report-bars">${bars || '<div class="empty"><p>لا توجد بيانات كافية للرسم.</p></div>'}</div></article><article class="panel"><header class="panel-head"><div><h2>ملاحظات التقرير</h2><p>طريقة احتساب واضحة.</p></div></header><div class="notice">النتائج محسوبة من فرق سعر الدخول والخروج الفعلي الذي سجله الخادم عند إغلاق الصفقة الورقية. لا تتضمن عمولات وسيط أو انزلاقاً سعرياً.</div></article></section>
      <section class="panel"><header class="panel-head"><div><h2>تفاصيل الصفقات المغلقة</h2><p>يمكن تصديرها بصيغة CSV.</p></div></header><div class="table-wrap">${rows ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>الحجم</th><th>النتيجة</th><th>الإغلاق</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty"><p>لا توجد صفقات مغلقة بعد.</p></div>'}</div></section>`;
  }

  function renderUsers() {
    if (!app.profile.canManageUsers) return '<div class="notice">هذه الشاشة متاحة للمطوّر فقط.</div>';
    if (app.usersLoading) return '<section class="panel"><div class="empty"><span class="loader"></span><p>جاري تحميل المستخدمين…</p></div></section>';
    const cards = app.users.map((user) => {
      const developer = user.role === "developer", status = user.pending ? "pending" : user.status;
      return `<div class="user-card" data-user-row="${escapeHtml(user.email)}"><p><b>${escapeHtml(user.displayName)}</b><small dir="ltr">${escapeHtml(user.email)}</small></p><aside><span class="badge ${status}">${status === "pending" ? "بانتظار التسجيل" : status === "active" ? "نشط" : "متوقف"}</span>${developer ? '<span class="badge active">مطوّر</span>' : `<select class="small-button user-role"><option value="trader" ${user.role === "trader" ? "selected" : ""}>متداول</option><option value="viewer" ${user.role === "viewer" ? "selected" : ""}>مشاهِد</option></select><button class="small-button" data-user-save="${escapeHtml(user.email)}" data-status="${status === "inactive" || status === "revoked" ? "active" : "inactive"}">${status === "inactive" || status === "revoked" ? "تفعيل" : "إيقاف"}</button>`}</aside></div>`;
    }).join("");
    return `<section class="content-grid"><form class="panel" id="inviteForm"><header class="panel-head"><div><h2>إضافة مستخدم</h2><p>يستطيع البريد المدعو إنشاء حسابه من نفس الرابط.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" required maxlength="80" placeholder="مثال: مسؤول الاستثمار"></label><label class="control">البريد الإلكتروني<input name="email" type="email" required placeholder="user@example.com"></label><label class="control">الصلاحية<select name="role"><option value="trader">متداول — فتح وإغلاق صفقات ورقية</option><option value="viewer">مشاهِد — قراءة فقط</option></select></label></div><button class="primary-button" type="submit">إضافة المستخدم</button></form><article class="panel"><header class="panel-head"><div><h2>طريقة الدخول</h2><p>خطوات المستخدم المدعو.</p></div></header><div class="notice">أرسل للمستخدم رابط التطبيق. ينشئ حساباً بالبريد نفسه، يؤكد رمز OTP، ثم تظهر له صلاحياته تلقائياً.</div></article></section><section class="panel"><header class="panel-head"><div><h2>قائمة المستخدمين</h2><p>${app.users.length} حساباً أو دعوة.</p></div><button class="small-button" data-action="reload-users">تحديث</button></header>${cards || '<div class="empty"><p>لا يوجد مستخدمون بعد.</p></div>'}</section>`;
  }

  function renderSettings() {
    const settings = app.state.settings;
    return `<section class="settings-stack"><form class="panel" id="profileForm"><header class="panel-head"><div><h2>بيانات الحساب</h2><p>يظهر اسم المستخدم في التحية والقائمة.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" value="${escapeHtml(app.profile.displayName)}" maxlength="80" required></label><label class="control">البريد الإلكتروني<input value="${escapeHtml(app.profile.email)}" disabled dir="ltr"></label></div><button class="primary-button" type="submit">حفظ اسم المستخدم</button></form>
      <form class="panel" id="settingsForm"><header class="panel-head"><div><h2>تفضيلات الواجهة</h2><p>محفوظة في حسابك على قاعدة البيانات.</p></div></header><div class="form-grid"><label class="control">المنطقة الزمنية<select name="timezone"><option value="Asia/Dubai" ${settings.timezone === "Asia/Dubai" ? "selected" : ""}>الإمارات — دبي</option><option value="Asia/Riyadh" ${settings.timezone === "Asia/Riyadh" ? "selected" : ""}>السعودية — الرياض</option><option value="UTC" ${settings.timezone === "UTC" ? "selected" : ""}>UTC</option></select></label></div><div class="toggle-row"><p><b>إشعارات داخل التطبيق</b><small>إظهار تنبيهات نجاح العمليات وأخطاء السوق</small></p><button type="button" class="switch ${settings.notifications ? "on" : ""}" data-toggle-setting="notifications"><i></i></button></div><div class="toggle-row"><p><b>الوضع المضغوط</b><small>جاهز للاستخدام في تحديث واجهة لاحق</small></p><button type="button" class="switch ${settings.compactMode ? "on" : ""}" data-toggle-setting="compactMode"><i></i></button></div><button class="primary-button" type="submit">حفظ التفضيلات</button></form>
      <article class="panel"><header class="panel-head"><div><h2>الجلسة</h2><p>الدور الحالي: ${roleLabel(app.profile.role)}</p></div></header><button class="secondary-button" data-action="logout">تسجيل الخروج</button></article>
      ${app.profile.canTrade ? '<article class="panel danger-zone"><header class="panel-head"><div><h2>إعادة ضبط التداول الورقي</h2><p>يحذف الصفقات والتحليلات ويعيد الرصيد إلى 25,000 دولار. لا يحذف الحساب أو المستخدمين.</p></div></header><button class="danger-button" data-action="reset-paper">إعادة الضبط</button></article>' : ""}
    </section>`;
  }

  async function handleActionClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) return goTo(viewButton.dataset.view);
    const marketButton = event.target.closest("[data-market]");
    if (marketButton) {
      try {
        const result = await tradingPost("save_preferences", { selectedSymbol: marketButton.dataset.market });
        app.state = result.state; app.version = result.version;
        await refreshMarkets(marketButton.dataset.market);
      } catch (error) { showToast(error.message, "error"); }
      return;
    }
    const sideButton = event.target.closest("[data-side]");
    if (sideButton) { app.tradeSide = sideButton.dataset.side; render(); return; }
    const toggleRisk = event.target.closest("[data-toggle-risk]");
    if (toggleRisk) { app.state.risk[toggleRisk.dataset.toggleRisk] = !app.state.risk[toggleRisk.dataset.toggleRisk]; render(); return; }
    const toggleSetting = event.target.closest("[data-toggle-setting]");
    if (toggleSetting) { app.state.settings[toggleSetting.dataset.toggleSetting] = !app.state.settings[toggleSetting.dataset.toggleSetting]; render(); return; }
    const analyze = event.target.closest("[data-analyze]");
    if (analyze) return runAnalysis(analyze.dataset.analyze);
    const close = event.target.closest("[data-close-trade]");
    if (close) return closeTrade(close.dataset.closeTrade);
    const userSave = event.target.closest("[data-user-save]");
    if (userSave) {
      const row = userSave.closest("[data-user-row]"), role = $(".user-role", row).value;
      return updateUser(userSave.dataset.userSave, role, userSave.dataset.status);
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "refresh-markets") return refreshMarkets();
    if (action === "analyze-current") return runAnalysis(app.state.selectedSymbol);
    if (action === "export-report") return exportReport();
    if (action === "reload-users") return loadUsers();
    if (action === "logout") return logout();
    if (action === "reset-paper") return resetPaper();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target, data = new FormData(form), submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.id === "tradeForm") {
        const result = await tradingPost("open_trade", { symbol: String(data.get("symbol")), side: app.tradeSide, amount: Number(data.get("amount")) });
        app.state = result.state; app.version = result.version;
        await loadMarkets(app.state.selectedSymbol, true);
        showToast("تم فتح الصفقة الورقية بسعر السوق الحي.");
        render();
      } else if (form.id === "riskForm") {
        const risk = { ...app.state.risk, maxDailyLossPct: Number(data.get("maxDailyLossPct")), maxOpenTrades: Number(data.get("maxOpenTrades")), riskPerTradePct: Number(data.get("riskPerTradePct")) };
        const result = await tradingPost("save_preferences", { risk });
        app.state = result.state; app.version = result.version;
        showToast("تم حفظ حدود المخاطر وتفعيلها.");
        render();
      } else if (form.id === "watchlistForm") {
        const watchlist = data.getAll("symbols").map(String);
        if (!watchlist.length) throw new Error("اختر سوقاً واحداً على الأقل.");
        const result = await tradingPost("save_preferences", { watchlist });
        app.state = result.state; app.version = result.version;
        showToast("تم حفظ قائمة المراقبة.");
        render();
      } else if (form.id === "inviteForm") {
        const result = await tradingPost("invite_user", { displayName: String(data.get("displayName")), email: String(data.get("email")), role: String(data.get("role")) });
        app.users = result.users || [];
        form.reset();
        showToast("تمت إضافة المستخدم. يمكنه إنشاء حساب بالبريد نفسه.");
        render();
      } else if (form.id === "profileForm") {
        const result = await tradingPost("update_profile", { displayName: String(data.get("displayName")) });
        app.profile.displayName = result.displayName;
        applyIdentity();
        showToast("تم تحديث اسم المستخدم.");
        render();
      } else if (form.id === "settingsForm") {
        const settings = { ...app.state.settings, timezone: String(data.get("timezone")) };
        const result = await tradingPost("save_preferences", { settings });
        app.state = result.state; app.version = result.version;
        showToast("تم حفظ التفضيلات.");
        render();
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function runAnalysis(symbol) {
    const buttons = $$("[data-analyze], [data-action=analyze-current]");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await tradingPost("analyze", { symbol });
      app.state = result.state; app.version = result.version;
      await loadMarkets(symbol, true);
      app.view = "intelligence";
      showToast("اكتمل التحليل وحُفظ في حسابك.");
      render();
    } catch (error) { showToast(error.message, "error"); }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
  async function closeTrade(tradeId) {
    const accepted = await confirmAction("إغلاق الصفقة الورقية", "سيُستخدم سعر السوق الحي عند الإغلاق وتُحفظ النتيجة في التقرير.");
    if (!accepted) return;
    try {
      const result = await tradingPost("close_trade", { tradeId });
      app.state = result.state; app.version = result.version;
      await loadMarkets(app.state.selectedSymbol, true);
      showToast("تم إغلاق الصفقة وحفظ النتيجة.");
      render();
    } catch (error) { showToast(error.message, "error"); }
  }
  async function loadUsers() {
    app.usersLoading = true;
    render();
    try {
      const result = await request("/api/trading?action=users");
      app.users = result.users || [];
    } catch (error) { showToast(error.message, "error"); }
    finally { app.usersLoading = false; render(); }
  }
  async function updateUser(email, role, status) {
    try {
      const user = app.users.find((item) => item.email === email);
      const result = await tradingPost("update_user", { email, role, status, displayName: user?.displayName || email.split("@")[0] });
      app.users = result.users || [];
      showToast(status === "inactive" ? "تم إيقاف المستخدم." : "تم تفعيل المستخدم.");
      render();
    } catch (error) { showToast(error.message, "error"); }
  }
  async function resetPaper() {
    const accepted = await confirmAction("إعادة ضبط التداول الورقي", "سيتم حذف كل الصفقات والتحليلات الورقية وإعادة الرصيد إلى 25,000 دولار. لا يمكن التراجع.");
    if (!accepted) return;
    try {
      const result = await tradingPost("reset_paper");
      app.state = result.state; app.version = result.version;
      showToast("تمت إعادة ضبط حساب التداول الورقي.");
      render();
    } catch (error) { showToast(error.message, "error"); }
  }
  async function logout() {
    try { await authRequest("/api/auth/sign-out", {}); } catch {}
    app.profile = null; app.state = null; app.users = [];
    showLoggedOut();
  }
  function exportReport() {
    const trades = app.state.trades.filter((trade) => trade.status === "closed");
    if (!trades.length) return showToast("لا توجد صفقات مغلقة لتصديرها.", "error");
    const header = ["ID", "Symbol", "Side", "Amount USD", "Entry", "Exit", "PnL USD", "Opened At", "Closed At"];
    const rows = trades.map((trade) => [trade.id, trade.symbol, trade.side, trade.amount, trade.entryPrice, trade.exitPrice, trade.pnl, trade.openedAt, trade.closedAt]);
    const csv = "\ufeff" + [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `varex-trading-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("تم تصدير التقرير.");
  }

  init();
})();
