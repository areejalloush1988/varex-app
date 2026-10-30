import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../market-workspace.js", import.meta.url), "utf8");
const analysisSource = readFileSync(new URL("../market-analysis.js", import.meta.url), "utf8");
const now = Date.parse("2026-10-30T12:05:00Z");
const clock = class extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
};
function moduleApi(script, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(script, { module, Intl, Date: clock, ...extra });
  return module.exports;
}
const workspaceApi = moduleApi(source);
const analysisApi = moduleApi(analysisSource);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("research catalogue grants execution metadata only to the original four instruments", () => {
  assert.deepEqual(plain(workspaceApi.catalogue.filter((item) => item.executionSymbol).map((item) => [item.id, item.executionSymbol])), [
    ["BTC-USD", "BTC-USD"], ["ETH-USD", "ETH-USD"], ["SOL-USD", "SOL-USD"], ["ADA-USD", "ADA-USD"],
  ]);
  for (const input of ["UNKNOWN", "BTC-USDT", "__proto__", null, {}, ["BTC-USD"]]) assert.equal(workspaceApi.getMarket(input), null);
  for (const item of workspaceApi.catalogue) {
    assert.equal(workspaceApi.getMarket(item.id), item);
    assert.equal(workspaceApi.getMarket(item.tvSymbol), item);
    assert.ok(Object.isFrozen(item));
  }
  assert.ok(workspaceApi.filterMarkets({ query: "eur / usd" }).some((item) => item.id === "EURUSD"));
  assert.deepEqual(plain(workspaceApi.filterMarkets({ category: "favorites", favorites: ["XAUUSD", "UNKNOWN"] }).map((item) => item.id)), ["XAUUSD"]);
  assert.deepEqual(plain(workspaceApi.readFavorites({ getItem: () => JSON.stringify(["UNKNOWN", "BTC-USD", "BTC-USD"]) })), ["BTC-USD"]);
});

test("chart and technical configurations share exact instrument/timeframe and prevent independent symbol/range changes", () => {
  for (const item of workspaceApi.catalogue) for (const interval of workspaceApi.intervals) for (const theme of ["dark", "light"]) {
    const chart = workspaceApi.widgetConfig("chart", item, interval.id, theme);
    const technical = workspaceApi.widgetConfig("technical", item, interval.id, theme);
    assert.equal(chart.symbol, item.tvSymbol);
    assert.equal(technical.symbol, item.tvSymbol);
    assert.equal(chart.interval, interval.id);
    assert.equal(technical.interval, interval.technical);
    assert.equal(chart.allow_symbol_change, false);
    assert.equal(chart.hide_top_toolbar, true);
    assert.equal(chart.hide_legend, true);
    assert.equal(chart.withdateranges, false);
    assert.equal(technical.showIntervalTabs, false);
    assert.equal(chart.theme, theme);
    assert.equal(technical.colorTheme, theme);
  }
  assert.throws(() => workspaceApi.widgetConfig("chart", { ...workspaceApi.catalogue[0], tvSymbol: "UNKNOWN" }, "60", "dark"));
  assert.throws(() => workspaceApi.widgetConfig("chart", workspaceApi.catalogue[0], "wrong", "dark"));
});

function candles(symbol = "BTC-USD", interval = "60", age = 0, sourceName = "Coinbase Exchange") {
  const seconds = workspaceApi.intervals.find((item) => item.id === interval).seconds;
  const end = Math.floor(now / 1000 / seconds) * seconds - age;
  return { symbol, intervalSeconds: seconds, source: sourceName, candles: Array.from({ length: 70 }, (_, index) => ({
    time: end - (70 - index) * seconds, open: 100 + index, close: 101 + index,
    high: 102 + index, low: 99 + index, volume: 50 + index,
  })) };
}

test("analysis labels disclose source, Dubai candle close time, partial history and stale readings", () => {
  const ready = analysisApi.analyzeCandles({ ...candles(), now });
  const readyHtml = workspaceApi.analysisHtml(ready);
  assert.match(readyHtml, /Coinbase Exchange/);
  assert.match(readyHtml, /آخر شمعة مغلقة/);
  assert.match(readyHtml, /توقيت دبي/);
  assert.match(readyHtml, /ليس احتمال ربح/);
  const stale = analysisApi.analyzeCandles({ ...candles("BTC-USD", "60", 6 * 3600), now });
  assert.equal(stale.status, "stale");
  assert.match(workspaceApi.analysisHtml(stale), /بيانات قديمة/);
  assert.match(workspaceApi.analysisHtml(stale), /قراءة تاريخية/);
  const partial = analysisApi.analyzeCandles({ ...candles(), candles: candles().candles.slice(-20), now });
  assert.equal(partial.status, "insufficient");
  assert.match(workspaceApi.analysisHtml(partial), /تاريخ جزئي/);
  assert.match(workspaceApi.analysisHtml({ ...ready, source: '<img src=x onerror="bad()">' }), /&lt;img/);
  assert.doesNotMatch(workspaceApi.analysisHtml({ ...ready, source: '<img src=x onerror="bad()">' }), /<img/);
  assert.match(workspaceApi.analysisHtml({ status: "unavailable" }), /البيانات غير متاحة/);
});

