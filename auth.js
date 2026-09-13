(() => {
  "use strict";

  const SUPABASE_URL = "https://eibadfdqzpeigccfdipt.supabase.co";
  const SUPABASE_KEY = "sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336";
  const SESSION_KEY = "varex_pharmacy_local_session";
  const PROFILE_KEY = "varex_pharmacy_profile";
  const PENDING_KEY = "varex_pharmacy_pending_email";
  const REMEMBER_KEY = "varex_pharmacy_remembered_email";
  const page = document.body?.dataset.authPage || "";
  const $ = id => document.getElementById(id);
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  const client = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  function message(type, text) {
    const el = $("message");
    if (!el) return;
    el.className = `form-message show ${type}`;
    el.textContent = text;
  }

  function clearMessage() {
    const el = $("message");
    if (el) el.className = "form-message";
  }

  function busy(button, value, label) {
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = value;
    button.innerHTML = value ? `<span class="spinner"></span><span>${label}</span>` : button.dataset.label;
  }

  function errorText(error, fallback) {
    const raw = String(error?.message || error || "").toLowerCase();
    if (raw.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (raw.includes("email not confirmed")) return "يجب تأكيد البريد الإلكتروني أولاً.";
    if (raw.includes("already registered") || raw.includes("already been registered")) return "يوجد حساب مسجل بهذا البريد الإلكتروني.";
    if (raw.includes("password") && raw.includes("least")) return "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.";
    if (raw.includes("token") && (raw.includes("expired") || raw.includes("invalid"))) return "رمز التحقق غير صحيح أو انتهت صلاحيته.";
    if (raw.includes("fetch") || raw.includes("network")) return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.";
    return error?.message || fallback;
  }

  function saveProfile(profile) {
    const old = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...old, ...profile }));
  }

  function makeClickSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = makeClickSound.ctx || (makeClickSound.ctx = new Ctx());
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(610, ctx.currentTime);
      gain.gain.setValueAtTime(.018, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .035);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + .04);
    } catch (_) {}
  }

  if (page) document.addEventListener("click", event => {
    if (event.target.closest("button,a,input[type=checkbox]")) makeClickSound();
  }, { passive: true });

  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  async function getUser() {
    if (localStorage.getItem(SESSION_KEY)) return JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session?.user || null;
  }

  async function signOut() {
    localStorage.removeItem(SESSION_KEY);
    if (client) await client.auth.signOut().catch(() => {});
  }

  window.VarexPharmacyAuth = { client, getUser, signOut, SESSION_KEY, PROFILE_KEY };

  function initLogin() {
    const form = $("loginForm"), button = $("loginBtn"), email = $("email"), password = $("password");
    email.value = localStorage.getItem(REMEMBER_KEY) || "";
    $("remember").checked = Boolean(email.value);
    form.addEventListener("submit", async event => {
      event.preventDefault(); clearMessage();
      const mail = email.value.trim().toLowerCase(), pass = password.value;
      if (!validEmail(mail)) return message("error", "أدخل بريداً إلكترونياً صحيحاً.");
      if (!pass) return message("error", "أدخل كلمة المرور.");
      if (!client) return message("error", "تعذر تحميل خدمة تسجيل الدخول. تحقق من الإنترنت ثم أعد تحميل الصفحة.");
      busy(button, true, "جاري تسجيل الدخول...");
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: mail, password: pass });
        if (error) throw error;
        if (!data?.user) throw new Error("تعذر فتح الحساب.");
        if ($("remember").checked) localStorage.setItem(REMEMBER_KEY, mail); else localStorage.removeItem(REMEMBER_KEY);
        saveProfile({ email: mail, ownerName: data.user.user_metadata?.full_name || "مالك الصيدلية", pharmacyName: data.user.user_metadata?.pharmacy_name || "صيدلية VAREX" });
        message("success", "تم تسجيل الدخول. جاري فتح النظام...");
        setTimeout(() => location.replace("./app.html"), 550);
      } catch (error) {
        message("error", errorText(error, "تعذر تسجيل الدخول."));
        busy(button, false);
      }
    });
    $("demoLogin").addEventListener("click", () => {
      const session = { id: "demo-owner", email: "demo@varexapp.com", user_metadata: { full_name: "مالك الصيدلية", pharmacy_name: "صيدلية VAREX التجريبية" }, demo: true };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      saveProfile({ ownerName: "مالك الصيدلية", pharmacyName: "صيدلية VAREX التجريبية", email: session.email, city: "دبي", licenseNo: "PH-DEMO-2026" });
      location.replace("./app.html");
    });
  }

  function initRegister() {
    const form = $("registerForm"), button = $("registerBtn");
    form.addEventListener("submit", async event => {
      event.preventDefault(); clearMessage();
      const ownerName = $("ownerName").value.trim(), pharmacyName = $("pharmacyName").value.trim();
      const email = $("registerEmail").value.trim().toLowerCase(), phone = $("phone").value.trim();
      const city = $("city").value, licenseNo = $("licenseNo").value.trim();
      const password = $("registerPassword").value, confirm = $("confirmPassword").value;
      if (!ownerName || !pharmacyName || !phone) return message("error", "أكمل جميع الحقول المطلوبة.");
      if (!validEmail(email)) return message("error", "أدخل بريداً إلكترونياً صحيحاً.");
      if (password.length < 8) return message("error", "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.");
      if (password !== confirm) return message("error", "كلمتا المرور غير متطابقتين.");
      if (!$("terms").checked) return message("error", "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.");
      if (!client) return message("error", "تعذر تحميل خدمة التسجيل. تحقق من الإنترنت ثم أعد تحميل الصفحة.");
      busy(button, true, "جاري إنشاء الحساب...");
      try {
        const redirectTo = new URL("./verify-email.html", location.href).href;
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirectTo, data: { full_name: ownerName, pharmacy_name: pharmacyName, phone, city, license_no: licenseNo, business_type: "pharmacy" } }
        });
        if (error) throw error;
        localStorage.setItem(PENDING_KEY, email);
        saveProfile({ ownerName, pharmacyName, email, phone, city, licenseNo });
        if (data?.session) {
          message("success", "تم إنشاء الحساب. جاري فتح النظام...");
          return setTimeout(() => location.replace("./app.html"), 600);
        }
        message("success", "تم إنشاء الحساب وإرسال رمز التحقق إلى البريد الإلكتروني.");
        setTimeout(() => location.assign("./verify-email.html"), 850);
      } catch (error) {
        message("error", errorText(error, "تعذر إنشاء الحساب."));
        busy(button, false);
      }
    });
  }

  function initForgot() {
    const form = $("forgotForm"), button = $("forgotBtn"), input = $("recoveryEmail");
    input.value = localStorage.getItem(REMEMBER_KEY) || localStorage.getItem(PENDING_KEY) || "";
    form.addEventListener("submit", async event => {
      event.preventDefault(); clearMessage();
      const email = input.value.trim().toLowerCase();
      if (!validEmail(email)) return message("error", "أدخل بريداً إلكترونياً صحيحاً.");
      if (!client) return message("error", "تعذر تحميل خدمة الاستعادة. تحقق من الإنترنت.");
      busy(button, true, "جاري إرسال الرابط...");
      try {
        const redirectTo = new URL("./reset-password.html", location.href).href;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        message("success", "تم إرسال رابط إعادة تعيين كلمة المرور. تحقق من البريد الإلكتروني.");
      } catch (error) {
        message("error", errorText(error, "تعذر إرسال رابط الاستعادة."));
      } finally { busy(button, false); }
    });
  }

  function initVerify() {
    const inputs = [...document.querySelectorAll("#otpBoxes input")], form = $("verifyForm"), button = $("verifyBtn");
    const email = localStorage.getItem(PENDING_KEY) || JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}").email || "";
    if (email) $("verifyHint").textContent = `تم إرسال الرمز إلى ${email}`;
    inputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !input.value && index) inputs[index - 1].focus();
      });
      input.addEventListener("paste", event => {
        const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (code.length) { event.preventDefault(); inputs.forEach((box, i) => box.value = code[i] || ""); inputs[Math.min(code.length, 6) - 1].focus(); }
      });
    });
    form.addEventListener("submit", async event => {
      event.preventDefault(); clearMessage();
      const token = inputs.map(input => input.value).join("");
      if (!validEmail(email)) return message("error", "تعذر تحديد البريد. ارجع إلى صفحة إنشاء الحساب.");
      if (token.length !== 6) return message("error", "أدخل رمز التحقق الكامل المؤلف من 6 أرقام.");
      if (!client) return message("error", "تعذر الاتصال بخدمة التحقق.");
      busy(button, true, "جاري تأكيد الحساب...");
      try {
        const { error } = await client.auth.verifyOtp({ email, token, type: "signup" });
        if (error) throw error;
        localStorage.removeItem(PENDING_KEY);
        message("success", "تم تأكيد البريد بنجاح. جاري فتح النظام...");
        setTimeout(() => location.replace("./app.html"), 650);
      } catch (error) {
        message("error", errorText(error, "تعذر تأكيد الرمز.")); busy(button, false);
      }
    });
    $("resendBtn").addEventListener("click", async () => {
      clearMessage();
      if (!validEmail(email) || !client) return message("error", "تعذر إعادة الإرسال. ارجع إلى صفحة إنشاء الحساب.");
      const { error } = await client.auth.resend({ type: "signup", email });
      message(error ? "error" : "success", error ? errorText(error, "تعذر إرسال الرمز.") : "تم إرسال رمز تحقق جديد.");
    });
    inputs[0]?.focus();
  }

  function initReset() {
    const form = $("resetForm"), button = $("resetBtn");
    form.addEventListener("submit", async event => {
      event.preventDefault(); clearMessage();
      const password = $("newPassword").value, confirm = $("newPasswordConfirm").value;
      if (password.length < 8) return message("error", "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.");
      if (password !== confirm) return message("error", "كلمتا المرور غير متطابقتين.");
      if (!client) return message("error", "تعذر تحميل خدمة تحديث كلمة المرور.");
      busy(button, true, "جاري حفظ كلمة المرور...");
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        message("success", "تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.");
        setTimeout(() => location.replace("./login.html"), 900);
      } catch (error) {
        message("error", errorText(error, "رابط الاستعادة غير صالح أو انتهت صلاحيته.")); busy(button, false);
      }
    });
  }

  const initMap = { login: initLogin, register: initRegister, forgot: initForgot, verify: initVerify, reset: initReset };
  initMap[page]?.();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
