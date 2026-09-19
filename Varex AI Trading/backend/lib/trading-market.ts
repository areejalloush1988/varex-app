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
  candles?: Array<{ time: number; low: number; high: number; open: number; close: number; volume: number }>;
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

export async function getMarketSnapshot(value: unknown, includeCandles = false): Promise<MarketSnapshot> {
  const symbol = normalizeTradingSymbol(value), meta = TRADING_MARKETS[symbol];
  try {
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
    };
    if (Array.isArray(candlesPayload)) {
      snapshot.candles = candlesPayload
        .slice(0, 48)
        .map((row) => Array.isArray(row) ? ({ time: finite(row[0]), low: finite(row[1]), high: finite(row[2]), open: finite(row[3]), close: finite(row[4]), volume: finite(row[5]) }) : null)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => a.time - b.time);
    }
    return snapshot;
  } catch (error) {
    if (error instanceof TradingMarketError) throw error;
    throw new TradingMarketError();
  }
}

export async function getMarketBoard(selected: unknown) {
  const selectedSymbol = normalizeTradingSymbol(selected);
  const symbols = Object.keys(TRADING_MARKETS) as TradingSymbol[];
  const snapshots = await Promise.all(symbols.map((symbol) => getMarketSnapshot(symbol, symbol === selectedSymbol)));
  return { selected: selectedSymbol, markets: snapshots, source: "Coinbase Exchange", live: true };
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
