import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import test from "node:test";

const client = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const workspaceModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(new URL("../market-workspace.js", import.meta.url), "utf8"), { module: workspaceModule });
const testClient = client.replace(/  init\(\);\s*\}\)\(\);\s*$/, `  globalThis.controls = {
    app, rememberFormField, handleFormChange, handleActionClick, handleSubmit,
    render, tradeTicket, renderUsers, localDate, resolveConfirm, logout, accountMetrics,
    request, loadMarkets, scheduleMarketRefresh, bindShell, bindAuth, openResearchTrade,
    pendingAuth: () => ({ ...pendingAuth })
  };
})();`);
assert.notEqual(testClient, client, "Expose the actual client functions without starting authentication or networking.");

function element() {
  const classes = new Set(), listeners = new Map();
  return {
    innerHTML: "", textContent: "", className: "", disabled: false, dataset: {}, listeners,
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
      contains: (value) => classes.has(value),
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
}

function form(id, values = {}) {
  const submit = element();
  return { id, values, submit, querySelector: () => submit, reset() { this.values = {}; } };
}

function fieldEvent(targetForm, name, value) {
  targetForm.values[name] = value;
  return { target: { name, value, closest: (selector) => selector === "form" ? targetForm : null, matches: () => false } };
}

function buttonEvent(selector, dataset, row = null) {
  const button = {
    ...element(), dataset,
    closest: (candidate) => candidate === selector ? button : candidate === "[data-user-row]" ? row : null,
  };
  return { target: button };
}

function submitEvent(targetForm) {
  return { target: targetForm, preventDefault() {} };
}

function harness(respond = () => { throw new Error("Unexpected API request in a local control test"); }, fixedNow = null) {
  const elements = new Map(), calls = [], timers = new Map(), listeners = new Map();
  let nextTimer = 0;
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const document = {
    querySelector: getElement,
    querySelectorAll: (selector) => selector === ".auth-pane"
      ? ["loginForm", "registerPane", "recoverPane", "otpPane", "resetPane"].map((id) => Object.assign(getElement(`#${id}`), { id }))
      : [],
    documentElement: element(),
    visibilityState: "visible",
    addEventListener: (name, listener) => listeners.set(name, listener),
    createElement: () => ({ ...element(), click() {} }),
  };
  const fetchMock = async (path, options) => {
    const call = { path, options, body: options.body ? JSON.parse(options.body) : undefined };
    calls.push(call);
    return respond(call);
  };
  const window = { scrollTo() {}, fetch: fetchMock };
  const ClockDate = fixedNow === null ? Date : class extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return new Date(fixedNow).getTime(); }
  };
  const context = vm.createContext({
    document, window, Intl, Date: ClockDate, URL, Blob, Response,
    crypto: { randomUUID },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    FormData: class {
      constructor(targetForm) { this.values = { ...targetForm.values }; }
      get(name) { return this.values[name] ?? null; }
      getAll(name) { const value = this.get(name); return Array.isArray(value) ? value : value == null ? [] : [value]; }
    },
    fetch: fetchMock,
  });
  vm.runInContext(testClient, context);
  const controls = context.controls;
  Object.assign(controls.app, {
    profile: { id: "user-1", email: "member@example.test", displayName: "Test Member", role: "developer", canTrade: true, canConnectBroker: true, canManageUsers: true },
    state: {
      balanceCents: 2500000, selectedSymbol: "BTC-USD", watchlist: ["BTC-USD", "ETH-USD"], trades: [], analyses: [],
      risk: { maxDailyLossPct: 5, maxOpenTrades: 3, riskPerTradePct: 1, autoStop: true, newsPause: true },
      settings: { notifications: true, timezone: "Asia/Dubai", compactMode: false },
    },
    version: 1,
    broker: { connected: false, liveTradingEnabled: false, maxLiveOrderUsd: 100, availableUsdt: 1000, balances: [], orders: [] },
    markets: markets(), supportedMarkets: markets(), selectedMarket: markets()[0],
  });
  return {
    ...controls, calls, getElement, document, window, timers,
    html: () => getElement("#viewRoot").innerHTML,
    documentClick: (event) => listeners.get("click")?.(event),
    visibility: (value) => { document.visibilityState = value; listeners.get("visibilitychange")?.(); },
    refreshTimers: () => [...timers.values()].filter((timer) => timer.delay === 30000),
    tickRefresh: async () => {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === 30000);
      assert.ok(entry, "A 30-second refresh should be scheduled.");
      timers.delete(entry[0]);
      await entry[1].callback();
    },
  };
}

