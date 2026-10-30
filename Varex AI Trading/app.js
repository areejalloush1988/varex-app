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
    formDrafts: {},
    userRoleDrafts: {},
    exploreSymbol: "",
    exploreInterval: "60",
    accountChoice: "demo",
    brokerProvider: "capital",
    brokerQuery: "",
    brokerFormOpen: false,
    automation: null,
    automationLoading: false,
    automationError: "",
  };
  let marketWorkspace = null;
  let entryDestination = null;
  let automationRequest = null;
  let automationMutationPending = false;
  let pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
  let toastTimer = 0;
  let confirmResolve = null;
  let marketRequestId = 0;
  let marketRequest = null;
  let marketRefreshTimer = 0;
  const MARKET_REFRESH_MS = 30_000;
  const pendingForms = new Set();
  const draftFields = {
    tradeForm: ["symbol", "amount"],
    riskForm: ["maxDailyLossPct", "maxOpenTrades", "riskPerTradePct"],
    settingsForm: ["timezone"],
    profileForm: ["displayName"],
    watchlistForm: ["symbols"],
    automationForm: ["symbol", "interval", "riskPercent", "maxDailyTrades", "enableAutomation"],
  };

  function formDraft(id, defaults = {}) {
    return { ...defaults, ...app.formDrafts[id] };
  }
  function rememberFormField(event) {
    const field = event.target, form = field.closest("form");
    if (!form || !draftFields[form.id]?.includes(field.name)) return;
    if (form.id === "watchlistForm") {
      app.formDrafts.watchlistForm = { symbols: new FormData(form).getAll("symbols").map(String) };
      return;
    }
    const key = form.id === "tradeForm" && field.name === "amount" ? `${app.executionMode}Amount` : field.name;
    app.formDrafts[form.id] = { ...app.formDrafts[form.id], [key]: field.type === "checkbox" ? field.checked === true : field.value };
  }
  async function handleFormChange(event) {
    rememberFormField(event);
    const field = event.target, form = field.closest("form");
    if (field.matches?.(".user-role")) {
      const email = field.closest("[data-user-row]")?.dataset.userRow;
      if (email) app.userRoleDrafts[email] = field.value;
    }
    if (form?.id !== "tradeForm" || field.name !== "symbol") return;
    const symbol = field.value;
    render();
    await loadMarkets(symbol);
    if (app.profile && formDraft("tradeForm", { symbol: app.state.selectedSymbol }).symbol === symbol) render();
  }
  function currentSymbol() {
    return formDraft("tradeForm", { symbol: app.state?.selectedSymbol }).symbol || app.selectedMarket?.symbol || "BTC-USD";
  }
  function displayTimeZone() {
    const timezone = app.state?.settings?.timezone;
    return ["Asia/Dubai", "Asia/Riyadh", "UTC"].includes(timezone) ? timezone : "Asia/Dubai";
  }
  function stopMarketRefresh() {
    clearTimeout(marketRefreshTimer);
    marketRefreshTimer = 0;
  }
  function scheduleMarketRefresh() {
    stopMarketRefresh();
    if (!app.profile || !app.state || document.visibilityState === "hidden" || marketRequest) return;
    marketRefreshTimer = setTimeout(async () => {
      marketRefreshTimer = 0;
      if (!app.profile || !app.state || document.visibilityState === "hidden") return;
      await loadMarkets(currentSymbol(), true);
      if (!app.profile || document.visibilityState === "hidden") return;
      // These views contain market data. Other pages may contain unsubmitted broker credentials.
      if (!["dashboard", "trades", "risk", "watchlist", "reports"].includes(app.view)) return;
      const focused = document.activeElement;
      const formId = focused?.closest?.("form")?.id;
      const fieldName = focused?.name;
      const selection = typeof focused?.selectionStart === "number" ? [focused.selectionStart, focused.selectionEnd] : null;
      render();
      if (draftFields[formId]?.includes(fieldName)) {
        const replacement = $(`#${formId} [name="${fieldName}"]`);
        replacement?.focus({ preventScroll: true });
        if (selection && replacement?.setSelectionRange) replacement.setSelectionRange(...selection);
      }
    }, MARKET_REFRESH_MS);
  }

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
    return date.toLocaleString("ar-AE", { timeZone: displayTimeZone(), dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) });
  }
  function roleLabel(role) {
    return ({ developer: "إدارة النظام", trader: "صلاحية تداول", viewer: "عرض فقط" })[role] || "حساب";
  }
  function providerLabel(broker = app.broker) {
    return window.VarexAccounts?.getProvider(broker?.provider)?.label || broker?.providerLabel || "منصة التداول";
  }
  function binanceConnected() {
    return app.broker?.connected === true && app.broker.provider === "binance" && app.broker.executionSupported !== false;
  }
  function liveExecutionReady() {
    return app.profile?.canConnectBroker === true && binanceConnected() && app.broker.liveTradingEnabled === true;
  }
  function accountMoney(value, currency = "USD") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const unit = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: unit, maximumFractionDigits: 2 }).format(value);
  }
  function readEntryDestination(search = window.location?.search || "") {
    const params = new URLSearchParams(search), workspace = window.VarexMarketWorkspace;
    const provider = window.VarexAccounts?.getProvider(params.get("provider"));
    const market = workspace?.getMarket(params.get("symbol"));
    const interval = workspace?.intervals?.some((item) => item.id === params.get("interval")) ? params.get("interval") : "60";
    return {
      account: ["demo", "connect"].includes(params.get("account")) ? params.get("account") : "demo",
      provider: provider?.id || "capital",
      next: params.get("next") === "markets" ? "markets" : "",
      symbol: market?.id || "EURUSD",
      interval,
      authPane: params.get("auth") === "login" ? "loginForm" : "registerPane",
    };
  }
  function renderAuthChoices() {
    const target = $("#authAccountChoices");
    if (target && window.VarexAccounts) target.innerHTML = window.VarexAccounts.renderChoices({ active: entryDestination?.account === "connect" ? "linked" : "demo" });
  }
  function applyEntryDestination() {
    const destination = entryDestination || readEntryDestination();
    app.executionMode = "paper";
    app.accountChoice = destination.account === "connect" ? "linked" : "demo";
    app.brokerProvider = destination.account === "connect" ? destination.provider : (window.VarexAccounts?.getProvider(app.broker?.provider)?.id || "capital");
    app.brokerQuery = "";
    app.brokerFormOpen = false;
    app.view = destination.next === "markets" ? "markets" : destination.account === "connect" ? "broker" : "dashboard";
    if (destination.next === "markets") {
      app.exploreSymbol = destination.symbol;
      app.exploreInterval = destination.interval;
    }
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
    $("#existingAccountActions")?.classList.add("hidden");
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
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  async function request(path, options = {}) {
    const init = { credentials: "include", ...options, headers: { "Content-Type": "application/json", "X-Client-Info": "varex-ai-trading/2.0", ...(options.headers || {}) } };
    const response = await (typeof window === "undefined" ? fetch : (window.varexTradingRequest || window.fetch))(path, init);
    const invalidResponse = () => {
      const error = new Error("خدمة التطبيق غير متاحة حالياً. يرجى إعادة المحاولة لاحقاً.");
      error.status = response.ok ? 502 : response.status;
      return error;
    };
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^application\/(?:json|[\w.+-]+\+json)$/i.test(contentType)) throw invalidResponse();
    let data;
    try { data = await response.json(); }
    catch { throw invalidResponse(); }
    if (!response.ok) {
      const message = isRecord(data) && (typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "");
      const error = new Error(message || "تعذر إكمال الطلب.");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    if (data === null && path === "/api/auth/get-session") return null;
    if (!isRecord(data)) throw invalidResponse();
    return data;
  }
  function validateBootstrap(bootstrap) {
    const profile = bootstrap?.profile, state = bootstrap?.state;
    if (!isRecord(bootstrap) || !isRecord(profile) || !isRecord(state)
      || typeof profile.id !== "string" || !profile.id
      || typeof profile.displayName !== "string" || !profile.displayName.trim()
      || !["developer", "trader", "viewer"].includes(profile.role)
      || !Number.isInteger(bootstrap.version) || bootstrap.version < 1
      || !Number.isFinite(state.balanceCents) || state.balanceCents < 0
      || typeof state.selectedSymbol !== "string" || !state.selectedSymbol
      || !Array.isArray(state.watchlist) || !state.watchlist.every((symbol) => typeof symbol === "string")
      || !Array.isArray(state.trades) || !state.trades.every(isRecord)
      || !Array.isArray(state.analyses) || !state.analyses.every(isRecord)
      || !isRecord(state.risk) || !isRecord(state.settings)
      || !["maxDailyLossPct", "maxOpenTrades", "riskPerTradePct"].every((key) => Number.isFinite(state.risk[key]))
      || (bootstrap.broker != null && !isRecord(bootstrap.broker))
      || (bootstrap.supportedMarkets != null && (!Array.isArray(bootstrap.supportedMarkets) || !bootstrap.supportedMarkets.every(isRecord)))) {
      const error = new Error("تعذر تحميل بيانات الحساب كاملة. يرجى إعادة المحاولة لاحقاً.");
      error.status = 502;
      throw error;
    }
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
    entryDestination = readEntryDestination();
    bindAuth();
    bindShell();
    try {
      const session = await authRequest("/api/auth/get-session", undefined, "GET");
      if (session?.user) await enterApp();
      else showLoggedOut();
    } catch (error) {
      showLoggedOut(error.message || "تعذر الاتصال بخدمة تسجيل الدخول.");
    }
  }
  function showLoggedOut(message = "") {
    marketWorkspace?.destroy();
    marketWorkspace = null;
    $("#loadingScreen").classList.add("hidden");
    $("#appShell").classList.add("hidden");
    $("#authScreen").classList.remove("hidden");
    entryDestination ||= readEntryDestination();
    renderAuthChoices();
    showAuthPane(entryDestination.authPane);
    if (message) showAuthMessage(message);
  }
  async function enterApp() {
    $("#loadingScreen").classList.remove("hidden");
    try {
      const bootstrap = await request("/api/trading");
      validateBootstrap(bootstrap);
      app.profile = bootstrap.profile;
      app.state = bootstrap.state;
      app.version = bootstrap.version;
      app.broker = bootstrap.broker;
      app.supportedMarkets = bootstrap.supportedMarkets || [];
      app.formDrafts = {};
      app.userRoleDrafts = {};
      app.automation = null;
      app.automationError = "";
      applyEntryDestination();
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
    $("#brokerNav").classList.remove("hidden");
    $$(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === app.view));
    updateExecutionUi();
    $("#dateLabel").textContent = new Date().toLocaleDateString("ar-AE", { timeZone: displayTimeZone(), weekday: "long", year: "numeric", month: "long", day: "numeric" });
    document.documentElement.classList.toggle("compact-mode", app.state?.settings?.compactMode === true);
  }

  function updateExecutionUi() {
    const connected = app.broker?.connected === true;
    const liveReady = liveExecutionReady(), label = providerLabel();
    $("#brokerLabel").textContent = connected ? `${label} · ${app.broker.accountLabel || "حساب مربوط"}` : "حساب التداول غير مربوط";
    $("#executionStatus").textContent = liveReady ? "LIVE READY" : "DEMO TRADING";
    $("#executionStatus").classList.toggle("live-ready", liveReady);
    $("#executionBanner").classList.toggle("live-ready", liveReady);
    if (liveReady) {
      $("#executionBannerTitle").textContent = "حساب Binance مربوط — كل صفقة حقيقية تحتاج تأكيداً يدوياً";
      $("#executionBannerText").textContent = "الإيداع والسحب يتمان من Binance فقط. VAREX لا يحتفظ بالأموال ولا يملك صلاحية نقلها.";
    } else if (connected && app.broker.provider === "capital") {
      $("#executionBannerTitle").textContent = "حساب Capital.com مربوط لعرض الأرصدة والمراكز";
      $("#executionBannerText").textContent = "التنفيذ داخل Capital.com غير متاح في VAREX حالياً. صفقات VAREX والبوت التجريبي تستخدم الرصيد التجريبي فقط.";
    } else if (connected) {
      $("#executionBannerTitle").textContent = `حساب ${label} مربوط — التداول الحقيقي متوقف`;
      $("#executionBannerText").textContent = "التداول التجريبي متاح. يمكن مراجعة قدرات الربط من شاشة ربط حساب منصة تداول.";
    } else {
      $("#executionBannerTitle").textContent = "التجربة الحالية تجريبية وآمنة للتعلّم";
      $("#executionBannerText").textContent = "لا حاجة إلى ربط حساب تداول أو إيداع مال. الأسعار حية، لكن كل الصفقات تجريبية فقط.";
    }
  }

  function bindAuth() {
    document.addEventListener("click", (event) => {
      const passwordToggle = event.target.closest("[data-password-toggle]");
      if (passwordToggle) return togglePassword(passwordToggle);
      const accountChoice = event.target.closest("[data-account-choice]");
      if (accountChoice && !app.profile) {
        event.preventDefault?.();
        entryDestination ||= readEntryDestination();
        entryDestination.account = accountChoice.dataset.accountChoice === "connect" ? "connect" : "demo";
        entryDestination.next = "";
        renderAuthChoices();
        return showAuthMessage(entryDestination.account === "connect" ? "بعد إنشاء حساب VAREX أو تسجيل الدخول، تظهر منصات التداول وخيارات الربط المتاحة." : "بعد إنشاء حساب VAREX أو تسجيل الدخول، يُفتح الحساب التجريبي المحفوظ.", "success");
      }
      const switcher = event.target.closest("[data-auth-pane]");
      if (switcher) showAuthPane(switcher.dataset.authPane);
    });
    const registerPassword = $('#registerPane [name="password"]');
    registerPassword.addEventListener("input", () => updatePasswordRules(registerPassword.value));
    updatePasswordRules(registerPassword.value);
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, data = new FormData(form);
      const email = String(data.get("email") || "").trim().toLowerCase(), password = String(data.get("password") || "");
      try {
        await runForm(form, async () => {
          await authRequest("/api/auth/sign-in/email", { email, password, rememberMe: Boolean(data.get("remember")) });
          await enterApp();
        }, "جاري تسجيل الدخول…");
      } catch (error) {
        if (error.status === 403 && error.payload?.code === "email_not_confirmed" && error.payload.emailVerificationRequired === true) {
          pendingAuth = { purpose: "signup", email, password, displayName: "", otp: "" };
          $("#otpEmail").textContent = email;
          showAuthPane("otpPane");
          showAuthMessage("يلزم تأكيد البريد. يمكن إدخال الرمز الموجود في الرسالة، أو الضغط على «إرسال رمز جديد» إذا انتهت صلاحيته.", "success");
        }
      }
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
          let signUpError = null;
          try {
            await authRequest("/api/auth/sign-up/email", { name: displayName, email, password, rememberMe: false });
          } catch (error) {
            signUpError = error;
          }
          try {
            await authRequest("/api/trading-auth/send-otp", { email, password, purpose: "verify" });
          } catch (error) {
            if (error.status === 404 && signUpError) throw signUpError;
            throw error;
          }
          pendingAuth = { purpose: "signup", email, password, displayName, otp: "" };
          $("#otpEmail").textContent = email;
          showAuthPane("otpPane");
          showAuthMessage("أرسلنا رمز التحقق إلى بريدك.", "success");
        }, "جاري إنشاء الحساب…");
      } catch (error) {
        if (error.payload?.code !== "signup_unavailable") return;
        pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
        $("#loginForm [name=email]").value = email;
        $("#recoverPane [name=email]").value = email;
        $("#loginForm [name=password]").value = "";
        registerPassword.value = "";
        $('#registerPane [name="confirmPassword"]').value = "";
        updatePasswordRules("");
        showAuthMessage("لا يمكن إكمال إنشاء حساب جديد بهذا البريد. إذا كان لديك حساب VAREX، يمكن تسجيل الدخول بكلمة مروره أو استخدام استعادة كلمة المرور.");
        $("#existingAccountActions")?.classList.remove("hidden");
      }
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
    $("#viewRoot").addEventListener("input", rememberFormField);
    $("#viewRoot").addEventListener("input", handleBrokerSearch);
    $("#viewRoot").addEventListener("change", handleFormChange);
    document.addEventListener("visibilitychange", scheduleMarketRefresh);
    $("#confirmCancel").addEventListener("click", () => resolveConfirm(false));
    $("#confirmAccept").addEventListener("click", () => resolveConfirm(true));
  }
  function goTo(view) {
    if (!app.profile) return;
    if (view === "users" && !app.profile.canManageUsers) return;
    app.view = view;
    $$(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    closeMenu();
    if (view === "users" && !app.users.length) loadUsers();
    else if (view === "automation") { render(); loadAutomation(); }
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
    const requestId = ++marketRequestId;
    stopMarketRefresh();
    // Serialize requests and discard superseded selections before starting another fetch.
    if (marketRequest) {
      try { await marketRequest; } catch {}
      if (requestId !== marketRequestId || !app.profile) return;
    }
    const pending = request(`/api/trading?action=markets&symbol=${encodeURIComponent(symbol)}`);
    marketRequest = pending;
    try {
      const board = await pending;
      if (requestId !== marketRequestId) return;
      if ("state" in board || "version" in board) {
        validateBootstrap({ profile: app.profile, state: board.state, version: board.version });
        if (board.version >= app.version) {
          app.state = board.state;
          app.version = board.version;
        }
      }
      app.markets = board.markets || [];
      app.selectedMarket = app.markets.find((market) => market.symbol === board.selected) || app.markets[0] || null;
      app.marketError = "";
      $("#marketStatus").classList.add("live");
      $("#marketStatus").innerHTML = "<i></i> بيانات سوق حية";
    } catch (error) {
      if (requestId !== marketRequestId) return;
      app.marketError = error.message;
      app.markets = [];
      app.selectedMarket = null;
      $("#marketStatus").classList.remove("live");
      $("#marketStatus").textContent = "السوق غير متاح";
      if (error.status === 401) {
        app.profile = null;
        showLoggedOut("انتهت جلسة الحساب. يرجى تسجيل الدخول مجدداً.");
      }
      if (!initial) showToast(error.message, "error");
    } finally {
      if (marketRequest === pending) marketRequest = null;
      if (requestId === marketRequestId) scheduleMarketRefresh();
    }
  }
  async function refreshMarkets(symbol = currentSymbol()) {
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
    const now = new Date(), todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayPnl = closed.filter((trade) => trade.closedAt && new Date(trade.closedAt) >= todayStart).reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const wins = closed.filter((trade) => trade.pnl > 0).length;
    const losses = closed.filter((trade) => trade.pnl < 0).length;
    const balance = Number(app.state.balanceCents || 0) / 100;
    return { trades, closed, open, realized, unrealized, todayPnl, wins, losses, winRate: closed.length ? wins / closed.length * 100 : 0, balance, equity: balance + unrealized };
  }

  function headerForView() {
    const map = {
      dashboard: [`${greeting()}، ${app.profile.displayName}`, "اختيار عملة، تشغيل تحليل VAREX، ثم تجربة صفقة تجريبية."],
      markets: ["الأسواق", "الفوركس والمؤشرات والسلع والمعادن والأسهم والعملات الرقمية في مساحة واحدة."],
      intelligence: ["تحليل الأسواق", "الاتجاه والزخم والتذبذب ومستويات السعر، مع مصدر البيانات والفترة الزمنية."],
      trades: ["الصفقات", "فتح وإغلاق صفقات تجريبية أو تنفيذ أمر Spot حقيقي بعد تأكيد واضح."],
      risk: ["مركز المخاطر", "حدود حقيقية يطبقها الخادم قبل السماح بأي صفقة تجريبية."],
      broker: ["ربط حساب منصة تداول", "اختيار المنصة ومعرفة قدرات الربط المتاحة قبل إضافة بيانات الحساب."],
      automation: ["التداول الآلي", "بوت تجريبي يعمل على الخادم بعد تفعيله، مع حدود للمخاطر وسجل واضح للعمليات."],
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
      markets: '<button class="small-button" data-action="refresh-technical">↻ تحديث العرض</button>',
      intelligence: '<button class="primary-button" data-action="refresh-technical">↻ تحديث التحليل</button>',
      reports: '<button class="primary-button" data-action="export-report">⇩ تصدير CSV</button>',
      broker: app.broker?.connected && app.profile.canConnectBroker ? '<button class="primary-button" data-action="refresh-broker">↻ فحص الاتصال والرصيد</button>' : "",
      automation: '<button class="small-button" data-action="refresh-automation">↻ تحديث حالة البوت</button>',
    };
    $("#pageActions").innerHTML = actions[app.view] || "";
    $("#executionBanner")?.classList.toggle("hidden", ["markets", "intelligence"].includes(app.view));
  }
  function render() {
    if (!app.state || !app.profile) return;
    document.documentElement.classList.toggle("compact-mode", app.state.settings.compactMode === true);
    headerForView();
    marketWorkspace?.destroy();
    marketWorkspace = null;
    const renderers = { dashboard: renderDashboard, markets: renderMarkets, intelligence: renderIntelligence, trades: renderTrades, risk: renderRisk, broker: renderBroker, automation: renderAutomation, watchlist: renderWatchlist, reports: renderReports, users: renderUsers, settings: renderSettings };
    $("#viewRoot").innerHTML = (renderers[app.view] || renderDashboard)();
    if (["markets", "intelligence"].includes(app.view)) mountMarketWorkspace();
    pendingForms.forEach((id) => {
      const submit = $(`#${id} button[type="submit"]`);
      if (submit) submit.disabled = true;
    });
  }
  function renderMarkets() {
    return '<div id="marketWorkspace"><div class="mw-empty" role="status">جاري تجهيز الأسواق والتحليل…</div></div>';
  }
  function mountMarketWorkspace() {
    const target = $("#marketWorkspace"), workspace = window.VarexMarketWorkspace;
    if (!target) return;
    if (!workspace) {
      target.innerHTML = '<div class="mw-empty"><p>تعذر تحميل أدوات الأسواق. يمكن إعادة تحميل الصفحة أو فتح مساحة الأسواق.</p><a href="/trading/markets.html">فتح الأسواق والتحليل</a></div>';
      return;
    }
    marketWorkspace = workspace.mount(target, {
      authenticated: true,
      canTrade: app.profile.canTrade === true,
      initialSymbol: app.exploreSymbol || (app.view === "intelligence" ? app.selectedMarket?.symbol || app.state.selectedSymbol : "EURUSD"),
      interval: app.exploreInterval,
      onSelect({ id, interval }) { app.exploreSymbol = id; app.exploreInterval = interval; },
      onTrade: openResearchTrade,
    });
  }
  async function openResearchTrade(symbol) {
    const item = window.VarexMarketWorkspace?.getMarket(symbol);
    if (!app.profile?.canTrade || !item?.executionSymbol || item.executionSymbol !== symbol
      || !app.supportedMarkets.some((market) => market.symbol === symbol)) {
      return showToast("هذا السوق متاح للعرض والتحليل فقط.", "error");
    }
    app.executionMode = "paper";
    app.formDrafts.tradeForm = { ...app.formDrafts.tradeForm, symbol };
    goTo("trades");
    await loadMarkets(symbol, true);
    if (app.profile && app.view === "trades") render();
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
    if (!trades.length) return '<div class="empty"><span>▣</span><p>لا توجد صفقات بعد. يمكن فتح أول صفقة تجريبية من بطاقة التنفيذ.</p></div>';
    return `<div class="list">${trades.map((trade) => `<div class="list-row"><span><strong>${escapeHtml(trade.symbol)}</strong><small class="muted"> · ${localDate(trade.openedAt, true)}</small></span><span class="badge ${trade.side}">${directionLabel(trade.side)}</span><span class="${trade.status === "closed" ? (trade.pnl >= 0 ? "positive" : "negative") : "muted"}">${trade.status === "closed" ? money(trade.pnl) : "مفتوحة"}</span><button class="small-button" data-view="trades">التفاصيل</button></div>`).join("")}</div>`;
  }
  function tradeTicket() {
    const draft = formDraft("tradeForm", { symbol: app.state.selectedSymbol });
    const canTrade = app.profile.canTrade, marketOptions = app.markets.map((market) => `<option value="${escapeHtml(market.symbol)}" ${market.symbol === draft.symbol ? "selected" : ""}>${escapeHtml(market.label)}</option>`).join("");
    const selected = getMarket(draft.symbol);
    const liveReady = liveExecutionReady();
    if (!liveReady && app.executionMode === "live") app.executionMode = "paper";
    const liveMode = liveReady && app.executionMode === "live";
    const maxAmount = liveMode ? Number(app.broker.maxLiveOrderUsd || 100) : Number(app.state.balanceCents) / 400;
    const defaultAmount = liveMode ? Math.min(100, maxAmount) : Math.max(25, Math.min(500, Math.floor(maxAmount / 25) * 25));
    const amount = draft[liveMode ? "liveAmount" : "paperAmount"] ?? defaultAmount;
    const modePicker = app.profile.canConnectBroker ? `<div class="execution-picker"><button type="button" class="${!liveMode ? "active" : ""}" data-execution-mode="paper">تداول تجريبي</button>${liveReady ? `<button type="button" class="${liveMode ? "active live" : ""}" data-execution-mode="live">تداول حقيقي</button>` : '<button type="button" data-view="broker">ربط حساب منصة تداول</button>'}</div>` : "";
    return `<article class="panel ${liveMode ? "live-ticket" : ""}"><header class="panel-head"><div><h2>${liveMode ? "تنفيذ صفقة حقيقية" : "فتح صفقة تجريبية"}</h2><p>${liveMode ? "يُرسل أمر MARKET إلى Binance Spot بعد تأكيد مستقل." : "السعر يؤخذ من السوق عند تأكيد الطلب."}</p></div><span class="badge ${liveMode ? "live" : "pending"}">${liveMode ? "LIVE" : "DEMO"}</span></header>
      ${canTrade ? `<form class="trade-ticket" id="tradeForm">
        ${modePicker}
        <label class="control">السوق<select name="symbol">${marketOptions}</select></label>
        <div class="side-picker"><button type="button" class="${app.tradeSide === "buy" ? "active" : ""}" data-side="buy">↗ شراء</button><button type="button" class="${app.tradeSide === "sell" ? "active" : ""}" data-side="sell">↘ بيع</button></div>
        <label class="control">${liveMode ? "قيمة الأمر بـ USDT" : "حجم الصفقة بالدولار"}<input name="amount" type="number" min="25" max="${maxAmount}" step="25" value="${escapeHtml(amount)}" required></label>
        <div class="trade-summary"><p><span>السعر المعروض</span><b>${selected ? money(selected.price) : "يؤخذ عند التنفيذ"}</b></p>${liveMode ? `<p><span>حد الأمر الحقيقي</span><b>${money(app.broker.maxLiveOrderUsd)}</b></p><p><span>رصيد USDT المتاح</span><b>${money(app.broker.availableUsdt)}</b></p>` : `<p><span>حد الصفقات المفتوحة</span><b>${app.state.risk.maxOpenTrades}</b></p><p><span>المخاطرة لكل صفقة</span><b>${app.state.risk.riskPerTradePct}%</b></p>`}</div>
        ${liveMode ? '<div class="live-warning">صفقة حقيقية بأموال موجودة في Binance. لا يوجد ضمان للربح، ولا يمكن لـ VAREX سحب الأموال.</div>' : ""}
        <button class="primary-button" type="submit">${liveMode ? `مراجعة أمر ${app.tradeSide === "buy" ? "شراء" : "بيع"} حقيقي` : `فتح صفقة ${app.tradeSide === "buy" ? "شراء" : "بيع"} تجريبية`}</button>
      </form>` : '<div class="notice">صلاحية هذا الحساب للعرض فقط. يمكن لإدارة النظام تغييرها من شاشة الحسابات.</div>'}
    </article>`;
  }
  function renderDashboard() {
    const metrics = accountMetrics(), dailyRisk = metrics.todayPnl < 0 && metrics.balance ? Math.abs(metrics.todayPnl) / metrics.balance * 100 : 0;
    return `${window.VarexAccounts?.renderChoices({ active: app.accountChoice, canConnect: app.profile.canConnectBroker }) || ""}<section class="va-automation-entry"><div><span class="va-eyebrow">حساب تجريبي فقط</span><h2>تداول آلي تجريبي 24 ساعة</h2><p>تشغيل البوت من الخادم بعد التفعيل، حتى عند إغلاق المتصفح. الإعدادات والحالة وسجل النتائج متاحة من صفحة التداول الآلي.</p></div><button class="va-button va-button-primary" data-view="automation">إعداد البوت التجريبي</button></section><section class="trial-guide"><div><span class="eyebrow">تجربة بدون أموال حقيقية</span><h2>بدء أول تجربة تداول</h2><p>لا حاجة إلى وسيط في هذه المرحلة. يقرأ VAREX السوق الحي ويعرض مؤشرات فنية، ثم يتم تأكيد الصفقة التجريبية يدوياً.</p></div><ol class="trial-steps"><li><b>1</b><span>اختيار عملة</span></li><li><b>2</b><span>تشغيل تحليل VAREX</span></li><li><b>3</b><span>فتح صفقة تجريبية</span></li></ol><button class="primary-button" data-action="guided-analysis">✦ تحليل ${escapeHtml(app.selectedMarket?.label || "BTC / USD")} الآن</button></section>
    <section class="stats-grid">
      ${statCard("▣", "الرصيد التجريبي", money(metrics.balance), "الرصيد المحفوظ في حسابك")}
      ${statCard("$", "صافي اليوم (UTC)", money(metrics.todayPnl), "من الصفقات المغلقة منذ 00:00 UTC", metrics.todayPnl >= 0 ? "positive" : "negative")}
      ${statCard("⌁", "صفقات مفتوحة", String(metrics.open.length), `الحد المسموح ${app.state.risk.maxOpenTrades}`)}
      ${statCard("◇", "استخدام حد الخسارة", `${dailyRisk.toFixed(2)}%`, `من حد يومي ${app.state.risk.maxDailyLossPct}% · UTC`, dailyRisk >= app.state.risk.maxDailyLossPct ? "negative" : "")}
    </section>
    <section class="content-grid">${marketPanel()}${tradeTicket()}</section>
    <section class="panel"><header class="panel-head"><div><h2>آخر الصفقات</h2><p>بيانات فعلية من سجل حسابك التجريبي.</p></div><button class="small-button" data-view="trades">عرض الكل</button></header>${renderRecentTrades()}</section>`;
  }

  function analysisCard(analysis) {
    if (!analysis) return '<div class="empty"><span>✦</span><p>لا يوجد تحليل بعد. يبدأ التحليل بعد اختيار سوق والضغط على «تحليل».</p></div>';
    const colorClass = analysis.direction === "wait" ? "muted" : analysis.direction === "buy" ? "positive" : "negative";
    return `<div class="signal-card"><div class="signal-main"><small>${escapeHtml(analysis.symbol)} · ${localDate(analysis.createdAt, true)}</small><strong class="${colorClass}">${directionLabel(analysis.direction)}</strong><span class="muted">المحرك: ${escapeHtml(analysis.engine || "VAREX")}</span></div><span class="score-ring" style="--score:${Number(analysis.confidence || 0) * 3.6}deg"><b>${Number(analysis.confidence || 0)}%</b></span></div>
      <ul class="reasons">${(analysis.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      <div class="level-grid"><span><small>سعر التحليل</small><b>${money(analysis.price)}</b></span><span><small>الهدف الاحتمالي</small><b class="positive">${money(analysis.target)}</b></span><span><small>وقف مقترح</small><b class="negative">${money(analysis.stop)}</b></span></div>
      <p class="notice">${escapeHtml(analysis.disclaimer || "التحليل احتمالي وليس ضماناً للربح.")}</p>
      ${analysis.direction === "wait" ? '<div class="analysis-next wait"><div><b>قرار VAREX الآن: الانتظار</b><small>لا يفتح النظام صفقة عندما لا يرى إشارة دخول كافية. يمكن اختيار عملة ثانية وتشغيل تحليل جديد.</small></div><button class="secondary-button" data-view="dashboard">اختيار عملة أخرى</button></div>' : `<div class="analysis-next"><div><b>الخطوة التالية</b><small>يمكن استخدام نتيجة التحليل لتهيئة صفقة تجريبية؛ لن يُخصم أي مال حقيقي.</small></div><button class="primary-button" data-use-analysis="${escapeHtml(analysis.symbol)}" data-side="${analysis.direction}">استخدام النتيجة وفتح صفقة ${directionLabel(analysis.direction)} تجريبية</button></div>`}`;
  }
  function renderIntelligence() {
    const history = app.state.analyses.slice(0, 8);
    return renderMarkets() + (history.length ? `<details class="panel mw-legacy-history"><summary>سجل قراءات حركة 24 ساعة السابقة</summary><p class="notice">هذه قراءات المحرك السابق المحفوظة في الحساب. التحليل الفني الحالي ظاهر أعلاه للسوق والفترة المحدّدين.</p><div class="analysis-history">${history.map((item) => `<div class="analysis-item"><p><b>${escapeHtml(item.symbol)}</b><span class="badge ${escapeHtml(item.direction)}">${directionLabel(item.direction)}</span><small>${localDate(item.createdAt, true)}</small></p></div>`).join("")}</div></details>` : "");
  }

  function renderTrades() {
    const trades = app.state.trades;
    const rows = trades.map((trade) => {
      const currentPnl = trade.status === "open" ? unrealizedFor(trade) : trade.pnl;
      return `<tr><td dir="ltr"><b>${escapeHtml(trade.symbol)}</b></td><td><span class="badge ${trade.side}">${directionLabel(trade.side)}</span></td><td dir="ltr">${money(trade.amount)}</td><td dir="ltr">${money(trade.entryPrice)}</td><td dir="ltr">${trade.exitPrice ? money(trade.exitPrice) : getMarket(trade.symbol) ? money(getMarket(trade.symbol).price) : "—"}</td><td class="${currentPnl >= 0 ? "positive" : "negative"}" dir="ltr">${money(currentPnl)}</td><td>${trade.status === "open" ? '<span class="badge active">مفتوحة</span>' : '<span class="badge pending">مغلقة</span>'}</td><td>${trade.status === "open" && app.profile.canTrade ? `<button class="small-button danger" data-close-trade="${trade.id}">إغلاق</button>` : "—"}</td></tr>`;
    }).join("");
    return `<section class="content-grid">${tradeTicket()}<article class="panel"><header class="panel-head"><div><h2>قواعد التنفيذ</h2><p>تُطبق على الخادم قبل فتح الصفقة.</p></div></header><div class="toggle-row"><p><b>الحد الأقصى المفتوح</b><small>لا يمكن تجاوزه</small></p><strong>${app.state.risk.maxOpenTrades}</strong></div><div class="toggle-row"><p><b>حجم الصفقة</b><small>حتى 25% من الرصيد</small></p><strong>25%</strong></div><div class="toggle-row"><p><b>وقف تجريبي عند تحديث الأسعار</b><small>تتم المتابعة أثناء فتح التطبيق وظهور التبويب</small></p><span class="badge ${app.state.risk.autoStop ? "active" : "inactive"}">${app.state.risk.autoStop ? "مفعّل" : "متوقف"}</span></div></article></section>
      <section class="panel"><header class="panel-head"><div><h2>سجل الصفقات</h2><p>${trades.length} صفقة محفوظة.</p></div></header><div class="table-wrap">${trades.length ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>الحجم</th><th>الدخول</th><th>الخروج / الحالي</th><th>النتيجة</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty"><span>▣</span><p>لا توجد صفقات بعد.</p></div>'}</div></section>`;
  }

  function renderRisk() {
    const metrics = accountMetrics(), lossToday = Math.min(0, metrics.todayPnl), used = metrics.balance ? Math.abs(lossToday) / metrics.balance * 100 : 0;
    const risk = formDraft("riskForm", app.state.risk);
    return `<section class="stats-grid">
      ${statCard("◇", "حد الخسارة اليومي (UTC)", `${app.state.risk.maxDailyLossPct}%`, "يمنع فتح صفقة بعد بلوغه")}
      ${statCard("⌁", "استهلاك الحد اليومي", `${used.toFixed(2)}%`, `منذ 00:00 UTC · ${lossToday ? money(lossToday) : "لا توجد خسارة محققة"}`, used >= app.state.risk.maxDailyLossPct ? "negative" : "positive")}
      ${statCard("▣", "حد الصفقات", String(app.state.risk.maxOpenTrades), `${metrics.open.length} مفتوحة حالياً`)}
      ${statCard("%", "مخاطرة الصفقة", `${app.state.risk.riskPerTradePct}%`, "من الرصيد التجريبي")}
    </section>
    <section class="content-grid equal-grid"><form class="panel" id="riskForm"><header class="panel-head"><div><h2>حدود المخاطر</h2><p>تُحفظ وتُطبق فوراً.</p></div></header><div class="form-grid">
      <label class="control">حد الخسارة اليومي %<input name="maxDailyLossPct" type="number" min=".5" max="20" step=".5" value="${escapeHtml(risk.maxDailyLossPct)}" required></label>
      <label class="control">أقصى صفقات مفتوحة<input name="maxOpenTrades" type="number" min="1" max="10" step="1" value="${escapeHtml(risk.maxOpenTrades)}" required></label>
      <label class="control">مخاطرة الصفقة %<input name="riskPerTradePct" type="number" min=".25" max="5" step=".25" value="${escapeHtml(risk.riskPerTradePct)}" required></label>
    </div><div class="toggle-row"><p><b>تحديد وقف خسارة</b><small>يغلق الصفقة التجريبية عند بلوغ الحد أثناء تحديث الأسعار؛ تتوقف المتابعة عند إغلاق التطبيق</small></p><button type="button" class="switch ${risk.autoStop ? "on" : ""}" data-toggle-risk="autoStop"><i></i></button></div><button class="primary-button" type="submit">حفظ حدود المخاطر</button></form>
      <article class="panel"><header class="panel-head"><div><h2>حالة الحماية</h2><p>ملخص القرارات الحالية.</p></div></header><div class="notice">حد الخسارة وعدد الصفقات وحجم الصفقة تُفحص على الخادم في التداول التجريبي. التداول الحقيقي يطبق حد الأمر المضبوط في شاشة حساب التداول.</div><div class="toggle-row"><p><b>القدرة على التداول</b><small>حسب صلاحية الحساب</small></p><span class="badge ${app.profile.canTrade ? "active" : "inactive"}">${app.profile.canTrade ? "مسموح" : "عرض فقط"}</span></div><div class="toggle-row"><p><b>حساب Binance</b><small>الربط متاح لحساب الإدارة فقط</small></p><span class="badge ${app.broker?.connected ? "active" : "pending"}">${app.broker?.connected ? "مربوط" : "غير مربوط"}</span></div></article></section>`;
  }

  function balanceAmount(value) {
    if (value === null || value === undefined || value === "") return "—";
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
    const provider = window.VarexAccounts?.getProvider(app.brokerProvider);
    const directory = `<div id="brokerDirectory">${renderBrokerDirectory()}</div>`;
    if (!app.profile.canConnectBroker) return `${directory}<div class="va-connection-panel notice">دليل المنصات متاح للعرض. إضافة بيانات الربط تتطلب صلاحية تداول في حساب VAREX.</div>`;
    if (!provider || provider.capability === "unavailable") return directory;
    return `${directory}<div class="va-connection-panel">${provider.id === "capital" ? renderCapitalBroker() : renderBinanceBroker()}</div>`;
  }
  function renderBrokerDirectory() {
    return window.VarexAccounts?.renderDirectory({ selectedId: app.brokerProvider, query: app.brokerQuery, currentProvider: app.broker?.connected ? app.broker.provider : "" }) || '<div class="notice">تعذر تحميل دليل المنصات. يرجى إعادة تحميل الصفحة.</div>';
  }
  function handleBrokerSearch(event) {
    if (!event.target.matches?.("[data-broker-search]")) return;
    const field = event.target, selection = [field.selectionStart, field.selectionEnd];
    app.brokerQuery = field.value;
    const directory = $("#brokerDirectory");
    if (!directory) return;
    // Replace only the directory; unsubmitted broker credentials stay in their existing form.
    directory.innerHTML = renderBrokerDirectory();
    const nextField = $("[data-broker-search]", directory);
    nextField?.focus({ preventScroll: true });
    if (Number.isInteger(selection[0])) nextField?.setSelectionRange?.(...selection);
  }
  function renderCapitalBroker() {
    const broker = app.broker;
    if (!broker?.connected || broker.provider !== "capital" || app.brokerFormOpen) {
      return `<section class="content-grid equal-grid"><form class="panel broker-form" id="capitalConnectForm"><header class="panel-head"><div><span class="eyebrow">عرض الحساب والمراكز</span><h2>ربط Capital.com</h2><p>يبدأ الاختيار ببيئة Demo. لا يرسل هذا الربط أوامر تداول.</p></div><span class="provider-logo">C</span></header>
        <label class="control">بيئة حساب Capital.com<select name="environment"><option value="demo" selected>Demo — حساب تجريبي لدى Capital.com</option><option value="live">Live — عرض حساب حقيقي لدى Capital.com</option></select></label>
        <label class="control">اسم الحساب داخل VAREX<input name="accountLabel" maxlength="80" value="حساب Capital.com" required></label>
        <label class="control">البريد أو معرّف حساب Capital.com<input name="identifier" type="text" autocomplete="off" spellcheck="false" dir="ltr" required></label>
        <label class="control">API Key<span class="password-field"><input name="apiKey" type="password" autocomplete="off" spellcheck="false" dir="ltr" required><button class="password-toggle" type="button" data-password-toggle aria-label="إظهار API Key" aria-pressed="false">إظهار</button></span></label>
        <label class="control">كلمة مرور API المخصّصة<span class="password-field"><input name="apiPassword" type="password" autocomplete="off" spellcheck="false" dir="ltr" required><button class="password-toggle" type="button" data-password-toggle aria-label="إظهار كلمة مرور API" aria-pressed="false">إظهار</button></span></label>
        <div class="notice">هذه كلمة المرور المخصّصة لمفتاح API في Capital.com، وليست كلمة مرور تسجيل الدخول إلى VAREX أو إلى المنصة.</div>
        <label class="check security-check"><input name="fundsAtProvider" type="checkbox" required><span>تأكيد بقاء الأموال والإيداع والسحب داخل Capital.com، وأن الربط داخل VAREX لعرض الحساب فقط.</span></label>
        <button class="primary-button" type="submit">اختبار الاتصال وربط الحساب</button>
      </form><article class="panel"><header class="panel-head"><div><h2>ما الذي يظهر بعد الربط؟</h2><p>بيانات الحساب الفعلية من Capital.com.</p></div></header><div class="permission-list"><p><span>الرصيد والمتاح</span><b>عرض</b></p><p><span>المراكز المفتوحة</span><b>عرض</b></p><p><span>فتح وإغلاق CFD</span><b>غير متاح في VAREX</b></p><p><span>بوت VAREX</span><b>الرصيد التجريبي الداخلي فقط</b></p></div><div class="notice">مفاتيح API لدى Capital.com قد تسمح بالتداول لدى المزود؛ موصل VAREX ينفذ طلبات قراءة الحساب والمراكز فقط. كلمة مرور API مطلوبة بصورة مستقلة، وتحفظ بيانات الربط مشفرة على الخادم.</div><div class="external-links"><a class="secondary-button" href="https://open-api.capital.com/" target="_blank" rel="noopener noreferrer">دليل Capital.com الرسمي ↗</a></div>${broker?.connected ? `<div class="live-warning">الحساب المرتبط حالياً: ${escapeHtml(providerLabel(broker))}. استبداله يحتاج تأكيداً مستقلاً قبل حفظ الربط الجديد.</div>` : ""}</article></section>`;
    }
    const balance = broker.accountBalance || {}, currency = broker.currency || "USD";
    const positions = (Array.isArray(broker.positions) ? broker.positions : []).map((position) => `<tr><td><b>${escapeHtml(position.instrumentName || position.epic)}</b><small class="muted" dir="ltr"> ${escapeHtml(position.epic)}</small></td><td>${directionLabel(String(position.direction).toLowerCase())}</td><td dir="ltr">${balanceAmount(position.size)}</td><td dir="ltr">${balanceAmount(position.level)}</td><td dir="ltr">${accountMoney(position.profitLoss, position.currency || currency)}</td><td>${localDate(position.createdAt, true)}</td></tr>`).join("");
    return `<section class="stats-grid">${statCard("C", "بيئة Capital.com", broker.environment === "live" ? "حقيقي — عرض فقط" : "Demo — عرض فقط", broker.accountName || broker.accountLabel || "حساب Capital.com")}${statCard("$", "الرصيد لدى Capital.com", accountMoney(balance.balance, currency), "كما ورد من المنصة")}${statCard("◇", "المتاح لدى Capital.com", accountMoney(balance.available, currency), "ليس رصيد VAREX التجريبي")}${statCard("⌁", "الربح والخسارة لدى المنصة", accountMoney(balance.profitLoss, currency), "حسب بيانات الحساب لدى Capital.com")}</section>
      <article class="panel"><header class="panel-head"><div><h2>حساب Capital.com المرتبط</h2><p>${escapeHtml(broker.accountLabel)} · ${escapeHtml(broker.accountId || "—")} · ${escapeHtml(currency)}</p></div><span class="badge ${broker.status === "connected" ? "active" : "inactive"}">${broker.status === "connected" ? "متصل — عرض فقط" : "يحتاج فحصاً"}</span></header><div class="notice">وقت بيانات الرصيد والمراكز: ${localDate(broker.snapshotAt, true)}. آخر محاولة فحص: ${localDate(broker.lastCheckedAt, true)}. هذا الربط يعرض الحساب والمراكز فقط. التداول الآلي في VAREX يعمل على رصيد تجريبي داخلي مستقل.</div>${broker.lastError ? `<div class="live-warning">${escapeHtml(broker.lastError)}</div>` : ""}<div class="panel-actions broker-actions"><button class="secondary-button" data-action="refresh-broker">تحديث الحساب والمراكز</button><button class="secondary-button" data-broker-connect="capital">تغيير بيانات الربط</button><button class="danger-button" data-action="disconnect-broker">فصل الحساب</button></div></article>
      <section class="panel"><header class="panel-head"><div><h2>المراكز المفتوحة لدى Capital.com</h2><p>عرض مباشر من الحساب المرتبط؛ لا توجد أزرار تنفيذ أو إغلاق داخل VAREX.</p></div></header><div class="table-wrap">${positions ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>الحجم</th><th>سعر الفتح</th><th>الربح والخسارة</th><th>وقت الفتح</th></tr></thead><tbody>${positions}</tbody></table>` : '<div class="empty"><p>لا توجد مراكز مفتوحة في الحساب المرتبط حالياً.</p></div>'}</div></section>`;
  }
  function renderBinanceBroker() {
    const flow = `<section class="money-flow"><article><span>1</span><div><b>الإيداع</b><small>داخل Binance من حساب موثّق</small></div></article><i>←</i><article><span>2</span><div><b>التداول</b><small>VAREX يرسل أوامر Spot فقط</small></div></article><i>←</i><article><span>3</span><div><b>السحب</b><small>داخل Binance فقط</small></div></article></section>`;
    if (!app.broker?.connected || app.broker.provider !== "binance" || app.brokerFormOpen) {
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

  function renderAutomation() {
    const automation = app.automation;
    if (!automation) return `<section class="panel"><div class="empty"><span>${app.automationLoading ? "⌛" : "◇"}</span><h2>تداول آلي تجريبي 24 ساعة</h2><p>${escapeHtml(app.automationError || "جاري قراءة حالة البوت من الخادم…")}</p>${app.automationLoading ? "" : '<button class="small-button" data-action="refresh-automation">إعادة تحميل الحالة</button>'}</div></section>`;
    const running = automation.enabled === true && automation.schedulerReady === true;
    const status = !automation.schedulerReady ? "الجدولة غير متاحة" : running ? "يعمل على الحساب التجريبي" : "متوقف";
    const draft = formDraft("automationForm", { symbol: automation.symbol || "BTC-USD", interval: automation.interval || "15", riskPercent: automation.riskPercent ?? 1, maxDailyTrades: automation.maxDailyTrades ?? 5, enableAutomation: automation.enabled === true });
    const symbols = ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"];
    const events = (Array.isArray(automation.events) ? automation.events : []).slice(0, 50).map((event) => `<tr><td>${localDate(event.at, true)}</td><td dir="ltr">${escapeHtml(event.symbol || "—")}</td><td>${escapeHtml(({ buy: "شراء تجريبي", sell: "بيع تجريبي", open: "فتح تجريبي", close: "إغلاق تجريبي", wait: "انتظار", error: "تعذر التنفيذ", enabled: "تفعيل", stopped: "إيقاف", configured: "تحديث الإعدادات" })[event.action] || event.action)}</td><td>${escapeHtml(event.message || "—")}</td></tr>`).join("");
    const model = automation.lastModel;
    const measuredRate = (value) => typeof value === "number" && value >= 0 && value <= 1 ? `${(value * 100).toFixed(1)}%` : "—";
    return `<section class="va-automation-entry"><div><span class="va-eyebrow">رصيد VAREX التجريبي فقط</span><h2>تداول آلي تجريبي 24 ساعة</h2><p>بعد التفعيل، يفحص الخادم السوق دورياً حتى عند إغلاق الكمبيوتر أو المتصفح. قد يبقى القرار «انتظار» لفترات طويلة بحسب البيانات والشروط.</p></div><span class="badge ${running ? "active" : "pending"}">${status}</span></section>
      ${app.automationError ? `<div class="live-warning">${escapeHtml(app.automationError)}</div>` : ""}
      <section class="stats-grid">${statCard("◷", "حالة الجدولة", automation.schedulerReady ? "متاحة" : "غير متاحة", running ? "مفعّل على الخادم" : "لا يُعرض تشغيل دون تأكيد الخادم")}${statCard("⌁", "آخر إشارة", directionLabel(automation.lastSignal), "إشارة تحليل وليست ضماناً للتنفيذ")}${statCard("◇", "آخر فحص", localDate(automation.lastRunAt, true), "الوقت الذي أبلغ عنه الخادم")}${statCard("▣", "الحد اليومي", String(automation.maxDailyTrades ?? 5), "الحد الأقصى لصفقات البوت في اليوم")}</section>
      <section class="content-grid equal-grid"><form class="panel" id="automationForm"><header class="panel-head"><div><h2>إعداد البوت التجريبي</h2><p>التداول الآلي على الحسابات الحقيقية غير متاح حالياً.</p></div><span class="badge pending">DEMO</span></header>
        <div class="form-grid"><label class="control">السوق<select name="symbol">${symbols.map((symbol) => `<option value="${symbol}" ${draft.symbol === symbol ? "selected" : ""}>${symbol}</option>`).join("")}</select></label><label class="control">فترة الشموع<select name="interval">${[["5", "5 دقائق"], ["15", "15 دقيقة"], ["60", "ساعة"]].map(([id, label]) => `<option value="${id}" ${draft.interval === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="control">المخاطرة لكل صفقة %<input name="riskPercent" type="number" min="0.25" max="2" step="0.25" value="${escapeHtml(draft.riskPercent)}" required></label><label class="control">الحد اليومي لصفقات البوت<input name="maxDailyTrades" type="number" min="1" max="20" step="1" value="${escapeHtml(draft.maxDailyTrades)}" required></label></div>
        <label class="check security-check"><input name="enableAutomation" type="checkbox" ${draft.enableAutomation ? "checked" : ""} ${!app.profile.canTrade || !automation.available || !automation.schedulerReady ? "disabled" : ""}><span>تفعيل فتح وإغلاق صفقات البوت على الرصيد التجريبي الداخلي فقط.</span></label>
        ${!automation.available || !automation.schedulerReady ? '<div class="notice">التشغيل غير متاح حالياً. حالة الخادم وسجل الفحص أدناه يوضحان السبب عند توفره.</div>' : ""}
        ${app.profile.canTrade ? `<div class="panel-actions"><button class="primary-button" type="submit" ${automationMutationPending ? "disabled" : ""}>حفظ إعدادات البوت</button>${automation.enabled ? `<button class="danger-button" type="button" data-action="stop-automation" ${automationMutationPending ? "disabled" : ""}>إيقاف البوت</button>` : ""}</div>` : '<div class="notice">التفعيل وتعديل الإعدادات يتطلبان صلاحية تداول.</div>'}
      </form><article class="panel"><header class="panel-head"><div><h2>كيف يتخذ البوت القرار؟</h2><p>نموذج إحصائي صغير مع مؤشرات فنية.</p></div></header><div class="notice">يستخدم شموعاً مغلقة ومؤشرات EMA وRSI وMACD وATR، مع اختبار النموذج على بيانات سابقة لم تدخل في تدريبه. دقة هذا الاختبار ليست احتمال ربح الصفقة ولا وعداً بالربح.</div><div class="permission-list"><p><span>دقة التحقق على بيانات سابقة</span><b dir="ltr">${measuredRate(model?.accuracy)}</b></p><p><span>خط أساس للمقارنة</span><b dir="ltr">${measuredRate(model?.baseline)}</b></p><p><span>عدد عينات التحقق</span><b>${Number.isInteger(model?.samples) && model.samples >= 0 ? model.samples : "—"}</b></p></div><div class="notice">آخر رسالة من الخادم: ${escapeHtml(automation.lastMessage || "لا توجد نتيجة فحص محفوظة بعد.")}</div><div class="va-help-note">الإيقاف يمنع فتح الصفقات وإدارة صفقات البوت لاحقاً. تبقى الصفقات التجريبية المفتوحة في شاشة «الصفقات» ويمكن إغلاقها يدوياً.</div><button class="secondary-button" data-view="trades">عرض الصفقات التجريبية</button></article></section>
      <section class="panel"><header class="panel-head"><div><h2>سجل البوت التجريبي</h2><p>إشارات الانتظار والعمليات والأخطاء التي سجلها الخادم.</p></div></header><div class="table-wrap">${events ? `<table class="data-table"><thead><tr><th>الوقت</th><th>السوق</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>${events}</tbody></table>` : '<div class="empty"><p>لا يوجد سجل للبوت بعد.</p></div>'}</div></section>`;
  }
  function validateAutomation(value) {
    if (!isRecord(value) || value.mode !== "demo" || typeof value.enabled !== "boolean" || typeof value.schedulerReady !== "boolean" || typeof value.available !== "boolean" || !Number.isInteger(value.revision) || value.revision < 0) throw new Error("تعذر التحقق من حالة البوت التجريبي.");
    return value;
  }
  async function loadAutomation() {
    if (!app.profile) return;
    if (automationRequest) return automationRequest;
    const userId = app.profile.id;
    app.automationLoading = true;
    app.automationError = "";
    if (app.view === "automation") render();
    const pending = request("/api/trading-automation").then((result) => {
      const value = validateAutomation(result.automation);
      if (app.profile?.id !== userId) return;
      if (!app.automation || value.revision >= app.automation.revision) app.automation = value;
    }).catch((error) => {
      if (app.profile?.id === userId) app.automationError = error.message;
    }).finally(() => {
      if (automationRequest === pending) automationRequest = null;
      if (app.profile?.id !== userId) return;
      app.automationLoading = false;
      if (app.view === "automation") render();
    });
    automationRequest = pending;
    return pending;
  }
  async function configureAutomation(config, { preserveDrafts = false } = {}) {
    if (automationMutationPending) return;
    if (!app.profile?.canTrade || !app.automation) throw new Error("يلزم تحميل حالة البوت وحساب يملك صلاحية التداول.");
    const current = app.automation, userId = app.profile.id;
    if (!["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"].includes(config.symbol) || !["5", "15", "60"].includes(config.interval) || !Number.isFinite(config.riskPercent) || config.riskPercent < 0.25 || config.riskPercent > 2 || !Number.isInteger(config.maxDailyTrades) || config.maxDailyTrades < 1 || config.maxDailyTrades > 20) throw new Error("إعدادات البوت خارج الحدود المسموحة.");
    if (config.enabled && (!current.available || !current.schedulerReady)) throw new Error("الجدولة غير متاحة. لا يمكن عرض البوت كأنه يعمل.");
    automationMutationPending = true;
    try {
      if (config.enabled) {
        const accepted = await confirmAction("تفعيل التداول الآلي التجريبي", "سيفتح البوت ويغلق صفقاته على رصيد VAREX التجريبي، حتى عند إغلاق المتصفح. لا يستخدم أي رصيد حقيقي في Binance أو Capital.com، ولا يضمن تحقيق ربح.");
        if (!accepted) return;
      }
      if (app.profile?.id !== userId || app.automation?.revision !== current.revision) throw new Error("تغيّرت حالة البوت. يلزم مراجعة الإعدادات قبل إعادة المحاولة.");
      const result = await request("/api/trading-automation", { method: "POST", body: JSON.stringify({ action: "configure", mode: "demo", ...config, expectedRevision: current.revision, confirmation: config.enabled ? "ENABLE_DEMO_AUTOMATION" : "STOP_DEMO_AUTOMATION" }) });
      const value = validateAutomation(result.automation);
      if (app.profile?.id !== userId) return;
      app.automation = value;
      app.automationError = "";
      if (preserveDrafts) app.formDrafts.automationForm = { ...app.formDrafts.automationForm, enableAutomation: false };
      else delete app.formDrafts.automationForm;
      showToast(value.enabled && value.schedulerReady ? "تم تفعيل البوت على الحساب التجريبي." : "تم حفظ الحالة. البوت التجريبي متوقف.");
    } finally {
      automationMutationPending = false;
      if (app.profile?.id === userId && app.view === "automation") render();
    }
  }
  async function stopAutomation() {
    if (!app.automation?.enabled) return;
    const { symbol, interval, riskPercent, maxDailyTrades } = app.automation;
    try { await configureAutomation({ enabled: false, symbol, interval, riskPercent, maxDailyTrades }, { preserveDrafts: true }); }
    catch (error) { showToast(error.message, "error"); }
  }

  function renderWatchlist() {
    const symbols = formDraft("watchlistForm", { symbols: app.state.watchlist }).symbols;
    const cards = app.supportedMarkets.map((item) => {
      const market = getMarket(item.symbol), checked = symbols.includes(item.symbol);
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
    return `<section class="stats-grid">${statCard("$", "الربح والخسارة المحققة", money(metrics.realized), "من كل الصفقات المغلقة", metrics.realized >= 0 ? "positive" : "negative")}${statCard("%", "نسبة النجاح", `${metrics.winRate.toFixed(1)}%`, `${metrics.wins} رابحة · ${metrics.losses} خاسرة`)}${statCard("▣", "صفقات مغلقة", String(metrics.closed.length), "ضمن الحساب الحالي")}${statCard("⌁", "القيمة التجريبية", money(metrics.equity), "الرصيد مع النتائج غير المحققة")}</section>
      <section class="content-grid equal-grid"><article class="panel"><header class="panel-head"><div><h2>النتيجة حسب السوق</h2><p>صفقات مغلقة فقط.</p></div></header><div class="report-bars">${bars || '<div class="empty"><p>لا توجد بيانات كافية للرسم.</p></div>'}</div></article><article class="panel"><header class="panel-head"><div><h2>ملاحظات التقرير</h2><p>طريقة احتساب واضحة.</p></div></header><div class="notice">النتائج محسوبة من فرق سعر الدخول والخروج الفعلي الذي سجله الخادم عند إغلاق الصفقة التجريبية. لا تتضمن عمولات وسيط أو انزلاقاً سعرياً.</div></article></section>
      <section class="panel"><header class="panel-head"><div><h2>تفاصيل الصفقات المغلقة</h2><p>يمكن تصديرها بصيغة CSV.</p></div></header><div class="table-wrap">${rows ? `<table class="data-table"><thead><tr><th>السوق</th><th>الاتجاه</th><th>الحجم</th><th>النتيجة</th><th>الإغلاق</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty"><p>لا توجد صفقات مغلقة بعد.</p></div>'}</div></section>`;
  }

  function renderUsers() {
    if (!app.profile.canManageUsers) return '<div class="notice">هذه الشاشة متاحة لحساب الإدارة فقط.</div>';
    if (app.usersLoading) return '<section class="panel"><div class="empty"><span class="loader"></span><p>جاري تحميل الحسابات…</p></div></section>';
    const cards = app.users.map((user) => {
      const developer = user.role === "developer", inactive = user.status === "inactive" || user.status === "revoked";
      const status = inactive ? "inactive" : user.pending ? "pending" : user.status, role = app.userRoleDrafts[user.email] || user.role;
      return `<div class="user-card" data-user-row="${escapeHtml(user.email)}"><p><b>${escapeHtml(user.displayName)}</b><small dir="ltr">${escapeHtml(user.email)}</small></p><aside><span class="badge ${status}">${status === "pending" ? "بانتظار التسجيل" : status === "active" ? "نشط" : "متوقف"}</span>${developer ? '<span class="badge active">إدارة</span>' : `<select class="small-button user-role" aria-label="صلاحية ${escapeHtml(user.displayName)}"><option value="trader" ${role === "trader" ? "selected" : ""}>صلاحية تداول</option><option value="viewer" ${role === "viewer" ? "selected" : ""}>عرض فقط</option></select><button class="small-button" data-user-save="${escapeHtml(user.email)}">حفظ الصلاحية</button><button class="small-button" data-user-toggle="${escapeHtml(user.email)}" data-status="${inactive ? "active" : "inactive"}">${inactive ? "تفعيل" : "إيقاف"}</button>`}</aside></div>`;
    }).join("");
    return `<section class="content-grid"><form class="panel" id="inviteForm"><header class="panel-head"><div><h2>تحديد صلاحية مسبقاً — اختياري</h2><p>التسجيل مفتوح للجميع. تستخدم هذه الخانة فقط لتحديد صلاحية خاصة قبل التسجيل.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" required maxlength="80" placeholder="مثال: إدارة الاستثمار"></label><label class="control">البريد الإلكتروني<input name="email" type="email" required placeholder="user@example.com"></label><label class="control">الصلاحية<select name="role"><option value="trader">صلاحية تداول — فتح وإغلاق صفقات وربط حساب تداول مستقل</option><option value="viewer">عرض فقط — قراءة فقط</option></select></label></div><button class="primary-button" type="submit">حفظ الصلاحية المسبقة</button></form><article class="panel"><header class="panel-head"><div><h2>التسجيل المباشر</h2><p>لا حاجة إلى إضافة البريد من حساب المطور.</p></div></header><div class="notice">يُنشأ الحساب مباشرة من صفحة التسجيل، ثم يصل رمز OTP إلى البريد. لكل حساب ملف ورصيد تجريبي وصفقات وربط تداول منفصل تماماً عن بقية الحسابات.</div></article></section><section class="panel"><header class="panel-head"><div><h2>قائمة الحسابات</h2><p>${app.users.length} حساباً أو إعداد صلاحية.</p></div><button class="small-button" data-action="reload-users">تحديث</button></header>${cards || '<div class="empty"><p>لا توجد حسابات بعد.</p></div>'}</section>`;
  }

  function renderSettings() {
    const settings = formDraft("settingsForm", app.state.settings), profile = formDraft("profileForm", app.profile);
    return `<section class="settings-stack"><form class="panel" id="profileForm"><header class="panel-head"><div><h2>بيانات الحساب</h2><p>يظهر اسم المستخدم في التحية والقائمة.</p></div></header><div class="form-grid"><label class="control">اسم المستخدم<input name="displayName" value="${escapeHtml(profile.displayName)}" maxlength="80" required></label><label class="control">البريد الإلكتروني<input value="${escapeHtml(app.profile.email)}" disabled dir="ltr"></label></div><button class="primary-button" type="submit">حفظ اسم المستخدم</button></form>
      <form class="panel" id="settingsForm"><header class="panel-head"><div><h2>تفضيلات الواجهة</h2><p>محفوظة في حسابك على قاعدة البيانات.</p></div></header><div class="form-grid"><label class="control">المنطقة الزمنية<select name="timezone"><option value="Asia/Dubai" ${settings.timezone === "Asia/Dubai" ? "selected" : ""}>الإمارات — دبي</option><option value="Asia/Riyadh" ${settings.timezone === "Asia/Riyadh" ? "selected" : ""}>السعودية — الرياض</option><option value="UTC" ${settings.timezone === "UTC" ? "selected" : ""}>UTC</option></select></label></div><div class="toggle-row"><p><b>إشعارات داخل التطبيق</b><small>إظهار تنبيهات نجاح العمليات وأخطاء السوق</small></p><button type="button" class="switch ${settings.notifications ? "on" : ""}" data-toggle-setting="notifications"><i></i></button></div><div class="toggle-row"><p><b>الوضع المضغوط</b><small>تقليل المسافات داخل البطاقات والجداول</small></p><button type="button" class="switch ${settings.compactMode ? "on" : ""}" data-toggle-setting="compactMode"><i></i></button></div><button class="primary-button" type="submit">حفظ التفضيلات</button></form>
      ${app.profile.canTrade ? '<article class="panel danger-zone"><header class="panel-head"><div><h2>إعادة ضبط التداول التجريبي</h2><p>يحذف الصفقات والتحليلات ويعيد الرصيد إلى 25,000 دولار. لا يحذف الحساب أو الحسابات المضافة.</p></div></header><button class="danger-button" data-action="reset-paper">إعادة الضبط</button></article>' : ""}
    </section>`;
  }

  async function handleActionClick(event) {
    const accountChoice = event.target.closest("[data-account-choice]");
    if (accountChoice) {
      event.preventDefault?.();
      if (!app.profile) return;
      app.executionMode = "paper";
      app.accountChoice = accountChoice.dataset.accountChoice === "connect" ? "linked" : "demo";
      updateExecutionUi();
      return goTo(app.accountChoice === "linked" ? "broker" : "trades");
    }
    const brokerChoice = event.target.closest("[data-broker-provider]");
    const brokerConnect = event.target.closest("[data-broker-connect]");
    if (brokerChoice || brokerConnect) {
      event.preventDefault?.();
      const id = brokerChoice?.dataset.brokerProvider || brokerConnect?.dataset.brokerConnect;
      const provider = window.VarexAccounts?.getProvider(id);
      if (!provider || !app.profile) return;
      app.brokerProvider = provider.id;
      app.brokerFormOpen = Boolean(brokerConnect && app.profile.canConnectBroker && provider.capability !== "unavailable");
      app.accountChoice = "linked";
      render();
      return;
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) return goTo(viewButton.dataset.view);
    const marketButton = event.target.closest("[data-market]");
    if (marketButton) {
      try {
        const result = await tradingPost("save_preferences", { selectedSymbol: marketButton.dataset.market });
        app.state = result.state; app.version = result.version;
        app.formDrafts.tradeForm = { ...app.formDrafts.tradeForm, symbol: marketButton.dataset.market };
        await runAnalysis(marketButton.dataset.market);
      } catch (error) { showToast(error.message, "error"); }
      return;
    }
    const useAnalysis = event.target.closest("[data-use-analysis]");
    if (useAnalysis) {
      app.tradeSide = useAnalysis.dataset.side === "sell" ? "sell" : "buy";
      app.executionMode = "paper";
      app.formDrafts.tradeForm = { ...app.formDrafts.tradeForm, symbol: useAnalysis.dataset.useAnalysis };
      return goTo("trades");
    }
    const executionMode = event.target.closest("[data-execution-mode]");
    if (executionMode) {
      app.executionMode = executionMode.dataset.executionMode === "live" && liveExecutionReady() ? "live" : "paper";
      render(); return;
    }
    const sideButton = event.target.closest("[data-side]");
    if (sideButton) { app.tradeSide = sideButton.dataset.side; render(); return; }
    const toggleRisk = event.target.closest("[data-toggle-risk]");
    if (toggleRisk) {
      const key = toggleRisk.dataset.toggleRisk, risk = formDraft("riskForm", app.state.risk);
      app.formDrafts.riskForm = { ...app.formDrafts.riskForm, [key]: !risk[key] };
      render(); return;
    }
    const toggleSetting = event.target.closest("[data-toggle-setting]");
    if (toggleSetting) {
      const key = toggleSetting.dataset.toggleSetting, settings = formDraft("settingsForm", app.state.settings);
      app.formDrafts.settingsForm = { ...app.formDrafts.settingsForm, [key]: !settings[key] };
      render(); return;
    }
    const analyze = event.target.closest("[data-analyze]");
    if (analyze) return runAnalysis(analyze.dataset.analyze);
    const close = event.target.closest("[data-close-trade]");
    if (close) return closeTrade(close.dataset.closeTrade);
    const userSave = event.target.closest("[data-user-save]");
    if (userSave) {
      const row = userSave.closest("[data-user-row]"), role = $(".user-role", row).value;
      const user = app.users.find((item) => item.email === userSave.dataset.userSave);
      if (!user) return;
      const status = user.status === "inactive" || user.status === "revoked" ? "inactive" : "active";
      userSave.disabled = true;
      try { return await updateUser(user.email, role, status, "role"); }
      finally { userSave.disabled = false; }
    }
    const userToggle = event.target.closest("[data-user-toggle]");
    if (userToggle) {
      const user = app.users.find((item) => item.email === userToggle.dataset.userToggle);
      if (!user) return;
      userToggle.disabled = true;
      try { return await updateUser(user.email, user.role, userToggle.dataset.status); }
      finally { userToggle.disabled = false; }
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "refresh-markets") return refreshMarkets();
    if (action === "refresh-technical") return marketWorkspace?.refresh();
    if (action === "guided-analysis") return runAnalysis(currentSymbol());
    if (action === "analyze-current") return runAnalysis(currentSymbol());
    if (action === "export-report") return exportReport();
    if (action === "reload-users") return loadUsers();
    if (action === "refresh-broker") return refreshBroker();
    if (action === "disconnect-broker") return disconnectBroker();
    if (action === "refresh-automation") return loadAutomation();
    if (action === "stop-automation") return stopAutomation();
    if (action === "logout") return logout();
    if (action === "reset-paper") return resetPaper();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target, data = new FormData(form), submit = form.querySelector('button[type="submit"]');
    if (pendingForms.has(form.id)) return;
    pendingForms.add(form.id);
    if (submit) submit.disabled = true;
    try {
      if (form.id === "tradeForm") {
        const symbol = String(data.get("symbol")), amount = Number(data.get("amount")), side = app.tradeSide;
        if (app.executionMode === "live") {
          if (!liveExecutionReady()) throw new Error("التنفيذ الحقيقي متاح فقط لاتصال Binance مُفعّل وبعد تأكيد يدوي.");
          const accepted = await confirmAction("تأكيد صفقة حقيقية", `سيتم إرسال أمر ${side === "buy" ? "شراء" : "بيع"} MARKET حقيقي بقيمة ${money(amount)} على ${symbol} إلى Binance Spot. التداول قد يحقق خسارة، ولا توجد إعادة تلقائية عند انقطاع الاتصال.`);
          if (!accepted) return;
          const result = await tradingPost("place_live_order", { symbol, side, amount, clientRequestId: crypto.randomUUID(), confirmation: "LIVE_ORDER_CONFIRMED" });
          app.broker = result.broker;
          updateExecutionUi();
          showToast("تم إرسال الأمر الحقيقي إلى Binance وحفظ نتيجة التنفيذ.");
          goTo("broker");
        } else {
          const result = await tradingPost("open_trade", { symbol, side, amount });
          app.state = result.state; app.version = result.version;
          await loadMarkets(app.state.selectedSymbol, true);
          showToast("تم فتح الصفقة التجريبية. لم يُخصم أي مال حقيقي.");
          goTo("trades");
        }
      } else if (form.id === "riskForm") {
        const risk = { ...formDraft("riskForm", app.state.risk), maxDailyLossPct: Number(data.get("maxDailyLossPct")), maxOpenTrades: Number(data.get("maxOpenTrades")), riskPerTradePct: Number(data.get("riskPerTradePct")) };
        const result = await tradingPost("save_preferences", { risk });
        app.state = result.state; app.version = result.version;
        delete app.formDrafts.riskForm;
        showToast("تم حفظ حدود المخاطر وتفعيلها.");
        render();
      } else if (form.id === "watchlistForm") {
        const watchlist = data.getAll("symbols").map(String);
        if (!watchlist.length) throw new Error("يجب اختيار سوق واحد على الأقل.");
        const result = await tradingPost("save_preferences", { watchlist });
        app.state = result.state; app.version = result.version;
        delete app.formDrafts.watchlistForm;
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
        delete app.formDrafts.profileForm;
        applyIdentity();
        showToast("تم تحديث اسم المستخدم.");
        render();
      } else if (form.id === "settingsForm") {
        const settings = { ...formDraft("settingsForm", app.state.settings), timezone: String(data.get("timezone")) };
        const result = await tradingPost("save_preferences", { settings });
        app.state = result.state; app.version = result.version;
        delete app.formDrafts.settingsForm;
        applyIdentity();
        showToast("تم حفظ التفضيلات.");
        render();
      } else if (form.id === "brokerConnectForm" || form.id === "capitalConnectForm") {
        if (!app.profile?.canConnectBroker) throw new Error("صلاحية الحساب لا تسمح بربط منصة تداول.");
        const provider = form.id === "capitalConnectForm" ? "capital" : "binance";
        const replacement = {};
        if (app.broker?.connected) {
          const revision = app.broker.connectionRevision;
          const accepted = await confirmAction("استبدال حساب منصة التداول", `سيُستبدل اتصال ${providerLabel()} الحالي ببيانات ${window.VarexAccounts?.getProvider(provider)?.label || provider} الجديدة. يبقى الرصيد والمراكز لدى المنصة؛ يتوقف التنفيذ الحقيقي داخل VAREX إلى حين تفعيله صراحةً لاتصال يدعم التنفيذ.`);
          if (!accepted) return;
          if (revision == null || app.broker?.connectionRevision !== revision) throw new Error("تغيّر اتصال الحساب. يلزم تحديث بيانات الربط قبل إعادة المحاولة.");
          replacement.replacementConfirmation = "REPLACE_BROKER";
          replacement.expectedConnectionRevision = revision;
        }
        const payload = {
          provider, accountLabel: String(data.get("accountLabel") || ""),
          apiKey: String(data.get("apiKey") || ""), fundsAtProvider: Boolean(data.get("fundsAtProvider")),
          ...replacement,
        };
        if (provider === "capital") {
          const environment = String(data.get("environment"));
          if (!["demo", "live"].includes(environment)) throw new Error("بيئة Capital.com غير صالحة.");
          Object.assign(payload, { environment, identifier: String(data.get("identifier") || ""), apiPassword: String(data.get("apiPassword") || "") });
        } else payload.apiSecret = String(data.get("apiSecret") || "");
        const result = await tradingPost("connect_broker", payload);
        app.broker = result.broker;
        app.executionMode = "paper";
        app.brokerProvider = provider;
        app.brokerFormOpen = false;
        app.accountChoice = "linked";
        form.reset();
        updateExecutionUi();
        showToast(provider === "capital" ? "تم ربط Capital.com لعرض الحساب والمراكز فقط." : "تم اختبار الصلاحيات وربط حساب Binance. التداول الحقيقي ما زال متوقفاً.");
        render();
      } else if (form.id === "liveConfigForm") {
        if (!app.profile?.canConnectBroker || !binanceConnected()) throw new Error("هذا الاتصال لا يدعم تفعيل التنفيذ الحقيقي.");
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
      } else if (form.id === "automationForm") {
        const enabled = Boolean(data.get("enableAutomation"));
        await configureAutomation({ enabled, symbol: String(data.get("symbol")), interval: String(data.get("interval")), riskPercent: Number(data.get("riskPercent")), maxDailyTrades: Number(data.get("maxDailyTrades")) });
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      pendingForms.delete(form.id);
      if (submit) submit.disabled = false;
      const currentSubmit = $(`#${form.id} button[type="submit"]`);
      if (currentSubmit) currentSubmit.disabled = false;
    }
  }

  async function runAnalysis(symbol) {
    const buttons = $$("[data-analyze], [data-market], [data-action=analyze-current], [data-action=guided-analysis]");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await tradingPost("analyze", { symbol });
      app.state = result.state; app.version = result.version;
      app.formDrafts.tradeForm = { ...app.formDrafts.tradeForm, symbol: app.state.selectedSymbol };
      await loadMarkets(symbol, true);
      app.exploreSymbol = symbol;
      showToast("تُفتح الآن لوحة التحليل الفني للسوق المحدّد.");
      goTo("intelligence");
    } catch (error) { showToast(error.message, "error"); }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
  async function closeTrade(tradeId) {
    const accepted = await confirmAction("إغلاق الصفقة التجريبية", "سيُستخدم سعر السوق الحي عند الإغلاق وتُحفظ النتيجة في التقرير.");
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
    if (!app.profile?.canConnectBroker) return;
    const buttons = $$('[data-action="refresh-broker"]');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await tradingPost("refresh_broker");
      app.broker = result.broker;
      updateExecutionUi();
      showToast(`تم فحص اتصال ${providerLabel()} وتحديث بيانات الحساب.`);
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
    if (!app.profile?.canConnectBroker || !app.broker?.connected) return;
    const label = providerLabel();
    const accepted = await confirmAction(`فصل حساب ${label}`, `سيتم حذف بيانات الربط المشفرة من VAREX وإيقاف التنفيذ الحقيقي عبره. تبقى الأموال والمراكز والأوامر لدى ${label}.`);
    if (!accepted) return;
    try {
      const result = await tradingPost("disconnect_broker", { confirmation: "DISCONNECT_BROKER" });
      app.broker = result.broker;
      app.executionMode = "paper";
      updateExecutionUi();
      app.brokerFormOpen = false;
      showToast(`تم فصل حساب ${label} وحذف بيانات الربط المشفرة.`);
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
  async function updateUser(email, role, status, operation = "status") {
    try {
      const user = app.users.find((item) => item.email === email);
      const result = await tradingPost("update_user", { email, role, status, displayName: user?.displayName || email.split("@")[0] });
      app.users = result.users || [];
      if (operation === "role") delete app.userRoleDrafts[email];
      showToast(operation === "role" ? "تم حفظ صلاحية الحساب دون تغيير حالة التفعيل." : status === "inactive" ? "تم إيقاف الحساب." : "تم تفعيل الحساب.");
      render();
    } catch (error) { showToast(error.message, "error"); }
  }
  async function resetPaper() {
    const accepted = await confirmAction("إعادة ضبط التداول التجريبي", "سيتم حذف كل الصفقات والتحليلات التجريبية وإعادة الرصيد إلى 25,000 دولار. لا يمكن التراجع.");
    if (!accepted) return;
    try {
      const result = await tradingPost("reset_paper");
      app.state = result.state; app.version = result.version;
      delete app.formDrafts.tradeForm;
      delete app.formDrafts.riskForm;
      await loadMarkets(app.state.selectedSymbol, true);
      showToast("تمت إعادة ضبط حساب التداول التجريبي.");
      render();
    } catch (error) { showToast(error.message, "error"); }
  }
  async function logout() {
    try { await authRequest("/api/auth/sign-out", {}); }
    catch (error) { showToast(error.message || "تعذر إنهاء الجلسة. يرجى إعادة المحاولة.", "error"); return; }
    app.profile = null; app.state = null; app.broker = null; app.users = []; app.executionMode = "paper";
    app.formDrafts = {}; app.userRoleDrafts = {}; app.view = "dashboard"; app.tradeSide = "buy";
    app.markets = []; app.selectedMarket = null; app.supportedMarkets = []; app.marketError = "";
    app.exploreSymbol = ""; app.exploreInterval = "60";
    app.accountChoice = "demo"; app.brokerProvider = "capital"; app.brokerQuery = ""; app.brokerFormOpen = false;
    app.automation = null; app.automationError = ""; app.automationLoading = false;
    entryDestination = null;
    stopMarketRefresh();
    marketRequestId += 1;
    pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
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
