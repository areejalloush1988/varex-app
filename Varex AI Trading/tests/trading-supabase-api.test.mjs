import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../supabase-api.js", import.meta.url), "utf8");
const PROJECT = "https://eibadfdqzpeigccfdipt.supabase.co";
const KEY = "varex.trading.supabase.session.v1.eibadfdqzpeigccfdipt";
const EMAIL = "person@example.test";
const PASSWORD = "Example-test-42!";
const USER = { id: "user-example", email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { name: "Test Person", role: "developer" } };

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}
function tokenSession(suffix = "one", expiresIn = 3600) {
  return { access_token: `test-access-${suffix}`, refresh_token: `test-refresh-${suffix}`, expires_at: Math.floor(Date.now() / 1000) + expiresIn, user: USER };
}
const saved = (value) => JSON.stringify({ version: 1, session: value });
const post = (body) => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const ok = (data) => Response.json(data);
const noContent = () => new Response(null, { status: 204 });
const failure = (status, error_code) => Response.json({ error_code, msg: "untrusted upstream detail" }, { status });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness({ network, localStorage = memoryStorage(), sessionStorage = memoryStorage(), config, locks } = {}) {
  const calls = [], listeners = new Map();
  const nativeFetch = async (url, options) => {
    const call = { url: String(url), options };
    calls.push(call);
    // No real fetch is reachable from this test harness.
    if (!network) assert.fail(`Unexpected mocked network request: ${call.url}`);
    return network(call, calls.length - 1);
  };
  const window = {
    fetch: nativeFetch, localStorage, sessionStorage,
    location: { href: "https://example.github.io/varex/trading/", origin: "https://example.github.io" },
    navigator: { locks }, VAREX_TRADING_SUPABASE: config,
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  vm.runInNewContext(source, {
    window, Response, Headers, URL, Date,
    console: new Proxy({}, { get: () => () => assert.fail("The adapter must not log credentials or auth responses") }),
  }, { filename: "supabase-api.js" });
  return { window, request: window.varexTradingRequest, nativeFetch, localStorage, sessionStorage, calls, listeners };
}
function assertAuthCall(call, path, expectedBody, method = "POST") {
  assert.equal(call.url, `${PROJECT}/auth/v1${path}`);
  assert.equal(call.options.method, method);
  assert.equal(call.options.credentials, "omit");
  assert.equal(call.options.redirect, "error");
  assert.match(new Headers(call.options.headers).get("apikey"), /^sb_publishable_/);
  if (expectedBody !== undefined) assert.deepEqual(JSON.parse(call.options.body), expectedBody);
}

test("loading is explicit, can be disabled, and never overrides global fetch", () => {
  const disabled = harness({ config: { enabled: false } });
  assert.equal(disabled.request, undefined);
  assert.equal(disabled.window.fetch, disabled.nativeFetch);
  const enabled = harness();
  assert.equal(typeof enabled.request, "function");
  assert.equal(enabled.window.fetch, enabled.nativeFetch);
  assert.equal(enabled.calls.length, 0);
});

test("unrelated and foreign requests retain their original transport without auth injection", async () => {
  const response = new Response("original");
  const h = harness({ network: async () => response });
  for (const path of ["/api/unrelated", "https://foreign.example/api/trading", "https://foreign.example/api/trading-automation", "https://foreign.example/api/auth/sign-in/email"]) {
    const options = { method: "GET", credentials: "include", headers: { "X-Example": "keep" } };
    assert.equal(await h.request(path, options), response);
    assert.equal(h.calls.at(-1).url, path);
    assert.equal(h.calls.at(-1).options, options);
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    assert.equal(new Headers(options.headers).has("apikey"), false);
  }
});

test("sign-in respects rememberMe, survives reload, and exposes no tokens or metadata roles", async () => {
  for (const rememberMe of [false, true]) {
    const h = harness({ network: async (call) => {
      assertAuthCall(call, "/token?grant_type=password", { email: EMAIL, password: PASSWORD });
      assert.equal(new Headers(call.options.headers).has("Authorization"), false);
      return ok(tokenSession());
    } });
    const response = await h.request("/api/auth/sign-in/email", post({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD, rememberMe }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.deepEqual(data.user, { id: USER.id, email: EMAIL, name: "Test Person", emailVerified: true });
    assert.equal(data.session.userId, USER.id);
    assert.doesNotMatch(JSON.stringify(data), /test-access|test-refresh|developer/);
    const destination = rememberMe ? h.localStorage : h.sessionStorage;
    const unused = rememberMe ? h.sessionStorage : h.localStorage;
    assert.equal(JSON.parse(destination.getItem(KEY)).session.refresh_token, "test-refresh-one");
    assert.equal(unused.getItem(KEY), null);
    const reloaded = harness({ localStorage: h.localStorage, sessionStorage: h.sessionStorage });
    assert.equal((await (await reloaded.request("/api/auth/get-session")).json()).user.id, USER.id);
    assert.equal(reloaded.calls.length, 0);
  }
});

test("corrupt storage is discarded without touching other application data", async () => {
  const h = harness({ localStorage: memoryStorage({ [KEY]: "{broken", unrelated: "keep" }) });
  assert.equal(await (await h.request("/api/auth/get-session")).json(), null);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.localStorage.getItem("unrelated"), "keep");
  assert.equal(h.calls.length, 0);
});

test("storage restrictions fall back to memory without turning non-remembered login into a persistent session", async () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const h = harness({ localStorage: blocked, sessionStorage: blocked, network: async () => ok(tokenSession()) });
  assert.equal((await h.request("/api/auth/sign-in/email", post({ email: EMAIL, password: PASSWORD, rememberMe: false }))).status, 200);
  assert.equal((await (await h.request("/api/auth/get-session")).json()).user.id, USER.id);
  assert.equal(h.calls.length, 1);
});

test("signup sends once, the following UI send-otp is deduplicated, and explicit resend still works", async () => {
  const h = harness({ network: async (call, index) => {
    if (index === 0) {
      assertAuthCall(call, "/signup");
      const body = JSON.parse(call.options.body);
      assert.equal(body.email, EMAIL);
      assert.equal(body.password, PASSWORD);
      assert.deepEqual(body.data, {
        name: "Test Person", display_name: "Test Person", username: "person", varex_otp_relay: true,
        varex_system: "trading", varex_theme: "trading_navy_gold", varex_system_name: "VAREX AI Trading",
        varex_card_title: "VAREX AI Trading", varex_color: "#07111f", varex_soft_color: "#fff4cc",
        varex_text_color: "#FFFFFF", varex_logo_color: "#f5b82e",
      });
      return ok({ ...USER, email_confirmed_at: null });
    }
    if (index === 1) {
      assertAuthCall(call, "/resend", { email: EMAIL, type: "signup" });
      assert.doesNotMatch(call.options.body, /password/);
      return ok({});
    }
    assert.fail("Unexpected extra signup/OTP request");
  } });
  assert.equal((await h.request("/api/auth/sign-up/email", post({ email: EMAIL, password: PASSWORD, name: "Test Person", rememberMe: false }))).status, 200);
  const otpOptions = post({ email: EMAIL, password: PASSWORD, purpose: "verify" });
  assert.deepEqual(await (await h.request("/api/trading-auth/send-otp", otpOptions)).json(), { sent: true });
  assert.equal(h.calls.length, 1);
  assert.equal((await h.request("/api/trading-auth/send-otp", otpOptions)).status, 200);
  assert.equal(h.calls.length, 2);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
});

test("a failed signup is propagated to the client's follow-up without sending any OTP", async () => {
  const h = harness({ network: async () => failure(400, "signup_disabled") });
  const signup = await h.request("/api/auth/sign-up/email", post({ email: EMAIL, password: PASSWORD, name: "Test Person" }));
  const followup = await h.request("/api/trading-auth/send-otp", post({ email: EMAIL, password: PASSWORD, purpose: "verify" }));
  assert.equal(signup.status, 400);
  assert.equal(followup.status, 400);
  assert.deepEqual(await followup.json(), await signup.json());
  assert.equal(h.calls.length, 1);
});

test("autoconfirmed signup discards its session and sends one existing-user OTP", async () => {
  const h = harness({ network: async (call, index) => {
    if (index === 0) return ok(tokenSession("autoconfirm"));
    if (index === 1) {
      assertAuthCall(call, "/logout?scope=local");
      assert.equal(new Headers(call.options.headers).get("authorization"), "Bearer test-access-autoconfirm");
      return noContent();
    }
    assertAuthCall(call, "/otp");
    const body = JSON.parse(call.options.body);
    assert.equal(body.email, EMAIL);
    assert.equal(body.create_user, false);
    assert.equal(body.data.varex_theme, "trading_navy_gold");
    assert.equal(body.data.varex_purpose, "verify");
    return ok({});
  } });
  assert.equal((await h.request("/api/auth/sign-up/email", post({ email: EMAIL, password: PASSWORD, name: "Test Person" }))).status, 200);
  assert.equal((await h.request("/api/trading-auth/send-otp", post({ email: EMAIL, purpose: "verify" }))).status, 200);
  assert.equal(h.calls.length, 3);
  assert.equal(await (await h.request("/api/auth/get-session")).json(), null);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
});

test("email verification uses email OTP and revokes the temporary session without signing in", async () => {
  const h = harness({ network: async (call, index) => {
    if (index === 0) {
      assertAuthCall(call, "/verify", { email: EMAIL, token: "123456", type: "email" });
      return ok(tokenSession("verification"));
    }
    assertAuthCall(call, "/logout?scope=local");
    assert.equal(new Headers(call.options.headers).get("authorization"), "Bearer test-access-verification");
    return noContent();
  } });
  assert.deepEqual(await (await h.request("/api/trading-auth/verify-email", post({ email: EMAIL, otp: "123456", password: PASSWORD, displayName: "Test Person" }))).json(), { verified: true });
  assert.equal(await (await h.request("/api/auth/get-session")).json(), null);
  assert.equal(h.calls.length, 2);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
});

test("unconfirmed email login returns the existing 403 confirmation contract and permits explicit resend", async () => {
  const h = harness({ network: async (call, index) => {
    if (index === 0) return failure(400, "email_not_confirmed");
    assertAuthCall(call, "/resend", { email: EMAIL, type: "signup" });
    return ok({});
  } });
  const response = await h.request("/api/auth/sign-in/email", post({ email: EMAIL, password: PASSWORD }));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.", code: "email_not_confirmed", emailVerificationRequired: true });
  assert.equal((await h.request("/api/trading-auth/send-otp", post({ email: EMAIL, purpose: "verify" }))).status, 200);
  assert.equal(h.calls.length, 2);
});

test("explicit and obfuscated duplicate signups return the same generic result without a second email", async () => {
  const results = [];
  for (const duplicate of [failure(422, "user_already_exists"), ok({ user: { ...USER, identities: [] } }), ok({ ...USER, identities: [] })]) {
    const h = harness({ network: async () => duplicate });
    const signup = await h.request("/api/auth/sign-up/email", post({ email: EMAIL, password: PASSWORD, name: "Test Person" }));
    const followup = await h.request("/api/trading-auth/send-otp", post({ email: EMAIL, purpose: "verify" }));
    assert.equal(signup.status, 409);
    assert.equal(followup.status, 409);
    const result = await signup.json();
    assert.deepEqual(await followup.json(), result);
    results.push(result);
    assert.equal(h.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /identities|user-example|person@example/);
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});

test("recovery request contains email only, and an invalid recovery OTP cannot update a password", async () => {
  const h = harness({ network: async (call, index) => {
    if (index === 0) { assertAuthCall(call, "/recover", { email: EMAIL }); return ok({}); }
    assertAuthCall(call, "/verify", { email: EMAIL, token: "123456", type: "recovery" });
    return failure(403, "otp_expired");
  } });
  assert.deepEqual(await (await h.request("/api/trading-auth/send-otp", post({ email: EMAIL, purpose: "reset" }))).json(), { sent: true });
  const result = await h.request("/api/trading-auth/reset-password", post({ email: EMAIL, otp: "123456", password: PASSWORD }));
  assert.equal(result.status, 403);
  assert.equal((await result.json()).code, "otp_expired");
  assert.equal(h.calls.length, 2);
});

test("password reset verifies recovery, updates password, globally logs out, and clears existing storage", async () => {
  const h = harness({ localStorage: memoryStorage({ [KEY]: saved(tokenSession("old")) }), network: async (call, index) => {
    if (index === 0) {
      assertAuthCall(call, "/verify", { email: EMAIL, token: "123456", type: "recovery" });
      return ok(tokenSession("recovery"));
    }
    assert.equal(new Headers(call.options.headers).get("authorization"), "Bearer test-access-recovery");
    if (index === 1) {
      assertAuthCall(call, "/user", { password: PASSWORD }, "PUT");
      assert.doesNotMatch(h.localStorage.getItem(KEY), /test-access-recovery|test-refresh-recovery/);
      return ok(USER);
    }
    assertAuthCall(call, "/logout?scope=global");
    return noContent();
  } });
  const result = await h.request("/api/trading-auth/reset-password", post({ email: EMAIL, otp: "123456", password: PASSWORD }));
  assert.deepEqual(await result.json(), { success: true, passwordChanged: true });
  assert.equal(h.calls.length, 3);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
  assert.equal(await (await h.request("/api/auth/get-session")).json(), null);
});

test("locally weak reset passwords do not consume OTPs; server update failures still revoke recovery sessions", async () => {
  const invalid = harness();
  assert.equal((await invalid.request("/api/trading-auth/reset-password", post({ email: EMAIL, otp: "123456", password: "short" }))).status, 400);
  assert.equal(invalid.calls.length, 0);
  const h = harness({ network: async (call, index) => {
    if (index === 0) return ok(tokenSession("recovery"));
    if (index === 1) return failure(422, "weak_password");
    assertAuthCall(call, "/logout?scope=global");
    return noContent();
  } });
  const result = await h.request("/api/trading-auth/reset-password", post({ email: EMAIL, otp: "123456", password: PASSWORD }));
  assert.equal(result.status, 422);
  assert.equal((await result.json()).code, "weak_password");
  assert.equal(h.calls.length, 3);
  assert.equal(h.localStorage.getItem(KEY), null);
});

test("a failed global logout after reset reports that the password was changed and retains no session", async () => {
  const h = harness({ network: async (_call, index) => index === 0 ? ok(tokenSession("recovery")) : index === 1 ? ok(USER) : failure(500, "unexpected_failure") });
  const result = await h.request("/api/trading-auth/reset-password", post({ email: EMAIL, otp: "123456", password: PASSWORD }));
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: "تم تغيير كلمة المرور. تعذر إنهاء جلسات الأجهزة الأخرى؛ سجّل الدخول مجدداً.", code: "logout_failed", passwordChanged: true });
  assert.equal(h.sessionStorage.getItem(KEY), null);
  assert.equal(h.localStorage.getItem(KEY), null);
});