function markets() {
  return [
    { symbol: "BTC-USD", label: "BTC / USD", name: "Bitcoin", price: 64000, changePct: 1, candles: [] },
    { symbol: "ETH-USD", label: "ETH / USD", name: "Ethereum", price: 3400, changePct: 2, candles: [] },
    { symbol: "SOL-USD", label: "SOL / USD", name: "Solana", price: 150, changePct: -1, candles: [] },
  ];
}

function inputValue(html, name) {
  return html.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`))?.[1];
}

test("trade direction, execution mode and rerenders preserve each mode's amount and selected market", async () => {
  const h = harness(), ticket = form("tradeForm");
  h.app.broker.connected = true;
  h.app.broker.liveTradingEnabled = true;
  h.rememberFormField(fieldEvent(ticket, "symbol", "ETH-USD"));
  h.rememberFormField(fieldEvent(ticket, "amount", "1275"));
  await h.handleActionClick(buttonEvent("[data-side]", { side: "sell" }));
  assert.equal(inputValue(h.html(), "amount"), "1275");
  assert.match(h.html(), /value="ETH-USD" selected/);
  assert.equal(h.app.state.selectedSymbol, "BTC-USD", "An unsaved ticket is not persisted account state.");

  await h.handleActionClick(buttonEvent("[data-execution-mode]", { executionMode: "live" }));
  assert.equal(inputValue(h.html(), "amount"), "100");
  h.rememberFormField(fieldEvent(ticket, "amount", "75"));
  await h.handleActionClick(buttonEvent("[data-execution-mode]", { executionMode: "paper" }));
  assert.equal(inputValue(h.html(), "amount"), "1275");
  await h.handleActionClick(buttonEvent("[data-execution-mode]", { executionMode: "live" }));
  assert.equal(inputValue(h.html(), "amount"), "75");
  assert.equal(h.calls.length, 0);
});

test("changing the ticket market refreshes the displayed price for that exact symbol", async () => {
  const h = harness(() => Response.json({ selected: "ETH-USD", markets: markets() }));
  await h.handleFormChange(fieldEvent(form("tradeForm"), "symbol", "ETH-USD"));
  assert.equal(h.calls[0].path, "/api/trading?action=markets&symbol=ETH-USD");
  assert.match(h.tradeTicket(), /السعر المعروض<\/span><b>\$3,400\.00<\/b>/);
  assert.match(h.tradeTicket(), /value="ETH-USD" selected/);
});

test("market requests never overlap and an earlier response cannot overwrite the latest selection", async () => {
  const replies = [], h = harness(() => new Promise((resolve) => replies.push(resolve)));
  const first = h.handleFormChange(fieldEvent(form("tradeForm"), "symbol", "ETH-USD"));
  const superseded = h.handleFormChange(fieldEvent(form("tradeForm"), "symbol", "BTC-USD"));
  const second = h.handleFormChange(fieldEvent(form("tradeForm"), "symbol", "SOL-USD"));
  assert.equal(replies.length, 1, "The next quote waits for the in-flight request.");
  replies[0](Response.json({ selected: "ETH-USD", markets: markets() }));
  await first;
  await superseded;
  assert.equal(replies.length, 2, "The superseded intermediate symbol is not requested.");
  assert.match(h.calls[1].path, /symbol=SOL-USD$/);
  replies[1](Response.json({ selected: "SOL-USD", markets: markets() }));
  await second;
  assert.equal(h.app.selectedMarket.symbol, "SOL-USD");
  assert.match(h.tradeTicket(), /السعر المعروض<\/span><b>\$150\.00<\/b>/);
});

test("using an analysis explicitly prepares its symbol and side in paper mode without submitting an order", async () => {
  const h = harness();
  h.app.broker.connected = true;
  h.app.broker.liveTradingEnabled = true;
  h.app.executionMode = "live";
  await h.handleActionClick(buttonEvent("[data-use-analysis]", { useAnalysis: "ETH-USD", side: "sell" }));
  assert.equal(h.app.executionMode, "paper");
  assert.equal(h.app.tradeSide, "sell");
  assert.equal(h.app.view, "trades");
  assert.match(h.html(), /value="ETH-USD" selected/);
  assert.match(h.html(), /فتح صفقة بيع ورقية/);
  assert.equal(h.calls.length, 0);
});

test("research order preparation rejects unsupported symbols, aliases, viewers and unavailable execution instruments", async () => {
  const h = harness();
  h.window.VarexMarketWorkspace = workspaceModule.exports;
  for (const symbol of ["XAUUSD", "EURUSD", "UNKNOWN", "BTC-USDT", "COINBASE:BTCUSD"]) await h.openResearchTrade(symbol);
  h.app.profile.canTrade = false;
  await h.openResearchTrade("BTC-USD");
  h.app.profile.canTrade = true;
  h.app.supportedMarkets = h.app.supportedMarkets.filter((market) => market.symbol !== "BTC-USD");
  await h.openResearchTrade("BTC-USD");
  assert.equal(h.calls.length, 0);
  assert.equal(Object.keys(h.app.formDrafts).length, 0);
  assert.equal(h.app.state.selectedSymbol, "BTC-USD");
  assert.equal(h.app.view, "dashboard");
});

test("research order preparation forces paper mode and fetches only the explicitly selected supported market", async () => {
  const h = harness(() => Response.json({ selected: "ETH-USD", markets: markets() }));
  h.window.VarexMarketWorkspace = workspaceModule.exports;
  h.app.broker.connected = true; h.app.broker.liveTradingEnabled = true; h.app.executionMode = "live";
  h.app.formDrafts.tradeForm = { symbol: "BTC-USD", paperAmount: "1275", liveAmount: "75" };
  const stateBefore = JSON.stringify(h.app.state);
  await h.openResearchTrade("ETH-USD");
  assert.equal(h.app.executionMode, "paper");
  assert.equal(h.app.view, "trades");
  assert.equal(h.app.formDrafts.tradeForm.symbol, "ETH-USD");
  assert.equal(h.app.formDrafts.tradeForm.paperAmount, "1275");
  assert.equal(h.app.formDrafts.tradeForm.liveAmount, "75");
  assert.equal(JSON.stringify(h.app.state), stateBefore);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, "/api/trading?action=markets&symbol=ETH-USD");
  assert.equal(h.calls[0].body, undefined);
  assert.notEqual(h.calls[0].options.method, "POST");
});

test("research selection stays local, ordinary quote polling preserves the mounted workspace, and logout destroys it", async () => {
  const h = harness(({ path }) => path === "/api/auth/sign-out" ? Response.json({ success: true }) : Response.json({ selected: "BTC-USD", markets: markets() }));
  let mounted = 0, destroyed = 0, callbacks;
  h.window.VarexMarketWorkspace = {
    getMarket: workspaceModule.exports.getMarket,
    mount(_target, options) { mounted += 1; callbacks = options; return { destroy() { destroyed += 1; } }; },
  };
  h.app.view = "markets"; h.render();
  callbacks.onSelect({ id: "XAUUSD", interval: "240" });
  assert.equal(h.app.exploreSymbol, "XAUUSD");
  assert.equal(h.app.exploreInterval, "240");
  assert.equal(h.app.state.selectedSymbol, "BTC-USD");
  assert.equal(h.calls.length, 0);
  await h.loadMarkets("BTC-USD", true); await h.tickRefresh();
  assert.equal(mounted, 1); assert.equal(destroyed, 0);
  h.app.view = "intelligence"; h.render();
  assert.equal(mounted, 2); assert.equal(destroyed, 1);
  assert.equal(callbacks.initialSymbol, "XAUUSD");
  assert.equal(callbacks.interval, "240");
  await h.tickRefresh();
  assert.equal(mounted, 2); assert.equal(destroyed, 1);
  await h.logout();
  assert.equal(destroyed, 2);
  assert.equal(h.app.profile, null);
});

test("risk toggles preserve numeric edits and failed saves do not pretend to change persisted rules", async () => {
  let fail = true;
  const h = harness(({ body }) => fail
    ? Response.json({ error: "Save unavailable" }, { status: 503 })
    : Response.json({ state: { ...h.app.state, risk: body.risk }, version: 2 }));
  h.app.view = "risk";
  const riskForm = form("riskForm", { maxDailyLossPct: "2.5", maxOpenTrades: "7", riskPerTradePct: "0.75" });
  for (const [name, value] of Object.entries(riskForm.values)) h.rememberFormField(fieldEvent(riskForm, name, value));
  await h.handleActionClick(buttonEvent("[data-toggle-risk]", { toggleRisk: "autoStop" }));
  assert.equal(inputValue(h.html(), "maxDailyLossPct"), "2.5");
  assert.equal(inputValue(h.html(), "maxOpenTrades"), "7");
  assert.equal(h.app.state.risk.autoStop, true);
  await h.handleSubmit(submitEvent(riskForm));
  assert.equal(h.app.state.risk.autoStop, true);
  assert.equal(h.app.formDrafts.riskForm.autoStop, false);
  fail = false;
  await h.handleSubmit(submitEvent(riskForm));
  assert.equal(h.app.state.risk.autoStop, false);
  assert.equal(h.app.state.risk.maxDailyLossPct, 2.5);
  assert.equal(h.app.formDrafts.riskForm, undefined);
});

test("settings toggles preserve timezone and unsaved profile edits; saved timezone affects displayed timestamps", async () => {
  const h = harness(({ body }) => Response.json({ state: { ...h.app.state, settings: body.settings }, version: 2 }));
  h.app.view = "settings";
  const settingsForm = form("settingsForm", { timezone: "UTC" });
  h.rememberFormField(fieldEvent(settingsForm, "timezone", "UTC"));
  h.rememberFormField(fieldEvent(form("profileForm"), "displayName", "Unsaved Name"));
  await h.handleActionClick(buttonEvent("[data-toggle-setting]", { toggleSetting: "compactMode" }));
  assert.match(h.html(), /value="UTC" selected/);
  assert.equal(inputValue(h.html(), "displayName"), "Unsaved Name");
  assert.equal(h.app.state.settings.compactMode, false);
  await h.handleSubmit(submitEvent(settingsForm));
  assert.equal(h.app.state.settings.compactMode, true);
  assert.equal(h.app.state.settings.timezone, "UTC");
  assert.equal(inputValue(h.html(), "displayName"), "Unsaved Name");
  assert.equal(h.app.profile.displayName, "Test Member");
  const instant = "2026-01-01T22:30:00Z";
  assert.equal(h.localDate(instant, true), new Date(instant).toLocaleString("ar-AE", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }));
});

for (const status of ["active", "inactive", "revoked"]) {
  test(`saving a user's role preserves their ${status} activation state`, async () => {
    const user = { email: "viewer@example.test", displayName: "Viewer", role: "trader", status, pending: status === "revoked" };
    const h = harness(({ body }) => Response.json({ users: [{ ...user, role: body.role, status: body.status }] }));
    h.app.users = [user];
    h.app.view = "users";
    const row = { querySelector: () => ({ value: "viewer" }) };
    await h.handleActionClick(buttonEvent("[data-user-save]", { userSave: user.email }, row));
    assert.equal(h.calls[0].body.action, "update_user");
    assert.equal(h.calls[0].body.role, "viewer");
    assert.equal(h.calls[0].body.status, status === "active" ? "active" : "inactive");
  });
}

