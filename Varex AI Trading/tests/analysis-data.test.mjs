import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = fs.readFileSync(new URL("../analysis-data.js", import.meta.url), "utf8");
const NOW = Date.UTC(2026, 9, 31, 12);
const DAY = 86400;
const SETTINGS = { "1": 60, "5": 300, "15": 900, "60": 3600, "240": 14400, D: DAY };
const response = (payload, status = 200, retry = null) => ({
  ok: status >= 200 && status < 300, status, json: async () => payload,
  headers: { get: (name) => name === "Retry-After" ? retry : null },
});
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ symbol = "XAU-USD", interval = "60", count = 60, now = NOW, source = "Twelve Data" } = {}) {
  const seconds = SETTINGS[interval], end = Math.floor(now / 1000 / seconds) * seconds;
  return {
    symbol, interval, intervalSeconds: seconds, calendarPeriod: null,
    source, sourceUrl: "https://twelvedata.com/", receivedAt: new Date(now).toISOString(), delaySeconds: 0,
    candles: Array.from({ length: count }, (_, index) => ({
      time: end - (count - index) * seconds, open: 2000 + index, high: 2004 + index, low: 1998 + index,
      close: 2002 + index, volume: index + 1,
    })),
  };
}

function publicGoldFixture(now = NOW) {
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  return {
    symbol: "XAU-USD-SPOT", interval: "1d", meta: { source_id: "mixed" },
    bars: Array.from({ length: 29 }, (_, index) => ({
      bar_start: new Date(today.getTime() - (index + 1) * DAY * 1000).toISOString(),
      open: String(2000 + index), high: String(2010 + index), low: String(1990 + index), close: String(2004 + index),
      volume: null, is_closed: true,
    })),
  };
}

function harness(options = {}) {
  let now = NOW, serial = 0;
  const timers = new Map();
  const globals = { module: { exports: {} }, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout };
  Object.defineProperty(globals, "localStorage", { get() { throw new Error("Market data cannot read account storage"); } });
  vm.runInNewContext(script, globals);
  const api = globals.module.exports;
  const client = api.createClient({
    now: () => now,
    setTimeout: (callback, delay) => { const id = ++serial; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id), ...options,
  });
  return { api, client, timers, advance: (value) => { now += value; }, expire() {
    const next = timers.entries().next().value; assert.ok(next); timers.delete(next[0]); next[1].callback();
  } };
}

test("the public surface is read-only data, has the agreed symbols and returns copy-safe catalogues", () => {
  const { api } = harness();
  assert.deepEqual(Array.from(api.getMarkets(), (item) => item.symbol), ["XAU-USD", "BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"]);
  assert.deepEqual(Array.from(api.getIntervals(), (item) => item.value), ["1", "5", "15", "60", "240", "D", "W", "M"]);
  const copy = api.getMarkets(); copy[0].symbol = "bad";
  assert.equal(api.getMarkets()[0].symbol, "XAU-USD");
  assert.equal(Object.isFrozen(api), true);
  assert.equal(Object.hasOwn(api, "trade"), false);
  assert.equal(typeof api.load, "function");
});

test("unknown symbols, intervals and invalid signals fail before any transport", async () => {
  let calls = 0;
  const { client } = harness({ request: () => { calls += 1; } });
  for (const symbol of ["XAU/USD", "gold", "__proto__", "BTC-USD?secret=1", "", null]) {
    await assert.rejects(client.load({ symbol }), (error) => error.code === "unsupported_symbol");
  }
  for (const interval of ["1h", 60, "__proto__", "30", "", null]) {
    await assert.rejects(client.load({ interval }), (error) => error.code === "unsupported_interval");
  }
  await assert.rejects(client.load({ signal: {} }), (error) => error.code === "invalid_signal");
  assert.equal(calls, 0);
});

test("gold goes only through the authenticated analysis route and forwards no arbitrary credentials", async () => {
  const calls = [], payload = fixture();
  const { client, timers } = harness({ request: async (url, options) => { calls.push({ url, options }); return response(payload); } });
  const value = await client.load({ symbol: "XAU-USD", interval: "60", secret: "do-not-forward", headers: { Authorization: "bad" } });
  assert.equal(calls[0].url, "/api/analysis/market?symbol=XAU-USD&interval=60");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(JSON.stringify(calls).includes("do-not-forward"), false);
  assert.equal(JSON.stringify(calls).includes("Authorization"), false);
  assert.equal(value.source, "Twelve Data");
  assert.equal(value.candles.length, 60);
  assert.equal(value.asOf, "2026-10-31T12:00:00.000Z");
  assert.equal(value.provenance.url, "https://twelvedata.com/");
  assert.equal(value.allowExport, false);
  assert.equal(timers.size, 0);
});