test("concurrent expired-session requests share one refresh and use the rotated token", async () => {
  const gate = deferred();
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession("old", -20)) }), network: async (call) => {
    if (call.url.includes("grant_type=refresh_token")) {
      assertAuthCall(call, "/token?grant_type=refresh_token", { refresh_token: "test-refresh-old" });
      return gate.promise;
    }
    assert.equal(new Headers(call.options.headers).get("authorization"), "Bearer test-access-new");
    return ok({ ready: true });
  } });
  const requests = [h.request("/api/auth/get-session"), h.request("/api/trading?action=markets"), h.request("/api/trading", post({ action: "bootstrap" }))];
  assert.equal(h.calls.length, 1);
  gate.resolve(ok(tokenSession("new")));
  for (const response of await Promise.all(requests)) assert.equal(response.status, 200);
  assert.equal(h.calls.filter((call) => call.url.includes("grant_type=refresh_token")).length, 1);
  assert.equal(h.calls.length, 3);
  assert.equal(JSON.parse(h.sessionStorage.getItem(KEY)).session.refresh_token, "test-refresh-new");
  assert.equal(h.localStorage.getItem(KEY), null);
});

test("remembered tabs coordinate refresh with Web Locks and reread the rotated shared session", async () => {
  let last = Promise.resolve(), refreshCount = 0;
  const locks = { request(_name, _options, task) { const next = last.then(task); last = next.catch(() => {}); return next; } };
  const shared = memoryStorage({ [KEY]: saved(tokenSession("old", -20)) });
  const gate = deferred();
  const network = async (call) => {
    assert.equal(call.url, `${PROJECT}/auth/v1/token?grant_type=refresh_token`);
    refreshCount += 1;
    return gate.promise;
  };
  const first = harness({ localStorage: shared, locks, network });
  const second = harness({ localStorage: shared, locks, network });
  const one = first.request("/api/auth/get-session"), two = second.request("/api/auth/get-session");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCount, 1);
  gate.resolve(ok(tokenSession("new")));
  for (const response of await Promise.all([one, two])) assert.equal((await response.json()).user.id, USER.id);
  assert.equal(refreshCount, 1);
  assert.equal(JSON.parse(shared.getItem(KEY)).session.refresh_token, "test-refresh-new");
});