// Minimal offline DOM/event host: scripts are recorded but never loaded or run.
// This tests the actual workspace lifecycle, not browser layout or vendor code.
class Node {
  constructor(tag, document) {
    this.tagName = tag.toLowerCase(); this.ownerDocument = document; this.children = [];
    this.attributes = new Map(); this.dataset = {}; this.listeners = new Map(); this._html = ""; this._text = "";
    this.classList = { toggle: (name, enabled) => {
      const names = new Set((this.attributes.get("class") || "").split(/\s+/).filter(Boolean));
      if (enabled) names.add(name); else names.delete(name);
      this.attributes.set("class", [...names].join(" "));
    } };
  }
  setAttribute(name, value = "") {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...nodes) { for (const child of nodes) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...nodes) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this.append(...nodes); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  set innerHTML(html) {
    this._html = String(html); this._text = ""; this.replaceChildren();
    const stack = [this];
    for (const token of this._html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith("</")) { if (stack.length > 1) stack.pop(); continue; }
      const tag = /^<([\w-]+)/.exec(token);
      if (!tag) { const node = new Node("#text", this.ownerDocument); node._text = token; stack.at(-1).append(node); continue; }
      const node = new Node(tag[1], this.ownerDocument);
      const attributes = token.slice(tag[0].length, -1);
      for (const match of attributes.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) node.setAttribute(match[1], match[2] ?? match[3] ?? match[4] ?? "");
      stack.at(-1).append(node);
      if (!/^(input|br|hr|img|meta|link)$/i.test(node.tagName) && !token.endsWith("/>")) stack.push(node);
    }
  }
  get innerHTML() { return this._html; }
  matches(selector) {
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    return this.tagName === selector.toLowerCase();
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatch(name, target = this) { for (const callback of this.listeners.get(name) || []) callback({ type: name, target }); }
  focus() { this.ownerDocument.activeElement = this; }
}