test("the settled gold backend contract preserves provider, verified source, attribution, warnings and unknown delay", async () => {
  const payload = { ...fixture(), source: "Twelve Data · XAU/USD", provider: "twelvedata", sourceVerified: true,
    delaySeconds: null, imported: false, allowExport: false,
    provenance: { url: "https://twelvedata.com/", attribution: "Twelve Data", displayOnly: true, delaySeconds: null },
    warnings: ["تأخر المصدر غير مؤكد؛ وقت آخر شمعة ظاهر ولا يُفترض أن البيانات لحظية.", "استُبعدت الشمعة الجارية غير المكتملة."],
  };
  const { client } = harness({ request: async () => response(payload) });
  const result = await client.load();
  assert.equal(result.source, "Twelve Data · XAU/USD");
  assert.equal(result.provider, "twelvedata");
  assert.equal(result.sourceVerified, true);
  assert.equal(result.sourceUrl, "https://twelvedata.com/");
  assert.equal(result.provenance.url, "https://twelvedata.com/");
  assert.equal(result.provenance.attribution, "Twelve Data");
  assert.deepEqual(Array.from(result.warnings), payload.warnings);
  assert.equal(result.delaySeconds, null);
  assert.equal(result.provenance.delaySeconds, null);
  assert.equal(result.allowExport, false);
  assert.equal(result.provenance.displayOnly, true);
  assert.equal(result.receivedAt, payload.receivedAt);
  assert.equal(result.asOf, "2026-10-31T12:00:00.000Z");
});

test("metadata is bounded and sanitized and cannot enable exports or claim source verification through truthy values", async () => {
  const payload = { ...fixture(), provider: "<script>bad</script>", sourceVerified: "true", allowExport: true,
    sourceUrl: "javascript:alert(1)", delaySeconds: null,
    provenance: { url: "https://person:secret@provider.example/path", attribution: "<b>untrusted</b>",
      displayOnly: false, allowExport: true, kind: "open-license", delaySeconds: 0, secret: "must-not-survive" },
    warnings: ["Valid warning", "Valid warning", "", "<script>bad</script>", "bad\nwarning", { secret: "must-not-survive" }, "x".repeat(501), ...Array.from({ length: 12 }, (_, i) => `Warning ${i}`)],
    quality: { count: -1, gaps: "0", ageSeconds: Infinity, freshness: "live", marketHoursKnown: "true", token: "must-not-survive" },
  };
  const { client } = harness({ request: async () => response(payload) });
  const result = await client.load();
  assert.equal(result.provider, null);
  assert.equal(result.sourceVerified, false);
  assert.equal(result.allowExport, false);
  assert.equal(result.sourceUrl, null);
  assert.equal(result.provenance.url, "");
  assert.equal(result.provenance.attribution, payload.source);
  assert.equal(result.provenance.kind, "provider");
  assert.equal(result.provenance.displayOnly, true);
  assert.equal(result.delaySeconds, null, "an explicit unknown delay must not become a live-data assertion");
  assert.equal(result.provenance.delaySeconds, null);
  assert.equal(result.warnings.length, 8);
  assert.equal(new Set(result.warnings).size, 8);
  assert.equal(result.quality.reported, undefined);
  assert.doesNotMatch(JSON.stringify(result), /must-not-survive|<script>|open-license/);
});

test("canonical sourceUrl takes precedence, URLs omit secrets in query/fragment, and provenance-only delay remains explicit", async () => {
  for (const canonical of [true, false]) {
    const payload = { ...fixture(), provenance: { url: "https://provider.example/credit?api_key=do-not-copy#private", attribution: "Source credit", delaySeconds: 900 } };
    if (canonical) payload.sourceUrl = "https://twelvedata.com/source?token=do-not-copy#private";
    else delete payload.sourceUrl;
    delete payload.delaySeconds;
    const { client } = harness({ request: async () => response(payload) });
    const result = await client.load();
    assert.equal(result.sourceUrl, canonical ? "https://twelvedata.com/source" : "https://provider.example/credit");
    assert.equal(result.provenance.url, result.sourceUrl);
    assert.equal(result.delaySeconds, 900);
    assert.equal(result.provenance.delaySeconds, 900);
    assert.doesNotMatch(JSON.stringify(result), /do-not-copy|private/);
  }
});