test("invalid refresh tokens clear the session; temporary outages keep it for a later retry", async () => {
  const invalid = harness({ localStorage: memoryStorage({ [KEY]: saved(tokenSession("old", -20)) }), network: async () => failure(400, "refresh_token_not_found") });
  assert.equal(await (await invalid.request("/api/auth/get-session")).json(), null);
  assert.equal(invalid.localStorage.getItem(KEY), null);
  assert.equal((await invalid.request("/api/trading")).status, 401);
  assert.equal(invalid.calls.length, 1);
  const outage = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession("old", -20)) }), network: async (_call, index) => index === 0 ? failure(503, "unexpected_failure") : ok(tokenSession("new")) });
  assert.equal((await outage.request("/api/auth/get-session")).status, 503);
  assert.equal(JSON.parse(outage.sessionStorage.getItem(KEY)).session.refresh_token, "test-refresh-old");
  assert.equal((await outage.request("/api/auth/get-session")).status, 200);
  assert.equal(outage.calls.length, 2);
});

test("logout during refresh cannot resurrect a session and revokes the discarded refreshed session", async () => {
  const gate = deferred();
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession("old", -20)) }), network: async (call) => {
    if (call.url.includes("grant_type=refresh_token")) return gate.promise;
    assertAuthCall(call, "/logout?scope=local");
    return noContent();
  } });
  const refresh = h.request("/api/auth/get-session");
  assert.equal((await h.request("/api/auth/sign-out", post({}))).status, 200);
  gate.resolve(ok(tokenSession("new")));
  assert.equal(await (await refresh).json(), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.deepEqual(h.calls.filter((call) => call.url.includes("/logout")).map((call) => new Headers(call.options.headers).get("authorization")), ["Bearer test-access-old", "Bearer test-access-new"]);
});

