import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const edgeDirectory = resolve(repo, "supabase/functions/varex-trading-api");
const edgeUrl = pathToFileURL(edgeDirectory).href + "/";
const legacyMarketSource = readFileSync(resolve(repo, "Varex AI Trading/backend/lib/trading-market.ts"), "utf8");
const legacyMarket = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(legacyMarketSource, { mode: "transform" }))}`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@supabase/supabase-js") {
      return { url: "data:text/javascript,export function createClient(){throw new Error('Offline tests require a mock client')}", shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(edgeUrl) && url.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform", sourceUrl: url }), shortCircuit: true };
    }
    return next(url, context);
  },
});
let createTradingHandler, edgeMarket;
try {
  ({ createTradingHandler } = await import(pathToFileURL(resolve(edgeDirectory, "index.ts"))));
  edgeMarket = await import(pathToFileURL(resolve(edgeDirectory, "trading-market.ts")));
} finally { hooks.deregister(); }

const unsupported = ["EURUSD", "XAUUSD", "AAPL", "BTC-USDT", "", "   ", "__proto__", 0, false, [], {}, ["BTC-USD"]];
const rejected = (error) => error.status === 400 && error.code === "unsupported_symbol";

for (const [name, market] of [["legacy", legacyMarket], ["Edge", edgeMarket]]) {
  test(`${name}: only omitted optional selections default; explicit unknown instruments fail before provider I/O`, async (t) => {
    let requests = 0;
    t.mock.method(globalThis, "fetch", async () => { requests += 1; throw new Error("Unexpected provider request in offline validation test"); });
    for (const value of [undefined, null]) {
      assert.equal(market.normalizeTradingSymbol(value), "BTC-USD");
      assert.throws(() => market.normalizeTradingSymbol(value, false), rejected);
    }
    for (const symbol of ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"]) {
      assert.equal(market.normalizeTradingSymbol(` ${symbol.toLowerCase()} `), symbol);
    }
    for (const value of unsupported) {
      assert.throws(() => market.normalizeTradingSymbol(value), rejected);
      await assert.rejects(market.getMarketSnapshot(value), rejected);
      await assert.rejects(market.getMarketBoard(value), rejected);
    }
    assert.equal(requests, 0, "An invalid instrument must never fetch BTC or another provider market.");
  });

  test(`${name}: genuine provider failures retain market-unavailable semantics`, async (t) => {
    let requests = 0;
    t.mock.method(globalThis, "fetch", async () => { requests += 1; return new Response("unavailable", { status: 503 }); });
    await assert.rejects(market.getMarketSnapshot("BTC-USD"), (error) => error instanceof market.TradingMarketError && error.status === 502 && error.code === "market_unavailable");
    assert.equal(requests, 2, "The existing Coinbase then Kraken fallback remains available.");
  });
}

function makeRequest(action, body = {}, method = "POST", symbol, token = "test-token") {
  const url = new URL("https://example.test/functions/v1/varex-trading-api");
  if (method === "GET") {
    url.searchParams.set("action", action);
    if (symbol !== undefined) url.searchParams.set("symbol", symbol);
  }
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === "POST" ? { body: JSON.stringify({ action, ...body }) } : {}),
  });
}

function savedState() {
  return {
    balanceCents: 2500000, selectedSymbol: "ETH-USD", watchlist: ["BTC-USD", "ETH-USD"], trades: [], analyses: [],
    risk: { maxDailyLossPct: 5, maxOpenTrades: 3, riskPerTradePct: 1, autoStop: true, newsPause: true },
    settings: { notifications: true, timezone: "Asia/Dubai", compactMode: false },
  };
}

function edgeHarness(state = savedState(), providerFailure = false) {
  const metrics = { auth: 0, provision: 0, reads: 0, writes: 0, provider: 0, broker: 0 };
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "viewer@example.test", email_confirmed_at: "2026-10-29T00:00:00Z", user_metadata: {} };
  const profile = { user_id: user.id, email: user.email, display_name: "Offline Viewer", role: "viewer", status: "active", paper_balance_cents: 2500000 };
  const client = {
    auth: { getUser: async () => { metrics.auth += 1; return { data: { user }, error: null }; } },
    rpc: async (name) => {
      if (name === "varex_trading_provision") { metrics.provision += 1; return { data: { profile }, error: null }; }
      metrics.writes += 1;
      throw new Error("Unexpected mutation in offline symbol validation test");
    },
    from: (table) => {
      metrics.reads += 1;
      assert.equal(table, "varex_trading_state");
      return {
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: { state_json: structuredClone(state), version: 7 }, error: null }),
      };
    },
  };
  const handler = createTradingHandler({
    env: (name) => ({ SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "offline-test-only" })[name],
    createClient: () => client,
    getMarketBoard: async (selected) => {
      metrics.provider += 1;
      if (providerFailure) throw new edgeMarket.TradingMarketError();
      return { selected: edgeMarket.normalizeTradingSymbol(selected), markets: [], source: "offline fixture", live: true };
    },
    getMarketSnapshot: async () => { metrics.provider += 1; throw new Error("Unexpected provider request"); },
    validateBinanceConnection: async () => { metrics.broker += 1; throw new Error("Unexpected broker validation"); },
    placeBinanceMarketOrder: async () => { metrics.broker += 1; throw new Error("Unexpected order execution"); },
  });
  return { handler, metrics };
}

async function assertUnsupportedResponse(response) {
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, "unsupported_symbol");
  assert.equal(body.marketUnavailable, undefined, "Input validation is not a market-data outage.");
}

test("Edge rejects unsupported chart, analysis, preference and order symbols before provisioning or state access", async () => {
  for (const value of unsupported) {
    for (const action of ["analyze", "open_trade", "place_live_order", "save_preferences"]) {
      const h = edgeHarness();
      const body = action === "save_preferences" ? { selectedSymbol: value } : { symbol: value, side: "buy", amount: 50, confirmation: "LIVE_ORDER_CONFIRMED" };
      await assertUnsupportedResponse(await h.handler(makeRequest(action, body)));
      assert.deepEqual(h.metrics, { auth: 1, provision: 0, reads: 0, writes: 0, provider: 0, broker: 0 });
    }
  }
  for (const symbol of ["EURUSD", "XAUUSD", ""]) {
    const h = edgeHarness();
    await assertUnsupportedResponse(await h.handler(makeRequest("markets", {}, "GET", symbol)));
    assert.deepEqual(h.metrics, { auth: 1, provision: 0, reads: 0, writes: 0, provider: 0, broker: 0 });
  }
});

test("Edge order and explicit preference inputs require a named instrument; authentication is still enforced first", async () => {
  for (const action of ["open_trade", "place_live_order", "save_preferences"]) {
    for (const value of [null, undefined]) {
      if (action === "save_preferences" && value === undefined) continue;
      const h = edgeHarness();
      const body = action === "save_preferences" ? { selectedSymbol: value } : { symbol: value, side: "buy", amount: 50 };
      await assertUnsupportedResponse(await h.handler(makeRequest(action, body)));
      assert.equal(h.metrics.provision, 0);
    }
  }
  const h = edgeHarness();
  assert.equal((await h.handler(makeRequest("open_trade", { symbol: "EURUSD" }, "POST", undefined, ""))).status, 401);
  assert.deepEqual(h.metrics, { auth: 0, provision: 0, reads: 0, writes: 0, provider: 0, broker: 0 });
});

test("Edge preserves saved supported markets and the optional missing-selection default", async () => {
  for (const selectedSymbol of ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", null, undefined]) {
    const state = savedState();
    if (selectedSymbol === undefined) delete state.selectedSymbol;
    else state.selectedSymbol = selectedSymbol;
    const h = edgeHarness(state);
    const response = await h.handler(makeRequest("bootstrap", {}, "GET"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.state.selectedSymbol, selectedSymbol ?? "BTC-USD");
    assert.equal(body.version, 7);
    assert.equal(body.state.balanceCents, state.balanceCents);
    assert.deepEqual(body.state.trades, []);
    assert.equal(h.metrics.writes, 0);
  }
  const h = edgeHarness();
  const response = await h.handler(makeRequest("markets", {}, "GET"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).selected, "BTC-USD");
  assert.equal(h.metrics.writes, 0);
});

test("Edge keeps the existing HTTP 502 response for a genuine provider outage", async () => {
  const h = edgeHarness(savedState(), true);
  const response = await h.handler(makeRequest("markets", {}, "GET", "BTC-USD"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "تعذر جلب أسعار السوق الحية حالياً.", marketUnavailable: true });
});

const legacySource = stripTypeScriptTypes(readFileSync(resolve(repo, "Varex AI Trading/backend/lib/trading-access.ts"), "utf8"), { mode: "transform" });
function legacyFunction(name, nextName) {
  const start = legacySource.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const end = nextName ? legacySource.indexOf(`async function ${nextName}(`, start + 1) : legacySource.length;
  assert.ok(end > start);
  return legacySource.slice(start, end).replace(/export\s+async function/g, "async function").replace(/\bexport\s*$/, "");
}

function legacyHarness() {
  const metrics = { auth: 0, profile: 0, provision: 0, provider: 0 };
  class TradingAccessError extends Error { constructor(status, message) { super(message); this.status = status; } }
  class TradingBrokerError extends Error {}
  const bodies = [
    legacyFunction("requireAccess", "requireBrokerAccess"),
    legacyFunction("requireBrokerAccess", "brokerConnection"),
    legacyFunction("placeLiveOrder", "handlePost"),
    legacyFunction("handlePost", "tradingRequest"),
    legacyFunction("tradingRequest"),
  ].join("\n");
  const unexpectedProvider = async () => { metrics.provider += 1; throw new Error("Unexpected provider request"); };
  const factory = new Function("normalizeTradingSymbol", "TradingMarketError", "TradingAccessError", "TradingBrokerError", "sessionUser", "profileFor", "isTradingDeveloperEmail", "canRegisterTradingEmail", "provisionVerifiedTradingUser", "runtime", "json", "bodyOf", "getMarketBoard", "getMarketSnapshot", `${bodies}\nreturn tradingRequest;`);
  const handler = factory(
    legacyMarket.normalizeTradingSymbol, legacyMarket.TradingMarketError, TradingAccessError, TradingBrokerError,
    async () => { metrics.auth += 1; return { id: "offline-user", email: "viewer@example.test", emailVerified: true }; },
    async () => { metrics.profile += 1; return null; }, () => false, async () => true,
    async () => { metrics.provision += 1; throw new Error("Unexpected profile provisioning"); },
    async () => { throw new Error("Unexpected database access"); },
    (body, status = 200) => Response.json(body, { status }), (request) => request.json(),
    unexpectedProvider, unexpectedProvider,
  );
  return { handler, metrics };
}

test("legacy order, analysis, chart and preference paths reject an unsupported instrument before profile/state work", async () => {
  for (const action of ["analyze", "open_trade", "place_live_order", "save_preferences", "markets"]) {
    const h = legacyHarness();
    const body = action === "save_preferences" ? { selectedSymbol: "XAUUSD" } : { symbol: "XAUUSD", side: "buy", amount: 50 };
    await assertUnsupportedResponse(await h.handler(makeRequest(action, body, action === "markets" ? "GET" : "POST", "XAUUSD")));
    assert.deepEqual(h.metrics, { auth: 1, profile: 0, provision: 0, provider: 0 });
  }
});
