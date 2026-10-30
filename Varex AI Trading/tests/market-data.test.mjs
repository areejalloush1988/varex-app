import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = fs.readFileSync(new URL("../market-data.js", import.meta.url), "utf8");
const START = Date.UTC(2024, 0, 1) / 1000;
const NOW = Date.UTC(2026, 9, 30, 12);

function candles(count, { start = START, interval = 3600 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * interval, open: 100 + index, high: 102 + index,
    low: 98 + index, close: 101 + index, volume: index + 1,
  }));
}
const coinbase = (bars) => bars.map((row) => [row.time, row.low, row.high, row.open, row.close, row.volume]);
const kraken = (bars, key = "XXBTZUSD") => ({
  error: [], result: { [key]: bars.map((row) => [
    row.time, String(row.open), String(row.high), String(row.low), String(row.close), "100.5", String(row.volume), 5,
  ]), last: String(bars.at(-1)?.time || START) },
});
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

function harness(fetcher, { browser = false } = {}) {
  let now = NOW, nextTimer = 0;
  const timers = new Map(), calls = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const globals = {
    Date: Clock, AbortController,
    fetch: (url, options) => { calls.push({ url, options }); return fetcher(url, options, calls.length); },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    ...(browser ? { window: {} } : { module: { exports: {} } }),
  };
  Object.defineProperty(globals, "localStorage", { get() { throw new Error("Market data must not access account storage"); } });
  vm.runInNewContext(script, globals);
  return {
    api: browser ? globals.window.VarexMarketData : globals.module.exports,
    calls, timers,
    advance: (milliseconds) => { now += milliseconds; },
    expire: () => {
      const next = timers.entries().next().value;
      assert.ok(next, "Expected an active provider deadline");
      timers.delete(next[0]);
      next[1].callback();
    },
  };
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("browser and CommonJS loading expose only the public candle client and aggregation helper", () => {
  const browser = harness(() => response(coinbase(candles(60))), { browser: true });
  assert.equal(typeof browser.api.loadCandles, "function");
  assert.equal(typeof browser.api.aggregateFourHourCandles, "function");
  assert.equal(typeof browser.api.aggregateCalendarCandles, "function");
  assert.equal(Object.isFrozen(browser.api), true);
  assert.equal(browser.calls.length, 0);
});

test("Coinbase data is numeric, sorted, deduplicated and restricted to the newest 350 bars", async () => {
  const rows = candles(360);
  const payload = coinbase([...rows].reverse().concat({ ...rows[340] }));
  const original = structuredClone(payload);
  const h = harness(() => response(payload));
  const result = await h.api.loadCandles({ symbol: "BTC-USD" });
  assert.equal(result.source, "Coinbase Exchange");
  assert.equal(result.intervalSeconds, 3600);
  assert.equal(result.receivedAt, new Date(NOW).toISOString());
  assert.equal(result.candles.length, 350);
  assert.equal(result.candles[0].time, rows[10].time);
  assert.equal(result.candles.at(-1).time, rows.at(-1).time);
  assert.equal(typeof result.candles[0].open, "number");
  assert.deepEqual(payload, original);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600");
  assert.equal(h.timers.size, 0);
});

test("every request is a credential-free GET to a public market endpoint", async () => {
  const h = harness((url) => url.includes("coinbase") ? response({}, 503) : response(kraken(candles(60))));
  await h.api.loadCandles({
    symbol: "BTC-USD", headers: { Authorization: "must-not-be-forwarded" },
    token: "must-not-be-forwarded", credentials: "include", body: "must-not-be-forwarded",
  });
  assert.equal(h.calls.length, 2);
  for (const { url, options } of h.calls) {
    assert.match(url, /^https:\/\/(?:api\.exchange\.coinbase\.com\/products\/BTC-USD\/candles|api\.kraken\.com\/0\/public\/OHLC)\?/);
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.mode, "cors");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(Object.keys(options.headers), ["Accept"]);
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(Object.hasOwn(options, "body"), false);
    assert.equal(JSON.stringify(options).includes("must-not-be-forwarded"), false);
  }
});

