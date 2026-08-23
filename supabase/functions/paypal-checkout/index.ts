import { createClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type PlanKey = "monthly" | "yearly" | "lifetime";

const allowedOrigins = new Set([
  "https://varexapp.com",
  "https://www.varexapp.com",
  "https://areejalloush1988.github.io",
]);

const plans: Record<PlanKey, { name: string; amount: string }> = {
  monthly: { name: "VAREX الشهري", amount: "49.00" },
  yearly: { name: "VAREX السنوي", amount: "490.00" },
  lifetime: { name: "VAREX مدى الحياة", amount: "1633.00" },
};

const createOrderWindow = new Map<string, { startedAt: number; count: number }>();
let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

class PublicError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || localOrigin ? origin : "https://varexapp.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(request: Request, body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`Missing required secret: ${names.join(" or ")}`);
}

function requiredProjectKey(jsonName: string, legacyName: string) {
  const dictionary = Deno.env.get(jsonName);
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary) as Record<string, unknown>;
      const preferred = keys.default;
      if (typeof preferred === "string" && preferred) return preferred;
      const fallback = Object.values(keys).find((value) => typeof value === "string" && value);
      if (typeof fallback === "string") return fallback;
    } catch {
      // Fall through to the legacy environment variable.
    }
  }
  return requiredEnv(legacyName);
}

function paypalBaseUrl() {
  const environment = (Deno.env.get("PAYPAL_ENVIRONMENT") || "live").toLowerCase();
  return environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

function businessIdFromRpc(value: unknown): string {
  if (typeof value === "string") return value.replace(/^"|"$/g, "").trim();
  if (Array.isArray(value)) return businessIdFromRpc(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row.get_current_business_id || row.business_id || row.id || "").trim();
  }
  return "";
}

function normalizeSubscription(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    plan: String(row.plan || "business"),
    planName: String(row.plan_name || row.planName || "VAREX Business"),
    billingType: String(row.billing_type || row.billingType || ""),
    price: Number(row.price || 0),
    currency: String(row.currency || "USD"),
    status: String(row.status || "inactive"),
    paymentStatus: String(row.payment_status || row.paymentStatus || "unpaid"),
    startedAt: String(row.started_at || row.startedAt || ""),
    expiresAt: String(row.expires_at || row.expiresAt || ""),
    lifetime: Boolean(row.lifetime),
    licenseKey: String(row.license_key || row.licenseKey || ""),
    paypalOrderId: String(row.paypal_order_id || row.paypalOrderId || ""),
    paypalCaptureId: String(row.paypal_capture_id || row.paypalCaptureId || ""),
    updatedAt: String(row.updated_at || row.updatedAt || ""),
  };
}

function isPayPalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com"));
  } catch {
    return false;
  }
}

function getPayPalIssue(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;
  const details = Array.isArray(data.details) ? data.details : [];
  const first = details[0] as Record<string, unknown> | undefined;
  return String(first?.issue || data.name || "");
}

async function getPayPalAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) return cachedAccessToken;

  const clientId = requiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requiredEnv("PAYPAL_CLIENT_SECRET");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || !data.access_token) {
    console.error("VAREX PayPal OAuth failed", { status: response.status, debugId: data.debug_id || "" });
    throw new PublicError(503, "PAYPAL_AUTH_FAILED", "تعذر الاتصال الآمن بحساب PayPal حالياً.");
  }
  cachedAccessToken = String(data.access_token);
  cachedAccessTokenExpiresAt = Date.now() + Number(data.expires_in || 900) * 1000;
  return cachedAccessToken;
}

async function paypalRequest(path: string, options: RequestInit = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const issue = getPayPalIssue(data);
    const error = new PublicError(502, issue || "PAYPAL_API_ERROR", "تعذر إتمام طلب PayPal حالياً.") as PublicError & { paypal?: Json };
    error.paypal = { status: response.status, issue, debugId: data.debug_id || "" };
    throw error;
  }
  return data;
}

