import { getCashierAuth, type CashierAuthEnv } from "@/lib/auth";
import { analyzeSnapshot, getMarketBoard, getMarketSnapshot, normalizeTradingSymbol, TRADING_MARKETS, TradingMarketError } from "@/lib/trading-market";

type AccountUser = { id: string; name: string; email: string; emailVerified?: boolean };
type TradingRole = "developer" | "trader" | "viewer";
type ProfileRow = {
  userId: string;
  displayName: string;
  role: TradingRole;
  status: "active" | "inactive";
  paperBalanceCents: number;
};
type RiskRules = { maxDailyLossPct: number; maxOpenTrades: number; riskPerTradePct: number; autoStop: boolean; newsPause: boolean };
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
type TradingStateData = {
  balanceCents: number;
  watchlist: string[];
  selectedSymbol: string;
  risk: RiskRules;
  trades: PaperTrade[];
  analyses: Array<Record<string, unknown>>;
  settings: { notifications: boolean; timezone: string; compactMode: boolean };
};

export const TRADING_DEVELOPER_EMAIL = "areejalloush1988@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_SYMBOLS = new Set(Object.keys(TRADING_MARKETS));

export class TradingAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function runtime() {
  const cloudflare = await import("cloudflare:workers");
  return cloudflare.env as unknown as CashierAuthEnv;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function bodyOf(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return {}; }
}

