import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const api = new URL("../../supabase/functions/varex-trading-api/", import.meta.url);
const hooks = registerHooks({ load(url, context, next) {
  if (url.startsWith(api.href) && url.endsWith(".ts")) return { format: "module", shortCircuit: true,
    source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "transform", sourceUrl: url }) };
  return next(url, context);
} });
const { capitalCredentials, capitalSecret, capitalCredentialsFromSecret, validateCapitalConnection } = await import(new URL("trading-capital.ts", api));
const broker = await import(new URL("trading-broker.ts", api));
const market = await import(new URL("trading-market.ts", api));
hooks.deregister();
const fixture = { apiKey: "capital-key-fixture-only-1234", identifier: "test@example.test", apiPassword: " custom API password " };
const account = { accountId: "account-fixture", accountName: "Demo USD", status: "ENABLED", accountType: "CFD", currency: "USD",
  balance: { balance: 1100, deposit: 1000, profitLoss: 100, available: 750 } };
const position = { position: { dealId: "position-fixture", direction: "BUY", size: 10, level: 2.764, currency: "USD", upl: -0.05, createdDateUTC: "2026-10-30T12:00:00.000" },
  market: { epic: "NATURALGAS", instrumentName: "Natural Gas" } };

async function withProvider(options, run) {
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input); calls.push({ url, init });
    if (options.failure) return Response.json({ errorCode: "upstream message with secret " + fixture.apiPassword }, { status: options.failure });
    if (init.method === "POST" && url.pathname === "/api/v1/session") return Response.json({ currentAccountId: options.sessionAccount || account.accountId }, {
      headers: options.noHeaders ? {} : { CST: "fixture-cst", "X-SECURITY-TOKEN": "fixture-security-token" },
    });
    assert.equal(init.method, "GET", "no provider mutation is allowed after session creation");
    assert.equal(init.headers.CST, "fixture-cst");
    assert.equal(init.headers["X-SECURITY-TOKEN"], "fixture-security-token");
    if (url.pathname === "/api/v1/accounts") return Response.json({ accounts: options.accounts || [account] });
    if (url.pathname === "/api/v1/positions") return Response.json({ positions: options.positions || [position] });
    if (url.pathname === "/api/v1/session") return Response.json({ accountId: options.finalAccount || account.accountId });
    throw new Error("Unexpected provider route: " + url.pathname);
  };
  try { await run(calls); } finally { globalThis.fetch = previous; }
}

test("Capital adapter mirrors Edge and legacy code without credential or execution drift", () => {
  const edge = readFileSync(new URL("trading-capital.ts", api), "utf8");
  const legacy = readFileSync(new URL("../backend/lib/trading-capital.ts", import.meta.url), "utf8");
  assert.equal(legacy, edge.replace('from "./trading-broker.ts"', 'from "@/lib/trading-broker"'));
});

test("Capital defaults to demo and sends only session creation and account monitoring requests", async () => {
  await withProvider({}, async (calls) => {
    const credentials = capitalCredentials(fixture);
    assert.equal(credentials.environment, "demo");
    const summary = await validateCapitalConnection(credentials);
    assert.deepEqual(calls.map(({ url, init }) => `${init.method} ${url.pathname}`), ["POST /api/v1/session", "GET /api/v1/accounts", "GET /api/v1/positions", "GET /api/v1/session"]);
    for (const { url, init } of calls) {
      assert.equal(url.origin, "https://demo-api-capital.backend-capital.com");
      assert.equal(url.search, "");
      assert.equal(init.redirect, "error");
      assert.equal(init.credentials, "omit");
    }
    assert.deepEqual(JSON.parse(calls[0].init.body), { identifier: fixture.identifier, password: fixture.apiPassword, encryptedPassword: false });
    assert.equal(calls[0].init.headers["X-CAP-API-KEY"], fixture.apiKey);
    assert.equal(summary.accountId, account.accountId);
    assert.deepEqual(summary.accountBalance, account.balance);
    assert.equal(summary.readOnly, true);
    assert.equal(summary.executionSupported, false);
    assert.equal(summary.canTrade, false);
    assert.equal(summary.positions[0].profitLoss, -0.05);
    assert.equal(summary.positions[0].createdAt, "2026-10-30T12:00:00.000Z");
    for (const hidden of [fixture.identifier, fixture.apiKey, fixture.apiPassword, "fixture-cst", "fixture-security-token"]) assert.ok(!JSON.stringify(summary).includes(hidden));
    assert.equal(summary.permissions, undefined, "do not invent read-only key privileges");
  });
});