test("unknown or invalid delay values are never replaced with zero or inferred from candle age", async () => {
  for (const delaySeconds of [undefined, null, "0", -1, Infinity]) {
    const payload = { ...fixture({ now: NOW - 5 * 3600 * 1000 }), delaySeconds };
    const { client } = harness({ request: async () => response(payload) });
    const result = await client.load();
    assert.equal(result.delaySeconds, null);
    assert.equal(result.provenance.delaySeconds, null);
    assert.equal(result.quality.ageSeconds, 5 * 3600);
  }
});

test("upstream stale flags are conservative and reported diagnostics cannot replace candle-derived quality", async () => {
  for (const flags of [{ is_stale: true }, { isStale: true }, { quality: { freshness: "aged" } }, { quality: { is_stale: true } }]) {
    const payload = { ...fixture(), ...flags };
    const { client } = harness({ request: async () => response(payload) });
    const result = await client.load();
    assert.equal(result.quality.ageSeconds, 0);
    assert.equal(result.quality.freshness, "aged");
    assert.equal(result.quality.sourceFlaggedStale, true);
  }
  const payload = { ...fixture({ now: NOW - 5 * 3600 * 1000 }), is_stale: false,
    quality: { count: 999, droppedOpenBars: 2, duplicateRows: 3, gaps: 0, ageSeconds: 0, freshness: "recent", marketHoursKnown: true },
  };
  payload.candles.splice(10, 1);
  const { client } = harness({ request: async () => response(payload) });
  const result = await client.load();
  assert.equal(result.quality.count, 59);
  assert.equal(result.quality.gaps, 1);
  assert.equal(result.quality.ageSeconds, 5 * 3600);
  assert.equal(result.quality.freshness, "aged");
  assert.equal(result.quality.marketHoursKnown, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result.quality.reported)), payload.quality);
});

test("cached metadata is copy-safe and source verification is reserved for the authenticated backend", async () => {
  let calls = 0;
  const payload = { ...fixture(), sourceVerified: true, warnings: ["Keep this warning"], quality: { freshness: "aged" } };
  const { client } = harness({ request: async () => { calls++; return response(payload); } });
  const first = await client.load();
  first.warnings[0] = "Changed";
  first.quality.reported.freshness = "recent";
  first.provenance.attribution = "Changed";
  const cached = await client.load();
  assert.equal(cached.warnings[0], "Keep this warning");
  assert.equal(cached.quality.reported.freshness, "aged");
  assert.equal(cached.provenance.attribution, payload.source);
  assert.equal(calls, 1);
  const crypto = harness({ marketData: { loadCandles: async () => ({ ...fixture({ symbol: "BTC-USD", source: "Kraken" }), sourceVerified: true }) } });
  assert.equal((await crypto.client.load({ symbol: "BTC-USD" })).sourceVerified, false);
});

test("crypto reuses only the public candle loader and keeps its source provenance", async () => {
  const calls = [];
  const { client } = harness({ marketData: { loadCandles: async (input) => {
    calls.push(input); return fixture({ symbol: input.symbol, interval: input.interval, source: "Kraken" });
  } }, request: () => { throw new Error("Crypto must not contact the private route"); } });
  const value = await client.load({ symbol: "ETH-USD", interval: "15", token: "ignored" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].symbol, "ETH-USD");
  assert.equal(Object.hasOwn(calls[0], "token"), false);
  assert.equal(value.source, "Kraken");
  // An adapter's arbitrary sourceUrl is not trusted for an authenticated destination; it is display metadata only.
  assert.equal(value.intervalSeconds, 900);
});

test("mismatched instrument, source, chronology and malformed candles cannot produce a report dataset", async () => {
  const mutations = [
    (p) => { p.symbol = "BTC-USD"; },
    (p) => { p.interval = "15"; },
    (p) => { p.intervalSeconds = 60; },
    (p) => { p.source = ""; },
    (p) => { p.receivedAt = "2026-11-02T00:00:00Z"; },
    (p) => { p.candles[0].open = 0; },
    (p) => { p.candles[0].high = p.candles[0].low - 1; },
    (p) => { p.candles[0].close = Infinity; },
    (p) => { p.candles[0].time += 5; },
    (p) => { p.candles[0].time = NOW / 1000 + DAY; },
    (p) => { p.candles[0].volume = -1; },
    (p) => { p.candles.push({ ...p.candles[0], close: p.candles[0].close + 1 }); },
  ];
  for (const mutate of mutations) {
    const payload = fixture(); mutate(payload);
    const { client } = harness({ request: async () => response(payload) });
    await assert.rejects(client.load(), (error) => error.code === "invalid_market_data");
  }
});

