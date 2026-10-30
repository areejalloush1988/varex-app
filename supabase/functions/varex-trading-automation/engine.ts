/** Pure demo decision engine. No broker credentials, order clients or network calls. */
export const BOT_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"] as const;
export const BOT_INTERVALS: Record<string, number> = { "5": 300, "15": 900, "60": 3600 };
export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type Quote = { price: number; time: number };
export type BotConfig = { symbol: string; interval: string; risk_percent: number; max_daily_trades: number; last_bar_at: number };
export type DemoTrade = { id: string; symbol: string; side: "buy" | "sell"; amount: number; quantity: number; entryPrice: number; exitPrice: number | null; stopPrice: number; pnl: number; status: "open" | "closed"; openedAt: string; closedAt: string | null };
export type DemoState = { balanceCents: number; trades: DemoTrade[]; risk: { maxOpenTrades: number; maxDailyLossPct: number; riskPerTradePct: number }; [key: string]: unknown };
export type ModelCheck = { accuracy: number; baseline: number; samples: number; trainingSamples: number; qualified: boolean };
export type Decision = { signal: "buy" | "sell" | "wait"; asOf: number; atr: number; reason: string; model: ModelCheck | null };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rounded = (value: number) => Math.round(value * 100) / 100;
export function validQuote(quote: Quote | undefined, now: number) {
  return Boolean(Number.isSafeInteger(now) && now >= 0 && now <= 8.64e15
    && quote && finite(quote.price) && quote.price > 0 && Number.isSafeInteger(quote.time)
    && quote.time <= now + 5000 && quote.time >= now - 90_000);
}

export function closedHistory(rows: Candle[], seconds: number, now: number): Candle[] {
  if (![300, 900, 3600].includes(seconds) || !Array.isArray(rows)
    || !Number.isSafeInteger(now) || now < 0 || now > 8.64e15) throw new Error("invalid_history");
  const seen = new Map<number, Candle>();
  for (const row of rows) {
    if (!row || ![row.time, row.open, row.high, row.low, row.close].every(finite)
      || !Number.isSafeInteger(row.time) || row.time % seconds !== 0 || row.time < 0 || row.low <= 0
      || row.high < Math.max(row.open, row.close) || row.low > Math.min(row.open, row.close)) throw new Error("invalid_history");
    if ((row.time + seconds) * 1000 > now) continue;
    const prior = seen.get(row.time);
    if (prior && ["open", "high", "low", "close"].some((key) => prior[key as keyof Candle] !== row[key as keyof Candle])) throw new Error("conflicting_history");
    seen.set(row.time, row);
  }
  const bars = [...seen.values()].sort((a, b) => a.time - b.time).slice(-350);
  if (bars.length < 160) throw new Error("insufficient_history");
  if (now - (bars.at(-1)!.time + seconds) * 1000 >= seconds * 2000) throw new Error("stale_history");
  if (bars.some((bar, index) => index > 0 && bar.time - bars[index - 1].time !== seconds)) throw new Error("gapped_history");
  return bars;
}

function ema(values: number[], period: number) {
  const output: number[] = values.map(() => NaN);
  if (values.length < period) return output;
  output[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) output[i] = values[i] * alpha + output[i - 1] * (1 - alpha);
  return output;
}

/** Features at t use bars <= t; target is the NEXT closed candle. */
export function features(bars: Candle[]) {
  const closes = bars.map((bar) => bar.close), fast = ema(closes, 20), slow = ema(closes, 50);
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const macd = closes.map((_, i) => e12[i] - e26[i]);
  const macdSignals = ema(macd.slice(25), 9);
  let gain = 0, loss = 0, atr = 0;
  const rows: { values: number[]; rsi: number; atr: number; trend: number; histogram: number; index: number }[] = [];
  for (let i = 1; i < bars.length; i++) {
    const difference = closes[i] - closes[i - 1];
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - closes[i - 1]), Math.abs(bars[i].low - closes[i - 1]));
    if (i <= 14) { gain += Math.max(0, difference) / 14; loss += Math.max(0, -difference) / 14; atr += tr / 14; }
    else { gain = (gain * 13 + Math.max(0, difference)) / 14; loss = (loss * 13 + Math.max(0, -difference)) / 14; atr = (atr * 13 + tr) / 14; }
    if (i < 50 || atr <= 0) continue;
    const rsi = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    const histogram = macd[i] - macdSignals[i - 25];
    const trend = fast[i] - slow[i];
    const values = [trend / atr, (rsi - 50) / 50, histogram / atr, difference / atr, (closes[i] - bars[i].open) / atr];
    if (values.every(finite)) rows.push({ values, rsi, atr, trend, histogram, index: i });
  }
  return rows;
}

