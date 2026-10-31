import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const ORIGIN = "https://app.varexapp.com";
const API = "https://example.supabase.co/functions/v1/varex-trading-api";
const AUTOMATION = "https://example.supabase.co/functions/v1/varex-trading-automation";
const retiredActions = [
  "bootstrap", "markets", "analyze", "save_preferences", "open_trade", "close_trade", "reset_paper",
  "connect_broker", "refresh_broker", "configure_live_trading", "disconnect_broker", "place_live_order", "unknown_action",
];

// Evaluate the real TypeScript entrypoint, replacing only external imports and
// runtime capabilities. Deno.serve is captured rather than starting a server.
// No fetch, Auth, database, broker, or market provider can escape this harness.
function evaluate(relative, imports = {}, bindings = {}, exported = []) {
  const url = new URL(relative, root);
  let source = stripTypeScriptTypes(readFileSync(url, "utf8"), { mode: "transform", sourceUrl: url.href });
  source = source.replace(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/gm, (_statement, names, specifier) => {
    assert.ok(Object.hasOwn(imports, specifier), `Unmocked module: ${specifier}`);
    const entries = names.split(",").map((name) => name.trim()).filter(Boolean);
    for (const entry of entries) assert.ok(Object.hasOwn(imports[specifier], entry.split(/\s+as\s+/)[0]), `Unmocked import: ${entry}`);
    return `const { ${entries.map((name) => name.replace(/\s+as\s+/, ": ")).join(", ")} } = __imports[${JSON.stringify(specifier)}];`;
  });
  source = source.replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, "");
  assert.doesNotMatch(source, /^(?:import|export)\s/m, "Every external import must be explicitly mocked");
  const context = {
    Request, Response, Headers, URL, Date, TextEncoder, TextDecoder, structuredClone, crypto, atob, btoa,
    __imports: imports,
    fetch: () => assert.fail("Unexpected external network request"),
    console: new Proxy({}, { get: () => () => assert.fail("Unexpected diagnostic from retired service") }),
    ...bindings,
  };
  vm.runInNewContext(`${source}\nglobalThis.__exports = { ${exported.join(", ")} };`, context, { filename: relative, timeout: 1000 });
  return context.__exports;
}

const { analysisOnlyHandler } = evaluate(
  "supabase/functions/varex-trading-api/analysis-retirement.ts", {}, {}, ["analysisOnlyHandler"],
);

