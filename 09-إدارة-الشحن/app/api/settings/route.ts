import { authErrorMessage, database, readShippingSession } from "@/lib/shipping-auth-server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const session = await readShippingSession(request);
    if (!session) return json({ error: "يجب تسجيل الدخول." }, 401);
    const row = await database().prepare("SELECT settings_json AS settingsJson FROM shipping_settings WHERE business_id = ? LIMIT 1").bind(session.businessId).first<{ settingsJson: string }>();
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(row?.settingsJson || "{}"); } catch {}
    return json({ settings });
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await readShippingSession(request);
    if (!session) return json({ error: "يجب تسجيل الدخول." }, 401);
    const body = await request.json() as Record<string, unknown>;
    const settings = {
      themeId: String(body.themeId || "coffee"),
      language: String(body.language || "ar"),
      autoAssign: Boolean(body.autoAssign),
      clientUpdates: Boolean(body.clientUpdates),
      proofRequired: Boolean(body.proofRequired),
      capacityAlerts: Boolean(body.capacityAlerts),
      soundOn: Boolean(body.soundOn),
    };
    const now = Date.now();
    await database().prepare(
      `INSERT INTO shipping_settings (business_id, settings_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(business_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
    ).bind(session.businessId, JSON.stringify(settings), now).run();
    return json({ settings });
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}
