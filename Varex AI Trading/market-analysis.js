(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VarexMarketAnalysis = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = "1.0.0";
  const STALE_INTERVALS = 2;
  const REQUIREMENTS = Object.freeze([
    { key: "ema20", label: "المتوسط الأسي EMA 20", bars: 20 },
    { key: "ema50", label: "المتوسط الأسي EMA 50", bars: 50 },
    { key: "rsi14", label: "مؤشر القوة النسبية RSI 14", bars: 15 },
    { key: "macd", label: "MACD 12 / 26 / 9", bars: 34 },
    { key: "atr14", label: "متوسط المدى الحقيقي ATR 14", bars: 15 },
    { key: "supportResistance", label: "نطاق الدعم والمقاومة السابق", bars: 21 },
  ]);

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const periodValid = (period) => Number.isSafeInteger(period) && period > 0;
  const valuesValid = (values) => Array.isArray(values) && Array.from(values).every(finite);
  const last = (values) => values.length ? values[values.length - 1] : null;
  const format = (value) => finite(value) ? Number(value.toPrecision(6)).toString() : "غير متاح";

  function average(values) {
    // Weighted updates avoid the large intermediate sum of ordinary sum / count.
    return values.reduce((mean, value, index) => mean * (index / (index + 1)) + value / (index + 1), 0);
  }

  function emaSeries(values, period) {
    if (!valuesValid(values) || !periodValid(period)) return [];
    const result = new Array(values.length).fill(null);
    if (values.length < period) return result;
    let value = average(values.slice(0, period));
    if (!finite(value)) return result;
    result[period - 1] = value;
    const alpha = 2 / (period + 1);
    for (let index = period; index < values.length; index += 1) {
      value = value * (1 - alpha) + values[index] * alpha;
      if (!finite(value)) break;
      result[index] = value;
    }
    return result;
  }

  function calculateEMA(values, period) {
    return last(emaSeries(values, period));
  }

  function calculateRSI(values, period = 14) {
    if (!valuesValid(values) || !periodValid(period) || values.length < period + 1) return null;
    const gains = [], losses = [];
    for (let index = 1; index <= period; index += 1) {
      const change = values[index] - values[index - 1];
      if (!finite(change)) return null;
      gains.push(Math.max(0, change));
      losses.push(Math.max(0, -change));
    }
    let gain = average(gains), loss = average(losses);
    for (let index = period + 1; index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      if (!finite(change)) return null;
      gain = gain * ((period - 1) / period) + Math.max(0, change) / period;
      loss = loss * ((period - 1) / period) + Math.max(0, -change) / period;
    }
    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;
    if (gain === 0) return 0;
    // This form stays finite even when gain / loss would overflow.
    const result = gain >= loss ? 100 / (1 + loss / gain) : 100 * (gain / loss) / (1 + gain / loss);
    return finite(result) ? Math.min(100, Math.max(0, result)) : null;
  }

  function calculateMACD(values) {
    if (!valuesValid(values) || values.length < 26) return null;
    const fast = emaSeries(values, 12), slow = emaSeries(values, 26);
    const lines = values.slice(25).map((_, index) =>
      finite(fast[index + 25]) && finite(slow[index + 25]) ? fast[index + 25] - slow[index + 25] : null);
    if (!lines.every(finite)) return null;
    const line = last(lines), signal = calculateEMA(lines, 9);
    const histogram = signal === null ? null : line - signal;
    return { line, signal, histogram: finite(histogram) ? histogram : null };
  }

  function validOHLC(candle) {
    return candle !== null && typeof candle === "object"
      && [candle.open, candle.high, candle.low, candle.close].every(finite)
      && candle.low <= candle.high
      && candle.low <= candle.open && candle.open <= candle.high
      && candle.low <= candle.close && candle.close <= candle.high
      && (candle.volume === undefined || (finite(candle.volume) && candle.volume >= 0));
  }

  function calculateATR(candles, period = 14) {
    if (!Array.isArray(candles) || !periodValid(period)
      || candles.length < period + 1 || !candles.every(validOHLC)) return null;
    // Require a known previous close for every true range: 14 ranges need 15 bars.
    const ranges = candles.slice(1).map((candle, index) => Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - candles[index].close),
      Math.abs(candle.low - candles[index].close),
    ));
    if (!ranges.every(finite)) return null;
    let result = average(ranges.slice(0, period));
    for (let index = period; index < ranges.length; index += 1) {
      result = result * ((period - 1) / period) + ranges[index] / period;
    }
    return finite(result) ? result : null;
  }

  function compare(left, right, scale = 0) {
    const tolerance = Number.EPSILON * Math.max(Math.abs(left), Math.abs(right), Math.abs(scale), Number.MIN_VALUE) * 16;
    if (Math.abs(left - right) <= tolerance) return 0;
    return left > right ? 1 : -1;
  }

  function normalizeCandles(input, intervalSeconds, now) {
    const quality = {
      inputCount: Array.isArray(input) ? input.length : 0,
      invalidRows: 0, duplicateRows: 0, conflictingTimestamps: 0,
      incompleteRows: 0, futureRows: 0, gaps: 0,
    };
    const rows = new Map(), conflicts = new Set();
    for (const candle of Array.isArray(input) ? input : []) {
      if (!validOHLC(candle) || !Number.isSafeInteger(candle.time) || candle.time < 0) {
        quality.invalidRows += 1;
        continue;
      }
      const timestamp = candle.time * 1000;
      if (timestamp > now) { quality.futureRows += 1; continue; }
      if ((candle.time + intervalSeconds) * 1000 > now) { quality.incompleteRows += 1; continue; }
      if (conflicts.has(candle.time)) { quality.duplicateRows += 1; continue; }
      const previous = rows.get(candle.time);
      if (previous) {
        quality.duplicateRows += 1;
        if (["open", "high", "low", "close"].some((key) => previous[key] !== candle[key])) {
          // Conflicting historical rows have no reliable order; do not pick a price arbitrarily.
          rows.delete(candle.time);
          conflicts.add(candle.time);
          quality.conflictingTimestamps += 1;
        }
        continue;
      }
      rows.set(candle.time, {
        time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close,
        ...(candle.volume === undefined ? {} : { volume: candle.volume }),
      });
    }
    const candles = [...rows.values()].sort((a, b) => a.time - b.time);
    for (let index = 1; index < candles.length; index += 1) {
      if (candles[index].time - candles[index - 1].time !== intervalSeconds) quality.gaps += 1;
    }
    return { candles, quality };
  }

  function buildIndicators(candles) {
    const closes = candles.map((candle) => candle.close), close = last(closes);
    const ema20 = calculateEMA(closes, 20), ema50 = calculateEMA(closes, 50);
    const rsi14 = calculateRSI(closes), macd = calculateMACD(closes), atr14 = calculateATR(candles);
    const preceding = candles.slice(-21, -1);
    const rangeAvailable = preceding.length === 20;
    const support = rangeAvailable ? Math.min(...preceding.map((candle) => candle.low)) : null;
    const resistance = rangeAvailable ? Math.max(...preceding.map((candle) => candle.high)) : null;
    const percentOfClose = atr14 !== null && close !== 0 ? atr14 / Math.abs(close) * 100 : null;
    return {
      ema20: { available: ema20 !== null, value: ema20, period: 20, requiredBars: 20 },
      ema50: { available: ema50 !== null, value: ema50, period: 50, requiredBars: 50 },
      rsi14: { available: rsi14 !== null, value: rsi14, period: 14, requiredBars: 15,
        zone: rsi14 === null ? null : rsi14 >= 70 ? "overbought" : rsi14 <= 30 ? "oversold" : "neutral" },
      macd: { available: macd !== null && macd.signal !== null && finite(macd.histogram),
        line: macd?.line ?? null, signal: macd?.signal ?? null, histogram: macd?.histogram ?? null,
        fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, requiredBars: 34 },
      atr14: { available: atr14 !== null, value: atr14, period: 14, requiredBars: 15,
        percentOfClose: finite(percentOfClose) ? percentOfClose : null },
      supportResistance: { available: rangeAvailable, support, resistance, lookback: 20, requiredBars: 21,
        position: !rangeAvailable ? null : compare(close, resistance) > 0 ? "above"
          : compare(close, support) < 0 ? "below" : "inside" },
    };
  }

  function indicatorVotes(indicators, close) {
    const votes = [];
    const add = (key, label, comparison) => votes.push({
      key, label, direction: comparison > 0 ? "bullish" : comparison < 0 ? "bearish" : "neutral",
    });
    if (indicators.ema20.available) add("priceEma20", "الإغلاق مقابل EMA 20", compare(close, indicators.ema20.value));
    if (indicators.ema20.available && indicators.ema50.available) {
      add("emaTrend", "EMA 20 مقابل EMA 50", compare(indicators.ema20.value, indicators.ema50.value));
    }
    if (indicators.rsi14.available) {
      const value = indicators.rsi14.value;
      add("rsiMomentum", "زخم RSI", value >= 55 ? 1 : value <= 45 ? -1 : 0);
    }
    if (indicators.macd.available) {
      add("macdMomentum", "MACD مقابل خط الإشارة", compare(indicators.macd.line, indicators.macd.signal, close));
    }
    if (indicators.supportResistance.available) {
      add("rangePosition", "الإغلاق مقابل النطاق السابق",
        indicators.supportResistance.position === "above" ? 1 : indicators.supportResistance.position === "below" ? -1 : 0);
    }
    const agreement = { bullish: 0, bearish: 0, neutral: 0, total: votes.length, votes };
    votes.forEach((vote) => { agreement[vote.direction] += 1; });
    return agreement;
  }

  function describe(indicators, agreement, status, missing, quality) {
    const reasons = [];
    if (status === "unavailable") reasons.push("لا توجد شموع مغلقة صالحة لحساب المؤشرات.");
    else {
      if (status === "stale") reasons.push("البيانات قديمة بالنسبة إلى الإطار الزمني؛ الأرقام تصف آخر شموع متاحة وليست قراءة لحظية.");
      if (status === "insufficient") reasons.push("التاريخ المتاح لا يكفي لكل المؤشرات؛ تظهر فقط الحسابات التي اكتمل عدد شموعها.");
      if (indicators.ema20.available && indicators.ema50.available) {
        const relation = compare(indicators.ema20.value, indicators.ema50.value);
        reasons.push("EMA 20 " + (relation > 0 ? "أعلى من" : relation < 0 ? "أدنى من" : "يساوي تقريباً") + " EMA 50.");
      }
      if (indicators.rsi14.available) {
        reasons.push("RSI 14 = " + format(indicators.rsi14.value) + "؛ "
          + (indicators.rsi14.zone === "overbought" ? "ضمن نطاق التشبع بالشراء، وهو وصف للزخم لا أمر للبيع."
            : indicators.rsi14.zone === "oversold" ? "ضمن نطاق التشبع بالبيع، وهو وصف للزخم لا أمر للشراء."
              : "خارج نطاقي التشبع 30 و70."));
      }
      if (indicators.macd.available) {
        const relation = compare(indicators.macd.line, indicators.macd.signal, indicators.ema20.value || 0);
        reasons.push("خط MACD " + (relation > 0 ? "أعلى من" : relation < 0 ? "أدنى من" : "يساوي تقريباً") + " خط الإشارة.");
      }
      if (indicators.atr14.available) reasons.push("ATR 14 = " + format(indicators.atr14.value) + "؛ مقياس لحركة السعر بوحدة السوق، وليس لاتجاهه.");
      if (indicators.supportResistance.available) reasons.push(
        "أدنى نطاق الشموع العشرين السابقة " + format(indicators.supportResistance.support)
        + " وأعلاه " + format(indicators.supportResistance.resistance) + "؛ الشمعة الأخيرة مستبعدة من حساب هذين الحدين.",
      );
      reasons.push("اتفاق المؤشرات: " + agreement.bullish + " صاعدة، " + agreement.bearish + " هابطة، "
        + agreement.neutral + " محايدة من أصل " + agreement.total + ". هذا عدّ للقراءات وليس نسبة نجاح.");
    }
    if (missing.length) reasons.push("مؤشرات غير مكتملة: " + missing.map((item) => item.label
      + (item.reason === "insufficient_history" ? " — تحتاج " + item.requiredBars + " شمعة" : " — تعذر حساب قيمة عددية صالحة")).join("؛ ") + ".");
    if (quality.invalidRows || quality.conflictingTimestamps) {
      reasons.push("استُبعدت البيانات غير الصالحة أو المتعارضة؛ قد يقل عدد الشموع المتاحة للحساب.");
    }
    if (quality.gaps) reasons.push("توجد فواصل في توقيت الشموع؛ الحسابات تعتمد على الشموع المتاحة، وقد تتضمن فترات إغلاق السوق أو نقصاً في البيانات.");
    return reasons;
  }

  function analyzeCandles(options = {}) {
    const input = options !== null && typeof options === "object" ? options : {};
    const intervalSeconds = input.intervalSeconds === undefined ? 3600 : input.intervalSeconds;
    const now = input.now === undefined ? Date.now() : input.now;
    const validOptions = periodValid(intervalSeconds) && finite(now) && now >= 0 && now <= 8.64e15;
    const normalized = normalizeCandles(validOptions ? input.candles : [], validOptions ? intervalSeconds : 3600, validOptions ? now : 0);
    const candles = normalized.candles, quality = normalized.quality;
    const indicators = buildIndicators(candles), closing = last(candles);
    const closeTime = closing ? (closing.time + intervalSeconds) * 1000 : null;
    const ageSeconds = closeTime === null ? null : (now - closeTime) / 1000;
    const stale = closing !== null && ageSeconds >= intervalSeconds * STALE_INTERVALS;
    const missingIndicatorDetails = REQUIREMENTS.filter((item) => !indicators[item.key].available)
      .map((item) => ({ key: item.key, label: item.label, requiredBars: item.bars, availableBars: candles.length,
        reason: candles.length < item.bars ? "insufficient_history" : "invalid_calculation" }));
    const status = !closing ? "unavailable" : stale ? "stale" : missingIndicatorDetails.length ? "insufficient" : "ready";
    const agreement = indicatorVotes(indicators, closing?.close ?? null);
    const direction = agreement.total > 0 && agreement.bullish > agreement.total / 2 ? "bullish"
      : agreement.total > 0 && agreement.bearish > agreement.total / 2 ? "bearish" : "neutral";
    const reasons = describe(indicators, agreement, status, missingIndicatorDetails, quality);
    if (!validOptions) reasons.unshift("الإطار الزمني أو وقت التقييم غير صالح.");
    return {
      version: VERSION,
      symbol: typeof input.symbol === "string" ? input.symbol.trim() : "",
      source: typeof input.source === "string" ? input.source.trim() : "",
      status, direction, isCurrent: closing !== null && !stale,
      intervalSeconds: validOptions ? intervalSeconds : null,
      asOf: closeTime === null ? null : new Date(closeTime).toISOString(),
      lastCandleTime: closing?.time ?? null,
      lastClose: closing?.close ?? null,
      candleCount: candles.length,
      indicators, agreement,
      missingIndicators: missingIndicatorDetails.map((item) => item.key),
      missingIndicatorDetails,
      dataQuality: { ...quality, ageSeconds, staleAfterSeconds: validOptions ? intervalSeconds * STALE_INTERVALS : null },
      reasons,
      explanation: "قراءة فنية وصفية من الشموع المغلقة. المؤشرات مترابطة، واتفاقها ليس احتمال ربح ولا توصية بتنفيذ صفقة.",
    };
  }

  return Object.freeze({ version: VERSION, analyzeCandles, calculateEMA, calculateRSI, calculateMACD, calculateATR });
});
