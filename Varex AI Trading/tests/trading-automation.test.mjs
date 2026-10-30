import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import test from "node:test";

const base = new URL("../../supabase/functions/varex-trading-automation/", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "npm:@supabase/supabase-js@2.95.0") return {
      url: "data:text/javascript,export function createClient(){throw new Error('Inject a test client')}", shortCircuit: true,
    };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(base.href) && url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform", sourceUrl: url }),
    };
    return next(url, context);
  },
});
const { validQuote, closedHistory, features, decide, evaluateDemo } = await import(new URL("engine.ts", base));
const { createAutomationHandler } = await import(new URL("index.ts", base));
hooks.deregister();

const now = Date.parse("2026-10-30T12:00:05.000Z");
const asOf = now - 5000;
const config = { symbol: "BTC-USD", interval: "15", risk_percent: 1, max_daily_trades: 5, last_bar_at: 0 };
const state = () => ({ balanceCents: 2_500_000, trades: [], risk: { maxOpenTrades: 3, maxDailyLossPct: 5, riskPerTradePct: 1 }, settings: { untouched: true } });
const model = { accuracy: .7, baseline: .55, samples: 60, trainingSamples: 140, qualified: true };
const decision = (fields = {}) => ({ signal: "buy", asOf, atr: 1, reason: "fixture", model, ...fields });
const quotes = (price = 100, time = now) => ({ "BTC-USD": { price, time } });
const run = (fields = {}) => evaluateDemo({ state: state(), config, decision: decision(), quotes: quotes(), now, uuid: () => "fixture-unique", ...fields });
const trade = (fields = {}) => ({ id: "auto-existing", symbol: "BTC-USD", side: "buy", amount: 1000, quantity: 10,
  entryPrice: 100, exitPrice: null, stopPrice: 98, pnl: 0, status: "open", openedAt: new Date(now - 3600_000).toISOString(), closedAt: null, ...fields });
function candles(count = 300, seconds = 900) {
  const end = Math.floor(now / 1000 / seconds) * seconds;
  return Array.from({ length: count }, (_, i) => {
    const open = 100 + Math.sin(i / 8) * 5 + i / 50, close = 100 + Math.sin((i + 1) / 8) * 5 + (i + 1) / 50;
    return { time: end - seconds * (count - i), open, close, high: Math.max(open, close) + .5, low: Math.min(open, close) - .5 };
  });
}

test("only closed contiguous current candles enter the model; future bars do not alter it", () => {
  const rows = candles(), last = rows.at(-1);
  const unfinished = { ...last, time: last.time + 900, close: 120, high: 121 };
  assert.deepEqual(closedHistory([...rows].reverse().concat(unfinished, rows[0]), 900, now), rows);
  for (const altered of [rows.slice(2, 150), rows.filter((_, i) => i !== 150), rows.map((row) => ({ ...row, time: row.time - 3600 }))]) {
    assert.throws(() => closedHistory(altered, 900, now), /history/);
  }
  assert.throws(() => closedHistory([...rows, { ...rows[20], close: rows[20].close + .1 }], 900, now), /conflicting_history/);
  assert.throws(() => closedHistory([{ ...rows[0], low: NaN }, ...rows.slice(1)], 900, now), /invalid_history/);
  assert.deepEqual(decide(rows, 900, now), decide([...rows, unfinished], 900, now));
});

test("model features do not use future candles and validation reports chronological sample counts", () => {
  const rows = candles(), altered = structuredClone(rows);
  altered[250].high += 500; altered[250].close += 400;
  assert.deepEqual(features(rows).filter((f) => f.index < 250), features(altered).filter((f) => f.index < 250));
  const result = decide(rows, 900, now);
  assert.equal(result.asOf, asOf);
  assert.ok(result.model.trainingSamples >= 70 && result.model.samples >= 30);
  assert.ok(result.model.accuracy >= 0 && result.model.accuracy <= 1);
  assert.ok(result.model.baseline >= .5 && result.model.baseline <= 1);
  if (!result.model.qualified) assert.equal(result.signal, "wait");
});

test("fresh quotes are required and nonfinite, stale, or future prices are rejected", () => {
  assert.equal(validQuote({ price: 100, time: now - 90_000 }, now), true);
  for (const quote of [undefined, { price: NaN, time: now }, { price: Infinity, time: now }, { price: 0, time: now },
    { price: 100, time: now - 90_001 }, { price: 100, time: now + 5001 }, { price: 100, time: NaN }]) {
    assert.equal(validQuote(quote, now), false);
    assert.equal(run({ quotes: { "BTC-USD": quote } }).events.length, 0);
  }
});

