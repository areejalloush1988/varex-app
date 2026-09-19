const BINANCE_API_BASE = "https://api.binance.com";
const REQUEST_TIMEOUT_MS = 10_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type BinanceCredentials = { apiKey: string; apiSecret: string };
export type EncryptedTradingSecret = { ciphertext: string; iv: string };
export type BinancePermissionSummary = {
  reading: boolean;
  spotTrading: boolean;
  withdrawals: boolean;
  internalTransfer: boolean;
  universalTransfer: boolean;
  margin: boolean;
  futures: boolean;
  options: boolean;
  portfolioMargin: boolean;
  ipRestricted: boolean;
};
export type BinanceBalance = { asset: string; free: number; locked: number; total: number };
export type BinanceAccountSummary = {
  provider: "binance";
  accountType: string;
  canTrade: boolean;
  permissions: BinancePermissionSummary;
  balances: BinanceBalance[];
  availableUsdt: number;
};
export type BinanceOrderResult = {
  providerOrderId: string;
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  status: string;
  executedQuantity: string;
  executedQuoteAmount: string;
  transactedAt: number;
};

type BinanceApiRestrictions = {
  ipRestrict?: boolean;
  enableReading?: boolean;
  enableWithdrawals?: boolean;
  enableInternalTransfer?: boolean;
  enableMargin?: boolean;
  enableFutures?: boolean;
  permitsUniversalTransfer?: boolean;
  enableVanillaOptions?: boolean;
  enableSpotAndMarginTrading?: boolean;
  enablePortfolioMarginTrading?: boolean;
};
type BinanceAccount = {
  canTrade?: boolean;
  accountType?: string;
  permissions?: string[];
  balances?: Array<{ asset?: string; free?: string; locked?: string }>;
};

export class TradingBrokerError extends Error {
  constructor(public status: number, message: string, public uncertain = false) { super(message); }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function exactArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function encryptionKey(masterKey: string) {
  let raw: Uint8Array;
  try { raw = base64ToBytes(masterKey); }
  catch { throw new TradingBrokerError(503, "مفتاح حماية بيانات التداول غير صالح."); }
  if (raw.byteLength !== 32) throw new TradingBrokerError(503, "مفتاح حماية بيانات التداول غير صالح.");
  return crypto.subtle.importKey("raw", exactArrayBuffer(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTradingSecret(value: string, masterKey: string): Promise<EncryptedTradingSecret> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(masterKey), encoder.encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptTradingSecret(value: EncryptedTradingSecret, masterKey: string) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: exactArrayBuffer(base64ToBytes(value.iv)) },
      await encryptionKey(masterKey),
      exactArrayBuffer(base64ToBytes(value.ciphertext)),
    );
    return decoder.decode(decrypted);
  } catch (error) {
    if (error instanceof TradingBrokerError) throw error;
    throw new TradingBrokerError(503, "تعذر فتح بيانات ربط حساب التداول بأمان.");
  }
}

export async function signBinancePayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function providerError(status: number, data: unknown) {
  const payload = data && typeof data === "object" ? data as { code?: unknown } : {};
  const code = Number(payload.code);
  const messages: Record<number, string> = {
    [-2014]: "صيغة مفتاح Binance غير صحيحة.",
    [-2015]: "رفضت Binance المفتاح أو الصلاحيات أو عنوان الاتصال.",
    [-1021]: "تعذر مزامنة وقت الطلب مع Binance. يلزم المحاولة من جديد.",
    [-1022]: "تعذر التحقق من توقيع مفتاح Binance.",
    [-1013]: "حجم الأمر لا يطابق حدود السوق في Binance.",
    [-2010]: "رفضت Binance الأمر. يلزم فحص الرصيد وحدود السوق.",
  };
  const uncertain = status >= 500 || code === -1007;
  const message = messages[code] || (uncertain
    ? "لم تؤكد Binance نتيجة الأمر. لن تتم إعادة المحاولة تلقائياً لتجنب تكرار الصفقة."
    : `رفضت Binance الطلب${Number.isFinite(code) ? ` (رمز ${code})` : ""}.`);
  return new TradingBrokerError(uncertain ? 502 : 400, message, uncertain);
}

async function binanceServerTime() {
  const response = await fetch(`${BINANCE_API_BASE}/api/v3/time`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({})) as { serverTime?: unknown };
  const serverTime = Number(payload.serverTime);
  if (!response.ok || !Number.isFinite(serverTime)) throw new TradingBrokerError(502, "تعذر الاتصال بوقت Binance الآن.");
  return Math.round(serverTime);
}

