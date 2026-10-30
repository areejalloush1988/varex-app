import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { BOT_SYMBOLS, BOT_INTERVALS, decide, evaluateDemo, type Candle, type Quote, type DemoState } from "./engine.ts";

const PREFIX = "varex_trading_bot_";
const ORIGINS = new Set(["https://app.varexapp.com", "https://areejalloush1988.github.io"]);
const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const defaults = {
  createClient, fetch: (...args: Parameters<typeof fetch>) => fetch(...args), now: () => Date.now(), uuid: () => crypto.randomUUID(),
  env: (name: string) => typeof Deno !== "undefined" ? Deno.env.get(name) : undefined,
};
class Failure extends Error { constructor(public status: number, message: string) { super(message); } }
function checked<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) throw new Failure(503, "تعذر قراءة أو حفظ إعدادات البوت حالياً.");
  return result.data as T;
}
function serviceKey(env: typeof defaults.env) {
  try { const values = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); if (typeof values.default === "string") return values.default; } catch { /* Legacy key remains supported. */ }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== 64 || b.length !== 64) return false;
  let difference = 0; for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function ready(runtime: any, now: number) {
  return runtime?.scheduler_ready === true && Number(runtime.heartbeat_at) >= now - 180_000 && Number(runtime.heartbeat_at) <= now + 30_000;
}
function serialize(config: any, runtime: any, profile: any, now: number) {
  const canUse = ["developer", "trader"].includes(profile.role);
  return {
    mode: "demo", strategy: "technical_ml_v1", available: canUse, schedulerReady: ready(runtime, now),
    enabled: canUse && config?.enabled === true, revision: config?.revision || 0,
    symbol: config?.symbol || "BTC-USD", interval: config?.interval || "15",
    riskPercent: Number(config?.risk_percent || 1), maxDailyTrades: config?.max_daily_trades || 5,
    lastRunAt: config?.last_run_at ? new Date(Number(config.last_run_at)).toISOString() : null,
    lastSignal: config?.last_signal || "wait", lastMessage: config?.last_message || "البوت متوقف. فعّل الحساب التجريبي للبدء.",
    lastModel: config?.last_model || null, events: Array.isArray(config?.events) ? config.events.slice(0, 50) : [],
  };
}