test("explicit Capital live environment selects only the official live origin", async () => {
  await withProvider({ positions: [] }, async (calls) => {
    const summary = await validateCapitalConnection(capitalCredentials({ ...fixture, environment: "live" }));
    assert.equal(summary.environment, "live");
    assert.equal(summary.executionSupported, false);
    assert.equal(calls.every(({ url }) => url.origin === "https://api-capital.backend-capital.com"), true);
  });
});

test("invalid Capital credential input never reaches a provider", async () => {
  await withProvider({}, async (calls) => {
    for (const changed of [{ environment: "https://untrusted.test" }, { environment: null }, { apiKey: {} }, { apiPassword: "" }, { identifier: "x\n@example.test" }]) {
      assert.throws(() => capitalCredentials({ ...fixture, ...changed }), (error) => error.status === 400);
    }
    await assert.rejects(validateCapitalConnection({ ...fixture, environment: "__proto__" }), (error) => error.status === 400);
    assert.equal(calls.length, 0);
  });
});

test("Capital encrypted credential envelope pins environment, provider, and account identity", () => {
  const credentials = capitalCredentials(fixture);
  const saved = capitalSecret(credentials, account.accountId);
  assert.deepEqual(capitalCredentialsFromSecret(credentials.apiKey, saved), { ...credentials, accountId: account.accountId });
  for (const secret of ["not-json", "{}", saved.replace('"capital"', '"binance"'), saved.replace('"demo"', '"other"'), saved.replace(account.accountId, "")]) {
    assert.throws(() => capitalCredentialsFromSecret(credentials.apiKey, secret), (error) => error.status === 503);
  }
});

test("Capital account pin and enabled status reject mismatch before positions are read", async () => {
  for (const options of [{ sessionAccount: "different-account" }, { accounts: [{ ...account, status: "SUSPENDED" }] }, { noHeaders: true }, { accounts: [account, account] }]) {
    await withProvider(options, async (calls) => {
      await assert.rejects(validateCapitalConnection({ ...capitalCredentials(fixture), accountId: account.accountId }), (error) => [409, 502].includes(error.status));
      assert.ok(!calls.some(({ url }) => url.pathname === "/api/v1/positions"));
      assert.ok(calls.every(({ init, url }) => init.method === "GET" || url.pathname === "/api/v1/session"));
    });
  }
});

test("Capital active account changes and malformed balances/positions never produce a partial valid snapshot", async () => {
  for (const options of [{ finalAccount: "switched-account" }, { accounts: [{ ...account, balance: { ...account.balance, available: null } }] }, { positions: [{ ...position, position: { ...position.position, direction: "INVALID" } }] }]) {
    await withProvider(options, async () => {
      await assert.rejects(validateCapitalConnection(capitalCredentials(fixture)), (error) => [409, 502].includes(error.status));
    });
  }
});

test("Capital upstream failures are sanitized and cannot disclose credentials", async () => {
  for (const status of [401, 429, 503]) {
    await withProvider({ failure: status }, async (calls) => {
      await assert.rejects(validateCapitalConnection(capitalCredentials(fixture)), (error) => {
        assert.equal(error.status, status === 401 ? 400 : status === 503 ? 502 : 429);
        assert.ok(!error.message.includes(fixture.apiPassword));
        assert.equal(error.uncertain, false);
        return true;
      });
      assert.equal(calls.length, 1);
    });
  }
});

