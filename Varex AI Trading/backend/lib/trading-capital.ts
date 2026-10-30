import { TradingBrokerError } from "@/lib/trading-broker";

// Official API: https://open-api.capital.com/ (verified 2026-10-30).
// Capital keys allow trading. Only this adapter is read-only: its sole POST
// creates a session; it cannot open/close positions, move funds, or switch accounts.
const CAPITAL_ORIGINS = {
  demo: "https://demo-api-capital.backend-capital.com",
  live: "https://api-capital.backend-capital.com",
} as const;
type Json = Record<string, unknown>;
export type CapitalEnvironment = keyof typeof CAPITAL_ORIGINS;
export type CapitalCredentials = {
  apiKey: string;
  identifier: string;
  apiPassword: string;
  environment: CapitalEnvironment;
  accountId?: string;
};
export type CapitalPosition = {
  dealId: string;
  epic: string;
  instrumentName: string;
  direction: "BUY" | "SELL";
  size: number;
  level: number;
  currency: string;
  profitLoss: number | null;
  createdAt: string | null;
};
export type CapitalAccountSummary = {
  provider: "capital";
  readOnly: true;
  executionSupported: false;
  canTrade: false;
  environment: CapitalEnvironment;
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  asOf: string;
  accountBalance: { balance: number; deposit: number; profitLoss: number; available: number };
  positions: CapitalPosition[];
};

function record(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function invalidResponse(): never {
  throw new TradingBrokerError(502, "أعادت Capital.com بيانات حساب غير مكتملة. لم يتم تحديث الحساب.");
}
function text(value: unknown, max = 128): string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : invalidResponse();
}
function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : invalidResponse();
}

export function capitalCredentials(input: Json): CapitalCredentials {
  const environment = input.environment === undefined ? "demo" : input.environment;
  if (environment !== "demo" && environment !== "live") throw new TradingBrokerError(400, "بيئة حساب Capital.com غير صالحة.");
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const identifier = typeof input.identifier === "string" ? input.identifier.trim() : "";
  // The custom API password is not the account password. Do not trim it.
  const apiPassword = typeof input.apiPassword === "string" ? input.apiPassword : "";
  if (apiKey.length < 16 || apiKey.length > 256 || /\s|[\u0000-\u001f\u007f]/.test(apiKey)
      || identifier.length < 3 || identifier.length > 254 || /[\u0000-\u001f\u007f]/.test(identifier)
      || apiPassword.length < 1 || apiPassword.length > 256 || /[\u0000-\u001f\u007f]/.test(apiPassword)) {
    throw new TradingBrokerError(400, "أدخل معرّف Capital.com ومفتاح API وكلمة المرور المخصصة للمفتاح.");
  }
  return { apiKey, identifier, apiPassword, environment };
}

export function capitalSecret(credentials: CapitalCredentials, accountId: string): string {
  return JSON.stringify({ v: 1, provider: "capital", identifier: credentials.identifier,
    apiPassword: credentials.apiPassword, environment: credentials.environment, accountId: text(accountId) });
}

export function capitalCredentialsFromSecret(apiKey: string, secret: string): CapitalCredentials {
  try {
    const saved: unknown = JSON.parse(secret);
    if (!record(saved) || saved.v !== 1 || saved.provider !== "capital" || !Object.hasOwn(CAPITAL_ORIGINS, String(saved.environment))) throw new Error();
    return { ...capitalCredentials({ ...saved, apiKey }), accountId: text(saved.accountId) };
  } catch {
    throw new TradingBrokerError(503, "بيانات ربط Capital.com غير صالحة. يلزم إعادة الربط بأمان.");
  }
}

