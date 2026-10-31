// Temporary operator diagnostic; NOT an app endpoint. Delete after verification.
// Only this new function uses verify_jwt=false; it authenticates its own apikey.
// Dashboard Test: POST, body {}, Add header > Add secret key (default key).
// No credentials, prices, upstream messages, URLs, or user data are returned/logged.
export const PROBE_EXPIRES_AT = "2026-10-31T22:20:00Z";
const SYMBOLS = ["XAU/USD", "EUR/USD", "AAPL"] as const;
const ENDPOINT = "https://api.twelvedata.com/time_series";
const USAGE_ENDPOINT = "https://api.twelvedata.com/api_usage";
const INTERVAL = "1min";
const MAX_BYTES = 65536;
type Dict = Record<string, unknown>;
type Deps = { env: (name: string) => string | undefined; now: () => number; fetch: typeof fetch };
const object = (value: unknown): value is Dict => value !== null && typeof value === "object" && !Array.isArray(value);

async function equalSecret(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const hashes = await Promise.all([actual, expected].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))));
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= hashes[0][i] ^ hashes[1][i];
  return difference === 0;
}

async function readLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > max) { await reader.cancel(); throw new Error("body_limit"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function safeNumber(value: unknown): number {
  if (typeof value === "number") return value;
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
}

async function providerRequest(url: string, key: string, deps: Deps) {
  const remaining = Date.parse(PROBE_EXPIRES_AT) - deps.now();
  if (remaining <= 0) return { httpStatus: null, payload: null, transportError: "diagnostic_expired" };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(15000, remaining));
  try {
    const response = await deps.fetch(url, { method: "GET", headers: { Accept: "application/json", Authorization: "apikey " + key },
      redirect: "error", signal: controller.signal });
    const text = await readLimited(response.body, MAX_BYTES);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = null; }
    return { httpStatus: response.status, payload, transportError: null };
  } catch {
    return { httpStatus: null, payload: null, transportError: deps.now() >= Date.parse(PROBE_EXPIRES_AT) ? "diagnostic_expired"
      : controller.signal.aborted ? "provider_timeout" : "provider_transport_error" };
  } finally { clearTimeout(timer); }
}

function inspectUsage(payload: unknown, httpStatus: number | null, transportError: string | null): Dict {
  const categories = new Set(["basic", "grow", "pro", "ultra", "venture", "enterprise"]);
  const category = object(payload) && typeof payload.plan_category === "string" ? payload.plan_category.toLowerCase() : "";
  const validLimit = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1e9 ? value : null;
  const planCategory = categories.has(category) ? category : null;
  const planLimit = object(payload) ? validLimit(payload.plan_limit) : null;
  const dailyLimit = object(payload) ? validLimit(payload.plan_daily_limit) : null;
  const providerCode = object(payload) && Number.isInteger(payload.code) && Number(payload.code) >= 100 && Number(payload.code) <= 599 ? Number(payload.code) : null;
  const ok = httpStatus === 200 && planCategory !== null && planLimit !== null && !providerCode;
  return { ok, classification: ok ? "plan_identified" : transportError || "usage_not_identified", providerHttpStatus: httpStatus, providerCode,
    plan_category: ok ? planCategory : null, plan_limit: ok ? planLimit : null, plan_daily_limit: ok ? dailyLimit : null };
}

function inspect(payload: unknown, symbol: string, httpStatus: number, now: number): Dict {
  const providerCode = object(payload) && Number.isInteger(payload.code) && Number(payload.code) >= 100 && Number(payload.code) <= 599
    ? Number(payload.code) : null;
  const base = { symbol, interval: INTERVAL, providerHttpStatus: httpStatus, providerCode,
    metadataChecked: false, candleCount: 0, closedCandleCount: 0, latestClosedAt: null };
  const failure = (classification: string) => ({ ...base, ok: false, classification });
  const code = providerCode ?? httpStatus;
  if (httpStatus < 200 || httpStatus >= 300 || !object(payload) || payload.status !== "ok") {
    return failure(code === 401 ? "key_rejected" : code === 403 ? "plan_or_permission_restricted"
      : code === 429 ? "rate_limited" : code === 400 ? "request_not_supported"
      : code === 404 ? "symbol_unavailable" : code >= 500 ? "provider_unavailable" : "provider_response_rejected");
  }
  // exchange_timezone describes the venue, not necessarily the requested UTC output.
  if (!object(payload.meta) || payload.meta.symbol !== symbol || payload.meta.interval !== INTERVAL
    || payload.meta.timezone !== undefined && payload.meta.timezone !== "UTC") {
    return failure("metadata_mismatch");
  }
  base.metadataChecked = true;
  if (!Array.isArray(payload.values) || payload.values.length < 1 || payload.values.length > 3) return failure("invalid_candle_count");
  const seen = new Set<number>();
  let closed = 0, latestClosed = 0;
  for (const row of payload.values) {
    if (!object(row) || typeof row.datetime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.datetime)) return failure("invalid_candle_time");
    const iso = row.datetime.replace(" ", "T") + "Z", stamp = Date.parse(iso);
    if (!Number.isFinite(stamp) || stamp < 0 || stamp > now || stamp % 60000 !== 0
      || new Date(stamp).toISOString().slice(0, 19) !== iso.slice(0, 19) || seen.has(stamp)) return failure("invalid_candle_time");
    seen.add(stamp);
    const [open, high, low, close] = [row.open, row.high, row.low, row.close].map(safeNumber);
    if (![open, high, low, close].every((v) => Number.isFinite(v) && v > 0 && v < 1e12)
      || low > high || open < low || open > high || close < low || close > high) return failure("invalid_ohlc");
    if (stamp + 60000 <= now) { closed++; latestClosed = Math.max(latestClosed, stamp + 60000); }
  }
  return { ...base, ok: true, classification: closed ? "candles_available" : "forming_candles_only",
    candleCount: seen.size, closedCandleCount: closed,
    latestClosedAt: latestClosed ? new Date(latestClosed).toISOString() : null };
}