test("activation changes do not also save an unsubmitted role selection", async () => {
  const user = { email: "member@example.test", displayName: "Member", role: "trader", status: "active" };
  const h = harness(({ body }) => Response.json({ users: [{ ...user, status: body.status }] }));
  h.app.users = [user];
  h.app.userRoleDrafts[user.email] = "viewer";
  await h.handleActionClick(buttonEvent("[data-user-toggle]", { userToggle: user.email, status: "inactive" }));
  assert.equal(h.calls[0].body.role, "trader");
  assert.equal(h.calls[0].body.status, "inactive");
  assert.equal(h.app.userRoleDrafts[user.email], "viewer");
});

test("a revoked invitation renders an activation action instead of looking pending", () => {
  const h = harness();
  h.app.users = [{ email: "revoked@example.test", displayName: "Revoked", role: "viewer", status: "revoked", pending: true }];
  assert.match(h.renderUsers(), /data-user-toggle="revoked@example\.test" data-status="active">تفعيل/);
});

test("live orders still require confirmation, cannot double-submit, and use the reviewed direction", async () => {
  const h = harness(() => Response.json({ broker: h.app.broker }));
  h.app.broker.connected = true;
  h.app.broker.liveTradingEnabled = true;
  h.app.executionMode = "live";
  const ticket = form("tradeForm", { symbol: "ETH-USD", amount: "75" });
  const first = h.handleSubmit(submitEvent(ticket));
  assert.equal(h.calls.length, 0, "Opening confirmation must not send an order.");
  assert.match(h.getElement("#confirmText").textContent, /ETH-USD/);
  await h.handleSubmit(submitEvent(ticket));
  assert.equal(h.calls.length, 0);
  h.app.tradeSide = "sell";
  h.resolveConfirm(true);
  await first;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].body.action, "place_live_order");
  assert.equal(h.calls[0].body.side, "buy", "The direction cannot change after it was shown for confirmation.");
  assert.equal(h.calls[0].body.symbol, "ETH-USD");
  assert.equal(h.calls[0].body.amount, 75);
  assert.equal(h.calls[0].body.confirmation, "LIVE_ORDER_CONFIRMED");
  assert.match(h.calls[0].body.clientRequestId, /^[0-9a-f-]{36}$/);
});

