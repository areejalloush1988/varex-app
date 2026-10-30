import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeSnapshot,
  getMarketBoard,
  getMarketSnapshot,
  normalizeTradingSymbol,
  TRADING_MARKETS,
  TradingMarketError,
  type MarketSnapshot,
} from "./trading-market.ts";
import {
  decryptTradingSecret,
  encryptTradingSecret,
  placeBinanceMarketOrder,
  TradingBrokerError,
  validateBinanceConnection,
  type BinanceAccountSummary,
  type BinanceCredentials,
} from "./trading-broker.ts";
import {
  capitalCredentials, capitalCredentialsFromSecret, capitalSecret, validateCapitalConnection,
  type CapitalAccountSummary,
} from "./trading-capital.ts";

export const TRADING_DEVELOPER_EMAIL = "areejalloush1988@gmail.com";
const TABLE_PREFIX = "varex_trading_";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_SYMBOLS = new Set(Object.keys(TRADING_MARKETS));
const ALLOWED_ORIGINS = new Set([
  "https://app.varexapp.com",
  "https://areejalloush1988.github.io",
]);
const BROKER_UNAVAILABLE = "ربط حساب الوسيط غير متاح حالياً: يلزم تجهيز مفتاح حماية بيانات التداول في الخادم.";

type TradingRole = "developer" | "trader" | "viewer";
type RecordValue = Record<string, unknown>;
type Profile = {
  user_id: string;
  email: string;
  display_name: string;
  role: TradingRole;
  status: "active" | "inactive";
  paper_balance_cents: number;
  created_at: number;
  updated_at: number;
};
type RiskRules = {
  maxDailyLossPct: number;
  maxOpenTrades: number;
  riskPerTradePct: number;
  autoStop: boolean;
  newsPause: boolean;
};
type PaperTrade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopPrice: number;
  pnl: number;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
};
type TradingState = {
  balanceCents: number;
  watchlist: string[];
  selectedSymbol: string;
  risk: RiskRules;
  trades: PaperTrade[];
  analyses: RecordValue[];
  settings: { notifications: boolean; timezone: string; compactMode: boolean };
};
type StateRow = { user_id: string; state_json: TradingState; version: number };
type BrokerConnection = {
  user_id: string;
  revision: string;
  provider: "binance" | "capital";
  account_label: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_secret_ciphertext: string;
  api_secret_iv: string;
  key_fingerprint: string;
  status: "connected" | "error";
  live_trading_enabled: boolean;
  max_live_order_cents: number;
  permission_snapshot: BinanceAccountSummary | CapitalAccountSummary | null;
  last_error: string | null;
  last_checked_at: number | null;
  created_at: number;
  updated_at: number;
};
type LiveOrder = {
  id: string;
  user_id: string;
  client_request_id: string;
  client_order_id: string;
  provider_order_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  quote_amount_cents: number;
  executed_quote_amount: string | null;
  executed_quantity: string | null;
  status: "pending" | "submitted" | "filled" | "rejected" | "unknown";
  requested_at: number;
  updated_at: number;
};

