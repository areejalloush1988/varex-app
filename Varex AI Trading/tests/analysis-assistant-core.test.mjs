import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ TextEncoder, URL, console });
vm.runInContext(fs.readFileSync(new URL("../market-analysis.js", import.meta.url), "utf8"), context);
vm.runInContext(fs.readFileSync(new URL("../analysis-assistant-core.js", import.meta.url), "utf8"), context);
const core = context.VarexAnalysisAssistantCore;
const start = Date.parse("2026-10-30T08:00:00Z") / 1000;
const now = (start + 70 * 60) * 1000;
const opts = { symbol: "XAU-USD", interval: "1", source: "fixture only", now };
const bars = Array.from({ length: 70 }, (_, i) => ({ time: start + i * 60, open: 2000 + i, high: 2002 + i, low: 1999 + i, close: 2001 + i }));
const csv = (candles = bars) => "time,open,high,low,close\n" + candles.map((c) => [c.time, c.open, c.high, c.low, c.close].join(",")).join("\n");
const plain = (value) => JSON.parse(JSON.stringify(value));
const throwsCode = (fn, code) => assert.throws(fn, (e) => e.name === "AnalysisInputError" && e.code === code);

test("core validates explicit metadata and exposes stable API", () => {
  assert.equal(typeof core.parseCSV, "function");
  assert.equal(core.parseCsv, core.parseCSV);
  throwsCode(() => core.parseCSV(csv(), { ...opts, symbol: "" }), "invalid_symbol");
  throwsCode(() => core.parseCSV(csv(), { ...opts, source: "" }), "invalid_source");
  throwsCode(() => core.parseCSV(csv(), { ...opts, source: "<script>x</script>" }), "invalid_source");
  throwsCode(() => core.parseCSV(csv(), { ...opts, interval: "2h" }), "invalid_interval");
});

test("CSV parses ordered and reversed Unix candles identically without inventing volume", () => {
  const forward = core.parseCSV(csv(), opts);
  const reversed = core.parseCSV(csv([...bars].reverse()), opts);
  assert.deepEqual(plain(forward.candles), bars);
  assert.deepEqual(plain(reversed.candles), bars);
  assert.equal(forward.intervalSeconds, 60);
  assert.equal(forward.imported, true);
  assert.equal(forward.allowExport, true);
  assert.equal("volume" in forward.candles[0], false);
});

test("ISO timezone and Unix milliseconds represent the same original timestamp", () => {
  const ms = csv([bars[0]]).replace(String(start), String(start * 1000));
  const iso = csv([bars[0]]).replace(String(start), "2026-10-30T12:00:00+04:00");
  assert.equal(core.parseCSV(ms, opts).candles[0].time, start);
  assert.equal(core.parseCSV(iso, opts).candles[0].time, start);
});

test("naive local timestamps require explicit timezone, including MT-style export", () => {
  const text = "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>\n2026.10.30\t12:00:00\t2000\t2002\t1999\t2001\t120\t0\t5";
  throwsCode(() => core.parseCSV(text, opts), "timezone_required");
  const result = core.parseCSV(text, { ...opts, timezoneOffsetMinutes: 240 });
  assert.equal(result.candles[0].time, start);
  assert.equal(result.candles[0].volume, 0);
});

test("quoted semicolon CSV, BOM and CRLF are supported", () => {
  const text = '\uFEFF"date";"open";"high";"low";"close"\r\n"2026-10-30T08:00:00Z";2000;2002;1999;2001\r\n';
  assert.deepEqual(plain(core.parseCSV(text, opts).candles), [bars[0]]);
});

test("invalid dates, malformed quoting, nonnumeric prices, invalid OHLC and volume are rejected", () => {
  throwsCode(() => core.parseCSV(csv([bars[0]]).replace(String(start), "2026-02-29T00:00:00Z"), opts), "invalid_timestamp");
  throwsCode(() => core.parseCSV('time,open,high,low,close\n"2026-10-30T08:00:00Z,2000,2002,1999,2001', opts), "invalid_csv");
  throwsCode(() => core.parseCSV(csv([bars[0]]).replace(",2000,", ",NaN,"), opts), "invalid_candle");
  throwsCode(() => core.parseCSV(csv([{ ...bars[0], high: 1900 }]), opts), "invalid_candle");
  throwsCode(() => core.parseCSV(csv([bars[0]]).replace("close\n", "close,volume\n") + ",-1", opts), "invalid_candle");
});

test("CSV shape, contradictory embedded symbol and file limits are enforced", () => {
  throwsCode(() => core.parseCSV("", opts), "empty_csv");
  throwsCode(() => core.parseCSV("time,open,high,low,close", opts), "empty_csv");
  throwsCode(() => core.parseCSV("time,open,open,high,low,close\n1,1,1,1,1,1", opts), "duplicate_header");
  throwsCode(() => core.parseCSV("time,open,high,low\n1,1,1,1", opts), "missing_columns");
  throwsCode(() => core.parseCSV(csv([bars[0]]) + ",99", opts), "column_count");
  throwsCode(() => core.parseCSV(csv([bars[0]]).replace("close\n", "close,symbol\n") + ",BTC-USD", opts), "symbol_mismatch");
  throwsCode(() => core.parseCSV("x".repeat(4 * 1024 * 1024 + 1), opts), "file_too_large");
});

