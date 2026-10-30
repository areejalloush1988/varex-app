import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks, stripTypeScriptTypes } from "node:module";

// Node 24 runs the real Edge handler and utilities, with no network or account
// calls. SQL integration uses the pinned local @electric-sql/pglite development
// dependency. Run `npm ci && npm test` in Varex AI Trading. No Supabase project is used.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const api = resolve(repo, "supabase/functions/varex-trading-api");
const apiUrl = pathToFileURL(api).href + "/";
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@supabase/supabase-js") {
      return { url: "data:text/javascript,export function createClient(){throw new Error('A mocked Supabase client is required in tests')}", shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(apiUrl) && url.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform", sourceUrl: url }), shortCircuit: true };
    }
    return next(url, context);
  },
});
const { createTradingHandler, deriveTradingCredentialKey } = await import(pathToFileURL(resolve(api, "index.ts")));
const { encryptTradingSecret, decryptTradingSecret, placeBinanceMarketOrder, TradingBrokerError } = await import(pathToFileURL(resolve(api, "trading-broker.ts")));
hooks.deregister();

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unexpected network access in trading tests"); };
after(() => { globalThis.fetch = originalFetch; });

const ownerId = "00000000-0000-4000-8000-000000000001";
const aliceId = "00000000-0000-4000-8000-000000000002";
const bobId = "00000000-0000-4000-8000-000000000003";
const ownerEmail = "areejalloush1988@gmail.com";
const fixedNow = Date.parse("2026-10-30T12:00:00Z");
const fixtureKey = Buffer.alloc(32, 7).toString("base64");
const user = (id = aliceId, email = "alice@example.test", fields = {}) => ({ id, email, email_confirmed_at: "2026-10-29T00:00:00Z", user_metadata: { name: "Test Trader" }, ...fields });
const baseEnvironment = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-test-fixture", TRADING_CREDENTIAL_KEY: fixtureKey };
const request = (action, body = {}, token = "alice", method = "POST", origin = "https://app.varexapp.com") => new Request(
  `https://example.supabase.co/functions/v1/varex-trading-api${method === "GET" && action ? `?action=${action}` : ""}`,
  { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, ...(method === "POST" ? { body: JSON.stringify({ action, ...body }) } : {}) },
);

test("legacy 32-byte AES keys remain unchanged and preserve ciphertext compatibility", async () => {
  assert.equal(await deriveTradingCredentialKey(fixtureKey), fixtureKey);
  const encrypted = await encryptTradingSecret("mock broker secret", fixtureKey);
  assert.equal(await decryptTradingSecret(encrypted, await deriveTradingCredentialKey(fixtureKey)), "mock broker secret");
});

test("48-byte random Base64URL input derives a stable 32-byte key and round-trips AES-GCM", async () => {
  const input = Buffer.alloc(48, 91).toString("base64url");
  const first = await deriveTradingCredentialKey(input);
  const second = await deriveTradingCredentialKey(input);
  assert.equal(first, second);
  assert.equal(Buffer.from(first, "base64").length, 32);
  assert.notEqual(first, Buffer.from(input, "base64url").subarray(0, 32).toString("base64"));
  const encrypted = await encryptTradingSecret("mock only; never a real credential", first);
  assert.equal(await decryptTradingSecret(encrypted, second), "mock only; never a real credential");
});

test("empty, malformed, and unsupported-size encryption inputs fail closed", async () => {
  for (const value of ["", "not-a-key!", " ".repeat(44), Buffer.alloc(16).toString("base64"), Buffer.alloc(33).toString("base64"), Buffer.alloc(64).toString("base64")]) {
    await assert.rejects(deriveTradingCredentialKey(value), (error) => error.status === 503 && error.extra.brokerUnavailable === true);
  }
});

test("missing JWT and disallowed origin never reach Auth or the database", async () => {
  let clientCalls = 0;
  const handler = createTradingHandler({ env: (name) => baseEnvironment[name], createClient: () => { clientCalls += 1; throw new Error("must not connect"); } });
  assert.equal((await handler(request("bootstrap", {}, "", "GET"))).status, 401);
  const rejected = await handler(request("bootstrap", {}, "alice", "GET", "https://untrusted.example"));
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  assert.equal(clientCalls, 0);
});