export function normalizeTradingEmail(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
export function isTradingDeveloperEmail(value: unknown) { return normalizeTradingEmail(value) === TRADING_DEVELOPER_EMAIL; }
function cleanName(value: unknown, fallback = "مستخدم VAREX") {
  const name = String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return name.length >= 2 ? name : fallback;
}
function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function defaultState(balanceCents = 2_500_000): TradingStateData {
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

function normalizeState(value: unknown, balanceCents = 2_500_000): TradingStateData {
  const input = value && typeof value === "object" ? value as Partial<TradingStateData> : {};
  const base = defaultState(balanceCents), risk = input.risk && typeof input.risk === "object" ? input.risk : base.risk;
  const settings = input.settings && typeof input.settings === "object" ? input.settings : base.settings;
  const watchlist = Array.isArray(input.watchlist) ? [...new Set(input.watchlist.map(String).filter((symbol) => SUPPORTED_SYMBOLS.has(symbol)))].slice(0, 4) : base.watchlist;
  return {
    balanceCents: Math.round(clamp(input.balanceCents, 0, 1_000_000_000_00, balanceCents)),
    watchlist: watchlist.length ? watchlist : ["BTC-USD"],
    selectedSymbol: normalizeTradingSymbol(input.selectedSymbol),
    risk: {
      maxDailyLossPct: clamp(risk.maxDailyLossPct, 0.5, 20, 5),
      maxOpenTrades: Math.round(clamp(risk.maxOpenTrades, 1, 10, 3)),
      riskPerTradePct: clamp(risk.riskPerTradePct, 0.25, 5, 1),
      autoStop: risk.autoStop !== false,
      newsPause: risk.newsPause !== false,
    },
    trades: Array.isArray(input.trades) ? input.trades.slice(0, 500) as PaperTrade[] : [],
    analyses: Array.isArray(input.analyses) ? input.analyses.slice(0, 100) as Array<Record<string, unknown>> : [],
    settings: {
      notifications: settings.notifications !== false,
      timezone: ["Asia/Dubai", "UTC", "Asia/Riyadh"].includes(String(settings.timezone)) ? String(settings.timezone) : "Asia/Dubai",
      compactMode: settings.compactMode === true,
    },
  };
}

async function profileFor(userId: string) {
  return (await runtime()).DB.prepare(`SELECT user_id AS userId, display_name AS displayName, role, status,
      paper_balance_cents AS paperBalanceCents FROM trading_profile WHERE user_id = ? LIMIT 1`)
    .bind(userId).first<ProfileRow>();
}

async function inviteForEmail(email: string) {
  return (await runtime()).DB.prepare(`SELECT id, email, display_name AS displayName, role, status, accepted_by_user_id AS acceptedByUserId
      FROM trading_invite WHERE email = ? LIMIT 1`).bind(email).first<{ id: string; email: string; displayName: string; role: "trader" | "viewer"; status: string; acceptedByUserId: string | null }>();
}

export async function canRegisterTradingEmail(emailValue: unknown) {
  const email = normalizeTradingEmail(emailValue);
  if (!EMAIL_PATTERN.test(email)) return false;
  if (isTradingDeveloperEmail(email)) return true;
  const invite = await inviteForEmail(email);
  return Boolean(invite && invite.status !== "revoked");
}

export async function provisionVerifiedTradingUser(user: AccountUser, requestedName?: unknown) {
  const environment = await runtime(), email = normalizeTradingEmail(user.email), now = Date.now();
  if (!user.id || !EMAIL_PATTERN.test(email)) throw new TradingAccessError(400, "بيانات الحساب غير صالحة.");
  const existing = await profileFor(user.id);
  if (isTradingDeveloperEmail(email)) {
    const displayName = cleanName(requestedName ?? existing?.displayName ?? user.name, "المطور");
    await environment.DB.prepare(`INSERT INTO trading_profile (user_id, display_name, role, status, paper_balance_cents, created_at, updated_at)
      VALUES (?, ?, 'developer', 'active', 2500000, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, role = 'developer', status = 'active', updated_at = excluded.updated_at`)
      .bind(user.id, displayName, now, now).run();
    return profileFor(user.id);
  }
  const invite = await inviteForEmail(email);
  if (!invite || invite.status === "revoked") throw new TradingAccessError(403, "هذا البريد غير مضاف إلى مستخدمي VAREX AI Trading. اطلب من المطور إضافته أولاً.");
  if (invite.status === "accepted" && invite.acceptedByUserId && invite.acceptedByUserId !== user.id) throw new TradingAccessError(409, "تم ربط الدعوة بحساب آخر.");
  const displayName = cleanName(requestedName ?? invite.displayName ?? user.name);
  await environment.DB.batch([
    environment.DB.prepare(`INSERT INTO trading_profile (user_id, display_name, role, status, paper_balance_cents, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 2500000, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, role = excluded.role, status = 'active', updated_at = excluded.updated_at`)
      .bind(user.id, displayName, invite.role, now, now),
    environment.DB.prepare(`UPDATE trading_invite SET status = 'accepted', accepted_by_user_id = ?, accepted_at = ?, updated_at = ? WHERE id = ?`)
      .bind(user.id, now, now, invite.id),
  ]);
  return profileFor(user.id);
}

async function sessionUser(request: Request) {
  const session = await (await getCashierAuth()).api.getSession({ headers: request.headers });
  const user = session?.user as AccountUser | undefined;
  if (!user?.id || !user.email) throw new TradingAccessError(401, "انتهت جلسة الحساب. سجّل الدخول من جديد.");
  if (!user.emailVerified) throw new TradingAccessError(403, "أكد بريدك الإلكتروني أولاً.");
  return user;
}

async function requireAccess(request: Request, roles?: TradingRole[]) {
  const user = await sessionUser(request);
  let profile = await profileFor(user.id);
  if (!profile && (isTradingDeveloperEmail(user.email) || await canRegisterTradingEmail(user.email))) profile = await provisionVerifiedTradingUser(user);
  if (!profile) throw new TradingAccessError(403, "هذا الحساب غير مضاف إلى VAREX AI Trading.");
  if (profile.status !== "active") throw new TradingAccessError(403, "تم إيقاف هذا المستخدم. راجع المطور.");
  if (roles && !roles.includes(profile.role)) throw new TradingAccessError(403, "ليس لديك صلاحية لتنفيذ هذا الإجراء.");
  return { user, profile, environment: await runtime() };
}

async function stateFor(profile: ProfileRow) {
  const database = (await runtime()).DB;
  let row = await database.prepare("SELECT state_json AS stateJson, version FROM trading_state WHERE user_id = ? LIMIT 1")
    .bind(profile.userId).first<{ stateJson: string; version: number }>();
  if (!row) {
    const now = Date.now(), state = defaultState(profile.paperBalanceCents);
    await database.prepare(`INSERT INTO trading_state (user_id, state_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(user_id) DO NOTHING`).bind(profile.userId, JSON.stringify(state), now, now).run();
    row = await database.prepare("SELECT state_json AS stateJson, version FROM trading_state WHERE user_id = ? LIMIT 1")
      .bind(profile.userId).first<{ stateJson: string; version: number }>();
  }
  let parsed: unknown = null;
  try { parsed = JSON.parse(row?.stateJson || "null"); } catch {}
  return { state: normalizeState(parsed, profile.paperBalanceCents), version: row?.version || 1 };
}

async function mutateState(profile: ProfileRow, change: (state: TradingStateData) => Promise<TradingStateData> | TradingStateData) {
  const database = (await runtime()).DB;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await stateFor(profile), next = normalizeState(await change(structuredClone(current.state)), current.state.balanceCents), now = Date.now();
    const updated = await database.prepare(`UPDATE trading_state SET state_json = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?`)
      .bind(JSON.stringify(next), now, profile.userId, current.version).run();
    if (updated.meta.changes) {
      if (next.balanceCents !== profile.paperBalanceCents) await database.prepare("UPDATE trading_profile SET paper_balance_cents = ?, updated_at = ? WHERE user_id = ?")
        .bind(next.balanceCents, now, profile.userId).run();
      return { state: next, version: current.version + 1 };
    }
  }
  throw new TradingAccessError(409, "تغيرت البيانات أثناء الحفظ. أعد المحاولة.");
}

function profileJson(user: AccountUser, profile: ProfileRow) {
  return { id: profile.userId, email: normalizeTradingEmail(user.email), displayName: profile.displayName, role: profile.role, status: profile.status, canManageUsers: profile.role === "developer", canTrade: profile.role !== "viewer" };
}

async function listUsers(request: Request) {
  const { environment } = await requireAccess(request, ["developer"]);
  const profiles = await environment.DB.prepare(`SELECT p.user_id AS id, u.email, p.display_name AS displayName, p.role, p.status,
      p.created_at AS createdAt, p.updated_at AS updatedAt FROM trading_profile p JOIN "user" u ON u.id = p.user_id ORDER BY p.created_at ASC`).all<Record<string, unknown>>();
  const invites = await environment.DB.prepare(`SELECT id, email, display_name AS displayName, role, status, created_at AS createdAt,
      updated_at AS updatedAt FROM trading_invite WHERE status = 'pending' ORDER BY created_at DESC`).all<Record<string, unknown>>();
  return [...(profiles.results || []), ...(invites.results || []).map((invite) => ({ ...invite, pending: true }))];
}

function startOfUtcDay() { const date = new Date(); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()); }
function realizedToday(state: TradingStateData) {
  const start = startOfUtcDay();
  return state.trades.filter((trade) => trade.status === "closed" && trade.closedAt && Date.parse(trade.closedAt) >= start).reduce((total, trade) => total + Number(trade.pnl || 0), 0);
}

