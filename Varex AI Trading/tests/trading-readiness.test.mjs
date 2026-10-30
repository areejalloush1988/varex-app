import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const client = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8");
const apiSource = client.slice(client.indexOf("  function isRecord("), client.indexOf("  function authRequest("));
const enterSource = client.slice(client.indexOf("  async function enterApp("), client.indexOf("  function applyIdentity("));
const entrySource = client.slice(client.indexOf("  function readEntryDestination("), client.indexOf("  function renderAuthChoices("));
const applyEntrySource = client.slice(client.indexOf("  function applyEntryDestination("), client.indexOf("  function directionLabel("));
const handlerSource = access.slice(access.indexOf("export async function tradingRequest("))
  .replace("export async function tradingRequest(request: Request)", "async function tradingRequest(request)");

function apiWith(fetchMock) {
  return new Function("fetch", `${apiSource}\nreturn { request, validateBootstrap };`)(fetchMock);
}

function validBootstrap() {
  return {
    profile: { id: "test-user", displayName: "Test Account", role: "trader", canManageUsers: false, canTrade: true, canConnectBroker: true },
    version: 1,
    state: {
      balanceCents: 2500000, selectedSymbol: "BTC-USD", watchlist: ["BTC-USD"], trades: [], analyses: [],
      risk: { maxDailyLossPct: 5, maxOpenTrades: 3, riskPerTradePct: 1, autoStop: true, newsPause: true },
      settings: { notifications: true, timezone: "Asia/Dubai", compactMode: false },
    },
    broker: { connected: false, liveTradingEnabled: false, balances: [], orders: [] },
    supportedMarkets: [{ symbol: "BTC-USD", label: "BTC / USD" }],
  };
}

test("rejects successful HTML fallbacks without exposing their content", async () => {
  const api = apiWith(async () => new Response("<html>private hosting diagnostic</html>", { headers: { "content-type": "text/html" } }));
  await assert.rejects(api.request("/api/auth/sign-in/email"), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /خدمة التطبيق غير متاحة/);
    assert.doesNotMatch(error.message, /private hosting diagnostic/);
    return true;
  });
});

test("rejects malformed JSON and non-object successful API payloads", async () => {
  for (const body of ["{invalid", '"unexpected page"', "[]", "null"]) {
    const api = apiWith(async () => new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } }));
    await assert.rejects(api.request("/api/trading"), (error) => error.status === 502);
  }
});

test("retains the legitimate logged-out session response and successful JSON objects", async () => {
  const sessionApi = apiWith(async () => Response.json(null));
  assert.equal(await sessionApi.request("/api/auth/get-session"), null);
  let observedOptions;
  const api = apiWith(async (_path, options) => {
    observedOptions = options;
    return Response.json({ saved: true });
  });
  assert.deepEqual(await api.request("/api/trading", { method: "POST", body: "{}" }), { saved: true });
  assert.equal(observedOptions.credentials, "include");
  assert.equal(observedOptions.headers["Content-Type"], "application/json");
});

test("preserves structured API errors, status and execution uncertainty", async () => {
  const payload = { error: "تعذر تأكيد التنفيذ", executionUncertain: true };
  const api = apiWith(async () => new Response(JSON.stringify(payload), { status: 409, headers: { "content-type": "application/problem+json" } }));
  await assert.rejects(api.request("/api/trading"), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.message, payload.error);
    assert.deepEqual(error.payload, payload);
    return true;
  });
  const unauthorizedApi = apiWith(async () => new Response("Unauthorized", { status: 401, headers: { "content-type": "text/plain" } }));
  await assert.rejects(unauthorizedApi.request("/api/trading"), (error) => error.status === 401);
});

test("validates essential account data while retaining the existing bootstrap protocol", () => {
  const { validateBootstrap } = apiWith(() => assert.fail("No network calls expected"));
  assert.doesNotThrow(() => validateBootstrap(validBootstrap()));
  for (const patch of [
    { profile: null },
    { state: {} },
    { version: 0 },
    { state: { ...validBootstrap().state, risk: null } },
    { state: { ...validBootstrap().state, trades: [null] } },
    { supportedMarkets: {} },
  ]) {
    assert.throws(() => validateBootstrap({ ...validBootstrap(), ...patch }), (error) => error.status === 502 && /بيانات الحساب/.test(error.message));
  }
  assert.throws(() => validateBootstrap(null), (error) => error.status === 502);
});

function workspaceFor(bootstrap) {
  const events = [], app = { profile: null, state: null };
  const $ = (selector) => ({ classList: {
    add: (name) => events.push([selector, "add", name]),
    remove: (name) => events.push([selector, "remove", name]),
  } });
  const { validateBootstrap } = apiWith(() => assert.fail("No network calls expected"));
  const enterApp = new Function("$", "app", "request", "validateBootstrap", "applyIdentity", "loadMarkets", "render", "showLoggedOut", "window", `let entryDestination = null;\n${entrySource}\n${applyEntrySource}\n${enterSource}\nreturn enterApp;`)(
    $, app, async () => bootstrap, validateBootstrap,
    () => events.push(["identity"]), async () => events.push(["markets"]),
    () => events.push(["render"]), (message) => events.push(["logged-out", message]), { location: { search: "" } },
  );
  return { enterApp, events, app };
}

test("does not reveal the workspace or mutate account state for incomplete bootstrap data", async () => {
  const workspace = workspaceFor({});
  await workspace.enterApp();
  assert.equal(workspace.app.profile, null);
  assert.equal(workspace.app.state, null);
  assert.equal(workspace.events.some(([target, action]) => target === "#appShell" && action === "remove"), false);
  assert.equal(workspace.events.some(([target]) => target === "markets" || target === "render"), false);
  assert.match(workspace.events.find(([target]) => target === "logged-out")[1], /بيانات الحساب/);
});

test("allows a complete bootstrap to enter the existing workspace", async () => {
  const bootstrap = validBootstrap(), workspace = workspaceFor(bootstrap);
  await workspace.enterApp();
  assert.equal(workspace.app.profile, bootstrap.profile);
  assert.equal(workspace.app.state, bootstrap.state);
  assert.equal(workspace.events.some(([target, action]) => target === "#appShell" && action === "remove"), true);
  assert.equal(workspace.events.some(([target]) => target === "render"), true);
  assert.equal(workspace.app.executionMode, "paper");
});

test("catches asynchronously rejected POST operations and returns structured errors", async () => {
  class TradingAccessError extends Error { constructor(status, message) { super(message); this.status = status; } }
  class TradingBrokerError extends Error { constructor(status, message, uncertain) { super(message); this.status = status; this.uncertain = uncertain; } }
  class TradingMarketError extends Error {}
  const cases = [
    [new TradingAccessError(409, "حد التداول الورقي"), 409, { error: "حد التداول الورقي" }],
    [new TradingBrokerError(502, "تعذر تأكيد التنفيذ", true), 502, { error: "تعذر تأكيد التنفيذ", executionUncertain: true }],
    [new TradingMarketError("السوق غير متاح"), 502, { error: "السوق غير متاح", marketUnavailable: true }],
  ];
  for (const [failure, status, payload] of cases) {
    const handler = new Function("handlePost", "bodyOf", "TradingAccessError", "TradingBrokerError", "TradingMarketError", "json", `${handlerSource}\nreturn tradingRequest;`)(
      async () => { throw failure; }, async () => ({ action: "open_trade" }),
      TradingAccessError, TradingBrokerError, TradingMarketError,
      (body, responseStatus = 200) => Response.json(body, { status: responseStatus }),
    );
    const response = await handler({ method: "POST" });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), payload);
  }
});