test("CORS preflight supports only the explicit application origins", async () => {
  const handler = createTradingHandler({ env: () => undefined });
  for (const origin of ["https://app.varexapp.com", "https://areejalloush1988.github.io"]) {
    const result = await handler(new Request("https://example.test", { method: "OPTIONS", headers: { Origin: origin } }));
    assert.equal(result.status, 204);
    assert.equal(result.headers.get("access-control-allow-origin"), origin);
    assert.match(result.headers.get("access-control-allow-headers"), /authorization/);
  }
});

test("Auth.getUser must verify a non-anonymous, confirmed email before provisioning", async () => {
  for (const authResult of [
    { data: { user: null }, error: { message: "bad JWT" } },
    { data: { user: user(aliceId, "alice@example.test", { email_confirmed_at: null }) }, error: null },
    { data: { user: user(aliceId, "alice@example.test", { is_anonymous: true }) }, error: null },
  ]) {
    let rpcCalls = 0;
    const handler = createTradingHandler({
      env: (name) => baseEnvironment[name],
      createClient: () => ({ auth: { getUser: async (token) => { assert.equal(token, "alice"); return authResult; } }, rpc: () => { rpcCalls += 1; throw new Error("must not provision"); } }),
    });
    assert.ok([401, 403].includes((await handler(request("bootstrap", {}, "alice", "GET"))).status));
    assert.equal(rpcCalls, 0);
  }
});

test("modern secret dictionary is preferred; malformed dictionary retains legacy compatibility", async () => {
  for (const [dictionary, expected] of [[JSON.stringify({ default: "sb_secret_test_fixture" }), "sb_secret_test_fixture"], ["invalid-json", "server-test-fixture"]]) {
    let selected;
    const handler = createTradingHandler({
      env: (name) => name === "SUPABASE_SECRET_KEYS" ? dictionary : baseEnvironment[name],
      createClient: (_url, key) => { selected = key; return { auth: { getUser: async () => ({ data: { user: null }, error: {} }) } }; },
    });
    assert.equal((await handler(request("bootstrap", {}, "alice", "GET"))).status, 401);
    assert.equal(selected, expected);
  }
});

test("Binance execution-unknown errors remain uncertain even with HTTP 400", async () => {
  const blockedFetch = globalThis.fetch;
  let submissions = 0;
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v3/time") return Response.json({ serverTime: fixedNow });
    if (path === "/api/v3/order/test") return Response.json({});
    if (path === "/api/v3/order") { submissions += 1; return Response.json({ code: -1006, msg: "mock execution status unknown" }, { status: 400 }); }
    throw new Error("Unexpected mock provider path");
  };
  try {
    await assert.rejects(placeBinanceMarketOrder({ apiKey: "fixture-only", apiSecret: "fixture-only" }, { symbol: "BTC-USD", side: "buy", quoteAmount: 50, clientOrderId: "fixture-request" }), (error) => error instanceof TradingBrokerError && error.uncertain === true && error.status === 502);
    assert.equal(submissions, 1);
  } finally { globalThis.fetch = blockedFetch; }
});

const { PGlite } = await import("@electric-sql/pglite");