function request(action, { method = "POST", body, origin = ORIGIN, token = "test-token", queryAction, headers = {} } = {}) {
  const query = queryAction ?? (method === "GET" ? action : undefined);
  return new Request(`${API}${query ? `?action=${encodeURIComponent(query)}` : ""}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(!["GET", "HEAD"].includes(method) ? { body: body === undefined ? JSON.stringify({ action }) : body } : {}),
  });
}

function publicTrading({ allowEnvironment = false, createClient } = {}) {
  const calls = [], served = [];
  const trap = (name) => (..._args) => { calls.push(name); throw new Error(`Unexpected retired dependency: ${name}`); };
  const provider = Object.fromEntries([
    "analyzeSnapshot", "getMarketBoard", "getMarketSnapshot", "normalizeTradingSymbol", "decryptTradingSecret", "encryptTradingSecret",
    "placeBinanceMarketOrder", "validateBinanceConnection", "capitalCredentials", "capitalCredentialsFromSecret", "capitalSecret", "validateCapitalConnection",
  ].map((name) => [name, trap(name)]));
  const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" };
  evaluate("supabase/functions/varex-trading-api/index.ts", {
    "@supabase/supabase-js": { createClient: createClient || trap("createClient/Auth/database") },
    "./trading-market.ts": { ...provider, TRADING_MARKETS: { "BTC-USD": {} }, TradingMarketError: class extends Error {} },
    "./trading-broker.ts": { ...provider, TradingBrokerError: class extends Error {} },
    "./trading-capital.ts": provider,
    "./analysis-retirement.ts": { analysisOnlyHandler },
  }, {
    Deno: { serve: (handler) => served.push(handler), env: { get: allowEnvironment ? (name) => env[name] : trap("environment") } },
    fetch: trap("network/provider"),
  });
  assert.equal(served.length, 1, "The public entrypoint must register exactly one handler");
  return { handler: served[0], calls };
}

function publicAutomation() {
  const calls = [], served = [];
  const trap = (name) => () => { calls.push(name); throw new Error(`Unexpected automation dependency: ${name}`); };
  const exports = evaluate("supabase/functions/varex-trading-automation/index.ts", {
    "npm:@supabase/supabase-js@2.95.0": { createClient: trap("createClient/Auth/database") },
    "./engine.ts": { BOT_SYMBOLS: ["BTC-USD"], BOT_INTERVALS: { "15": 900 }, decide: trap("decide"), evaluateDemo: trap("evaluateDemo") },
  }, {
    Deno: { serve: (handler) => served.push(handler), env: { get: trap("environment") } },
    fetch: trap("network/provider"),
  }, ["retiredAutomationHandler"]);
  assert.equal(served.length, 1);
  assert.equal(served[0], exports.retiredAutomationHandler, "Deno must serve the retirement handler instead of the legacy scheduler");
  return { handler: served[0], calls };
}

test("the public trading entrypoint retires every old read, demo trade, broker action, and real order before any dependency", async () => {
  const { handler, calls } = publicTrading();
  for (const token of ["", "test-token"]) {
    for (const action of retiredActions) {
      for (const method of ["GET", "POST"]) {
        const result = await handler(request(action, { method, token }));
        assert.equal(result.status, 410, `${method} ${action} with ${token ? "a" : "no"} token`);
        const body = await result.json();
        assert.equal(body.code, "analysis_only");
        assert.equal(body.analysisOnly, true);
        assert.equal(result.headers.get("cache-control"), "no-store");
        assert.equal(result.headers.get("access-control-allow-origin"), ORIGIN);
      }
    }
  }
  for (const method of ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"]) {
    const result = await handler(request(undefined, { method }));
    assert.equal(result.status, 410, `Missing action with ${method}`);
  }
  assert.deepEqual(calls, [], "No Auth, storage, environment, provider, or broker work may run for retired actions");
});

test("the retirement boundary cannot be bypassed by query actions, unsupported methods, or JSON shapes", async () => {
  let delegated = 0;
  const handler = analysisOnlyHandler(async () => { delegated++; assert.fail("Retired request reached the delegate"); });
  const requests = [
    request("open_trade", { queryAction: "access" }),
    request("place_live_order", { queryAction: "users" }),
    request("update_profile", { method: "PUT", queryAction: "access" }),
    request("update_profile", { method: "PATCH" }),
    request("access", { method: "DELETE", queryAction: "access" }),
    request("access", { method: "HEAD", queryAction: "access" }),
    request(undefined, { body: "null" }),
    request(undefined, { body: "[]" }),
    request(undefined, { body: JSON.stringify({ action: ["update_profile"] }) }),
    request(undefined, { body: JSON.stringify({ action: { toString: "update_profile" } }) }),
  ];
  for (const value of requests) assert.equal((await handler(value)).status, 410);
  assert.equal(delegated, 0);
});

test("malformed and oversized requests fail before the identity delegate", async () => {
  let delegated = 0;
  const handler = analysisOnlyHandler(async () => { delegated++; assert.fail("Invalid body reached the delegate"); });
  for (const [body, status, code] of [
    ["{malformed", 400, "invalid_request"],
    [JSON.stringify({ action: "update_profile", displayName: "x".repeat(65_537) }), 413, "request_too_large"],
  ]) {
    const result = await handler(request(undefined, { body, queryAction: "access" }));
    assert.equal(result.status, status);
    assert.equal((await result.json()).code, code);
  }
  assert.equal(delegated, 0);
});

test("remaining identity actions delegate with the original token and unconsumed request body", async () => {
  const allowed = [["users", "GET"], ["update_profile", "POST"], ["invite_user", "POST"], ["update_user", "POST"]];
  for (const [action, method] of allowed) {
    const input = request(action, { method });
    const upstream = Response.json({ accepted: action }, { headers: { "X-Identity-Trace": "kept" } });
    let delegated = 0;
    const handler = analysisOnlyHandler(async (received) => {
      delegated++;
      assert.equal(received, input);
      assert.equal(received.headers.get("authorization"), "Bearer test-token");
      assert.equal(received.bodyUsed, false);
      if (method === "POST") assert.deepEqual(await received.json(), { action });
      return upstream;
    });
    const result = await handler(input);
    assert.equal(result, upstream);
    assert.equal(result.headers.get("X-Identity-Trace"), "kept");
    assert.equal(result.bodyUsed, false);
    assert.equal(delegated, 1);
  }
});

test("identity Auth and authorization failures remain authoritative and are never turned into successful access", async () => {
  for (const status of [401, 403, 429, 503]) {
    for (const [action, method] of [["access", "GET"], ["users", "GET"], ["update_user", "POST"]]) {
      const upstream = Response.json({ error: "identity rejected" }, { status, headers: { "Retry-After": "60" } });
      let delegated = 0;
      const handler = analysisOnlyHandler(async () => { delegated++; return upstream; });
      const result = await handler(request(action, { method }));
      assert.equal(result, upstream);
      assert.equal(result.bodyUsed, false);
      assert.equal(result.headers.get("Retry-After"), "60");
      assert.equal(delegated, 1);
    }
  }
});

test("successful access strips trading information and forces trading and broker permissions off", async () => {
  const upstream = Response.json({
    profile: {
      id: "test-user", email: "person@example.test", displayName: "Test Person", role: "developer", status: "active",
      canManageUsers: true, canTrade: true, canConnectBroker: true, paperBalance: 25_000, brokerSecret: "must-not-survive",
    },
    broker: { connected: true }, trades: [{ id: "historical-trade" }], balance: 25_000,
  }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": ORIGIN, "X-Identity-Trace": "kept" } });
  let delegated = 0;
  const handler = analysisOnlyHandler(async () => { delegated++; return upstream; });
  const response = await handler(request("access", { method: "GET" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    analysisOnly: true,
    profile: {
      id: "test-user", email: "person@example.test", displayName: "Test Person", role: "developer", status: "active",
      canManageUsers: true, canTrade: false, canConnectBroker: false,
    },
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(response.headers.get("X-Identity-Trace"), "kept");
  assert.equal(delegated, 1);
  const missing = await analysisOnlyHandler(async () => Response.json({}))(request("access", { method: "GET" }));
  assert.deepEqual((await missing.json()).profile, { canManageUsers: false, canTrade: false, canConnectBroker: false });
});

test("the actual public identity handler still verifies missing, invalid, and unconfirmed sessions", async () => {
  const absent = publicTrading({ allowEnvironment: true });
  assert.equal((await absent.handler(request("access", { method: "GET", token: "" }))).status, 401);
  assert.deepEqual(absent.calls, []);
  for (const [authResult, status] of [
    [{ data: { user: null }, error: { message: "invalid JWT" } }, 401],
    [{ data: { user: { id: "test-user", email: "person@example.test", email_confirmed_at: null } }, error: null }, 403],
  ]) {
    let clientCalls = 0, authCalls = 0, databaseCalls = 0;
    const { handler, calls } = publicTrading({ allowEnvironment: true, createClient: () => {
      clientCalls++;
      return {
        auth: { getUser: async (token) => { authCalls++; assert.equal(token, "test-token"); return authResult; } },
        from() { databaseCalls++; assert.fail("A rejected identity must not reach database tables"); },
        rpc() { databaseCalls++; assert.fail("A rejected identity must not reach database RPCs"); },
      };
    } });
    assert.equal((await handler(request("access", { method: "GET" }))).status, status);
    assert.equal(clientCalls, 1);
    assert.equal(authCalls, 1);
    assert.equal(databaseCalls, 0);
    assert.deepEqual(calls, []);
  }
});

test("retirement responses enforce the origin boundary and only delegate allowed preflight", async () => {
  let delegated = 0;
  const preflight = new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": ORIGIN } });
  const handler = analysisOnlyHandler(async () => { delegated++; return preflight; });
  for (const [action, method] of [["access", "GET"], ["open_trade", "POST"], [undefined, "OPTIONS"]]) {
    const response = await handler(request(action, { method, origin: "https://foreign.example" }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "origin_not_allowed");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal(delegated, 0);
  assert.equal(await handler(request(undefined, { method: "OPTIONS" })), preflight);
  assert.equal(delegated, 1);
});

test("the actual public automation entrypoint cannot execute a user or scheduler cycle", async () => {
  const { handler, calls } = publicAutomation();
  const requests = [
    new Request(AUTOMATION),
    new Request(AUTOMATION, { headers: { Authorization: "Bearer test-user-token", Origin: ORIGIN } }),
    new Request(AUTOMATION, { method: "POST", headers: { Authorization: "Bearer test-user-token", Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ action: "configure", mode: "demo", enabled: true }) }),
    new Request(AUTOMATION, { method: "POST", headers: { "x-varex-scheduler": "a".repeat(64), "Content-Type": "application/json" }, body: JSON.stringify({ action: "tick" }) }),
    new Request(AUTOMATION, { method: "POST", headers: { "x-varex-scheduler": "a".repeat(64) }, body: "{invalid" }),
    new Request(AUTOMATION, { method: "DELETE" }),
  ];
  for (const input of requests) {
    const response = await handler(input);
    assert.equal(response.status, 410);
    const body = await response.json();
    assert.equal(body.enabled, false);
    assert.equal(body.analysisOnly, true);
    assert.equal(body.code, "analysis_only");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.deepEqual(calls, [], "No scheduler, Auth, database, market feed, or strategy may run");
});

test("retired automation preserves allowed CORS preflight and rejects a foreign origin without work", async () => {
  const { handler, calls } = publicAutomation();
  const preflight = await handler(new Request(AUTOMATION, { method: "OPTIONS", headers: { Origin: ORIGIN } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /authorization/);
  for (const method of ["GET", "POST", "OPTIONS"]) {
    const response = await handler(new Request(AUTOMATION, { method, headers: { Origin: "https://foreign.example" } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.deepEqual(calls, []);
});
