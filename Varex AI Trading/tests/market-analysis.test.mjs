import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = fs.readFileSync(new URL("../market-analysis.js", import.meta.url), "utf8");
const context = vm.createContext({ module: { exports: {} } });
vm.runInContext(script, context);
const { analyzeCandles, calculateEMA, calculateRSI, calculateMACD, calculateATR } = context.module.exports;
const START = 1_700_000_000;
const INTERVAL = 3600;

function bars(closes, { start = START, interval = INTERVAL, width = 0.5 } = {}) {
  return closes.map((close, index) => ({
    time: start + index * interval, open: close, high: close + width, low: close - width, close, volume: 100,
  }));
}
function clock(candles, extraSeconds = 0) {
  return (candles.at(-1).time + INTERVAL + extraSeconds) * 1000;
}
function near(actual, expected, tolerance = 1e-10) {
  assert.equal(typeof actual, "number");
  assert.ok(Math.abs(actual - expected) <= tolerance, "Expected " + actual + " to be within " + tolerance + " of " + expected);
}
function analyze(candles, overrides = {}) {
  return analyzeCandles({ symbol: "BTC-USD", source: "test fixture", candles,
    now: overrides.now === undefined ? clock(candles) : overrides.now, ...overrides });
}

test("classic browser export and CommonJS export expose the same pure API", () => {
  const browser = { window: {} };
  Object.defineProperty(browser, "fetch", { get() { throw new Error("Network access is forbidden"); } });
  Object.defineProperty(browser, "localStorage", { get() { throw new Error("Storage access is forbidden"); } });
  vm.runInNewContext(script, browser);
  assert.equal(typeof browser.window.VarexMarketAnalysis.analyzeCandles, "function");
  assert.equal(Object.isFrozen(browser.window.VarexMarketAnalysis), true);
  assert.equal(typeof context.module.exports.analyzeCandles, "function");
  assert.equal(browser.window.VarexMarketAnalysis.analyzeCandles({ candles: [] }).status, "unavailable");
});

test("EMA uses an SMA seed and preserves subsequent decimal values", () => {
  assert.equal(calculateEMA([10, 11], 3), null);
  assert.equal(calculateEMA([10, 11, 12], 3), 11);
  assert.equal(calculateEMA([10, 11, 12, 13, 15, 14], 3), 13.75);
  assert.equal(calculateEMA([10, NaN, 12], 3), null);
});

test("Wilder RSI matches a known seed vector and smooths the next change", () => {
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
  near(calculateRSI(closes), 70.46413502109705);
  near(calculateRSI([...closes, 46]), 66.24961855355505);
  assert.equal(calculateRSI(new Array(15).fill(100)), 50);
  assert.equal(calculateRSI(Array.from({ length: 15 }, (_, i) => i)), 100);
  assert.equal(calculateRSI(Array.from({ length: 15 }, (_, i) => 30 - i)), 0);
  assert.equal(calculateRSI(closes.slice(0, 14)), null);
});

test("MACD distinguishes an available line from an unseeded signal and matches a linear vector", () => {
  const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
  assert.equal(calculateMACD(closes.slice(0, 25)), null);
  const partial = calculateMACD(closes.slice(0, 26));
  near(partial.line, 7);
  assert.equal(partial.signal, null);
  assert.equal(partial.histogram, null);
  const seeded = calculateMACD(closes.slice(0, 34));
  near(seeded.line, 7);
  near(seeded.signal, 7);
  near(seeded.histogram, 0);
});

test("ATR includes overnight gaps and uses Wilder smoothing after its 14-range seed", () => {
  const candles = bars(new Array(15).fill(100), { width: 1 });
  assert.equal(calculateATR(candles.slice(0, 14)), null);
  near(calculateATR(candles), 2);
  candles.push({ time: START + 15 * INTERVAL, open: 105, high: 106, low: 104, close: 105 });
  near(calculateATR(candles), 16 / 7);
});

test("a complete fresh history has all indicators and an exact closed-bar timestamp", () => {
  const candles = bars(Array.from({ length: 60 }, (_, i) => 100 + i));
  const result = analyze(candles);
  assert.equal(result.status, "ready");
  assert.equal(result.isCurrent, true);
  assert.equal(result.asOf, new Date(clock(candles)).toISOString());
  assert.equal(result.lastCandleTime, candles.at(-1).time);
  assert.equal(result.lastClose, 159);
  assert.equal(result.candleCount, 60);
  assert.equal(result.missingIndicators.length, 0);
  near(result.indicators.ema20.value, 149.5);
  near(result.indicators.ema50.value, 134.5);
  assert.equal(result.direction, "bullish");
  assert.equal(result.agreement.total, 5);
  assert.equal(result.agreement.bullish + result.agreement.bearish + result.agreement.neutral, 5);
  assert.ok(result.reasons.some((reason) => reason.includes("ليس نسبة نجاح")));
  for (const forbidden of ["confidence", "probability", "target", "stop", "entry", "order"]) {
    assert.equal(Object.hasOwn(result, forbidden), false);
  }
});

