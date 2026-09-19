import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../backend/lib/trading-market.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../backend/drizzle/0005_trading_schema.sql", import.meta.url), "utf8");

test("ships every requested trading workspace as a real navigation view", () => {
  for (const view of ["dashboard", "intelligence", "trades", "risk", "watchlist", "reports", "users", "settings"]) {
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

test("keeps financial execution in persistent paper mode with server-side controls", () => {
  assert.match(access, /mode: "paper"/);
  assert.match(access, /maxOpenTrades/);
  assert.match(access, /maxDailyLossPct/);
  assert.match(access, /UPDATE trading_state SET state_json/);
  assert.doesNotMatch(access, /apiKey|secretKey|placeOrder/);
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
  assert.match(access, /التجربة جاهزة — لا تحتاج وسيط/);
  assert.match(html, /لا حاجة إلى ربط وسيط أو إيداع مال/);
});

test("keeps user-facing Arabic instructions gender neutral", () => {
  const visibleCopy = [html, client, access].join("\n");
  assert.doesNotMatch(visibleCopy, /ابدئي|اختاري|شغّلي|افتحي|حلّلي|دعي|جرّبي|تحتاجين|تؤكدين|استخدمي|راجعي/);
  assert.doesNotMatch(visibleCopy, /(?:^|[\s،.!؟>"'])(?:ادخل|أدخل|اختر|سجّل|أكد|اطلب|أعد|ابدأ|افتح|احفظ|راجع|أضف|حدّد|استخدم)(?=[\s،.!؟<"'])/);
  assert.match(client, /اختيار عملة، تشغيل تحليل VAREX، ثم تجربة صفقة ورقية/);
});

test("persists profiles, invites and trading state in D1", () => {
  assert.match(migration, /CREATE TABLE `trading_profile`/);
  assert.match(migration, /CREATE TABLE `trading_invite`/);
  assert.match(migration, /CREATE TABLE `trading_state`/);
  assert.match(migration, /FOREIGN KEY/);
});