test("unknown or injected symbols and unsupported intervals fail before any fetch", async () => {
  const h = harness(() => { throw new Error("Must not fetch"); });
  for (const symbol of ["EURUSD", "BTC-USDT", "btc-usd", "__proto__", "BTC-USD?token=bad", "", null]) {
    await assert.rejects(h.api.loadCandles({ symbol }), (error) => error.code === "unsupported_symbol");
  }
  for (const interval of ["0", "4h", "1440", "30D", "__proto__", "toString", 60, null]) {
    await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD", interval }), (error) => error.code === "unsupported_interval");
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test("the exact interval allowlist produces the intended public endpoint parameters", async () => {
  for (const [interval, granularity, seconds] of [["1", 60, 60], ["5", 300, 300], ["15", 900, 900], ["60", 3600, 3600], ["240", 3600, 14400], ["D", 86400, 86400]]) {
    const h = harness(() => response(coinbase(candles(320, { interval: granularity }))));
    const result = await h.api.loadCandles({ symbol: "ETH-USD", interval });
    assert.equal(result.intervalSeconds, seconds);
    assert.equal(result.calendarPeriod, null);
    assert.equal(h.calls[0].url, "https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=" + granularity);
  }
});

test("one-minute fallback requests Kraken's native one-minute interval", async () => {
  const h = harness((url) => url.includes("coinbase") ? response({}, 503) : response(kraken(candles(60, { interval: 60 }))));
  const result = await h.api.loadCandles({ symbol: "BTC-USD", interval: "1" });
  assert.equal(result.intervalSeconds, 60);
  assert.equal(result.source, "Kraken");
  assert.equal(h.calls[1].url, "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1");
});

test("weekly aggregation requires every closed UTC day and starts on Monday", () => {
  const { api } = harness(() => { throw new Error("No request needed"); });
  const day = 86400, rows = candles(16, { start: START + 2 * day, interval: day });
  const result = api.aggregateCalendarCandles([...rows].reverse(), "week", (START + 20 * day) * 1000);
  assert.equal(result.length, 1, "Partial leading and trailing weeks must be discarded");
  assert.equal(result[0].time, START + 7 * day);
  assert.equal(result[0].open, rows[5].open);
  assert.equal(result[0].close, rows[11].close);
  assert.equal(result[0].high, rows[11].high);
  assert.equal(result[0].low, rows[5].low);
  assert.equal(result[0].volume, 63);
  const complete = candles(14, { interval: day });
  assert.equal(api.aggregateCalendarCandles(complete, "week", (START + 14 * day) * 1000 - 1).length, 1);
  assert.equal(api.aggregateCalendarCandles(complete, "week", (START + 14 * day) * 1000).length, 2);
});

test("calendar months respect leap February and real month boundaries, with no synthetic 30-day bars", () => {
  const { api } = harness(() => { throw new Error("No request needed"); });
  const rows = candles(92, { interval: 86400 }); // Jan, leap Feb, Mar, then the open April day.
  const before = structuredClone(rows);
  const result = api.aggregateCalendarCandles(rows, "month", Date.UTC(2024, 3, 1, 12));
  assert.deepEqual(Array.from(result, (row) => row.time), [0, 1, 2].map((month) => Date.UTC(2024, month, 1) / 1000));
  assert.equal(result[0].close, rows[30].close);
  assert.equal(result[1].open, rows[31].open);
  assert.equal(result[1].close, rows[59].close);
  assert.equal(result[1].volume, rows.slice(31, 60).reduce((sum, row) => sum + row.volume, 0));
  assert.equal(result[2].close, rows[90].close);
  assert.deepEqual(rows, before);
});

test("calendar aggregation rejects missing, conflicting, unaligned and unfinished daily components", () => {
  const { api } = harness(() => { throw new Error("No request needed"); });
  const rows = candles(60, { interval: 86400 }), end = Date.UTC(2024, 2, 1);
  const missing = api.aggregateCalendarCandles(rows.filter((_, index) => index !== 10), "month", end);
  assert.deepEqual(Array.from(missing, (row) => row.time), [Date.UTC(2024, 1, 1) / 1000]);
  assert.equal(api.aggregateCalendarCandles([...rows, { ...rows[10] }], "month", end).length, 2);
  assert.equal(api.aggregateCalendarCandles([...rows, { ...rows[10], close: rows[10].close + .25 }], "month", end).length, 1);
  assert.equal(api.aggregateCalendarCandles(rows.map((row) => ({ ...row, time: row.time + 1 })), "month", end).length, 0);
  assert.equal(api.aggregateCalendarCandles(rows, "month", end - 1).length, 1);
  for (const [period, now] of [["30D", end], ["month", NaN], ["week", -1]]) {
    assert.equal(api.aggregateCalendarCandles(rows, period, now).length, 0);
  }
});

test("calendar periods aggregate the bounded 720-day Kraken history before trimming", async () => {
  const rows = candles(720, { interval: 86400 });
  for (const [interval, period, expected] of [["W", "week", 102], ["M", "month", 23]]) {
    const h = harness(() => response(kraken(rows)));
    const result = await h.api.loadCandles({ symbol: "BTC-USD", interval });
    assert.equal(result.source, "Kraken");
    assert.equal(result.interval, interval);
    assert.equal(result.calendarPeriod, period);
    assert.equal(result.intervalSeconds, null, "Calendar duration must not be represented by a guessed seconds count");
    assert.equal(result.candles.length, expected);
    assert.equal(h.calls.length, 1, "No historical pagination or second successful provider request");
    assert.equal(h.calls[0].url, "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440");
    assert.equal(h.timers.size, 0);
    result.candles[0].close = 99999;
    result.calendarPeriod = "bad";
    const cached = await h.api.loadCandles({ symbol: "BTC-USD", interval });
    assert.equal(cached.calendarPeriod, period);
    assert.notEqual(cached.candles[0].close, 99999);
    assert.equal(h.calls.length, 1);
  }
});

test("calendar fallback uses one Coinbase daily request and keeps the actual shorter history", async () => {
  const h = harness((url) => url.includes("kraken") ? response({}, 503) : response(coinbase(candles(300, { interval: 86400 }))));
  const result = await h.api.loadCandles({ symbol: "BTC-USD", interval: "M" });
  assert.equal(result.source, "Coinbase Exchange");
  assert.equal(result.candles.length, 9);
  assert.equal(result.calendarPeriod, "month");
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].url, "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400");
});

test("providers with only partial calendar periods report period unavailable without fabricated candles", async () => {
  const rows = candles(6, { interval: 86400 });
  const h = harness((url) => response(url.includes("kraken") ? kraken(rows) : coinbase(rows)));
  await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD", interval: "W" }), (error) =>
    error.code === "period_unavailable" && /غير متاح لهذه الفترة/.test(error.message) && error.attempts.length === 2);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test("public one-minute and calendar loader results pass directly into analysis with the correct close time", async () => {
  const context = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(new URL("../market-analysis.js", import.meta.url), "utf8"), context);
  for (const [interval, period, step, count, expectedClose] of [
    ["1", null, 60, 300, "2026-10-30T12:00:00.000Z"],
    ["W", "week", 86400, 720, "2026-10-26T00:00:00.000Z"],
    ["M", "month", 86400, 720, "2026-10-01T00:00:00.000Z"],
  ]) {
    const end = Math.floor(NOW / 1000 / step) * step;
    const rows = candles(count, { start: end - (count - 1) * step, interval: step });
    const h = harness((url) => response(url.includes("kraken") ? kraken(rows) : coinbase(rows)));
    const data = await h.api.loadCandles({ symbol: "BTC-USD", interval });
    const result = context.module.exports.analyzeCandles({ ...data, now: NOW });
    assert.equal(result.calendarPeriod, period);
    assert.equal(result.asOf, expectedClose);
    assert.equal(result.isCurrent, true);
    assert.equal(result.dataQuality.gaps, 0);
    assert.equal(result.status, interval === "M" ? "insufficient" : "ready");
    assert.equal(result.indicators.ema50.available, interval !== "M");
    assert.equal(h.calls.length, 1);
  }
});

test("four-hour aggregation uses aligned complete buckets and correct OHLCV", () => {
  const h = harness(() => { throw new Error("No request needed"); });
  const rows = candles(10);
  const result = h.api.aggregateFourHourCandles([...rows].reverse());
  assert.equal(result.length, 2);
  assert.equal(result[0].time, START);
  assert.equal(result[0].open, rows[0].open);
  assert.equal(result[0].close, rows[3].close);
  assert.equal(result[0].high, rows[3].high);
  assert.equal(result[0].low, rows[0].low);
  assert.equal(result[0].volume, 10);
  assert.equal(result[1].time, START + 14400);
  assert.equal(h.calls.length, 0);
});

test("aggregation rejects missing, conflicting and unaligned hourly components", () => {
  const h = harness(() => { throw new Error("No request needed"); });
  const rows = candles(8);
  const missing = h.api.aggregateFourHourCandles(rows.filter((_, index) => index !== 1));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].time, START + 14400);
  const duplicate = h.api.aggregateFourHourCandles([...rows, { ...rows[0] }]);
  assert.equal(duplicate.length, 2);
  const conflicting = h.api.aggregateFourHourCandles([...rows, { ...rows[0], close: rows[0].close + 0.25 }]);
  assert.equal(conflicting.length, 1);
  assert.equal(conflicting[0].time, START + 14400);
  assert.equal(h.api.aggregateFourHourCandles(rows.map((row) => ({ ...row, time: row.time + 1 }))).length, 0);
});