export function createAutomationHandler(overrides: Partial<typeof defaults> = {}) {
  const dep = { ...defaults, ...overrides };
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" });
    if (origin && ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (origin && !ORIGINS.has(origin)) throw new Failure(403, "مصدر الطلب غير مسموح.");
      if (request.method === "OPTIONS") {
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
        return new Response(null, { status: 204, headers });
      }
      if (!["GET", "POST"].includes(request.method)) throw new Failure(405, "طريقة الطلب غير مدعومة.");
      const schedulerToken = request.headers.get("x-varex-scheduler") || "";
      const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
      if (!schedulerToken && (!token || token.length > 16_384)) throw new Failure(401, "يلزم تسجيل الدخول أولاً.");
      if (schedulerToken && (origin || !/^[a-f0-9]{64}$/.test(schedulerToken) || request.method !== "POST")) throw new Failure(403, "طلب الجدولة غير مسموح.");
      const url = dep.env("SUPABASE_URL"), key = serviceKey(dep.env);
      if (!url || !key) throw new Failure(503, "خدمة التداول الآلي غير مجهزة.");
      const client = dep.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      if (schedulerToken) {
        const runtime = checked<any>(await client.from(PREFIX + "runtime").select("scheduler_secret_hash,scheduler_ready,heartbeat_at").eq("id", 1).maybeSingle());
        if (!runtime || !safeEqual(await hash(schedulerToken), runtime.scheduler_secret_hash)) throw new Failure(403, "طلب الجدولة غير مسموح.");
        if (runtime.scheduler_ready !== true) return json({ mode: "demo", schedulerReady: false, checked: 0, processed: 0 });
        const configs = checked<any[]>(await client.rpc(PREFIX + "claim", { p_now: dep.now(), p_limit: 20 }));
        const marketCache = new Map<string, Promise<{ candles: Candle[]; quote: Quote }>>();
        const quoteCache = new Map<string, Promise<Quote>>();
        async function publicJson(path: string) {
          const response = await dep.fetch(`https://api.exchange.coinbase.com${path}`, {
            headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) throw new Error("provider_unavailable");
          return response.json();
        }
        function quoteFor(symbol: string): Promise<Quote> {
          if (!(BOT_SYMBOLS as readonly string[]).includes(symbol)) return Promise.reject(new Error("unsupported_symbol"));
          if (!quoteCache.has(symbol)) quoteCache.set(symbol, publicJson(`/products/${symbol}/ticker`).then((value) => {
            const price = Number(value.price), time = Date.parse(value.time);
            if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time)) throw new Error("invalid_quote");
            return { price, time };
          }));
          return quoteCache.get(symbol)!;
        }
        function marketFor(symbol: string, interval: string) {
          if (!(BOT_SYMBOLS as readonly string[]).includes(symbol) || !Object.hasOwn(BOT_INTERVALS, interval)) return Promise.reject(new Error("unsupported_market"));
          const id = `${symbol}:${interval}`;
          if (!marketCache.has(id)) marketCache.set(id, Promise.all([
            publicJson(`/products/${symbol}/candles?granularity=${BOT_INTERVALS[interval]}`), quoteFor(symbol),
          ]).then(([rows, quote]) => {
            if (!Array.isArray(rows) || rows.length > 1000) throw new Error("invalid_history");
            const candles = rows.map((row: unknown) => {
              if (!Array.isArray(row) || row.length < 5 || !row.slice(0, 5).every((v: unknown) => typeof v === "number" && Number.isFinite(v))) throw new Error("invalid_history");
              return { time: row[0], low: row[1], high: row[2], open: row[3], close: row[4] };
            });
            return { candles, quote };
          }));
          return marketCache.get(id)!;
        }
        let processed = 0;
        for (const config of configs) {
          try {
            let decision = null;
            try { const market = await marketFor(config.symbol, config.interval); decision = decide(market.candles, BOT_INTERVALS[config.interval], dep.now()); }
            catch { /* Price exits can still be checked; no entries without a valid model. */ }
            for (let attempt = 0; attempt < 3; attempt++) {
              const row = checked<any>(await client.from("varex_trading_state").select("state_json,version").eq("user_id", config.user_id).maybeSingle());
              if (!row) throw new Error("state_missing");
              const state = row.state_json as DemoState;
              const watched = new Set([config.symbol, ...state.trades.filter((t) => t.status === "open" && t.id.startsWith("auto-")).map((t) => t.symbol)]);
              const quotes: Record<string, Quote> = {};
              for (const symbol of watched) { try { quotes[symbol] = await quoteFor(symbol); } catch { /* Missing prices fail closed. */ } }
              const result = evaluateDemo({ state, config, decision, quotes, now: dep.now(), uuid: dep.uuid });
              const events = result.events.length ? [...result.events].reverse() : [{ at: new Date(dep.now()).toISOString(), action: "wait", symbol: config.symbol, message: result.message }];
              const complete = checked<any>(await client.rpc(PREFIX + "complete", {
                p_user_id: config.user_id, p_lease_id: config.lease_id, p_revision: config.revision,
                p_expected_version: row.version, p_state_json: result.events.length ? result.state : null,
                p_last_bar_at: result.lastBar, p_signal: result.signal, p_message: result.message,
                p_model: result.model, p_events: events, p_now: dep.now(),
              }));
              if (complete.reason === "conflict") continue;
              if (complete.saved) processed++;
              break;
            }
          } catch {
            await client.rpc(PREFIX + "complete", { p_user_id: config.user_id, p_lease_id: config.lease_id,
              p_revision: config.revision, p_expected_version: 0, p_state_json: null, p_last_bar_at: config.last_bar_at,
              p_signal: "wait", p_message: "تعذر فحص الحساب أو السوق؛ لم تُفتح صفقة جديدة.", p_model: null,
              p_events: [{ at: new Date(dep.now()).toISOString(), action: "error", symbol: config.symbol, message: "تعذر الفحص؛ إعادة المحاولة في الدورة المجدولة التالية." }], p_now: dep.now() });
          }
        }
        return json({ mode: "demo", checked: configs.length, processed });
      }
      const { data, error } = await client.auth.getUser(token!);
      const user = data?.user;
      if (error || !user?.id || !user.email) throw new Failure(401, "انتهت جلسة الحساب. سجّل الدخول مجدداً.");
      if (!user.email_confirmed_at || user.is_anonymous) throw new Failure(403, "أكد البريد الإلكتروني أولاً.");
      const profile = checked<any>(await client.from("varex_trading_profile").select("user_id,role,status,email").eq("user_id", user.id).maybeSingle());
      if (!profile || profile.status !== "active" || profile.email !== user.email.toLowerCase() || !["developer", "trader", "viewer"].includes(profile.role)) throw new Failure(403, "الحساب غير متاح للتداول الآلي.");
      const runtime = checked<any>(await client.from(PREFIX + "runtime").select("scheduler_ready,heartbeat_at").eq("id", 1).maybeSingle());
      if (request.method === "GET") {
        const config = checked<any>(await client.from(PREFIX + "config").select("*").eq("user_id", user.id).maybeSingle());
        return json({ automation: serialize(config, runtime, profile, dep.now()) });
      }
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) throw new Failure(415, "يلزم إرسال JSON.");
      const text = await request.text();
      if (text.length > 8192) throw new Failure(413, "حجم الطلب أكبر من المسموح.");
      let body: any; try { body = JSON.parse(text); } catch { throw new Failure(400, "بيانات الطلب غير صالحة."); }
      if (!object(body) || body.action !== "configure" || body.mode !== "demo" || typeof body.enabled !== "boolean") throw new Failure(400, "التداول الآلي متاح للحساب التجريبي فقط.");
      if (!(BOT_SYMBOLS as readonly string[]).includes(body.symbol) || typeof body.interval !== "string" || !Object.hasOwn(BOT_INTERVALS, body.interval)
        || typeof body.riskPercent !== "number" || !Number.isFinite(body.riskPercent) || body.riskPercent < .25 || body.riskPercent > 2
        || !Number.isInteger(body.maxDailyTrades) || body.maxDailyTrades < 1 || body.maxDailyTrades > 20
        || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision > 2147483647) throw new Failure(400, "تحقق من إعدادات السوق والمخاطر.");
      if (body.enabled && !["developer", "trader"].includes(profile.role)) throw new Failure(403, "هذه الصلاحية للعرض فقط.");
      if (body.confirmation !== (body.enabled ? "ENABLE_DEMO_AUTOMATION" : "STOP_DEMO_AUTOMATION")) throw new Failure(400, "يلزم تأكيد تشغيل أو إيقاف البوت التجريبي.");
      if (body.enabled && !ready(runtime, dep.now())) throw new Failure(503, "الجدولة غير جاهزة حالياً. حدّث الحالة قبل التشغيل.");
      const result = checked<any>(await client.rpc(PREFIX + "configure", { p_user_id: user.id, p_enabled: body.enabled,
        p_symbol: body.symbol, p_interval: body.interval, p_risk_percent: body.riskPercent,
        p_max_daily_trades: body.maxDailyTrades, p_expected_revision: body.expectedRevision, p_now: dep.now() }));
      if (result.reason) throw new Failure(result.reason === "forbidden" ? 403 : 409, result.reason === "conflict" ? "تغيرت الإعدادات. حدّث الحالة قبل الحفظ." : "تعذر تطبيق إعدادات البوت.");
      return json({ automation: serialize(result.config, runtime, profile, dep.now()) });
    } catch (error) {
      return json({ error: error instanceof Failure ? error.message : "تعذرت خدمة التداول الآلي حالياً." }, error instanceof Failure ? error.status : 503);
    }
  };
}

if (typeof Deno !== "undefined") Deno.serve(createAutomationHandler());
