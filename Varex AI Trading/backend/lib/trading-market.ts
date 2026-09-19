export const TRADING_MARKETS = {
  "BTC-USD": { symbol: "BTC-USD", label: "BTC / USD", name: "Bitcoin", icon: "₿" },
  "ETH-USD": { symbol: "ETH-USD", label: "ETH / USD", name: "Ethereum", icon: "Ξ" },
  "SOL-USD": { symbol: "SOL-USD", label: "SOL / USD", name: "Solana", icon: "S" },
  "ADA-USD": { symbol: "ADA-USD", label: "ADA / USD", name: "Cardano", icon: "A" },
} as const;

export type TradingSymbol = keyof typeof TRADING_MARKETS;
export type MarketSnapshot = {
  symbol: TradingSymbol;
  label: string;
  name: string;
  icon: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volumeBase: number;
  volumeUsd: number;
  changePct: number;
  asOf: string;
  source: string;
  candles?: Array<{ time: number; low: number; high: number; open: number; close: number; volume: number }>;
};

const KRAKEN_MARKETS: Record<TradingSymbol, string> = {
  "BTC-USD": "XBTUSD",
  "ETH-USD": "ETHUSD",
  "SOL-USD": "SOLUSD",
  "ADA-USD": "ADAUSD",
};

export class TradingMarketError extends Error {
  constructor(message = "تعذر جلب أسعار السوق الحية حالياً.") { super(message); }
}

function finite(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TradingMarketError();
  return number;
}

export function normalizeTradingSymbol(value: unknown): TradingSymbol {
  const symbol = String(value ?? "BTC-USD").trim().toUpperCase() as TradingSymbol;
  return symbol in TRADING_MARKETS ? symbol : "BTC-USD";
}

async function coinbase(path: string) {
  const response = await fetch(`https://api.exchange.coinbase.com${path}`, {
    headers: { accept: "application/json", "user-agent": "VAREX-AI-Trading/1.0" },
    signal: AbortSignal.timeout(9_000),
  });
  if (!response.ok) throw new TradingMarketError();
  return response.json();
}

async function kraken(path: string) {
  const response = await fetch(`https://api.kraken.com${path}`, {
    headers: { accept: "application/json", "user-agent": "VAREX-AI-Trading/1.0" },
    signal: AbortSignal.timeout(9_000),
  });
  if (!response.ok) throw new TradingMarketError();
  const payload = await response.json() as { error?: unknown[]; result?: Record<string, unknown> };
  if (Array.isArray(payload.error) && payload.error.length) throw new TradingMarketError();
  if (!payload.result || typeof payload.result !== "object") throw new TradingMarketError();
  return payload.result;
}

async function coinbaseSnapshot(symbol: TradingSymbol, includeCandles: boolean): Promise<MarketSnapshot> {
  const meta = TRADING_MARKETS[symbol];
  const [statsPayload, candlesPayload] = await Promise.all([
    coinbase(`/products/${symbol}/stats`),
    includeCandles ? coinbase(`/products/${symbol}/candles?granularity=3600`) : Promise.resolve(null),
  ]);
  const stats = statsPayload as Record<string, unknown>;
  const price = finite(stats.last), open = finite(stats.open), volumeBase = finite(stats.volume);
  const snapshot: MarketSnapshot = {
    ...meta,
    price,
    open,
    high: finite(stats.high),
    low: finite(stats.low),
    volumeBase,
    volumeUsd: volumeBase * price,
    changePct: open === 0 ? 0 : ((price - open) / open) * 100,
    asOf: new Date().toISOString(),
    source: "Coinbase Exchange",
  };
  if (Array.isArray(candlesPayload)) {
    snapshot.candles = candlesPayload
      .slice(0, 48)
      .map((row) => Array.isArray(row) ? ({ time: finite(row[0]), low: finite(row[1]), high: finite(row[2]), open: finite(row[3]), close: finite(row[4]), volume: finite(row[5]) }) : null)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.time - b.time);
  }
  return snapshot;
}