test("a concurrent logout also cancels an in-flight password sign-in", async () => {
  const gate = deferred();
  const h = harness({ network: async (call) => call.url.includes("grant_type=password") ? gate.promise : noContent() });
  const login = h.request("/api/auth/sign-in/email", post({ email: EMAIL, password: PASSWORD, rememberMe: true }));
  assert.equal((await h.request("/api/auth/sign-out", post({}))).status, 200);
  gate.resolve(ok(tokenSession("cancelled")));
  assert.equal((await login).status, 409);
  assert.equal(h.localStorage.getItem(KEY), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
  assertAuthCall(h.calls.at(-1), "/logout?scope=local");
});

test("trading forwards query and body once, replaces auth headers, omits cookies, and preserves the Response", async () => {
  const upstream = Response.json({ error: "execution uncertain", executionUncertain: true }, { status: 409, headers: { "X-Trace": "trace-1" } });
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession()) }), network: async () => upstream });
  const body = JSON.stringify({ action: "open_trade", symbol: "BTC-USD", amount: 20 });
  const response = await h.request("/api/trading?action=markets&symbol=BTC%2FUSD", { method: "POST", body, credentials: "include", headers: { Authorization: "wrong", apikey: "wrong", Cookie: "do-not-send", "X-Client-Info": "client" } });
  assert.equal(response, upstream);
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("X-Trace"), "trace-1");
  assert.equal(response.bodyUsed, false);
  assert.equal(h.calls.length, 1);
  const call = h.calls[0], headers = new Headers(call.options.headers);
  assert.equal(call.url, `${PROJECT}/functions/v1/varex-trading-api?action=markets&symbol=BTC%2FUSD`);
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.body, body);
  assert.equal(call.options.credentials, "omit");
  assert.equal(call.options.redirect, "error");
  assert.equal(headers.get("authorization"), "Bearer test-access-one");
  assert.match(headers.get("apikey"), /^sb_publishable_/);
  assert.equal(headers.get("Cookie"), null);
  assert.equal(headers.get("X-Client-Info"), "client");
});

