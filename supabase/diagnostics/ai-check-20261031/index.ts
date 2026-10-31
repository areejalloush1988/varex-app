// One-off operator diagnostic, separate from production analysis/auth routes.
// NEW function only: verify_jwt=false; own exact-default-secret apikey check.
// Dashboard Test: POST {} with Add secret key. Retire immediately after use.
// No users, quota writes, market data, credential output, or caller-controlled URLs/prompts.
export const PROBE_EXPIRES_AT = "2026-10-31T22:45:00Z";
export const EXPECTED_MODEL = "gpt-5.4-mini-2026-03-17";
const READY_URL = "https://eibadfdqzpeigccfdipt.supabase.co/rest/v1/rpc/varex_analysis_usage_ready";
const AI_URL = "https://api.openai.com/v1/responses";
const MAX_BYTES = 65536;
type Dict = Record<string, unknown>;
type Deps = { env: (name: string) => string | undefined; now: () => number; fetch: typeof fetch };
type Fetched = { status: number | null; payload: unknown; transport: string | null };
const object = (value: unknown): value is Dict => value !== null && typeof value === "object" && !Array.isArray(value);
const expired = (deps: Deps) => deps.now() >= Date.parse(PROBE_EXPIRES_AT);

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
  const reader = body.getReader(), chunks: Uint8Array[] = [];
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