test("cancelling the live confirmation sends no request", async () => {
  const h = harness();
  h.app.executionMode = "live";
  const pending = h.handleSubmit(submitEvent(form("tradeForm", { symbol: "BTC-USD", amount: "100" })));
  h.resolveConfirm(false);
  await pending;
  assert.equal(h.calls.length, 0);
});

test("draft storage excludes broker credentials", () => {
  const h = harness(), connection = form("brokerConnectForm");
  h.rememberFormField(fieldEvent(connection, "apiKey", "test-key-not-a-real-credential"));
  h.rememberFormField(fieldEvent(connection, "apiSecret", "test-secret-not-a-real-credential"));
  assert.equal(Object.keys(h.app.formDrafts).length, 0);
});

test("the paper ticket maximum tracks the actual account balance", () => {
  const h = harness();
  h.app.state.balanceCents = 20000;
  const ticket = h.tradeTicket();
  assert.match(ticket, /name="amount"[^>]*max="50"/);
  assert.equal(inputValue(ticket, "amount"), "50");
});

test("failed sign-out remains visible as an error; successful sign-out clears account drafts", async () => {
  let fail = true;
  const h = harness(() => fail ? Response.json({ error: "Sign-out unavailable" }, { status: 503 }) : Response.json({ success: true }));
  h.app.formDrafts.tradeForm = { symbol: "ETH-USD", paperAmount: "1250" };
  await h.logout();
  assert.notEqual(h.app.profile, null);
  assert.match(h.getElement("#toast").textContent, /Sign-out unavailable/);
  fail = false;
  await h.logout();
  assert.equal(h.app.profile, null);
  assert.equal(h.app.state, null);
  assert.equal(h.app.view, "dashboard");
  assert.equal(Object.keys(h.app.formDrafts).length, 0);
  assert.equal(h.app.markets.length, 0);
});

