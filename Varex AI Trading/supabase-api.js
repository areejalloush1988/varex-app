/*
 * Standalone GitHub/Supabase transport for the existing Varex client.
 * Load before app.js, then call (window.varexTradingRequest || window.fetch).
 * Omit this script, or set VAREX_TRADING_SUPABASE.enabled = false before loading
 * it, to keep the original hosted /api runtime. Global fetch is never replaced.
 *
 * This is a public publishable key, copied from the site's varex.js. Authorization
 * belongs to the Edge Function, which must verify the user's Supabase JWT.
 */
(() => {
  "use strict";

  if (window.VAREX_TRADING_SUPABASE?.enabled === false || typeof window.varexTradingRequest === "function") return;

  const PROJECT_URL = "https://eibadfdqzpeigccfdipt.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336";
  const AUTH_URL = `${PROJECT_URL}/auth/v1`;
  const TRADING_URL = `${PROJECT_URL}/functions/v1/varex-trading-api`;
  const STORAGE_KEY = "varex.trading.supabase.session.v1.eibadfdqzpeigccfdipt";
  const REFRESH_MARGIN = 45;
  const SIGNUP_MARKER_TTL = 10 * 60 * 1000;
  const fetchRequest = window.fetch.bind(window);
  const signupMarkers = new Map();
  const authPaths = new Set([
    "/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/auth/get-session", "/api/auth/sign-out",
    "/api/trading-auth/send-otp", "/api/trading-auth/verify-email", "/api/trading-auth/reset-password",
  ]);
  let session = null;
  let remember = false;
  let persisted = false;
  let authEpoch = 0;
  let refreshPromise = null;

  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const now = () => Math.floor(Date.now() / 1000);
  const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });

  class AuthFailure extends Error {
    constructor(status, message, code = "auth_request_failed", extra = {}, headers = {}) {
      super(message);
      this.status = status;
      this.code = code;
      this.extra = extra;
      this.headers = headers;
    }
    response() { return json({ error: this.message, code: this.code, ...this.extra }, this.status, this.headers); }
  }

  function storage(name) {
    try { return window[name]; } catch { return null; }
  }
  function removeStored(name) {
    try { storage(name)?.removeItem(STORAGE_KEY); } catch { /* Memory-only sessions still work. */ }
  }
  function publicUser(user) {
    if (!record(user) || typeof user.id !== "string" || !user.id) return null;
    const metadata = record(user.user_metadata) ? user.user_metadata : {};
    const displayName = [metadata.display_name, metadata.name, metadata.full_name, user.name]
      .find((value) => typeof value === "string" && value.trim());
    return {
      id: user.id,
      email: typeof user.email === "string" ? user.email : "",
      name: displayName?.trim() || (typeof user.email === "string" ? user.email.split("@")[0] : "Varex"),
      emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at || user.emailVerified === true),
    };
  }
  function normalizeSession(value) {
    if (!record(value) || typeof value.access_token !== "string" || !value.access_token
      || typeof value.refresh_token !== "string" || !value.refresh_token) return null;
    const user = publicUser(value.user);
    const expiresAt = Number(value.expires_at) || (Number(value.expires_in) > 0 ? now() + Number(value.expires_in) : 0);
    if (!user || !Number.isFinite(expiresAt) || expiresAt <= 0) return null;
    return { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: expiresAt, user };
  }
  function readStored(name) {
    let raw;
    try { raw = storage(name)?.getItem(STORAGE_KEY); } catch { return null; }
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      const stored = value.version === 1 ? normalizeSession(value.session) : null;
      if (stored) return stored;
    } catch { /* Discard only this adapter's malformed record. */ }
    removeStored(name);
    return null;
  }
  function saveSession(value, rememberMe) {
    session = value;
    remember = rememberMe === true;
    persisted = false;
    const target = remember ? "localStorage" : "sessionStorage";
    removeStored(remember ? "sessionStorage" : "localStorage");
    try {
      const destination = storage(target);
      if (destination) {
        destination.setItem(STORAGE_KEY, JSON.stringify({ version: 1, session: value }));
        persisted = true;
      }
    } catch { /* Private-mode/storage restrictions fall back to this tab's memory. */ }
  }
  function clearSession() {
    authEpoch += 1;
    session = null;
    remember = false;
    persisted = false;
    removeStored("localStorage");
    removeStored("sessionStorage");
  }
  function syncRememberedSession() {
    if (!remember || !persisted) return;
    const latest = readStored("localStorage");
    if (latest?.access_token !== session?.access_token || latest?.refresh_token !== session?.refresh_token) {
      authEpoch += 1;
      session = latest;
      if (!latest) { remember = false; persisted = false; }
    }
  }

  session = readStored("sessionStorage");
  if (session) persisted = true;
  else {
    session = readStored("localStorage");
    remember = Boolean(session);
    persisted = Boolean(session);
  }
  window.addEventListener?.("storage", (event) => {
    if ((event.key === STORAGE_KEY || event.key === null) && (!event.storageArea || event.storageArea === storage("localStorage"))) {
      syncRememberedSession();
    }
  });

  function authError(status, data, headers) {
    const suppliedCode = typeof data?.error_code === "string" ? data.error_code : typeof data?.code === "string" ? data.code : "";
    const messages = {
      invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      email_not_confirmed: "يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.",
      otp_expired: "رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.",
      otp_disabled: "التحقق بالبريد الإلكتروني غير متاح حالياً.",
      email_address_invalid: "أدخل بريداً إلكترونياً صحيحاً.",
      weak_password: "اختر كلمة مرور قوية من 8 أحرف على الأقل تشمل أحرفاً كبيرة وصغيرة ورقماً ورمزاً.",
      user_already_exists: "تعذر إكمال إنشاء الحساب. جرّب تسجيل الدخول أو استعادة كلمة المرور.",
      email_exists: "تعذر إكمال إنشاء الحساب. جرّب تسجيل الدخول أو استعادة كلمة المرور.",
      email_address_not_authorized: "خدمة البريد لم تُفعّل لإرسال الرسائل إلى هذا العنوان بعد. تواصل مع إدارة التطبيق.",
      email_provider_disabled: "تسجيل الدخول بالبريد الإلكتروني غير مفعّل حالياً.",
      signup_disabled: "إنشاء الحسابات غير متاح حالياً.",
      captcha_failed: "تعذر إكمال التحقق الأمني. تواصل مع إدارة التطبيق.",
      refresh_token_not_found: "انتهت الجلسة. يرجى تسجيل الدخول مجدداً.",
      refresh_token_already_used: "انتهت الجلسة. يرجى تسجيل الدخول مجدداً.",
      session_not_found: "انتهت الجلسة. يرجى تسجيل الدخول مجدداً.",
      same_password: "اختر كلمة مرور مختلفة عن كلمة المرور الحالية.",
    };
    const rateLimited = status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(suppliedCode);
    const unconfirmed = suppliedCode === "email_not_confirmed";
    const duplicate = ["user_already_exists", "email_exists"].includes(suppliedCode);
    const message = rateLimited ? "طلبات كثيرة. انتظر قليلاً ثم أعد المحاولة."
      : messages[suppliedCode] || (status >= 500 ? "خدمة تسجيل الدخول غير متاحة حالياً. حاول مرة أخرى لاحقاً." : "تعذر إكمال طلب المصادقة. تحقق من البيانات ثم حاول مجدداً.");
    const retryAfter = headers?.get("retry-after");
    return new AuthFailure(unconfirmed ? 403 : duplicate ? 409 : rateLimited ? 429 : status, message,
      duplicate ? "signup_unavailable" : rateLimited ? "rate_limited" : Object.hasOwn(messages, suppliedCode) ? suppliedCode : "auth_request_failed",
      unconfirmed ? { emailVerificationRequired: true } : {},
      retryAfter && /^\d{1,6}$/.test(retryAfter) ? { "Retry-After": retryAfter } : {});
  }
  async function authFetch(path, { method = "POST", body, token, signal } = {}) {
    const headers = { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY, "X-Client-Info": "varex-trading-supabase/1.0" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchRequest(`${AUTH_URL}${path}`, {
      method, headers, credentials: "omit", cache: "no-store", redirect: "error", mode: "cors",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}),
    });
    let data = {};
    if (response.status !== 204) {
      try { data = await response.json(); }
      catch { throw new AuthFailure(response.ok ? 502 : response.status, "خدمة تسجيل الدخول أعادت استجابة غير صالحة.", "invalid_auth_response"); }
    }
    if (!response.ok) throw authError(response.status, data, response.headers);
    if (!record(data)) throw new AuthFailure(502, "خدمة تسجيل الدخول أعادت استجابة غير صالحة.", "invalid_auth_response");
    return data;
  }
  async function revoke(token, scope = "local") {
    if (!token) return;
    try { await authFetch(`/logout?scope=${scope}`, { token }); }
    catch (error) {
      if (!(error instanceof AuthFailure) || ![401, 403, 404].includes(error.status)) throw error;
    }
  }
  async function revokeDiscarded(value) {
    try { await revoke(value?.access_token); } catch { /* Never restore a cancelled session. */ }
  }
  function requireSession(data) {
    const value = normalizeSession(data);
    if (!value) throw new AuthFailure(502, "تعذر استلام جلسة تسجيل دخول صالحة.", "invalid_auth_response");
    return value;
  }
  async function ensureSession() {
    syncRememberedSession();
    if (!session) return null;
    if (session.expires_at > now() + REFRESH_MARGIN) return session;
    if (refreshPromise) return refreshPromise;
    const refresh = async () => {
      syncRememberedSession();
      if (!session || session.expires_at > now() + REFRESH_MARGIN) return session;
      const previous = session, epoch = authEpoch, keep = remember;
      let renewed;
      try {
        renewed = requireSession(await authFetch("/token?grant_type=refresh_token", { body: { refresh_token: previous.refresh_token } }));
      } catch (error) {
        if (epoch !== authEpoch) return null;
        if (error instanceof AuthFailure && [400, 401, 403].includes(error.status)) {
          clearSession();
          return null;
        }
        throw error;
      }
      syncRememberedSession();
      if (epoch !== authEpoch) {
        // A concurrent logout/login must not be undone by an older refresh.
        if (!session || session.user.id !== renewed.user.id) await revokeDiscarded(renewed);
        return null;
      }
      if (renewed.user.id !== previous.user.id) {
        clearSession();
        await revokeDiscarded(renewed);
        throw new AuthFailure(502, "تعذر تحديث الجلسة بأمان. سجّل الدخول مجدداً.", "invalid_auth_response");
      }
      saveSession(renewed, keep);
      return renewed;
    };
    // Web Locks coordinate rotating refresh tokens across remembered browser tabs.
    // The shared promise also serializes all requests within this page.
    const locks = window.navigator?.locks;
    const pending = locks?.request && remember
      ? locks.request(`${STORAGE_KEY}:refresh`, { mode: "exclusive" }, refresh)
      : refresh();
    refreshPromise = pending;
    try { return await pending; }
    finally { if (refreshPromise === pending) refreshPromise = null; }
  }

  function bodyOf(options) {
    if (options.body === undefined || options.body === null || options.body === "") return {};
    try {
      const value = JSON.parse(options.body);
      if (record(value)) return value;
    } catch { /* Return the same JSON error contract as other API requests. */ }
    throw new AuthFailure(400, "بيانات الطلب غير صالحة.", "invalid_request");
  }
  function emailOf(body) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthFailure(400, "أدخل بريداً إلكترونياً صحيحاً.", "invalid_request");
    }
    return email;
  }
  function passwordOf(body, strong = false) {
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || (strong && !(password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)))) {
      throw new AuthFailure(400, strong ? "اختر كلمة مرور قوية من 8 أحرف على الأقل تشمل أحرفاً كبيرة وصغيرة ورقماً ورمزاً." : "أدخل كلمة المرور.", "invalid_request");
    }
    return password;
  }
  function otpOf(body) {
    const token = typeof body.otp === "string" ? body.otp.trim() : "";
    if (!/^\d{6,10}$/.test(token)) throw new AuthFailure(400, "أدخل رمز التحقق المرسل إلى بريدك.", "invalid_request");
    return token;
  }
  function setSignupMarker(email, marker) {
    for (const [address, value] of signupMarkers) {
      if (Date.now() - value.createdAt > SIGNUP_MARKER_TTL) signupMarkers.delete(address);
    }
    if (signupMarkers.size >= 20) signupMarkers.delete(signupMarkers.keys().next().value);
    signupMarkers.set(email, { createdAt: Date.now(), ...marker });
  }
  function signupMarker(email) {
    const marker = signupMarkers.get(email);
    if (marker && Date.now() - marker.createdAt <= SIGNUP_MARKER_TTL) return marker;
    signupMarkers.delete(email);
    return null;
  }
  function sessionResponse(value) {
    return value ? { user: value.user, session: { userId: value.user.id, expiresAt: new Date(value.expires_at * 1000).toISOString() } } : null;
  }
  function emailMetadata(email, name = "") {
    // Keep the existing shared-project email template's per-user theme contract.
    // These values affect presentation only; they never grant trading privileges.
    return {
      name: name.trim() || email.split("@")[0],
      display_name: name.trim() || email.split("@")[0],
      username: email.split("@")[0],
      varex_otp_relay: true,
      varex_system: "trading",
      varex_theme: "trading_navy_gold",
      varex_system_name: "VAREX AI Trading",
      varex_card_title: "VAREX AI Trading",
      varex_color: "#07111f",
      varex_soft_color: "#fff4cc",
      varex_text_color: "#FFFFFF",
      varex_logo_color: "#f5b82e",
    };
  }

  async function handleAuth(path, options) {
    const method = (options.method || "GET").toUpperCase();
    const expected = path === "/api/auth/get-session" ? "GET" : "POST";
    if (method !== expected) return json({ error: "طريقة الطلب غير مدعومة." }, 405, { Allow: expected });
    const body = bodyOf(options), signal = options.signal;
    if (path === "/api/auth/get-session") return json(sessionResponse(await ensureSession()));
    if (path === "/api/auth/sign-out") {
      syncRememberedSession();
      const previous = session;
      clearSession();
      signupMarkers.clear();
      await revoke(previous?.access_token);
      return json({ success: true });
    }
    const email = emailOf(body);
    if (path === "/api/auth/sign-in/email") {
      const password = passwordOf(body);
      clearSession();
      const epoch = authEpoch;
      const value = requireSession(await authFetch("/token?grant_type=password", { body: { email, password }, signal }));
      if (epoch !== authEpoch) {
        await revokeDiscarded(value);
        throw new AuthFailure(409, "أُلغي تسجيل الدخول. يرجى المحاولة مجدداً.", "session_changed");
      }
      saveSession(value, body.rememberMe === true);
      return json(sessionResponse(value));
    }
    if (path === "/api/auth/sign-up/email") {
      try {
        const password = passwordOf(body, true);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (name.length < 2) throw new AuthFailure(400, "أدخل اسماً من حرفين على الأقل.", "invalid_request");
        const data = await authFetch("/signup", { body: { email, password, data: emailMetadata(email, name) }, signal });
        // Confirm-email signup already sends an email. Autoconfirm instead returns
        // a session; discard it and let send-otp request an existing-user email OTP.
        const autoConfirmed = Boolean(data.access_token);
        if (autoConfirmed) await revoke(data.access_token);
        const identities = (data.user || data).identities;
        if (Array.isArray(identities) && identities.length === 0) {
          // Supabase may obfuscate duplicate signups as a successful response.
          // Match the explicit duplicate error without claiming another email
          // was sent or replacing an existing account's password/profile.
          throw authError(409, { error_code: "user_already_exists" });
        }
        const user = publicUser(data.user || data);
        if (!user) throw new AuthFailure(502, "تعذر إكمال إنشاء الحساب.", "invalid_auth_response");
        setSignupMarker(email, { skipFirstSend: !autoConfirmed, mode: autoConfirmed ? "email" : "signup" });
        return json({ user, verificationRequired: true });
      } catch (error) {
        // The current client attempts send-otp even when signup failed. Propagate
        // that failure without sending a second email or masking the real error.
        setSignupMarker(email, { failure: error });
        throw error;
      }
    }
    if (path === "/api/trading-auth/send-otp") {
      if (body.purpose === "reset") {
        await authFetch("/recover", { body: { email }, signal });
      } else if (body.purpose === "verify") {
        const marker = signupMarker(email);
        if (marker?.failure) { signupMarkers.delete(email); throw marker.failure; }
        if (marker?.skipFirstSend) {
          marker.skipFirstSend = false;
          return json({ sent: true });
        }
        if (marker?.mode === "email") {
          await authFetch("/otp", { body: { email, create_user: false, data: { ...emailMetadata(email), varex_purpose: "verify" } }, signal });
        } else {
          await authFetch("/resend", { body: { email, type: "signup" }, signal });
        }
      } else throw new AuthFailure(400, "غرض رمز التحقق غير صالح.", "invalid_request");
      return json({ sent: true });
    }
    if (path === "/api/trading-auth/verify-email") {
      const token = otpOf(body);
      const value = requireSession(await authFetch("/verify", { body: { email, token, type: "email" }, signal }));
      await revoke(value.access_token);
      signupMarkers.delete(email);
      return json({ verified: true });
    }
    if (path === "/api/trading-auth/reset-password") {
      // Validate first: an OTP is single-use and must not be consumed for a locally
      // invalid password. The recovery session never enters trading/storage.
      const token = otpOf(body), password = passwordOf(body, true);
      const recovery = requireSession(await authFetch("/verify", { body: { email, token, type: "recovery" }, signal }));
      let updateError = null, logoutError = null;
      try { await authFetch("/user", { method: "PUT", body: { password }, token: recovery.access_token, signal }); }
      catch (error) { updateError = error; }
      try { await revoke(recovery.access_token, "global"); }
      catch (error) { logoutError = error; }
      finally { clearSession(); signupMarkers.delete(email); }
      if (updateError) throw updateError;
      if (logoutError) throw new AuthFailure(502, "تم تغيير كلمة المرور. تعذر إنهاء جلسات الأجهزة الأخرى؛ سجّل الدخول مجدداً.", "logout_failed", { passwordChanged: true });
      return json({ success: true, passwordChanged: true });
    }
    return json({ error: "المسار غير موجود." }, 404);
  }

  window.varexTradingRequest = async function varexTradingRequest(path, options = {}) {
    let url;
    try { url = new URL(path, window.location.href); }
    catch { return fetchRequest(path, options); }
    const isLocal = url.origin === window.location.origin;
    const isTrading = isLocal && url.pathname === "/api/trading";
    if (!isTrading && !(isLocal && authPaths.has(url.pathname))) return fetchRequest(path, options);
    const method = (options.method || "GET").toUpperCase();
    let tradingDispatched = false;
    try {
      if (options.signal?.aborted) options.signal.throwIfAborted();
      if (!isTrading) return await handleAuth(url.pathname, options);
      const value = await ensureSession();
      if (!value) return json({ error: "يرجى تسجيل الدخول أولاً.", code: "not_authenticated" }, 401);
      if (options.signal?.aborted) options.signal.throwIfAborted();
      const headers = new Headers(options.headers);
      headers.set("apikey", PUBLISHABLE_KEY);
      headers.set("Authorization", `Bearer ${value.access_token}`);
      headers.delete("Cookie");
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const epoch = authEpoch;
      tradingDispatched = true;
      const response = await fetchRequest(`${TRADING_URL}${url.search}`, {
        ...options, headers, credentials: "omit", cache: "no-store", redirect: "error", mode: "cors",
      });
      if (response.status === 401 && epoch === authEpoch) clearSession();
      // Preserve status, body and headers, including executionUncertain. Never
      // automatically replay a trading request, even after a 401 or a timeout.
      return response;
    } catch (error) {
      if (error instanceof AuthFailure) return error.response();
      const uncertain = tradingDispatched && !["GET", "HEAD"].includes(method);
      if (error?.name === "AbortError" && !uncertain) throw error;
      return json({
        error: uncertain
          ? "تعذر تأكيد نتيجة الطلب. حدّث البيانات قبل إعادة المحاولة."
          : "تعذر الاتصال بالخدمة. تحقق من اتصال الإنترنت ثم أعد المحاولة.",
        code: "network_error",
        ...(uncertain ? { executionUncertain: true } : {}),
      }, 503);
    }
  };
})();