test("identical duplicates collapse, conflicting duplicates fail, futures fail", () => {
  const dedup = core.parseCSV(csv([bars[0], bars[0]]), opts);
  assert.equal(dedup.candles.length, 1);
  assert.match(dedup.warnings.join(" "), /متطابقة/);
  throwsCode(() => core.parseCSV(csv([bars[0], { ...bars[0], close: 2000 }]), opts), "conflicting_candles");
  throwsCode(() => core.parseCSV(csv([{ ...bars[0], time: now / 1000 + 60 }]), opts), "future_candle");
});

test("wrong interval is rejected, legitimate session-offset daily candles accepted without filling", () => {
  throwsCode(() => core.parseCSV(csv(), { ...opts, interval: "60" }), "interval_mismatch");
  const day = Date.parse("2026-10-26T22:00:00Z") / 1000;
  const daily = [0, 1, 2].map((i) => ({ ...bars[0], time: day + i * 86400 }));
  const data = core.parseCSV(csv(daily), { ...opts, interval: "D" });
  assert.equal(data.candles.length, 3);
  assert.equal(data.candles[0].time, day);
});

test("weekly and monthly imports use real calendar boundaries and never fill nontrading days", () => {
  const weekly = ["2026-10-05", "2026-10-12", "2026-10-19"].map((d) => ({ ...bars[0], time: Date.parse(d + "T00:00:00Z") / 1000 }));
  assert.equal(core.parseCSV(csv(weekly), { ...opts, interval: "W" }).candles.length, 3);
  throwsCode(() => core.parseCSV(csv([{ ...weekly[0], time: weekly[0].time + 86400 }]), { ...opts, interval: "W" }), "interval_mismatch");
  const months = ["2026-01-01", "2026-02-01", "2026-03-01"].map((d) => ({ ...bars[0], time: Date.parse(d + "T00:00:00Z") / 1000 }));
  const monthly = core.parseCSV(csv(months), { ...opts, interval: "M" });
  assert.equal(monthly.intervalSeconds, null);
  assert.equal(monthly.calendarPeriod, "month");
  assert.equal(core.createReport(monthly, { now }).analysis.candleCount, 3);
});

test("report derives exact levels and last close from closed candles and doesn't mutate input", () => {
  const dataset = core.parseCSV(csv(), opts), before = JSON.stringify(dataset);
  const report = core.createReport(dataset, { now });
  assert.equal(report.status, "ready");
  assert.equal(report.method, "technical-calculation");
  assert.equal(report.allowExport, true);
  assert.equal(report.lastClose, bars.at(-1).close);
  assert.equal(report.levels.support, Math.min(...bars.slice(-21, -1).map((c) => c.low)));
  assert.equal(report.levels.resistance, Math.max(...bars.slice(-21, -1).map((c) => c.high)));
  assert.equal(report.asOf, new Date(now).toISOString());
  assert.equal(report.scenarios.length, 2);
  assert.equal(report.quality.sourceVerified, false);
  assert.equal("confidence" in report, false);
  assert.equal(JSON.stringify(dataset), before);
});

test("unfinished candles cannot alter levels or indicator calculations", () => {
  const data = core.parseCSV(csv([...bars, { time: now / 1000, open: 9000, high: 10000, low: 8000, close: 9500 }]), opts);
  const report = core.createReport(data, { now });
  assert.equal(report.lastClose, bars.at(-1).close);
  assert.equal(report.analysis.candleCount, bars.length);
  assert.equal(report.quality.incompleteRows, 1);
});

test("gaps are retained and flagged, not silently interpolated", () => {
  const data = core.parseCSV(csv(bars.filter((_, i) => i !== 35)), opts);
  const report = core.createReport(data, { now });
  assert.equal(report.analysis.candleCount, 69);
  assert.equal(report.quality.gaps, 1);
  assert.equal(report.status, "limited");
  assert.equal(report.quality.isCurrent, false);
  assert.match(report.warnings.join(" "), /إغلاق السوق أو نقص البيانات/);
});

test("weekend/old data remains historical without asserting live market state", () => {
  const data = core.parseCSV(csv(), opts);
  const report = core.createReport(data, { now: now + 3 * 86400000 });
  assert.equal(report.status, "stale");
  assert.equal(report.quality.isCurrent, false);
  assert.equal(report.scenarios[0].scope, "historical");
  assert.match(report.summary, /تاريخية/);
  assert.match(core.answerQuestion("حلل الذهب اليوم", report).text, /تاريخية/);
  assert.match(report.warnings.join(" "), /لا نؤكد السبب/);
});

