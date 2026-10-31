(function (root, factory) {
  "use strict";
  const api = factory(() => root.VarexMarketAnalysis);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VarexAnalysisAssistantCore = api;
})(typeof window !== "undefined" ? window : globalThis, function (engine) {
  "use strict";

  const VERSION = "1.0.0";
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_ROWS = 10000;
  const PERIODS = Object.freeze({
    "1": { intervalSeconds: 60, calendarPeriod: null, label: "دقيقة" },
    "5": { intervalSeconds: 300, calendarPeriod: null, label: "5 دقائق" },
    "15": { intervalSeconds: 900, calendarPeriod: null, label: "15 دقيقة" },
    "60": { intervalSeconds: 3600, calendarPeriod: null, label: "ساعة" },
    "240": { intervalSeconds: 14400, calendarPeriod: null, label: "4 ساعات" },
    D: { intervalSeconds: 86400, calendarPeriod: null, label: "يوم" },
    W: { intervalSeconds: null, calendarPeriod: "week", label: "أسبوع تقويمي" },
    M: { intervalSeconds: null, calendarPeriod: "month", label: "شهر تقويمي" },
  });
  const ALIASES = Object.freeze({ "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D", "1D": "D", "1w": "W", "1W": "W", "1mo": "M", "1M": "M" });
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const DATE_LIMIT = 8.64e15;

  class AnalysisInputError extends Error {
    constructor(code, message) { super(message); this.name = "AnalysisInputError"; this.code = code; }
  }

  function intervalSettings(value) {
    const key = typeof value === "string" ? (ALIASES[value.trim()] || value.trim()) : "";
    if (!Object.hasOwn(PERIODS, key)) throw new AnalysisInputError("invalid_interval", "اختَر إطاراً زمنياً معروفاً يطابق شموع الملف.");
    return { interval: key, ...PERIODS[key] };
  }

  function metadata(options) {
    if (!record(options)) throw new AnalysisInputError("invalid_metadata", "بيانات السوق والإطار الزمني مطلوبة.");
    const symbol = typeof options.symbol === "string" ? options.symbol.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9:/._-]{0,63}$/.test(symbol)) {
      throw new AnalysisInputError("invalid_symbol", "حدّد رمز السوق الذي تنتمي إليه الشموع، مثل XAU/USD.");
    }
    const source = typeof options.source === "string" ? options.source.trim() : "";
    if (!source || source.length > 160 || /[<>\u0000-\u001f\u007f]/.test(source)) {
      throw new AnalysisInputError("invalid_source", "حدّد اسماً واضحاً لمصدر البيانات لا يزيد على 160 حرفاً.");
    }
    const now = options.now === undefined ? Date.now() : options.now;
    if (!finite(now) || now < 0 || now > DATE_LIMIT) throw new AnalysisInputError("invalid_now", "وقت التقييم غير صالح.");
    return { symbol, source, now, ...intervalSettings(options.interval) };
  }

  function numeric(value) {
    if (finite(value)) return value;
    if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return NaN;
    return Number(value.trim());
  }

  // RFC-style quoted fields; delimiter detection never inspects quoted content.
  function csvRows(input) {
    const firstLine = input.split(/\r?\n/, 1)[0];
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let quoted = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (!quoted && Object.hasOwn(counts, firstLine[i])) counts[firstLine[i]] += 1;
    }
    const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!counts[delimiter]) throw new AnalysisInputError("invalid_csv", "الملف يحتاج أعمدة CSV مفصولة بفاصلة أو فاصلة منقوطة أو Tab.");
    const rows = [];
    let row = [], cell = "", inQuotes = false, quoteClosed = false;
    function finishCell() { row.push(cell.trim()); cell = ""; quoteClosed = false; }
    function finishRow() {
      finishCell();
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new AnalysisInputError("too_many_rows", "الحد الأقصى للملف 10,000 شمعة.");
    }
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') { cell += '"'; i += 1; }
          else { inQuotes = false; quoteClosed = true; }
        } else cell += ch;
      } else if (ch === delimiter) finishCell();
      else if (ch === "\n" || ch === "\r") {
        finishRow();
        if (ch === "\r" && input[i + 1] === "\n") i += 1;
      } else if (ch === '"') {
        if (cell.trim() || quoteClosed) throw new AnalysisInputError("invalid_csv", "علامات الاقتباس في CSV غير متطابقة.");
        cell = ""; inQuotes = true;
      } else if (quoteClosed && ch.trim()) throw new AnalysisInputError("invalid_csv", "يوجد نص غير صالح بعد حقل CSV مقتبس.");
      else cell += ch;
    }
    if (inQuotes) throw new AnalysisInputError("invalid_csv", "يوجد حقل CSV بعلامة اقتباس غير مغلقة.");
    if (cell || row.length) finishRow();
    return rows;
  }

  const HEADER_KEYS = Object.freeze({
    datetime: "timestamp", timestamp: "timestamp", timestampms: "timestamp", unixtime: "timestamp", unix: "timestamp", datetimeutc: "timestamp", dateutc: "date",
    date: "date", time: "time", open: "open", high: "high", low: "low", close: "close",
    volume: "volume", vol: "volume", tickvol: "tickVolume", tickvolume: "tickVolume", spread: "spread", symbol: "symbol",
  });

  function parseTimestamp(raw, offset) {
    const value = String(raw).trim();
    if (/^\d{1,16}(?:\.\d+)?$/.test(value)) {
      const number = Number(value);
      const seconds = number >= 1e12 ? number / 1000 : number;
      if (Number.isSafeInteger(seconds) && seconds >= 0 && seconds * 1000 <= DATE_LIMIT) return seconds;
      throw new AnalysisInputError("invalid_timestamp", "يجب أن يكون الطابع الزمني Unix بالثواني أو المللي ثانية بدقة ثانية كاملة.");
    }
    const match = /^(\d{4})[-.](\d{2})[-.](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);
    if (!match) throw new AnalysisInputError("invalid_timestamp", "استخدم وقت ISO مثل 2026-10-30T12:00:00Z أو Unix. صيغة التاريخ غير معروفة.");
    const [, ys, mos, ds, hs = "00", mis = "00", ss = "00", ms = "0", zone] = match;
    const year = Number(ys), month = Number(mos), day = Number(ds), hour = Number(hs), minute = Number(mis), second = Number(ss);
    if (year < 1970 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || Number(ms) !== 0) {
      throw new AnalysisInputError("invalid_timestamp", "تاريخ الشمعة أو وقتها غير صالح؛ يجب أن تبدأ بدقة ثانية كاملة.");
    }
    const utc = Date.UTC(year, month - 1, day, hour, minute, second);
    const check = new Date(utc);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      throw new AnalysisInputError("invalid_timestamp", "يوجد تاريخ غير موجود في التقويم داخل الملف.");
    }
    let minutes = offset;
    if (zone === "Z") minutes = 0;
    else if (zone) {
      const parts = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
      if (Number(parts[2]) > 14 || Number(parts[3]) > 59 || (Number(parts[2]) === 14 && Number(parts[3]) !== 0)) {
        throw new AnalysisInputError("invalid_timezone", "إزاحة المنطقة الزمنية غير صالحة.");
      }
      minutes = (parts[1] === "-" ? -1 : 1) * (Number(parts[2]) * 60 + Number(parts[3]));
    }
    if (!Number.isInteger(minutes) || Math.abs(minutes) > 840) {
      throw new AnalysisInputError("timezone_required", "وقت CSV لا يحتوي منطقة زمنية. حدّد إزاحة توقيت المصدر عن UTC قبل الاستيراد.");
    }
    const result = (utc - minutes * 60000) / 1000;
    if (!Number.isSafeInteger(result) || result < 0 || result * 1000 > DATE_LIMIT) throw new AnalysisInputError("invalid_timestamp", "وقت الشمعة خارج النطاق المدعوم.");
    return result;
  }

  function validateCandles(rows, settings, { rejectFuture = true } = {}) {
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new AnalysisInputError("invalid_candles", "بيانات الشموع يجب أن تكون قائمة لا تتجاوز 10,000 شمعة.");
    const byTime = new Map();
    let duplicates = 0;
    let fixedPhase = null;
    for (const [index, value] of rows.entries()) {
      if (!record(value)) throw new AnalysisInputError("invalid_candle", "بيانات الشمعة " + (index + 1) + " غير صالحة.");
      const c = { time: value.time, open: value.open, high: value.high, low: value.low, close: value.close };
      if (!Number.isSafeInteger(c.time) || c.time < 0 || c.time * 1000 > DATE_LIMIT
        || ![c.open, c.high, c.low, c.close].every(finite)
        || c.low > c.high || c.open < c.low || c.open > c.high || c.close < c.low || c.close > c.high
        || (value.volume !== undefined && (!finite(value.volume) || value.volume < 0))) {
        throw new AnalysisInputError("invalid_candle", "قيم OHLC أو الوقت غير صالحة في الشمعة " + (index + 1) + ".");
      }
      if (value.volume !== undefined) c.volume = value.volume;
      if (rejectFuture && c.time * 1000 > settings.now) throw new AnalysisInputError("future_candle", "الملف يحتوي شموعاً يبدأ وقتها في المستقبل. تحقّق من التوقيت والمصدر.");
      const date = new Date(c.time * 1000);
      const phase = settings.calendarPeriod ? null : c.time % settings.intervalSeconds;
      if (fixedPhase === null && phase !== null) fixedPhase = phase;
      const aligned = settings.calendarPeriod === "week"
        ? date.getUTCDay() === 1 && c.time % 86400 === 0
        : settings.calendarPeriod === "month" ? date.getUTCDate() === 1 && c.time % 86400 === 0
          : phase === fixedPhase;
      if (!aligned) throw new AnalysisInputError("interval_mismatch", "توقيت الشموع لا يطابق الإطار المختار. الأسابيع والأشهر تبدأ عند حدود UTC التقويمية؛ تحقّق من الفريم وإزاحة المصدر.");
      const old = byTime.get(c.time);
      if (old) {
        if (["open", "high", "low", "close", "volume"].some((key) => old[key] !== c[key])) {
          throw new AnalysisInputError("conflicting_candles", "الملف يحتوي قيماً متعارضة للشمعة نفسها. صحّح المصدر قبل التحليل.");
        }
        duplicates += 1;
      } else byTime.set(c.time, c);
    }
    return { candles: [...byTime.values()].sort((a, b) => a.time - b.time), duplicates };
  }

  function parseCSV(text, options = {}) {
    const settings = metadata(options);
    if (typeof text !== "string" || !text.trim()) throw new AnalysisInputError("empty_csv", "ملف CSV فارغ.");
    if (text.length > MAX_FILE_BYTES || (typeof TextEncoder === "function" && new TextEncoder().encode(text).length > MAX_FILE_BYTES)) {
      throw new AnalysisInputError("file_too_large", "حجم CSV يجب ألا يتجاوز 4 ميغابايت.");
    }
    const rows = csvRows(text.replace(/^\uFEFF/, ""));
    if (rows.length < 2) throw new AnalysisInputError("empty_csv", "الملف يحتاج سطر عناوين وشمعة واحدة على الأقل.");
    const headers = rows.shift().map((value) => HEADER_KEYS[value.toLowerCase().replace(/[<>\s_()-]/g, "")] || "");
    const named = headers.filter(Boolean);
    if (new Set(named).size !== named.length) throw new AnalysisInputError("duplicate_header", "يوجد عنوان عمود مكرر أو ملتبس في CSV.");
    if (!["open", "high", "low", "close"].every((key) => named.includes(key))
      || !["timestamp", "date", "time"].some((key) => named.includes(key))) {
      throw new AnalysisInputError("missing_columns", "الأعمدة المطلوبة: time أو date، وopen وhigh وlow وclose. الحجم volume اختياري.");
    }
    const warnings = [];
    const candles = rows.map((row, index) => {
      if (row.length !== headers.length) throw new AnalysisInputError("column_count", "عدد الأعمدة غير متطابق في السطر " + (index + 2) + ".");
      const values = Object.create(null);
      headers.forEach((key, column) => { if (key) values[key] = row[column]; });
      if (values.symbol && values.symbol.toUpperCase() !== settings.symbol.toUpperCase()) throw new AnalysisInputError("symbol_mismatch", "رمز السوق داخل الملف لا يطابق السوق المختار.");
      const date = values.timestamp || (values.date ? values.date + (values.time ? "T" + values.time : "") : values.time);
      const candle = { time: parseTimestamp(date, options.timezoneOffsetMinutes), open: numeric(values.open), high: numeric(values.high), low: numeric(values.low), close: numeric(values.close) };
      if (values.volume !== undefined && values.volume !== "") candle.volume = numeric(values.volume);
      return candle;
    });
    const checked = validateCandles(candles, settings);
    if (checked.duplicates) warnings.push("حُذفت " + checked.duplicates + " شمعة مكررة ومتطابقة دون تعديل الأسعار.");
    warnings.push("هذه بيانات CSV يقدّمها المستخدم؛ مصدرها وصحة اختيار السوق والفريم يعتمدان على الملف.");
    warnings.push("توقيت الشموع يُفسّر على أنه وقت البداية؛ الشمعة الجارية تُستبعد من الحساب.");
    return {
      symbol: settings.symbol, interval: settings.interval, intervalSeconds: settings.intervalSeconds,
      calendarPeriod: settings.calendarPeriod, source: settings.source, candles: checked.candles,
      receivedAt: new Date(settings.now).toISOString(), imported: true, allowExport: true,
      timezoneOffsetMinutes: Number.isInteger(options.timezoneOffsetMinutes) ? options.timezoneOffsetMinutes : null,
      warnings,
    };
  }

  function formatPrice(value) {
    return finite(value) ? Number(value.toPrecision(8)).toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: false }) : "غير متاح";
  }

  function provenanceFor(dataset, source) {
    const input = record(dataset.provenance) ? dataset.provenance : {};
    let url = null;
    try {
      const parsed = new URL(typeof input.url === "string" ? input.url : typeof dataset.sourceUrl === "string" ? dataset.sourceUrl : typeof dataset.sourceURL === "string" ? dataset.sourceURL : "");
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.href.length <= 500) url = parsed.href;
    } catch { /* A source label alone is valid; never invent its URL. */ }
    const attribution = typeof input.attribution === "string" && input.attribution.length <= 180 && !/[<>\u0000-\u001f]/.test(input.attribution)
      ? input.attribution : source;
    const delay = input.delaySeconds === undefined ? dataset.delaySeconds : input.delaySeconds;
    return { url, attribution, displayOnly: input.displayOnly === true, delaySeconds: finite(delay) && delay >= 0 ? delay : null };
  }

  function createReport(dataset, options = {}) {
    if (!record(dataset)) throw new AnalysisInputError("invalid_dataset", "بيانات السوق غير متاحة للتحليل.");
    const settings = metadata({ ...dataset, now: options.now === undefined ? Date.now() : options.now });
    if (dataset.intervalSeconds !== undefined && dataset.intervalSeconds !== settings.intervalSeconds
      || dataset.calendarPeriod !== undefined && dataset.calendarPeriod !== settings.calendarPeriod) {
      throw new AnalysisInputError("interval_mismatch", "وصف مدة الشموع لا يطابق الإطار الزمني المختار.");
    }
    const checked = validateCandles(dataset.candles, settings);
    const analyzer = engine();
    if (!analyzer?.analyzeCandles) throw new AnalysisInputError("engine_unavailable", "محرك حساب المؤشرات غير جاهز. أعد تحميل الصفحة.");
    const computed = analyzer.analyzeCandles({ ...settings, candles: checked.candles });
    const sourceFlaggedStale = record(dataset.quality) && dataset.quality.freshness === "aged";
    const analysis = sourceFlaggedStale && computed.status !== "unavailable"
      ? { ...computed, status: "stale", isCurrent: false, reasons: ["المصدر يصف هذه البيانات بأنها متأخرة؛ تُعامل القراءة كتاريخية.", ...computed.reasons] }
      : computed;
    const hasGaps = analysis.dataQuality.gaps > 0;
    const status = analysis.status === "ready" && hasGaps ? "limited" : analysis.status;
    const direction = analysis.status === "unavailable" ? "unavailable" : analysis.direction;
    const labels = { bullish: "ميل فني صاعد", bearish: "ميل فني هابط", neutral: "قراءات متباينة أو محايدة", unavailable: "القراءة غير متاحة" };
    const isCurrent = analysis.isCurrent && !hasGaps;
    const summary = analysis.status === "unavailable" ? "لا توجد شموع مغلقة صالحة تكفي لقراءة السوق."
      : (analysis.status === "stale" ? "قراءة تاريخية: " : hasGaps ? "قراءة محدودة بوجود فواصل زمنية: " : "")
        + labels[direction] + " على فريم " + settings.label + ". "
        + (analysis.status === "insufficient" ? "التاريخ لا يكفي لجميع المؤشرات. " : "")
        + "تصف القراءة الشموع المتاحة ولا تحسم الحركة التالية.";
    const levels = {
      support: analysis.indicators.supportResistance.support,
      resistance: analysis.indicators.supportResistance.resistance,
      lookback: 20,
      basis: "أدنى وأعلى الشموع العشرين المغلقة السابقة، مع استبعاد الشمعة الأخيرة. مستويات مرجعية وصفية وليست أوامر دخول.",
    };
    const scope = status === "stale" ? "historical" : status === "ready" ? "current" : "limited";
    const scenarios = finite(levels.support) && finite(levels.resistance) ? [
      {
        id: "bullish", label: "سيناريو امتداد صاعد", scope,
        condition: "إغلاق شمعة مكتملة فوق الحد العلوي " + formatPrice(levels.resistance) + " مع استمرار الزخم يضيف دليلاً فنياً لصالح الامتداد الصاعد.",
        invalidation: "العودة إلى النطاق تضعف تفسير الاختراق؛ والإغلاق دون الحد السفلي " + formatPrice(levels.support) + " يعارض هذا السيناريو.",
        interpretation: "شرط للمراقبة وإعادة التقييم، وليس تنبؤاً مؤكداً أو توصية بصفقة.",
      },
      {
        id: "bearish", label: "سيناريو امتداد هابط", scope,
        condition: "إغلاق شمعة مكتملة دون الحد السفلي " + formatPrice(levels.support) + " مع استمرار الزخم الهابط يضيف دليلاً فنياً لصالح الامتداد الهابط.",
        invalidation: "العودة إلى النطاق تضعف تفسير الكسر؛ والإغلاق فوق الحد العلوي " + formatPrice(levels.resistance) + " يعارض هذا السيناريو.",
        interpretation: "شرط للمراقبة وإعادة التقييم؛ يمكن أن يحدث كسر كاذب أو تتغير الظروف.",
      },
    ] : [];
    const warnings = Array.isArray(dataset.warnings) ? dataset.warnings.filter((x) => typeof x === "string" && x.length <= 500 && !/[<>\u0000-\u001f]/.test(x)).slice(0, 8) : [];
    if (dataset.imported === true) warnings.push("استيراد ملف حديث لا يجعله تغذية حية؛ حداثة القراءة محسوبة من آخر شمعة مكتملة.");
    if (sourceFlaggedStale) warnings.push("المصدر وضع علامة تأخر على البيانات؛ تُعامل القراءة كتاريخية حتى لو كان وقت الشمعة قريباً. سبب التأخر غير مؤكد.");
    else if (status === "stale") warnings.push("آخر شمعة قديمة بالنسبة للفريم. قد يكون السوق مغلقاً أو البيانات متأخرة؛ لا نؤكد السبب دون معلومات جلسة موثوقة.");
    if (hasGaps) warnings.push("توجد فواصل بين الشموع. قد تمثل إغلاق السوق أو نقص البيانات؛ لا تُملأ بأسعار افتراضية.");
    if (analysis.dataQuality.incompleteRows) warnings.push("استُبعدت الشمعة الجارية غير المكتملة من المؤشرات.");
    if (analysis.missingIndicators.length) warnings.push("لا تتوفر بيانات كافية لبعض المؤشرات: " + analysis.missingIndicatorDetails.map((x) => x.label).join("، ") + ".");
    return {
      version: VERSION, id: [settings.symbol, settings.interval, analysis.asOf || "empty"].join("|"),
      symbol: settings.symbol, source: settings.source, interval: settings.interval, intervalLabel: settings.label,
      asOf: analysis.asOf, lastClose: analysis.lastClose,
      receivedAt: typeof dataset.receivedAt === "string" ? dataset.receivedAt : new Date(settings.now).toISOString(),
      imported: dataset.imported === true, status, analysis, summary,
      provider: typeof dataset.provider === "string" && /^[A-Za-z0-9._-]{1,60}$/.test(dataset.provider) ? dataset.provider : null,
      provenance: provenanceFor(dataset, settings.source), allowExport: dataset.allowExport === true,
      trend: { direction, label: labels[direction] }, levels, scenarios,
      quality: { status, isCurrent, candleCount: analysis.candleCount, gaps: analysis.dataQuality.gaps,
        ageSeconds: analysis.dataQuality.ageSeconds, incompleteRows: analysis.dataQuality.incompleteRows,
        duplicatesRemoved: checked.duplicates, sourceFlaggedStale, sourceVerified: dataset.sourceVerified === true && dataset.imported !== true },
      warnings: [...new Set(warnings)], method: "technical-calculation",
      disclaimer: "تحليل وصفي محسوب من البيانات المحددة. السيناريوهات مشروطة، واتفاق المؤشرات ليس احتمال نجاح أو ضماناً للربح.",
    };
  }

  function normalizeQuestion(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new AnalysisInputError("invalid_question", "اكتب سؤالاً من 1 إلى 2,000 حرف عن الشارت أو المؤشرات.");
    return value.toLowerCase().replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
  }

  function answerQuestion(question, report) {
    const q = normalizeQuestion(question);
    const reply = (intent, text) => ({ intent, text, mode: "local-explanation", generated: false });
    const usable = record(report) && record(report.analysis) && typeof report.summary === "string";
    const prefix = !usable ? "" : report.status === "stale" ? "تنبيه: القراءة المعروضة تاريخية والبيانات قديمة لهذا الفريم.\n"
      : report.status === "limited" || report.status === "insufficient" ? "القراءة محدودة بسبب الفواصل أو نقص الشموع؛ بعض الاستنتاجات غير مكتملة.\n" : "";
    const indicators = usable ? report.analysis.indicators : null;
    if (/خبر|اخبار|فيدرالي|فائده|تضخم|news|why.*(rise|fall)/.test(q)) {
      return reply("news", "لا توجد تغذية أخبار موثقة ضمن هذه القراءة. أستطيع شرح الحركة الفنية، لكن لا أستطيع إسنادها إلى خبر أو حدث اقتصادي من الشارت وحده.");
    }
    if (/مضمون|اكيد|تاكيد|ضمان|نسبه.*نجاح|احتمال.*%|guarante|probability|confidence/.test(q)) {
      return reply("uncertainty", "التحليل لا يضمن اتجاه السعر. اتفاق المؤشرات هو عدّ لقراءات مترابطة، وليس نسبة نجاح معايرة. قد تتغير القراءة أو يحدث اختراق كاذب؛ لذلك نعرض شروطاً متعارضة وما يضعف كل سيناريو.");
    }
    const requestedMarket = /ذهب|gold|xau/.test(q) ? "gold" : /فضه|silver|xag/.test(q) ? "silver"
      : /بتكوين|بيتكوين|bitcoin|btc/.test(q) ? "bitcoin" : /نفط|oil|wti|brent/.test(q) ? "oil" : null;
    const chosen = usable ? String(report.symbol).toUpperCase() : "";
    const matches = !requestedMarket || (requestedMarket === "gold" ? /XAU|GOLD|GC1/.test(chosen)
      : requestedMarket === "silver" ? /XAG|SILVER|SI1/.test(chosen)
        : requestedMarket === "bitcoin" ? /BTC|XBT/.test(chosen) : /OIL|WTI|BRENT|USOIL|UKOIL|CL1/.test(chosen));
    if (usable && !matches) return reply("different_market", "التقرير الحالي يخص " + report.symbol + ". اختر السوق المطلوب وحمّل شموعه أولاً؛ لا أستخدم بيانات سوق آخر للإجابة عنه.");
    if (/rsi|تشبع|قوه نسبيه/.test(q)) {
      return reply("rsi", prefix + "RSI يقيس زخم تغيرات الإغلاق على فترة محددة. النطاقان الشائعان 70 و30 يصفان تشبعاً نسبياً؛ الوصول إليهما لا يثبت انعكاس السعر ولا يكفي لاتخاذ قرار."
        + (indicators?.rsi14?.available ? "\nالقيمة المحسوبة في التقرير: " + formatPrice(indicators.rsi14.value) + "." : "\nقيمة RSI غير متاحة دون تاريخ كافٍ من الشموع المغلقة."));
    }
    if (/macd|ماكد/.test(q)) {
      return reply("macd", prefix + "MACD يقارن متوسطين أسيين للسعر، ثم يقارن الفرق بخط إشارة. يساعد على وصف تغير الزخم وقد يتأخر عن الحركة أو يعطي إشارات متعارضة في السوق الجانبي."
        + (indicators?.macd?.available ? "\nخط MACD = " + formatPrice(indicators.macd.line) + "، وخط الإشارة = " + formatPrice(indicators.macd.signal) + "." : "\nلا توجد شموع كافية لحساب MACD الكامل في القراءة الحالية."));
    }
    if (/atr|تذبذب|تقلب/.test(q)) {
      return reply("volatility", prefix + "ATR يصف متوسط مدى الحركة بوحدة سعر الأداة. ارتفاعه يعني حركة أوسع في التاريخ المقاس، ولا يحدد اتجاهها."
        + (indicators?.atr14?.available ? "\nATR 14 المحسوب = " + formatPrice(indicators.atr14.value) + "." : "\nقيمة ATR غير متاحة دون تاريخ كافٍ."));
    }
    if (/adx|\bdi\b|قوه الاتجاه/.test(q)) {
      return reply("adx", "ADX يصف قوة الاتجاه ولا يحدد وحده إن كان صاعداً أو هابطاً. خطا DI+ وDI− يقارنان الحركة الاتجاهية الموجبة والسالبة. لا يحسب المحرك الحالي هذه القيم، لذلك أشرح معناها دون اختلاق قراءة رقمية.");
    }
    if (/فريم|اطار زمني|timeframe|شمعة|شمعه/.test(q) && !/حلل|تحليل|اتجاه/.test(q)) {
      return reply("timeframe", "الفريم هو مدة الشمعة: مثلاً شمعة الساعة تلخّص الافتتاح والأعلى والأدنى والإغلاق خلال ساعة. نستخدم الشموع المكتملة حتى لا تتغير الأرقام أثناء تكوّنها. قد يختلف اتجاه فريم قصير عن اتجاه فريم أطول؛ المقارنة تحتاج بيانات مستقلة لكل فريم."
        + (usable ? "\nالفريم الحالي: " + report.intervalLabel + "." : ""));
    }
    if (/ema|متوسط/.test(q)) {
      return reply("averages", prefix + "المتوسط الأسي EMA يلخص الإغلاقات مع وزن أكبر للأحدث. مقارنة EMA 20 وEMA 50 تساعد على وصف الاتجاه، لكنها تتأخر عن السعر ولا تثبت استمراره."
        + (indicators?.ema20?.available ? "\nEMA 20 = " + formatPrice(indicators.ema20.value) + "." : "")
        + (indicators?.ema50?.available ? " EMA 50 = " + formatPrice(indicators.ema50.value) + "." : ""));
    }
    if (!usable && /دعم|مقاومه|مقاومة|support|resistance/.test(q)
      && /يعني|معني|معنى|اشرح|ما هو|ماهي|ما هي|meaning|explain|what/.test(q)) {
      return reply("levels_definition", "الدعم منطقة ارتبطت سابقاً بتباطؤ الهبوط أو ظهور طلب، والمقاومة منطقة ارتبطت بتباطؤ الصعود أو ظهور عرض. هي مناطق مرجعية وليست حواجز مضمونة؛ قد يخترقها السعر. تحديد مستويات رقمية لسوق معين يحتاج شموعه ومصدرها وفريمها.");
    }
    if (!usable || report.status === "unavailable") return reply("data_required", "اختر السوق والفريم ثم حمّل بيانات شموع موثقة أو استورد CSV لإعداد التحليل. لا أملك سعراً حالياً أو مستويات مؤكدة لهذا السوق دون البيانات.");
    if (/وقت|تحديث|قديم|مصدر|لحظي|fresh|source/.test(q)) {
      return reply("freshness", prefix + "مصدر القراءة: " + report.source + ". آخر شمعة مكتملة حتى " + (report.asOf || "وقت غير متاح")
        + ". عدد الشموع المستخدمة: " + report.analysis.candleCount + "."
        + (report.imported ? "\nالبيانات مستوردة من ملف، ولا تتحدث تلقائياً." : "")
        + "\nقد يكون التأخر بسبب إغلاق السوق أو تأخر المصدر؛ لا نؤكد حالة الجلسة دون دليل من المصدر.");
    }
    if (/شراء|بيع|اشتري|اشتري|ابيع|صفقه|دخول|وقف|هدف|buy|sell|entry|stop.loss|target/.test(q)) {
      return reply("trade_request", prefix + "المساعد يشرح الشارت والمستويات والسيناريوهات؛ هذه القراءة لا تحدد صفقة شخصية أو حجم مخاطرة.\n"
        + report.summary + (finite(report.levels?.support) ? "\nالحد المرجعي السفلي: " + formatPrice(report.levels.support) + "، والعلوي: " + formatPrice(report.levels.resistance) + "." : "\nالمستويات غير متاحة بسبب نقص التاريخ.")
        + "\nيمكنني شرح شرط الاختراق أو الكسر وما يضعف كل سيناريو.");
    }
    if (/دعم|مقاومه|مقاومة|مستوي|مستوى|support|resistance/.test(q)) {
      return reply("levels", prefix + (finite(report.levels?.support)
        ? "الحد المرجعي السفلي: " + formatPrice(report.levels.support) + "، والحد العلوي: " + formatPrice(report.levels.resistance) + ".\n" + report.levels.basis + "\nقد يتجاوز السعر هذه المستويات أو يعود إليها؛ هي مرجع لشرح السلوك السابق."
        : "المستويات تحتاج 21 شمعة مغلقة على الأقل: شمعة أخيرة وعشرين شمعة سابقة للمقارنة. لا أخمّن مستوى عند نقص التاريخ."));
    }
    if (/سيناريو|اختراق|كسر|احتمال|scenario|breakout/.test(q)) {
      return reply("scenarios", prefix + (report.scenarios.length ? report.scenarios.map((item) => item.label + ":\n" + item.condition + "\n" + item.invalidation).join("\n\n") : "التاريخ لا يكفي لحساب حدود السيناريوهين. حمّل مزيداً من الشموع المغلقة أولاً."));
    }
    if (/حلل|تحليل|صعود|هبوط|صاعد|هابط|يصعد|يهبط|يرتفع|ينخفض|يطلع|ينزل|اتجاه|اليوم|analysis|trend|gold|ذهب/.test(q)) {
      return reply("analysis", prefix + report.summary + "\n" + report.analysis.reasons.slice(0, 5).join("\n")
        + "\nيمكنك طلب شرح الدعم والمقاومة أو السيناريوهات أو أي مؤشر.");
    }
    return reply("help", "أستطيع شرح التقرير الحالي: الاتجاه، الدعم والمقاومة، سيناريو الاختراق والكسر، RSI وMACD وATR والمتوسطات، ووقت البيانات. جرّب: «اشرح لي الدعم والمقاومة» أو «لماذا القراءات متعارضة؟».");
  }

  return Object.freeze({ version: VERSION, AnalysisInputError, intervalSettings, parseCSV, parseCsv: parseCSV, createReport, answerQuestion, formatPrice });
});