function host(options = {}, load) {
  const timers = new Map(), dataCalls = [], selected = [], trades = [], writes = [];
  let timerId = 0;
  const document = new Node("document"); document.ownerDocument = document;
  document.createElement = (tag) => new Node(tag, document);
  document.documentElement = document.createElement("html"); document.documentElement.dataset.theme = "dark";
  document.visibilityState = "visible";
  const window = {
    localStorage: { getItem: () => null, setItem: (...args) => writes.push(args) }, AbortController,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} },
    VarexMarketAnalysis: analysisApi,
    VarexMarketData: { loadCandles: (args) => { dataCalls.push(args); return load ? load(args) : Promise.resolve(candles(args.symbol, args.interval)); } },
    fetch: () => { throw new Error("Workspace must not call an application API"); },
  };
  document.defaultView = window;
  const container = document.createElement("div"); document.documentElement.append(container);
  const api = moduleApi(source, { window });
  const instance = api.mount(container, { initialSymbol: "EURUSD", onSelect: (value) => selected.push(value), onTrade: (value) => trades.push(value), ...options });
  return { api, instance, container, document, window, dataCalls, timers, selected, trades, writes,
    click: (selector) => { const target = container.querySelector(selector); assert.ok(target, `Missing ${selector}`); container.dispatch("click", target); },
    configs: () => container.querySelectorAll("script").map((script) => ({ src: script.src, config: JSON.parse(script.textContent) })),
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("selection, timeframe, search and favorites only update the read-only workspace", async () => {
  const h = host();
  assert.equal(h.dataCalls.length, 0);
  assert.equal(h.instance.select("UNKNOWN"), false);
  assert.equal(h.instance.selection().id, "EURUSD");
  h.click('[data-mw-symbol="XAUUSD"]');
  h.click('[data-mw-interval="15"]');
  const configs = h.configs();
  assert.equal(configs.length, 2);
  assert.equal(configs[0].config.symbol, "OANDA:XAUUSD");
  assert.equal(configs[0].config.interval, "15");
  assert.equal(configs[1].config.symbol, "OANDA:XAUUSD");
  assert.equal(configs[1].config.interval, "15m");
  h.click('[data-mw-favorite="XAUUSD"]');
  assert.equal(h.writes.length, 1);
  assert.match(h.writes[0][0], /researchWatchlist/);
  const search = h.container.querySelector("[data-mw-search]"); search.value = "AAPL"; h.container.dispatch("input", search);
  assert.match(h.container.querySelector("[data-mw-count]").textContent, /^1 \/ /);
  assert.equal(h.dataCalls.length, 0);
  assert.equal(h.trades.length, 0);
  assert.equal(h.container.querySelector("[data-mw-trade]"), null);
  h.instance.destroy(); assert.equal(h.timers.size, 0);
});

test("crypto inspection loads candles for the exact interval and explicit preparation is limited to authorized original instruments", async () => {
  const h = host({ initialSymbol: "BTC-USD", authenticated: true, canTrade: true });
  await flush();
  assert.equal(h.dataCalls[0].symbol, "BTC-USD");
  assert.equal(h.dataCalls[0].interval, "60");
  assert.match(h.container.querySelector("[data-mw-analysis]").innerHTML, /Coinbase Exchange/);
  assert.equal(h.trades.length, 0);
  h.click("[data-mw-trade]");
  assert.deepEqual(h.trades, ["BTC-USD"]);
  h.instance.select("ETH-USD", "240"); await flush();
  assert.equal(h.dataCalls.at(-1).symbol, "ETH-USD");
  assert.equal(h.dataCalls.at(-1).interval, "240");
  h.instance.select("XAUUSD");
  assert.equal(h.container.querySelector("[data-mw-trade]"), null);
  assert.deepEqual(h.trades, ["BTC-USD"]);
  h.instance.destroy();
  for (const options of [{ authenticated: false, canTrade: true }, { authenticated: true, canTrade: false }]) {
    const readonly = host({ initialSymbol: "BTC-USD", ...options }); await flush();
    assert.equal(readonly.container.querySelector("[data-mw-trade]"), null);
    assert.equal(readonly.trades.length, 0); readonly.instance.destroy();
  }
});

test("old cancelled responses cannot overwrite a newer symbol and failed refresh removes the prior reading", async () => {
  const pending = [];
  const h = host({ initialSymbol: "BTC-USD" }, (args) => new Promise((resolve, reject) => pending.push({ args, resolve, reject })));
  h.instance.select("ETH-USD", "15");
  assert.equal(pending[0].args.signal.aborted, true);
  pending[0].resolve(candles("BTC-USD", "60", 0, "OLD-BTC-RESPONSE")); await flush();
  assert.doesNotMatch(h.container.querySelector("[data-mw-analysis]").innerHTML, /OLD-BTC-RESPONSE/);
  pending[1].resolve(candles("ETH-USD", "15", 0, "Kraken")); await flush();
  assert.match(h.container.querySelector("[data-mw-analysis]").innerHTML, /Kraken/);
  const refreshed = h.instance.refresh(); pending[2].reject(new Error("offline provider failure")); await refreshed;
  assert.match(h.container.querySelector("[data-mw-analysis]").innerHTML, /تعذر جلب الشموع الحالية/);
  assert.doesNotMatch(h.container.querySelector("[data-mw-analysis]").innerHTML, /Kraken/);
  h.instance.refresh(); const before = h.container.querySelector("[data-mw-analysis]").innerHTML;
  h.instance.destroy(); assert.equal(pending[3].args.signal.aborted, true);
  pending[3].resolve(candles("ETH-USD", "15", 0, "LATE-DESTROYED-RESPONSE")); await flush();
  assert.equal(h.container.querySelector("[data-mw-analysis]").innerHTML, before);
  assert.equal(h.timers.size, 0);
  assert.equal(h.container.listeners.get("click").size, 0);
  assert.equal(h.document.listeners.get("visibilitychange").size, 0);
});

test("public markets survives back-forward cache and destroys only on final page departure", () => {
  const events = new Map(); let destroyed = 0, refreshed = 0, options;
  const window = {
    location: { search: "?symbol=XAUUSD&interval=240", href: "https://example.test/trading/markets.html?symbol=XAUUSD&interval=240" },
    history: { replaceState() {} },
    addEventListener: (name, callback) => events.set(name, callback),
    VarexMarketWorkspace: {
      getMarket: workspaceApi.getMarket,
      mount(_target, input) { options = input; return { destroy() { destroyed += 1; }, refresh() { refreshed += 1; } }; },
    },
  };
  const document = { readyState: "complete", getElementById: () => ({}) };
  vm.runInNewContext(readFileSync(new URL("../markets-page.js", import.meta.url), "utf8"), { window, document, URL, URLSearchParams });
  assert.equal(options.initialSymbol, "XAUUSD");
  assert.equal(options.interval, "240");
  assert.equal(options.authenticated, false);
  events.get("pagehide")({ persisted: true });
  assert.equal(destroyed, 0);
  events.get("pageshow")({ persisted: true });
  assert.equal(refreshed, 1);
  events.get("pagehide")({ persisted: false });
  assert.equal(destroyed, 1);
});