const sigmoid = (value: number) => 1 / (1 + Math.exp(-clamp(value, -25, 25)));

export function decide(rows: Candle[], seconds: number, now: number): Decision {
  const bars = closedHistory(rows, seconds, now), data = features(bars);
  const samples = data.slice(0, -1).map((row) => ({ x: row.values, y: bars[row.index + 1].close > bars[row.index].close ? 1 : 0 }));
  const split = Math.floor(samples.length * .7), train = samples.slice(0, split), holdout = samples.slice(split);
  const latest = data.at(-1);
  if (!latest || train.length < 70 || holdout.length < 30) throw new Error("insufficient_model_history");
  // Scaling is fitted ONLY to training rows. Validation is chronological.
  const means = latest.values.map((_, j) => train.reduce((s, row) => s + row.x[j], 0) / train.length);
  const scales = means.map((mean, j) => Math.sqrt(train.reduce((s, row) => s + (row.x[j] - mean) ** 2, 0) / train.length) || 1);
  const vector = (values: number[]) => [1, ...values.map((v, j) => clamp((v - means[j]) / scales[j], -5, 5))];
  const weights = new Array(latest.values.length + 1).fill(0);
  const prepared = train.map((row) => ({ x: vector(row.x), y: row.y }));
  for (let epoch = 0; epoch < 60; epoch++) {
    const gradient = weights.map(() => 0);
    for (const row of prepared) {
      const error = sigmoid(weights.reduce((s, w, j) => s + w * row.x[j], 0)) - row.y;
      gradient.forEach((_, j) => { gradient[j] += error * row.x[j] / prepared.length; });
    }
    weights.forEach((_, j) => { weights[j] -= .08 * (gradient[j] + (j === 0 ? 0 : .02 * weights[j])); });
  }
  const predict = (x: number[]) => sigmoid(vector(x).reduce((sum, value, j) => sum + value * weights[j], 0));
  const accuracy = holdout.filter((row) => Number(predict(row.x) >= .5) === row.y).length / holdout.length;
  const positives = holdout.reduce((sum, row) => sum + row.y, 0) / holdout.length;
  const baseline = Math.max(positives, 1 - positives);
  const model = { accuracy, baseline, samples: holdout.length, trainingSamples: train.length, qualified: accuracy >= .55 && accuracy >= baseline + .03 };
  const result: Decision = { signal: "wait", asOf: (bars.at(-1)!.time + seconds) * 1000, atr: latest.atr, model, reason: "لا توجد إشارة متفقة بين النموذج والمؤشرات." };
  if (!model.qualified) return { ...result, reason: "انتظار: فحص النموذج على الشموع المحجوزة لم يتجاوز خط المقارنة بهامش كافٍ." };
  const probability = predict(latest.values);
  if (probability >= .6 && latest.trend > 0 && latest.histogram > 0 && latest.rsi > 50 && latest.rsi < 70) return { ...result, signal: "buy", reason: "اتفق النموذج الإحصائي مع اتجاه المتوسطات والزخم على إشارة شراء تجريبية." };
  if (probability <= .4 && latest.trend < 0 && latest.histogram < 0 && latest.rsi < 50 && latest.rsi > 30) return { ...result, signal: "sell", reason: "اتفق النموذج الإحصائي مع اتجاه المتوسطات والزخم على إشارة بيع تجريبية." };
  return result;
}