test("qualified decisions open only demo trades, preserve source state, and respect notional and risk caps", () => {
  const original = state(), result = run({ state: original });
  assert.equal(original.trades.length, 0);
  assert.equal(original.balanceCents, result.state.balanceCents);
  assert.deepEqual(result.state.settings, original.settings);
  assert.equal(result.events[0].action, "open");
  const opened = result.state.trades[0];
  assert.match(opened.id, /^auto-/);
  assert.equal(opened.amount, 6250, "one position cannot exceed 25% of account balance");
  assert.ok((opened.entryPrice - opened.stopPrice) * opened.quantity <= 250);
  assert.equal(opened.status, "open");
  assert.equal(result.lastBar, asOf);
});

test("unqualified, malformed, stale, future, and repeated decisions cannot create or reverse a position", () => {
  const baseState = state(); baseState.trades.push(trade());
  for (const invalid of [null, decision({ model: null }), decision({ model: { ...model, qualified: false } }),
    decision({ model: { ...model, accuracy: .52 } }), decision({ model: { ...model, baseline: .69 } }),
    decision({ model: { ...model, samples: 1 } }), decision({ model: { ...model, trainingSamples: 1 } }),
    decision({ asOf: asOf + 900_000 }), decision({ asOf: asOf - 1800_000 }), decision({ asOf: asOf - 1 }), decision({ atr: NaN })]) {
    assert.equal(run({ decision: invalid }).events.length, 0);
    const opposite = invalid ? { ...invalid, signal: "sell" } : null;
    assert.equal(run({ state: baseState, decision: opposite }).state.trades[0].status, "open");
  }
  assert.equal(run({ config: { ...config, last_bar_at: asOf } }).events.length, 0);
});

test("stops and targets close only automatic positions even when the model is unavailable", () => {
  for (const price of [97, 105]) {
    const original = state(); original.trades = [trade(), trade({ id: "manual-trade", stopPrice: 0 })];
    const result = run({ state: original, decision: null, quotes: quotes(price) });
    assert.equal(result.state.trades[0].status, "closed");
    assert.equal(result.state.trades[0].pnl, (price - 100) * 10);
    assert.equal(result.state.balanceCents, original.balanceCents + Math.round((price - 100) * 1000));
    assert.deepEqual(result.state.trades[1], original.trades[1], "manual no-stop trades remain byte-for-byte unchanged");
    assert.equal(original.trades[0].status, "open");
  }
  const original = state(); original.trades = [trade()];
  assert.equal(run({ state: original, decision: null, quotes: quotes(97, now - 100_000) }).state.trades[0].status, "open");
});

test("malformed state and config fail before any state mutation or invalid balance", () => {
  for (const invalid of [{ ...config, symbol: "EURUSD" }, { ...config, interval: "__proto__" }, { ...config, risk_percent: 0 },
    { ...config, max_daily_trades: 21 }, { ...config, last_bar_at: now + 1 }]) assert.throws(() => run({ config: invalid }), /invalid_bot_config/);
  for (const fields of [{ quantity: NaN }, { amount: -1 }, { stopPrice: 0 }, { stopPrice: 101 }, { quantity: 15 }, { openedAt: "invalid" }]) {
    const original = state(); original.trades.push(trade(fields));
    assert.throws(() => run({ state: original, quotes: quotes(97) }), /invalid_demo_state/);
    assert.equal(original.balanceCents, 2_500_000);
    assert.equal(original.trades[0].status, "open");
  }
});

test("daily loss, trade count, existing positions, and aggregate budget prevent extra entries", () => {
  const closed = trade({ status: "closed", closedAt: new Date(now - 1000).toISOString(), exitPrice: 90, pnl: -1500 });
  const exhausted = state(); exhausted.trades = [closed];
  assert.equal(run({ state: exhausted }).events.length, 0);
  const maxed = state(); maxed.trades = [closed, { ...closed, id: "auto-other", pnl: 0 }];
  assert.equal(run({ state: maxed, config: { ...config, max_daily_trades: 2 } }).events.length, 0);
  const existing = state(); existing.trades = [trade()];
  assert.equal(run({ state: existing }).events.length, 0);
  const used = state(); used.trades = [trade({ id: "manual", symbol: "ETH-USD", amount: 18_750, quantity: 187.5, stopPrice: 0 })];
  assert.equal(run({ state: used }).events.length, 0);
});

