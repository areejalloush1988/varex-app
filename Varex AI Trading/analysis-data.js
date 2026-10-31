/* Read-only market data for the analysis assistant. Never connects a broker account. */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VarexAnalysisData = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const DAY = 86400;
  const DEADLINE_MS = 18000;
  const MAX_BARS = 1000;
  const GOLD_DAILY_CACHE_MS = 15 * 60 * 1000;
  const MARKETS = Object.freeze([
    Object.freeze({ symbol: "XAU-USD", name: "الذهب مقابل الدولار", shortName: "الذهب", category: "metals", dataMode: "configured" }),
    Object.freeze({ symbol: "BTC-USD", name: "بيتكوين مقابل الدولار", shortName: "بيتكوين", category: "crypto", dataMode: "public" }),
    Object.freeze({ symbol: "ETH-USD", name: "إيثريوم مقابل الدولار", shortName: "إيثريوم", category: "crypto", dataMode: "public" }),
    Object.freeze({ symbol: "SOL-USD", name: "سولانا مقابل الدولار", shortName: "سولانا", category: "crypto", dataMode: "public" }),
    Object.freeze({ symbol: "ADA-USD", name: "كاردانو مقابل الدولار", shortName: "كاردانو", category: "crypto", dataMode: "public" }),
  ]);
  const INTERVALS = Object.freeze([
    Object.freeze({ value: "1", label: "دقيقة", seconds: 60, calendarPeriod: null }),
    Object.freeze({ value: "5", label: "5 دقائق", seconds: 300, calendarPeriod: null }),
    Object.freeze({ value: "15", label: "15 دقيقة", seconds: 900, calendarPeriod: null }),
    Object.freeze({ value: "60", label: "ساعة", seconds: 3600, calendarPeriod: null }),
    Object.freeze({ value: "240", label: "4 ساعات", seconds: 14400, calendarPeriod: null }),
    Object.freeze({ value: "D", label: "يوم", seconds: DAY, calendarPeriod: null }),
    Object.freeze({ value: "W", label: "أسبوع", seconds: null, calendarPeriod: "week" }),
    Object.freeze({ value: "M", label: "شهر", seconds: null, calendarPeriod: "month" }),
  ]);
  const CRYPTO_SOURCES = Object.freeze({
    "Coinbase Exchange": "https://www.coinbase.com/advanced-trade/spot",
    Kraken: "https://www.kraken.com/",
  });
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  class AnalysisDataError extends Error {
    constructor(code, message, status = 0) {
      super(message);
      this.name = "AnalysisDataError";
      this.code = code;
      this.status = status;
      this.canImport = !["authentication_required", "access_denied", "unsupported_symbol", "unsupported_interval"].includes(code);
    }
  }

  function unavailable() {
    return new AnalysisDataError("market_provider_not_configured", "بيانات الذهب الآلية غير متاحة لهذا الفريم حالياً. يمكنك استيراد ملف شموع لتحليل بياناته.", 503);
  }
  function invalid(message = "أعاد مصدر السوق بيانات غير صالحة للتحليل.") {
    return new AnalysisDataError("invalid_market_data", message, 502);
  }
  function abortReason(signal) {
    if (signal && signal.reason !== undefined) return signal.reason;
    const error = new Error("تم إلغاء تحميل بيانات السوق.");
    error.name = "AbortError";
    return error;
  }
  function checkAbort(signal) { if (signal?.aborted) throw abortReason(signal); }
  function validateSignal(signal) {
    if (signal !== undefined && (signal === null || typeof signal.aborted !== "boolean"
      || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
      throw new AnalysisDataError("invalid_signal", "تعذر إعداد طلب البيانات.");
    }
  }
  function label(value, fallback, limit = 160) {
    return typeof value === "string" && value.trim() && value.length <= limit && !/[<>\u0000-\u001f\u007f]/.test(value)
      ? value.trim() : fallback;
  }
  function providerId(value) {
    return typeof value === "string" && /^[A-Za-z0-9._-]{1,60}$/.test(value) ? value : null;
  }
  function warningsFor(value) {
    if (!Array.isArray(value)) return [];
    const warnings = [];
    for (const input of value) {
      const warning = label(input, "", 500);
      if (warning && !warnings.includes(warning)) warnings.push(warning);
      if (warnings.length === 8) break;
    }
    return warnings;
  }
  function reportedQuality(value) {
    if (!record(value)) return null;
    const quality = {};
    for (const field of ["count", "droppedOpenBars", "duplicateRows", "gaps"]) {
      if (Number.isSafeInteger(value[field]) && value[field] >= 0 && value[field] <= MAX_BARS) quality[field] = value[field];
    }
    if (finite(value.ageSeconds) && value.ageSeconds >= 0 && value.ageSeconds <= Number.MAX_SAFE_INTEGER) quality.ageSeconds = value.ageSeconds;
    if (["recent", "aged"].includes(value.freshness)) quality.freshness = value.freshness;
    for (const field of ["marketHoursKnown", "isStale", "is_stale"]) {
      if (typeof value[field] === "boolean") quality[field] = value[field];
    }
    return Object.keys(quality).length ? quality : null;
  }
  function safeSourceUrl(value, fallback = "") {
    if (typeof value !== "string" || value.length > 300) return fallback;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.origin + parsed.pathname : fallback;
    } catch { return fallback; }
  }
  function timestamp(value) {
    if (typeof value !== "string" || value.length > 40 || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
    return Date.parse(value);
  }
  function numeric(value) {
    if (finite(value)) return value;
    if (typeof value === "string" && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
    return NaN;
  }
  function periodEnd(time, settings) {
    if (!settings.calendarPeriod) return time + settings.seconds;
    const date = new Date(time * 1000);
    if (settings.calendarPeriod === "week") date.setUTCDate(date.getUTCDate() + 7);
    else date.setUTCMonth(date.getUTCMonth() + 1);
    return date.getTime() / 1000;
  }
  function aligned(time, settings) {
    if (!settings.calendarPeriod) return time % settings.seconds === 0;
    const date = new Date(time * 1000);
    return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
      && (settings.calendarPeriod === "week" ? date.getUTCDay() === 1 : date.getUTCDate() === 1);
  }
  function clone(value) {
    return { ...value, candles: value.candles.map((candle) => ({ ...candle })),
      warnings: [...value.warnings], provenance: { ...value.provenance },
      quality: { ...value.quality, ...(value.quality.reported ? { reported: { ...value.quality.reported } } : {}) } };
  }

  function normalize(payload, symbol, settings, now, details = {}) {
    if (!record(payload) || payload.symbol !== symbol || payload.interval !== settings.value
      || !Array.isArray(payload.candles) || payload.candles.length > MAX_BARS
      || payload.intervalSeconds !== settings.seconds || (payload.calendarPeriod ?? null) !== settings.calendarPeriod) {
      throw invalid("لم تتطابق بيانات المصدر مع السوق والفريم المطلوبين.");
    }
    const source = label(payload.source, "");
    if (!source) throw invalid("مصدر بيانات السوق غير موضح.");
    const received = timestamp(payload.receivedAt);
    if (!Number.isFinite(received) || received > now + 60000) throw invalid("وقت بيانات المصدر غير صالح.");
    const rows = new Map();
    let incomplete = 0, duplicates = 0;
    for (const row of payload.candles) {
      if (!record(row) || !Number.isSafeInteger(row.time) || row.time <= 0 || row.time * 1000 > now + 60000
        || !aligned(row.time, settings) || ![row.open, row.high, row.low, row.close].every((value) => finite(value) && value > 0)
        || row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close)
        || row.low > row.high || (row.volume !== undefined && row.volume !== null && (!finite(row.volume) || row.volume < 0))) {
        throw invalid();
      }
      if (row.is_closed === false || periodEnd(row.time, settings) * 1000 > now) { incomplete += 1; continue; }
      const candle = { time: row.time, open: row.open, high: row.high, low: row.low, close: row.close,
        ...(row.volume === undefined || row.volume === null ? {} : { volume: row.volume }) };
      const previous = rows.get(row.time);
      if (previous) {
        duplicates += 1;
        if (["open", "high", "low", "close", "volume"].some((key) => previous[key] !== candle[key])) {
          throw invalid("توجد أسعار متعارضة لنفس الشمعة؛ تعذر الاعتماد على هذا المصدر.");
        }
      } else rows.set(row.time, candle);
    }
    const candles = [...rows.values()].sort((a, b) => a.time - b.time);
    if (!candles.length) throw new AnalysisDataError("period_unavailable", "لا توجد شموع مغلقة صالحة لهذا الفريم.", 422);
    const last = candles[candles.length - 1], lastClosedAt = periodEnd(last.time, settings);
    const ageSeconds = Math.max(0, Math.floor(now / 1000 - lastClosedAt));
    let gaps = 0;
    for (let index = 1; index < candles.length; index += 1) {
      if (candles[index].time !== periodEnd(candles[index - 1].time, settings)) gaps += 1;
    }
    const twoPeriods = periodEnd(periodEnd(periodEnd(last.time, settings), settings), settings);
    const reported = reportedQuality(payload.quality);
    const sourceFlaggedStale = payload.isStale === true || payload.is_stale === true
      || reported?.freshness === "aged" || reported?.isStale === true || reported?.is_stale === true;
    const freshness = sourceFlaggedStale || now / 1000 >= twoPeriods ? "aged" : "recent";
    const suppliedProvenance = record(payload.provenance) ? payload.provenance : {};
    // An explicit unknown delay remains unknown. Receipt time and candle age do
    // not establish an exchange/feed delay or a guarantee of real-time delivery.
    const suppliedDelay = payload.delaySeconds === undefined ? suppliedProvenance.delaySeconds : payload.delaySeconds;
    const delaySeconds = finite(suppliedDelay) && suppliedDelay >= 0 ? suppliedDelay : null;
    const url = safeSourceUrl(payload.sourceUrl, safeSourceUrl(suppliedProvenance.url, safeSourceUrl(details.url)));
    const allowExport = details.allowExport === true;
    const provenance = {
      kind: "provider", url,
      attribution: label(details.attribution, label(suppliedProvenance.attribution, source, 180), 180),
      displayOnly: !allowExport || suppliedProvenance.displayOnly === true, delaySeconds,
    };
    const additionalProvenance = { ...suppliedProvenance, ...details.provenance };
    const upstreamSource = label(additionalProvenance.upstreamSource, "");
    const limitation = label(additionalProvenance.limitation, "", 500);
    if (upstreamSource) provenance.upstreamSource = upstreamSource;
    if (limitation) provenance.limitation = limitation;
    if (Number.isSafeInteger(additionalProvenance.historyWindowDays)
      && additionalProvenance.historyWindowDays > 0 && additionalProvenance.historyWindowDays <= 3650) {
      provenance.historyWindowDays = additionalProvenance.historyWindowDays;
    }
    return {
      symbol, interval: settings.value, intervalSeconds: settings.seconds, calendarPeriod: settings.calendarPeriod,
      candles, source, provider: providerId(payload.provider) || providerId(source), sourceUrl: url || null,
      sourceVerified: details.trustedBackend === true && payload.sourceVerified === true,
      receivedAt: new Date(received).toISOString(),
      asOf: new Date(lastClosedAt * 1000).toISOString(), delaySeconds,
      allowExport, provenance, warnings: warningsFor(payload.warnings),
      quality: { count: candles.length, droppedOpenBars: incomplete, duplicateRows: duplicates, gaps,
        ageSeconds, freshness, sourceFlaggedStale, marketHoursKnown: false,
        // Keep bounded upstream diagnostics separate from facts recomputed from
        // these exact candles. A provider cannot overwrite observed gaps/age.
        ...(reported ? { reported } : {}) },
    };
  }

  function createClient(options = {}) {
    const clock = typeof options.now === "function" ? options.now : () => Date.now();
    const timers = {
      set: options.setTimeout || root.setTimeout?.bind(root) || setTimeout,
      clear: options.clearTimeout || root.clearTimeout?.bind(root) || clearTimeout,
    };
    const cache = new Map();

    async function deadline(signal, task) {
      checkAbort(signal);
      const controller = new AbortController();
      let timer, cancel;
      const cancellation = new Promise((_, reject) => {
        cancel = () => { const reason = abortReason(signal); controller.abort(reason); reject(reason); };
        signal?.addEventListener("abort", cancel, { once: true });
        timer = timers.set(() => {
          const error = new AnalysisDataError("provider_timeout", "انتهت مهلة مصدر البيانات. أعد المحاولة أو استورد ملف شموع.", 504);
          controller.abort(error); reject(error);
        }, DEADLINE_MS);
      });
      try { return await Promise.race([Promise.resolve().then(() => task(controller.signal)), cancellation]); }
      finally { timers.clear(timer); signal?.removeEventListener("abort", cancel); }
    }

    async function readResponse(response) {
      if (!response || typeof response.ok !== "boolean" || typeof response.json !== "function") throw invalid();
      let payload;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        if (response.status === 401) throw new AnalysisDataError("authentication_required", "يرجى تسجيل الدخول مجدداً لتحميل البيانات.", 401);
        if (response.status === 403 && !["market_data_license_required", "market_provider_not_configured"].includes(payload?.code)) {
          throw new AnalysisDataError("access_denied", "هذا الحساب غير مخوّل للوصول إلى بيانات التحليل.", 403);
        }
        if (response.status === 404 || ["market_provider_not_configured", "market_data_license_required", "provider_not_configured", "market_provider_unconfigured", "analysis_not_configured"].includes(payload?.code)) throw unavailable();
        if (response.status === 429) {
          const error = new AnalysisDataError("rate_limited", "وصل مصدر البيانات إلى حد الطلبات. انتظر قليلاً ثم حاول مجدداً.", 429);
          const retry = Number(response.headers?.get?.("Retry-After"));
          if (Number.isFinite(retry) && retry > 0 && retry <= DAY) error.retryAfter = retry;
          throw error;
        }
        throw new AnalysisDataError("provider_unavailable", "مصدر بيانات السوق غير متاح حالياً. لم يُنشأ تحليل بأسعار بديلة.", response.status);
      }
      if (!record(payload)) throw invalid();
      return payload;
    }

    async function configuredGold(settings, signal) {
      const request = options.request || root.varexTradingRequest;
      if (typeof request !== "function") throw unavailable();
      const query = new URLSearchParams({ symbol: "XAU-USD", interval: settings.value });
      const payload = await deadline(signal, async (requestSignal) => readResponse(await request("/api/analysis/market?" + query.toString(), {
        method: "GET", headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store", signal: requestSignal,
      })));
      return normalize(payload, "XAU-USD", settings, clock(), { allowExport: false, trustedBackend: true });
    }

    // Opt-in until a runtime check confirms this public daily endpoint and its CORS.
    // This does not upgrade a minute/hour request to daily data or redistribute the feed.
    async function publicGoldDaily(settings, signal) {
      const fetcher = options.publicFetch || root.fetch?.bind(root);
      if (typeof fetcher !== "function") throw unavailable();
      const today = new Date(clock()); today.setUTCHours(0, 0, 0, 0);
      const since = new Date(today.getTime() - 29 * DAY * 1000);
      const query = new URLSearchParams({ symbol: "XAU-USD-SPOT", interval: "1d",
        from: since.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10), limit: "30" });
      const payload = await deadline(signal, async (requestSignal) => readResponse(await fetcher("https://api.goldprice.dev/v1/bars?" + query.toString(), {
        method: "GET", headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store",
        mode: "cors", referrerPolicy: "no-referrer", redirect: "error", signal: requestSignal,
      })));
      if (payload.symbol !== "XAU-USD-SPOT" || payload.interval !== "1d" || !Array.isArray(payload.bars) || payload.bars.length > 30) {
        throw invalid("لم يطابق مصدر الذهب العام الطلب اليومي المحدد.");
      }
      const candles = payload.bars.map((row) => {
        if (!record(row) || typeof row.is_closed !== "boolean") throw invalid();
        const time = timestamp(row.bar_start);
        if (!Number.isFinite(time) || time < since.getTime() || time > today.getTime()) throw invalid();
        return { time: time / 1000, open: numeric(row.open), high: numeric(row.high), low: numeric(row.low), close: numeric(row.close),
          is_closed: row.is_closed, ...(row.volume === undefined || row.volume === null ? {} : { volume: numeric(row.volume) }) };
      });
      return normalize({ symbol: "XAU-USD", interval: "D", intervalSeconds: DAY, calendarPeriod: null,
        candles, source: "goldprice.dev", sourceUrl: "https://goldprice.dev", receivedAt: new Date(clock()).toISOString(),
        delaySeconds: 900, isStale: payload.is_stale === true || payload.meta?.is_stale === true,
      }, "XAU-USD", settings, clock(), {
        allowExport: false, attribution: "Gold price data by goldprice.dev", url: "https://goldprice.dev",
        provenance: { displayOnly: true, historyWindowDays: 30, upstreamSource: label(payload.meta?.source_id, "غير محدد"),
          limitation: "شموع يومية من آخر 30 يوماً؛ قد لا تكفي لبعض المؤشرات. لا تتوفر الفريمات القصيرة من هذا المصدر." },
      });
    }

    async function load(input = {}) {
      if (!record(input)) throw new AnalysisDataError("invalid_request", "طلب بيانات السوق غير صالح.");
      const symbol = input.symbol === undefined ? "XAU-USD" : input.symbol;
      const interval = input.interval === undefined ? "60" : input.interval;
      if (!MARKETS.some((market) => market.symbol === symbol)) throw new AnalysisDataError("unsupported_symbol", "السوق المطلوب غير مدعوم في مساعد التحليل.");
      const settings = INTERVALS.find((item) => item.value === interval);
      if (!settings) throw new AnalysisDataError("unsupported_interval", "الفريم المطلوب غير مدعوم.");
      validateSignal(input.signal); checkAbort(input.signal);
      const key = symbol + ":" + interval, saved = cache.get(key), now = clock();
      if (saved && now >= saved.createdAt && now < saved.expiresAt
        && (input.force !== true || saved.minimumRefresh === true)) return clone(saved.value);
      try {
        let value;
        if (symbol === "XAU-USD") {
          try { value = await configuredGold(settings, input.signal); }
          catch (error) {
            checkAbort(input.signal);
            const permitted = options.enableGoldDailyFallback === true || root.VAREX_ANALYSIS_DATA_CONFIG?.goldDailyFallbackEnabled === true;
            if (settings.value !== "D" || !permitted || error?.code !== "market_provider_not_configured") throw error;
            value = await publicGoldDaily(settings, input.signal);
          }
        } else {
          const marketData = options.marketData || root.VarexMarketData;
          if (typeof marketData?.loadCandles !== "function") throw new AnalysisDataError("data_loader_unavailable", "تعذر تحميل مكتبة بيانات السوق. حدّث الصفحة ثم حاول مجدداً.");
          const payload = await marketData.loadCandles({ symbol, interval, signal: input.signal, force: input.force === true });
          value = normalize(payload, symbol, settings, clock(), { url: CRYPTO_SOURCES[payload?.source] || "", allowExport: false });
        }
        checkAbort(input.signal);
        const createdAt = clock(), publicDaily = value.source === "goldprice.dev";
        cache.set(key, { value: clone(value), createdAt, expiresAt: createdAt + (publicDaily ? GOLD_DAILY_CACHE_MS : 15000), minimumRefresh: publicDaily });
        return clone(value);
      } catch (error) {
        cache.delete(key); checkAbort(input.signal);
        if (error instanceof AnalysisDataError || error?.name === "AbortError") throw error;
        if (["unsupported_symbol", "unsupported_interval", "period_unavailable", "sources_unavailable", "provider_timeout"].includes(error?.code)) {
          throw new AnalysisDataError(error.code, label(error.message, "تعذر تحميل بيانات السوق."));
        }
        throw new AnalysisDataError("provider_unavailable", "تعذر الاتصال بمصدر البيانات. يمكنك إعادة المحاولة أو استيراد ملف شموع.", 502);
      }
    }
    return Object.freeze({ load, clearCache: () => cache.clear() });
  }

  const client = createClient();
  return Object.freeze({ load: client.load, clearCache: client.clearCache, createClient,
    getMarkets: () => MARKETS.map((item) => ({ ...item })),
    getIntervals: () => INTERVALS.map((item) => ({ ...item })), AnalysisDataError });
});