export function evaluateDemo(input: { state: DemoState; config: BotConfig; decision: Decision | null; quotes: Record<string, Quote>; now: number; uuid: () => string }) {
  const { config, quotes, now, uuid } = input;
  if (!Number.isSafeInteger(now) || now < 0 || now > 8.64e15
    || !config || !(BOT_SYMBOLS as readonly string[]).includes(config.symbol)
    || typeof config.interval !== "string" || !Object.hasOwn(BOT_INTERVALS, config.interval)
    || !finite(config.risk_percent) || config.risk_percent < .25 || config.risk_percent > 2
    || !Number.isInteger(config.max_daily_trades) || config.max_daily_trades < 1 || config.max_daily_trades > 20
    || !Number.isSafeInteger(config.last_bar_at) || config.last_bar_at < 0 || config.last_bar_at > now) throw new Error("invalid_bot_config");
  const state = structuredClone(input.state);
  if (!state || !Number.isSafeInteger(state.balanceCents) || state.balanceCents < 0 || !Array.isArray(state.trades)
    || !state.risk || !Number.isInteger(state.risk.maxOpenTrades) || state.risk.maxOpenTrades < 1 || state.risk.maxOpenTrades > 10
    || !finite(state.risk.maxDailyLossPct) || state.risk.maxDailyLossPct < .5 || state.risk.maxDailyLossPct > 20
    || !finite(state.risk.riskPerTradePct) || state.risk.riskPerTradePct < .25 || state.risk.riskPerTradePct > 5) throw new Error("invalid_demo_state");
  const ids = new Set<string>();
  for (const trade of state.trades) {
    if (!trade || typeof trade.id !== "string" || !trade.id || ids.has(trade.id) || typeof trade.symbol !== "string"
      || !["buy", "sell"].includes(trade.side) || !["open", "closed"].includes(trade.status)
      || ![trade.amount, trade.quantity, trade.entryPrice, trade.stopPrice, trade.pnl].every(finite)
      || trade.amount <= 0 || trade.quantity <= 0 || trade.entryPrice <= 0 || trade.stopPrice < 0
      || typeof trade.openedAt !== "string" || !finite(Date.parse(trade.openedAt)) || Date.parse(trade.openedAt) > now + 5000
      || (trade.status === "open" && (trade.closedAt !== null || trade.exitPrice !== null))
      || (trade.status === "closed" && (!finite(trade.exitPrice) || trade.exitPrice <= 0 || typeof trade.closedAt !== "string"
        || !finite(Date.parse(trade.closedAt)) || Date.parse(trade.closedAt) < Date.parse(trade.openedAt) || Date.parse(trade.closedAt) > now + 5000))
      || (trade.id.startsWith("auto-") && (trade.stopPrice <= 0 || !(BOT_SYMBOLS as readonly string[]).includes(trade.symbol)
        || (trade.side === "buy" ? trade.stopPrice >= trade.entryPrice : trade.stopPrice <= trade.entryPrice)
        || Math.abs(trade.entryPrice * trade.quantity - trade.amount) > Math.max(.000001, trade.amount * 1e-8)))) throw new Error("invalid_demo_state");
    ids.add(trade.id);
  }
  // The decision is server-generated, but execution independently checks its
  // closed-bar time and model quality before allowing entries or signal exits.
  const candidate = input.decision, intervalMs = BOT_INTERVALS[config.interval] * 1000;
  const decision = candidate && ["buy", "sell", "wait"].includes(candidate.signal)
    && Number.isSafeInteger(candidate.asOf) && candidate.asOf > 0 && candidate.asOf % intervalMs === 0
    && candidate.asOf <= now && now - candidate.asOf < intervalMs * 2
    && finite(candidate.atr) && candidate.atr > 0 ? candidate : null;
  const model = decision?.model;
  const qualified = Boolean(model?.qualified === true && finite(model.accuracy) && model.accuracy <= 1
    && finite(model.baseline) && model.baseline >= .5 && model.baseline <= 1
    && model.accuracy >= .55 && model.accuracy >= model.baseline + .03
    && Number.isInteger(model.samples) && model.samples >= 30
    && Number.isInteger(model.trainingSamples) && model.trainingSamples >= 70);
  const entrySignal = qualified ? decision!.signal : "wait";
  const events: { at: string; action: string; message: string; symbol: string }[] = [];
  const at = new Date(now).toISOString();
  const newBar = Boolean(decision && decision.asOf > config.last_bar_at);
  for (const trade of state.trades) {
    if (trade.status !== "open" || !trade.id.startsWith("auto-") || !validQuote(quotes[trade.symbol], now)) continue;
    const price = quotes[trade.symbol].price, direction = trade.side === "buy" ? 1 : -1;
    const distance = Math.abs(trade.entryPrice - trade.stopPrice);
    const hitStop = direction * (price - trade.stopPrice) <= 0;
    const hitTarget = direction * (price - trade.entryPrice) >= 2 * distance;
    const opposite = newBar && trade.symbol === config.symbol && entrySignal !== "wait" && entrySignal !== trade.side;
    if (!hitStop && !hitTarget && !opposite) continue;
    trade.exitPrice = price;
    const pnl = rounded(direction * (price - trade.entryPrice) * trade.quantity);
    const balanceCents = Math.max(0, state.balanceCents + Math.round(pnl * 100));
    if (!finite(pnl) || !Number.isSafeInteger(Math.round(pnl * 100)) || !Number.isSafeInteger(balanceCents)) throw new Error("invalid_demo_state");
    trade.pnl = pnl;
    trade.closedAt = at; trade.status = "closed";
    state.balanceCents = balanceCents;
    events.push({ at, action: "close", symbol: trade.symbol, message: hitStop ? "إغلاق تجريبي عند تحقق وقف الخسارة." : hitTarget ? "إغلاق تجريبي عند تحقق هدف ضعفي مسافة الوقف." : "إغلاق تجريبي بعد تغير الإشارة." });
  }
  let message = decision?.reason || "تعذر الحصول على شموع مكتملة حديثة؛ لم يُفتح أي أمر.";
  let signal: "buy" | "sell" | "wait" = entrySignal;
  const wait = (why: string) => { message = why; signal = "wait"; };
  if (decision && decision.signal !== "wait" && !qualified) wait("فحص النموذج غير مؤهل للتنفيذ؛ لم تُفتح صفقة جديدة.");
  const quote = quotes[config.symbol];
  if (!validQuote(quote, now)) wait("الأسعار غير متاحة أو قديمة؛ توقف فتح الصفقات التجريبية.");
  else if (!newBar) wait("بانتظار إغلاق شمعة جديدة؛ لا تتكرر الصفقة على الشمعة نفسها.");
  else if (signal !== "wait") {
    const balance = state.balanceCents / 100;
    const day = new Date(now), start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    const open = state.trades.filter((t) => t.status === "open");
    const dailyPnl = state.trades.filter((t) => t.status === "closed" && t.closedAt && Date.parse(t.closedAt) >= start).reduce((sum, t) => sum + (finite(t.pnl) ? t.pnl : 0), 0);
    const todayCount = state.trades.filter((t) => t.id.startsWith("auto-") && Date.parse(t.openedAt) >= start).length;
    if (dailyPnl < 0 && -dailyPnl >= balance * state.risk.maxDailyLossPct / 100) wait("تم بلوغ حد الخسارة اليومي؛ أوقف البوت فتح صفقات جديدة.");
    else if (todayCount >= config.max_daily_trades) wait("تم بلوغ عدد الصفقات الآلية المسموح لليوم.");
    else if (open.length >= state.risk.maxOpenTrades || open.some((t) => t.symbol === config.symbol)) wait("يوجد مركز على السوق أو تم بلوغ حد المراكز المفتوحة.");
    else {
      const distance = clamp((decision?.atr || 0) * 2 / quote!.price, .005, .05);
      const risk = Math.min(config.risk_percent, state.risk.riskPerTradePct);
      const budget = Math.max(0, balance * .75 - open.reduce((sum, t) => sum + t.amount, 0));
      const amount = Math.floor(Math.min(balance * risk / 100 / distance, balance * .25, budget) * 100) / 100;
      if (amount < 25) wait("الرصيد التجريبي المتاح لا يكفي لحجم الصفقة الأدنى.");
      else {
        const quantity = amount / quote!.price, stopPrice = quote!.price * (signal === "buy" ? 1 - distance : 1 + distance);
        if (!finite(amount) || !finite(quantity) || quantity <= 0 || !finite(stopPrice) || stopPrice <= 0) throw new Error("invalid_quote");
        state.trades.unshift({ id: `auto-${uuid()}`, symbol: config.symbol, side: signal, amount, quantity,
          entryPrice: quote!.price, exitPrice: null, stopPrice,
          pnl: 0, status: "open", openedAt: at, closedAt: null });
        events.push({ at, action: "open", symbol: config.symbol, message: `فتح صفقة ${signal === "buy" ? "شراء" : "بيع"} تجريبية مع وقف وهدف.` });
      }
    }
  }
  const lastBar = decision && validQuote(quote, now) ? Math.max(config.last_bar_at, decision.asOf) : config.last_bar_at;
  return { state, signal, message, lastBar, model: decision?.model || null, events };
}