test("a trading 401 clears the local session without replaying a request", async () => {
  const upstream = Response.json({ error: "Unauthorized" }, { status: 401 });
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession()) }), network: async () => upstream });
  assert.equal(await h.request("/api/trading", post({ action: "open_trade" })), upstream);
  assert.equal(h.calls.length, 1);
  assert.equal(await (await h.request("/api/auth/get-session")).json(), null);
  assert.equal(h.sessionStorage.getItem(KEY), null);
});

test("automation uses its separate authenticated endpoint and never dispatches without a session", async () => {
  const anonymous = harness();
  assert.equal((await anonymous.request('/api/trading-automation')).status, 401);
  assert.equal(anonymous.calls.length, 0);
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession()) }), network: async () => ok({ automation: { enabled: false } }) });
  const body = { action: 'configure', mode: 'demo', enabled: false };
  assert.equal((await h.request('/api/trading-automation', post(body))).status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, `${PROJECT}/functions/v1/varex-trading-automation`);
  assert.equal(new Headers(h.calls[0].options.headers).get('authorization'), 'Bearer test-access-one');
  assert.equal(h.calls[0].options.credentials, 'omit');
  assert.deepEqual(JSON.parse(h.calls[0].options.body), body);
});

test("trading transport failures are not retried and flag mutation execution as uncertain", async () => {
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession()) }), network: async () => { throw new Error("private diagnostic"); } });
  const response = await h.request("/api/trading", post({ action: "open_trade" }));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.executionUncertain, true);
  assert.equal(data.code, "network_error");
  assert.doesNotMatch(JSON.stringify(data), /private diagnostic|test-access/);
  assert.equal(h.calls.length, 1);
});

