import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = fs.readFileSync(new URL("../broker-directory.js", import.meta.url), "utf8");
const context = vm.createContext({ module: { exports: {} }, Intl });
vm.runInContext(script, context);
const { catalogue, getProvider, renderChoices, renderDirectory } = context.module.exports;

test("directory exports an immutable catalogue and explicit supported capabilities", () => {
  assert.equal(Object.isFrozen(catalogue), true);
  assert.ok(catalogue.every(Object.isFrozen));
  assert.equal(new Set(catalogue.map((provider) => provider.id)).size, catalogue.length);
  assert.equal(getProvider("binance").capability, "execution");
  assert.equal(getProvider("capital").capability, "account_view");
  assert.equal(getProvider("__proto__"), null);
  assert.equal(getProvider("missing"), null);
  for (const id of ["amana", "iqoption", "olymptrade", "pocketoption", "hedg", "mt4", "mt5", "other"]) {
    assert.equal(getProvider(id).capability, "unavailable");
  }
});

test("the two account choices have the required headings and explicit post-login demo balance", () => {
  const html = renderChoices();
  assert.match(html, /<h2>حساب تجريبي<\/h2>/);
  assert.match(html, /<h2>ربط حساب منصة تداول<\/h2>/);
  assert.match(html, /data-account-choice="demo"/);
  assert.match(html, /data-account-choice="connect"/);
  assert.match(html, /25,000/);
  assert.match(html, /بعد إنشاء حساب VAREX أو تسجيل الدخول/);
  assert.doesNotMatch(html, /متصل|حساب مربوط|رصيدك الحالي/);
});

test("supported provider entry links return to the authenticated app and never include credential fields", () => {
  for (const id of ["binance", "capital"]) {
    const html = renderDirectory({ selectedId: id });
    assert.match(html, new RegExp('data-broker-connect="' + id + '"'));
    assert.ok(html.includes('href="/trading/?account=connect&amp;provider=' + id + '"'));
    assert.doesNotMatch(html, /type="password"|name="apiKey"|name="identifier"|<form/);
  }
  assert.match(renderDirectory({ selectedId: "capital" }), /أوامر عقود الفروقات غير متاحة/);
});

test("every unavailable provider has information only and no connection CTA", () => {
  for (const provider of catalogue.filter((item) => item.capability === "unavailable")) {
    const html = renderDirectory({ selectedId: provider.id, currentProvider: provider.id });
    assert.match(html, /غير متاح داخل VAREX حالياً/);
    assert.doesNotMatch(html, /data-broker-connect=|type="password"|هذه المنصة محددة في حسابك/);
    if (provider.officialUrl) assert.ok(html.includes('href="' + provider.officialUrl + '"'));
  }
});

test("search filters the catalogue without changing a selected provider or enabling it", () => {
  const html = renderDirectory({ selectedId: "capital", query: "IQ Option" });
  assert.match(html, /data-broker-provider="iqoption"/);
  assert.doesNotMatch(html, /data-broker-provider="binance"/);
  assert.match(html, /data-broker-detail="capital"/);
  assert.equal(getProvider("iqoption").capability, "unavailable");
});

test("search and option inputs are escaped and cannot generate arbitrary provider links", () => {
  const payload = '"><img src=x onerror=alert(1)>';
  const html = renderDirectory({ selectedId: payload, query: payload, currentProvider: payload });
  assert.doesNotMatch(html, /<img|onerror=alert\(1\)>/);
  assert.match(html, /&quot;&gt;&lt;img/);
  assert.match(html, /data-broker-detail="capital"/);
  assert.doesNotMatch(renderChoices({ demoBalance: payload }), /<img/);
});

test("public account entry page contains no account API, auth client or credential forms", () => {
  const controller = fs.readFileSync(new URL("../accounts-page.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../../trading/accounts.html", import.meta.url), "utf8");
  assert.doesNotMatch(controller, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\/api\/|supabase/);
  assert.doesNotMatch(html, /supabase-api\.js|app\.js\?|type="password"|name="apiKey"/);
  assert.match(html, /بعد التسجيل/);
  assert.match(controller, /\/trading\/\?account=demo/);
});
