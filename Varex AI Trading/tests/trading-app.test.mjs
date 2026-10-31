import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../analysis-app.js", import.meta.url), "utf8");
const legacyClient = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8");
const otp = fs.readFileSync(new URL("../backend/lib/trading-otp.ts", import.meta.url), "utf8");
const broker = fs.readFileSync(new URL("../backend/lib/trading-broker.ts", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../backend/lib/trading-market.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../backend/drizzle/0005_trading_schema.sql", import.meta.url), "utf8");
const brokerMigration = fs.readFileSync(new URL("../backend/drizzle/0006_flippant_shatterstar.sql", import.meta.url), "utf8");

test("the published shell loads only the analysis workspace and its four navigation views", () => {
  for (const view of ["analysis", "history", "learn", "settings"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(html, new RegExp(`id="${view}View"`));
  }
  for (const view of ["dashboard", "intelligence", "trades", "risk", "broker", "watchlist", "reports", "users", "automation"]) assert.doesNotMatch(html, new RegExp(`data-view="${view}"`));
  assert.match(html, /src="\.\/analysis-app\.js\?/);
  assert.match(html, /src="\.\/analysis-assistant-core\.js\?/);
  assert.match(html, /src="\.\/analysis-data\.js\?/);
  assert.doesNotMatch(html, /src="[^\"]*\/(?:app|broker-directory|market-workspace|markets-page|accounts-page)\.js/);
  assert.doesNotMatch(html, /name="(?:apiKey|apiSecret|apiPassword)"|data-execution-mode|id="tradeForm"/);
  assert.doesNotMatch(html, /أريج/);
  assert.match(client, /profile\.displayName/);
});

test("ships complete password controls and keeps logout last in the right menu", () => {
  assert.match(html, /name="confirmPassword"/);
  assert.ok((html.match(/data-password-toggle/g) || []).length >= 4);
  for (const rule of ["length", "upper", "lower", "number", "symbol"]) {
    assert.match(html, new RegExp(`data-password-rule="${rule}"`));
  }
  assert.match(client, /password !== confirmPassword/);
  assert.match(client, /input\.type = reveal \? "text" : "password"/);
  assert.match(html, /class="nav-item logout-item"[^>]*data-action="logout"/);
});

test("legacy backend execution checks remain covered while the analysis shell never loads its old client", () => {
  assert.match(access, /mode: "paper"/);
  assert.match(access, /maxOpenTrades/);
  assert.match(access, /maxDailyLossPct/);
  assert.match(access, /UPDATE trading_state SET state_json/);
  assert.match(access, /LIVE_ORDER_CONFIRMED/);
  assert.match(access, /ENABLE_LIVE_SPOT/);
  assert.match(access, /requireBrokerAccess\(request\)/);
  assert.match(legacyClient, /تأكيد صفقة حقيقية/);
  assert.match(legacyClient, /app\.executionMode === "live"/);
  assert.doesNotMatch(client, /executionMode|connect_broker|open_trade|close_trade|place_order|\/api\/trading-automation/);
});

test("encrypts provider credentials and refuses money-movement permissions", () => {
  assert.match(broker, /AES-GCM/);
  assert.match(broker, /HMAC/);
  assert.match(broker, /\/sapi\/v1\/account\/apiRestrictions/);
  assert.match(broker, /permissions\.withdrawals/);
  assert.match(broker, /permissions\.internalTransfer \|\| permissions\.universalTransfer/);
  assert.match(broker, /\/api\/v3\/order\/test/);
  assert.match(broker, /\/api\/v3\/order/);
  assert.doesNotMatch(broker, /\/withdraw(?:\?|"|')/i);
  assert.doesNotMatch(legacyClient, /localStorage|sessionStorage/);
  assert.doesNotMatch(client, /apiKey|apiSecret|apiPassword/);
  assert.match(brokerMigration, /api_key_ciphertext/);
  assert.match(brokerMigration, /api_secret_ciphertext/);
  assert.doesNotMatch(brokerMigration, /`api_key` text|`api_secret` text/);
});

test("uses resilient live market endpoints and never inserts sample trades", () => {
  assert.match(market, /api\.exchange\.coinbase\.com/);
  assert.match(market, /products\/\$\{symbol\}\/stats/);
  assert.match(market, /products\/\$\{symbol\}\/candles/);
  assert.match(market, /api\.kraken\.com/);
  assert.match(market, /0\/public\/Ticker/);
  assert.match(market, /0\/public\/OHLC/);
  assert.match(market, /Promise\.allSettled/);
  assert.match(legacyClient, /app\.state\.trades/);
  assert.doesNotMatch(client, /sampleTrade|fakePrice|mockTrade/i);
});

test("analysis needs an active matching profile and never requests a trading bootstrap", () => {
  assert.match(client, /profile\.id === session\?\.user\?\.id/);
  assert.match(client, /profile\.status === "active"/);
  assert.match(client, /authRequest\("\/api\/auth\/get-session", undefined, "GET"\)/);
  assert.match(client, /request\("\/api\/trading\?action=access", \{ method: "GET" \}\)/);
  assert.doesNotMatch(client, /bootstrap|request\("\/api\/trading"\s*\)/);
  assert.match(html, /id="registerPane"/);
  assert.match(html, /class="auth-pane hidden" id="loginForm"/);
  assert.match(html, /class="auth-pane" id="registerPane"/);
});

test("analysis copy keeps Arabic instructions neutral and does not advertise guaranteed returns", () => {
  const visibleCopy = [html, client].join("\n");
  assert.doesNotMatch(visibleCopy, /ابدئي|اختاري|شغّلي|افتحي|حلّلي|دعي|جرّبي|تحتاجين|تؤكدين|استخدمي|راجعي/);
  assert.doesNotMatch(visibleCopy, /أرباح مضمونة|ربح مضمون|نسبة نجاح 100|25,000 دولار تجريبي/);
  assert.match(client, /تحليل حسابي/);
  assert.match(client, /languageModelAvailable === true/);
  assert.match(html, /maxlength="1000"/);
  assert.match(client, /question\.length > 1000/);
  assert.match(client, /السؤال طويل/);
});

test("reports and chart disclose provenance, account-local storage and restricted provider limits", () => {
  assert.match(client, /varex\.analysis\.reports\.v1\.\$\{encodeURIComponent\(app\.profile\.id\)\}/);
  assert.match(client, /app\.dataset\?\.allowExport === false/);
  assert.match(client, /app\.dataset\?\.provenance\?\.displayOnly === true/);
  assert.match(client, /لا يقرأ المساعد بيانات هذا العرض/);
  assert.match(html, /التقارير المحفوظة/);
  assert.match(html, /لا تتزامن تلقائياً مع الأجهزة الأخرى/);
  assert.match(html, /UTC — التوقيت العالمي/);
  assert.match(client, /dataset\.symbol !== app\.symbol \|\| dataset\.interval !== app\.interval/);
});

test("persists profiles, invites and trading state in D1", () => {
  assert.match(migration, /CREATE TABLE `trading_profile`/);
  assert.match(migration, /CREATE TABLE `trading_invite`/);
  assert.match(migration, /CREATE TABLE `trading_state`/);
  assert.match(migration, /FOREIGN KEY/);
  assert.match(brokerMigration, /CREATE TABLE `trading_broker_connection`/);
  assert.match(brokerMigration, /CREATE TABLE `trading_live_order`/);
  assert.match(brokerMigration, /UNIQUE INDEX `trading_live_order_client_uidx`/);
});

test("allows public OTP registration without developer pre-approval", () => {
  assert.match(html, /إنشاء حساب VAREX/);
  assert.match(html, /سيصل رمز إلى بريدك لتأكيد الحساب/);
  assert.match(access, /return !invite \|\| invite\.status !== "revoked"/);
  assert.match(access, /const role: "trader" \| "viewer" = invite\?\.role === "viewer" \? "viewer" : "trader"/);
  assert.doesNotMatch(otp, /هذا البريد غير مضاف إلى مستخدمي التطبيق/);
  assert.doesNotMatch(access, /تجب إضافته من إدارة الحسابات أولاً/);
  assert.match(client, /let signUpError = null/);
  assert.match(client, /await authRequest\("\/api\/trading-auth\/send-otp"/);
});

test("isolates each user's portfolio, balance, broker, and live orders", () => {
  assert.match(access, /FROM trading_state WHERE user_id = \?/);
  assert.match(access, /UPDATE trading_state SET state_json = \?, version = version \+ 1, updated_at = \? WHERE user_id = \?/);
  assert.match(access, /FROM trading_broker_connection WHERE user_id = \?/);
  assert.match(access, /FROM trading_live_order WHERE user_id = \?/);
  assert.match(access, /return requireAccess\(request, \["developer", "trader"\], validateInput\)/);
  assert.match(access, /canConnectBroker: profile\.role !== "viewer"/);
  assert.match(migration, /`user_id` text PRIMARY KEY NOT NULL/);
  assert.match(brokerMigration, /`user_id` text PRIMARY KEY NOT NULL/);
  assert.match(brokerMigration, /`user_id` text NOT NULL/);
});
