(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VarexMarketData = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MAX_CANDLES = 350;
  const PROVIDER_TIMEOUT_MS = 8_000;
  const CACHE_TTL_MS = 15_000;
  const MARKETS = Object.freeze({
    "BTC-USD": { krakenPair: "XBTUSD", krakenKeys: ["XXBTZUSD", "XBTUSD"] },
    "ETH-USD": { krakenPair: "ETHUSD", krakenKeys: ["XETHZUSD", "ETHUSD"] },
    "SOL-USD": { krakenPair: "SOLUSD", krakenKeys: ["SOLUSD"] },
    "ADA-USD": { krakenPair: "ADAUSD", krakenKeys: ["ADAUSD"] },
  });
  const INTERVALS = Object.freeze({
    "5": { seconds: 300, coinbase: 300, kraken: 5 },
    "15": { seconds: 900, coinbase: 900, kraken: 15 },
    "60": { seconds: 3600, coinbase: 3600, kraken: 60 },
    "240": { seconds: 14400, coinbase: 3600, kraken: 240 },
    "D": { seconds: 86400, coinbase: 86400, kraken: 1440 },
  });
  const cache = new Map();
  const fetchPublic = typeof fetch === "function" ? fetch.bind(globalThis) : null;

  class MarketDataError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "MarketDataError";
      this.code = code;
    }
  }

  function abortReason(signal) {
    if (signal?.reason !== undefined) return signal.reason;
    const error = new Error("تم إلغاء طلب بيانات السوق.");
    error.name = "AbortError";
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) throw abortReason(signal);
  }

  function number(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return NaN;
    return Number(value);
  }

  function normalizeRecords(records) {
    const rows = new Map(), conflictingTimes = new Set();
    for (const input of records) {
      if (!input || typeof input !== "object") continue;
      const candle = {
        time: number(input.time), open: number(input.open), high: number(input.high),
        low: number(input.low), close: number(input.close), volume: number(input.volume),
      };
      if (!Number.isSafeInteger(candle.time) || candle.time < 0
        || ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
        || candle.volume < 0 || candle.low > candle.high
        || candle.open < candle.low || candle.open > candle.high
        || candle.close < candle.low || candle.close > candle.high) continue;
      if (conflictingTimes.has(candle.time)) continue;
      const previous = rows.get(candle.time);
      if (previous) {
        if (["open", "high", "low", "close", "volume"].some((key) => previous[key] !== candle[key])) {
          rows.delete(candle.time);
          conflictingTimes.add(candle.time);
        }
        continue;
      }
      rows.set(candle.time, candle);
    }
    return [...rows.values()].sort((a, b) => a.time - b.time);
  }

  function aggregateFourHourCandles(input) {
    const groups = new Map();
    for (const candle of normalizeRecords(Array.isArray(input) ? input : [])) {
      if (candle.time % 3600 !== 0) continue;
      const start = Math.floor(candle.time / 14400) * 14400;
      if (!groups.has(start)) groups.set(start, []);
      groups.get(start).push(candle);
    }
    const result = [];
    for (const [time, rows] of groups) {
      if (rows.length !== 4 || rows.some((candle, index) => candle.time !== time + index * 3600)) continue;
      const volume = rows.reduce((sum, candle) => sum + candle.volume, 0);
      if (!Number.isFinite(volume)) continue;
      result.push({
        time, open: rows[0].open, high: Math.max(...rows.map((candle) => candle.high)),
        low: Math.min(...rows.map((candle) => candle.low)), close: rows[3].close, volume,
      });
    }
    return result.sort((a, b) => a.time - b.time);
  }

  async function requestJson(url, callerSignal) {
    throwIfAborted(callerSignal);
    const controller = new AbortController();
    let timer, cancel;
    const cancellation = new Promise((_, reject) => {
      cancel = () => {
        const reason = abortReason(callerSignal);
        reject(reason);
        controller.abort(reason);
      };
      callerSignal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => {
        const error = new MarketDataError("provider_timeout", "انتهت مهلة مصدر بيانات السوق.");
        reject(error);
        controller.abort(error);
      }, PROVIDER_TIMEOUT_MS);
    });
    try {
      const request = (async () => {
        if (!fetchPublic) throw new MarketDataError("fetch_unavailable", "المتصفح لا يدعم جلب بيانات السوق.");
        const response = await fetchPublic(url, {
          method: "GET", mode: "cors", credentials: "omit", cache: "no-store",
          referrerPolicy: "no-referrer", headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response?.ok) throw new MarketDataError("provider_http_error", "مصدر بيانات السوق غير متاح حالياً.");
        return response.json();
      })();
      const result = await Promise.race([request, cancellation]);
      throwIfAborted(callerSignal);
      return result;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", cancel);
    }
  }

  function coinbaseCandles(payload, interval) {
    if (!Array.isArray(payload)) throw new MarketDataError("invalid_data", "أعاد المصدر بيانات شموع غير صالحة.");
    const records = payload.filter((row) => Array.isArray(row) && row.length >= 6).map((row) => ({
      time: row[0], low: row[1], high: row[2], open: row[3], close: row[4], volume: row[5],
    }));
    const normalized = normalizeRecords(records);
    const candles = interval === "240" ? aggregateFourHourCandles(normalized) : normalized;
    if (!candles.length) throw new MarketDataError("invalid_data", "لا تتوفر شموع صالحة للإطار الزمني المطلوب.");
    return candles.slice(-MAX_CANDLES);
  }

  function krakenCandles(payload, symbol) {
    if (!payload || !Array.isArray(payload.error) || payload.error.length
      || !payload.result || typeof payload.result !== "object" || Array.isArray(payload.result)) {
      throw new MarketDataError("invalid_data", "أعاد المصدر بيانات شموع غير صالحة.");
    }
    const arrays = Object.entries(payload.result).filter(([key, value]) => key !== "last" && Array.isArray(value));
    if (arrays.length !== 1 || !MARKETS[symbol].krakenKeys.includes(arrays[0][0])) {
      throw new MarketDataError("invalid_data", "لم تتطابق بيانات المصدر مع السوق المطلوب.");
    }
    const records = arrays[0][1].filter((row) => Array.isArray(row) && row.length >= 7).map((row) => ({
      time: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[6],
    }));
    const candles = normalizeRecords(records).slice(-MAX_CANDLES);
    if (!candles.length) throw new MarketDataError("invalid_data", "لا تتوفر شموع صالحة للإطار الزمني المطلوب.");
    return candles;
  }

  function cloneResult(value) {
    return { ...value, candles: value.candles.map((candle) => ({ ...candle })) };
  }

  async function loadCandles(options = {}) {
    const input = options !== null && typeof options === "object" ? options : {};
    const { symbol, signal } = input;
    const interval = input.interval === undefined ? "60" : input.interval;
    if (typeof symbol !== "string" || !Object.hasOwn(MARKETS, symbol)) {
      throw new MarketDataError("unsupported_symbol", "السوق المطلوب غير مدعوم في مصدر التحليل الحالي.");
    }
    if (typeof interval !== "string" || !Object.hasOwn(INTERVALS, interval)) {
      throw new MarketDataError("unsupported_interval", "الإطار الزمني المطلوب غير مدعوم.");
    }
    if (signal !== undefined && (signal === null || typeof signal.aborted !== "boolean"
      || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
      throw new MarketDataError("invalid_signal", "إشارة إلغاء الطلب غير صالحة.");
    }
    throwIfAborted(signal);
    const settings = INTERVALS[interval], key = symbol + ":" + interval, requestedAt = Date.now();
    const saved = cache.get(key);
    if (input.force !== true && saved && requestedAt >= saved.createdAt && requestedAt < saved.expiresAt) {
      return cloneResult(saved.value);
    }
    const providers = [
      {
        name: "Coinbase Exchange",
        url: "https://api.exchange.coinbase.com/products/" + symbol + "/candles?granularity=" + settings.coinbase,
        parse: (payload) => coinbaseCandles(payload, interval),
      },
      {
        name: "Kraken",
        url: "https://api.kraken.com/0/public/OHLC?pair=" + MARKETS[symbol].krakenPair + "&interval=" + settings.kraken,
        parse: (payload) => krakenCandles(payload, symbol),
      },
    ];
    const attempts = [];
    for (const provider of providers) {
      throwIfAborted(signal);
      try {
        const payload = await requestJson(provider.url, signal);
        throwIfAborted(signal);
        const candles = provider.parse(payload), receivedAt = Date.now();
        const result = {
          symbol, intervalSeconds: settings.seconds, candles, source: provider.name,
          receivedAt: new Date(receivedAt).toISOString(),
        };
        throwIfAborted(signal);
        cache.set(key, { value: cloneResult(result), createdAt: receivedAt, expiresAt: receivedAt + CACHE_TTL_MS });
        return result;
      } catch (error) {
        throwIfAborted(signal);
        attempts.push({ source: provider.name, code: error?.code || "provider_unavailable" });
      }
    }
    // Failed refreshes must not silently revive an earlier cached response.
    cache.delete(key);
    const error = new MarketDataError("sources_unavailable", "تعذر جلب شموع السوق من المصادر المتاحة. حاول مجدداً.");
    error.attempts = attempts;
    throw error;
  }

  return Object.freeze({ loadCandles, aggregateFourHourCandles });
});