test("the current 48-bar feed returns honest partial results instead of inventing EMA50", () => {
  const result = analyze(bars(Array.from({ length: 48 }, (_, i) => 100 + i)));
  assert.equal(result.status, "insufficient");
  assert.equal(result.indicators.ema20.available, true);
  assert.equal(result.indicators.ema50.available, false);
  assert.equal(result.indicators.ema50.value, null);
  assert.equal(result.indicators.rsi14.available, true);
  assert.equal(result.indicators.macd.available, true);
  assert.equal(result.indicators.atr14.available, true);
  assert.deepEqual(Array.from(result.missingIndicators), ["ema50"]);
  assert.equal(result.missingIndicatorDetails[0].requiredBars, 50);
  assert.equal(result.missingIndicatorDetails[0].availableBars, 48);
});

test("short histories expose the exact indicator warm-up requirements", () => {
  const result = analyze(bars(Array.from({ length: 14 }, (_, i) => 100 + i)));
  assert.equal(result.status, "insufficient");
  assert.equal(result.indicators.rsi14.value, null);
  assert.equal(result.indicators.atr14.value, null);
  assert.equal(result.indicators.macd.line, null);
  assert.equal(result.agreement.total, 0);
  assert.equal(result.direction, "neutral");
  assert.equal(result.missingIndicators.length, 6);
});

test("support and resistance use preceding bars and exclude the current breakout bar", () => {
  const candles = bars(Array.from({ length: 20 }, (_, i) => 100 + i), { width: 1 });
  candles.push({ time: START + 20 * INTERVAL, open: 120, high: 200, low: -10, close: 125 });
  const result = analyze(candles).indicators.supportResistance;
  assert.equal(result.available, true);
  assert.equal(result.support, 99);
  assert.equal(result.resistance, 120);
  assert.equal(result.position, "above");
});

test("unfinished and future bars never alter indicators or the last closed timestamp", () => {
  const closed = bars(Array.from({ length: 50 }, (_, i) => 100 + i));
  const now = clock(closed, INTERVAL / 2);
  const incomplete = { time: closed.at(-1).time + INTERVAL, open: 1, high: 999, low: 0, close: 900 };
  const future = { ...incomplete, time: incomplete.time + INTERVAL };
  const before = analyze(closed, { now });
  const after = analyze([...closed, incomplete, future], { now });
  assert.equal(after.candleCount, 50);
  assert.equal(after.asOf, before.asOf);
  assert.equal(after.indicators.ema20.value, before.indicators.ema20.value);
  assert.equal(after.dataQuality.incompleteRows, 1);
  assert.equal(after.dataQuality.futureRows, 1);
  assert.equal(after.status, "ready");
});

test("invalid OHLC, non-finite data and malformed times are rejected without input mutation", () => {
  const valid = bars(Array.from({ length: 50 }, (_, i) => 100 + i));
  const sample = valid[10];
  const invalid = [
    { ...sample, close: Infinity }, { ...sample, open: NaN }, { ...sample, close: "110" },
    { ...sample, high: sample.low - 1 }, { ...sample, open: sample.high + 1 },
    { ...sample, close: sample.low - 1 }, { ...sample, time: String(sample.time) },
    { ...sample, time: -1 }, { ...sample, volume: -1 }, null,
  ];
  const input = [...valid, ...invalid];
  const snapshot = structuredClone(input);
  const result = analyze(input, { now: clock(valid) });
  assert.equal(result.candleCount, 50);
  assert.equal(result.dataQuality.invalidRows, invalid.length);
  assert.equal(result.status, "ready");
  assert.deepEqual(input, snapshot);
});

test("timestamps are sorted and equal duplicate bars are counted once", () => {
  const ascending = bars(Array.from({ length: 50 }, (_, i) => 100 + i));
  const result = analyze([...ascending].reverse().concat({ ...ascending[4] }), { now: clock(ascending) });
  const expected = analyze(ascending);
  assert.equal(result.candleCount, 50);
  assert.equal(result.dataQuality.duplicateRows, 1);
  assert.equal(result.dataQuality.gaps, 0);
  assert.equal(result.indicators.ema20.value, expected.indicators.ema20.value);
  assert.equal(result.indicators.rsi14.value, expected.indicators.rsi14.value);
});