async function handlePost(request: Request, body: Record<string, unknown>) {
  const action = String(body.action || "");
  if (action === "save_preferences") {
    const { profile } = await requireAccess(request);
    const result = await mutateState(profile, (state) => {
      if (Array.isArray(body.watchlist)) state.watchlist = body.watchlist.map(String).filter((symbol) => SUPPORTED_SYMBOLS.has(symbol));
      if (body.selectedSymbol) state.selectedSymbol = normalizeTradingSymbol(body.selectedSymbol);
      if (body.risk && typeof body.risk === "object" && profile.role !== "viewer") state.risk = { ...state.risk, ...(body.risk as Partial<RiskRules>) };
      if (body.settings && typeof body.settings === "object") state.settings = { ...state.settings, ...(body.settings as Partial<TradingStateData["settings"]>) };
      return state;
    });
    return json({ saved: true, ...result });
  }
  if (action === "update_profile") {
    const { user, profile, environment } = await requireAccess(request);
    const displayName = cleanName(body.displayName, profile.displayName), now = Date.now();
    await environment.DB.batch([
      environment.DB.prepare("UPDATE trading_profile SET display_name = ?, updated_at = ? WHERE user_id = ?").bind(displayName, now, user.id),
      environment.DB.prepare('UPDATE "user" SET name = ?, updated_at = ? WHERE id = ?').bind(displayName, now, user.id),
    ]);
    return json({ saved: true, displayName });
  }
  if (action === "analyze") {
    const { profile } = await requireAccess(request);
    const snapshot = await getMarketSnapshot(body.symbol, true), analysis = analyzeSnapshot(snapshot);
    const result = await mutateState(profile, (state) => { state.selectedSymbol = snapshot.symbol; state.analyses.unshift(analysis); return state; });
    return json({ analysis, market: snapshot, ...result });
  }
  if (action === "open_trade") {
    const { profile } = await requireAccess(request, ["developer", "trader"]);
    const side = body.side === "sell" ? "sell" : "buy", amount = Number(body.amount), snapshot = await getMarketSnapshot(body.symbol);
    if (!Number.isFinite(amount) || amount < 25) throw new TradingAccessError(400, "الحد الأدنى للصفقة التجريبية 25 دولاراً.");
    const result = await mutateState(profile, (state) => {
      const openTrades = state.trades.filter((trade) => trade.status === "open");
      if (openTrades.length >= state.risk.maxOpenTrades) throw new TradingAccessError(409, "وصلت إلى الحد الأقصى للصفقات المفتوحة.");
      const balance = state.balanceCents / 100;
      if (amount > balance * 0.25) throw new TradingAccessError(400, "حجم الصفقة لا يمكن أن يتجاوز 25% من الرصيد التجريبي.");
      const dailyPnl = realizedToday(state);
      if (dailyPnl < 0 && Math.abs(dailyPnl) >= balance * state.risk.maxDailyLossPct / 100) throw new TradingAccessError(409, "تم بلوغ حد الخسارة اليومي؛ أوقف النظام فتح صفقات جديدة.");
      const stopDistance = Math.max(0.005, Math.min(0.05, (balance * state.risk.riskPerTradePct / 100) / amount));
      const trade: PaperTrade = {
        id: crypto.randomUUID(), symbol: snapshot.symbol, side, amount: Math.round(amount * 100) / 100,
        quantity: amount / snapshot.price, entryPrice: snapshot.price, exitPrice: null,
        stopPrice: state.risk.autoStop ? snapshot.price * (side === "buy" ? 1 - stopDistance : 1 + stopDistance) : 0, pnl: 0,
        status: "open", openedAt: new Date().toISOString(), closedAt: null,
      };
      state.trades.unshift(trade); state.selectedSymbol = snapshot.symbol; return state;
    });
    return json({ opened: true, market: snapshot, ...result });
  }
  if (action === "close_trade") {
    const { profile } = await requireAccess(request, ["developer", "trader"]), tradeId = String(body.tradeId || "");
    const current = await stateFor(profile), trade = current.state.trades.find((item) => item.id === tradeId && item.status === "open");
    if (!trade) throw new TradingAccessError(404, "الصفقة المفتوحة غير موجودة.");
    const snapshot = await getMarketSnapshot(trade.symbol);
    const result = await mutateState(profile, (state) => {
      const target = state.trades.find((item) => item.id === tradeId && item.status === "open");
      if (!target) throw new TradingAccessError(409, "تم إغلاق الصفقة مسبقاً.");
      const direction = target.side === "buy" ? 1 : -1;
      target.exitPrice = snapshot.price;
      target.pnl = Math.round(direction * ((snapshot.price - target.entryPrice) / target.entryPrice) * target.amount * 100) / 100;
      target.status = "closed"; target.closedAt = new Date().toISOString();
      state.balanceCents = Math.max(0, state.balanceCents + Math.round(target.pnl * 100));
      return state;
    });
    return json({ closed: true, market: snapshot, ...result });
  }
  if (action === "invite_user") {
    const { user, environment } = await requireAccess(request, ["developer"]), email = normalizeTradingEmail(body.email);
    if (!EMAIL_PATTERN.test(email)) throw new TradingAccessError(400, "أدخل بريداً إلكترونياً صحيحاً.");
    if (isTradingDeveloperEmail(email)) throw new TradingAccessError(409, "هذا هو حساب المطور الأساسي بالفعل.");
    const role = body.role === "viewer" ? "viewer" : "trader", displayName = cleanName(body.displayName, email.split("@")[0]), now = Date.now();
    await environment.DB.prepare(`INSERT INTO trading_invite (id, email, display_name, role, status, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, role = excluded.role,
        status = CASE WHEN trading_invite.status = 'accepted' THEN 'accepted' ELSE 'pending' END, updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), email, displayName, role, user.id, now, now).run();
    const linked = await environment.DB.prepare('SELECT u.id FROM "user" u WHERE lower(u.email) = ? LIMIT 1').bind(email).first<{ id: string }>();
    if (linked) await environment.DB.prepare("UPDATE trading_profile SET display_name = ?, role = ?, status = 'active', updated_at = ? WHERE user_id = ?")
      .bind(displayName, role, now, linked.id).run();
    return json({ saved: true, users: await listUsers(request) });
  }
  if (action === "update_user") {
    const { environment } = await requireAccess(request, ["developer"]), email = normalizeTradingEmail(body.email);
    if (!EMAIL_PATTERN.test(email) || isTradingDeveloperEmail(email)) throw new TradingAccessError(400, "لا يمكن تعديل حساب المطور الأساسي.");
    const role = body.role === "viewer" ? "viewer" : "trader", status = body.status === "inactive" ? "inactive" : "active", displayName = cleanName(body.displayName, email.split("@")[0]), now = Date.now();
    const linked = await environment.DB.prepare('SELECT id FROM "user" WHERE lower(email) = ? LIMIT 1').bind(email).first<{ id: string }>();
    if (linked) await environment.DB.prepare("UPDATE trading_profile SET display_name = ?, role = ?, status = ?, updated_at = ? WHERE user_id = ?")
      .bind(displayName, role, status, now, linked.id).run();
    await environment.DB.prepare(`UPDATE trading_invite SET display_name = ?, role = ?,
      status = CASE WHEN ? = 'inactive' THEN 'revoked' WHEN accepted_by_user_id IS NULL THEN 'pending' ELSE 'accepted' END,
      updated_at = ? WHERE email = ?`)
      .bind(displayName, role, status, now, email).run();
    return json({ saved: true, users: await listUsers(request) });
  }
  if (action === "reset_paper") {
    const { profile } = await requireAccess(request, ["developer", "trader"]);
    const result = await mutateState(profile, (state) => ({ ...defaultState(2_500_000), watchlist: state.watchlist, settings: state.settings }));
    return json({ reset: true, ...result });
  }
  throw new TradingAccessError(400, "الإجراء المطلوب غير معروف.");
}

export async function tradingRequest(request: Request) {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url), action = url.searchParams.get("action") || "bootstrap";
      if (action === "markets") {
        await requireAccess(request);
        return json(await getMarketBoard(url.searchParams.get("symbol")));
      }
      if (action === "users") return json({ users: await listUsers(request) });
      const { user, profile } = await requireAccess(request), state = await stateFor(profile);
      return json({ profile: profileJson(user, profile), ...state, broker: { connected: false, mode: "paper", label: "غير مربوط بوسيط" }, supportedMarkets: Object.values(TRADING_MARKETS) });
    }
    return handlePost(request, await bodyOf(request));
  } catch (error) {
    if (error instanceof TradingAccessError) return json({ error: error.message }, error.status);
    if (error instanceof TradingMarketError) return json({ error: error.message, marketUnavailable: true }, 502);
    console.error("Trading request error", error);
    return json({ error: "تعذر إكمال الطلب حالياً." }, 500);
  }
}