function extractOrderCapture(order: Record<string, unknown>) {
  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  const unit = (units[0] || {}) as Record<string, unknown>;
  const payments = (unit.payments || {}) as Record<string, unknown>;
  const captures = Array.isArray(payments.captures) ? payments.captures : [];
  const capture = (captures[0] || {}) as Record<string, unknown>;
  const amount = (capture.amount || {}) as Record<string, unknown>;
  return {
    unit,
    capture,
    captureId: String(capture.id || ""),
    status: String(capture.status || order.status || "").toUpperCase(),
    amount: String(amount.value || ""),
    currency: String(amount.currency_code || "").toUpperCase(),
    completedAt: String(capture.create_time || capture.update_time || new Date().toISOString()),
  };
}

async function getOrder(orderId: string) {
  return await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

async function authorizedContext(request: Request, admin: ReturnType<typeof createClient>, supabaseUrl: string, publicKey: string) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new PublicError(401, "AUTH_REQUIRED", "يلزم تسجيل الدخول بحساب مالك المنشأة.");

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id) throw new PublicError(401, "INVALID_SESSION", "انتهت جلسة المستخدم. يرجى تسجيل الدخول من جديد.");

  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: businessData, error: businessError } = await userClient.rpc("get_current_business_id");
  if (businessError) throw new Error(`Business lookup failed: ${businessError.message}`);
  const businessId = businessIdFromRpc(businessData);
  if (!businessId) throw new PublicError(404, "BUSINESS_NOT_FOUND", "لم يتم العثور على منشأة مرتبطة بهذا الحساب.");
  return { user, businessId };
}

function checkCreateOrderRate(userId: string) {
  const now = Date.now();
  const item = createOrderWindow.get(userId);
  if (!item || now - item.startedAt > 60_000) {
    createOrderWindow.set(userId, { startedAt: now, count: 1 });
    return;
  }
  item.count += 1;
  if (item.count > 6) throw new PublicError(429, "RATE_LIMITED", "تم إجراء محاولات دفع كثيرة. يرجى الانتظار دقيقة ثم المحاولة.");
}

async function findPaymentByOrder(admin: ReturnType<typeof createClient>, orderId: string) {
  const { data, error } = await admin.from("varex_payment_orders").select("*").eq("paypal_order_id", orderId).maybeSingle();
  if (error) throw new Error(`Payment lookup failed: ${error.message}`);
  return data as Record<string, unknown> | null;
}

async function findPaymentByCapture(admin: ReturnType<typeof createClient>, captureId: string) {
  const { data, error } = await admin.from("varex_payment_orders").select("*").eq("paypal_capture_id", captureId).maybeSingle();
  if (error) throw new Error(`Capture lookup failed: ${error.message}`);
  return data as Record<string, unknown> | null;
}

function validateCapturedOrder(payment: Record<string, unknown>, order: Record<string, unknown>) {
  const details = extractOrderCapture(order);
  const businessId = String(details.unit.custom_id || "");
  if (!details.captureId || !details.amount || !details.currency) throw new Error("Completed PayPal capture details are missing.");
  if (businessId !== String(payment.business_id || "")) throw new Error("PayPal business identifier mismatch.");
  if (details.currency !== String(payment.currency || "").toUpperCase()) throw new Error("PayPal currency mismatch.");
  if (Number(details.amount).toFixed(2) !== Number(payment.amount).toFixed(2)) throw new Error("PayPal amount mismatch.");
  return details;
}

async function finalizeCapturedOrder(admin: ReturnType<typeof createClient>, payment: Record<string, unknown>, order: Record<string, unknown>) {
  const details = validateCapturedOrder(payment, order);
  if (details.status !== "COMPLETED") {
    const nextStatus = details.status === "PENDING" ? "pending" : details.status === "DECLINED" ? "declined" : "approved";
    const { error } = await admin.from("varex_payment_orders").update({
      paypal_capture_id: details.captureId || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (error) throw new Error(`Payment status update failed: ${error.message}`);
    return { completed: false, status: nextStatus, subscription: null };
  }

  const { data, error } = await admin.rpc("varex_apply_paypal_capture", {
    p_order_id: String(payment.paypal_order_id),
    p_capture_id: details.captureId,
    p_amount: Number(details.amount),
    p_currency: details.currency,
    p_completed_at: details.completedAt,
  });
  if (error) throw new Error(`Subscription activation failed: ${error.message}`);
  return { completed: true, status: "completed", captureId: details.captureId, subscription: normalizeSubscription(data) };
}

async function captureStoredOrder(admin: ReturnType<typeof createClient>, payment: Record<string, unknown>) {
  const orderId = String(payment.paypal_order_id || "");
  if (!orderId) throw new Error("Stored PayPal order identifier is missing.");
  if (payment.status === "completed" && payment.paypal_capture_id) {
    const { data, error } = await admin.from("varex_subscriptions").select("*").eq("business_id", payment.business_id).maybeSingle();
    if (error) throw new Error(`Subscription lookup failed: ${error.message}`);
    return { completed: true, status: "completed", captureId: String(payment.paypal_capture_id), subscription: normalizeSubscription(data) };
  }

  let order: Record<string, unknown>;
  try {
    order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `${String(payment.id)}-capture` },
      body: "{}",
    });
  } catch (error) {
    const paypal = (error as PublicError & { paypal?: Json }).paypal || {};
    if (String(paypal.issue || "") !== "ORDER_ALREADY_CAPTURED") throw error;
    order = await getOrder(orderId);
  }
  return await finalizeCapturedOrder(admin, payment, order);
}