async function fetchJson(url: string, headers: Record<string, string>, body: string, deps: Deps): Promise<Fetched> {
  const remaining = Date.parse(PROBE_EXPIRES_AT) - deps.now();
  if (remaining <= 0) return { status: null, payload: null, transport: "diagnostic_expired" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async (): Promise<Fetched> => {
    const response = await deps.fetch(url, { method: "POST", headers, body, signal: controller.signal, redirect: "error", cache: "no-store" });
    const text = await readLimited(response.body, MAX_BYTES);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = null; }
    return { status: response.status, payload, transport: null };
  })();
  try {
    return await Promise.race([work, new Promise<Fetched>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ status: null, payload: null, transport: expired(deps) ? "diagnostic_expired" : "provider_timeout" });
      }, Math.min(15000, remaining));
    })]);
  } catch {
    return { status: null, payload: null, transport: expired(deps) ? "diagnostic_expired" : "provider_transport_error" };
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

function inspectAI(response: Fetched, providerKey: string, operatorKey: string): Dict {
  const payload = response.payload;
  const allowedCodes = new Set(["invalid_api_key", "insufficient_quota", "rate_limit_exceeded", "model_not_found", "invalid_model",
    "billing_not_active", "billing_hard_limit_reached", "organization_deactivated", "account_deactivated", "project_not_found",
    "unsupported_parameter", "unsupported_value", "invalid_request_error", "server_error"]);
  const rawCode = object(payload) && object(payload.error) ? payload.error.code : null;
  const providerCode = typeof rawCode === "string" && allowedCodes.has(rawCode) ? rawCode : null;
  const states = new Set(["completed", "incomplete", "failed", "cancelled", "queued", "in_progress"]);
  const responseStatus = object(payload) && typeof payload.status === "string" && states.has(payload.status) ? payload.status : null;
  const rawIncomplete = object(payload) && object(payload.incomplete_details) ? payload.incomplete_details.reason : null;
  const incompleteReason = rawIncomplete === "max_output_tokens" || rawIncomplete === "content_filter" ? rawIncomplete : null;
  const base = { ok: false, providerHttpStatus: response.status, providerCode, responseStatus, incompleteReason,
    completed: responseStatus === "completed", outputTextPresent: false, outputTextItems: 0, outputTextCharacters: 0 };
  if (response.transport) return { ...base, classification: response.transport };
  if (response.status !== 200) {
    const classification = providerCode === "insufficient_quota" || providerCode === "billing_not_active" || providerCode === "billing_hard_limit_reached"
      ? "billing_or_quota_unavailable" : response.status === 401 ? "authentication_rejected" : response.status === 403 ? "access_denied"
      : response.status === 404 || providerCode === "model_not_found" || providerCode === "invalid_model" ? "model_unavailable"
      : response.status === 429 ? "rate_limited" : response.status !== null && response.status >= 500 ? "provider_unavailable" : "request_rejected";
    return { ...base, classification };
  }
  if (!object(payload) || !Array.isArray(payload.output)) return { ...base, classification: "invalid_response" };
  const texts = payload.output.filter(object).flatMap((entry) => Array.isArray(entry.content) ? entry.content : [])
    .filter((entry) => object(entry) && entry.type === "output_text" && typeof entry.text === "string")
    .map((entry) => String((entry as Dict).text));
  const answer = texts.join("\n").trim();
  const counts = { outputTextPresent: Boolean(answer), outputTextItems: texts.length, outputTextCharacters: answer.length };
  if (responseStatus !== "completed") return { ...base, ...counts, classification: "response_not_completed" };
  if (!answer) return { ...base, ...counts, classification: "no_output_text" };
  const safe = answer.length <= 1000 && !answer.includes(providerKey) && !answer.includes(operatorKey)
    && !/(?:https?:\/\/|www\.|mailto:|data:|javascript:|sb_secret_|sk-[A-Za-z0-9_-]{8}|[<>])/i.test(answer);
  if (!safe) return { ...base, ...counts, classification: "output_withheld" };
  return { ...base, ...counts, ok: true, classification: "generated_answer_received", answer };
}

export function createDiagnosticHandler(deps: Deps) {
  // A warm-isolate guard, not a global billing limiter. Operator invokes once.
  let once: Promise<Dict> | null = null;
  const json = (body: Dict, status = 200) => new Response(JSON.stringify(body), { status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST") return json({ code: "method_not_allowed" }, 405);
      if (expired(deps)) return json({ code: "diagnostic_expired" }, 410);
      let expected: unknown;
      try { const keys: unknown = JSON.parse(deps.env("SUPABASE_SECRET_KEYS") || "null"); if (object(keys)) expected = keys.default; }
      catch { /* No user-token or legacy-key fallback. */ }
      if (typeof expected !== "string" || !expected.startsWith("sb_secret_") || expected.length > 16384) return json({ code: "operator_auth_not_configured" }, 503);
      const presented = request.headers.get("apikey") || "";
      if (!presented || presented.length > 16384 || !await equalSecret(presented, expected)) return json({ code: "operator_auth_required" }, 401);
      if (new URL(request.url).search) return json({ code: "request_parameters_not_allowed" }, 400);
      try {
        const text = await readLimited(request.body, 256), body: unknown = text.trim() ? JSON.parse(text) : {};
        if (!object(body) || Object.keys(body).length !== 0) return json({ code: "empty_body_required" }, 400);
      } catch { return json({ code: "empty_body_required" }, 400); }
      const key = deps.env("OPENAI_API_KEY") || "";
      const config = { aiEnabled: deps.env("VAREX_ANALYSIS_AI_ENABLED") === "true", keyPresent: Boolean(key),
        keyFormatValid: Boolean(key) && key.trim() === key && key.length <= 2048 && !/[\r\n]/.test(key),
        modelMatches: deps.env("OPENAI_MODEL") === EXPECTED_MODEL, expectedModel: EXPECTED_MODEL };
      if (expired(deps)) return json({ code: "diagnostic_expired" }, 410);
      const operatorKey = expected;
      if (!once) once = (async () => {
        const rpc = await fetchJson(READY_URL, { apikey: operatorKey, "Content-Type": "application/json", Accept: "application/json" }, "{}", deps);
        const readiness = { ready: rpc.status === 200 && rpc.payload === true, rpcHttpStatus: rpc.status,
          classification: rpc.transport || (rpc.status === 200 && rpc.payload === true ? "quota_ready" : "quota_not_ready") };
        let ai: Dict;
        if (!config.aiEnabled || !config.keyPresent || !config.keyFormatValid || !config.modelMatches) ai = { ok: false, attempted: false, classification: "ai_configuration_incomplete" };
        else if (!readiness.ready) ai = { ok: false, attempted: false, classification: "quota_not_ready" };
        else if (expired(deps)) ai = { ok: false, attempted: false, classification: "diagnostic_expired" };
        else {
          const response = await fetchJson(AI_URL, { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" }, JSON.stringify({
            model: EXPECTED_MODEL, store: false, max_output_tokens: 128,
            instructions: "أنت مساعد تعليمي. أجب بجملة عربية واحدة قصيرة عن معنى RSI فقط، دون أسعار حالية أو توصية تداول.",
            input: "ما معنى مؤشر RSI؟",
          }), deps);
          ai = { attempted: true, ...inspectAI(response, key, operatorKey) };
        }
        return { diagnostic: true, checkedAt: new Date(deps.now()).toISOString(), expiresAt: PROBE_EXPIRES_AT,
          productionSettingsChanged: false, quotaWrites: false, config, readiness, ai };
      })();
      const result = await once;
      return expired(deps) ? json({ code: "diagnostic_expired" }, 410) : json(result);
    } catch { return json({ code: "diagnostic_failed" }, 503); }
  };
}

if (typeof Deno !== "undefined" && import.meta.main) Deno.serve(createDiagnosticHandler({
  env: (name) => Deno.env.get(name), now: () => Date.now(), fetch: (...args) => fetch(...args),
}));
