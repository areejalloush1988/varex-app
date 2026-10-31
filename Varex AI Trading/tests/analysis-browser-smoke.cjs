/*
 * Browser smoke test for the published analysis shell. All authentication,
 * application, and crypto requests are fixtures confined to this test browser.
 * No real account is created and no production API receives a mutation.
 *
 * PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node tests/analysis-browser-smoke.cjs
 * ANALYSIS_ENTRY_PATH defaults to /trading/ (the public mirror).
 * ANALYSIS_ARTIFACT_DIR defaults to <repository>/artifacts/analysis-browser.
 * ANALYSIS_GOLD_DIAGNOSTIC=1 additionally makes one anonymous read-only browser
 * fetch to goldprice.dev in a separate context, never used by the assertions.
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const repository = path.resolve(__dirname, "../..");
const artifactDir = path.resolve(process.env.ANALYSIS_ARTIFACT_DIR || path.join(repository, "artifacts/analysis-browser"));
const entryPath = process.env.ANALYSIS_ENTRY_PATH || "/trading/";
const fixturePassword = "BrowserFixture!2026";
const users = {
  alpha: { id: "11111111-1111-4111-8111-111111111111", email: "alpha@fixture.invalid", name: "حساب الاختبار ألف" },
  beta: { id: "22222222-2222-4222-8222-222222222222", email: "beta@fixture.invalid", name: "حساب الاختبار باء" },
  inactive: { id: "33333333-3333-4333-8333-333333333333", email: "inactive@fixture.invalid", name: "حساب موقوف للاختبار" },
};
const report = { startedAt: new Date().toISOString(), entryPath, fixtureOnly: true, steps: [], screenshots: [], pageErrors: [], unexpectedRequests: [], goldDiagnostic: { status: "skipped", reason: "Set ANALYSIS_GOLD_DIAGNOSTIC=1 to run the optional anonymous browser fetch." } };
let server, browser, activePage, baseUrl;

function playwrightModule() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright")].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); }
    catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
  }
  throw new Error("Playwright is unavailable. Set PLAYWRIGHT_MODULE to an installed playwright package and install its Chromium browser.");
}

async function startServer() {
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".json": "application/json" };
  server = http.createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
      let pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const filename = path.resolve(repository, "." + pathname);
      if (!filename.startsWith(repository + path.sep)) { response.writeHead(403); response.end(); return; }
      const content = await fsp.readFile(filename);
      response.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

function candleFixture(start, count = 80, base = 100) {
  return Array.from({ length: count }, (_, i) => ({ time: start + i * 3600, open: base + i, high: base + i + 2, low: base + i - 1, close: base + i + 1, volume: 100 + i }));
}
const csvCandles = candleFixture(Date.parse("2025-01-01T00:00:00Z") / 1000, 80, 2000);
const csvText = ["time,open,high,low,close,volume", ...csvCandles.map((row) => [new Date(row.time * 1000).toISOString(), row.open, row.high, row.low, row.close, row.volume].join(","))].join("\n");
const csvSource = "QA CSV Alpha — historical fixture 2025";
const expectedCsv = { close: 2080, support: 2058, resistance: 2080, displayedCandles: 75, asOf: "2025-01-04T08:00:00.000Z" };
const displayPrice = (number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);

function sessionFor(key) {
  const user = users[key];
  return { access_token: `browser-fixture-${key}`, refresh_token: `browser-refresh-${key}`, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: user.id, email: user.email, email_confirmed_at: "2025-01-01T00:00:00Z", user_metadata: { name: user.name, display_name: user.name } } };
}
function fixtureKey(request) { return (request.headers().authorization || "").replace(/^Bearer browser-fixture-/, ""); }
function bodyOf(request) { try { return request.postDataJSON() || {}; } catch { return {}; } }
async function respond(route, value, status = 200) {
  return route.fulfill({ status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" }, body: status === 204 ? "" : JSON.stringify(value) });
}

async function installFixtures(context, name) {
  const state = { name, requests: [], auth: [], accessOverride: null, crypto: [], modelCalls: [] };
  context.on("page", (page) => page.on("pageerror", (error) => report.pageErrors.push({ context: name, message: error.message, stack: error.stack })));
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === baseUrl) {
      if (url.pathname.startsWith("/api/")) {
        report.unexpectedRequests.push({ context: name, method: request.method(), url: url.href });
        return respond(route, { error: "Unexpected local API; the real auth transport must be loaded." }, 500);
      }
      return route.continue();
    }
    if (url.hostname.endsWith(".supabase.co")) {
      if (request.method() === "OPTIONS") return respond(route, null, 204);
      const body = bodyOf(request), key = fixtureKey(request);
      state.requests.push({ method: request.method(), path: url.pathname, action: url.searchParams.get("action") || body.action || null, user: users[key]?.id || null });
      if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
        const userKey = Object.keys(users).find((candidate) => users[candidate].email === body.email);
        state.auth.push({ operation: "login", user: userKey || "unknown" });
        if (!userKey || body.password !== fixturePassword) return respond(route, { error_code: "invalid_credentials" }, 400);
        return respond(route, sessionFor(userKey));
      }
      if (url.pathname === "/auth/v1/logout") { state.auth.push({ operation: "logout", user: key }); return respond(route, {}, 204); }
      if (url.pathname === "/functions/v1/varex-trading-api" && request.method() === "GET" && url.searchParams.get("action") === "access") {
        if (!users[key]) return respond(route, { error: "Fixture authentication required." }, 401);
        const profile = { id: users[key].id, displayName: users[key].name, status: key === "inactive" ? "suspended" : "active", role: "viewer" };
        return respond(route, { profile: { ...profile, ...(state.accessOverride || {}) } });
      }
      if (url.pathname === "/functions/v1/varex-analysis-api" && url.searchParams.get("action") === "capabilities") {
        return respond(route, { languageModelAvailable: false, analysisMode: "technical-calculation", marketDataConfigured: false });
      }
      if (url.pathname === "/functions/v1/varex-analysis-api" && url.searchParams.get("action") === "market") {
        return respond(route, { error: "Fixture: gold provider unavailable.", code: "market_provider_not_configured" }, 503);
      }
      if (url.pathname === "/functions/v1/varex-analysis-api" && url.searchParams.get("action") === "chat") state.modelCalls.push(body);
      report.unexpectedRequests.push({ context: name, method: request.method(), url: url.href, action: body.action || null });
      return respond(route, { error: "Unexpected production API request in fixture browser." }, 500);
    }
    if (url.hostname === "api.exchange.coinbase.com" && /^\/products\/(BTC|ETH|SOL|ADA)-USD\/candles$/.test(url.pathname)) {
      state.crypto.push({ path: url.pathname, granularity: url.searchParams.get("granularity") });
      const end = Math.floor(Date.now() / 3600000) * 3600;
      return respond(route, candleFixture(end - 80 * 3600).map((row) => [row.time, row.low, row.high, row.open, row.close, row.volume]).reverse());
    }
    if (url.hostname === "s3.tradingview.com" && url.pathname === "/external-embedding/embed-widget-advanced-chart.js") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "(() => { const host = document.currentScript.parentElement.querySelector('.tradingview-widget-container__widget'); if (host) { host.textContent = 'REFERENCE WIDGET STUB — browser test only'; host.style.cssText = 'display:grid;place-items:center;font:12px sans-serif;opacity:.65;text-align:center'; } })();" });
    }
    // Fixture assertions never depend on an external widget, font, or API.
    report.unexpectedRequests.push({ context: name, method: request.method(), url: url.href });
    return route.abort("blockedbyclient");
  });
  return state;
}

async function step(name, task) {
  const started = Date.now(), item = { name, status: "running" }; report.steps.push(item);
  try { await task(); item.status = "passed"; }
  catch (error) { item.status = "failed"; item.error = error.stack || String(error); throw error; }
  finally { item.durationMs = Date.now() - started; }
}
async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(artifactDir, filename), fullPage: true, animations: "disabled" });
  report.screenshots.push(filename);
}
async function visible(page, selector) { await page.locator(selector).waitFor({ state: "visible" }); }
async function hidden(page, selector) { await page.locator(selector).waitFor({ state: "hidden" }); }
async function textMatches(page, selector, pattern) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible" });
  await page.waitForFunction(({ selector, pattern, flags }) => new RegExp(pattern, flags).test(document.querySelector(selector)?.textContent || ""), { selector, pattern: pattern.source, flags: pattern.flags });
  assert.match(await locator.innerText(), pattern);
}
async function login(page, key, expectAllowed = true) {
  await visible(page, "#authScreen");
  if (!(await page.locator("#loginForm").isVisible())) await page.locator("#registerPane [data-auth-pane=loginForm]").click();
  await page.locator('#loginForm [name="email"]').fill(users[key].email);
  await page.locator('#loginForm [name="password"]').fill(fixturePassword);
  await page.locator('#loginForm button[type="submit"]').click();
  if (expectAllowed) { await visible(page, "#appShell"); await hidden(page, "#loadingScreen"); }
  else { await textMatches(page, "#authMessage", /غير متاح/); await hidden(page, "#appShell"); }
}
async function nav(page, view) {
  if (await page.locator("#menuButton").isVisible() && !(await page.locator("#sidebar").evaluate((element) => element.classList.contains("open")))) await page.locator("#menuButton").click();
  await page.locator(`#sidebar [data-view="${view}"]`).click();
  await visible(page, `#${view}View`);
}
async function logout(page) {
  if (await page.locator("#menuButton").isVisible()) await page.locator("#menuButton").click();
  await page.locator('#sidebar [data-action="logout"]').click();
  await visible(page, "#registerPane"); await hidden(page, "#appShell");
  await page.waitForFunction(() => !Object.keys(localStorage).some((key) => key.startsWith("varex.trading.supabase.session")) && !Object.keys(sessionStorage).some((key) => key.startsWith("varex.trading.supabase.session")));
  assert.equal(await page.locator("#chartRoot").innerText(), "");
  assert.equal(await page.locator("#chatMessages").innerText(), "");
}
async function ask(page, question) {
  const count = await page.locator(".aa-message.assistant").count();
  await page.locator("#chatInput").fill(question);
  await page.locator('#chatForm button[type="submit"]').click();
  await page.waitForFunction((previous) => document.querySelectorAll(".aa-message.assistant").length > previous, count);
  return page.locator(".aa-message.assistant").last().innerText();
}
async function importCsv(page, source = csvSource) {
  await page.locator('#pageActions [data-action="import"]').click();
  await visible(page, "#importDialog");
  await page.locator("#csvFile").setInputFiles({ name: "btc_fixture.csv", mimeType: "text/csv", buffer: Buffer.from(csvText) });
  await page.waitForFunction(() => document.querySelector("#csvText").value.startsWith("time,open,high,low,close,volume\n"));
  await page.locator('#importForm [name="source"]').fill(source);
  await page.locator('#importForm [name="timezone"]').selectOption("0");
  await page.locator('#importForm button[type="submit"]').click();
  await hidden(page, "#importDialog");
  await textMatches(page, "#chartKind", /شموع مستوردة/);
}
async function noOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    offenders: [...document.querySelectorAll("#appShell main, #appShell main *")].filter((element) => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return style.display !== "none" && rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);
    }).slice(0, 8).map((element) => ({ tag: element.tagName, id: element.id, class: element.className, width: element.getBoundingClientRect().width })) }));
  assert.ok(metrics.documentWidth <= metrics.width + 2 && metrics.bodyWidth <= metrics.width + 2, `${label}: page overflows horizontally: ${JSON.stringify(metrics)}`);
  report.steps.at(-1).layout = metrics;
}
async function noTradingSurface(page) {
  const scripts = await page.locator("script[src]").evaluateAll((elements) => elements.map((element) => new URL(element.src).pathname));
  assert.ok(scripts.some((value) => value.endsWith("/analysis-app.js")));
  assert.ok(!scripts.some((value) => /\/(?:app|broker-directory|accounts-page|market-workspace|markets-page)\.js$/.test(value)), "Old trading clients must not load");
  assert.equal(await page.locator('#appShell [data-view="broker"], #appShell [data-view="trades"], #appShell [data-view="automation"], #appShell [data-execution-mode], #appShell [data-broker-connect], #appShell input[name="apiKey"], #appShell input[name="apiSecret"], #tradeForm, #brokerConnectForm').count(), 0);
  const labels = await page.locator("#appShell button, #appShell a").allTextContents();
  assert.doesNotMatch(labels.join("\n"), /فتح.{0,12}صفقة|إغلاق.{0,12}صفقة|إيداع|سحب|ربط.{0,12}(?:منصة|حساب)|تداول آلي|تفعيل البوت/);
}

async function desktopSmoke() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ar-AE", timezoneId: "UTC", serviceWorkers: "block", reducedMotion: "reduce" });
  const fixture = await installFixtures(context, "desktop"), page = await context.newPage(); activePage = page; page.setDefaultTimeout(10000);
  await step("Anonymous entry starts at signup with no app or data requests", async () => {
    await page.goto(baseUrl + entryPath, { waitUntil: "domcontentloaded" });
    await hidden(page, "#loadingScreen"); await visible(page, "#registerPane"); await hidden(page, "#loginForm"); await hidden(page, "#appShell");
    assert.equal(fixture.requests.length, 0); assert.equal(fixture.crypto.length, 0);
    await noOverflow(page, "desktop signup"); await screenshot(page, "01-signup-desktop.png");
  });
  await step("Active matching profile opens assistant via access, without bootstrap", async () => {
    await login(page, "alpha");
    await textMatches(page, "#analysisMode", /تحليل حسابي/);
    assert.equal(await page.locator("#marketSelect").inputValue(), "XAU-USD");
    assert.deepEqual(await page.locator("#intervalButtons button").evaluateAll((buttons) => buttons.map((button) => button.dataset.interval)), ["1", "5", "15", "60", "240", "D", "W", "M"]);
    const access = fixture.requests.filter((item) => item.path.endsWith("/varex-trading-api"));
    assert.ok(access.length > 0); assert.ok(access.every((item) => item.method === "GET" && item.action === "access" && item.user === users.alpha.id));
    await noTradingSurface(page); assert.equal(await page.locator("#chartRoot svg").count(), 0);
    assert.match(await page.locator("#chartCaption").innerText(), /مستقل عن محرك التحليل/);
  });
  await step("Unavailable gold has an honest CSV fallback and no numerical report", async () => {
    await page.locator("#analyzeButton").click();
    await textMatches(page, "#reportRoot", /بيانات الذهب الآلية غير متاحة/);
    assert.equal(await page.locator("#chartRoot svg, #reportRoot .aa-level").count(), 0);
    assert.equal(await page.locator("#saveReportButton").isDisabled(), true);
    assert.equal(await page.locator('#reportRoot [data-action="import"]').count(), 1);
    const answer = await ask(page, "حلل الذهب اليوم واعطني السعر الحالي");
    assert.match(answer, /لا أملك سعراً حالياً|دون البيانات/);
    const glossary = await ask(page, "شو يعني دعم ومقاومة؟"); assert.match(glossary, /الدعم منطقة/);
    await screenshot(page, "02-gold-unavailable.png");
  });
  await step("Restricted crypto feed plots exact fixture candles and cannot be saved or exported", async () => {
    await page.locator("#marketSelect").selectOption("BTC-USD"); await page.locator("#analyzeButton").click();
    await textMatches(page, "#reportRoot", /Coinbase Exchange/);
    assert.equal(await page.locator("#chartRoot svg rect").count(), 75);
    assert.equal(await page.locator(".aa-level.close b").innerText(), "180");
    assert.equal(await page.locator(".aa-level.support b").innerText(), "158");
    assert.equal(await page.locator(".aa-level.resistance b").innerText(), "180");
    assert.equal(await page.locator("#saveReportButton").isDisabled(), true);
    assert.match(await page.locator("#saveReportButton").getAttribute("title"), /بالعرض فقط/);
    assert.equal(await page.locator('[data-history="export"]').count(), 0);
    assert.equal(fixture.crypto.length, 1); assert.equal(fixture.crypto[0].granularity, "3600");
    assert.equal(await page.locator("#chartCaption a").getAttribute("href"), "https://www.coinbase.com/advanced-trade/spot");
  });
  await step("Historical CSV produces the same chart, stated date and independently expected levels", async () => {
    await importCsv(page);
    assert.equal(await page.locator("#chartRoot svg rect").count(), expectedCsv.displayedCandles);
    assert.equal(await page.locator(".aa-level.close b").innerText(), displayPrice(expectedCsv.close));
    assert.equal(await page.locator(".aa-level.support b").innerText(), displayPrice(expectedCsv.support));
    assert.equal(await page.locator(".aa-level.resistance b").innerText(), displayPrice(expectedCsv.resistance));
    assert.match(await page.locator("#chartCaption").innerText(), /QA CSV Alpha/);
    assert.match(await page.locator("#reportRoot").innerText(), /بيانات تاريخية|قراءة تاريخية/);
    assert.equal(await page.locator("#saveReportButton").isDisabled(), false);
    assert.equal(await page.locator("#reportRoot img, #chatMessages img").count(), 0);
  });
  await step("Questions stay scoped to the loaded market and label local explanation truthfully", async () => {
    assert.equal(await page.locator("#chatInput").getAttribute("maxlength"), "1000");
    const beforeLongQuestion = await page.locator(".aa-message.user").count();
    await page.locator("#chatInput").evaluate((input) => { input.value = "س".repeat(1001); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    await textMatches(page, "#toast", /السؤال طويل/);
    assert.equal(await page.locator(".aa-message.user").count(), beforeLongQuestion);
    assert.match(await ask(page, "وين الدعم والمقاومة؟"), /2058/);
    assert.match(await ask(page, "حلل الذهب اليوم"), /التقرير الحالي يخص BTC-USD/);
    assert.match(await ask(page, "شو يعني RSI؟"), /القيمة المحسوبة في التقرير/);
    const malicious = '<img src=x onerror="window.fixtureXss=true">'; await ask(page, malicious);
    assert.equal(await page.locator("#chatMessages img").count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureXss), undefined);
    assert.match(await page.locator(".aa-message.assistant .aa-message-meta").last().innerText(), /شرح محلي/);
    assert.equal(fixture.modelCalls.length, 0);
    await noOverflow(page, "desktop analysis"); await screenshot(page, "03-analysis-desktop-dark.png");
  });
  await step("Theme changes preserve data and use the shared navy/yellow palette", async () => {
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.locator(".topbar [data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    assert.equal(await page.locator(".aa-level.close b").innerText(), displayPrice(expectedCsv.close));
    const colors = await page.evaluate(() => { const style = getComputedStyle(document.documentElement); return { navy: style.getPropertyValue("--brand-navy").trim(), yellow: style.getPropertyValue("--brand-yellow").trim() }; });
    assert.ok(colors.navy && colors.yellow && colors.navy !== colors.yellow);
    await noOverflow(page, "desktop light"); await screenshot(page, "04-analysis-desktop-light.png");
    await page.locator(".topbar [data-theme-toggle]").click();
  });
  await step("Local report history retains source and timestamp and exports only the imported report", async () => {
    await page.locator("#saveReportButton").click(); await textMatches(page, "#historyCount", /^1$/);
    const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem(`varex.analysis.reports.v1.${id}`)), users.alpha.id);
    assert.equal(saved.length, 1); assert.equal(saved[0].symbol, "BTC-USD"); assert.equal(saved[0].source, csvSource); assert.equal(saved[0].asOf, expectedCsv.asOf); assert.equal(saved[0].allowExport, true);
    await nav(page, "history"); assert.equal(await page.locator(".aa-history-card").count(), 1);
    const downloadPromise = page.waitForEvent("download"); await page.locator('[data-history="export"]').click();
    const download = await downloadPromise, stream = await download.createReadStream();
    let text = ""; for await (const chunk of stream) text += chunk.toString("utf8");
    assert.match(text, /QA CSV Alpha/); assert.match(text, /2025-01-04T08:00:00\.000Z/); assert.match(text, /تقرير تاريخي/);
    await page.locator('[data-history="view"]').click();
    assert.match(await page.locator("#chartRoot").innerText(), /قراءة محفوظة من وقت سابق/);
    assert.equal(await page.locator("#chartRoot svg").count(), 0); assert.equal(await page.locator("#saveReportButton").isDisabled(), true);
  });
  await step("Logout clears private UI and another verified account cannot see the first history", async () => {
    await logout(page); await login(page, "beta");
    assert.equal(await page.locator("#historyCount").innerText(), "0");
    await nav(page, "history"); assert.equal(await page.locator(".aa-history-card").count(), 0);
    assert.doesNotMatch(await page.locator("#appShell").innerText(), /QA CSV Alpha/);
    await nav(page, "analysis"); await page.locator("#marketSelect").selectOption("BTC-USD");
    await importCsv(page, "QA CSV Beta — separate account"); await page.locator("#saveReportButton").click();
    assert.equal(await page.locator("#historyCount").innerText(), "1");
    const histories = await page.evaluate(({ alpha, beta }) => ({ alpha: JSON.parse(localStorage.getItem(`varex.analysis.reports.v1.${alpha}`)), beta: JSON.parse(localStorage.getItem(`varex.analysis.reports.v1.${beta}`)) }), { alpha: users.alpha.id, beta: users.beta.id });
    assert.equal(histories.alpha[0].source, csvSource); assert.equal(histories.beta[0].source, "QA CSV Beta — separate account");
    await logout(page); await login(page, "alpha"); await nav(page, "history");
    assert.match(await page.locator("#historyRoot").innerText(), /QA CSV Alpha/); assert.doesNotMatch(await page.locator("#historyRoot").innerText(), /QA CSV Beta/);
  });
  await step("Inactive or mismatched server profiles cannot expose the assistant", async () => {
    await logout(page); await login(page, "inactive", false);
    assert.equal(await page.locator("#chartRoot").innerText(), "");
    fixture.accessOverride = { id: users.beta.id };
    await login(page, "alpha", false);
    assert.equal(await page.locator("#chatMessages").innerText(), ""); fixture.accessOverride = null;
  });
  report.desktopRequests = fixture.requests; report.desktopCryptoRequests = fixture.crypto;
  await context.close(); activePage = null;
}

async function mobileSmoke() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "ar-AE", timezoneId: "UTC", serviceWorkers: "block", reducedMotion: "reduce" });
  const fixture = await installFixtures(context, "mobile"), page = await context.newPage(); activePage = page; page.setDefaultTimeout(10000);
  await step("Mobile signup and navigation are usable without horizontal overflow", async () => {
    await page.goto(baseUrl + entryPath, { waitUntil: "domcontentloaded" }); await hidden(page, "#loadingScreen"); await visible(page, "#registerPane");
    await noOverflow(page, "mobile signup"); await screenshot(page, "05-signup-mobile.png");
    await login(page, "alpha"); await noTradingSurface(page);
    await nav(page, "learn"); assert.equal(await page.locator(".aa-learn-card").count(), 6); await noOverflow(page, "mobile learn");
    await nav(page, "analysis"); await page.locator("#marketSelect").selectOption("BTC-USD");
    await importCsv(page); await ask(page, "اشرح لي الاتجاه");
    await noOverflow(page, "mobile analysis"); await screenshot(page, "06-analysis-mobile-dark.png");
  });
  await step("Mobile light theme, CSV dialog and saved report remain within viewport", async () => {
    await page.locator(".topbar [data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await noOverflow(page, "mobile light"); await screenshot(page, "07-analysis-mobile-light.png");
    await page.locator('#pageActions [data-action="import"]').click(); await visible(page, "#importDialog");
    const rect = await page.locator("#importDialog").boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 391 && rect.width > 300);
    await screenshot(page, "08-import-mobile.png"); await page.locator('#importDialog [data-close-dialog]').first().click();
    await page.locator("#saveReportButton").click(); await nav(page, "history"); await noOverflow(page, "mobile history");
    assert.equal(await page.locator(".aa-history-card").count(), 1);
    await logout(page); await hidden(page, "#appShell");
  });
  report.mobileRequests = fixture.requests;
  await context.close(); activePage = null;
}

async function goldDiagnostic() {
  if (process.env.ANALYSIS_GOLD_DIAGNOSTIC !== "1") return;
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    // Only this blank document is fulfilled locally. Its production origin gives
    // the subsequent anonymous HTTPS fetch real production-origin CORS semantics;
    // no production app or authenticated session is opened by this diagnostic.
    const diagnosticPage = "https://app.varexapp.com/__analysis_gold_diagnostic__";
    await page.route(diagnosticPage, (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Anonymous gold data diagnostic</title><link rel="icon" href="data:,">' }));
    await page.goto(diagnosticPage);
    report.goldDiagnostic = await page.evaluate(async () => {
      const observedAt = new Date().toISOString(), today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const since = new Date(today.getTime() - 29 * 86400000);
      const query = new URLSearchParams({ symbol: "XAU-USD-SPOT", interval: "1d", from: since.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10), limit: "30" });
      const url = "https://api.goldprice.dev/v1/bars?" + query;
      try {
        const response = await fetch(url, { method: "GET", mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18000) });
        const payload = await response.json(), bars = Array.isArray(payload?.bars) ? payload.bars : [];
        const validTimestamp = (value) => typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
        const validOhlc = (bar) => {
          const values = [bar.open, bar.high, bar.low, bar.close].map(Number);
          return values.every((value) => Number.isFinite(value) && value > 0) && values[2] <= Math.min(values[0], values[3]) && values[1] >= Math.max(values[0], values[3]) && values[2] <= values[1];
        };
        const validShape = payload?.symbol === "XAU-USD-SPOT" && payload?.interval === "1d" && bars.length > 0 && bars.length <= 30
          && bars.every((bar) => bar && typeof bar.is_closed === "boolean" && validTimestamp(bar.bar_start) && validOhlc(bar));
        const closed = bars.filter((bar) => bar.is_closed === true && validTimestamp(bar.bar_start) && Date.parse(bar.bar_start) + 86400000 <= Date.now()).sort((a, b) => Date.parse(a.bar_start) - Date.parse(b.bar_start));
        const last = closed.at(-1), asOf = last ? new Date(Date.parse(last.bar_start) + 86400000).toISOString() : null;
        return { status: response.ok && validShape && closed.length > 0 ? "readable" : "unusable", url, origin: location.origin, observedAt, httpStatus: response.status, responseType: response.type, corsReadable: true,
          validShape, symbol: payload?.symbol || null, interval: payload?.interval || null, count: bars.length, closedCount: closed.length,
          allClosureFlagsPresent: bars.length > 0 && bars.every((bar) => typeof bar.is_closed === "boolean"), lastBarStart: last?.bar_start || null, asOf,
          ageSeconds: asOf ? Math.max(0, Math.floor((Date.now() - Date.parse(asOf)) / 1000)) : null,
          isStale: payload?.is_stale === true || payload?.meta?.is_stale === true, topLevelKeys: Object.keys(payload || {}).slice(0, 20),
          sourceId: typeof payload?.meta?.source_id === "string" ? payload.meta.source_id : null,
          caveat: "Anonymous fetch from a locally fulfilled blank document using the production origin. This proves browser readability only at this observation; it does not prove licensing, redistributability, or sufficient history and never enables the fallback." };
      } catch (error) { return { status: "unavailable", url, origin: location.origin, observedAt, corsReadable: false, error: String(error.message || error), caveat: "A failed browser fetch can be network/CORS/provider policy; no fallback was enabled." }; }
    });
  } catch (error) { report.goldDiagnostic = { status: "unavailable", error: String(error.message || error) }; }
  finally { await context.close(); }
}

(async () => {
  await fsp.mkdir(artifactDir, { recursive: true });
  try {
    await startServer();
    const { chromium } = playwrightModule(); browser = await chromium.launch({ headless: true });
    await desktopSmoke(); await mobileSmoke();
    await step("No browser exceptions, unmocked network, or legacy bootstrap/trading requests", async () => {
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedRequests, []);
      for (const item of [...report.desktopRequests, ...report.mobileRequests].filter((item) => item.path.endsWith("/varex-trading-api"))) assert.equal(item.action, "access");
    });
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.error = error.stack || String(error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) { try { await screenshot(activePage, "failure.png"); } catch {} }
    console.error(report.error);
  } finally {
    if (browser) { await goldDiagnostic(); await browser.close(); }
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    report.finishedAt = new Date().toISOString();
    await fsp.writeFile(path.join(artifactDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ status: report.status, passed: report.steps.filter((item) => item.status === "passed").length, total: report.steps.length, artifacts: artifactDir, goldDiagnostic: report.goldDiagnostic }));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