test("real PostgreSQL migration and Edge API integration (offline)", async (t) => {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key, email text not null); grant usage on schema public to service_role, anon, authenticated;");
  await db.exec(readFileSync(resolve(repo, "supabase/migrations/20261030053731_varex_trading_standalone.sql"), "utf8"));
  t.after(() => db.close());

  const id = (value) => {
    assert.match(value, /^[a-z_][a-z0-9_]*$/i);
    return `"${value}"`;
  };
  const encode = (value) => value !== null && typeof value === "object" ? JSON.stringify(value) : value;
  async function reset() {
    await db.exec("reset role; truncate public.varex_trading_live_order, public.varex_trading_broker_connection, public.varex_trading_state, public.varex_trading_invite, public.varex_trading_profile, auth.users cascade;");
    await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4),($5,$6)", [ownerId, ownerEmail, aliceId, "alice@example.test", bobId, "bob@example.test"]);
    await db.exec("set role service_role;");
  }

  function harness(options = {}) {
    const metrics = { auth: 0, validation: 0, orders: 0, rpc: [], writes: [], lastClientKey: null };
    const users = { owner: user(ownerId, ownerEmail), alice: user(), bob: user(bobId, "bob@example.test"), ...(options.users || {}) };
    const environment = { ...baseEnvironment, ...options.environment };
    let currentPrice = 100;
    const snapshot = (symbol = "BTC-USD") => ({ symbol, label: symbol, name: symbol, icon: "", price: currentPrice, open: 100, high: 105, low: 80, volumeBase: 10, volumeUsd: 1000, changePct: currentPrice - 100, asOf: new Date(fixedNow).toISOString(), source: "offline fixture", candles: [] });
    const summary = { provider: "binance", accountType: "SPOT", canTrade: true, permissions: { reading: true, spotTrading: true, withdrawals: false, internalTransfer: false, universalTransfer: false, margin: false, futures: false, options: false, portfolioMargin: false, ipRestricted: true }, balances: [{ asset: "USDT", free: 10000, locked: 0, total: 10000 }], availableUsdt: 10000 };

    class Query {
      constructor(table) { assert.match(table, /^varex_trading_[a-z_]+$/); this.table = table; this.operation = "select"; this.filters = []; this.columns = "*"; }
      select(columns = "*") { this.columns = columns; return this; }
      eq(column, value) { this.filters.push([column, value]); return this; }
      order(column, { ascending }) { this.sort = [column, ascending]; return this; }
      limit(value) { this.maximum = value; return this; }
      update(value) { this.operation = "update"; this.values = value; return this; }
      delete() { this.operation = "delete"; return this; }
      upsert(value, options) { this.operation = "upsert"; this.values = value; this.upsertOptions = options; return this; }
      maybeSingle() { this.single = true; return this.run(); }
      then(resolve, reject) { return this.run().then(resolve, reject); }
      async run() {
        if (this.operation !== "select") metrics.writes.push({ table: this.table, values: this.values, filters: this.filters });
        const failure = await options.queryFailure?.(this);
        if (failure) return { data: null, error: { message: "injected database error" } };
        const parameters = [];
        const parameter = (value) => { parameters.push(encode(value)); return `$${parameters.length}`; };
        let sql;
        if (this.operation === "select") sql = `select ${this.columns === "*" ? "*" : this.columns.split(",").map(id).join(",")} from public.${id(this.table)}`;
        if (this.operation === "update") sql = `update public.${id(this.table)} set ${Object.entries(this.values).map(([key, value]) => `${id(key)}=${parameter(value)}`).join(",")}`;
        if (this.operation === "delete") sql = `delete from public.${id(this.table)}`;
        if (this.operation === "upsert") {
          const keys = Object.keys(this.values);
          sql = `insert into public.${id(this.table)} (${keys.map(id).join(",")}) values (${keys.map((key) => parameter(this.values[key])).join(",")}) on conflict (${id(this.upsertOptions.onConflict)}) `;
          sql += this.upsertOptions.ignoreDuplicates ? "do nothing" : `do update set ${keys.filter((key) => key !== this.upsertOptions.onConflict).map((key) => `${id(key)}=excluded.${id(key)}`).join(",")}`;
        } else if (this.filters.length) sql += ` where ${this.filters.map(([key, value]) => `${id(key)}=${parameter(value)}`).join(" and ")}`;
        if (this.operation === "select") {
          if (this.sort) sql += ` order by ${id(this.sort[0])} ${this.sort[1] ? "asc" : "desc"}`;
          if (this.maximum) sql += ` limit ${Number(this.maximum)}`;
        } else sql += " returning *";
        try {
          const result = await db.query(sql, parameters);
          if (this.single && result.rows.length > 1) return { data: null, error: { message: "multiple rows" } };
          return { data: this.single ? result.rows[0] || null : result.rows, error: null };
        } catch (error) { return { data: null, error }; }
      }
    }

    const client = {
      auth: { getUser: async (token) => { metrics.auth += 1; return { data: { user: users[token] || null }, error: users[token] ? null : { message: "invalid token" } }; } },
      from: (table) => new Query(table),
      rpc: async (name, args) => {
        metrics.rpc.push({ name, args });
        await options.beforeRpc?.(name, args, db, metrics);
        try {
          const values = Object.values(args).map(encode);
          const parameters = Object.keys(args).map((key, index) => `${id(key)} => $${index + 1}`).join(",");
          const result = await db.query(`select public.${id(name)}(${parameters}) as data`, values);
          return { data: result.rows[0].data, error: null };
        } catch (error) { return { data: null, error }; }
      },
    };
    const handler = createTradingHandler({
      env: (name) => environment[name],
      createClient: (_url, key) => { metrics.lastClientKey = key; return client; },
      now: () => fixedNow,
      getMarketSnapshot: async (symbol) => snapshot(symbol),
      getMarketBoard: async () => ({ selected: "BTC-USD", markets: [snapshot("BTC-USD"), snapshot("ETH-USD"), snapshot("SOL-USD"), snapshot("ADA-USD")], source: "offline fixture", live: true }),
      validateBinanceConnection: async () => { metrics.validation += 1; return summary; },
      encryptTradingSecret: async (value) => ({ ciphertext: `encrypted-fixture-${value.slice(-4)}`, iv: "fixture-iv" }),
      decryptTradingSecret: async () => "mocked-broker-credential",
      placeBinanceMarketOrder: async (_credentials, input) => {
        metrics.orders += 1;
        if (options.placeOrder) return await options.placeOrder(input);
        return { providerOrderId: "12345", clientOrderId: input.clientOrderId, symbol: "BTCUSDT", side: input.side, status: "FILLED", executedQuantity: "1", executedQuoteAmount: String(input.quoteAmount), transactedAt: fixedNow };
      },
    });
    return {
      handler, metrics, client,
      setPrice(value) { currentPrice = value; },
      async call(action, body = {}, token = "alice", method = "POST") {
        const response = await handler(request(action, body, token, method));
        return { status: response.status, body: await response.json() };
      },
      async connect(token = "alice") {
        assert.equal((await this.call("connect_broker", { fundsAtProvider: true, apiKey: "test-api-key-not-real-1234", apiSecret: "test-secret-not-real-5678" }, token)).status, 200);
        assert.equal((await this.call("configure_live_trading", { enabled: true, maxLiveOrderUsd: 100, confirmation: "ENABLE_LIVE_SPOT" }, token)).status, 200);
      },
    };
  }
  const liveBody = { symbol: "BTC-USD", side: "buy", amount: 50, confirmation: "LIVE_ORDER_CONFIRMED", clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

  await t.test("RLS and privileges deny direct clients and RPC execution", async () => {
    await reset();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role};`);
      await assert.rejects(db.query("select * from public.varex_trading_profile"), /permission denied/);
      await assert.rejects(db.query("select public.varex_trading_provision($1,$2,$3,$4)", [aliceId, "alice@example.test", "Alice", fixedNow]), /permission denied/);
    }
    await db.exec("reset role; set role service_role;");
    const rls = await db.query("select relname, relrowsecurity from pg_class where relname in ('varex_trading_profile','varex_trading_invite','varex_trading_state','varex_trading_broker_connection','varex_trading_live_order')");
    assert.equal(rls.rows.length, 5);
    assert.ok(rls.rows.every((row) => row.relrowsecurity));
  });

  await t.test("verified identity controls ownership and editable metadata cannot grant developer", async () => {
    await reset();
    const app = harness({ users: { alice: user(aliceId, "alice@example.test", { user_metadata: { name: "Alice", role: "developer", user_id: ownerId } }) } });
    const bootstrap = await app.call("bootstrap", {}, "alice", "GET");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.body.profile.id, aliceId);
    assert.equal(bootstrap.body.profile.role, "trader");
    assert.equal((await app.call("users", {}, "alice", "GET")).status, 403);
    await app.call("save_preferences", { userId: bobId, selectedSymbol: "ETH-USD", role: "developer" });
    const rows = await db.query("select user_id,state_json from public.varex_trading_state");
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].user_id, aliceId);
    assert.equal(rows.rows[0].state_json.selectedSymbol, "ETH-USD");
  });

  await t.test("a viewer cannot trade or alter risk; inactive profiles cannot bootstrap", async () => {
    await reset();
    const app = harness();
    await app.call("bootstrap", {}, "alice", "GET");
    await db.query("update public.varex_trading_profile set role='viewer' where user_id=$1", [aliceId]);
    assert.equal((await app.call("open_trade", { side: "buy", amount: 50, symbol: "BTC-USD" })).status, 403);
    const result = await app.call("save_preferences", { risk: { riskPerTradePct: 5 }, settings: { compactMode: true } });
    assert.equal(result.body.state.risk.riskPerTradePct, 1);
    assert.equal(result.body.state.settings.compactMode, true);
    await db.query("update public.varex_trading_profile set status='inactive' where user_id=$1", [aliceId]);
    assert.equal((await app.call("bootstrap", {}, "alice", "GET")).status, 403);
  });

  await t.test("CAS conflict retries against fresh state without losing another update", async () => {
    await reset();
    let injected = false;
    const app = harness({ beforeRpc: async (name, args) => {
      if (name === "varex_trading_cas_state" && !injected) {
        injected = true;
        await db.query("update public.varex_trading_state set state_json=jsonb_set(state_json,'{settings,compactMode}','true'), version=version+1 where user_id=$1", [args.p_user_id]);
      }
    } });
    const result = await app.call("save_preferences", { selectedSymbol: "ETH-USD" });
    assert.equal(result.status, 200);
    assert.equal(result.body.version, 3);
    assert.equal(result.body.state.settings.compactMode, true);
    assert.equal(result.body.state.selectedSymbol, "ETH-USD");
    assert.equal(app.metrics.rpc.filter((call) => call.name.endsWith("cas_state")).length, 2);
  });

  await t.test("state and balance roll back together if the second SQL update fails", async () => {
    await reset();
    const app = harness();
    const initial = await app.call("bootstrap", {}, "alice", "GET");
    await db.exec("reset role; create function public.varex_test_fail_balance() returns trigger language plpgsql as $$ begin if new.paper_balance_cents <> old.paper_balance_cents then raise exception 'injected balance failure'; end if; return new; end; $$; create trigger varex_test_fail_balance before update on public.varex_trading_profile for each row execute function public.varex_test_fail_balance(); set role service_role;");
    const changed = { ...initial.body.state, balanceCents: 2499900 };
    await assert.rejects(db.query("select public.varex_trading_cas_state($1,$2,$3,$4,$5)", [aliceId, 1, JSON.stringify(changed), true, fixedNow]));
    const state = await db.query("select version,state_json from public.varex_trading_state where user_id=$1", [aliceId]);
    const profile = await db.query("select paper_balance_cents from public.varex_trading_profile where user_id=$1", [aliceId]);
    assert.equal(state.rows[0].version, 1);
    assert.equal(state.rows[0].state_json.balanceCents, 2500000);
    assert.equal(Number(profile.rows[0].paper_balance_cents), 2500000);
    await db.exec("reset role; drop trigger varex_test_fail_balance on public.varex_trading_profile; drop function public.varex_test_fail_balance(); set role service_role;");
  });

  await t.test("revocation between request authentication and CAS prevents trading", async () => {
    await reset();
    const app = harness({ beforeRpc: async (name, args) => {
      if (name.endsWith("cas_state")) await db.query("update public.varex_trading_profile set status='inactive' where user_id=$1", [args.p_user_id]);
    } });
    assert.equal((await app.call("open_trade", { symbol: "BTC-USD", side: "buy", amount: 100 })).status, 403);
    const state = await db.query("select state_json from public.varex_trading_state where user_id=$1", [aliceId]);
    assert.equal(state.rows[0].state_json.trades.length, 0);
  });

  await t.test("a risk save in flight cannot commit after the trader becomes a viewer", async () => {
    await reset();
    const app = harness({ beforeRpc: async (name, args) => {
      if (name.endsWith("cas_state")) {
        assert.equal(args.p_require_trade, true);
        await db.query("update public.varex_trading_profile set role='viewer' where user_id=$1", [args.p_user_id]);
      }
    } });
    assert.equal((await app.call("save_preferences", { risk: { riskPerTradePct: 5 } })).status, 403);
    const state = await db.query("select state_json from public.varex_trading_state where user_id=$1", [aliceId]);
    assert.equal(state.rows[0].state_json.risk.riskPerTradePct, 1);
  });

  await t.test("paper open, close, report state, and reset persist without touching broker execution", async () => {
    await reset();
    const app = harness();
    const opened = await app.call("open_trade", { symbol: "BTC-USD", side: "buy", amount: 100 });
    assert.equal(opened.status, 200);
    app.setPrice(110);
    const closed = await app.call("close_trade", { tradeId: opened.body.state.trades[0].id });
    assert.equal(closed.body.state.trades[0].pnl, 10);
    assert.equal(closed.body.state.balanceCents, 2501000);
    assert.equal((await app.call("close_trade", { tradeId: opened.body.state.trades[0].id })).status, 404);
    const resetState = await app.call("reset_paper");
    assert.equal(resetState.body.state.balanceCents, 2500000);
    assert.equal(resetState.body.state.trades.length, 0);
    assert.equal(app.metrics.orders, 0);
  });

  await t.test("fresh market refresh settles a PAPER stop once at the observed market price", async () => {
    await reset();
    const app = harness();
    await app.call("open_trade", { symbol: "BTC-USD", side: "buy", amount: 100 });
    app.setPrice(90);
    const stopped = await app.call("markets", {}, "alice", "GET");
    assert.equal(stopped.status, 200);
    assert.equal(stopped.body.state.trades[0].status, "closed");
    assert.equal(stopped.body.state.trades[0].exitPrice, 90);
    assert.equal(stopped.body.state.balanceCents, 2499000);
    assert.equal(stopped.body.paperStopCheck.mode, "on-refresh");
    const again = await app.call("bootstrap", {}, "alice", "GET");
    assert.equal(again.body.state.balanceCents, 2499000);
    assert.equal(again.body.version, stopped.body.version);
    assert.equal(app.metrics.orders, 0);
  });

  await t.test("history retention keeps older open trades and every current-day loss for risk enforcement", async () => {
    await reset();
    const app = harness();
    const initial = await app.call("bootstrap", {}, "alice", "GET");
    const oldClosed = Array.from({ length: 501 }, (_, index) => ({ id: `old-${index}`, status: "closed", closedAt: "2026-10-29T12:00:00Z", pnl: 0 }));
    const todayClosed = Array.from({ length: 501 }, (_, index) => ({ id: `today-${index}`, status: "closed", closedAt: "2026-10-30T11:00:00Z", pnl: -3 }));
    const oldOpen = { id: "older-open", status: "open", symbol: "BTC-USD", side: "buy", entryPrice: 100, stopPrice: 80, amount: 100, openedAt: "2026-10-01T00:00:00Z" };
    const state = { ...initial.body.state, trades: [...oldClosed, ...todayClosed, oldOpen] };
    await db.query("update public.varex_trading_state set state_json=$2 where user_id=$1", [aliceId, JSON.stringify(state)]);
    const saved = await app.call("save_preferences", { settings: { compactMode: true } });
    assert.equal(saved.body.state.trades.filter((trade) => trade.id.startsWith("old-")).length, 500);
    assert.equal(saved.body.state.trades.filter((trade) => trade.id.startsWith("today-")).length, 501);
    assert.ok(saved.body.state.trades.some((trade) => trade.id === "older-open"));
    assert.equal((await app.call("open_trade", { symbol: "BTC-USD", side: "buy", amount: 100 })).status, 409);
  });

  await t.test("stop CAS retry does not apply an older quote to a trade opened after the snapshot", async () => {
    await reset();
    let inject = false;
    let injected = false;
    const app = harness({ beforeRpc: async (name, args) => {
      if (inject && !injected && name.endsWith("cas_state")) {
        injected = true;
        const current = (await db.query("select state_json from public.varex_trading_state where user_id=$1", [args.p_user_id])).rows[0].state_json;
        current.trades.unshift({ id: "opened-after-quote", status: "open", symbol: "BTC-USD", side: "buy", entryPrice: 100, stopPrice: 95, amount: 100, openedAt: new Date(fixedNow + 1000).toISOString() });
        await db.query("update public.varex_trading_state set state_json=$2,version=version+1 where user_id=$1", [args.p_user_id, JSON.stringify(current)]);
      }
    } });
    await app.call("open_trade", { symbol: "BTC-USD", side: "buy", amount: 100 });
    app.setPrice(90);
    inject = true;
    const result = await app.call("markets", {}, "alice", "GET");
    assert.equal(result.status, 200);
    assert.equal(result.body.state.trades.find((trade) => trade.id === "opened-after-quote").status, "open");
    assert.equal(result.body.state.trades.filter((trade) => trade.status === "closed").length, 1);
    assert.equal(result.body.state.balanceCents, 2499000);
  });

  await t.test("missing encryption configuration truthfully disables broker UI and operations", async () => {
    await reset();
    const app = harness({ environment: { TRADING_CREDENTIAL_KEY: "" } });
    const bootstrap = await app.call("bootstrap", {}, "alice", "GET");
    assert.equal(bootstrap.body.broker.available, false);
    assert.equal(bootstrap.body.broker.liveTradingEnabled, false);
    assert.equal(bootstrap.body.profile.canConnectBroker, false);
    assert.ok(bootstrap.body.broker.error);
    assert.equal((await app.call("connect_broker", { fundsAtProvider: true })).status, 503);
    assert.equal(app.metrics.validation, 0);
    assert.equal(app.metrics.orders, 0);
  });

  await t.test("broker connection starts disabled, hides encrypted material, and requires manual confirmation", async () => {
    await reset();
    const app = harness();
    const connected = await app.call("connect_broker", { fundsAtProvider: true, apiKey: "test-api-key-not-real-1234", apiSecret: "test-secret-not-real-5678" });
    assert.equal(connected.status, 200);
    assert.equal(connected.body.broker.liveTradingEnabled, false);
    assert.equal(JSON.stringify(connected.body).includes("encrypted-fixture"), false);
    assert.equal((await app.call("place_live_order", liveBody)).status, 409);
    assert.equal((await app.call("configure_live_trading", { enabled: true, maxLiveOrderUsd: 100 })).status, 400);
    await app.connect();
    assert.equal((await app.call("place_live_order", { ...liveBody, confirmation: "" })).status, 400);
    assert.equal(app.metrics.orders, 0);
  });

  await t.test("live enable in flight cannot reverse an administrative downgrade", async () => {
    await reset();
    const app = harness({ beforeRpc: async (name, args) => {
      if (name.endsWith("enable_live")) await db.query("update public.varex_trading_profile set role='viewer' where user_id=$1", [args.p_user_id]);
    } });
    await app.call("connect_broker", { fundsAtProvider: true, apiKey: "test-api-key-not-real-1234", apiSecret: "test-secret-not-real-5678" });
    assert.equal((await app.call("configure_live_trading", { enabled: true, maxLiveOrderUsd: 100, confirmation: "ENABLE_LIVE_SPOT" })).status, 403);
    const connection = await db.query("select live_trading_enabled from public.varex_trading_broker_connection where user_id=$1", [aliceId]);
    assert.equal(connection.rows[0].live_trading_enabled, false);
    assert.equal(app.metrics.orders, 0);
  });

  await t.test("live request is reserved once; completed replay and parameter mismatch never re-send", async () => {
    await reset();
    const app = harness();
    await app.connect();
    const first = await app.call("place_live_order", liveBody);
    assert.equal(first.status, 200);
    const duplicate = await app.call("place_live_order", liveBody);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(duplicate.body.order.clientOrderId, first.body.order.clientOrderId);
    assert.equal((await app.call("place_live_order", { ...liveBody, amount: 75 })).status, 409);
    assert.equal(app.metrics.orders, 1);
  });

  await t.test("simultaneous duplicate while the provider is pending cannot reach the provider twice", async () => {
    await reset();
    let started;
    const didStart = new Promise((resolve) => { started = resolve; });
    let finish;
    const app = harness({ placeOrder: async (input) => { started(); return await new Promise((resolve) => { finish = () => resolve({ providerOrderId: "12345", clientOrderId: input.clientOrderId, status: "FILLED", executedQuantity: "1", executedQuoteAmount: "50" }); }); } });
    await app.connect();
    const first = app.call("place_live_order", liveBody);
    await didStart;
    const duplicate = await app.call("place_live_order", liveBody);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.executionUncertain, true);
    finish();
    assert.equal((await first).status, 200);
    assert.equal(app.metrics.orders, 1);
  });

  await t.test("equal client IDs from separate users create independent provider IDs and isolated histories", async () => {
    await reset();
    const app = harness();
    await app.connect("alice");
    await app.connect("bob");
    const first = await app.call("place_live_order", liveBody, "alice");
    const second = await app.call("place_live_order", liveBody, "bob");
    assert.notEqual(first.body.order.clientOrderId, second.body.order.clientOrderId);
    const bootstrap = await app.call("bootstrap", {}, "alice", "GET");
    assert.equal(bootstrap.body.broker.orders.length, 1);
    assert.equal(bootstrap.body.broker.orders[0].id, first.body.order.id);
  });

  await t.test("uncertain provider outcome is retained and cannot be repeated using the same request ID", async () => {
    await reset();
    const app = harness({ placeOrder: async () => { throw new TradingBrokerError(502, "mock timeout", true); } });
    await app.connect();
    const result = await app.call("place_live_order", liveBody);
    assert.equal(result.status, 502);
    assert.equal(result.body.executionUncertain, true);
    const repeat = await app.call("place_live_order", liveBody);
    assert.equal(repeat.status, 409);
    assert.equal(repeat.body.order.status, "unknown");
    assert.equal(app.metrics.orders, 1);
  });

  await t.test("database failure after provider success is uncertain, never rejected or re-sent", async () => {
    await reset();
    const app = harness({ queryFailure: (query) => query.table === "varex_trading_live_order" && query.operation === "update" && query.values.status === "filled" });
    await app.connect();
    const result = await app.call("place_live_order", liveBody);
    assert.equal(result.status, 502);
    assert.equal(result.body.executionUncertain, true);
    const repeated = await app.call("place_live_order", liveBody);
    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.order.status, "unknown");
    assert.equal(app.metrics.orders, 1);
  });

  await t.test("owner administration provisions viewer role, revokes access, and disables live mode atomically", async () => {
    await reset();
    const app = harness();
    const invited = await app.call("invite_user", { email: "alice@example.test", displayName: "Alice", role: "viewer" }, "owner");
    assert.equal(invited.status, 200);
    assert.equal((await app.call("bootstrap", {}, "alice", "GET")).body.profile.role, "viewer");
    await app.call("update_user", { email: "alice@example.test", displayName: "Alice", role: "trader", status: "active" }, "owner");
    await app.connect();
    const revoked = await app.call("update_user", { email: "alice@example.test", displayName: "Alice", role: "viewer", status: "inactive" }, "owner");
    assert.equal(revoked.status, 200);
    assert.equal((await app.call("bootstrap", {}, "alice", "GET")).status, 403);
    const broker = await db.query("select live_trading_enabled from public.varex_trading_broker_connection where user_id=$1", [aliceId]);
    assert.equal(broker.rows[0].live_trading_enabled, false);
  });

  await t.test("revoked invitations remain visible and can be reactivated before registration", async () => {
    await reset();
    const app = harness();
    await app.call("invite_user", { email: "bob@example.test", displayName: "Bob", role: "viewer" }, "owner");
    const revoked = await app.call("update_user", { email: "bob@example.test", displayName: "Bob", role: "viewer", status: "inactive" }, "owner");
    const row = revoked.body.users.find((item) => item.email === "bob@example.test");
    assert.equal(row.status, "inactive");
    assert.equal(row.pending, false);
    assert.equal((await app.call("bootstrap", {}, "bob", "GET")).status, 403);
    const restored = await app.call("update_user", { email: "bob@example.test", displayName: "Bob", role: "viewer", status: "active" }, "owner");
    assert.equal(restored.body.users.find((item) => item.email === "bob@example.test").pending, true);
    assert.equal((await app.call("bootstrap", {}, "bob", "GET")).body.profile.role, "viewer");
  });
});