test("conflicting historical duplicates are discarded rather than arbitrarily choosing a price", () => {
  const candles = bars(Array.from({ length: 51 }, (_, i) => 100 + i));
  const conflict = { ...candles[20], close: candles[20].close + 0.25 };
  const result = analyze([...candles, conflict], { now: clock(candles) });
  const reversed = analyze([conflict, ...candles], { now: clock(candles) });
  assert.equal(result.candleCount, 50);
  assert.equal(result.dataQuality.conflictingTimestamps, 1);
  assert.equal(result.dataQuality.gaps, 1);
  assert.equal(result.indicators.ema20.value, reversed.indicators.ema20.value);
  assert.ok(result.reasons.some((reason) => reason.includes("متعارضة")));
  assert.ok(result.reasons.some((reason) => reason.includes("فواصل")));
});

test("freshness is based on candle close and interval, including stale partial histories", () => {
  const candles = bars(Array.from({ length: 50 }, (_, i) => 100 + i));
  assert.equal(analyze(candles, { now: clock(candles, 2 * INTERVAL - 1) }).status, "ready");
  const stale = analyze(candles, { now: clock(candles, 2 * INTERVAL) });
  assert.equal(stale.status, "stale");
  assert.equal(stale.isCurrent, false);
  assert.equal(stale.dataQuality.ageSeconds, 7200);
  assert.equal(stale.asOf, new Date(clock(candles)).toISOString());
  assert.ok(stale.reasons.some((reason) => reason.includes("ليست قراءة لحظية")));
  const partial = candles.slice(0, 14);
  assert.equal(analyze(partial, { now: clock(partial, 2 * INTERVAL) }).status, "stale");
});

test("one-minute analysis closes on the exact minute and excludes the open candle", () => {
  const start = Date.UTC(2026, 9, 30, 10) / 1000;
  const candles = bars(Array.from({ length: 61 }, (_, index) => 100 + index), { start, interval: 60 });
  const result = analyzeCandles({ candles, intervalSeconds: 60, now: (start + 60 * 60 + 30) * 1000 });
  assert.equal(result.status, "ready");
  assert.equal(result.candleCount, 60);
  assert.equal(result.lastClose, 159);
  assert.equal(result.asOf, "2026-10-30T11:00:00.000Z");
  assert.equal(result.dataQuality.incompleteRows, 1);
  assert.equal(result.dataQuality.ageSeconds, 30);
  assert.equal(result.dataQuality.staleAfterSeconds, 120);
});

function monthBars(count, { year = 2024, month = 0 } = {}) {
  return bars(Array.from({ length: count }, (_, index) => 100 + index))
    .map((row, index) => ({ ...row, time: Date.UTC(year, month + index, 1) / 1000 }));
}

test("calendar analysis uses actual month ends, including leap February, without false gaps", () => {
  for (const year of [2023, 2024]) {
    const candles = monthBars(4, { year });
    const result = analyzeCandles({ candles, intervalSeconds: null, calendarPeriod: "month", now: Date.UTC(year, 3, 1) - 1 });
    assert.equal(result.calendarPeriod, "month");
    assert.equal(result.intervalSeconds, null);
    assert.equal(result.candleCount, 2);
    assert.equal(result.lastCandleTime, Date.UTC(year, 1, 1) / 1000);
    assert.equal(result.asOf, new Date(Date.UTC(year, 2, 1)).toISOString());
    assert.equal(result.dataQuality.gaps, 0);
    assert.equal(result.dataQuality.incompleteRows, 1);
    assert.equal(result.dataQuality.futureRows, 1);
    const boundary = analyzeCandles({ candles, calendarPeriod: "month", now: Date.UTC(year, 3, 1) });
    assert.equal(boundary.candleCount, 3);
    assert.equal(boundary.asOf, new Date(Date.UTC(year, 3, 1)).toISOString());
    assert.ok(boundary.reasons.some((reason) => reason.includes("أشهر تقويمية") && reason.includes("UTC")));
  }
});