test("automatic market refresh runs at 30 seconds only while signed in and visible", async () => {
  const h = harness(({ path }) => path === "/api/auth/sign-out"
    ? Response.json({ success: true })
    : Response.json({ selected: "BTC-USD", markets: markets() }));
  h.bindShell();
  await h.loadMarkets("BTC-USD", true);
  assert.equal(h.refreshTimers().length, 1);
  await h.tickRefresh();
  assert.equal(h.calls.length, 2);
  assert.equal(h.refreshTimers().length, 1, "Refreshes schedule one successor, not a stack of timers.");
  assert.ok(h.calls.every((call) => !call.body && call.path.startsWith("/api/trading?action=markets")));
  h.visibility("hidden");
  assert.equal(h.refreshTimers().length, 0);
  h.visibility("visible");
  assert.equal(h.refreshTimers().length, 1);
  await h.logout();
  assert.equal(h.refreshTimers().length, 0);
  h.visibility("visible");
  assert.equal(h.refreshTimers().length, 0, "Visibility cannot restart polling after sign-out.");
});

test("an expired session stops market polling and returns to the sign-in screen", async () => {
  const h = harness(() => Response.json({ error: "Session expired" }, { status: 401 }));
  await h.loadMarkets("BTC-USD", true);
  assert.equal(h.app.profile, null);
  assert.equal(h.refreshTimers().length, 0);
  assert.match(h.getElement("#authMessage").textContent, /انتهت جلسة الحساب/);
});

