import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL functions and row updates in a local, in-memory PGlite DB.
// No Supabase project, provider, credentials, or network requests are used.
const migration = (name) => readFileSync(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8");
const uid = (number) => "00000000-0000-4000-8000-" + String(number).padStart(12, "0");
const owner = uid(1), alice = uid(2), bob = uid(3), viewer = uid(4), inactive = uid(5);
const now = Date.parse("2026-10-30T12:00:00Z"), bar = now - 60_000;
const baseState = () => ({ balanceCents: 2_500_000, trades: [], analyses: [], watchlist: ["BTC-USD"], selectedSymbol: "BTC-USD",
  risk: { maxOpenTrades: 3, maxDailyLossPct: 5, riskPerTradePct: 1 }, settings: { notifications: true, timezone: "UTC", compactMode: false } });
const trade = (id, overrides = {}) => ({ id, symbol: "BTC-USD", side: "buy", amount: 100, quantity: 1, entryPrice: 100,
  exitPrice: null, stopPrice: 95, pnl: 0, status: "open", openedAt: new Date(now).toISOString(), closedAt: null, ...overrides });

test("demo automation migration, access boundaries, leases, and CAS are enforced by PostgreSQL", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key,email text not null); grant usage on schema public to anon,authenticated,service_role;");
  for (const file of ["20261030053731_varex_trading_standalone.sql", "20261030200032_varex_trading_capital_monitoring.sql", "20261030200301_varex_trading_demo_automation.sql"]) await db.exec(migration(file));

  async function rpc(name, args) {
    assert.match(name, /^varex_trading_[a-z_]+$/);
    const entries = Object.entries(args), values = entries.map(([, value]) => value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    const params = entries.map(([key], i) => { assert.match(key, /^p_[a-z_]+$/); return `${key}=>$${i + 1}`; });
    return (await db.query(`select public.${name}(${params.join(",")}) as result`, values)).rows[0].result;
  }
  async function reset(extra = 0) {
    await db.exec("reset role; truncate auth.users cascade;");
    for (let number = 1; number <= 5 + extra; number++) {
      const user = uid(number), email = number === 1 ? "areejalloush1988@gmail.com" : `trader${number}@example.test`;
      await db.query("insert into auth.users values($1,$2)", [user, email]);
      await db.query("insert into public.varex_trading_profile values($1,$2,'Offline Trader',$3,$4,2500000,$5,$5)", [user, email, number === 1 ? "developer" : number === 4 ? "viewer" : "trader", number === 5 ? "inactive" : "active", now]);
      await db.query("insert into public.varex_trading_state values($1,$2,1,$3,$3)", [user, JSON.stringify(baseState()), now]);
    }
    await db.exec("truncate public.varex_trading_bot_runtime;");
    await db.query("insert into public.varex_trading_bot_runtime(id,scheduler_secret_hash,scheduler_ready) values(1,$1,true)", ["a".repeat(64)]);
    await db.exec("set role service_role;");
  }
  const configureArgs = (user = alice, overrides = {}) => ({ p_user_id: user, p_enabled: true, p_symbol: "BTC-USD", p_interval: "15", p_risk_percent: 1, p_max_daily_trades: 5, p_expected_revision: 0, p_now: now, ...overrides });
  const configure = (user = alice, overrides = {}) => rpc("varex_trading_bot_configure", configureArgs(user, overrides));
  const claim = (at = now + 1, limit = 20) => rpc("varex_trading_bot_claim", { p_now: at, p_limit: limit });
  const completeArgs = (cfg, overrides = {}) => ({ p_user_id: cfg.user_id, p_lease_id: cfg.lease_id, p_revision: cfg.revision,
    p_expected_version: 1, p_state_json: null, p_last_bar_at: bar, p_signal: "wait", p_message: "Offline wait", p_model: null,
    p_events: [{ action: "wait", at: new Date(now).toISOString() }], p_now: now + 2, ...overrides });
  const complete = (cfg, overrides = {}) => rpc("varex_trading_bot_complete", completeArgs(cfg, overrides));
  const configRow = async (user = alice) => (await db.query("select * from public.varex_trading_bot_config where user_id=$1", [user])).rows[0];
  const stateRow = async (user = alice) => (await db.query("select * from public.varex_trading_state where user_id=$1", [user])).rows[0];
  const manualCas = (state, version = 1) => rpc("varex_trading_cas_state", { p_user_id: alice, p_expected_version: version, p_state_json: state, p_require_trade: true, p_now: now + 2 });

  await t.test("bot tables have RLS and no direct anon/authenticated grants or RPC execution", async () => {
    await reset();
    const tables = (await db.query("select relname,relrowsecurity from pg_class where relname in ('varex_trading_bot_config','varex_trading_bot_runtime')")).rows;
    assert.equal(tables.length, 2); assert.ok(tables.every((row) => row.relrowsecurity));
    const functions = (await db.query("select proname,prosecdef,proconfig from pg_proc where proname like 'varex_trading_bot_%'")).rows;
    assert.ok(functions.length >= 3); assert.ok(functions.every((row) => !row.prosecdef));
    assert.ok(functions.every((row) => row.proconfig?.includes('search_path=""')));
    for (const role of ["anon", "authenticated"]) {
      await db.exec("reset role; set role " + role);
      const execute = (await db.query("select proname,has_function_privilege(current_user,oid,'EXECUTE') as allowed from pg_proc where proname like 'varex_trading_bot_%'")).rows;
      assert.ok(execute.every((row) => !row.allowed), "RPC and revocation trigger functions are private");
      for (const table of ["varex_trading_bot_config", "varex_trading_bot_runtime"]) {
        await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
        await assert.rejects(db.query(`delete from public.${table}`), /permission denied/);
        const privileges = (await db.query("select has_table_privilege(current_user,$1,'INSERT') as ins,has_table_privilege(current_user,$1,'UPDATE') as upd", ["public." + table])).rows[0];
        assert.equal(privileges.ins, false); assert.equal(privileges.upd, false);
      }
      await assert.rejects(configure(), /permission denied/);
      await assert.rejects(claim(), /permission denied/);
      await assert.rejects(rpc("varex_trading_bot_complete", completeArgs({ user_id: alice, lease_id: crypto.randomUUID(), revision: 1 })), /permission denied/);
    }
    await db.exec("reset role; set role service_role;");
  });

  await t.test("configuration requires exact revision and an eligible role; a viewer may stop but cannot enable", async () => {
    await reset();
    assert.equal((await configure(alice, { p_expected_revision: 1 })).reason, "conflict");
    assert.equal(await configRow(), undefined);
    const first = await configure(); assert.equal(first.config.revision, 1); assert.equal(first.config.enabled, true);
    const before = await configRow();
    assert.equal((await configure(alice, { p_expected_revision: 0 })).reason, "conflict");
    assert.deepEqual(await configRow(), before);
    const second = await configure(alice, { p_expected_revision: 1, p_risk_percent: .5 });
    assert.equal(second.config.revision, 2); assert.equal(second.config.risk_percent, .5);
    assert.equal((await configure(viewer)).reason, "forbidden");
    assert.equal((await configure(inactive)).reason, "forbidden");
    assert.equal((await configure(owner)).config.enabled, true);
    assert.equal((await configure(viewer, { p_enabled: false })).config.enabled, false);
  });

  await t.test("nullable and invalid configuration inputs fail without creating or changing a config", async () => {
    await reset();
    for (const field of ["p_enabled", "p_symbol", "p_interval", "p_risk_percent", "p_max_daily_trades", "p_expected_revision", "p_now"]) {
      assert.equal((await configure(alice, { [field]: null })).reason, "invalid", field);
      assert.equal(await configRow(), undefined);
    }
    for (const patch of [{ p_symbol: "EURUSD" }, { p_interval: "1" }, { p_risk_percent: 3 }, { p_max_daily_trades: 21 }, { p_expected_revision: -1 }, { p_now: 0 }]) {
      assert.equal((await configure(alice, patch)).reason, "invalid");
      assert.equal(await configRow(), undefined);
    }
  });

  await t.test("overlapping claim requests lease each due user once, and expired leases get new identities", async () => {
    await reset(); await configure(); await configure(bob);
    const requests = await Promise.all([claim(), claim()]);
    const leases = requests.flat();
    assert.equal(leases.length, 2); assert.equal(new Set(leases.map((c) => c.user_id)).size, 2);
    assert.ok(leases.every((c) => c.lease_id && Number(c.lease_until) === now + 120001));
    assert.equal((await claim(now + 60_001)).length, 0);
    const reclaimed = await claim(now + 120_001);
    assert.equal(reclaimed.length, 2);
    for (const previous of leases) {
      assert.notEqual(reclaimed.find((c) => c.user_id === previous.user_id).lease_id, previous.lease_id);
      assert.equal((await complete(previous, { p_now: now + 120_002 })).reason, "cancelled");
    }
    assert.equal(Number((await db.query("select heartbeat_at from public.varex_trading_bot_runtime where id=1")).rows[0].heartbeat_at), now + 120_001);
  });

  await t.test("claim limits are capped, disabled/ineligible users stay unclaimed, and null timing cannot mutate runtime", async () => {
    await reset(23);
    for (let number = 1; number <= 28; number++) if (![4, 5].includes(number)) await configure(uid(number));
    await configure(bob, { p_expected_revision: 1, p_enabled: false });
    assert.deepEqual(await claim(null), []);
    assert.deepEqual(await claim(now + 1, null), []);
    assert.equal((await db.query("select heartbeat_at from public.varex_trading_bot_runtime")).rows[0].heartbeat_at, null);
    const first = await claim(now + 1, 100), second = await claim(now + 1, 100);
    assert.equal(first.length, 20); assert.equal(second.length, 5);
    assert.ok([...first, ...second].every((c) => ![viewer, inactive, bob].includes(c.user_id)));
  });

  await t.test("complete validates non-null claim identity and metadata, and expired claims cannot write", async () => {
    await reset(); await configure(); const [cfg] = await claim(); const original = await configRow();
    for (const field of ["p_lease_id", "p_revision", "p_expected_version", "p_last_bar_at", "p_signal", "p_events", "p_now"]) {
      const result = await complete(cfg, { [field]: null });
      assert.equal(result.saved, undefined); assert.ok(["invalid", "cancelled"].includes(result.reason), field);
      assert.deepEqual(await configRow(), original);
    }
    for (const patch of [{ p_lease_id: crypto.randomUUID() }, { p_revision: 2 }, { p_now: Number(cfg.lease_until) }]) {
      assert.equal((await complete(cfg, patch)).reason, "cancelled");
    }
    for (const patch of [{ p_signal: "live" }, { p_events: {} }, { p_events: Array(21).fill({}) }, { p_last_bar_at: -1 }]) {
      assert.equal((await complete(cfg, patch)).reason, "invalid");
    }
    assert.equal((await stateRow()).version, 1);
  });

  await t.test("manual CAS winning first is preserved and the bot can retry against the newer state", async () => {
    await reset(); await configure(); const [cfg] = await claim();
    const manual = baseState(); manual.trades.push(trade("manual-1"));
    assert.equal((await manualCas(manual)).saved, true);
    const stale = baseState(); stale.trades.push(trade("auto-stale"));
    const conflict = await complete(cfg, { p_state_json: stale, p_signal: "buy" });
    assert.equal(conflict.reason, "conflict"); assert.equal(conflict.saved, false);
    assert.deepEqual((await stateRow()).state_json, manual);
    assert.equal((await configRow()).lease_id, cfg.lease_id);
    assert.equal(Number((await configRow()).last_bar_at), 0);
    const merged = structuredClone(manual); merged.trades.push(trade("auto-fresh"));
    assert.equal((await complete(cfg, { p_expected_version: 2, p_state_json: merged, p_signal: "buy" })).saved, true);
    const saved = await stateRow(); assert.equal(saved.version, 3);
    assert.deepEqual(saved.state_json.trades.map((item) => item.id), ["manual-1", "auto-fresh"]);
  });

  await t.test("configuration stop/change cancels in-flight claims and restarts retain the processed bar", async () => {
    await reset(); await configure(); let [cfg] = await claim();
    assert.equal((await complete(cfg)).saved, true);
    [cfg] = await claim(now + 60_002);
    const stopped = await configure(alice, { p_enabled: false, p_expected_revision: cfg.revision, p_now: now + 60_003 });
    assert.equal(stopped.config.lease_id, null); assert.equal(Number(stopped.config.last_bar_at), bar);
    assert.equal((await complete(cfg, { p_now: now + 60_004 })).reason, "cancelled");
    const restarted = await configure(alice, { p_expected_revision: stopped.config.revision, p_now: now + 60_005 });
    assert.equal(Number(restarted.config.last_bar_at), bar);
    [cfg] = await claim(now + 60_006);
    const changed = await configure(alice, { p_expected_revision: cfg.revision, p_symbol: "ETH-USD", p_now: now + 60_007 });
    assert.equal(Number(changed.config.last_bar_at), 0); assert.equal(changed.config.lease_id, null);
    assert.equal((await complete(cfg, { p_now: now + 60_008 })).reason, "cancelled");
  });

  await t.test("role/status revocation disables automation, invalidates its lease, and cannot auto-resume on restoration", async () => {
    for (const change of [{ role: "viewer" }, { status: "inactive" }]) {
      await reset(); await configure(); const [cfg] = await claim();
      const [column, value] = Object.entries(change)[0];
      await db.query(`update public.varex_trading_profile set ${column}=$1,updated_at=$2 where user_id=$3`, [value, now + 2, alice]);
      assert.equal((await complete(cfg, { p_now: now + 3 })).reason, "forbidden");
      const stopped = await configRow(); assert.equal(stopped.enabled, false); assert.equal(stopped.lease_id, null);
      assert.equal(stopped.revision, cfg.revision + 1);
      await db.query("update public.varex_trading_profile set role='trader',status='active',updated_at=$1 where user_id=$2", [now + 4, alice]);
      assert.equal((await complete(cfg, { p_now: now + 5 })).reason, "cancelled");
      assert.deepEqual(await claim(now + 120_002), []);
      assert.equal((await configRow()).enabled, false);
      assert.equal((await stateRow()).version, 1);
    }
  });

  await t.test("processed-candle replay cannot add a new auto position but same-candle exits remain allowed", async () => {
    await reset(); await configure(); let [cfg] = await claim();
    const opened = baseState(); opened.trades.push(trade("auto-first"));
    assert.equal((await complete(cfg, { p_state_json: opened, p_signal: "buy" })).saved, true);
    [cfg] = await claim(now + 60_002); assert.equal(Number(cfg.last_bar_at), bar);
    const replay = structuredClone(opened); replay.trades.push(trade("auto-duplicate"));
    assert.equal((await complete(cfg, { p_expected_version: 2, p_state_json: replay, p_signal: "buy", p_now: now + 60_003 })).reason, "replay");
    assert.equal((await stateRow()).version, 2); assert.equal((await stateRow()).state_json.trades.length, 1);
    const closed = structuredClone(opened); closed.trades[0] = trade("auto-first", { status: "closed", exitPrice: 95, pnl: -5, closedAt: new Date(now + 60_003).toISOString() }); closed.balanceCents -= 500;
    assert.equal((await complete(cfg, { p_expected_version: 2, p_state_json: closed, p_events: [{ action: "close" }], p_now: now + 60_004 })).saved, true);
    assert.equal((await stateRow()).state_json.trades[0].status, "closed");
    assert.equal(Number((await db.query("select paper_balance_cents from public.varex_trading_profile where user_id=$1", [alice])).rows[0].paper_balance_cents), closed.balanceCents);
    [cfg] = await claim(now + 120_003);
    assert.equal((await complete(cfg, { p_expected_version: 3, p_state_json: opened, p_now: now + 120_004, p_signal: "buy" })).reason, "replay", "a closed ID cannot be reopened on the same candle");
    const next = structuredClone(closed); next.trades.push(trade("auto-next-bar"));
    assert.equal((await complete(cfg, { p_expected_version: 3, p_state_json: next, p_last_bar_at: bar + 60_000, p_now: now + 120_004, p_signal: "buy" })).saved, true);
  });

  await t.test("automation commits only demo state/config and leaves saved broker credentials and live orders unchanged", async () => {
    await reset();
    await db.query("insert into public.varex_trading_broker_connection(user_id,revision,provider,account_label,api_key_ciphertext,api_key_iv,api_secret_ciphertext,api_secret_iv,key_fingerprint,live_trading_enabled,created_at,updated_at) values($1,$2,'binance','Offline fixture','cipher-key','iv-key','cipher-secret','iv-secret','1234',true,$3,$3)", [alice, crypto.randomUUID(), now]);
    await db.query("insert into public.varex_trading_live_order(id,user_id,client_request_id,client_order_id,symbol,side,quote_amount_cents,status,requested_at,updated_at) values($1,$2,$3,$4,'BTC-USD','buy',5000,'filled',$5,$5)", [crypto.randomUUID(), alice, "b".repeat(32), "vx" + "b".repeat(32), now]);
    const beforeConnection = (await db.query("select * from public.varex_trading_broker_connection")).rows;
    const beforeOrders = (await db.query("select * from public.varex_trading_live_order")).rows;
    await configure(); const [cfg] = await claim(); const state = baseState(); state.trades.push(trade("auto-only-demo"));
    assert.equal((await complete(cfg, { p_state_json: state, p_signal: "buy" })).saved, true);
    await configure(alice, { p_expected_revision: 1, p_enabled: false });
    assert.deepEqual((await db.query("select * from public.varex_trading_broker_connection")).rows, beforeConnection);
    assert.deepEqual((await db.query("select * from public.varex_trading_live_order")).rows, beforeOrders);
  });

  await t.test("a failed state/profile commit rolls back bot metadata and event history with it", async () => {
    await reset(); await configure(); const [cfg] = await claim();
    const state = baseState(); state.balanceCents = 2_499_500; state.trades.push(trade("auto-rollback"));
    await db.exec("reset role; create function public.test_bot_profile_write_failure() returns trigger language plpgsql as $$begin raise exception 'offline injected profile failure'; end;$$; create trigger test_bot_profile_failure before update on public.varex_trading_profile for each row execute function public.test_bot_profile_write_failure(); set role service_role;");
    const before = await configRow();
    try {
      await assert.rejects(complete(cfg, { p_state_json: state }), /offline injected profile failure/);
      assert.equal((await stateRow()).version, 1); assert.deepEqual((await stateRow()).state_json, baseState());
      assert.deepEqual(await configRow(), before);
    } finally {
      await db.exec("reset role; drop trigger test_bot_profile_failure on public.varex_trading_profile; drop function public.test_bot_profile_write_failure(); set role service_role;");
    }
  });
});