test("closed candles sort and collapse exact duplicates, open candles are removed and gaps remain gaps", async () => {
  const payload = fixture();
  const before = payload.candles.length;
  payload.candles.splice(10, 1);
  payload.candles.push({ ...payload.candles[0] });
  payload.candles.push({ ...payload.candles.at(-2), time: NOW / 1000, is_closed: false });
  payload.candles.reverse();
  const original = JSON.stringify(payload);
  const { client } = harness({ request: async () => response(payload) });
  const result = await client.load();
  assert.equal(result.candles.length, before - 1);
  assert.equal(result.quality.duplicateRows, 1);
  assert.equal(result.quality.droppedOpenBars, 1);
  assert.equal(result.quality.gaps, 1);
  assert.equal(JSON.stringify(payload), original);
  assert.ok(result.candles.every((row, i) => !i || row.time > result.candles[i - 1].time));
});

test("weeks and months preserve calendar metadata and exclude the unfinished calendar period", async () => {
  for (const [interval, calendarPeriod, dates, expectedEnd] of [
    ["W", "week", ["2026-10-12", "2026-10-19", "2026-10-26"], "2026-10-26T00:00:00.000Z"],
    ["M", "month", ["2026-08-01", "2026-09-01", "2026-10-01"], "2026-10-01T00:00:00.000Z"],
  ]) {
    const payload = { symbol: "XAU-USD", interval, intervalSeconds: null, calendarPeriod,
      source: "Twelve Data", receivedAt: new Date(NOW).toISOString(),
      candles: dates.map((date) => ({ time: Date.parse(date + "T00:00:00Z") / 1000,
        open: 2000, high: 2020, low: 1980, close: 2010 })) };
    const { client } = harness({ request: async () => response(payload) });
    const result = await client.load({ interval });
    assert.equal(result.candles.length, 2);
    assert.equal(result.intervalSeconds, null);
    assert.equal(result.calendarPeriod, calendarPeriod);
    assert.equal(result.asOf, expectedEnd);
    assert.equal(result.quality.droppedOpenBars, 1);
  }
});

test("old observations stay explicitly aged even if the request just completed", async () => {
  const payload = fixture({ now: NOW - 5 * 3600 * 1000 });
  payload.receivedAt = new Date(NOW).toISOString();
  const { client } = harness({ request: async () => response(payload) });
  const result = await client.load();
  assert.equal(result.receivedAt, new Date(NOW).toISOString());
  assert.equal(result.asOf, "2026-10-31T07:00:00.000Z");
  assert.equal(result.quality.ageSeconds, 5 * 3600);
  assert.equal(result.quality.freshness, "aged");
});

test("missing gold configuration fails closed, and daily fallback is off unless explicitly enabled", async () => {
  let publicCalls = 0;
  const options = { request: async () => response({ code: "market_provider_not_configured" }, 503),
    publicFetch: async () => { publicCalls += 1; return response(publicGoldFixture()); } };
  const { client } = harness(options);
  await assert.rejects(client.load({ interval: "D" }), (error) => error.code === "market_provider_not_configured" && error.canImport);
  assert.equal(publicCalls, 0);
  await assert.rejects(harness().client.load(), (error) => error.code === "market_provider_not_configured");
});

test("explicit daily gold fallback uses fixed public host with no credentials, closed bars, attribution and export prohibition", async () => {
  const calls = [], payload = publicGoldFixture();
  payload.bars.push({ ...payload.bars[0], bar_start: "2026-10-31T00:00:00Z", is_closed: false });
  const { client } = harness({ enableGoldDailyFallback: true,
    request: async () => response({ code: "market_provider_not_configured" }, 503),
    publicFetch: async (url, options) => { calls.push({ url, options }); return response(payload); },
  });
  const result = await client.load({ symbol: "XAU-USD", interval: "D" });
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin, "https://api.goldprice.dev");
  assert.equal(url.pathname, "/v1/bars");
  assert.equal(url.searchParams.get("symbol"), "XAU-USD-SPOT");
  assert.equal(url.searchParams.get("interval"), "1d");
  assert.equal(url.searchParams.get("from"), "2026-10-02");
  assert.equal(url.searchParams.get("to"), "2026-10-31");
  assert.equal(url.searchParams.get("limit"), "30");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.referrerPolicy, "no-referrer");
  assert.equal(calls[0].options.redirect, "error");
  assert.deepEqual(Object.keys(calls[0].options.headers), ["Accept"]);
  assert.equal(result.candles.length, 29);
  assert.equal(result.candles.some((row) => Object.hasOwn(row, "volume")), false, "Spot volume must not become fabricated zero volume");
  assert.equal(result.provenance.url, "https://goldprice.dev/");
  assert.equal(result.provenance.attribution, "Gold price data by goldprice.dev");
  assert.equal(result.delaySeconds, 900);
  assert.equal(result.allowExport, false);
  assert.equal(result.provenance.displayOnly, true);
  assert.equal(result.provenance.historyWindowDays, 30);
});

