import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../backend/lib/trading-access.ts", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../backend/lib/trading-market.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../backend/drizzle/0005_trading_schema.sql", import.meta.url), "utf8");

test("includes all VAREX AI Trading workspaces", () => {
  for (const view of ["dashboard", "intelligence", "trades", "risk", "watchlist", "reports", "users", "settings"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
  assert.doesNotMatch(html, /أريج/);
  assert.match(client, /profile\.displayName/);
});

test("persists paper trading and uses live primary market data", () => {
  assert.match(access, /mode: "paper"/);
  assert.match(access, /UPDATE trading_state SET state_json/);
  assert.match(market, /api\.exchange\.coinbase\.com/);
  assert.match(migration, /CREATE TABLE `trading_profile`/);
  assert.match(migration, /CREATE TABLE `trading_invite`/);
  assert.match(migration, /CREATE TABLE `trading_state`/);
});