test("four-hour Coinbase history is aggregated before trimming and retains more than 50 bars", async () => {
  const rows = candles(350);
  const h = harness(() => response(coinbase([...rows].reverse())));
  const result = await h.api.loadCandles({ symbol: "BTC-USD", interval: "240" });
  assert.equal(result.source, "Coinbase Exchange");
  assert.equal(result.candles.length, 87);
  assert.equal(result.candles.at(-1).time, START + 86 * 14400);
  assert.ok(result.candles.every((row) => row.time % 14400 === 0));
});

test("HTTP, malformed JSON and unusable Coinbase data fall back to Kraken", async () => {
  for (const first of [
    () => response({}, 429),
    () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }),
    () => response({ message: "not candle data" }),
    () => response([[START, 101, 99, 100, Infinity, 5]]),
  ]) {
    const h = harness((url) => url.includes("coinbase") ? first() : response(kraken(candles(721))));
    const result = await h.api.loadCandles({ symbol: "BTC-USD" });
    assert.equal(result.source, "Kraken");
    assert.equal(result.candles.length, 350);
    assert.equal(result.candles[0].time, START + 371 * 3600);
    assert.equal(result.candles.at(-1).volume, 721);
    assert.equal(h.calls.length, 2);
    assert.equal(h.timers.size, 0);
  }
});