test("market refresh accepts validated paper settlement state without discarding the ticket draft", async () => {
  let settle = false;
  const h = harness(() => Response.json({
    selected: "BTC-USD", markets: markets(),
    ...(settle ? { state: { ...h.app.state, balanceCents: 2499500, trades: [{
      ...h.app.state.trades[0], status: "closed", pnl: -5, exitPrice: 63900, closedAt: "2026-01-01T10:00:00Z",
    }] }, version: 2 } : {}),
  }));
  h.app.view = "trades";
  h.app.state.trades = [{ id: "paper-1", symbol: "BTC-USD", side: "buy", amount: 1000, entryPrice: 64200, status: "open" }];
  h.rememberFormField(fieldEvent(form("tradeForm"), "amount", "1275"));
  await h.loadMarkets("BTC-USD", true);
  settle = true;
  await h.tickRefresh();
  assert.equal(h.app.version, 2);
  assert.equal(h.app.state.balanceCents, 2499500);
  assert.equal(h.app.state.trades[0].status, "closed");
  assert.equal(inputValue(h.html(), "amount"), "1275");
  assert.doesNotMatch(h.html(), /data-close-trade="paper-1"/);
  assert.ok(h.calls.every((call) => !call.body), "Polling never submits a live or paper order from the browser.");
});

test("malformed optional market state cannot replace a valid account", async () => {
  const h = harness(() => Response.json({ selected: "BTC-USD", markets: markets(), state: {}, version: 2 }));
  const original = h.app.state;
  await h.loadMarkets("BTC-USD", true);
  assert.equal(h.app.state, original);
  assert.equal(h.app.version, 1);
  assert.match(h.app.marketError, /بيانات الحساب/);
});

test("automatic updates retain unsaved watchlist selections and leave broker form DOM untouched", async () => {
  const h = harness(() => Response.json({ selected: "BTC-USD", markets: markets() }));
  h.app.view = "watchlist";
  h.rememberFormField(fieldEvent(form("watchlistForm"), "symbols", ["ETH-USD"]));
  await h.loadMarkets("BTC-USD", true);
  await h.tickRefresh();
  assert.match(h.html(), /name="symbols" value="ETH-USD" checked/);
  assert.doesNotMatch(h.html(), /name="symbols" value="BTC-USD" checked/);
  h.app.view = "broker";
  h.getElement("#viewRoot").innerHTML = "Existing broker form nodes with unsaved input";
  await h.tickRefresh();
  assert.equal(h.html(), "Existing broker form nodes with unsaved input");
});

test("the authorized fetch-compatible bridge takes precedence over native fetch", async () => {
  const h = harness();
  let captured;
  h.window.varexTradingRequest = async (path, init) => {
    captured = { path, init };
    return Response.json({ saved: true });
  };
  const result = await h.request("/api/trading", { method: "POST", body: JSON.stringify({ action: "save_preferences" }) });
  assert.equal(result.saved, true);
  assert.equal(captured.path, "/api/trading");
  assert.equal(captured.init.credentials, "include");
  assert.equal(captured.init.method, "POST");
  assert.equal(h.calls.length, 0);
});

test("unconfirmed sign-in opens OTP without sending another email until the user requests resend", async () => {
  const h = harness(({ path }) => path === "/api/auth/sign-in/email"
    ? Response.json({ code: "email_not_confirmed", emailVerificationRequired: true, error: "Confirm email" }, { status: 403 })
    : Response.json({ sent: true }));
  const login = Object.assign(h.getElement("#loginForm"), form("loginForm", { email: " Member@Example.Test ", password: "ExamplePassword!7", remember: "on" }));
  h.bindAuth();
  await login.listeners.get("submit")({ currentTarget: login, preventDefault() {} });
  assert.equal(h.calls.length, 1, "Sign-in must not trigger a second OTP automatically.");
  assert.equal(h.calls[0].path, "/api/auth/sign-in/email");
  assert.equal(h.getElement("#otpEmail").textContent, "member@example.test");
  assert.equal(h.getElement("#loginForm").classList.contains("hidden"), true);
  assert.equal(h.getElement("#otpPane").classList.contains("hidden"), false);
  assert.equal(h.pendingAuth().email, "member@example.test");
  assert.equal(h.pendingAuth().password, "ExamplePassword!7");
  assert.equal(h.pendingAuth().displayName, "");
  assert.match(h.getElement("#authMessage").textContent, /إرسال رمز جديد/);
  await h.getElement("#resendOtp").listeners.get("click")();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].path, "/api/trading-auth/send-otp");
  assert.equal(h.calls[1].body.purpose, "verify");
  assert.equal(h.calls[1].body.email, "member@example.test");
});