test("preflight refresh failures never claim that a trading mutation was dispatched", async () => {
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession("old", -20)) }), network: async (call) => {
    assertAuthCall(call, "/token?grant_type=refresh_token", { refresh_token: "test-refresh-old" });
    throw new Error("offline");
  } });
  const response = await h.request("/api/trading", post({ action: "open_trade" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).executionUncertain, undefined);
  assert.equal(h.calls.length, 1);
});

test("aborting an already dispatched trading mutation preserves execution uncertainty", async () => {
  const h = harness({ sessionStorage: memoryStorage({ [KEY]: saved(tokenSession()) }), network: async () => { throw new DOMException("aborted", "AbortError"); } });
  const response = await h.request("/api/trading", post({ action: "open_trade" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).executionUncertain, true);
  assert.equal(h.calls.length, 1);
});

test("auth rejects invalid methods and malformed upstream data without exposing its content", async () => {
  const h = harness({ network: async () => new Response("private non-JSON diagnostic", { headers: { "content-type": "text/html" } }) });
  const invalidMethod = await h.request("/api/auth/sign-in/email");
  assert.equal(invalidMethod.status, 405);
  assert.equal(invalidMethod.headers.get("allow"), "POST");
  assert.equal(h.calls.length, 0);
  const response = await h.request("/api/auth/sign-in/email", post({ email: EMAIL, password: PASSWORD }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private non-JSON|test-access/);
});