export class TradingAccessError extends Error {
  constructor(public status: number, message: string, public extra: RecordValue = {}) {
    super(message);
  }
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function cleanName(value: unknown, fallback = "حساب VAREX") {
  const name = String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return name.length >= 2 ? name : fallback;
}
function normalizeEmail(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function defaultState(balanceCents = 2_500_000): TradingState {
  return {
    balanceCents,
    watchlist: ["BTC-USD", "ETH-USD", "SOL-USD"],
    selectedSymbol: "BTC-USD",
    risk: { maxDailyLossPct: 5, maxOpenTrades: 3, riskPerTradePct: 1, autoStop: true, newsPause: true },
    trades: [],
    analyses: [],
    settings: { notifications: true, timezone: "Asia/Dubai", compactMode: false },
  };
}
function normalizeState(value: unknown, balanceCents = 2_500_000, now = Date.now()): TradingState {
  const input = isRecord(value) ? value : {};
  const base = defaultState(balanceCents);
  const risk = isRecord(input.risk) ? input.risk : base.risk;
  const settings = isRecord(input.settings) ? input.settings : base.settings;
  const watchlist = Array.isArray(input.watchlist)
    ? [...new Set(input.watchlist.map(String).filter((symbol) => SUPPORTED_SYMBOLS.has(symbol)))].slice(0, 4)
    : base.watchlist;
  let closedHistoryCount = 0;
  const today = new Date(now);
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const trades = Array.isArray(input.trades)
    ? (input.trades as PaperTrade[]).filter((trade) => trade.status === "open"
      || (trade.status === "closed" && trade.closedAt && Date.parse(trade.closedAt) >= dayStart)
      || closedHistoryCount++ < 500)
    : [];
  return {
    balanceCents: Math.round(clamp(input.balanceCents, 0, 100_000_000_000, balanceCents)),
    watchlist: watchlist.length ? watchlist : ["BTC-USD"],
    selectedSymbol: normalizeTradingSymbol(input.selectedSymbol),
    risk: {
      maxDailyLossPct: clamp(risk.maxDailyLossPct, 0.5, 20, 5),
      maxOpenTrades: Math.round(clamp(risk.maxOpenTrades, 1, 10, 3)),
      riskPerTradePct: clamp(risk.riskPerTradePct, 0.25, 5, 1),
      autoStop: risk.autoStop !== false,
      newsPause: risk.newsPause !== false,
    },
    trades,
    analyses: Array.isArray(input.analyses) ? input.analyses.slice(0, 100) as RecordValue[] : [],
    settings: {
      notifications: settings.notifications !== false,
      timezone: ["Asia/Dubai", "UTC", "Asia/Riyadh"].includes(String(settings.timezone)) ? String(settings.timezone) : "Asia/Dubai",
      compactMode: settings.compactMode === true,
    },
  };
}

// All tables and RPCs are private to service_role. The verified user ID is supplied
// by this handler, never accepted from a request body or editable JWT metadata.
class TradingStore {
  constructor(private client: SupabaseClient) {}

  private checked<T>({ data, error }: { data: unknown; error: unknown }): T {
    if (error) throw new TradingAccessError(503, "تعذر حفظ أو قراءة بيانات الحساب حالياً. يرجى إعادة المحاولة.");
    return data as T;
  }
  async one<T>(table: string, filters: RecordValue, columns = "*"): Promise<T | null> {
    let query = this.client.from(TABLE_PREFIX + table).select(columns);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    return this.checked<T | null>(await query.maybeSingle());
  }
  async list<T>(table: string, filters: RecordValue, order: string, ascending = false, columns = "*", limit = 100): Promise<T[]> {
    let query = this.client.from(TABLE_PREFIX + table).select(columns);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    return this.checked<T[]>(await query.order(order, { ascending }).limit(limit)) || [];
  }
  async upsert(table: string, row: RecordValue, ignoreDuplicates = false) {
    this.checked(await this.client.from(TABLE_PREFIX + table).upsert(row, { onConflict: "user_id", ignoreDuplicates }));
  }
  async update<T>(table: string, row: RecordValue, filters: RecordValue): Promise<T | null> {
    let query = this.client.from(TABLE_PREFIX + table).update(row);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    return this.checked<T | null>(await query.select().maybeSingle());
  }
  async remove(table: string, filters: RecordValue) {
    let query = this.client.from(TABLE_PREFIX + table).delete();
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    this.checked(await query);
  }
  async rpc<T>(name: string, args: RecordValue): Promise<T> {
    return this.checked<T>(await this.client.rpc(TABLE_PREFIX + name, args));
  }
}

type Dependencies = {
  createClient: typeof createClient;
  env: (name: string) => string | undefined;
  now: () => number;
  uuid: () => string;
  getMarketSnapshot: typeof getMarketSnapshot;
  getMarketBoard: typeof getMarketBoard;
  analyzeSnapshot: typeof analyzeSnapshot;
  validateBinanceConnection: typeof validateBinanceConnection;
  validateCapitalConnection: typeof validateCapitalConnection;
  placeBinanceMarketOrder: typeof placeBinanceMarketOrder;
  encryptTradingSecret: typeof encryptTradingSecret;
  decryptTradingSecret: typeof decryptTradingSecret;
};

const defaults: Dependencies = {
  createClient,
  env: (name) => Deno.env.get(name),
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
  getMarketSnapshot,
  getMarketBoard,
  analyzeSnapshot,
  validateBinanceConnection,
  validateCapitalConnection,
  placeBinanceMarketOrder,
  encryptTradingSecret,
  decryptTradingSecret,
};

function credentialBytes(value: string): Uint8Array | null {
  try {
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    if (bytes.length === 32 || bytes.length === 48) return bytes;
  } catch { /* An invalid key disables the broker, including existing connections. */ }
  return null;
}

// Existing 32-byte keys retain byte-for-byte compatibility with the original
// AES-GCM utility. New 48-byte random secrets use a stable, domain-separated
// SHA-256 derivation. No key, derived key, or ciphertext is returned to clients.
export async function deriveTradingCredentialKey(value: string): Promise<string> {
  const bytes = credentialBytes(value);
  if (!bytes) throw new TradingAccessError(503, BROKER_UNAVAILABLE, { brokerUnavailable: true });
  if (bytes.length === 32) return value;
  const label = new TextEncoder().encode("VAREX AI Trading credential key v1\0");
  const input = new Uint8Array(label.length + bytes.length);
  input.set(label);
  input.set(bytes, label.length);
  const derived = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return btoa(String.fromCharCode(...derived));
}

async function credentialKey(dependencies: Dependencies): Promise<string> {
  return await deriveTradingCredentialKey(dependencies.env("TRADING_CREDENTIAL_KEY") || "");
}

function serverApiKey(dependencies: Dependencies): string | null {
  const dictionary = dependencies.env("SUPABASE_SECRET_KEYS");
  if (dictionary) {
    try {
      const keys: unknown = JSON.parse(dictionary);
      if (isRecord(keys)) {
        if (typeof keys.default === "string" && keys.default.startsWith("sb_secret_")) return keys.default;
        const namedKey = Object.values(keys).find((value) => typeof value === "string" && value.startsWith("sb_secret_"));
        if (typeof namedKey === "string") return namedKey;
      }
    } catch { /* Existing projects may still provide only the legacy server key. */ }
  }
  return dependencies.env("SUPABASE_SERVICE_ROLE_KEY") || null;
}

function profileJson(profile: Profile, brokerAvailable: boolean) {
  return {
    id: profile.user_id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    status: profile.status,
    canManageUsers: profile.role === "developer",
    canTrade: profile.role !== "viewer",
    canConnectBroker: profile.role !== "viewer" && brokerAvailable,
  };
}
function orderJson(order: LiveOrder) {
  return {
    id: order.id,
    clientOrderId: order.client_order_id,
    providerOrderId: order.provider_order_id,
    symbol: order.symbol,
    side: order.side,
    quoteAmountCents: Number(order.quote_amount_cents),
    quoteAmount: Number(order.quote_amount_cents) / 100,
    executedQuoteAmount: order.executed_quote_amount,
    executedQuantity: order.executed_quantity,
    status: order.status,
    requestedAt: new Date(Number(order.requested_at)).toISOString(),
    updatedAt: new Date(Number(order.updated_at)).toISOString(),
  };
}
function brokerPayload(connection: BrokerConnection | null, orders: LiveOrder[], available: boolean, viewer = false) {
  const summary = connection?.permission_snapshot?.provider === connection?.provider ? connection?.permission_snapshot : null;
  const binance = summary?.provider === "binance" ? summary : null;
  const capital = summary?.provider === "capital" ? summary : null;
  const provider = connection?.provider || "binance";
  const liveTradingEnabled = provider === "binance" && available && !viewer && connection?.status === "connected" && connection.live_trading_enabled === true;
  return {
    available: available && !viewer,
    connected: Boolean(connection),
    mode: liveTradingEnabled ? "live-ready" : "paper",
    provider,
    providerLabel: provider === "capital" ? "Capital.com" : "Binance Spot",
    connectionRevision: connection?.revision || null,
    readOnly: provider === "capital",
    executionSupported: provider === "binance",
    canTrade: provider === "binance" && binance?.canTrade === true,
    environment: capital?.environment || null,
    accountId: capital?.accountId || null,
    accountName: capital?.accountName || "",
    currency: capital?.currency || null,
    accountBalance: capital?.accountBalance || null,
    snapshotAt: capital?.asOf || null,
    positions: viewer ? [] : capital?.positions || [],
    accountLabel: connection?.account_label || "",
    keyFingerprint: connection?.key_fingerprint || "",
    status: connection?.status,
    liveTradingEnabled,
    maxLiveOrderUsd: (connection?.max_live_order_cents || 10_000) / 100,
    lastCheckedAt: connection?.last_checked_at || null,
    lastError: !available ? BROKER_UNAVAILABLE : connection?.last_error || null,
    error: !available ? BROKER_UNAVAILABLE : undefined,
    permissions: binance?.permissions || null,
    balances: viewer ? [] : binance?.balances || [],
    availableUsdt: viewer ? 0 : binance?.availableUsdt || 0,
    accountType: summary?.accountType || "SPOT",
    label: viewer ? "التداول الورقي فقط لهذا الحساب" : !available ? BROKER_UNAVAILABLE
      : provider === "capital" ? "Capital.com مربوط · متابعة الرصيد والمراكز فقط"
      : liveTradingEnabled ? "Binance مربوط · التداول الحقيقي بتأكيد يدوي"
      : connection ? "Binance مربوط · التداول الحقيقي متوقف" : "حساب التداول غير مربوط",
    orders: viewer ? [] : orders.map((order) => ({ ...orderJson(order), provider: "binance" })),
  };
}

export function createTradingHandler(overrides: Partial<Dependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };

  return async function handleTradingRequest(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    const localOrigin = dependencies.env("TRADING_LOCAL_ORIGIN");
    const allowLocal = localOrigin && /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(localOrigin) && origin === localOrigin;
    const allowedOrigin = !origin || ALLOWED_ORIGINS.has(origin) || allowLocal;
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", "vary": "Origin" });
    if (origin && allowedOrigin) headers.set("access-control-allow-origin", origin);
    function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }

    try {
      if (!allowedOrigin) throw new TradingAccessError(403, "هذا المصدر غير مسموح له بالاتصال بالتطبيق.");
      if (request.method === "OPTIONS") {
        headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
        headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
        headers.set("access-control-max-age", "600");
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== "GET" && request.method !== "POST") {
        headers.set("allow", "GET, POST, OPTIONS");
        throw new TradingAccessError(405, "طريقة الطلب غير مدعومة.");
      }
      const authorization = request.headers.get("authorization") || "";
      const token = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
      if (!token || token.length > 16_384) throw new TradingAccessError(401, "يلزم تسجيل الدخول للمتابعة.");
      const supabaseUrl = dependencies.env("SUPABASE_URL");
      const serviceKey = serverApiKey(dependencies);
      if (!supabaseUrl || !serviceKey) throw new TradingAccessError(503, "خدمة الحسابات غير مجهزة حالياً.");
      const client = dependencies.createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: authData, error: authError } = await client.auth.getUser(token);
      const candidate = authData?.user;
      if (authError || !candidate?.id || !candidate.email) throw new TradingAccessError(401, "انتهت جلسة الحساب. يلزم تسجيل الدخول من جديد.");
      if (!candidate.email_confirmed_at || candidate.is_anonymous) throw new TradingAccessError(403, "يلزم تأكيد البريد الإلكتروني أولاً.");
      const user = candidate;
      const email = normalizeEmail(user.email);
      if (!EMAIL_PATTERN.test(email)) throw new TradingAccessError(401, "بيانات الحساب غير صالحة.");
      // Validate requested instruments before provisioning can create or update
      // account data. Browsable instruments are not automatically executable.
      let body: RecordValue = {};
      if (request.method === "POST") {
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
          throw new TradingAccessError(415, "يلزم إرسال الطلب بصيغة JSON.");
        }
        const rawBody = await request.text();
        if (rawBody.length > 65_536) throw new TradingAccessError(413, "حجم الطلب أكبر من الحد المسموح.");
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (!isRecord(parsed)) throw new Error("invalid body");
          body = parsed;
        } catch { throw new TradingAccessError(400, "بيانات الطلب غير صالحة."); }
      }
      const action = String(body.action || "");
      if (request.method === "GET") {
        const url = new URL(request.url);
        if (url.searchParams.get("action") === "markets") normalizeTradingSymbol(url.searchParams.get("symbol"));
      } else if (action === "open_trade" || action === "place_live_order") {
        body.symbol = normalizeTradingSymbol(body.symbol, false);
      } else if (action === "analyze") {
        body.symbol = normalizeTradingSymbol(body.symbol);
      } else if (action === "save_preferences" && Object.prototype.hasOwnProperty.call(body, "selectedSymbol")) {
        body.selectedSymbol = normalizeTradingSymbol(body.selectedSymbol, false);
      }
      const store = new TradingStore(client);
      const provision = await store.rpc<{ profile?: Profile; reason?: string }>("provision", {
        p_user_id: user.id,
        p_email: email,
        p_display_name: cleanName(user.user_metadata?.name ?? user.user_metadata?.display_name ?? email.split("@")[0]),
        p_now: dependencies.now(),
      });
      if (!provision.profile || provision.reason) throw new TradingAccessError(403, "هذا الحساب موقوف أو غير متاح للتداول.");
      const profile = provision.profile;
      if (profile.user_id !== user.id || profile.email !== email || profile.status !== "active") {
        throw new TradingAccessError(403, "تم إيقاف هذا الحساب. يرجى التواصل مع إدارة النظام.");
      }
      if (!["developer", "trader", "viewer"].includes(profile.role)
        || (profile.role === "developer" && email !== TRADING_DEVELOPER_EMAIL)) {
        throw new TradingAccessError(403, "صلاحية الحساب غير صالحة.");
      }
      const brokerAvailable = Boolean(credentialBytes(dependencies.env("TRADING_CREDENTIAL_KEY") || ""));

      function requireRoles(roles: TradingRole[]) {
        if (!roles.includes(profile.role)) throw new TradingAccessError(403, "الصلاحية غير متاحة لهذا الحساب.");
      }
      async function stateFor(): Promise<{ state: TradingState; version: number }> {
        let row = await store.one<StateRow>("state", { user_id: user.id });
        if (!row) {
          const now = dependencies.now();
          await store.upsert("state", {
            user_id: user.id,
            state_json: defaultState(Number(profile.paper_balance_cents)),
            version: 1,
            created_at: now,
            updated_at: now,
          }, true);
          row = await store.one<StateRow>("state", { user_id: user.id });
        }
        if (!row || !Number.isInteger(row.version) || row.version < 1) throw new TradingAccessError(503, "تعذر تحميل بيانات الحساب كاملة.");
        return { state: normalizeState(row.state_json, Number(profile.paper_balance_cents), dependencies.now()), version: row.version };
      }
      async function mutateState(change: (state: TradingState) => TradingState, requiresTrade = false) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = await stateFor();
          const next = normalizeState(change(structuredClone(current.state)), current.state.balanceCents, dependencies.now());
          const result = await store.rpc<{ saved: boolean; version?: number; reason?: string }>("cas_state", {
            p_user_id: user.id,
            p_expected_version: current.version,
            p_state_json: next,
            p_require_trade: requiresTrade,
            p_now: dependencies.now(),
          });
          if (result.reason === "forbidden") throw new TradingAccessError(403, "الصلاحية غير متاحة لهذا الحساب.");
          if (result.saved) return { state: next, version: result.version || current.version + 1 };
        }
        throw new TradingAccessError(409, "تغيرت البيانات أثناء الحفظ. يرجى المحاولة من جديد.");
      }
      async function connectionFor() { return await store.one<BrokerConnection>("broker_connection", { user_id: user.id }); }
      async function ordersFor() { return await store.list<LiveOrder>("live_order", { user_id: user.id }, "requested_at"); }
      async function brokerState() {
        if (profile.role === "viewer") return brokerPayload(null, [], brokerAvailable, true);
        const [connection, orders] = await Promise.all([connectionFor(), ordersFor()]);
        return brokerPayload(connection, orders, brokerAvailable);
      }
      async function credentialsFor(connection: BrokerConnection): Promise<BinanceCredentials> {
        if (connection.provider !== "binance") throw new TradingAccessError(409, "هذا الربط للمتابعة فقط ولا يدعم أوامر Binance.");
        const key = await credentialKey(dependencies);
        const [apiKey, apiSecret] = await Promise.all([
          dependencies.decryptTradingSecret({ ciphertext: connection.api_key_ciphertext, iv: connection.api_key_iv }, key),
          dependencies.decryptTradingSecret({ ciphertext: connection.api_secret_ciphertext, iv: connection.api_secret_iv }, key),
        ]);
        return { apiKey, apiSecret };
      }
      async function capitalCredentialsFor(connection: BrokerConnection) {
        if (connection.provider !== "capital") throw new TradingAccessError(409, "نوع ربط الحساب لا يطابق Capital.com.");
        const key = await credentialKey(dependencies);
        const [apiKey, secret] = await Promise.all([
          dependencies.decryptTradingSecret({ ciphertext: connection.api_key_ciphertext, iv: connection.api_key_iv }, key),
          dependencies.decryptTradingSecret({ ciphertext: connection.api_secret_ciphertext, iv: connection.api_secret_iv }, key),
        ]);
        return capitalCredentialsFromSecret(apiKey, secret);
      }
      async function updateConnection(connection: BrokerConnection, values: RecordValue) {
        const updated = await store.update<BrokerConnection>("broker_connection", values, { user_id: user.id, revision: connection.revision });
        if (!updated) throw new TradingAccessError(409, "تغير ربط الحساب أثناء الطلب. يرجى تحديث الصفحة.");
        return updated;
      }
      async function refreshConnection(requiredProvider?: "binance") {
        await credentialKey(dependencies);
        const connection = await connectionFor();
        if (!connection) throw new TradingAccessError(404, "حساب التداول غير مربوط.");
        if (requiredProvider && connection.provider !== requiredProvider) throw new TradingAccessError(409, "ربط Capital.com مخصص لمتابعة الحساب فقط؛ تنفيذ الأوامر غير مفعّل.");
        try {
          const summary = connection.provider === "capital"
            ? await dependencies.validateCapitalConnection(await capitalCredentialsFor(connection))
            : await dependencies.validateBinanceConnection(await credentialsFor(connection));
          const now = dependencies.now();
          const updated = await updateConnection(connection, {
            status: "connected", permission_snapshot: summary, last_error: null, last_checked_at: now, updated_at: now,
          });
          return { connection: updated, summary };
        } catch (error) {
          if (!(error instanceof TradingAccessError && error.status === 409)) {
            await updateConnection(connection, {
              status: "error", live_trading_enabled: false,
              last_error: error instanceof TradingBrokerError ? error.message.slice(0, 240) : "تعذر التحقق من حساب التداول.",
              last_checked_at: dependencies.now(), updated_at: dependencies.now(),
            }).catch(() => undefined);
          }
          throw error;
        }
      }
      async function marketSnapshot(symbol: unknown, candles = false) {
        const snapshot = await dependencies.getMarketSnapshot(symbol, candles);
        if (!Number.isFinite(snapshot.price) || snapshot.price <= 0) throw new TradingMarketError();
        return snapshot;
      }
      async function settlePaperStops(markets: MarketSnapshot[] = []) {
        const current = await stateFor();
        const candidates = current.state.trades.filter((trade) => trade.status === "open" && Number.isFinite(trade.stopPrice) && trade.stopPrice > 0);
        const candidateIds = new Set(candidates.map((trade) => trade.id));
        const watched = [...new Set(candidates.map((trade) => trade.symbol))];
        if (!watched.length) return current;
        const quotes = new Map(markets.filter((market) => Number.isFinite(market.price) && market.price > 0).map((market) => [market.symbol as string, market]));
        const missing = watched.filter((symbol) => !quotes.has(symbol));
        const fetched = await Promise.allSettled(missing.map((symbol) => marketSnapshot(symbol)));
        for (const result of fetched) if (result.status === "fulfilled") quotes.set(result.value.symbol, result.value);
        const crossesStop = (trade: PaperTrade) => {
          const quote = quotes.get(trade.symbol);
          return candidateIds.has(trade.id) && trade.status === "open" && trade.stopPrice > 0 && quote
            && (trade.side === "buy" ? quote.price <= trade.stopPrice : quote.price >= trade.stopPrice);
        };
        const unavailableSymbols = watched.filter((symbol) => !quotes.has(symbol));
        if (!current.state.trades.some(crossesStop)) {
          return { ...current, paperStopCheck: { mode: "on-refresh", checkedAt: new Date(dependencies.now()).toISOString(), closedCount: 0, unavailableSymbols } };
        }
        let closedCount = 0;
        const result = await mutateState((state) => {
          closedCount = 0;
          for (const trade of state.trades) {
            if (!crossesStop(trade) || !Number.isFinite(trade.entryPrice) || trade.entryPrice <= 0) continue;
            const quote = quotes.get(trade.symbol) as MarketSnapshot;
            const direction = trade.side === "buy" ? 1 : -1;
            trade.exitPrice = quote.price;
            trade.pnl = Math.round(direction * ((quote.price - trade.entryPrice) / trade.entryPrice) * trade.amount * 100) / 100;
            trade.status = "closed";
            trade.closedAt = new Date(dependencies.now()).toISOString();
            state.balanceCents = Math.max(0, state.balanceCents + Math.round(trade.pnl * 100));
            closedCount += 1;
          }
          return state;
        });
        return { ...result, paperStopCheck: { mode: "on-refresh", checkedAt: new Date(dependencies.now()).toISOString(), closedCount, unavailableSymbols } };
      }
      async function listUsers() {
        requireRoles(["developer"]);
        const [profiles, pendingInvites, revokedInvites] = await Promise.all([
          store.list<Profile>("profile", {}, "created_at", true, "user_id,email,display_name,role,status,created_at,updated_at", 1000),
          store.list<RecordValue>("invite", { status: "pending" }, "created_at", false, "id,email,display_name,role,status,accepted_by_user_id,created_at,updated_at", 1000),
          store.list<RecordValue>("invite", { status: "revoked" }, "created_at", false, "id,email,display_name,role,status,accepted_by_user_id,created_at,updated_at", 1000),
        ]);
        const invites = [...pendingInvites, ...revokedInvites.filter((invite) => !invite.accepted_by_user_id)];
        return [
          ...profiles.map((item) => ({ id: item.user_id, email: item.email, displayName: item.display_name, role: item.role, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at })),
          ...invites.map((item) => ({ id: item.id, email: item.email, displayName: item.display_name, role: item.role, status: item.status === "revoked" ? "inactive" : item.status, createdAt: item.created_at, updatedAt: item.updated_at, pending: item.status === "pending" })),
        ];
      }

      if (request.method === "GET") {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "bootstrap";
        if (action === "access") return json({ profile: profileJson(profile, brokerAvailable) });
        if (action === "markets") {
          const board = await dependencies.getMarketBoard(url.searchParams.get("symbol"));
          return json({ ...board, ...await settlePaperStops(board.markets) });
        }
        if (action === "users") return json({ users: await listUsers() });
        if (action !== "bootstrap") throw new TradingAccessError(400, "الإجراء المطلوب غير معروف.");
        return json({
          profile: profileJson(profile, brokerAvailable),
          ...await settlePaperStops(),
          broker: await brokerState(),
          supportedMarkets: Object.values(TRADING_MARKETS),
        });
      }

      if (action === "save_preferences") {
        const changesRisk = isRecord(body.risk) && profile.role !== "viewer";
        const result = await mutateState((state) => {
          if (Array.isArray(body.watchlist)) state.watchlist = body.watchlist.map(String).filter((symbol) => SUPPORTED_SYMBOLS.has(symbol));
          if (body.selectedSymbol) state.selectedSymbol = normalizeTradingSymbol(body.selectedSymbol);
          if (changesRisk) state.risk = { ...state.risk, ...(body.risk as RecordValue) };
          if (isRecord(body.settings)) state.settings = { ...state.settings, ...body.settings };
          return state;
        }, changesRisk);
        return json({ saved: true, ...result });
      }
      if (action === "update_profile") {
        const displayName = cleanName(body.displayName, profile.display_name);
        const updated = await store.update<Profile>("profile", { display_name: displayName, updated_at: dependencies.now() }, { user_id: user.id, status: "active" });
        if (!updated) throw new TradingAccessError(403, "الصلاحية غير متاحة لهذا الحساب.");
        return json({ saved: true, displayName });
      }
      if (action === "analyze") {
        const snapshot = await marketSnapshot(body.symbol, true);
        const analysis = dependencies.analyzeSnapshot(snapshot);
        const result = await mutateState((state) => { state.selectedSymbol = snapshot.symbol; state.analyses.unshift(analysis); return state; });
        return json({ analysis, market: snapshot, ...result });
      }
      if (action === "open_trade") {
        requireRoles(["developer", "trader"]);
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 25) throw new TradingAccessError(400, "الحد الأدنى للصفقة التجريبية 25 دولاراً.");
        if (body.side !== "buy" && body.side !== "sell") throw new TradingAccessError(400, "اتجاه الصفقة غير صالح.");
        const side = body.side;
        const snapshot = await marketSnapshot(body.symbol);
        const result = await mutateState((state) => {
          if (state.trades.filter((trade) => trade.status === "open").length >= state.risk.maxOpenTrades) throw new TradingAccessError(409, "وصلت إلى الحد الأقصى للصفقات المفتوحة.");
          const balance = state.balanceCents / 100;
          if (amount > balance * 0.25) throw new TradingAccessError(400, "حجم الصفقة لا يمكن أن يتجاوز 25% من الرصيد التجريبي.");
          const now = new Date(dependencies.now());
          const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
          const dailyPnl = state.trades.filter((trade) => trade.status === "closed" && trade.closedAt && Date.parse(trade.closedAt) >= start).reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
          if (dailyPnl < 0 && Math.abs(dailyPnl) >= balance * state.risk.maxDailyLossPct / 100) throw new TradingAccessError(409, "تم بلوغ حد الخسارة اليومي؛ أوقف النظام فتح صفقات جديدة.");
          const stopDistance = Math.max(0.005, Math.min(0.05, (balance * state.risk.riskPerTradePct / 100) / amount));
          state.trades.unshift({
            id: dependencies.uuid(), symbol: snapshot.symbol, side, amount: Math.round(amount * 100) / 100,
            quantity: amount / snapshot.price, entryPrice: snapshot.price, exitPrice: null,
            stopPrice: state.risk.autoStop ? snapshot.price * (side === "buy" ? 1 - stopDistance : 1 + stopDistance) : 0,
            pnl: 0, status: "open", openedAt: new Date(dependencies.now()).toISOString(), closedAt: null,
          });
          state.selectedSymbol = snapshot.symbol;
          return state;
        }, true);
        return json({ opened: true, market: snapshot, ...result });
      }
      if (action === "close_trade") {
        requireRoles(["developer", "trader"]);
        const tradeId = String(body.tradeId || "");
        const current = await stateFor();
        const trade = current.state.trades.find((item) => item.id === tradeId && item.status === "open");
        if (!trade) throw new TradingAccessError(404, "الصفقة المفتوحة غير موجودة.");
        const snapshot = await marketSnapshot(trade.symbol);
        const result = await mutateState((state) => {
          const target = state.trades.find((item) => item.id === tradeId && item.status === "open");
          if (!target) throw new TradingAccessError(409, "تم إغلاق الصفقة مسبقاً.");
          const direction = target.side === "buy" ? 1 : -1;
          target.exitPrice = snapshot.price;
          target.pnl = Math.round(direction * ((snapshot.price - target.entryPrice) / target.entryPrice) * target.amount * 100) / 100;
          target.status = "closed";
          target.closedAt = new Date(dependencies.now()).toISOString();
          state.balanceCents = Math.max(0, state.balanceCents + Math.round(target.pnl * 100));
          return state;
        }, true);
        return json({ closed: true, market: snapshot, ...result });
      }
      if (action === "reset_paper") {
        requireRoles(["developer", "trader"]);
        const result = await mutateState((state) => ({ ...defaultState(), watchlist: state.watchlist, settings: state.settings }), true);
        return json({ reset: true, ...result });
      }
      if (action === "invite_user" || action === "update_user") {
        requireRoles(["developer"]);
        const targetEmail = normalizeEmail(body.email);
        if (!EMAIL_PATTERN.test(targetEmail) || targetEmail === TRADING_DEVELOPER_EMAIL) throw new TradingAccessError(400, "أدخل بريداً صحيحاً غير حساب الإدارة الأساسي.");
        const result = await store.rpc<{ saved: boolean; reason?: string }>("manage_user", {
          p_actor_user_id: user.id,
          p_email: targetEmail,
          p_display_name: cleanName(body.displayName, cleanName(targetEmail.split("@")[0])),
          p_role: body.role === "viewer" ? "viewer" : "trader",
          p_status: action === "invite_user" ? "active" : body.status === "inactive" ? "inactive" : "active",
          p_invite: action === "invite_user",
          p_now: dependencies.now(),
        });
        if (!result.saved) throw new TradingAccessError(result.reason === "missing" ? 404 : 403, "تعذر تعديل هذا الحساب.");
        return json({ saved: true, users: await listUsers() });
      }

      requireRoles(["developer", "trader"]);
      if (action === "connect_broker") {
        const key = await credentialKey(dependencies);
        if (body.fundsAtProvider !== true) throw new TradingAccessError(400, "يلزم تأكيد بقاء الإيداع والسحب داخل منصة التداول.");
        const provider = body.provider === undefined ? "binance" : body.provider;
        if (provider !== "binance" && provider !== "capital") throw new TradingAccessError(400, "المزود غير مدعوم حالياً.");
        const previous = await connectionFor();
        if (previous ? body.replacementConfirmation !== "REPLACE_BROKER" || body.expectedConnectionRevision !== previous.revision
          : body.expectedConnectionRevision != null && body.expectedConnectionRevision !== "") {
          throw new TradingAccessError(409, "يوجد ربط سابق أو تغير الحساب. حدّث الصفحة وأكد استبدال الربط الحالي.");
        }
        let apiKey: string, secret: string;
        let summary: BinanceAccountSummary | CapitalAccountSummary;
        if (provider === "capital") {
          const credentials = capitalCredentials(body);
          summary = await dependencies.validateCapitalConnection(credentials);
          apiKey = credentials.apiKey;
          secret = capitalSecret(credentials, summary.accountId);
        } else {
          apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
          secret = typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
          if ([apiKey, secret].some((value) => value.length < 16 || value.length > 256 || /\s/.test(value))) throw new TradingAccessError(400, "مفاتيح ربط Binance غير صالحة.");
          summary = await dependencies.validateBinanceConnection({ apiKey, apiSecret: secret });
        }
        const [encryptedKey, encryptedSecret] = await Promise.all([
          dependencies.encryptTradingSecret(apiKey, key), dependencies.encryptTradingSecret(secret, key),
        ]);
        const now = dependencies.now(), revision = dependencies.uuid();
        const row = {
          user_id: user.id, revision, provider, account_label: cleanName(body.accountLabel, provider === "capital" ? "حساب Capital.com" : "حساب Binance Spot"),
          api_key_ciphertext: encryptedKey.ciphertext, api_key_iv: encryptedKey.iv,
          api_secret_ciphertext: encryptedSecret.ciphertext, api_secret_iv: encryptedSecret.iv,
          key_fingerprint: apiKey.slice(-4), status: "connected", live_trading_enabled: false,
          max_live_order_cents: 10_000, permission_snapshot: summary, last_error: null,
          last_checked_at: now, created_at: previous?.created_at || now, updated_at: now,
        };
        if (previous) await updateConnection(previous, row);
        else {
          // Insert only: a concurrent first connection must never be overwritten.
          await store.upsert("broker_connection", row, true);
          if ((await connectionFor())?.revision !== revision) throw new TradingAccessError(409, "تغير ربط الحساب أثناء الطلب. حدّث الصفحة قبل إعادة المحاولة.");
        }
        return json({ connected: true, broker: await brokerState() });
      }
      if (action === "refresh_broker") {
        await refreshConnection();
        return json({ refreshed: true, broker: await brokerState() });
      }
      if (action === "configure_live_trading") {
        const existingConnection = await connectionFor();
        if (existingConnection && existingConnection.provider !== "binance") throw new TradingAccessError(409, "ربط Capital.com مخصص لمتابعة الحساب فقط؛ تنفيذ الأوامر غير مفعّل.");
        if (body.enabled !== true) {
          await store.update("broker_connection", { live_trading_enabled: false, updated_at: dependencies.now() }, { user_id: user.id, provider: "binance" });
          return json({ saved: true, broker: await brokerState() });
        }
        await credentialKey(dependencies);
        if (body.confirmation !== "ENABLE_LIVE_SPOT") throw new TradingAccessError(400, "يلزم تأكيد تفعيل التداول الحقيقي.");
        const maxLiveOrderUsd = Number(body.maxLiveOrderUsd);
        if (!Number.isFinite(maxLiveOrderUsd) || maxLiveOrderUsd < 25 || maxLiveOrderUsd > 10_000) throw new TradingAccessError(400, "حد الصفقة الحقيقية يجب أن يكون بين 25 و10,000 دولار.");
        const { connection } = await refreshConnection("binance");
        const enabled = await store.rpc<{ saved: boolean; reason?: string }>("enable_live", {
          p_user_id: user.id, p_connection_revision: connection.revision,
          p_max_live_order_cents: Math.round(maxLiveOrderUsd * 100), p_now: dependencies.now(),
        });
        if (!enabled.saved) throw new TradingAccessError(enabled.reason === "forbidden" ? 403 : 409, "تغيرت صلاحية الحساب أو ربط التداول. لم يُفعّل التداول الحقيقي.");
        return json({ saved: true, broker: await brokerState() });
      }
      if (action === "disconnect_broker") {
        if (body.confirmation !== "DISCONNECT_BROKER") throw new TradingAccessError(400, "يلزم تأكيد فصل حساب التداول.");
        await store.remove("broker_connection", { user_id: user.id });
        return json({ disconnected: true, broker: await brokerState() });
      }
      if (action === "place_live_order") {
        await credentialKey(dependencies);
        if (body.confirmation !== "LIVE_ORDER_CONFIRMED") throw new TradingAccessError(400, "يلزم تأكيد الصفقة الحقيقية قبل التنفيذ.");
        const amount = Number(body.amount), amountCents = Math.round(amount * 100);
        if (!Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents < 2500) throw new TradingAccessError(400, "الحد الأدنى للصفقة الحقيقية 25 دولاراً.");
        const symbol = String(body.symbol || "").toUpperCase();
        if (!SUPPORTED_SYMBOLS.has(symbol)) throw new TradingAccessError(400, "السوق المطلوب غير مدعوم في التداول الحقيقي حالياً.");
        if (body.side !== "buy" && body.side !== "sell") throw new TradingAccessError(400, "اتجاه الصفقة غير صالح.");
        const side = body.side;
        const suppliedRequestId = String(body.clientRequestId || "").trim();
        const requestId = suppliedRequestId.toLowerCase().replace(/-/g, "");
        if (suppliedRequestId.length > 64 || !/^[a-f0-9]{20,64}$/.test(requestId)) throw new TradingAccessError(400, "معرّف طلب الصفقة غير صالح.");
        const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${user.id}:${requestId}`)));
        const clientOrderId = "vx" + [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
        const connection = await connectionFor();
        if (connection && connection.provider !== "binance") throw new TradingAccessError(409, "ربط Capital.com مخصص لمتابعة الحساب فقط؛ تنفيذ الأوامر غير مفعّل.");
        const reservation = await store.rpc<{ created?: boolean; order?: LiveOrder; reason?: string }>("reserve_live_order", {
          p_user_id: user.id, p_id: dependencies.uuid(), p_client_request_id: requestId,
          p_client_order_id: clientOrderId, p_connection_revision: connection?.revision || null,
          p_symbol: symbol, p_side: side, p_quote_amount_cents: amountCents, p_now: dependencies.now(),
        });
        if (!reservation.order) {
          const reason = reservation.reason;
          throw new TradingAccessError(reason === "forbidden" ? 403 : 409,
            reason === "limit" ? "حجم الصفقة يتجاوز الحد المضبوط للحساب." : "التداول الحقيقي غير مفعّل لهذا الحساب أو تغيّر الربط.");
        }
        const order = reservation.order;
        if (reservation.reason === "mismatch") throw new TradingAccessError(409, "استُخدم معرّف الطلب لصفقة مختلفة. لن يُرسل أمر جديد.");
        if (!reservation.created) {
          const uncertain = order.status === "pending" || order.status === "unknown";
          const result = {
            submitted: order.status === "filled" || order.status === "submitted", duplicate: true,
            order: orderJson(order), broker: brokerPayload(connection, [order], brokerAvailable),
            ...(uncertain ? { executionUncertain: true, error: "نتيجة هذا الطلب لم تُحسم بعد. لن تتم إعادة إرساله تلقائياً." } : {}),
            ...(order.status === "rejected" ? { error: "رُفض هذا الطلب سابقاً. لم يُرسل أمر جديد." } : {}),
          };
          return json(result, uncertain || order.status === "rejected" ? 409 : 200);
        }
        if (!connection) throw new TradingAccessError(409, "تغير ربط الحساب أثناء الطلب.");
        let credentials: BinanceCredentials;
        let summary: BinanceAccountSummary;
        try {
          credentials = await credentialsFor(connection);
          summary = await dependencies.validateBinanceConnection(credentials);
          await updateConnection(connection, { status: "connected", permission_snapshot: summary, last_error: null, last_checked_at: dependencies.now(), updated_at: dependencies.now() });
          if (side === "buy" && amountCents / 100 > summary.availableUsdt) throw new TradingBrokerError(400, "رصيد USDT المتاح لا يكفي لتنفيذ أمر الشراء.");
          const currentConnection = await connectionFor();
          if (!currentConnection || currentConnection.provider !== "binance" || currentConnection.revision !== connection.revision || currentConnection.live_trading_enabled !== true) throw new TradingAccessError(409, "تغيّر تفعيل التداول الحقيقي قبل إرسال الأمر.");
        } catch (error) {
          await store.update("live_order", { status: "rejected", updated_at: dependencies.now() }, { id: order.id, user_id: user.id, status: "pending" }).catch(() => undefined);
          await updateConnection(connection, { status: "error", live_trading_enabled: false, last_error: "تعذر التحقق من صلاحيات أو رصيد حساب التداول.", updated_at: dependencies.now() }).catch(() => undefined);
          throw error;
        }
        let executed;
        try {
          executed = await dependencies.placeBinanceMarketOrder(credentials, { symbol, side, quoteAmount: amountCents / 100, clientOrderId });
          if (!executed.providerOrderId || executed.clientOrderId !== clientOrderId) throw new TradingBrokerError(502, "لم تؤكد Binance نتيجة الأمر. لن تتم إعادة إرساله تلقائياً.", true);
        } catch (error) {
          const uncertain = !(error instanceof TradingBrokerError) || error.uncertain;
          await store.update("live_order", { status: uncertain ? "unknown" : "rejected", updated_at: dependencies.now() }, { id: order.id, user_id: user.id, status: "pending" }).catch(() => undefined);
          if (uncertain) throw new TradingBrokerError(502, "لم تُحسم نتيجة الأمر. تحقّق من Binance قبل إنشاء أي طلب جديد؛ لن يعيد النظام إرسال هذا الطلب.", true);
          throw error;
        }
        let saved: LiveOrder | null;
        try {
          saved = await store.update<LiveOrder>("live_order", {
            provider_order_id: executed.providerOrderId,
            executed_quote_amount: executed.executedQuoteAmount,
            executed_quantity: executed.executedQuantity,
            status: executed.status === "FILLED" ? "filled" : "submitted",
            updated_at: dependencies.now(),
          }, { id: order.id, user_id: user.id, status: "pending" });
          if (!saved) throw new Error("Order result could not be persisted");
        } catch {
          await store.update("live_order", { status: "unknown", updated_at: dependencies.now() }, { id: order.id, user_id: user.id, status: "pending" }).catch(() => undefined);
          throw new TradingBrokerError(502, "استقبلت Binance الطلب وتعذر تأكيد حفظ نتيجته. تحقّق من حساب Binance؛ لن يُعاد إرسال الطلب.", true);
        }
        // A failed history refresh must not turn a confirmed order into a new attempt.
        const orders = await ordersFor().catch(() => [saved as LiveOrder]);
        return json({ submitted: true, order: orderJson(saved), broker: brokerPayload({ ...connection, permission_snapshot: summary }, orders, brokerAvailable) });
      }
      throw new TradingAccessError(400, "الإجراء المطلوب غير معروف.");
    } catch (error) {
      if (error instanceof TradingAccessError) return json({ error: error.message, ...error.extra }, error.status);
      if (error instanceof TradingBrokerError) return json({ error: error.message, executionUncertain: error.uncertain }, error.status);
      if (error instanceof TradingMarketError) {
        if (error.status === 400) return json({ error: error.message, code: error.code }, 400);
        return json({ error: error.message, marketUnavailable: true }, 502);
      }
      // Do not log tokens, request bodies, broker keys, or upstream response bodies.
      console.error("VAREX trading API request failed", error instanceof Error ? error.name : "UnknownError");
      return json({ error: "تعذر إكمال الطلب حالياً." }, 500);
    }
  };
}

if (typeof Deno !== "undefined") Deno.serve(createTradingHandler());