async function createOrder(request: Request, admin: ReturnType<typeof createClient>, context: { user: { id: string }; businessId: string }, body: Json) {
  const planKey = String(body.plan || "") as PlanKey;
  const plan = plans[planKey];
  if (!plan) throw new PublicError(400, "INVALID_PLAN", "الباقة المحددة غير صالحة.");
  checkCreateOrderRate(context.user.id);

  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("varex_payment_orders").insert({
    id: paymentId,
    business_id: context.businessId,
    user_id: context.user.id,
    billing_type: planKey,
    plan_name: plan.name,
    amount: Number(plan.amount),
    currency: "USD",
    status: "creating",
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw new Error(`Payment order creation failed: ${insertError.message}`);

  try {
    const order = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: {
        "PayPal-Request-Id": paymentId,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: "VAREX",
              landing_page: "LOGIN",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: "https://varexapp.com/01-الكاشير-والحسابات/subscription-success.html",
              cancel_url: "https://varexapp.com/01-الكاشير-والحسابات/subscription.html?payment=cancelled",
            },
          },
        },
        purchase_units: [{
          reference_id: paymentId,
          custom_id: context.businessId,
          invoice_id: `VAREX-${paymentId}`,
          description: plan.name,
          amount: { currency_code: "USD", value: plan.amount },
        }],
      }),
    });
    const links = Array.isArray(order.links) ? order.links : [];
    const approval = links.find((link) => {
      const rel = String((link as Record<string, unknown>).rel || "");
      return rel === "payer-action" || rel === "approve";
    }) as Record<string, unknown> | undefined;
    const approvalUrl = String(approval?.href || "");
    const orderId = String(order.id || "");
    if (!orderId || !approvalUrl || !isPayPalUrl(approvalUrl)) throw new Error("PayPal approval link is missing or invalid.");

    const { error: updateError } = await admin.from("varex_payment_orders").update({
      paypal_order_id: orderId,
      status: "created",
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    if (updateError) throw new Error(`PayPal order persistence failed: ${updateError.message}`);
    return json(request, { success: true, orderId, approvalUrl }, 201);
  } catch (error) {
    const paypal = (error as PublicError & { paypal?: Json }).paypal || {};
    await admin.from("varex_payment_orders").update({
      status: "failed",
      paypal_debug_id: String(paypal.debugId || "") || null,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    throw error;
  }
}

async function captureOrder(request: Request, admin: ReturnType<typeof createClient>, context: { businessId: string }, body: Json) {
  const orderId = String(body.orderId || "").trim();
  if (!/^[A-Z0-9]{8,40}$/i.test(orderId)) throw new PublicError(400, "INVALID_ORDER", "رقم طلب PayPal غير صالح.");
  const payment = await findPaymentByOrder(admin, orderId);
  if (!payment || String(payment.business_id) !== context.businessId) throw new PublicError(404, "ORDER_NOT_FOUND", "طلب الدفع غير موجود لهذه المنشأة.");
  const result = await captureStoredOrder(admin, payment);
  return json(request, { success: true, ...result });
}

async function paymentStatus(request: Request, admin: ReturnType<typeof createClient>, context: { businessId: string }) {
  const { data: subscriptionRow, error: subscriptionError } = await admin.from("varex_subscriptions").select("*").eq("business_id", context.businessId).maybeSingle();
  if (subscriptionError) throw new Error(`Subscription status lookup failed: ${subscriptionError.message}`);
  let subscription = subscriptionRow;
  if (subscription?.status === "active" && !subscription.lifetime && subscription.expires_at && new Date(subscription.expires_at).getTime() <= Date.now()) {
    const { data: expired, error: expiryError } = await admin.from("varex_subscriptions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("business_id", context.businessId).eq("status", "active").select("*").maybeSingle();
    if (expiryError) throw new Error(`Subscription expiry update failed: ${expiryError.message}`);
    subscription = expired || subscription;
  }
  const { data: latestPayment, error: paymentError } = await admin.from("varex_payment_orders")
    .select("paypal_order_id,paypal_capture_id,billing_type,status,created_at,completed_at")
    .eq("business_id", context.businessId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (paymentError) throw new Error(`Latest payment lookup failed: ${paymentError.message}`);
  return json(request, { success: true, subscription: normalizeSubscription(subscription), latestPayment: latestPayment || null });
}

async function verifyWebhook(headers: Headers, event: Json) {
  const webhookId = requiredEnv("PAYPAL_WEBHOOK_ID");
  const requiredHeaders = {
    auth_algo: headers.get("paypal-auth-algo") || "",
    cert_url: headers.get("paypal-cert-url") || "",
    transmission_id: headers.get("paypal-transmission-id") || "",
    transmission_sig: headers.get("paypal-transmission-sig") || "",
    transmission_time: headers.get("paypal-transmission-time") || "",
  };
  if (Object.values(requiredHeaders).some((value) => !value)) return false;
  const result = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({ ...requiredHeaders, webhook_id: webhookId, webhook_event: event }),
  });
  return String(result.verification_status || "").toUpperCase() === "SUCCESS";
}

function relatedIds(resource: Record<string, unknown>) {
  const supplementary = (resource.supplementary_data || {}) as Record<string, unknown>;
  return (supplementary.related_ids || {}) as Record<string, unknown>;
}

async function processWebhookEvent(admin: ReturnType<typeof createClient>, event: Json) {
  const eventType = String(event.event_type || "");
  const resource = (event.resource || {}) as Record<string, unknown>;
  const related = relatedIds(resource);
  const resourceId = String(resource.id || "");

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    const payment = await findPaymentByOrder(admin, resourceId);
    if (!payment) return { status: "ignored", businessId: null };
    await admin.from("varex_payment_orders").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", payment.id).neq("status", "completed");
    await captureStoredOrder(admin, payment);
    return { status: "completed", businessId: String(payment.business_id) };
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = String(related.order_id || "");
    let payment = orderId ? await findPaymentByOrder(admin, orderId) : null;
    if (!payment && resourceId) payment = await findPaymentByCapture(admin, resourceId);
    if (!payment) return { status: "ignored", businessId: null };
    const order = await getOrder(String(payment.paypal_order_id));
    await finalizeCapturedOrder(admin, payment, order);
    return { status: "completed", businessId: String(payment.business_id) };
  }

  if (eventType === "PAYMENT.CAPTURE.PENDING" || eventType === "PAYMENT.CAPTURE.DECLINED") {
    const orderId = String(related.order_id || "");
    const payment = orderId ? await findPaymentByOrder(admin, orderId) : null;
    if (!payment) return { status: "ignored", businessId: null };
    await admin.from("varex_payment_orders").update({
      paypal_capture_id: resourceId || null,
      status: eventType.endsWith("PENDING") ? "pending" : "declined",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id).neq("status", "completed");
    return { status: "completed", businessId: String(payment.business_id) };
  }

  if (eventType === "PAYMENT.CAPTURE.REFUNDED" || eventType === "PAYMENT.CAPTURE.REVERSED") {
    const captureId = String(related.capture_id || resourceId || "");
    const payment = captureId ? await findPaymentByCapture(admin, captureId) : null;
    if (!payment) return { status: "ignored", businessId: null };
    let status = eventType.endsWith("REVERSED") ? "reversed" : "refunded";
    if (status === "refunded") {
      const capture = await paypalRequest(`/v2/payments/captures/${encodeURIComponent(captureId)}`, { method: "GET" });
      if (String(capture.status || "").toUpperCase() === "PARTIALLY_REFUNDED") status = "partially_refunded";
    }
    if (status === "partially_refunded") {
      await admin.from("varex_payment_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", payment.id);
    } else {
      const { error } = await admin.rpc("varex_reverse_paypal_capture", { p_capture_id: captureId, p_status: status });
      if (error) throw new Error(`PayPal reversal processing failed: ${error.message}`);
    }
    return { status: "completed", businessId: String(payment.business_id) };
  }

  if (eventType === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
    const orderId = String(resource.id || related.order_id || "");
    const payment = orderId ? await findPaymentByOrder(admin, orderId) : null;
    if (!payment) return { status: "ignored", businessId: null };
    await admin.from("varex_payment_orders").update({ status: "reversed", updated_at: new Date().toISOString() }).eq("id", payment.id).neq("status", "completed");
    return { status: "completed", businessId: String(payment.business_id) };
  }

  return { status: "ignored", businessId: null };
}

async function webhook(request: Request, admin: ReturnType<typeof createClient>) {
  const event = await request.json().catch(() => null) as Json | null;
  if (!event || !event.id || !event.event_type) return json(request, { success: false, code: "INVALID_WEBHOOK" }, 400);
  if (!await verifyWebhook(request.headers, event)) return json(request, { success: false, code: "INVALID_SIGNATURE" }, 400);

  const eventId = String(event.id);
  const eventType = String(event.event_type);
  const resource = (event.resource || {}) as Record<string, unknown>;
  const { data: existing, error: lookupError } = await admin.from("varex_paypal_webhook_events")
    .select("status,attempts").eq("event_id", eventId).maybeSingle();
  if (lookupError) throw new Error(`Webhook checkpoint lookup failed: ${lookupError.message}`);
  if (existing?.status === "completed" || existing?.status === "ignored") return json(request, { success: true, duplicate: true });

  const { error: checkpointError } = await admin.from("varex_paypal_webhook_events").upsert({
    event_id: eventId,
    event_type: eventType,
    resource_id: String(resource.id || "") || null,
    status: "processing",
    attempts: Number(existing?.attempts || 0) + 1,
    error_code: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id" });
  if (checkpointError) throw new Error(`Webhook checkpoint failed: ${checkpointError.message}`);

  try {
    const outcome = await processWebhookEvent(admin, event);
    await admin.from("varex_paypal_webhook_events").update({
      business_id: outcome.businessId,
      status: outcome.status,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("event_id", eventId);
    return json(request, { success: true });
  } catch (error) {
    await admin.from("varex_paypal_webhook_events").update({
      status: "failed",
      error_code: error instanceof Error ? error.message.slice(0, 180) : "WEBHOOK_PROCESSING_FAILED",
      updated_at: new Date().toISOString(),
    }).eq("event_id", eventId);
    throw error;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { success: false, code: "METHOD_NOT_ALLOWED", message: "طريقة الطلب غير مسموحة." }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const publicKey = requiredProjectKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const serviceKey = requiredProjectKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const path = new URL(request.url).pathname;
    if (path.endsWith("/webhook") || request.headers.has("paypal-transmission-id")) return await webhook(request, admin);

    const body = await request.json().catch(() => ({})) as Json;
    const action = String(body.action || "");
    const context = await authorizedContext(request, admin, supabaseUrl, publicKey);
    if (action === "create-order") return await createOrder(request, admin, context, body);
    if (action === "capture-order") return await captureOrder(request, admin, context, body);
    if (action === "status") return await paymentStatus(request, admin, context);
    return json(request, { success: false, code: "INVALID_ACTION", message: "عملية الدفع المطلوبة غير صالحة." }, 400);
  } catch (error) {
    const publicError = error instanceof PublicError ? error : null;
    const paypal = (error as PublicError & { paypal?: Json })?.paypal || {};
    console.error("VAREX PayPal checkout error", {
      code: publicError?.code || "PAYPAL_SERVICE_ERROR",
      message: error instanceof Error ? error.message : String(error),
      debugId: paypal.debugId || "",
    });
    return json(request, {
      success: false,
      code: publicError?.code || "PAYPAL_SERVICE_ERROR",
      message: publicError?.message || "حدث خطأ في خدمة الدفع الآمن. لم يتم تفعيل أي اشتراك.",
    }, publicError?.status || 500);
  }
});