async function signedRequest<T>(credentials: BinanceCredentials, path: string, parameters: Record<string, string | number | boolean> = {}, method: "GET" | "POST" = "GET", timestamp?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) params.set(key, String(value));
  params.set("recvWindow", "5000");
  params.set("timestamp", String(timestamp ?? await binanceServerTime()));
  const payload = params.toString();
  params.set("signature", await signBinancePayload(payload, credentials.apiSecret));
  let response: Response;
  try {
    response = await fetch(`${BINANCE_API_BASE}${path}?${params.toString()}`, {
      method,
      headers: { "X-MBX-APIKEY": credentials.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new TradingBrokerError(502, "انقطع الاتصال مع Binance. لا تتم إعادة أوامر التداول تلقائياً.", method === "POST" && path === "/api/v3/order");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data && typeof data === "object" && Number((data as { code?: unknown }).code) < 0)) throw providerError(response.status, data);
  return data as T;
}

function permissionSummary(value: BinanceApiRestrictions): BinancePermissionSummary {
  return {
    reading: value.enableReading === true,
    spotTrading: value.enableSpotAndMarginTrading === true,
    withdrawals: value.enableWithdrawals === true,
    internalTransfer: value.enableInternalTransfer === true,
    universalTransfer: value.permitsUniversalTransfer === true,
    margin: value.enableMargin === true,
    futures: value.enableFutures === true,
    options: value.enableVanillaOptions === true,
    portfolioMargin: value.enablePortfolioMarginTrading === true,
    ipRestricted: value.ipRestrict === true,
  };
}

function assertSafePermissions(permissions: BinancePermissionSummary) {
  if (!permissions.reading) throw new TradingBrokerError(400, "يلزم تفعيل صلاحية القراءة لمفتاح Binance.");
  if (!permissions.spotTrading) throw new TradingBrokerError(400, "يلزم تفعيل Spot Trading فقط لمفتاح Binance.");
  if (permissions.withdrawals) throw new TradingBrokerError(400, "تم رفض المفتاح لأن صلاحية السحب مفعّلة. يلزم تعطيلها من Binance.");
  if (permissions.internalTransfer || permissions.universalTransfer) throw new TradingBrokerError(400, "تم رفض المفتاح لأن نقل الأموال مفعّل. يلزم تعطيل Internal Transfer وUniversal Transfer.");
  if (permissions.margin || permissions.futures || permissions.options || permissions.portfolioMargin) {
    throw new TradingBrokerError(400, "تم رفض المفتاح لأن صلاحيات تداول إضافية مفعّلة. المطلوب قراءة وSpot فقط.");
  }
}

export async function validateBinanceConnection(credentials: BinanceCredentials): Promise<BinanceAccountSummary> {
  const timestamp = await binanceServerTime();
  const [restrictions, account] = await Promise.all([
    signedRequest<BinanceApiRestrictions>(credentials, "/sapi/v1/account/apiRestrictions", {}, "GET", timestamp),
    signedRequest<BinanceAccount>(credentials, "/api/v3/account", { omitZeroBalances: true }, "GET", timestamp),
  ]);
  const permissions = permissionSummary(restrictions);
  assertSafePermissions(permissions);
  if (account.canTrade !== true || !Array.isArray(account.permissions) || !account.permissions.includes("SPOT")) {
    throw new TradingBrokerError(400, "حساب Binance غير جاهز لتداول Spot.");
  }
  const balances = (account.balances || []).map((balance) => {
    const free = Number(balance.free || 0), locked = Number(balance.locked || 0);
    return { asset: String(balance.asset || "").slice(0, 20), free, locked, total: free + locked };
  }).filter((balance) => balance.asset && Number.isFinite(balance.total) && balance.total > 0).slice(0, 100);
  return {
    provider: "binance",
    accountType: String(account.accountType || "SPOT").slice(0, 20),
    canTrade: true,
    permissions,
    balances,
    availableUsdt: balances.find((balance) => balance.asset === "USDT")?.free || 0,
  };
}

export const BINANCE_SYMBOLS: Record<string, string> = {
  "BTC-USD": "BTCUSDT",
  "ETH-USD": "ETHUSDT",
  "SOL-USD": "SOLUSDT",
  "ADA-USD": "ADAUSDT",
};

export function binanceSymbol(symbol: unknown) {
  const value = BINANCE_SYMBOLS[String(symbol || "").toUpperCase()];
  if (!value) throw new TradingBrokerError(400, "السوق المطلوب غير مدعوم في التداول الحقيقي حالياً.");
  return value;
}

export async function placeBinanceMarketOrder(credentials: BinanceCredentials, input: {
  symbol: string;
  side: "buy" | "sell";
  quoteAmount: number;
  clientOrderId: string;
}): Promise<BinanceOrderResult> {
  const symbol = binanceSymbol(input.symbol);
  const quoteOrderQty = input.quoteAmount.toFixed(2);
  const parameters = {
    symbol,
    side: input.side.toUpperCase(),
    type: "MARKET",
    quoteOrderQty,
    newClientOrderId: input.clientOrderId,
    newOrderRespType: "FULL",
  };
  await signedRequest(credentials, "/api/v3/order/test", parameters, "POST");
  const order = await signedRequest<{
    orderId?: string | number;
    clientOrderId?: string;
    symbol?: string;
    side?: string;
    status?: string;
    executedQty?: string;
    cummulativeQuoteQty?: string;
    transactTime?: number;
  }>(credentials, "/api/v3/order", parameters, "POST");
  return {
    providerOrderId: String(order.orderId ?? ""),
    clientOrderId: String(order.clientOrderId || input.clientOrderId),
    symbol: String(order.symbol || symbol),
    side: String(order.side || input.side).toLowerCase() === "sell" ? "sell" : "buy",
    status: String(order.status || "SUBMITTED").toUpperCase(),
    executedQuantity: String(order.executedQty || "0"),
    executedQuoteAmount: String(order.cummulativeQuoteQty || quoteOrderQty),
    transactedAt: Number(order.transactTime || Date.now()),
  };
}