test("Kraken pairs and native intervals are allowlisted for every supported symbol", async () => {
  for (const [symbol, pair, resultKey] of [
    ["BTC-USD", "XBTUSD", "XXBTZUSD"], ["ETH-USD", "ETHUSD", "XETHZUSD"],
    ["SOL-USD", "SOLUSD", "SOLUSD"], ["ADA-USD", "ADAUSD", "ADAUSD"],
  ]) {
    const h = harness((url) => url.includes("coinbase") ? response([], 503)
      : response(kraken(candles(60, { interval: 14400 }), resultKey)));
    const result = await h.api.loadCandles({ symbol, interval: "240" });
    assert.equal(result.symbol, symbol);
    assert.equal(result.intervalSeconds, 14400);
    assert.equal(result.candles.length, 60);
    assert.equal(h.calls[1].url, "https://api.kraken.com/0/public/OHLC?pair=" + pair + "&interval=240");
  }
  const daily = harness((url) => url.includes("coinbase") ? response([], 503) : response(kraken(candles(60, { interval: 86400 }))));
  await daily.api.loadCandles({ symbol: "BTC-USD", interval: "D" });
  assert.ok(daily.calls[1].url.endsWith("&interval=1440"));
});

test("Kraken errors, invalid numeric strings and wrong-market results do not become candle data", async () => {
  for (const payload of [
    { error: ["EGeneral:Unavailable"], result: {} },
    kraken(candles(60), "XETHZUSD"),
    { error: [], result: { XXBTZUSD: [[START, "", "102", "98", "101", "100", "5"]], last: START } },
    { error: [], result: { XXBTZUSD: [[START, "100", "102", "98", "101", "100", "-5"]], last: START } },
  ]) {
    const h = harness((url) => url.includes("coinbase") ? response({}, 500) : response(payload));
    await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD" }), (error) =>
      error.code === "sources_unavailable" && error.attempts.length === 2);
    assert.equal(h.calls.length, 2);
  }
});