test("a 23-month public history exposes real RSI/ATR/EMA20 and reports absent EMA50 and MACD", () => {
  const candles = monthBars(23);
  const result = analyzeCandles({ candles, calendarPeriod: "month", now: Date.UTC(2025, 11, 1) });
  assert.equal(result.status, "insufficient");
  assert.equal(result.isCurrent, true);
  assert.equal(result.candleCount, 23);
  assert.equal(result.indicators.ema20.available, true);
  assert.equal(result.indicators.ema50.available, false);
  assert.equal(result.indicators.rsi14.available, true);
  assert.equal(result.indicators.atr14.available, true);
  assert.equal(result.indicators.macd.available, false);
  assert.equal(result.indicators.supportResistance.available, true);
  assert.deepEqual(Array.from(result.missingIndicators), ["ema50", "macd"]);
  assert.equal(result.missingIndicatorDetails.find((item) => item.key === "ema50").availableBars, 23);
  assert.equal(result.missingIndicatorDetails.find((item) => item.key === "macd").requiredBars, 34);
});

test("calendar freshness advances by two calendar periods, not a fixed 60-day month approximation", () => {
  const candles = monthBars(1, { year: 2025 }); // January closes on February 1.
  const before = analyzeCandles({ candles, calendarPeriod: "month", now: Date.UTC(2025, 3, 1) - 1 });
  const boundary = analyzeCandles({ candles, calendarPeriod: "month", now: Date.UTC(2025, 3, 1) });
  assert.equal(before.isCurrent, true);
  assert.equal(boundary.status, "stale");
  assert.equal(boundary.isCurrent, false);
  assert.equal(boundary.asOf, "2025-02-01T00:00:00.000Z");
  assert.equal(boundary.dataQuality.staleAfterSeconds, (28 + 31) * 86400);
  assert.equal(boundary.dataQuality.ageSeconds, (28 + 31) * 86400);
});

test("weekly analysis requires UTC Monday alignment and handles a year boundary", () => {
  const monday = Date.UTC(2024, 11, 30) / 1000, week = 7 * 86400;
  const candles = bars([100, 101, 102, 103], { start: monday, interval: week });
  const sunday = { ...candles[0], time: monday - 86400 };
  const result = analyzeCandles({ candles: [...candles, sunday], calendarPeriod: "week", now: (monday + 2 * week + 86400) * 1000 });
  assert.equal(result.candleCount, 2);
  assert.equal(result.asOf, "2025-01-13T00:00:00.000Z");
  assert.equal(result.dataQuality.gaps, 0);
  assert.equal(result.dataQuality.invalidRows, 1);
  assert.equal(result.dataQuality.incompleteRows, 1);
  assert.equal(result.dataQuality.futureRows, 1);
  assert.equal(result.dataQuality.staleAfterSeconds, 14 * 86400);
  assert.ok(result.reasons.some((reason) => reason.includes("الإثنين") && reason.includes("UTC")));
});

test("calendar gap detection rejects misaligned bars and counts missing calendar periods", () => {
  const candles = monthBars(4).filter((_, index) => index !== 1);
  const misaligned = { ...candles[0], time: Date.UTC(2024, 0, 2) / 1000 };
  const result = analyzeCandles({ candles: [...candles, misaligned], calendarPeriod: "month", now: Date.UTC(2024, 4, 1) });
  assert.equal(result.candleCount, 3);
  assert.equal(result.dataQuality.invalidRows, 1);
  assert.equal(result.dataQuality.gaps, 1);
  for (const invalid of [{ calendarPeriod: "30D" }, { calendarPeriod: "month", intervalSeconds: 30 * 86400 }, { calendarPeriod: "week", intervalSeconds: 604800 }]) {
    assert.equal(analyzeCandles({ candles, now: Date.UTC(2024, 4, 1), ...invalid }).status, "unavailable");
  }
});

test("zero/empty data and invalid options return unavailable instead of fabricated numbers", () => {
  for (const input of [{}, null, { candles: [] }, { candles: "bad" }, { intervalSeconds: 0 }, { now: NaN }]) {
    const result = analyzeCandles(input);
    assert.equal(result.status, "unavailable");
    assert.equal(result.asOf, null);
    assert.equal(result.lastClose, null);
    assert.equal(result.isCurrent, false);
    assert.equal(result.indicators.ema20.value, null);
    assert.equal(result.agreement.total, 0);
  }
});

test("indicator values keep precision for small-price instruments", () => {
  const candles = bars(Array.from({ length: 50 }, (_, i) => (100 + i) * 1e-12), { width: 0.1e-12 });
  const result = analyze(candles);
  assert.equal(result.status, "ready");
  assert.ok(result.indicators.ema20.value > 0);
  near(result.indicators.ema20.value, 139.5e-12, 1e-25);
  assert.ok(result.indicators.atr14.value > 0);
  assert.equal(result.direction, "bullish");
});
