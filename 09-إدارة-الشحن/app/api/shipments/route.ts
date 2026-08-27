import { authErrorMessage, database, readShippingSession } from "@/lib/shipping-auth-server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const session = await readShippingSession(request);
    if (!session) return json({ error: "يجب تسجيل الدخول." }, 401);
    const result = await database().prepare(
      `SELECT id, customer, phone, origin, destination, service, status, eta, driver, vehicle, progress, amount, weight
         FROM shipping_shipments
        WHERE business_id = ?
        ORDER BY created_at DESC`,
    ).bind(session.businessId).all();
    return json({ shipments: result.results || [] });
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await readShippingSession(request);
    if (!session) return json({ error: "يجب تسجيل الدخول." }, 401);
    const body = await request.json() as Record<string, unknown>;
    const customer = String(body.customer || "").trim();
    const phone = String(body.phone || "").trim();
    const origin = String(body.origin || "").trim();
    const destination = String(body.destination || "").trim();
    const service = ["عادي", "سريع", "دولي"].includes(String(body.service)) ? String(body.service) : "عادي";
    const weightValue = Number(body.weight || 0);
    const amount = Math.max(0, Number(body.amount || 0));
    if (!customer || !phone || !origin || !destination || !Number.isFinite(weightValue) || weightValue <= 0) {
      return json({ error: "يجب تعبئة الحقول المطلوبة بقيم صحيحة." }, 400);
    }
    const now = Date.now();
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase();
    const shipment = {
      id: `VX-${suffix}`,
      customer,
      phone,
      origin,
      destination,
      service,
      status: "جديدة",
      eta: "يتم احتساب الموعد",
      driver: "غير معيّن",
      vehicle: "غير معيّنة",
      progress: 8,
      amount,
      weight: `${weightValue} كغ`,
    };
    await database().prepare(
      `INSERT INTO shipping_shipments
        (id, business_id, customer, phone, origin, destination, service, status, eta, driver, vehicle, progress, amount, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      shipment.id, session.businessId, shipment.customer, shipment.phone, shipment.origin, shipment.destination,
      shipment.service, shipment.status, shipment.eta, shipment.driver, shipment.vehicle, shipment.progress,
      shipment.amount, shipment.weight, now, now,
    ).run();
    return json({ shipment }, 201);
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}
