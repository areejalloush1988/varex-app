import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8");
const broker = fs.readFileSync(new URL("../backend/lib/trading-broker.ts", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../backend/lib/trading-market.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../backend/drizzle/0005_trading_schema.sql", import.meta.url), "utf8");
const brokerMigration = fs.readFileSync(new URL("../backend/drizzle/0006_flippant_shatterstar.sql", import.meta.url), "utf8");

test("ships every requested trading workspace as a real navigation view", () => {
  for (const view of ["dashboard", "intelligence", "trades", "risk", "broker", "watchlist", "reports", "users", "settings"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(client, new RegExp(`${view}: render`, "i"));
  }
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

test("keeps paper trading while adding manually confirmed live execution", () => {
  assert.match(access, /mode: "paper"/);
  assert.match(access, /maxOpenTrades/);
  assert.match(access, /maxDailyLossPct/);
  assert.match(access, /UPDATE trading_state SET state_json/);
  assert.match(access, /LIVE_ORDER_CONFIRMED/);
  assert.match(access, /ENABLE_LIVE_SPOT/);
  assert.match(access, /requireBrokerAccess\(request\)/);
  assert.match(client, /تأكيد صفقة حقيقية/);
  assert.match(client, /app\.executionMode === "live"/);
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
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
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
  assert.match(client, /app\.state\.trades/);
  assert.doesNotMatch(client, /sampleTrade|fakePrice|mockTrade/i);
});

test("guides a user from currency selection to AI analysis and a paper trade", () => {
  assert.match(client, /بدء أول تجربة تداول/);
  assert.match(client, /data-action="guided-analysis"/);
  assert.match(client, /data-use-analysis/);
  assert.match(client, /await runAnalysis\(marketButton\.dataset\.market\)/);
  assert.match(client, /لم يُخصم أي مال حقيقي/);
  assert.match(access, /حساب التداول غير مربوط/);
  assert.match(html, /لا حاجة إلى ربط حساب تداول أو إيداع مال/);
});

test("keeps user-facing Arabic instructions gender neutral", () => {
  const visibleCopy = [html, client, access, broker].join("\n");
  assert.doesNotMatch(visibleCopy, /ابدئي|اختاري|شغّلي|افتحي|حلّلي|دعي|جرّبي|تحتاجين|تؤكدين|استخدمي|راجعي/);
  assert.doesNotMatch(visibleCopy, /(?:^|[\s،.!؟>"'])(?:ادخل|أدخل|اختر|سجّل|أكد|اطلب|أعد|ابدأ|افتح|احفظ|راجع|أضف|حدّد|استخدم)(?=[\s،.!؟<"'])/);
  assert.match(client, /اختيار عملة، تشغيل تحليل VAREX، ثم تجربة صفقة ورقية/);
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