test("other forbidden sign-in failures remain errors and do not start an OTP flow", async () => {
  const h = harness(() => Response.json({ error: "Account unavailable", code: "account_disabled" }, { status: 403 }));
  const login = Object.assign(h.getElement("#loginForm"), form("loginForm", { email: "member@example.test", password: "ExamplePassword!7" }));
  h.bindAuth();
  await login.listeners.get("submit")({ currentTarget: login, preventDefault() {} });
  assert.equal(h.pendingAuth().email, "");
  assert.equal(h.getElement("#otpEmail").textContent, "");
  assert.match(h.getElement("#authMessage").textContent, /Account unavailable/);
  assert.equal(h.calls.length, 1);
});

test("duplicate registration clears new credentials and offers manual login or recovery without submitting either", async () => {
  const h = harness(({ path }) => path === "/api/auth/sign-in/email"
    ? Response.json({ code: "email_not_confirmed", emailVerificationRequired: true, error: "Confirm email" }, { status: 403 })
    : Response.json({ code: "signup_unavailable", error: "تعذر إكمال إنشاء الحساب. جرّب تسجيل الدخول أو استعادة كلمة المرور." }, { status: 409 }));
  const login = Object.assign(h.getElement("#loginForm"), form("loginForm", { email: "previous@example.test", password: "PreviousPassword!7" }));
  const registration = Object.assign(h.getElement("#registerPane"), form("registerPane", {
    email: " Member@Example.Test ", displayName: "Test Member", password: "FreshSignupPassword!9", confirmPassword: "FreshSignupPassword!9",
  }));
  const password = h.getElement('#registerPane [name="password"]');
  const confirmation = h.getElement('#registerPane [name="confirmPassword"]');
  password.value = confirmation.value = "FreshSignupPassword!9";
  h.getElement("#loginForm [name=password]").value = "PreviousPassword!7";
  h.bindAuth();
  await login.listeners.get("submit")({ currentTarget: login, preventDefault() {} });
  assert.equal(h.pendingAuth().password, "PreviousPassword!7", "The failed signup must also discard any older pending verification credentials.");

  await registration.listeners.get("submit")({ currentTarget: registration, preventDefault() {} });
  assert.equal(h.getElement("#loginForm [name=email]").value, "member@example.test");
  assert.equal(h.getElement("#recoverPane [name=email]").value, "member@example.test");
  assert.equal(h.getElement("#loginForm [name=password]").value, "");
  assert.equal(password.value, "");
  assert.equal(confirmation.value, "");
  assert.ok(Object.values(h.pendingAuth()).every((value) => value === ""));
  assert.match(h.getElement("#authMessage").textContent, /إذا كان لديك حساب VAREX/);
  assert.equal(h.getElement("#existingAccountActions").classList.contains("hidden"), false);
  assert.deepEqual(h.calls.map((call) => call.path), [
    "/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/trading-auth/send-otp",
  ]);
  assert.equal(h.calls[2].body.purpose, "verify", "The existing failed-signup propagation is not a recovery email request.");

  h.documentClick(buttonEvent("[data-auth-pane]", { authPane: "recoverPane" }));
  assert.equal(h.getElement("#recoverPane").classList.contains("hidden"), false);
  assert.equal(h.getElement("#existingAccountActions").classList.contains("hidden"), true);
  assert.equal(h.getElement("#authMessage").textContent, "");
  assert.equal(h.calls.length, 3, "Opening recovery must not automatically send an email or sign in.");
});

test("daily paper PnL and risk use the server's UTC boundary even when the browser is on the previous local day", () => {
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    const h = harness(undefined, "2026-01-02T01:30:00Z");
    h.app.state.trades = [
      { status: "closed", pnl: -50, closedAt: "2026-01-01T23:30:00Z" },
      { status: "closed", pnl: -10, closedAt: "2026-01-02T00:15:00Z" },
    ];
    assert.equal(h.accountMetrics().todayPnl, -10);
    h.app.view = "risk";
    h.render();
    assert.match(h.html(), /حد الخسارة اليومي \(UTC\)/);
    assert.match(h.html(), /منذ 00:00 UTC/);
    assert.match(h.html(), /0\.04%/);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