async function capitalRequest(origin: string, path: "/session" | "/accounts" | "/positions", headers: Record<string, string>, sessionBody?: Json) {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/v1${path}`, {
      method: sessionBody ? "POST" : "GET",
      headers: { ...headers, "Content-Type": "application/json", Accept: "application/json" },
      ...(sessionBody ? { body: JSON.stringify(sessionBody) } : {}),
      signal: AbortSignal.timeout(10_000), redirect: "error", credentials: "omit", cache: "no-store",
    });
  } catch {
    throw new TradingBrokerError(502, "تعذر الاتصال بحساب Capital.com الآن. لم يتم إرسال أي أمر تداول.");
  }
  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw new TradingBrokerError(status, status === 429 ? "طلبات Capital.com كثيرة. انتظر قليلاً ثم حدّث الحساب."
      : status === 502 ? "خدمة Capital.com غير متاحة مؤقتاً."
      : "رفضت Capital.com الربط. تحقق من البيئة والمفتاح وكلمة المرور المخصصة للمفتاح.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!record(data)) invalidResponse();
  return { response, data };
}

export async function validateCapitalConnection(input: CapitalCredentials): Promise<CapitalAccountSummary> {
  // Validate before I/O even when called outside the route. Only fixed official
  // origins are possible; credentials never follow a redirect.
  const credentials = capitalCredentials(input);
  const pinnedAccountId = input.accountId === undefined ? undefined : text(input.accountId);
  const origin = CAPITAL_ORIGINS[credentials.environment];
  const session = await capitalRequest(origin, "/session", { "X-CAP-API-KEY": credentials.apiKey }, {
    identifier: credentials.identifier, password: credentials.apiPassword, encryptedPassword: false,
  });
  const accountId = text(session.data.currentAccountId);
  if (pinnedAccountId !== undefined && accountId !== pinnedAccountId) {
    throw new TradingBrokerError(409, "الحساب النشط في Capital.com يختلف عن الحساب المربوط. لم نبدّل الحساب تلقائياً؛ أعد الربط بعد التحقق.");
  }
  const headers = { CST: text(session.response.headers.get("CST"), 4096),
    "X-SECURITY-TOKEN": text(session.response.headers.get("X-SECURITY-TOKEN"), 4096) };
  const { data: accounts } = await capitalRequest(origin, "/accounts", headers);
  if (!Array.isArray(accounts.accounts)) invalidResponse();
  const matches = accounts.accounts.filter((item) => record(item) && item.accountId === accountId);
  if (matches.length !== 1) invalidResponse();
  const account = matches[0] as Json;
  if (account.status !== "ENABLED") throw new TradingBrokerError(409, "حساب Capital.com المربوط غير مفعّل لدى الوسيط.");
  if (!record(account.balance)) invalidResponse();
  const currency = text(account.currency, 12);
  const accountBalance = { balance: number(account.balance.balance), deposit: number(account.balance.deposit),
    profitLoss: number(account.balance.profitLoss), available: number(account.balance.available) };
  const { data: open } = await capitalRequest(origin, "/positions", headers);
  if (!Array.isArray(open.positions) || open.positions.length > 1000) invalidResponse();
  const positions: CapitalPosition[] = open.positions.map((item) => {
    if (!record(item) || !record(item.position) || !record(item.market)) invalidResponse();
    const p = item.position, market = item.market;
    if (p.direction !== "BUY" && p.direction !== "SELL") invalidResponse();
    const size = number(p.size);
    if (size <= 0) invalidResponse();
    const utc = typeof p.createdDateUTC === "string" ? p.createdDateUTC : "";
    const timestamp = utc ? Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(utc) ? utc : utc + "Z") : NaN;
    return { dealId: text(p.dealId), epic: text(market.epic), instrumentName: text(market.instrumentName),
      direction: p.direction, size, level: number(p.level), currency: text(p.currency, 12),
      profitLoss: p.upl === undefined || p.upl === null ? null : number(p.upl),
      createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null };
  });
  // Verify the same active account after the position read as well. No PUT
  // /session is implemented, so an account change is always an explicit reconnect.
  const { data: active } = await capitalRequest(origin, "/session", headers);
  if (active.accountId !== accountId) throw new TradingBrokerError(409, "تغير الحساب النشط في Capital.com أثناء التحديث. لم يتم حفظ بيانات حساب آخر.");
  return { provider: "capital", readOnly: true, executionSupported: false, canTrade: false,
    environment: credentials.environment, accountId, accountName: text(account.accountName),
    accountType: text(account.accountType, 32), currency, asOf: new Date().toISOString(), accountBalance, positions };
}