test("legacy D1 routes use actual SQL for Capital storage, refresh, execution refusal, and confirmed replacement", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec('CREATE TABLE "user" (id text primary key, email text); INSERT INTO "user" VALUES (\'offline-user\',\'trader@example.test\');');
  for (const file of ["0005_trading_schema.sql", "0006_flippant_shatterstar.sql"]) db.exec(readFileSync(new URL("../backend/drizzle/" + file, import.meta.url), "utf8"));
  db.exec("INSERT INTO trading_profile VALUES ('offline-user','Offline Trader','trader','active',2500000,1,1);");
  const metrics = { capital: 0, binance: 0, orders: 0, credentials: [] };
  const environment = { TRADING_CREDENTIAL_KEY: Buffer.alloc(32, 7).toString("base64"), DB: {
    prepare(sql) {
      const stmt = db.prepare(sql); let parameters = [];
      return { bind(...values) { parameters = values; return this; },
        async first() { return stmt.get(...parameters) || null; },
        async all() { return { results: stmt.all(...parameters) }; },
        async run() { return { success: true, meta: { changes: Number(stmt.run(...parameters).changes) } }; } };
    }, async batch(statements) { const results = []; for (const stmt of statements) results.push(await stmt.run()); return results; },
  } };
  const source = stripTypeScriptTypes(readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8"), { mode: "transform" })
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm, "")
    .replace(/\bexport\s+(?=(async function|function|class|const)) /g, "")
    .replace(/\bexport\s+/g, "")
    .replace(/async function runtime\(\) \{[\s\S]*?\n\}/, "async function runtime() { return environment; }");
  const dependencies = {
    environment,
    getCashierAuth: async () => ({ api: { getSession: async () => ({ user: { id: "offline-user", email: "trader@example.test", emailVerified: true } }) } }),
    ...broker, ...market, capitalCredentials, capitalSecret, capitalCredentialsFromSecret,
    validateCapitalConnection: async (credentials) => {
      metrics.capital += 1; metrics.credentials.push(credentials);
      return { provider: "capital", environment: credentials.environment, accountId: account.accountId, accountName: account.accountName,
        currency: "USD", accountType: "CFD", accountBalance: account.balance, positions: [], canTrade: false, executionSupported: false, readOnly: true };
    },
    validateBinanceConnection: async () => { metrics.binance += 1; return { provider: "binance", canTrade: true, accountType: "SPOT", permissions: {}, availableUsdt: 100, balances: [] }; },
    placeBinanceMarketOrder: async () => { metrics.orders += 1; throw new Error("No order may be sent in this test"); },
  };
  const handler = new Function(...Object.keys(dependencies), source + "\nreturn tradingRequest;")(...Object.values(dependencies));
  const call = async (action, body = {}, method = "POST") => {
    const response = await handler(new Request("https://local.test/api/trading" + (method === "GET" ? "?action=" + action : ""), { method,
      ...(method === "POST" ? { body: JSON.stringify({ action, ...body }), headers: { "content-type": "application/json" } } : {}) }));
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call("access", {}, "GET")).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS n FROM trading_state").get().n, 0);
    const connected = await call("connect_broker", { ...fixture, provider: "capital", fundsAtProvider: true });
    assert.equal(connected.status, 200);
    assert.equal(connected.body.broker.environment, "demo");
    assert.equal(connected.body.broker.liveTradingEnabled, false);
    assert.equal(connected.body.broker.readOnly, true);
    assert.equal((await call("refresh_broker", { environment: "live", accountId: "other" })).status, 200);
    assert.equal(metrics.credentials[1].accountId, account.accountId);
    assert.equal(metrics.credentials[1].environment, "demo");
    assert.equal(metrics.credentials[1].apiPassword, fixture.apiPassword);
    for (const enabled of [true, false]) assert.equal((await call("configure_live_trading", { enabled, confirmation: "ENABLE_LIVE_SPOT", maxLiveOrderUsd: 100 })).status, 409);
    assert.equal((await call("place_live_order", { symbol: "BTC-USD", confirmation: "LIVE_ORDER_CONFIRMED", amount: 50, side: "buy" })).status, 409);
    assert.equal(metrics.orders, 0);
    assert.equal(metrics.binance, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM trading_live_order").get().n, 0);
    const binanceBody = { fundsAtProvider: true, apiKey: "test-binance-key-fixture", apiSecret: "test-binance-secret-fixture" };
    assert.equal((await call("connect_broker", binanceBody)).status, 409);
    const replaced = await call("connect_broker", { ...binanceBody, replacementConfirmation: "REPLACE_BROKER", expectedConnectionRevision: connected.body.broker.connectionRevision });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.body.broker.provider, "binance");
    assert.equal(replaced.body.broker.liveTradingEnabled, false);
    assert.notEqual(replaced.body.broker.connectionRevision, connected.body.broker.connectionRevision);
    assert.equal(metrics.binance, 1);
  } finally { db.close(); }
});