test("invalid and conflicting provider rows are omitted without changing valid bars", async () => {
  const rows = candles(60), raw = coinbase(rows);
  raw.push([START - 3600, 100, 90, 99, 95, 5]);
  raw.push([START - 7200, 90, 100, null, 95, 5]);
  raw.push([START - 10800, 90, 100, 95, 99, "not-a-number"]);
  raw.push([rows[20].time, rows[20].low, rows[20].high, rows[20].open, rows[20].close + 0.25, rows[20].volume]);
  const h = harness(() => response(raw));
  const result = await h.api.loadCandles({ symbol: "BTC-USD" });
  assert.equal(result.candles.length, 59);
  assert.equal(result.candles.some((row) => row.time === rows[20].time), false);
  assert.equal(result.candles[0].time, START);
});

test("short public cache is cloned, expires, and is bypassed by force", async () => {
  const h = harness(() => response(coinbase(candles(60))));
  const first = await h.api.loadCandles({ symbol: "BTC-USD" });
  first.candles[0].close = 99999;
  const cached = await h.api.loadCandles({ symbol: "BTC-USD" });
  assert.equal(h.calls.length, 1);
  assert.equal(cached.candles[0].close, 101);
  assert.equal(cached.receivedAt, new Date(NOW).toISOString());
  h.advance(1000);
  await h.api.loadCandles({ symbol: "BTC-USD", force: true });
  assert.equal(h.calls.length, 2);
  h.advance(15000);
  await h.api.loadCandles({ symbol: "BTC-USD" });
  assert.equal(h.calls.length, 3);
});

test("failed forced refresh never silently returns or revives earlier cached data", async () => {
  let available = true;
  const h = harness(() => available ? response(coinbase(candles(60))) : response({}, 503));
  await h.api.loadCandles({ symbol: "BTC-USD" });
  available = false;
  await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD", force: true }), (error) => error.code === "sources_unavailable");
  const calls = h.calls.length;
  await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD" }), (error) => error.code === "sources_unavailable");
  assert.equal(h.calls.length, calls + 2);
});

test("an already-aborted caller causes no fetch and cannot receive cached data", async () => {
  const h = harness(() => response(coinbase(candles(60))));
  await h.api.loadCandles({ symbol: "BTC-USD" });
  const controller = new AbortController(), reason = new Error("caller cancelled");
  controller.abort(reason);
  await assert.rejects(h.api.loadCandles({ symbol: "BTC-USD", signal: controller.signal }), (error) => error === reason);
  assert.equal(h.calls.length, 1);
});

test("caller cancellation aborts the in-flight request and never triggers provider fallback", async () => {
  const h = harness((_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  const controller = new AbortController(), reason = new Error("selection changed");
  const pending = h.api.loadCandles({ symbol: "BTC-USD", signal: controller.signal });
  assert.equal(h.calls.length, 1);
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test("provider timeout is bounded, aborts its request and permits the fallback", async () => {
  const h = harness((url) => url.includes("coinbase") ? new Promise(() => {}) : response(kraken(candles(60))));
  const pending = h.api.loadCandles({ symbol: "BTC-USD" });
  assert.equal([...h.timers.values()][0].delay, 8000);
  h.expire();
  const result = await pending;
  assert.equal(result.source, "Kraken");
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test("both unresponsive providers time out without a hanging promise or extra retries", async () => {
  const h = harness(() => new Promise(() => {}));
  const pending = h.api.loadCandles({ symbol: "BTC-USD" });
  const rejection = assert.rejects(pending, (error) => error.code === "sources_unavailable"
    && error.attempts.every((attempt) => attempt.code === "provider_timeout"));
  h.expire();
  await nextTurn();
  assert.equal(h.calls.length, 2);
  h.expire();
  await rejection;
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test("caller abort during body decoding is preserved even if fetch ignores abort", async () => {
  const controller = new AbortController(), reason = new Error("cancel body");
  const h = harness(() => ({ ok: true, json: () => new Promise(() => {}) }));
  const pending = h.api.loadCandles({ symbol: "BTC-USD", signal: controller.signal });
  await nextTurn();
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});