test("daily fallback never substitutes for an intraday request or bypasses an auth rejection", async () => {
  for (const [interval, status, code] of [["60", 503, "market_provider_not_configured"], ["D", 401, "authentication_required"], ["D", 403, "access_denied"]]) {
    let publicCalls = 0;
    const { client } = harness({ enableGoldDailyFallback: true, request: async () => response({ code }, status),
      publicFetch: async () => { publicCalls += 1; return response(publicGoldFixture()); } });
    await assert.rejects(client.load({ interval }), (error) => error.code === code);
    assert.equal(publicCalls, 0);
  }
});

test("public gold validates the actual symbol, daily interval and explicit closed-bar marker", async () => {
  for (const mutate of [
    (p) => { p.symbol = "GC-FUTURES"; },
    (p) => { p.interval = "1h"; },
    (p) => { delete p.bars[0].is_closed; },
    (p) => { p.bars[0].open = "Infinity"; },
    (p) => { p.bars[0].bar_start = "2026-10-31 00:00:00"; },
    (p) => { p.bars[0].bar_start = "2026-09-01T00:00:00Z"; },
  ]) {
    const payload = publicGoldFixture(); mutate(payload);
    const { client } = harness({ enableGoldDailyFallback: true, request: async () => response({}, 404), publicFetch: async () => response(payload) });
    await assert.rejects(client.load({ interval: "D" }), (error) => error.code === "invalid_market_data");
  }
});

test("daily public data is cached for at least fifteen minutes even when refresh is clicked, with copy-safe results", async () => {
  let requests = 0;
  const { client, advance } = harness({ enableGoldDailyFallback: true, request: async () => response({}, 404),
    publicFetch: async () => { requests += 1; return response(publicGoldFixture()); } });
  const first = await client.load({ interval: "D" });
  first.candles[0].open = -1; first.provenance.url = "https://invalid.test";
  const second = await client.load({ interval: "D", force: true });
  assert.ok(second.candles[0].open > 0);
  assert.equal(second.provenance.url, "https://goldprice.dev/");
  assert.equal(requests, 1);
  advance(15 * 60 * 1000);
  await client.load({ interval: "D", force: true });
  assert.equal(requests, 2);
});

test("failed forced refresh removes the previous cache rather than pretending old data is a new result", async () => {
  let requests = 0;
  const { client } = harness({ request: async () => ++requests === 1 ? response(fixture()) : response({}, 502) });
  await client.load();
  await assert.rejects(client.load({ force: true }), (error) => error.code === "provider_unavailable");
  await assert.rejects(client.load(), (error) => error.code === "provider_unavailable");
  assert.equal(requests, 3);
});

test("rate limits expose only a bounded retry delay and no provider internals", async () => {
  const { client } = harness({ request: async () => response({ error: "secret-service-token" }, 429, "120") });
  await assert.rejects(client.load(), (error) => error.code === "rate_limited" && error.retryAfter === 120 && !error.message.includes("secret"));
});

test("aborting before or during an in-flight request cannot publish or cache a result", async () => {
  const pre = new AbortController(); pre.abort(new Error("cancelled-before"));
  let calls = 0, release;
  const { client, timers } = harness({ request: async () => { calls += 1; return new Promise((resolve) => { release = resolve; }); } });
  await assert.rejects(client.load({ signal: pre.signal }), /cancelled-before/);
  assert.equal(calls, 0);
  const active = new AbortController();
  const pending = client.load({ signal: active.signal });
  await nextTurn();
  active.abort(new Error("cancelled-active"));
  await assert.rejects(pending, /cancelled-active/);
  release(response(fixture())); await nextTurn();
  assert.equal(timers.size, 0);
});

test("the deadline rejects a transport that ignores abort and cleans up listeners", async () => {
  const { client, timers, expire } = harness({ request: () => new Promise(() => {}) });
  const pending = client.load(); await nextTurn();
  assert.equal(timers.size, 1); expire();
  await assert.rejects(pending, (error) => error.code === "provider_timeout");
  assert.equal(timers.size, 0);
});