export function createDiagnosticHandler(deps: Deps) {
  // Prevent repeat provider calls in this warm isolate. Not a global rate limiter.
  // Only the service secret can run this short-lived probe; operator invokes once.
  let once: Promise<Dict> | null = null;
  const json = (body: Dict, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
      "x-content-type-options": "nosniff" },
  });
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST") return json({ code: "method_not_allowed" }, 405);
      if (deps.now() >= Date.parse(PROBE_EXPIRES_AT)) return json({ code: "diagnostic_expired" }, 410);
      let expected: unknown;
      try { const keys: unknown = JSON.parse(deps.env("SUPABASE_SECRET_KEYS") || "null"); if (object(keys)) expected = keys.default; }
      catch { /* No secret mode fallback. */ }
      if (typeof expected !== "string" || !expected.startsWith("sb_secret_") || expected.length > 16384) return json({ code: "operator_auth_not_configured" }, 503);
      const presented = request.headers.get("apikey") || "";
      if (!presented || presented.length > 16384 || !await equalSecret(presented, expected)) return json({ code: "operator_auth_required" }, 401);
      if (new URL(request.url).search) return json({ code: "request_parameters_not_allowed" }, 400);
      try {
        const text = await readLimited(request.body, 256), body: unknown = text.trim() ? JSON.parse(text) : {};
        if (!object(body) || Object.keys(body).length !== 0) return json({ code: "empty_body_required" }, 400);
      } catch { return json({ code: "empty_body_required" }, 400); }
      const key = deps.env("TWELVE_DATA_API_KEY");
      if (!key) return json({ code: "provider_key_not_configured" }, 503);
      if (key.trim() !== key || key.length > 2048 || /[\r\n]/.test(key)) return json({ code: "invalid_provider_key_format" }, 503);
      if (deps.now() >= Date.parse(PROBE_EXPIRES_AT)) return json({ code: "diagnostic_expired" }, 410);
      if (!once) once = (async () => {
        // At most four sequential provider requests: usage, then three symbols.
        const usageResponse = await providerRequest(USAGE_ENDPOINT, key, deps);
        const usage = inspectUsage(usageResponse.payload, usageResponse.httpStatus, usageResponse.transportError);
        const results: Dict[] = [];
        for (const symbol of SYMBOLS) {
          if (deps.now() >= Date.parse(PROBE_EXPIRES_AT)) { results.push({ symbol, interval: INTERVAL, ok: false, classification: "diagnostic_expired" }); break; }
          const url = new URL(ENDPOINT);
          url.search = new URLSearchParams({ symbol, interval: INTERVAL, outputsize: "3", timezone: "UTC", format: "JSON" }).toString();
          const response = await providerRequest(url.href, key, deps);
          if (response.transportError || response.httpStatus === null) {
            results.push({ symbol, interval: INTERVAL, ok: false, classification: response.transportError,
              providerHttpStatus: null, providerCode: null, metadataChecked: false, candleCount: 0, closedCandleCount: 0, latestClosedAt: null });
          } else results.push(inspect(response.payload, symbol, response.httpStatus, deps.now()));
        }
        return { diagnostic: true, provider: "twelvedata", checkedAt: new Date(deps.now()).toISOString(),
          expiresAt: PROBE_EXPIRES_AT, productionSettingsChanged: false, licenseVerified: false, usage, results };
      })();
      const result = await once;
      return deps.now() >= Date.parse(PROBE_EXPIRES_AT) ? json({ code: "diagnostic_expired" }, 410) : json(result);
    } catch { return json({ code: "diagnostic_failed" }, 503); }
  };
}

if (import.meta.main) Deno.serve(createDiagnosticHandler({
  env: (name) => Deno.env.get(name), now: () => Date.now(), fetch: (...args) => fetch(...args),
}));
