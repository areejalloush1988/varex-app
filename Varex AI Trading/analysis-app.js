(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const core = () => window.VarexAnalysisAssistantCore;
  const dataFeed = () => window.VarexAnalysisData;
  const app = { profile: null, user: null, view: "analysis", symbol: "XAU-USD", interval: "60", dataset: null, report: null, reports: [], capabilities: {}, messages: [], loading: false, chatPending: false };
  let pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
  let toastTimer = 0, contextEpoch = 0, accessEpoch = 0, dataRequest = null, chatRequest = null, checkingAccess = false;
  const FALLBACK_MARKETS = [
    { symbol: "XAU-USD", name: "الذهب مقابل الدولار", shortName: "الذهب" },
    { symbol: "BTC-USD", name: "بيتكوين مقابل الدولار", shortName: "بيتكوين" },
    { symbol: "ETH-USD", name: "إيثريوم مقابل الدولار", shortName: "إيثريوم" },
    { symbol: "SOL-USD", name: "سولانا مقابل الدولار", shortName: "سولانا" },
    { symbol: "ADA-USD", name: "كاردانو مقابل الدولار", shortName: "كاردانو" },
  ];
  const FALLBACK_INTERVALS = [{ value: "1", label: "دقيقة" }, { value: "5", label: "5 د" }, { value: "15", label: "15 د" }, { value: "60", label: "ساعة" }, { value: "240", label: "4 س" }, { value: "D", label: "يوم" }, { value: "W", label: "أسبوع" }, { value: "M", label: "شهر" }];
  const REF_SYMBOLS = { "XAU-USD": "OANDA:XAUUSD", "BTC-USD": "COINBASE:BTCUSD", "ETH-USD": "COINBASE:ETHUSD", "SOL-USD": "COINBASE:SOLUSD", "ADA-USD": "COINBASE:ADAUSD" };
  const ICONS = { "XAU-USD": "Au", "BTC-USD": "₿", "ETH-USD": "Ξ", "SOL-USD": "◎", "ADA-USD": "₳" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const price = (value) => finite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 5 : 2 }).format(value) : "—";
  const localDate = (value) => { const date = new Date(value); return !value || !Number.isFinite(date.getTime()) ? "غير متاح" : date.toLocaleString("ar-AE", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }); };
  const markets = () => dataFeed()?.getMarkets?.() || FALLBACK_MARKETS;
  const intervals = () => dataFeed()?.getIntervals?.() || FALLBACK_INTERVALS;
  const selectedMarket = () => markets().find((market) => market.symbol === app.symbol) || FALLBACK_MARKETS[0];
  const intervalLabel = () => intervals().find((period) => period.value === app.interval)?.label || app.interval;
  function showToast(message, type = "success") { const toast = $("#toast"); toast.textContent = message; toast.className = `toast show ${type === "error" ? "error" : ""}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = "toast"; }, 4200); }
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
    const init = { credentials: "include", ...options, headers: { "Content-Type": "application/json", "X-Client-Info": "varex-ai-analysis/1.0", ...(options.headers || {}) } };
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
  function authRequest(path, body, method = "POST") {
    return request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
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

  function cancelContext() {
    contextEpoch += 1;
    dataRequest?.abort(); chatRequest?.abort();
    dataRequest = null; chatRequest = null;
    app.loading = false; app.chatPending = false;
    $$("#chatMessages .aa-message.pending").forEach((message) => message.remove());
    app.messages = app.messages.filter((message) => message.role !== "pending");
    $("#analyzeButton").disabled = false;
    $("#analyzeButton").innerHTML = '<span aria-hidden="true">✦</span> حلّل السوق';
    $("#chatForm button[type=submit]").disabled = false;
  }
  function clearPrivateWorkspace() {
    cancelContext();
    app.profile = null; app.user = null; app.dataset = null; app.report = null;
    app.reports = []; app.messages = []; app.capabilities = {};
    $("#chartRoot").replaceChildren(); $("#reportRoot").replaceChildren();
    $("#chatMessages").replaceChildren(); $("#historyRoot").replaceChildren();
    $("#chatInput").value = ""; $("#importForm").reset(); $("#csvText").value = ""; $("#csvFile").value = "";
    $("#importDialog").close();
  }
  function showLoggedOut(message = "") {
    clearPrivateWorkspace();
    $("#loadingScreen").classList.add("hidden");
    $("#appShell").classList.add("hidden");
    $("#authScreen").classList.remove("hidden");
    showAuthPane(new URLSearchParams(window.location.search).get("auth") === "login" ? "loginForm" : "registerPane");
    if (message) showAuthMessage(message);
  }
  function validAccess(access, session) {
    const profile = access?.profile;
    return isRecord(profile) && typeof profile.id === "string" && profile.id === session?.user?.id
      && profile.status === "active" && typeof profile.displayName === "string" && profile.displayName.trim()
      && ["developer", "trader", "viewer"].includes(profile.role);
  }
  async function verifiedProfile() {
    const session = await authRequest("/api/auth/get-session", undefined, "GET");
    if (!session?.user) { const error = new Error("يلزم تسجيل الدخول للمتابعة."); error.status = 401; throw error; }
    const access = await request("/api/trading?action=access", { method: "GET" });
    if (!validAccess(access, session)) { const error = new Error("الحساب غير متاح للوصول إلى مساحة التحليل."); error.status = 403; throw error; }
    return { profile: access.profile, user: session.user };
  }
  async function enterApp() {
    const epoch = ++accessEpoch;
    $("#loadingScreen").classList.remove("hidden");
    try {
      const verified = await verifiedProfile();
      if (epoch !== accessEpoch) return;
      clearPrivateWorkspace();
      app.profile = verified.profile; app.user = verified.user;
      $$('.auth-pane input[type="password"]').forEach((field) => { field.value = ""; });
      pendingAuth = { purpose: "", email: "", password: "", displayName: "", otp: "" };
      const query = new URLSearchParams(window.location.search);
      const symbol = query.get("symbol"), interval = query.get("interval");
      app.symbol = markets().some((item) => item.symbol === symbol) ? symbol : "XAU-USD";
      app.interval = intervals().some((item) => item.value === interval) ? interval : "60";
      app.reports = readReports();
      $("#authScreen").classList.add("hidden"); $("#appShell").classList.remove("hidden");
      $("#topUserName").textContent = app.profile.displayName;
      $("#avatar").textContent = app.profile.displayName.trim().slice(0, 2);
      $("#settingsEmail").textContent = app.user.email || "";
      $("#displayNameInput").value = app.profile.displayName;
      $("#dateLabel").textContent = new Date().toLocaleDateString("ar-AE", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long" });
      renderSelectors(); renderHistory(); renderLearn(); resetReport(); resetChat(); goTo("analysis");
      renderReferenceChart();
      loadCapabilities(epoch);
    } catch (error) {
      if (epoch === accessEpoch) showLoggedOut(error.message || "تعذر التحقق من الحساب.");
    } finally { if (epoch === accessEpoch) $("#loadingScreen").classList.add("hidden"); }
  }
  async function loadCapabilities(epoch) {
    try {
      const result = await request("/api/analysis/capabilities", { method: "GET", signal: AbortSignal.timeout(10000) });
      if (epoch !== accessEpoch || !app.profile) return;
      app.capabilities = result;
    } catch { if (epoch === accessEpoch) app.capabilities = {}; }
    if (epoch !== accessEpoch || !app.profile) return;
    $("#analysisMode").textContent = app.capabilities.languageModelAvailable === true ? "تحليل + شرح بالذكاء الاصطناعي" : "تحليل حسابي";
    $("#chatMode").textContent = app.capabilities.languageModelAvailable === true ? "شرح ذكي يستند إلى التقرير" : "شرح محلي للمؤشرات والقراءات";
  }
  async function revalidateAccess() {
    if (!app.profile || checkingAccess) return;
    checkingAccess = true;
    const previous = app.profile.id, epoch = ++accessEpoch;
    $("#appShell").classList.add("hidden"); $("#loadingScreen").classList.remove("hidden");
    cancelContext();
    try {
      const verified = await verifiedProfile();
      if (epoch !== accessEpoch) return;
      if (verified.profile.id !== previous) { await enterApp(); return; }
      app.profile = verified.profile; app.user = verified.user;
      $("#appShell").classList.remove("hidden");
      $("#topUserName").textContent = app.profile.displayName;
      if (!app.report) status("اختر «حلّل السوق» لتحميل الشموع المتاحة.");
      loadCapabilities(epoch);
    } catch (error) { if (epoch === accessEpoch) showLoggedOut(error.message || "انتهت الجلسة. سجّل الدخول مجدداً."); }
    finally { checkingAccess = false; if (epoch === accessEpoch) $("#loadingScreen").classList.add("hidden"); }
  }
  async function logout() {
    ++accessEpoch;
    showLoggedOut();
    try { await authRequest("/api/auth/sign-out", {}); }
    catch { showAuthMessage("تعذر تأكيد إنهاء الجلسة على الخادم. أعد المحاولة عند عودة الاتصال."); }
  }
  function closeMenu() { $("#sidebar").classList.remove("open"); $("#drawerBackdrop").classList.remove("show"); $("#menuButton").setAttribute("aria-expanded", "false"); }
  function openMenu() { $("#sidebar").classList.add("open"); $("#drawerBackdrop").classList.add("show"); $("#menuButton").setAttribute("aria-expanded", "true"); }
  function goTo(view) {
    if (!app.profile || !["analysis", "history", "learn", "settings"].includes(view)) return;
    app.view = view;
    const titles = { analysis: ["ماذا يحدث في السوق؟", "اختر السوق والفترة، ثم اطلب قراءة واضحة للشارت."], history: ["تقاريرك، في مكان واحد", "ارجع إلى القراءة كما كانت وقت إعدادها."], learn: ["افهم لغة الشارت", "شرح مبسّط للأدوات التي تظهر في التحليل."], settings: ["إعدادات الحساب", "مساحتك ومظهرك وبياناتك المحفوظة."] };
    $$(".aa-view").forEach((item) => item.classList.toggle("hidden", item.id !== `${view}View`));
    $$('[data-view]').forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    $("#pageTitle").textContent = titles[view][0]; $("#pageSubtitle").textContent = titles[view][1];
    $("#pageActions").classList.toggle("hidden", view !== "analysis");
    if (view === "history") renderHistory();
    closeMenu();
  }
  function renderSelectors() {
    $("#marketSelect").innerHTML = markets().map((item) => `<option value="${escapeHtml(item.symbol)}"${item.symbol === app.symbol ? " selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.symbol.replace("-", "/"))}</option>`).join("");
    $("#intervalButtons").innerHTML = intervals().map((item) => `<button type="button" data-interval="${escapeHtml(item.value)}" aria-pressed="${item.value === app.interval}">${escapeHtml(item.label)}</button>`).join("");
    $("#chartTitle").textContent = selectedMarket().name;
    $("#chartSymbol").textContent = app.symbol.replace("-", "/");
    $("#marketIcon").textContent = ICONS[app.symbol] || "⌁";
  }
  function changeContext(symbol, interval) {
    if (!app.profile || !markets().some((item) => item.symbol === symbol) || !intervals().some((item) => item.value === interval)) return;
    cancelContext(); app.symbol = symbol; app.interval = interval;
    app.dataset = null; app.report = null;
    $("#importForm").reset(); $("#csvText").value = "";
    renderSelectors(); resetReport(); resetChat(); renderReferenceChart();
    const url = new URL(window.location.href); url.searchParams.set("symbol", symbol); url.searchParams.set("interval", interval);
    url.searchParams.delete("account"); url.searchParams.delete("provider"); window.history.replaceState(null, "", url);
    status("اختر «حلّل السوق» لتحميل الشموع المتاحة.");
  }
  function status(message, kind = "") {
    const target = $("#dataStatus"); target.className = `aa-status-line ${kind}`;
    target.replaceChildren(); const dot = document.createElement("span"); dot.className = "aa-status-dot";
    const text = document.createElement("span"); text.textContent = message; target.append(dot, text);
  }
  function resetReport() {
    $("#saveReportButton").disabled = true; $("#saveReportButton").title = "";
    $("#reportRoot").innerHTML = '<div class="aa-empty aa-report-empty"><span aria-hidden="true">◈</span><h3>كل قراءة تبدأ ببيانات واضحة</h3><p>حمّل شموع السوق أو استورد ملفك لعرض الاتجاه والدعم والمقاومة والسيناريوهات. لا تُستنتج أسعار من الشارت المرجعي.</p></div>';
  }
  function resetChat() {
    app.messages = [];
    $("#chatMessages").innerHTML = `<div class="aa-chat-welcome"><span aria-hidden="true">✦</span><h3>خلّينا نفهم الشارت</h3><p>أستطيع شرح اتجاه ${escapeHtml(selectedMarket().shortName || selectedMarket().name)} ومستوياته بعد تحميل الشموع.<br>ويمكنك الآن سؤالي عن معنى RSI أو الدعم والمقاومة.</p></div>`;
  }
  function safeLink(value) {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
  }
  function attribution(dataset) {
    const label = dataset?.provenance?.attribution, href = safeLink(dataset?.provenance?.url || "");
    return typeof label === "string" && label ? (href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label)) : "";
  }
  function renderReferenceChart() {
    if (!app.profile) return;
    const symbol = REF_SYMBOLS[app.symbol], target = $("#chartRoot"); target.replaceChildren();
    $("#chartKind").textContent = "شارت مرجعي";
    $("#chartCaption").textContent = "عرض مرجعي من TradingView، مستقل عن محرك التحليل. مصدره قد يختلف عن ملفك؛ لا يقرأ المساعد بيانات هذا العرض. عند تحميل الشموع يظهر رسمها المطابق للتقرير هنا.";
    if (!symbol) { target.innerHTML = '<div class="aa-chart-notice"><b>حمّل الشموع لعرض الشارت</b><p>يُرسم الشارت من البيانات نفسها المستخدمة في التحليل.</p></div>'; return; }
    const container = document.createElement("div"); container.className = "tradingview-widget-container";
    const widget = document.createElement("div"); widget.className = "tradingview-widget-container__widget";
    const credit = document.createElement("div"); credit.className = "tradingview-widget-copyright";
    const link = document.createElement("a"); link.href = `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(":", "-"))}/`; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Chart by TradingView"; credit.append(link);
    const script = document.createElement("script"); script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"; script.type = "text/javascript"; script.async = true;
    script.textContent = JSON.stringify({ autosize: true, symbol, interval: app.interval, timezone: "Asia/Dubai", theme: document.documentElement.dataset.theme === "light" ? "light" : "dark", style: "1", locale: "ar_AE", allow_symbol_change: false, hide_side_toolbar: true, hide_top_toolbar: true, withdateranges: false, save_image: false, calendar: false, support_host: "https://www.tradingview.com" });
    script.onerror = () => { if (!app.dataset && target.contains(container)) target.innerHTML = '<div class="aa-chart-notice"><b>تعذر تحميل الشارت المرجعي</b><p>يمكنك تحميل بيانات السوق أو استيراد شموع CSV لعرض الرسم والتحليل هنا.</p></div>'; };
    container.append(widget, credit, script); target.append(container);
  }
  function renderCandleChart(dataset, report) {
    const source = Array.isArray(dataset?.candles) ? dataset.candles : [];
    const limit = report?.analysis?.lastCandleTime;
    const candles = source.filter((row) => finite(row.time) && finite(row.open) && finite(row.high) && finite(row.low) && finite(row.close) && (finite(limit) ? row.time <= limit : false)).slice(-75);
    if (!candles.length) { $("#chartRoot").innerHTML = '<div class="aa-chart-notice"><b>لا توجد شموع مكتملة للرسم</b><p>استورد تاريخاً كافياً وبفريم مطابق للاختيار.</p></div>'; return; }
    const width = 1000, height = 430, pad = { left: 14, right: 95, top: 24, bottom: 40 };
    const levels = [report.levels?.support, report.levels?.resistance].filter(finite);
    let min = Math.min(...candles.map((row) => row.low), ...levels), max = Math.max(...candles.map((row) => row.high), ...levels);
    const margin = (max - min) * .09 || Math.max(Math.abs(max) * .003, .00001); min -= margin; max += margin;
    const chartWidth = width - pad.left - pad.right, chartHeight = height - pad.top - pad.bottom, step = chartWidth / candles.length;
    const x = (index) => pad.left + step * (index + .5), y = (value) => pad.top + (max - value) / (max - min) * chartHeight;
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="aaChartTitle aaChartDesc"><title id="aaChartTitle">${escapeHtml(selectedMarket().name)} — ${escapeHtml(intervalLabel())}</title><desc id="aaChartDesc">آخر ${candles.length} شمعة مكتملة من ${escapeHtml(report.source)}، حتى ${escapeHtml(localDate(report.asOf))}. الخطان يحددان الحدين المرجعيين للدعم والمقاومة عند توفرهما.</desc>`;
    for (let i = 0; i <= 4; i += 1) { const v = min + (max - min) * i / 4, pos = y(v); svg += `<line x1="${pad.left}" y1="${pos}" x2="${width - pad.right}" y2="${pos}" stroke="var(--line)" opacity=".45"/><text x="${width - pad.right + 12}" y="${pos + 4}" fill="var(--muted)" font-size="13">${escapeHtml(price(v))}</text>`; }
    candles.forEach((row, i) => { const color = row.close >= row.open ? "var(--green)" : "var(--red)", top = y(Math.max(row.open,row.close)), bottom = y(Math.min(row.open,row.close)), candleWidth = Math.max(2, step * .62); svg += `<line x1="${x(i)}" y1="${y(row.high)}" x2="${x(i)}" y2="${y(row.low)}" stroke="${color}" stroke-width="1.5"/><rect x="${x(i)-candleWidth/2}" y="${top}" width="${candleWidth}" height="${Math.max(1.5,bottom-top)}" rx=".6" fill="${color}"/>`; });
    [[report.levels?.support,"var(--green)","دعم"],[report.levels?.resistance,"var(--red)","مقاومة"]].forEach(([value,color,label]) => { if (finite(value)) svg += `<line x1="${pad.left}" y1="${y(value)}" x2="${width-pad.right}" y2="${y(value)}" stroke="${color}" stroke-width="1.2" stroke-dasharray="6 5" opacity=".75"/><text x="${pad.left+6}" y="${y(value)-6}" fill="${color}" font-size="13">${label}</text>`; });
    [0,Math.floor((candles.length-1)/2),candles.length-1].forEach((i) => { const d = new Date(candles[i].time*1000).toLocaleString("en-GB",{timeZone:"UTC",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); svg += `<text x="${x(i)}" y="${height-12}" text-anchor="${i===0?"start":i===candles.length-1?"end":"middle"}" fill="var(--muted)" font-size="12">${escapeHtml(d)}</text>`; });
    $("#chartRoot").innerHTML = svg + "</svg>";
    $("#chartKind").textContent = report.imported ? "شموع مستوردة" : "شموع التحليل";
    const credit = attribution(dataset);
    $("#chartCaption").innerHTML = `${escapeHtml(report.source)} · ${candles.length} شمعة مكتملة معروضة · توقيت محور الشارت UTC. ${credit ? `<br>${credit}` : ""}`;
  }
  function renderReport(report, { historical = false } = {}) {
    const indicators = report.analysis?.indicators || {}, statusLabel = historical ? "تقرير محفوظ" : ({ ready: "قراءة مكتملة", limited: "قراءة محدودة", stale: "بيانات تاريخية", insufficient: "تاريخ غير كافٍ", unavailable: "غير متاح" })[report.status] || "قراءة فنية";
    const qualityNote = historical ? "تقرير محفوظ كما أُعدّ في وقته. لا يصف حالة السوق الحالية." : "";
    const warnings = [qualityNote, ...(Array.isArray(report.warnings) ? report.warnings : [])].filter(Boolean);
    const entries = [["RSI 14",indicators.rsi14?.available ? indicators.rsi14.value : null],["EMA 20",indicators.ema20?.available ? indicators.ema20.value : null],["EMA 50",indicators.ema50?.available ? indicators.ema50.value : null],["MACD",indicators.macd?.available ? indicators.macd.line : null],["ATR 14",indicators.atr14?.available ? indicators.atr14.value : null],["الشموع المكتملة",report.analysis?.candleCount]];
    $("#reportRoot").innerHTML = `<div class="aa-report-intro"><div><h3>${escapeHtml(report.trend?.label || "قراءة السوق")}</h3><p>${escapeHtml(report.summary || "")}</p></div><span class="aa-report-tag ${report.status === "stale" ? "stale" : ""}">${escapeHtml(statusLabel)}</span></div>
      <div class="aa-levels"><div class="aa-level close"><small>آخر إغلاق في البيانات</small><b>${escapeHtml(price(report.lastClose ?? report.analysis?.lastClose))}</b></div><div class="aa-level support"><small>الدعم المرجعي</small><b>${escapeHtml(price(report.levels?.support))}</b></div><div class="aa-level resistance"><small>المقاومة المرجعية</small><b>${escapeHtml(price(report.levels?.resistance))}</b></div></div>
      <p class="aa-muted">${escapeHtml(report.levels?.basis || "")}</p>
      <div class="aa-scenarios">${(Array.isArray(report.scenarios) ? report.scenarios : []).map((scenario) => `<article class="aa-scenario"><h4>${escapeHtml(scenario.label)}</h4><p>${escapeHtml(scenario.condition)}</p><p>${escapeHtml(scenario.interpretation || "")}</p><small>${escapeHtml(scenario.invalidation)}</small></article>`).join("")}</div>
      <div class="aa-indicator-grid">${entries.map(([label,value]) => `<div class="aa-indicator"><span>${escapeHtml(label)}</span><b>${finite(value) ? escapeHtml(price(value)) : "غير متاح"}</b></div>`).join("")}</div>
      ${warnings.length ? `<div class="aa-data-note">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
      <div class="aa-provenance"><span>المصدر: ${escapeHtml(report.source)}</span><span>الفريم: ${escapeHtml(report.intervalLabel || report.interval)}</span><span>آخر شمعة: ${escapeHtml(localDate(report.asOf))} بتوقيت الإمارات</span><span>الوضع: تحليل حسابي</span></div>
      <p class="aa-report-disclaimer">${escapeHtml(report.disclaimer || "قراءة وصفية من الشموع المكتملة؛ لا تثبت اتجاه السوق القادم.")}</p>`;
    const restricted = app.dataset?.allowExport === false || app.dataset?.provenance?.displayOnly === true;
    $("#saveReportButton").disabled = historical || restricted || !["ready","limited","stale","insufficient"].includes(report.status);
    $("#saveReportButton").title = restricted ? "شروط هذا المصدر تسمح بالعرض فقط؛ حفظ التقرير غير متاح." : "حفظ نسخة محلية لهذا الحساب";
  }
  function applyDataset(dataset) {
    if (!core()?.createReport) throw new Error("تعذر تحميل محرك التحليل. أعد تحميل الصفحة.");
    if (dataset.symbol !== app.symbol || dataset.interval !== app.interval) throw new Error("البيانات لا تطابق السوق أو الفريم المحدد.");
    const report = core().createReport(dataset);
    app.dataset = dataset; app.report = report;
    renderCandleChart(dataset, report); renderReport(report);
    const type = report.status === "ready" ? "ready" : "warning";
    status(`${report.imported ? "بيانات مستوردة" : "بيانات المصدر"} · ${report.analysis.candleCount} شمعة مكتملة · ${localDate(report.asOf)} · ${report.status === "stale" ? "قراءة تاريخية؛ ليست تحديثاً حالياً" : "اطّلع على جودة البيانات في التقرير"}`,type);
    return report;
  }
  async function analyze() {
    if (!app.profile || app.loading) return;
    cancelContext();
    const epoch = contextEpoch, controller = new AbortController(); dataRequest = controller;
    app.loading = true; app.dataset = null; app.report = null;
    resetReport(); resetChat(); renderReferenceChart();
    $("#analyzeButton").disabled = true; $("#analyzeButton").textContent = "تحميل وتحليل…";
    status("جاري تحميل الشموع والتحقق من مصدرها وتوقيتها…");
    try {
      if (!dataFeed()?.load) throw new Error("تعذر تحميل موصل بيانات السوق. أعد تحميل الصفحة.");
      const dataset = await dataFeed().load({ symbol: app.symbol, interval: app.interval, signal: controller.signal, force: true });
      if (epoch !== contextEpoch || !app.profile) return;
      const report = applyDataset(dataset);
      addMessage("assistant", report.summary, "تحليل حسابي");
    } catch (error) {
      if (epoch !== contextEpoch || error.name === "AbortError") return;
      const message = error.message || "بيانات السوق غير متاحة حالياً.";
      status(message,"warning");
      $("#reportRoot").innerHTML = `<div class="aa-empty aa-report-empty"><span aria-hidden="true">⌁</span><h3>التحليل يحتاج بيانات الشموع</h3><p>${escapeHtml(message)}</p><p>يمكنك استيراد شموع تخص السوق والفريم المحددين. سيُذكر مصدرها ووقتها في التقرير.</p><button type="button" class="secondary-button" data-action="import">استيراد CSV</button></div>`;
      addMessage("assistant",`${message}\nأستطيع الآن شرح المؤشرات، أو تحليل شموع CSV بعد استيرادها. لن أقدّم مستويات سعرية من دون بيانات.`,"شرح محلي");
    } finally { if (epoch === contextEpoch) { app.loading = false; dataRequest = null; $("#analyzeButton").disabled = false; $("#analyzeButton").innerHTML = '<span aria-hidden="true">✦</span> حلّل السوق'; } }
  }
  function addMessage(role, text, mode = "") {
    const target = $("#chatMessages"); target.querySelector(".aa-chat-welcome")?.remove();
    const message = document.createElement("article"); message.className = `aa-message ${role}`;
    const meta = document.createElement("div"); meta.className = "aa-message-meta";
    const name = document.createElement("b"); name.textContent = role === "user" ? "أنت" : "VAREX";
    const label = document.createElement("span"); label.textContent = mode; meta.append(name,label);
    const body = document.createElement("div"); body.className = "aa-message-body"; body.textContent = String(text || ""); message.append(meta,body); target.append(message);
    app.messages.push({ role, text: String(text || ""), mode });
    while (target.children.length > 40) target.firstElementChild.remove();
    if (app.messages.length > 40) app.messages.shift();
    target.scrollTop = target.scrollHeight;
    return message;
  }
  async function ask(question) {
    question = String(question || "").trim();
    if (!question || app.chatPending || !app.profile) return;
    if (question.length > 1000) return showToast("السؤال طويل. اختصره إلى 1,000 حرف أو أقل ثم أعد الإرسال.", "error");
    const epoch = contextEpoch;
    app.chatPending = true; $("#chatForm button[type=submit]").disabled = true;
    addMessage("user",question); $("#chatInput").value = "";
    const pending = addMessage("pending","جاري قراءة سؤالك…", "VAREX");
    try {
      let text = "", mode = "شرح محلي";
      if (app.capabilities.languageModelAvailable === true && app.report && app.report.status !== "unavailable") {
        const controller = new AbortController(); chatRequest = controller;
        const timer = setTimeout(() => controller.abort(),20000);
        try {
          const result = await request("/api/analysis/chat", { method: "POST", body: JSON.stringify({ question, context: app.report }), signal: controller.signal });
          if (typeof result.answer !== "string" || result.mode !== "language-model") throw new Error("invalid_analysis_answer");
          text = result.answer; mode = "شرح بالذكاء الاصطناعي";
        } catch (error) {
          if (epoch !== contextEpoch) return;
          const local = core()?.answerQuestion(question,app.report);
          text = "تعذّر الوصول إلى الشرح الموسّع. هذا شرح محلي يستند إلى البيانات المتاحة:\n\n" + (local?.text || "أعد المحاولة لاحقاً.");
        } finally { clearTimeout(timer); }
      } else {
        text = core()?.answerQuestion(question,app.report)?.text || "تعذر تحميل المساعد. أعد تحميل الصفحة.";
      }
      if (epoch !== contextEpoch || !app.profile) return;
      pending.remove(); app.messages = app.messages.filter((message) => message.role !== "pending");
      addMessage("assistant",text,mode);
    } catch (error) {
      if (epoch === contextEpoch && app.profile) { pending.remove(); addMessage("assistant",error.message || "تعذر إكمال الإجابة.","شرح محلي"); }
    } finally { if (epoch === contextEpoch) { chatRequest = null; app.chatPending = false; $("#chatForm button[type=submit]").disabled = false; } }
  }
  function historyKey() { return app.profile ? `varex.analysis.reports.v1.${encodeURIComponent(app.profile.id)}` : ""; }
  function readReports() {
    try {
      const raw = localStorage.getItem(historyKey());
      if (!raw || raw.length > 2000000) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((report) => isRecord(report) && typeof report.id === "string" && report.id.length < 200
        && typeof report.summary === "string" && report.summary.length < 15000 && isRecord(report.analysis)
        && markets().some((market) => market.symbol === report.symbol)
        && intervals().some((item) => item.value === report.interval) && report.allowExport !== false).slice(0,20);
    } catch { return []; }
  }
  function storeReports(reports) {
    if (!app.profile) return false;
    try { localStorage.setItem(historyKey(),JSON.stringify(reports.slice(0,20))); app.reports = reports.slice(0,20); renderHistory(); return true; }
    catch { showToast("تعذر حفظ التقرير على هذا الجهاز. تحقق من مساحة المتصفح وإعدادات التخزين.","error"); return false; }
  }
  function saveReport() {
    if (!app.profile || !app.report || app.report.historical || app.dataset?.allowExport === false || app.dataset?.provenance?.displayOnly === true) return;
    const report = { ...app.report, savedAt: new Date().toISOString(), allowExport: true };
    if (storeReports([report,...app.reports.filter((item) => item.id !== report.id)])) showToast("حُفظ التقرير لهذا الحساب على هذا الجهاز.");
  }
  function renderHistory() {
    $("#historyCount").textContent = String(app.reports.length);
    const target = $("#historyRoot");
    if (!app.reports.length) { target.innerHTML = '<div class="aa-empty"><span aria-hidden="true">▤</span><h3>ابدأ بتقريرك الأول</h3><p>بعد تحليل الشموع، اضغط «حفظ التقرير». ستجده هنا مع مصدره وتاريخ قراءته.</p><button type="button" class="secondary-button" data-view="analysis">فتح مساعد التحليل</button></div>'; return; }
    target.innerHTML = `<div class="aa-history-list">${app.reports.map((report) => `<article class="aa-history-card"><div><h3>${escapeHtml(markets().find((item) => item.symbol === report.symbol)?.name || report.symbol)} · ${escapeHtml(report.intervalLabel || report.interval)}</h3><p>${escapeHtml(report.trend?.label || "تقرير فني")} · آخر شمعة ${escapeHtml(localDate(report.asOf))}</p><p>${escapeHtml(report.source)} · تقرير محفوظ، وليس قراءة حالية</p></div><div class="aa-history-actions"><button type="button" class="small-button" data-history="view" data-report="${escapeHtml(report.id)}">عرض</button><button type="button" class="small-button" data-history="export" data-report="${escapeHtml(report.id)}">تنزيل نص</button><button type="button" class="small-button" data-history="remove" data-report="${escapeHtml(report.id)}" aria-label="حذف التقرير المحفوظ">حذف</button></div></article>`).join("")}</div>`;
  }
  function viewSavedReport(report) {
    cancelContext();
    app.symbol = report.symbol; app.interval = report.interval; app.dataset = null;
    app.report = { ...report, historical: true, status: "stale", quality: { ...(report.quality || {}), isCurrent: false } };
    renderSelectors(); resetChat(); renderReport(app.report,{ historical: true }); goTo("analysis");
    $("#chartKind").textContent = "تقرير محفوظ";
    $("#chartRoot").innerHTML = '<div class="aa-chart-notice"><b>هذه قراءة محفوظة من وقت سابق</b><p>الشموع الأصلية لا تُحفظ على هذا الجهاز مع التقرير. اضغط «حلّل السوق» لطلب قراءة جديدة، أو استورد الملف الأصلي لإعادة رسمه.</p></div>';
    $("#chartCaption").textContent = `مصدر التقرير: ${report.source} · آخر شمعة حتى ${localDate(report.asOf)}.`;
    status("تقرير تاريخي محفوظ. القيم والسيناريوهات تخص وقت إعداد التقرير.","warning");
  }
  function exportReport(report) {
    if (report.allowExport === false) return;
    const lines = ["VAREX AI — تقرير تحليل محفوظ", `${report.symbol} · ${report.intervalLabel || report.interval}`, `المصدر: ${report.source}`, `آخر شمعة: ${report.asOf || "غير متاح"}`, "هذا تقرير تاريخي ولا يثبت الحالة الحالية للسوق.", "", report.summary,
      `الدعم المرجعي: ${price(report.levels?.support)}`, `المقاومة المرجعية: ${price(report.levels?.resistance)}`, "",
      ...(Array.isArray(report.scenarios) ? report.scenarios.flatMap((scenario) => [scenario.label,scenario.condition,scenario.invalidation,""]) : []),
      ...(Array.isArray(report.warnings) ? report.warnings : []), "", report.disclaimer || "قراءة فنية وصفية من البيانات المتاحة."];
    const blob = new Blob(["\uFEFF" + lines.join("\n")],{ type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url;
    anchor.download = `VAREX_${report.symbol}_${String(report.asOf || report.savedAt || "report").slice(0,10).replace(/[^0-9-]/g,"")}.txt`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function renderLearn() {
    const lessons = [
      ["S / R","الدعم والمقاومة","الدعم منطقة شهدت فيها البيانات السابقة تماسكاً أو شراءً، والمقاومة منطقة واجهت فيها الحركة ضغطاً. المحرك يعرض أعلى وأدنى العشرين شمعة السابقة كحدّين مرجعيين، ويشرح طريقة الحساب. قد يتجاوز السعر أي مستوى؛ وجوده لا يضمن الارتداد."],
      ["TF","ما هو الفريم؟","الفريم هو مدة الشمعة: الدقيقة أو الساعة أو اليوم. كل شمعة تلخّص الافتتاح والأعلى والأدنى والإغلاق خلال تلك الفترة. قراءة الساعة تختلف عن قراءة اليوم؛ نثبت الفريم مع كل تقرير."],
      ["RSI","كيف نفهم الزخم؟","RSI يقيس قوة تغيرات الإغلاق خلال فترة محددة. مستويا 70 و30 شائعان لوصف التشبع النسبي، لكن الوصول إليهما لا يثبت أن السعر سينعكس. يُقرأ المؤشر مع الاتجاه وبقية البيانات."],
      ["EMA","المتوسطات الأسية","EMA يلخص الإغلاقات ويعطي وزناً أكبر للأحدث. المقارنة بين EMA 20 وEMA 50 تساعد على وصف الاتجاه، مع بقاء تأخر المؤشر عن السعر وحدود دلالته."],
      ["MACD","تغيّر قوة الحركة","MACD يقارن متوسطين أسيين للسعر وخط إشارة. تقاطعهما يصف تغير الزخم، وقد تظهر قراءات متعارضة أثناء الحركة ضمن نطاق. لا يكفي المؤشر وحده لتحديد الحركة التالية."],
      ["ATR","التذبذب والسيناريوهات","ATR يصف اتساع حركة السعر بوحدة الأداة، ولا يحدد الاتجاه. السيناريو المشروط يوضح ما الذي يدعم تفسيراً للحركة وما الذي يضعفه، مع إتاحة نتيجة محايدة عند تعارض الأدلة."],
    ];
    $("#learnRoot").innerHTML = lessons.map(([tag,title,body]) => `<article class="panel aa-learn-card"><span>${escapeHtml(tag)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`).join("");
  }
  function showImport() {
    if (!app.profile) return;
    $("#importContext").textContent = `${selectedMarket().name} · ${app.symbol} · فريم ${intervalLabel()}`;
    $("#importMessage").textContent = "";
    $("#importDialog").showModal();
  }
  async function bindFileInput(event) {
    const file = event.target.files?.[0], epoch = contextEpoch;
    if (!file) return;
    const message = $("#importMessage"); message.textContent = "";
    if (file.size > 2000000) { message.textContent = "حجم الملف أكبر من 2 ميغابايت. اختر ملفاً أصغر."; event.target.value = ""; return; }
    if (!/\.(csv|txt)$/i.test(file.name)) { message.textContent = "اختر ملف CSV نصياً يحتوي على الشموع."; event.target.value = ""; return; }
    try {
      const text = await file.text();
      if (!app.profile || epoch !== contextEpoch) return;
      $("#csvText").value = text;
      const source = $('#importForm [name="source"]'); if (!source.value.trim()) source.value = `ملف ${file.name}`.slice(0,100);
    } catch { message.textContent = "تعذر قراءة الملف. يمكنك لصق CSV في الحقل أدناه."; }
  }
  function submitImport(event) {
    event.preventDefault();
    if (!app.profile) return;
    const form = event.currentTarget, values = new FormData(form), text = String(values.get("csv") || "");
    if (!text.trim()) { $("#importMessage").textContent = "اختر ملف CSV أو الصق بيانات الشموع."; return; }
    try {
      if (!core()?.parseCSV) throw new Error("تعذر تحميل محرك الاستيراد. أعد تحميل الصفحة.");
      const dataset = core().parseCSV(text,{ symbol: app.symbol, interval: app.interval, source: String(values.get("source") || "").trim(), timezoneOffsetMinutes: Number(values.get("timezone")) });
      cancelContext();
      const report = applyDataset(dataset);
      resetChat(); addMessage("assistant",`تم تحليل الشموع المستوردة. ${report.summary}\nهذه القراءة تخص ملفك ولا تتحدث تلقائياً.`,"تحليل حسابي");
      $("#importDialog").close(); goTo("analysis");
    } catch (error) { $("#importMessage").textContent = error.message || "تعذر استيراد الشموع. تحقق من الأعمدة والتوقيت."; }
  }
  function bindShell() {
    $("#menuButton").addEventListener("click",openMenu); $("#closeMenu").addEventListener("click",closeMenu); $("#drawerBackdrop").addEventListener("click",closeMenu);
    $("#userMenuButton").addEventListener("click",() => goTo("settings"));
    $("#marketSelect").addEventListener("change",(event) => changeContext(event.target.value,app.interval));
    $("#intervalButtons").addEventListener("click",(event) => { const button = event.target.closest("[data-interval]"); if (button) changeContext(app.symbol,button.dataset.interval); });
    $("#analyzeButton").addEventListener("click",analyze); $("#saveReportButton").addEventListener("click",saveReport);
    $("#clearChatButton").addEventListener("click",() => { if (app.chatPending) { chatRequest?.abort(); contextEpoch += 1; app.chatPending = false; $("#chatForm button[type=submit]").disabled = false; } resetChat(); });
    $("#chatForm").addEventListener("submit",(event) => { event.preventDefault(); ask($("#chatInput").value); });
    $("#chatInput").addEventListener("keydown",(event) => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); ask(event.currentTarget.value); } });
    $("#importForm").addEventListener("submit",submitImport); $("#csvFile").addEventListener("change",bindFileInput);
    $("#profileForm").addEventListener("submit",async (event) => {
      event.preventDefault(); const form = event.currentTarget, displayName = String(new FormData(form).get("displayName") || "").trim(), epoch = accessEpoch;
      if (!app.profile || displayName.length < 2 || displayName.length > 80) return showToast("أدخل اسماً بين حرفين و80 حرفاً.","error");
      setBusy(form,true,"حفظ…");
      try {
        await request("/api/trading",{ method:"POST", body:JSON.stringify({action:"update_profile",displayName}) });
        if (epoch !== accessEpoch || !app.profile) return;
        app.profile.displayName = displayName; $("#topUserName").textContent = displayName; $("#avatar").textContent = displayName.slice(0,2); showToast("تم حفظ الاسم.");
      } catch(error) { if(epoch===accessEpoch) showToast(error.message,"error"); }
      finally { setBusy(form,false); }
    });
    $("#changePasswordButton").addEventListener("click",async () => { const email = app.user?.email || ""; await logout(); $('#recoverPane [name="email"]').value = email; showAuthPane("recoverPane"); });
    document.addEventListener("click",(event) => {
      const view = event.target.closest("[data-view]"); if (view) return goTo(view.dataset.view);
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "logout") return logout(); if (action === "import") return showImport();
      if (event.target.closest("[data-close-dialog]")) return $("#importDialog").close();
      const question = event.target.closest("[data-question]"); if (question) return ask(question.dataset.question);
      const history = event.target.closest("[data-history]");
      if (history && app.profile) {
        const report = app.reports.find((item) => item.id === history.dataset.report); if (!report) return;
        if (history.dataset.history === "view") viewSavedReport(report);
        else if (history.dataset.history === "export") exportReport(report);
        else if (history.dataset.history === "remove") storeReports(app.reports.filter((item) => item.id !== report.id));
      }
    });
    new MutationObserver(() => { if (app.profile && app.view === "analysis" && !app.dataset && !app.report?.historical) renderReferenceChart(); }).observe(document.documentElement,{ attributes:true, attributeFilter:["data-theme"] });
    window.addEventListener("pageshow",(event) => { if (event.persisted) revalidateAccess(); });
    window.addEventListener("storage",(event) => { if (event.key === null || event.key?.startsWith("varex.trading.supabase.session")) revalidateAccess(); else if (event.key === historyKey() && app.profile) { app.reports = readReports(); renderHistory(); } });
    document.addEventListener("visibilitychange",() => { if (document.visibilityState === "visible") revalidateAccess(); });
    window.addEventListener("pagehide",() => { cancelContext(); if (app.profile) $("#appShell").classList.add("hidden"); });
  }
  async function init() {
    bindAuth(); bindShell();
    try {
      const session = await authRequest("/api/auth/get-session",undefined,"GET");
      if (session?.user) await enterApp(); else showLoggedOut();
    } catch (error) { showLoggedOut(error.message || "تعذر الاتصال بخدمة تسجيل الدخول."); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{ once:true }); else init();
})();
