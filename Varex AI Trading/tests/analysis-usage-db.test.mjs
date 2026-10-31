import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Executes the actual optional setup script in local PostgreSQL/WASM. No live
// project, credentials, provider API or Supabase connection is involved.
const setupSql = readFileSync(new URL("../../supabase/setup/varex-analysis-usage.sql", import.meta.url), "utf8");
const uid = (number) => "00000000-0000-4000-8000-" + String(number).padStart(12, "0");
const alice = uid(1), bob = uid(2), carol = uid(3);
const table = "public.varex_analysis_daily_usage";
const claimSignature = "public.varex_analysis_claim_request(uuid,timestamp with time zone,integer,integer)";

test("analysis usage setup enforces service access, atomic caps and database-clock accounting", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create role varex_analysis_untrusted; grant usage on schema public to anon,authenticated,service_role,varex_analysis_untrusted;");
  await db.exec(setupSql);

  async function reset() {
    await db.exec("reset role; truncate public.varex_analysis_daily_usage; set role service_role;");
  }
  async function claim(user = alice, { now = null, userLimit = 20, globalLimit = 200 } = {}) {
    return (await db.query("select public.varex_analysis_claim_request($1::uuid,$2::timestamptz,$3::integer,$4::integer) as result", [user, now, userLimit, globalLimit])).rows[0].result;
  }
  async function ready() {
    return (await db.query("select public.varex_analysis_usage_ready() as ready")).rows[0].ready;
  }
  async function counters() {
    // The fixture obtains the quota date from the same database as the RPC.
    return (await db.query("select bucket_key,request_count from public.varex_analysis_daily_usage where bucket_day=(statement_timestamp() at time zone 'UTC')::date order by bucket_key")).rows;
  }

  await t.test("only service_role has table privileges and RPC execution; functions are invokers", async () => {
    await reset();
    assert.equal(await ready(), true);
    const metadata = (await db.query("select relrowsecurity from pg_class where oid='public.varex_analysis_daily_usage'::regclass")).rows[0];
    assert.equal(metadata.relrowsecurity, true);
    assert.equal((await db.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename='varex_analysis_daily_usage'")).rows[0].count, 0);
    const functions = (await db.query("select proname,prosecdef,proconfig from pg_proc where oid in ('public.varex_analysis_usage_ready()'::regprocedure,$1::regprocedure)", [claimSignature])).rows;
    assert.equal(functions.length, 2);
    assert.ok(functions.every((row) => row.prosecdef === false));
    assert.ok(functions.every((row) => row.proconfig.includes("search_path=pg_catalog, public")));
    for (const role of ["service_role", "anon", "authenticated", "varex_analysis_untrusted"]) {
      await db.exec("reset role; set role " + role);
      const expected = role === "service_role";
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal((await db.query("select has_table_privilege(current_user,$1,$2) as allowed", [table, privilege])).rows[0].allowed, expected, role + " " + privilege);
      }
      for (const signature of ["public.varex_analysis_usage_ready()", claimSignature]) {
        assert.equal((await db.query("select has_function_privilege(current_user,$1,'EXECUTE') as allowed", [signature])).rows[0].allowed, expected, role + " RPC");
      }
      if (!expected) {
        await assert.rejects(ready(), /permission denied/i);
        await assert.rejects(claim(), /permission denied/i);
        await assert.rejects(db.query("select * from public.varex_analysis_daily_usage"), /permission denied/i);
        await assert.rejects(db.query("delete from public.varex_analysis_daily_usage"), /permission denied/i);
      }
    }
  });

  await t.test("RLS keeps counters private even if a browser role accidentally receives table grants", async () => {
    await reset();
    await claim();
    await db.exec("reset role; grant select,insert,update,delete on public.varex_analysis_daily_usage to authenticated; set role authenticated;");
    try {
      assert.deepEqual((await db.query("select * from public.varex_analysis_daily_usage")).rows, []);
      await assert.rejects(db.query("insert into public.varex_analysis_daily_usage(bucket_day,bucket_key,request_count) values((statement_timestamp() at time zone 'UTC')::date,'user:'||$1,1)", [bob]), /row-level security|permission denied/i);
      assert.deepEqual((await db.query("update public.varex_analysis_daily_usage set request_count=0 returning bucket_key")).rows, []);
      assert.deepEqual((await db.query("delete from public.varex_analysis_daily_usage returning bucket_key")).rows, []);
    } finally {
      await db.exec("reset role; revoke all on public.varex_analysis_daily_usage from authenticated; set role service_role;");
    }
    assert.deepEqual(await counters(), [{ bucket_key: "global", request_count: 1 }, { bucket_key: "user:" + alice, request_count: 1 }]);
  });

  await t.test("per-user exhaustion does not consume global capacity or another user's allowance", async () => {
    await reset();
    assert.equal((await claim(alice, { userLimit: 2, globalLimit: 5 })).allowed, true);
    assert.equal((await claim(alice, { userLimit: 2, globalLimit: 5 })).allowed, true);
    const before = await counters();
    assert.deepEqual(await claim(alice, { userLimit: 2, globalLimit: 5 }), { allowed: false, reason: "daily_limit" });
    assert.deepEqual(await counters(), before);
    assert.equal((await claim(bob, { userLimit: 2, globalLimit: 5 })).allowed, true);
    assert.deepEqual(await counters(), [{ bucket_key: "global", request_count: 3 }, { bucket_key: "user:" + alice, request_count: 2 }, { bucket_key: "user:" + bob, request_count: 1 }]);
  });

  await t.test("the global ceiling blocks every user without creating extra rows", async () => {
    await reset();
    for (const user of [alice, bob, carol]) assert.equal((await claim(user, { userLimit: 2, globalLimit: 3 })).allowed, true);
    const before = await counters();
    for (const user of [alice, bob, uid(99)]) assert.equal((await claim(user, { userLimit: 2, globalLimit: 3 })).allowed, false);
    assert.deepEqual(await counters(), before);
  });

  await t.test("overlapping callers never exceed user or shared limits", async () => {
    await reset();
    // PGlite has one database connection and queues these overlapping requests;
    // this exercises the real transactional function, not a parallel-server
    // stress test. The SQL also holds a transaction-scoped advisory lock.
    const singleUser = await Promise.all(Array.from({ length: 12 }, () => claim(alice, { userLimit: 3, globalLimit: 20 })));
    assert.equal(singleUser.filter((result) => result.allowed).length, 3);
    assert.deepEqual(await counters(), [{ bucket_key: "global", request_count: 3 }, { bucket_key: "user:" + alice, request_count: 3 }]);
    await reset();
    const shared = await Promise.all(Array.from({ length: 15 }, (_, index) => claim(uid(index + 1), { userLimit: 2, globalLimit: 5 })));
    assert.equal(shared.filter((result) => result.allowed).length, 5);
    const rows = await counters();
    assert.equal(rows.find((row) => row.bucket_key === "global").request_count, 5);
    assert.equal(rows.filter((row) => row.bucket_key.startsWith("user:")).reduce((sum, row) => sum + row.request_count, 0), 5);
  });

  await t.test("default caps and validation reject attempts to raise the server budget", async () => {
    await reset();
    for (const input of [{ userLimit: null }, { globalLimit: null }, { userLimit: 0 }, { userLimit: 21 }, { globalLimit: -1 }, { globalLimit: 201 }]) {
      await assert.rejects(claim(alice, input), /invalid analysis usage parameters/);
    }
    await assert.rejects(claim(null), /invalid analysis usage parameters/);
    assert.deepEqual(await counters(), []);
    for (let index = 0; index < 20; index++) {
      assert.equal((await db.query("select public.varex_analysis_claim_request($1::uuid) as result", [alice])).rows[0].result.allowed, true);
    }
    assert.equal((await db.query("select public.varex_analysis_claim_request($1::uuid) as result", [alice])).rows[0].result.allowed, false);
    assert.equal((await counters()).find((row) => row.bucket_key === "global").request_count, 20);
  });

  await t.test("UTC day reset uses database fixtures; supplied past/future clocks cannot reset a limit", async () => {
    await reset();
    await db.query("insert into public.varex_analysis_daily_usage(bucket_day,bucket_key,request_count) select (statement_timestamp() at time zone 'UTC')::date-1, key, 20 from unnest(array['global','user:'||$1]) as key", [alice]);
    assert.equal((await claim(alice, { now: "1900-01-01T00:00:00Z", userLimit: 1, globalLimit: 2 })).allowed, true);
    assert.equal((await claim(alice, { now: "2999-01-01T00:00:00Z", userLimit: 1, globalLimit: 2 })).allowed, false);
    assert.equal((await claim(alice, { now: null, userLimit: 1, globalLimit: 2 })).allowed, false);
    assert.deepEqual(await counters(), [{ bucket_key: "global", request_count: 1 }, { bucket_key: "user:" + alice, request_count: 1 }]);
    const days = (await db.query("select count(distinct bucket_day)::integer as count, bool_and(bucket_day in ((statement_timestamp() at time zone 'UTC')::date,(statement_timestamp() at time zone 'UTC')::date-1)) as real_days from public.varex_analysis_daily_usage")).rows[0];
    assert.equal(days.count, 2); assert.equal(days.real_days, true);
    // Move the exhausted day to yesterday as a fixture for the next DB day.
    await db.exec("delete from public.varex_analysis_daily_usage where bucket_day<(statement_timestamp() at time zone 'UTC')::date; update public.varex_analysis_daily_usage set bucket_day=bucket_day-1;");
    assert.equal((await claim(alice, { userLimit: 1, globalLimit: 2 })).allowed, true);
    assert.equal((await counters()).find((row) => row.bucket_key === "global").request_count, 1);
  });

  await t.test("retention deletes old counters and a failed claim transaction cannot half-increment", async () => {
    await reset();
    await db.exec("insert into public.varex_analysis_daily_usage(bucket_day,bucket_key,request_count) values((statement_timestamp() at time zone 'UTC')::date-32,'global',7),((statement_timestamp() at time zone 'UTC')::date-31,'global',8);");
    await claim();
    const rows = (await db.query("select ((statement_timestamp() at time zone 'UTC')::date-bucket_day)::integer as age from public.varex_analysis_daily_usage order by age")).rows;
    assert.deepEqual(rows.map((row) => row.age), [0, 0, 31]);
    const before = await counters();
    await db.exec("reset role; alter table public.varex_analysis_daily_usage add constraint fixture_reject_bob check(bucket_key<>'user:00000000-0000-4000-8000-000000000002'); set role service_role;");
    try { await assert.rejects(claim(bob), /fixture_reject_bob/); }
    finally { await db.exec("reset role; alter table public.varex_analysis_daily_usage drop constraint fixture_reject_bob; set role service_role;"); }
    assert.deepEqual(await counters(), before, "global and user increments are one atomic statement/transaction");
  });

  await t.test("readiness fails closed when any required grant, RLS or the claim function is absent", async () => {
    await reset();
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      await db.exec("reset role; revoke " + privilege + " on public.varex_analysis_daily_usage from service_role; set role service_role;");
      assert.equal(await ready(), false, privilege + " must be required independently");
      await db.exec("reset role; grant " + privilege + " on public.varex_analysis_daily_usage to service_role; set role service_role;");
      assert.equal(await ready(), true);
    }
    await db.exec("reset role; revoke execute on function " + claimSignature + " from service_role; set role service_role;");
    assert.equal(await ready(), false);
    await db.exec("reset role; grant execute on function " + claimSignature + " to service_role; alter table public.varex_analysis_daily_usage disable row level security; set role service_role;");
    assert.equal(await ready(), false);
    await db.exec("reset role; alter table public.varex_analysis_daily_usage enable row level security; drop function " + claimSignature + "; set role service_role;");
    assert.equal(await ready(), false);
    await db.exec("reset role;");
    await db.exec(setupSql);
    await db.exec("set role service_role;");
    assert.equal(await ready(), true, "rerunning reviewed setup restores the required contract");
  });
});