test("insufficient or empty history never invents indicators or support levels", () => {
  const report = core.createReport(core.parseCSV(csv([bars[0]]), opts), { now: (start + 60) * 1000 });
  assert.equal(report.status, "insufficient");
  assert.equal(report.levels.support, null);
  assert.equal(report.scenarios.length, 0);
  assert.match(core.answerQuestion("الدعم والمقاومة", report).text, /لا أخمّن/);
  const empty = core.createReport({ ...opts, candles: [] }, { now });
  assert.equal(empty.status, "unavailable");
  assert.equal(empty.lastClose, null);
  assert.equal(core.answerQuestion("حلل الذهب اليوم", empty).intent, "data_required");
});

test("answers are grounded, scoped, explicitly local and never echo injected question HTML", () => {
  const report = core.createReport(core.parseCSV(csv(), opts), { now });
  const levels = core.answerQuestion("اشرح الدعم والمقاومة", report);
  assert.equal(levels.generated, false);
  assert.equal(levels.mode, "local-explanation");
  assert.ok(levels.text.includes(core.formatPrice(report.levels.support)));
  assert.equal(core.answerQuestion("حلل البيتكوين اليوم", report).intent, "different_market");
  assert.equal(core.answerQuestion("شو اخبار الذهب", report).intent, "news");
  assert.equal(core.answerQuestion("اشتري ولا أبيع", report).intent, "trade_request");
  assert.equal(core.answerQuestion("ارباح مضمونة؟", report).intent, "uncertainty");
  assert.equal(core.answerQuestion("شو يعني RSI", report).intent, "rsi");
  assert.equal(core.answerQuestion("فسر MACD", report).intent, "macd");
  assert.equal(core.answerQuestion("اشرح ATR", report).intent, "volatility");
  assert.equal(core.answerQuestion("اشرح ADX", report).intent, "adx");
  assert.equal(core.answerQuestion("شو يعني فريم الساعة", report).intent, "timeframe");
  assert.equal(core.answerQuestion("سيناريو الاختراق", report).intent, "scenarios");
  assert.equal(core.answerQuestion("هل رح يصعد؟", report).intent, "analysis");
  assert.equal(core.answerQuestion("<script>steal()</script>", report).text.includes("<script>"), false);
});

test("unavailable report still explains indicators but never guesses current prices", () => {
  assert.equal(core.answerQuestion("اشرح RSI", null).intent, "rsi");
  assert.equal(core.answerQuestion("شو يعني دعم ومقاومة", null).intent, "levels_definition");
  assert.equal(core.answerQuestion("حلل الذهب", null).intent, "data_required");
  assert.equal(core.answerQuestion("هل في اخبار اليوم؟", null).intent, "news");
  throwsCode(() => core.answerQuestion("", null), "invalid_question");
  throwsCode(() => core.answerQuestion("x".repeat(2001), null), "invalid_question");
});

test("direct dataset validation rejects forged duration and invalid values", () => {
  const data = core.parseCSV(csv(), opts);
  throwsCode(() => core.createReport({ ...data, intervalSeconds: 3600 }, { now }), "interval_mismatch");
  throwsCode(() => core.createReport({ ...data, candles: [{ ...bars[0], close: Infinity }] }, { now }), "invalid_candle");
  assert.equal(core.formatPrice(NaN), "غير متاح");
  assert.equal(core.formatPrice(0.00000012), "0.00000012");
});

test("reports preserve display attribution and export restrictions without unsafe source URLs", () => {
  const data = core.parseCSV(csv(), opts);
  const report = core.createReport({ ...data, provider: "provider-fixture", allowExport: false,
    provenance: { url: "https://example.test/feed", attribution: "Fixture provider", displayOnly: true, delaySeconds: null } }, { now });
  assert.equal(report.provider, "provider-fixture");
  assert.equal(report.provenance.url, "https://example.test/feed");
  assert.equal(report.provenance.attribution, "Fixture provider");
  assert.equal(report.provenance.displayOnly, true);
  assert.equal(report.allowExport, false);
  const unsafe = core.createReport({ ...data, provenance: { url: "javascript:alert(1)" } }, { now });
  assert.equal(unsafe.provenance.url, null);
  const canonical = core.createReport({ ...data, sourceUrl: "https://example.test/canonical" }, { now });
  assert.equal(canonical.provenance.url, "https://example.test/canonical");
});

test("a provider's stale flag remains historical even when candle timestamps look recent", () => {
  const data = { ...core.parseCSV(csv(), opts), imported: false, quality: { freshness: "aged" } };
  const before = JSON.stringify(data);
  const report = core.createReport(data, { now });
  assert.equal(report.asOf, new Date(now).toISOString());
  assert.equal(report.status, "stale");
  assert.equal(report.analysis.status, "stale");
  assert.equal(report.analysis.isCurrent, false);
  assert.equal(report.quality.isCurrent, false);
  assert.equal(report.quality.sourceFlaggedStale, true);
  assert.equal(report.scenarios.every((scenario) => scenario.scope === "historical"), true);
  assert.match(report.warnings.join(" "), /المصدر وضع علامة تأخر/);
  assert.match(core.answerQuestion("حلل الذهب اليوم", report).text, /تاريخية/);
  assert.equal(JSON.stringify(data), before);
});
