/** Public retirement boundary. Old storage/business utilities remain for recovery. */
const ORIGINS = new Set(["https://app.varexapp.com", "https://varexapp.com", "https://www.varexapp.com", "https://areejalloush1988.github.io"]);
export function analysisOnlyHandler(delegate: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" });
    if (origin && ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
    const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !ORIGINS.has(origin)) return response(403, { error: "المصدر غير مسموح.", code: "origin_not_allowed" });
    if (request.method === "OPTIONS") return delegate(request);
    let action = new URL(request.url).searchParams.get("action") || "bootstrap";
    if (request.method === "POST") {
      const raw = await request.clone().text();
      if (raw.length > 65_536) return response(413, { error: "حجم الطلب أكبر من الحد المسموح.", code: "request_too_large" });
      try { action = JSON.parse(raw)?.action; }
      catch { return response(400, { error: "بيانات الطلب غير صالحة.", code: "invalid_request" }); }
    }
    const allowed = (request.method === "GET" && ["access", "users"].includes(action))
      || (request.method === "POST" && ["update_profile", "invite_user", "update_user"].includes(action));
    if (!allowed) return response(410, { error: "أصبح VAREX مساعداً لتحليل الأسواق. خدمات التداول والوسطاء متوقفة.", code: "analysis_only", analysisOnly: true });
    // The original handler still performs full Auth and active-profile checks.
    const result = await delegate(request);
    if (request.method === "GET" && action === "access" && result.ok) {
      const data = await result.json();
      const profile = data.profile || {};
      return new Response(JSON.stringify({ analysisOnly: true, profile: {
        id: profile.id, email: profile.email, displayName: profile.displayName,
        role: profile.role, status: profile.status, canManageUsers: profile.canManageUsers === true,
        canTrade: false, canConnectBroker: false,
      } }), { status: 200, headers: result.headers });
    }
    return result;
  };
}
