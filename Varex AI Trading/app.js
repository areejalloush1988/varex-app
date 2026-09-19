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
    executionMode: "paper",
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
    return ({ developer: "إدارة النظام", trader: "صلاحية تداول", viewer: "عرض فقط" })[role] || "حساب";
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
  function updatePasswordRules(value) {
    const password = String(value || ""), checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
    $$('[data-password-rule]').forEach((rule) => rule.classList.toggle("valid", Boolean(checks[rule.dataset.passwordRule])));
  }
  function togglePassword(button) {
    const input = button.closest(".password-field")?.querySelector("input");
    if (!input) return;
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "إخفاء" : "إظهار";
    button.setAttribute("aria-pressed", String(reveal));
    button.setAttribute("aria-label", reveal ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
    input.focus({ preventScroll: true });
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
      if (error.status === 401) return showLoggedOut("يلزم تسجيل الدخول للمتابعة.");
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
    $("#brokerNav").classList.toggle("hidden", !profile.canConnectBroker);
    updateExecutionUi();
    $("#dateLabel").textContent = new Date().toLocaleDateString("ar-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    document.documentElement.classList.toggle("compact-mode", app.state?.settings?.compactMode === true);
  }

  function updateExecutionUi() {
    const connected = app.broker?.connected === true;
    const liveReady = connected && app.broker?.liveTradingEnabled === true;
    $("#brokerLabel").textContent = app.broker?.label || "حساب التداول غير مربوط";
    $("#executionStatus").textContent = liveReady ? "LIVE READY" : "PAPER TRADING";
    $("#executionStatus").classList.toggle("live-ready", liveReady);
    $("#executionBanner").classList.toggle("live-ready", liveReady);
    if (liveReady) {
      $("#executionBannerTitle").textContent = "حساب Binance مربوط — كل صفقة حقيقية تحتاج تأكيداً يدوياً";
      $("#executionBannerText").textContent = "الإيداع والسحب يتمان من Binance فقط. VAREX لا يحتفظ بالأموال ولا يملك صلاحية نقلها.";
    } else if (connected) {
      $("#executionBannerTitle").textContent = "حساب Binance مربوط — التداول الحقيقي متوقف";
      $("#executionBannerText").textContent = "يمكن الاستمرار بالتداول الورقي أو تفعيل التنفيذ الحقيقي من شاشة حساب التداول.";
    } else {
      $("#executionBannerTitle").textContent = "التجربة الحالية ورقية وآمنة للتعلّم";
      $("#executionBannerText").textContent = "لا حاجة إلى ربط حساب تداول أو إيداع مال. الأسعار حية، لكن كل الصفقات تجريبية فقط.";
    }
  }

  function bindAuth() {
    document.addEventListener("click", (event) => {
      const passwordToggle = event.target.closest("[data-password-toggle]");
      if (passwordToggle) return togglePassword(passwordToggle);
      const switcher = event.target.closest("[data-auth-pane]");
      if (switcher) showAuthPane(switcher.dataset.authPane);
    });
    const registerPassword = $('#registerPane [name="password"]');
    registerPassword.addEventListener("input", () => updatePasswordRules(registerPassword.value));
    updatePasswordRules(registerPassword.value);
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
      const displayName = String(data.get("displayName") || "").trim(), email = String(data.get("email") || "").trim().toLowerCase(), password = String(data.get("password") || ""), confirmPassword = String(data.get("confirmPassword") || "");
      if (displayName.length < 2) return showAuthMessage("يلزم إدخال اسم مستخدم واضح.");
      if (!passwordStrong(password)) return showAuthMessage("كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص، و8 أحرف على الأقل.");
      if (password !== confirmPassword) return showAuthMessage("كلمتا المرور غير متطابقتين. يجب أن تكونا متطابقتين.");
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
      if (otp.length !== 6) return showAuthMessage("يلزم إدخال رمز من 6 أرقام.");
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
          showAuthMessage("تم تأكيد الحساب. تسجيل الدخول متاح الآن.", "success");
        }, "جاري تأكيد الحساب…");
      } catch {}
    });
    $("#resendOtp").addEventListener("click", async () => {
      if (!pendingAuth.email) return showAuthMessage("يلزم بدء العملية من جديد.");
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
          showAuthMessage("تم تحديث كلمة المرور. تسجيل الدخول متاح الآن.", "success");
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
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "logout") return logout();
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
    if (view === "broker" && !app.profile.canConnectBroker) return;
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
      dashboard: [`${greeting()}، ${app.profile.displayName}`, "اختيار عملة، تشغيل تحليل VAREX، ثم تجربة صفقة ورقية."],
      intelligence: ["فرص الذكاء", "تحليل احتمالي مبني على أسعار السوق الحية وحركة آخر 24 ساعة."],
      trades: ["الصفقات", "فتح وإغلاق صفقات ورقية أو تنفيذ أمر Spot حقيقي بعد تأكيد واضح."],
      risk: ["مركز المخاطر", "حدود حقيقية يطبقها الخادم قبل السماح بأي صفقة ورقية."],
      broker: ["حساب التداول", "ربط Binance Spot ومراجعة الرصيد والصلاحيات دون إتاحة السحب عبر VAREX."],
      watchlist: ["قائمة المراقبة", "اختيار الأسواق المطلوبة للمتابعة وحفظها في الحساب."],
      reports: ["التقارير", "نتائج محسوبة من صفقات حسابك المحفوظة فقط."],
      users: ["الحسابات", "إضافة الحسابات وتحديد صلاحية التداول أو العرض فقط."],
      settings: ["الإعدادات", "إدارة اسم المستخدم والتفضيلات وجلسة الحساب."],
    };
    const [title, subtitle] = map[app.view] || map.dashboard;
    $("#pageTitle").textContent = title;
    $("#pageSubtitle").textContent = subtitle;
    const actions = {
      dashboard: '<div class="panel-actions"><button class="primary-button" data-action="guided-analysis">✦ بدء التجربة</button><button class="small-button" data-action="refresh-markets">↻ تحديث الأسعار</button></div>',
      intelligence: '<button class="primary-button" data-action="analyze-current">✦ تحليل السوق المحدد</button>',
      reports: '<button class="primary-button" data-action="export-report">⇩ تصدير CSV</button>',
      broker: app.broker?.connected ? '<button class="primary-button" data-action="refresh-broker">↻ فحص الاتصال والرصيد</button>' : "",
    };
    $("#pageActions").innerHTML = actions[app.view] || "";
  }
  function render() {
    if (!app.state || !app.profile) return;
    document.documentElement.classList.toggle("compact-mode", app.state.settings.compactMode === true);
    headerForView();
    const renderers = { dashboard: renderDashboard, intelligence: renderIntelligence, trades: renderTrades, risk: renderRisk, broker: renderBroker, watchlist: renderWatchlist, reports: renderReports, users: renderUsers, settings: renderSettings };
    $("#viewRoot").innerHTML = (renderers[app.view] || renderDashboard)();
  }
  function statCard(icon, label, value, note, valueClass = "") {
    return `<article class="stat-card"><header><span>${escapeHtml(label)}</span><span class="stat-icon">${icon}</span></header><strong class="${valueClass}">${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }
  function marketTabs() {
    if (!app.markets.length) return "";
    return `<div class="market-tabs">${app.markets.map((market) => `<button class="${market.symbol === app.selectedMarket?.symbol ? "active" : ""}" data-market="${market.symbol}" aria-label="اختيار وتحليل ${escapeHtml(market.label)}">✦ ${escapeHtml(market.label)}</button>`).join("")}</div>`;
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
      <div class="market-summary"><div class="asset-title"><span class="coin">${escapeHtml(market.icon)}</span><span><b>${escapeHtml(market.label)}</b><small>${escapeHtml(market.name)} · ${escapeHtml(market.source || "مصدر سوق حي")}</small></span></div><div class="market-price"><b>${money(market.price)}</b><small class="${market.changePct >= 0 ? "positive" : "negative"}">${pct(market.changePct)}</small></div></div>
      <div class="chart-wrap">${chartSvg(market)}</div>
      <div class="market-details"><span><small>افتتاح 24 س</small><b>${money(market.open)}</b></span><span><small>أعلى سعر</small><b>${money(market.high)}</b></span><span><small>أدنى سعر</small><b>${money(market.low)}</b></span><span><small>الحجم التقديري</small><b>${compactMoney(market.volumeUsd)}</b></span></div>
    </article>`;
  }
  function renderRecentTrades(limit = 5) {
    const trades = app.state.trades.slice(0, limit);
    if (!trades.length) return '<div class="empty"><span>▣</span><p>لا توجد صفقات بعد. يمكن فتح أول صفقة ورقية من بطاقة التنفيذ.</p></div>';
    return `<div class="list">${trades.map((trade) => `<div class="list-row"><span><strong>${escapeHtml(trade.symbol)}</strong><small class="muted"> · ${localDate(trade.openedAt, true)}</small></span><span class="badge ${trade.side}">${directionLabel(trade.side)}</span><span class="${trade.status === "closed" ? (trade.pnl >= 0 ? "positive" : "negative") : "muted"}">${trade.status === "closed" ? money(trade.pnl) : "مفتوحة"}</span><button class="small-button" data-view="trades">التفاصيل</button></div>`).join("")}</div>`;
  }
  function tradeTicket() {
    const canTrade = app.profile.canTrade, marketOptions = app.markets.map((market) => `<option value="${market.symbol}" ${market.symbol === app.state.selectedSymbol ? "selected" : ""}>${market.label}</option>`).join("");
    const selected = getMarket(app.state.selectedSymbol) || app.selectedMarket;
    const liveReady = app.profile.canConnectBroker && app.broker?.connected && app.broker?.liveTradingEnabled;
    if (!liveReady && app.executionMode === "live") app.executionMode = "paper";
    const liveMode = liveReady && app.executionMode === "live";
    const modePicker = app.profile.canConnectBroker ? `<div class="execution-picker"><button type="button" class="${!liveMode ? "active" : ""}" data-execution-mode="paper">تداول ورقي</button>${liveReady ? `<button type="button" class="${liveMode ? "active live" : ""}" data-execution-mode="live">تداول حقيقي</button>` : '<button type="button" data-view="broker">إعداد التداول الحقيقي</button>'}</div>` : "";
    return `<article class="panel ${liveMode ? "live-ticket" : ""}"><header class="panel-head"><div><h2>${liveMode ? "تنفيذ صفقة حقيقية" : "فتح صفقة ورقية"}</h2><p>${liveMode ? "يُرسل أمر MARKET إلى Binance Spot بعد تأكيد مستقل." : "السعر يؤخذ من السوق عند تأكيد الطلب."}</p></div><span class="badge ${liveMode ? "live" : "pending"}">${liveMode ? "LIVE" : "PAPER"}</span></header>
      ${canTrade ? `<form class="trade-ticket" id="tradeForm">
        ${modePicker}
        <label class="control">السوق<select name="symbol">${marketOptions}</select></label>
        <div class="side-picker"><button type="button" class="${app.tradeSide === "buy" ? "active" : ""}" data-side="buy">↗ شراء</button><button type="button" class="${app.tradeSide === "sell" ? "active" : ""}" data-side="sell">↘ بيع</button></div>
        <label class="control">${liveMode ? "قيمة الأمر بـ USDT" : "حجم الصفقة بالدولار"}<input name="amount" type="number" min="25" max="${liveMode ? Number(app.broker.maxLiveOrderUsd || 100) : "6250"}" step="25" value="${liveMode ? Math.min(100, Number(app.broker.maxLiveOrderUsd || 100)) : 500}" required></label>
        <div class="trade-summary"><p><span>السعر المعروض</span><b>${selected ? money(selected.price) : "يؤخذ عند التنفيذ"}</b></p>${liveMode ? `<p><span>حد الأمر الحقيقي</span><b>${money(app.broker.maxLiveOrderUsd)}</b></p><p><span>رصيد USDT المتاح</span><b>${money(app.broker.availableUsdt)}</b></p>` : `<p><span>حد الصفقات المفتوحة</span><b>${app.state.risk.maxOpenTrades}</b></p><p><span>المخاطرة لكل صفقة</span><b>${app.state.risk.riskPerTradePct}%</b></p>`}</div>
        ${liveMode ? '<div class="live-warning">صفقة حقيقية بأموال موجودة في Binance. لا يوجد ضمان للربح، ولا يمكن لـ VAREX سحب الأموال.</div>' : ""}
        <button class="primary-button" type="submit">${liveMode ? `مراجعة أمر ${app.tradeSide === "buy" ? "شراء" : "بيع"} حقيقي` : `فتح صفقة ${app.tradeSide === "buy" ? "شراء" : "بيع"} ورقية`}</button>
      </form>` : '<div class="notice">صلاحية هذا الحساب للعرض فقط. يمكن لإدارة النظام تغييرها من شاشة الحسابات.</div>'}
    </article>`;
  }
  function renderDashboard() {
    const metrics = accountMetrics(), dailyRisk = metrics.todayPnl < 0 && metrics.balance ? Math.abs(metrics.todayPnl) / metrics.balance * 100 : 0;
    return `<section class="trial-guide"><div><span class="eyebrow">تجربة بدون أموال حقيقية</span><h2>بدء أول تجربة تداول</h2><p>لا حاجة إلى وسيط في هذه المرحلة. يقرأ VAREX السوق الحي ويعرض قراراً احتمالياً، ثم يتم تأكيد الصفقة الورقية يدوياً.</p></div><ol class="trial-steps"><li><b>1</b><span>اختيار عملة</span></li><li><b>2</b><span>تشغيل تحليل VAREX</span></li><li><b>3</b><span>فتح صفقة ورقية</span></li></ol><button class="primary-button" data-action="guided-analysis">✦ تحليل ${escapeHtml(app.selectedMarket?.label || "BTC / USD")} الآن</button></section>
    <section class="stats-grid">
      ${statCard("▣", "الرصيد الورقي", money(metrics.balance), "الرصيد المحفوظ في حسابك")}
      ${statCard("$", "صافي اليوم", money(metrics.todayPnl), metrics.closed.length ? "من الصفقات المغلقة اليوم" : "لا توجد صفقات مغلقة اليوم", metrics.todayPnl >= 0 ? "positive" : "negative")}
      ${statCard("⌁", "صفقات مفتوحة", String(metrics.open.length), `الحد المسموح ${app.state.risk.maxOpenTrades}`)}
      ${statCard("◇", "استخدام حد الخسارة", `${dailyRisk.toFixed(2)}%`, `من حد يومي ${app.state.risk.maxDailyLossPct}%`, dailyRisk >= app.state.risk.maxDailyLossPct ? "negative" : "")}
    </section>
    <section class="content-grid">${marketPanel()}${tradeTicket()}</section>
    <section class="panel"><header class="panel-head"><div><h2>آخر الصفقات</h2><p>بيانات فعلية من سجل حسابك الورقي.</p></div><button class="small-button" data-view="trades">عرض الكل</button></header>${renderRecentTrades()}</section>`;
  }

  function analysisCard(analysis) {
    if (!analysis) return '<div class="empty"><span>✦</span><p>لا يوجد تحليل بعد. يبدأ التحليل بعد اختيار سوق والضغط على «تحليل».</p></div>';
    const colorClass = analysis.direction === "wait" ? "muted" : analysis.direction === "buy" ? "positive" : "negative";
    return `<div class="signal-card"><div class="signal-main"><small>${escapeHtml(analysis.symbol)} · ${localDate(analysis.createdAt, true)}</small><strong class="${colorClass}">${directionLabel(analysis.direction)}</strong><span class="muted">المحرك: ${escapeHtml(analysis.engine || "VAREX")}</span></div><span class="score-ring" style="--score:${Number(analysis.confidence || 0) * 3.6}deg"><b>${Number(analysis.confidence || 0)}%</b></span></div>
      <ul class="reasons">${(analysis.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      <div class="level-grid"><span><small>سعر التحليل</small><b>${money(analysis.price)}</b></span><span><small>الهدف الاحتمالي</small><b class="positive">${money(analysis.target)}</b></span><span><small>وقف مقترح</small><b class="negative">${money(analysis.stop)}</b></span></div>
      <p class="notice">${escapeHtml(analysis.disclaimer || "التحليل احتمالي وليس ضماناً للربح.")}</p>
      ${analysis.direction === "wait" ? '<div class="analysis-next wait"><div><b>قرار VAREX الآن: الانتظار</b><small>لا يفتح النظام صفقة عندما لا يرى إشارة دخول كافية. يمكن اختيار عملة ثانية وتشغيل تحليل جديد.</small></div><button class="secondary-button" data-view="dashboard">اختيار عملة أخرى</button></div>' : `<div class="analysis-next"><div><b>الخطوة التالية</b><small>يمكن استخدام نتيجة التحليل لتهيئة صفقة ورقية؛ لن يُخصم أي مال حقيقي.</small></div><button class="primary-button" data-use-analysis="${escapeHtml(analysis.symbol)}" data-side="${analysis.direction}">استخدام النتيجة وفتح صفقة ${directionLabel(analysis.direction)} تجريبية</button></div>`}`;
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
      ${statCard("⌁", "استهلاك الحد اليومي", `${used.toFixed(2)}%`, lossToday ? money(lossToday) : "لا توجد خسارة محققة", used >= app.state.risk.maxDailyLossPct ? "negative" : "positive")}
      ${statCard("▣", "حد الصفقات", String(app.state.risk.maxOpenTrades), `${metrics.open.length} مفتوحة حالياً`)}
      ${statCard("%", "مخاطرة الصفقة", `${app.state.risk.riskPerTradePct}%`, "من الرصيد الورقي")}
    </section>
    <section class="content-grid equal-grid"><form class="panel" id="riskForm"><header class="panel-head"><div><h2>حدود المخاطر</h2><p>تُحفظ وتُطبق فوراً.</p></div></header><div class="form-grid">
      <label class="control">حد الخسارة اليومي %<input name="maxDailyLossPct" type="number" min=".5" max="20" step=".5" value="${app.state.risk.maxDailyLossPct}"></label>
      <label class="control">أقصى صفقات مفتوحة<input name="maxOpenTrades" type="number" min="1" max="10" step="1" value="${app.state.risk.maxOpenTrades}"></label>
      <label class="control">مخاطرة الصفقة %<input name="riskPerTradePct" type="number" min=".25" max="5" step=".25" value="${app.state.risk.riskPerTradePct}"></label>
    </div><div class="toggle-row"><p><b>تحديد وقف خسارة</b><small>يحفظ مستوى وقف محسوباً مع كل صفقة جديدة</small></p><button type="button" class="switch ${app.state.risk.autoStop ? "on" : ""}" data-toggle-risk="autoStop"><i></i></button></div><button class="primary-button" type="submit">حفظ حدود المخاطر</button></form>
      <article class="panel"><header class="panel-head"><div><h2>حالة الحماية</h2><p>ملخص القرارات الحالية.</p></div></header><div class="notice">حد الخسارة وعدد الصفقات وحجم الصفقة تُفحص على الخادم في التداول الورقي. التداول الحقيقي يطبق حد الأمر المضبوط في شاشة حساب التداول.</div><div class="toggle-row"><p><b>القدرة على التداول</b><small>حسب صلاحية الحساب</small></p><span class="badge ${app.profile.canTrade ? "active" : "inactive"}">${app.profile.canTrade ? "مسموح" : "عرض فقط"}</span></div><div class="toggle-row"><p><b>حساب Binance</b><small>الربط متاح لحساب الإدارة فقط</small></p><span class="badge ${app.broker?.connected ? "active" : "pending"}">${app.broker?.connected ? "مربوط" : "غير مربوط"}</span></div></article></section>`;
  }

  function balanceAmount(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(number);
  }

  function permissionBadge(enabled, safeWhenDisabled = false) {
    const safe = safeWhenDisabled ? !enabled : enabled;
    return `<span class="badge ${safe ? "active" : "inactive"}">${enabled ? "مفعّلة" : "متوقفة"}</span>`;
  }

  function liveOrderStatus(status) {
    return ({ filled: "منفّذ", submitted: "مُرسل", pending: "قيد الإرسال", rejected: "مرفوض", unknown: "تحتاج مراجعة" })[status] || status;
  }

  function renderBroker() {
    if (!app.profile.canConnectBroker) return '<div class="notice">ربط حساب التداول الحقيقي متاح لحساب الإدارة الأساسي فقط. بقية الحسابات تعمل بالتداول الورقي.</div>';
    const flow = `<section class="money-flow"><article><span>1</span><div><b>الإيداع</b><small>داخل Binance من حساب موثّق</small></div></article><i>←</i><article><span>2</span><div><b>التداول</b><small>VAREX يرسل أوامر Spot فقط</small></div></article><i>←</i><article><span>3</span><div><b>السحب</b><small>داخل Binance فقط</small></div></article></section>`;
    if (!app.broker?.connected) {
      return `${flow}<section class="content-grid equal-grid"><form class="panel broker-form" id="brokerConnectForm"><header class="panel-head"><div><span class="eyebrow">الموصل الأول</span><h2>ربط Binance Spot</h2><p>اختبار الصلاحيات أولاً ثم حفظ المفتاح مشفراً على الخادم.</p></div><span class="provider-logo">B</span></header>
        <label class="control">اسم الحساب داخل VAREX<input name="accountLabel" maxlength="80" value="حساب Binance Spot" required></label>
        <label class="control">API Key<span class="password-field"><input name="apiKey" type="password" autocomplete="off" spellcheck="false" dir="ltr" required><button class="password-toggle" type="button" data-password-toggle aria-label="إظهار API Key" aria-pressed="false">إظهار</button></span></label>
        <label class="control">Secret Key<span class="password-field"><input name="apiSecret" type="password" autocomplete="off" spellcheck="false" dir="ltr" required><button class="password-toggle" type="button" data-password-toggle aria-label="إظهار Secret Key" aria-pressed="false">إظهار</button></span></label>
        <label class="check security-check"><input name="fundsAtProvider" type="checkbox" required><span>تأكيد بقاء الإيداع والسحب داخل Binance وعدم مشاركة المفتاح خارج هذه الخانة.</span></label>
        <button class="primary-button" type="submit">اختبار الصلاحيات وربط الحساب</button>
      </form><article class="panel"><header class="panel-head"><div><h2>الصلاحيات المطلوبة</h2><p>يرفض VAREX المفتاح عند وجود صلاحية مالية زائدة.</p></div></header><div class="permission-list"><p><span>Reading</span><b class="positive">مطلوبة</b></p><p><span>Spot Trading</span><b class="positive">مطلوبة</b></p><p><span>Withdrawals</span><b class="negative">يجب تعطيلها</b></p><p><span>Internal / Universal Transfer</span><b class="negative">يجب تعطيلها</b></p><p><span>Margin / Futures / Options</span><b class="negative">يجب تعطيلها</b></p></div><div class="notice">إنشاء المفتاح يتم من صفحة API Management في Binance. لا يتم وضع أي عنوان سحب أو محفظة داخل VAREX.</div><div class="external-links"><a class="secondary-button" href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noopener noreferrer">صفحة مفاتيح Binance ↗</a><a class="small-button" href="https://www.vara.ae/en/licenses-and-register/public-register/" target="_blank" rel="noopener noreferrer">سجل VARA العام ↗</a></div></article></section>`;
    }

    const permissions = app.broker.permissions || {};
    const balances = (app.broker.balances || []).map((balance) => `<tr><td><b dir="ltr">${escapeHtml(balance.asset)}</b></td><td dir="ltr">${balanceAmount(balance.free)}</td><td dir="ltr">${balanceAmount(balance.locked)}</td><td dir="ltr">${balanceAmount(balance.total)}</td></tr>`).join("");
    const orders = (app.broker.orders || []).map((order) => `<tr><td dir="ltr">${escapeHtml(order.symbol)}</td><td>${directionLabel(order.side)}</td><td dir="ltr">${money(Number(order.quoteAmountCents || 0) / 100)}</td><td><span class="badge ${order.status === "filled" ? "active" : order.status === "rejected" || order.status === "unknown" ? "inactive" : "pending"}">${liveOrderStatus(order.status)}</span></td><td dir="ltr">${escapeHtml(order.providerOrderId || "—")}</td><td>${localDate(order.requestedAt, true)}</td></tr>`).join("");
    return `${flow}<section class="stats-grid">
      ${statCard("B", "حالة الاتصال", app.broker.status === "connected" ? "متصل" : "يحتاج فحصاً", app.broker.accountLabel, app.broker.status === "connected" ? "positive" : "negative")}
      ${statCard("$", "USDT المتاح", money(app.broker.availableUsdt), "رصيد Spot الحر في Binance")}
      ${statCard("◇", "التداول الحقيقي", app.broker.liveTradingEnabled ? "مفعّل" : "متوقف", "تأكيد يدوي مطلوب لكل صفقة", app.broker.liveTradingEnabled ? "positive" : "")}
      ${statCard("⇄", "حد الأمر", money(app.broker.maxLiveOrderUsd), "يمكن ضبطه قبل التفعيل")}
    </section><section class="content-grid equal-grid"><article class="panel"><header class="panel-head"><div><h2>تفاصيل الربط</h2><p>${escapeHtml(app.broker.providerLabel || "Binance Spot")} · المفتاح المنتهي بـ ${escapeHtml(app.broker.keyFingerprint || "—")}</p></div><span class="badge ${app.broker.status === "connected" ? "active" : "inactive"}">${app.broker.status === "connected" ? "آمن" : "خطأ"}</span></header>
      <div class="permission-list"><p><span>القراءة</span>${permissionBadge(permissions.reading)}</p><p><span>Spot Trading</span>${permissionBadge(permissions.spotTrading)}</p><p><span>السحب</span>${permissionBadge(permissions.withdrawals, true)}</p><p><span>نقل الأموال</span>${permissionBadge(Boolean(permissions.internalTransfer || permissions.universalTransfer), true)}</p><p><span>Margin / Futures / Options</span>${permissionBadge(Boolean(permissions.margin || permissions.futures || permissions.options || permissions.portfolioMargin), true)}</p></div>
      <div class="notice">آخر فحص: ${localDate(app.broker.lastCheckedAt, true)}. مفاتيح الربط لا تظهر مجدداً بعد الحفظ.</div>${app.broker.lastError ? `<div class="live-warning">${escapeHtml(app.broker.lastError)}</div>` : ""}
      <div class="panel-actions broker-actions"><button class="secondary-button" data-action="refresh-broker">فحص الاتصال</button><button class="danger-button" data-action="disconnect-broker">فصل الحساب</button></div></article>
      <form class="panel" id="liveConfigForm"><header class="panel-head"><div><h2>ضبط التداول الحقيقي</h2><p>التنفيذ يبقى يدوياً؛ لا توجد أوامر تلقائية أثناء النوم.</p></div><span class="badge ${app.broker.liveTradingEnabled ? "active" : "pending"}">${app.broker.liveTradingEnabled ? "LIVE READY" : "متوقف"}</span></header>
        <label class="control">الحد الأعلى لكل أمر بالدولار<input name="maxLiveOrderUsd" type="number" min="25" max="10000" step="25" value="${Number(app.broker.maxLiveOrderUsd || 100)}" required></label>
        <label class="check security-check"><input name="enableLive" type="checkbox" ${app.broker.liveTradingEnabled ? "checked" : ""}><span>تفعيل إرسال أوامر حقيقية إلى Binance بعد نافذة تأكيد مستقلة لكل أمر.</span></label>
        <div class="live-warning">الذكاء الاصطناعي يعرض تحليلاً احتمالياً ولا يضمن الربح. مفتاح السحب غير مقبول، لكن خسارة التداول نفسها تبقى ممكنة.</div>
        <button class="primary-button" type="submit">حفظ حالة التداول الحقيقي</button>
      </form></section>
      <section class="panel"><header class="panel-head"><div><h2>أرصدة Binance Spot</h2><p>عرض فقط. الإيداع والسحب من تطبيق Binance.</p></div><a class="small-button" href="https://www.binance.com/en/my/wallet/account/main/deposit/crypto" target="_blank" rel="noopener noreferrer">فتح Binance ↗</a></header><div class="table-wrap">${balances ? `<table class="data-table"><thead><tr><th>الأصل</th><th>متاح</th><th>محجوز</th><th>الإجمالي</th></tr></thead><tbody>${balances}</tbody></table>` : '<div class="empty"><p>لا يوجد رصيد ظاهر في Spot حالياً.</p></div>'}</div></section>
      <section class="panel"><header class="panel-head"><div><h2>سجل الأوامر الحقيقية</h2><p>سجل تدقيق لأوامر Binance المرسلة من VAREX.</p></div></header><div class="table-wrap">${orders ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>القيمة</th><th>الحالة</th><th>رقم Binance</th><th>الوقت</th></tr></thead><tbody>${orders}</tbody></table>` : '<div class="empty"><p>لا توجد أوامر حقيقية بعد.</p></div>'}</div></section>`;
  }

  function renderWatchlist() {
    const cards = app.supportedMarkets.map((item) => {
      const market = getMarket(item.symbol), checked = app.state.watchlist.includes(item.symbol);
      return `<label class="watch-card"><input type="checkbox" name="symbols" value="${item.symbol}" ${checked ? "checked" : ""}><span class="coin">${escapeHtml(item.icon)}</span><p><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.name)}</small></p><span><b>${market ? money(market.price) : "—"}</b><small class="${market?.changePct >= 0 ? "positive" : "negative"}">${market ? pct(market.changePct) : "غير متاح"}</small></span></label>`;
    }).join("");
    return `<form class="panel" id="watchlistForm"><header class="panel-head"><div><h2>الأسواق المتاحة</h2><p>يجب اختيار سوق واحد على الأقل.</p></div><button class="primary-button" type="submit">حفظ القائمة</button></header><div class="watch-grid">${cards}</div></form>`;
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
    if (!app.profile.canManageUsers) return '<div class="notice">هذه الشاشة متاحة لحساب الإدارة فقط.</div>';
    if (app.usersLoading) return '<section class="panel"><div class="empty"><span class="loader"></span><p>جاري تحميل الحسابات…</p></div></section>';
    const cards = app.users.map((user) => {
      const developer = user.role === "developer", status = user.pending ? "pending" : user.status;
      return `<div class="user-card" data-user-row="${escapeHtml(user.email)}"><p><b>${escapeHtml(user.displayName)}</b><small dir="ltr">${escapeHtml(user.email)}</small></p><aside><span class="badge ${status}">${status === "pending" ? "بانتظار التسجيل" : status === "active" ? "نشط" : "متوقف"}</span>${developer ? '<span class="badge active">إدارة</span>' : `<select class="small-button user-role"><option value="trader" ${user.role === "trader" ? "selected" : ""}>صلاحية تداول</option><option value="viewer" ${user.role === "viewer" ? "selected" : ""}>عرض فقط</option></select><button class="small-button" data-user-save="${escapeHtml(user.email)}" data-status="${status === "inactive" || status === "revoked" ? "active" : "inactive"}">${status === "inactive" || status === "revoked" ? "تفعيل" : "إيقاف"}</button>`}</aside></div>`;
    }).join("");
    return `<section class="content-grid"><form class="panel" id="inviteForm"><header class="panel-head"><div><h2>إضافة حساب</h2><p>يُنشأ الحساب من الرابط نفسه باستخدام البريد المضاف.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" required maxlength="80" placeholder="مثال: إدارة الاستثمار"></label><label class="control">البريد الإلكتروني<input name="email" type="email" required placeholder="user@example.com"></label><label class="control">الصلاحية<select name="role"><option value="trader">صلاحية تداول — فتح وإغلاق صفقات ورقية</option><option value="viewer">عرض فقط — قراءة فقط</option></select></label></div><button class="primary-button" type="submit">إضافة الحساب</button></form><article class="panel"><header class="panel-head"><div><h2>طريقة الدخول</h2><p>خطوات تفعيل الحساب المضاف.</p></div></header><div class="notice">يتم إرسال رابط التطبيق إلى البريد المضاف، ثم إنشاء الحساب بالبريد نفسه وتأكيد رمز OTP لتظهر الصلاحيات تلقائياً.</div></article></section><section class="panel"><header class="panel-head"><div><h2>قائمة الحسابات</h2><p>${app.users.length} حساباً أو دعوة.</p></div><button class="small-button" data-action="reload-users">تحديث</button></header>${cards || '<div class="empty"><p>لا توجد حسابات بعد.</p></div>'}</section>`;
  }

  function renderSettings() {
    const settings = app.state.settings;
    return `<section class="settings-stack"><form class="panel" id="profileForm"><header class="panel-head"><div><h2>بيانات الحساب</h2><p>يظهر اسم المستخدم في التحية والقائمة.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" value="${escapeHtml(app.profile.displayName)}" maxlength="80" required></label><label class="control">البريد الإلكتروني<input value="${escapeHtml(app.profile.email)}" disabled dir="ltr"></label></div><button class="primary-button" type="submit">حفظ اسم المستخدم</button></form>
      <form class="panel" id="settingsForm"><header class="panel-head"><div><h2>تفضيلات الواجهة</h2><p>محفوظة في حسابك على قاعدة البيانات.</p></div></header><div class="form-grid"><label class="control">المنطقة الزمنية<select name="timezone"><option value="Asia/Dubai" ${settings.timezone === "Asia/Dubai" ? "selected" : ""}>الإمارات — دبي</option><option value="Asia/Riyadh" ${settings.timezone === "Asia/Riyadh" ? "selected" : ""}>السعودية — الرياض</option><option value="UTC" ${settings.timezone === "UTC" ? "selected" : ""}>UTC</option></select></label></div><div class="toggle-row"><p><b>إشعارات داخل التطبيق</b><small>إظهار تنبيهات نجاح العمليات وأخطاء السوق</small></p><button type="button" class="switch ${settings.notifications ? "on" : ""}" data-toggle-setting="notifications"><i></i></button></div><div class="toggle-row"><p><b>الوضع المضغوط</b><small>جاهز للاستخدام في تحديث واجهة لاحق</small></p><button type="button" class="switch ${settings.compactMode ? "on" : ""}" data-toggle-setting="compactMode"><i></i></button></div><button class="primary-button" type="submit">حفظ التفضيلات</button></form>
      ${app.profile.canTrade ? '<article class="panel danger-zone"><header class="panel-head"><div><h2>إعادة ضبط التداول الورقي</h2><p>يحذف الصفقات والتحليلات ويعيد الرصيد إلى 25,000 دولار. لا يحذف الحساب أو الحسابات المضافة.</p></div></header><button class="danger-button" data-action="reset-paper">إعادة الضبط</button></article>' : ""}
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
        await runAnalysis(marketButton.dataset.market);
      } catch (error) { showToast(error.message, "error"); }
      return;
    }
    const useAnalysis = event.target.closest("[data-use-analysis]");
    if (useAnalysis) {
      app.tradeSide = useAnalysis.dataset.side === "sell" ? "sell" : "buy";
      return goTo("trades");
    }
    const executionMode = event.target.closest("[data-execution-mode]");
    if (executionMode) { app.executionMode = executionMode.dataset.executionMode === "live" ? "live" : "paper"; render(); return; }
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
    if (action === "guided-analysis") return runAnalysis(app.state.selectedSymbol || app.selectedMarket?.symbol || "BTC-USD");
    if (action === "analyze-current") return runAnalysis(app.state.selectedSymbol);
    if (action === "export-report") return exportReport();
    if (action === "reload-users") return loadUsers();
    if (action === "refresh-broker") return refreshBroker();
    if (action === "disconnect-broker") return disconnectBroker();
    if (action === "logout") return logout();
    if (action === "reset-paper") return resetPaper();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target, data = new FormData(form), submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.id === "tradeForm") {
        const symbol = String(data.get("symbol")), amount = Number(data.get("amount"));
        if (app.executionMode === "live") {
          const accepted = await confirmAction("تأكيد صفقة حقيقية", `سيتم إرسال أمر ${app.tradeSide === "buy" ? "شراء" : "بيع"} MARKET حقيقي بقيمة ${money(amount)} إلى Binance Spot. التداول قد يحقق خسارة، ولا توجد إعادة تلقائية عند انقطاع الاتصال.`);
          if (!accepted) return;
          const result = await tradingPost("place_live_order", { symbol, side: app.tradeSide, amount, clientRequestId: crypto.randomUUID(), confirmation: "LIVE_ORDER_CONFIRMED" });
          app.broker = result.broker;
          updateExecutionUi();
          showToast("تم إرسال الأمر الحقيقي إلى Binance وحفظ نتيجة التنفيذ.");
          goTo("broker");
        } else {
          const result = await tradingPost("open_trade", { symbol, side: app.tradeSide, amount });
          app.state = result.state; app.version = result.version;
          await loadMarkets(app.state.selectedSymbol, true);
          showToast("تم فتح الصفقة الورقية. لم يُخصم أي مال حقيقي.");
          goTo("trades");
        }
      } else if (form.id === "riskForm") {
        const risk = { ...app.state.risk, maxDailyLossPct: Number(data.get("maxDailyLossPct")), maxOpenTrades: Number(data.get("maxOpenTrades")), riskPerTradePct: Number(data.get("riskPerTradePct")) };
        const result = await tradingPost("save_preferences", { risk });
        app.state = result.state; app.version = result.version;
        showToast("تم حفظ حدود المخاطر وتفعيلها.");
        render();
      } else if (form.id === "watchlistForm") {
        const watchlist = data.getAll("symbols").map(String);
        if (!watchlist.length) throw new Error("يجب اختيار سوق واحد على الأقل.");
        const result = await tradingPost("save_preferences", { watchlist });
        app.state = result.state; app.version = result.version;
        showToast("تم حفظ قائمة المراقبة.");
        render();
      } else if (form.id === "inviteForm") {
        const result = await tradingPost("invite_user", { displayName: String(data.get("displayName")), email: String(data.get("email")), role: String(data.get("role")) });
        app.users = result.users || [];
        form.reset();
        showToast("تمت إضافة الحساب. أصبح إنشاء الحساب بالبريد نفسه متاحاً.");
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
      } else if (form.id === "brokerConnectForm") {
        const result = await tradingPost("connect_broker", {
          provider: "binance",
          accountLabel: String(data.get("accountLabel")),
          apiKey: String(data.get("apiKey")),
          apiSecret: String(data.get("apiSecret")),
          fundsAtProvider: Boolean(data.get("fundsAtProvider")),
        });
        app.broker = result.broker;
        app.executionMode = "paper";
        form.reset();
        updateExecutionUi();
        showToast("تم اختبار الصلاحيات وربط حساب Binance. التداول الحقيقي ما زال متوقفاً.");
        render();
      } else if (form.id === "liveConfigForm") {
        const enabled = Boolean(data.get("enableLive"));
        if (enabled && !app.broker.liveTradingEnabled) {
          const accepted = await confirmAction("تفعيل التداول الحقيقي", "سيصبح إرسال أوامر Spot حقيقية متاحاً، مع بقاء تأكيد مستقل مطلوب لكل صفقة. الإيداع والسحب يبقيان داخل Binance.");
          if (!accepted) return;
        }
        const result = await tradingPost("configure_live_trading", {
          enabled,
          maxLiveOrderUsd: Number(data.get("maxLiveOrderUsd")),
          confirmation: enabled ? "ENABLE_LIVE_SPOT" : "DISABLE_LIVE_SPOT",
        });
        app.broker = result.broker;
        if (!enabled) app.executionMode = "paper";
        updateExecutionUi();
        showToast(enabled ? "تم تفعيل التداول الحقيقي مع تأكيد يدوي لكل صفقة." : "تم إيقاف التداول الحقيقي.");
        render();
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function runAnalysis(symbol) {
    const buttons = $$("[data-analyze], [data-market], [data-action=analyze-current], [data-action=guided-analysis]");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await tradingPost("analyze", { symbol });
      app.state = result.state; app.version = result.version;
      await loadMarkets(symbol, true);
      showToast("اكتمل تحليل VAREX. يمكن مراجعة القرار واختيار الخطوة التالية.");
      goTo("intelligence");
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
  async function refreshBroker() {
    const buttons = $$('[data-action="refresh-broker"]');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await tradingPost("refresh_broker");
      app.broker = result.broker;
      updateExecutionUi();
      showToast("تم فحص صلاحيات Binance وتحديث الأرصدة.");
      render();
    } catch (error) {
      showToast(error.message, "error");
      try {
        const bootstrap = await request("/api/trading");
        app.broker = bootstrap.broker;
        updateExecutionUi();
        render();
      } catch {}
    } finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
  async function disconnectBroker() {
    const accepted = await confirmAction("فصل حساب Binance", "سيتم حذف مفاتيح الربط المشفرة من VAREX وإيقاف التداول الحقيقي. الأموال والأوامر السابقة تبقى داخل Binance.");
    if (!accepted) return;
    try {
      const result = await tradingPost("disconnect_broker", { confirmation: "DISCONNECT_BROKER" });
      app.broker = result.broker;
      app.executionMode = "paper";
      updateExecutionUi();
      showToast("تم فصل حساب Binance وحذف بيانات الربط المشفرة.");
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
      showToast(status === "inactive" ? "تم إيقاف الحساب." : "تم تفعيل الحساب.");
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
    app.profile = null; app.state = null; app.broker = null; app.users = []; app.executionMode = "paper";
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