const token = "a".repeat(64), tokenHash = createHash("sha256").update(token).digest("hex");
const user = { id: "user-a", email: "alice@example.test", email_confirmed_at: "2026-10-29T00:00:00Z", is_anonymous: false };
const activeProfile = { user_id: user.id, email: user.email, role: "trader", status: "active" };
const body = { action: "configure", mode: "demo", enabled: true, symbol: "BTC-USD", interval: "15", riskPercent: 1,
  maxDailyTrades: 5, expectedRevision: 0, confirmation: "ENABLE_DEMO_AUTOMATION" };
function fixture(options = {}) {
  const calls = [], fetches = [];
  const runtime = { scheduler_secret_hash: tokenHash, scheduler_ready: true, heartbeat_at: now, ...options.runtime };
  const client = {
    auth: { async getUser(jwt) { calls.push(["auth", jwt]); return { data: { user: options.user === undefined ? user : options.user }, error: null }; } },
    from(table) {
      const query = { table, fields: null, filters: [] };
      return {
        select(fields) { query.fields = fields; return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        async maybeSingle() {
          calls.push(["read", query]);
          const data = table === "varex_trading_bot_runtime" ? runtime
            : table === "varex_trading_profile" ? options.profile === undefined ? activeProfile : options.profile
            : table === "varex_trading_bot_config" ? options.config || null
            : table === "varex_trading_state" ? { state_json: options.state || state(), version: 3 } : assert.fail(`Unexpected table ${table}`);
          return { data, error: null };
        },
      };
    },
    async rpc(name, args) {
      calls.push(["rpc", name, args]);
      if (name === "varex_trading_bot_claim") return { data: options.claims || [], error: null };
      if (name === "varex_trading_bot_complete") return { data: { saved: true }, error: null };
      if (name === "varex_trading_bot_configure") return { data: options.configureResult || { config: { enabled: args.p_enabled, revision: 1 } }, error: null };
      assert.fail(`Unexpected RPC ${name}`);
    },
  };
  const handler = createAutomationHandler({ createClient: () => client, now: () => now, uuid: () => "fixture-new",
    env: (name) => ({ SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key" })[name],
    fetch: async (url, init) => {
      fetches.push([url, init]);
      assert.equal(new URL(url).origin, "https://api.exchange.coinbase.com");
      assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error");
      assert.deepEqual(init.headers, { Accept: "application/json" });
      assert.equal(init.method, undefined, "all public market requests are GET");
      if (options.providerFailure) return Response.json({}, { status: 503 });
      if (url.includes("/candles?")) return Response.json(candles().map((bar) => [bar.time, bar.low, bar.high, bar.open, bar.close, 1]));
      if (url.endsWith("/ticker")) return Response.json({ price: "100", time: new Date(now).toISOString() });
      assert.fail(`Unexpected public path ${url}`);
    },
  });
  return { handler, calls, fetches };
}
function request(method = "GET", payload, headers = {}) {
  return new Request("https://fixture.supabase.co/functions/v1/varex-trading-automation", {
    method, headers: { authorization: "Bearer user-jwt", origin: "https://app.varexapp.com", "content-type": "application/json", ...headers },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
  });
}
const tick = (value = token, extraHeaders = {}) => new Request("https://fixture.supabase.co/functions/v1/varex-trading-automation", {
  method: "POST", headers: { "x-varex-scheduler": value, ...extraHeaders }, body: JSON.stringify({ action: "tick" }),
});

test("authentication, confirmation, profile, and origin checks precede all config writes", async () => {
  for (const [options, req, expected] of [
    [{}, request("GET", undefined, { authorization: "" }), 401],
    [{}, request("GET", undefined, { origin: "https://untrusted.test" }), 403],
    [{ user: null }, request(), 401],
    [{ user: { ...user, email_confirmed_at: null } }, request(), 403],
    [{ user: { ...user, is_anonymous: true } }, request(), 403],
    [{ profile: { ...activeProfile, status: "inactive" } }, request(), 403],
    [{ profile: { ...activeProfile, role: "viewer" } }, request("POST", body), 403],
    [{}, request("POST", { ...body, confirmation: "" }), 400],
    [{}, request("POST", { ...body, mode: "live" }), 400],
    [{}, request("POST", { ...body, interval: "__proto__" }), 400],
    [{ runtime: { heartbeat_at: now - 180_001 } }, request("POST", body), 503],
  ]) {
    const fx = fixture(options), response = await fx.handler(req);
    assert.equal(response.status, expected);
    assert.equal(fx.calls.some((call) => call[0] === "rpc"), false);
    assert.equal(fx.fetches.length, 0);
  }
});

test("status is private, default-off demo and does not read account state or broker secrets", async () => {
  const fx = fixture(), response = await fx.handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { automation } = await response.json();
  assert.equal(automation.mode, "demo"); assert.equal(automation.enabled, false); assert.equal(automation.schedulerReady, true);
  for (const call of fx.calls.filter((entry) => entry[0] === "read")) {
    assert.match(call[1].table, /^varex_trading_(profile|bot_runtime|bot_config)$/);
    if (call[1].table !== "varex_trading_bot_runtime") assert.deepEqual(call[1].filters, [["user_id", user.id]]);
  }
  assert.equal(fx.fetches.length, 0);
});

test("configure uses verified identity and revision and stopping remains available during scheduler downtime", async () => {
  const fx = fixture(), response = await fx.handler(request("POST", { ...body, user_id: "victim" }));
  assert.equal(response.status, 200);
  const configure = fx.calls.find((call) => call[1] === "varex_trading_bot_configure");
  assert.equal(configure[2].p_user_id, user.id); assert.equal(configure[2].p_expected_revision, 0);
  assert.equal(fx.fetches.length, 0);
  const stopped = fixture({ runtime: { scheduler_ready: false }, profile: { ...activeProfile, role: "viewer" } });
  const stopResponse = await stopped.handler(request("POST", { ...body, enabled: false, confirmation: "STOP_DEMO_AUTOMATION" }));
  assert.equal(stopResponse.status, 200);
  assert.equal(stopped.calls.find((call) => call[1] === "varex_trading_bot_configure")[2].p_enabled, false);
  const conflict = fixture({ configureResult: { reason: "conflict" } });
  assert.equal((await conflict.handler(request("POST", body))).status, 409);
});

test("scheduler requires a server-side secret and readiness before claiming work", async () => {
  for (const req of [tick("b".repeat(64)), tick("bad-token"), tick(token, { origin: "https://app.varexapp.com" })]) {
    const fx = fixture(); assert.equal((await fx.handler(req)).status, 403);
    assert.equal(fx.calls.some((call) => call[0] === "rpc"), false); assert.equal(fx.fetches.length, 0);
  }
  const disabled = fixture({ runtime: { scheduler_ready: false } });
  const response = await disabled.handler(tick());
  assert.equal(response.status, 200); assert.equal((await response.json()).schedulerReady, false);
  assert.equal(disabled.calls.some((call) => call[0] === "rpc"), false);
  const fx = fixture(), empty = await fx.handler(tick());
  assert.deepEqual(await empty.json(), { mode: "demo", checked: 0, processed: 0 });
  assert.equal(fx.calls.some((call) => call[0] === "auth"), false);
  assert.equal(fx.fetches.length, 0);
});

test("scheduled processing uses only public data and atomic demo-state completion, without broker calls", async () => {
  const saved = state(); saved.trades = [trade()];
  const fx = fixture({ state: saved, claims: [{ ...config, user_id: user.id, revision: 2, lease_id: "lease-fixture" }] });
  const response = await fx.handler(tick());
  assert.deepEqual(await response.json(), { mode: "demo", checked: 1, processed: 1 });
  assert.equal(fx.fetches.length, 2);
  const completed = fx.calls.find((call) => call[1] === "varex_trading_bot_complete")[2];
  assert.equal(completed.p_user_id, user.id); assert.equal(completed.p_expected_version, 3);
  assert.equal(completed.p_revision, 2); assert.equal(completed.p_lease_id, "lease-fixture");
  assert.equal(fx.calls.some((call) => call[0] === "read" && /broker|live_order/.test(call[1].table)), false);
  assert.deepEqual(saved.trades, [trade()]);
});

test("provider outages produce a wait event with no account mutation", async () => {
  const fx = fixture({ providerFailure: true, claims: [{ ...config, user_id: user.id, revision: 2, lease_id: "lease-fixture" }] });
  assert.equal((await fx.handler(tick())).status, 200);
  const completed = fx.calls.find((call) => call[1] === "varex_trading_bot_complete")[2];
  assert.equal(completed.p_state_json, null);
  assert.equal(completed.p_signal, "wait"); assert.equal(completed.p_last_bar_at, 0);
});