async function krakenSnapshot(symbol: TradingSymbol, includeCandles: boolean): Promise<MarketSnapshot> {
  const meta = TRADING_MARKETS[symbol], pair = KRAKEN_MARKETS[symbol];
  const [tickerResult, ohlcResult] = await Promise.all([
    kraken(`/0/public/Ticker?pair=${encodeURIComponent(pair)}`),
    includeCandles ? kraken(`/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=60`) : Promise.resolve(null),
  ]);
  const ticker = Object.values(tickerResult).find((value) => value && typeof value === "object" && !Array.isArray(value)) as Record<string, unknown> | undefined;
  if (!ticker) throw new TradingMarketError();
  const last = Array.isArray(ticker.c) ? ticker.c : [], volumes = Array.isArray(ticker.v) ? ticker.v : [];
  const highs = Array.isArray(ticker.h) ? ticker.h : [], lows = Array.isArray(ticker.l) ? ticker.l : [];
  const price = finite(last[0]), open = finite(ticker.o), volumeBase = finite(volumes[1] ?? volumes[0]);
  const snapshot: MarketSnapshot = {
    ...meta,
    price,
    open,
    high: finite(highs[1] ?? highs[0]),
    low: finite(lows[1] ?? lows[0]),
    volumeBase,
    volumeUsd: volumeBase * price,
    changePct: open === 0 ? 0 : ((price - open) / open) * 100,
    asOf: new Date().toISOString(),
    source: "Kraken",
  };
  if (ohlcResult) {
    const rows = Object.entries(ohlcResult).find(([key, value]) => key !== "last" && Array.isArray(value))?.[1];
    if (Array.isArray(rows)) {
      snapshot.candles = rows
        .slice(-48)
        .map((row) => Array.isArray(row) ? ({ time: finite(row[0]), open: finite(row[1]), high: finite(row[2]), low: finite(row[3]), close: finite(row[4]), volume: finite(row[6]) }) : null)
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }
  }
  return snapshot;
}

export async function getMarketSnapshot(value: unknown, includeCandles = false): Promise<MarketSnapshot> {
  const symbol = normalizeTradingSymbol(value);
  try {
    return await coinbaseSnapshot(symbol, includeCandles);
  } catch {
    try {
      return await krakenSnapshot(symbol, includeCandles);
    } catch {
      throw new TradingMarketError();
    }
  }
}

export async function getMarketBoard(selected: unknown) {
  const requestedSymbol = normalizeTradingSymbol(selected);
  const symbols = Object.keys(TRADING_MARKETS) as TradingSymbol[];
  const results = await Promise.allSettled(symbols.map((symbol) => getMarketSnapshot(symbol, symbol === requestedSymbol)));
  const snapshots = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!snapshots.length) throw new TradingMarketError();
  let selectedSymbol = snapshots.some((market) => market.symbol === requestedSymbol) ? requestedSymbol : snapshots[0].symbol;
  const selectedMarket = snapshots.find((market) => market.symbol === selectedSymbol);
  if (selectedMarket && !selectedMarket.candles?.length) {
    try {
      const detailed = await getMarketSnapshot(selectedSymbol, true);
      snapshots.splice(snapshots.indexOf(selectedMarket), 1, detailed);
    } catch {}
  }
  selectedSymbol = snapshots.some((market) => market.symbol === selectedSymbol) ? selectedSymbol : snapshots[0].symbol;
  return { selected: selectedSymbol, markets: snapshots, source: snapshots.find((market) => market.symbol === selectedSymbol)?.source, live: true };
}

export function analyzeSnapshot(snapshot: MarketSnapshot) {
  const momentum = snapshot.changePct;
  const dailyRangePct = snapshot.open ? ((snapshot.high - snapshot.low) / snapshot.open) * 100 : 0;
  const direction = momentum >= 1 ? "buy" : momentum <= -1 ? "sell" : "wait";
  const confidence = Math.max(52, Math.min(92, Math.round(56 + Math.abs(momentum) * 7 - Math.max(0, dailyRangePct - 8))));
  const volatility = dailyRangePct >= 8 ? "high" : dailyRangePct >= 4 ? "medium" : "low";
  const riskDistance = Math.max(0.012, Math.min(0.035, dailyRangePct / 100 / 2));
  const multiplier = direction === "sell" ? -1 : 1;
  return {
    id: crypto.randomUUID(),
    symbol: snapshot.symbol,
    direction,
    confidence,
    volatility,
    price: snapshot.price,
    target: direction === "wait" ? snapshot.price : snapshot.price * (1 + multiplier * riskDistance * 1.8),
    stop: direction === "wait" ? snapshot.price : snapshot.price * (1 - multiplier * riskDistance),
    momentumPct: momentum,
    rangePct: dailyRangePct,
    reasons: [
      `التغير خلال 24 ساعة ${momentum >= 0 ? "+" : ""}${momentum.toFixed(2)}%`,
      `نطاق الحركة اليومي ${dailyRangePct.toFixed(2)}%`,
      direction === "wait" ? "الزخم الحالي لا يتجاوز عتبة الدخول الآمنة" : `الزخم يدعم اتجاه ${direction === "buy" ? "الشراء" : "البيع"}`,
    ],
    createdAt: new Date().toISOString(),
    engine: "VAREX market intelligence v1",
    disclaimer: "تحليل احتمالي تعليمي وليس ضماناً للربح أو توصية استثمارية.",
  };
}
