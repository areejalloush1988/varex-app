import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const WHATSAPP_NUMBER = "971521879794";
const CALL_NUMBER = "+9715888308855";
const DEFAULT_MODEL = "gpt-5.6-luna";
const allowedOrigins = new Set([
  "https://varexapp.com",
  "https://www.varexapp.com",
]);

const businessLabels = {
  restaurant: { ar: "مطعم أو مقهى", en: "Restaurant or cafe" },
  salon: { ar: "صالون أو مركز تجميل", en: "Salon or beauty center" },
  real_estate: { ar: "عقارات", en: "Real estate" },
  retail: { ar: "متجر أو نشاط بيع", en: "Retail business" },
  services: { ar: "شركة خدمات", en: "Service company" },
  other: { ar: "نشاط آخر", en: "Other business" },
} as const;

const websiteLabels = {
  company: { ar: "موقع تعريفي للشركة", en: "Company website" },
  store: { ar: "متجر إلكتروني", en: "Online store" },
  booking: { ar: "موقع حجوزات", en: "Booking website" },
  landing: { ar: "صفحة إعلانية", en: "Landing page" },
  custom: { ar: "موقع بميزات خاصة", en: "Custom website" },
} as const;

const budgetLabels = {
  "999-1999": { ar: "999–1,999 درهم", en: "AED 999–1,999" },
  "2000-4999": { ar: "2,000–4,999 درهم", en: "AED 2,000–4,999" },
  "5000+": { ar: "5,000 درهم أو أكثر", en: "AED 5,000 or more" },
  unsure: { ar: "أحتاج اقتراحاً", en: "I need a recommendation" },
} as const;

const timelineLabels = {
  urgent: { ar: "خلال 7–10 أيام", en: "Within 7–10 days" },
  month: { ar: "خلال 2–4 أسابيع", en: "Within 2–4 weeks" },
  flexible: { ar: "الوقت مرن", en: "Flexible timing" },
} as const;

type Language = "ar" | "en";
type LeadInput = {
  name: string;
  phone: string;
  email: string | null;
  business_type: keyof typeof businessLabels;
  website_type: keyof typeof websiteLabels;
  budget: keyof typeof budgetLabels;
  timeline: keyof typeof timelineLabels;
  notes: string | null;
  language: Language;
  session_id: string;
  page_url: string | null;
  consent_to_contact: true;
  consent_to_ai: boolean;
  metadata: Record<string, string>;
};

class PublicError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requestOrigin(request: Request) {
  return request.headers.get("origin") || "";
}

function isAllowedRequest(request: Request) {
  const origin = requestOrigin(request);
  return allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(request: Request) {
  const origin = requestOrigin(request);
  return {
    "Access-Control-Allow-Origin": isAllowedRequest(request) ? origin : "https://varexapp.com",
    "Access-Control-Allow-Headers": "content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function projectSecretKey() {
  const dictionary = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary) as Record<string, unknown>;
      const value = keys.default || Object.values(keys).find((item) => typeof item === "string" && item);
      if (typeof value === "string" && value) return value;
    } catch {
      // Fall back to the legacy server key during the project's key migration.
    }
  }
  return requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanPhone(value: unknown) {
  return cleanText(value, 32).replace(/[^0-9+()\-\s]/g, "");
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 160).toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new PublicError(400, "INVALID_EMAIL", "يرجى إدخال بريد إلكتروني صحيح.");
  }
  return email;
}

function oneOf<T extends Record<string, unknown>>(value: unknown, values: T, field: string): keyof T {
  const key = cleanText(value, 80);
  if (!Object.prototype.hasOwnProperty.call(values, key)) {
    throw new PublicError(400, "INVALID_FIELD", `Invalid ${field}`);
  }
  return key as keyof T;
}

function cleanMetadata(value: unknown) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"];
  const result: Record<string, string> = {};
  for (const key of allowed) {
    const cleaned = cleanText(row[key], 180);
    if (cleaned) result[key] = cleaned;
  }
  return result;
}

function validateBody(body: Record<string, unknown>): LeadInput {
  if (cleanText(body.website, 200)) {
    throw new PublicError(400, "SPAM_REJECTED", "تعذر إرسال الطلب.");
  }

  const name = cleanText(body.name, 100);
  const phone = cleanPhone(body.phone);
  const language: Language = body.language === "en" ? "en" : "ar";
  const sessionId = cleanText(body.session_id, 40);
  const consent = body.consent_to_contact === true;

  if (name.length < 2) throw new PublicError(400, "INVALID_NAME", "يرجى إدخال الاسم.");
  if (phone.replace(/\D/g, "").length < 7) throw new PublicError(400, "INVALID_PHONE", "يرجى إدخال رقم موبايل صحيح.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new PublicError(400, "INVALID_SESSION", "تعذر التحقق من جلسة الطلب.");
  }
  if (!consent) throw new PublicError(400, "CONSENT_REQUIRED", "يلزم السماح بالتواصل بخصوص الطلب.");

  let pageUrl: string | null = null;
  const rawPageUrl = cleanText(body.page_url, 500);
  if (rawPageUrl) {
    try {
      const parsed = new URL(rawPageUrl);
      if (allowedOrigins.has(parsed.origin)) pageUrl = parsed.href.slice(0, 500);
    } catch {
      pageUrl = null;
    }
  }

  return {
    name,
    phone,
    email: cleanEmail(body.email),
    business_type: oneOf(body.business_type, businessLabels, "business_type"),
    website_type: oneOf(body.website_type, websiteLabels, "website_type"),
    budget: oneOf(body.budget, budgetLabels, "budget"),
    timeline: oneOf(body.timeline, timelineLabels, "timeline"),
    notes: cleanText(body.notes, 1200) || null,
    language,
    session_id: sessionId,
    page_url: pageUrl,
    consent_to_contact: true,
    consent_to_ai: body.consent_to_ai === true,
    metadata: cleanMetadata(body.metadata),
  };
}

function label<T extends Record<string, Record<Language, string>>>(values: T, key: keyof T, language: Language) {
  return values[key][language];
}

function scoreLead(input: LeadInput) {
  let score = 30;
  if (input.budget === "5000+") score += 35;
  else if (input.budget === "2000-4999") score += 25;
  else if (input.budget === "999-1999") score += 15;
  else score += 8;
  if (input.timeline === "urgent") score += 20;
  else if (input.timeline === "month") score += 12;
  if (input.email) score += 5;
  return Math.min(score, 100);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientAddress(request: Request) {
  return cleanText(
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
    80,
  );
}

function fallbackRecommendation(input: LeadInput) {
  const type = label(websiteLabels, input.website_type, input.language);
  if (input.language === "en") {
    return `Based on your answers, VAREX recommends starting with: ${type}. Website packages start from AED 999; the final quote depends on the number of pages and required features. Send the prepared brief on WhatsApp and we will review it with you.`;
  }
  return `بناءً على إجاباتك، الأنسب لنشاطك هو ${type}. تبدأ باقات تصميم المواقع لدى VAREX من 999 درهم، ويتحدد السعر النهائي حسب عدد الصفحات والميزات المطلوبة. أرسل الملخص الجاهز عبر واتساب لنراجع المشروع معك.`;
}

function outputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

async function personalizedRecommendation(input: LeadInput) {
  const fallback = fallbackRecommendation(input);
  if (!input.consent_to_ai) {
    return { recommendation: fallback, model: null as string | null, status: "fallback_no_consent" };
  }
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return { recommendation: fallback, model: null as string | null, status: "fallback_not_configured" };
  }

  const model = Deno.env.get("OPENAI_VAREX_SALES_MODEL") || DEFAULT_MODEL;
  const brief = {
    language: input.language,
    business: label(businessLabels, input.business_type, input.language),
    website: label(websiteLabels, input.website_type, input.language),
    budget: label(budgetLabels, input.budget, input.language),
    timeline: label(timelineLabels, input.timeline, input.language),
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 260,
        instructions: "You are the bilingual VAREX website sales consultant. Write a warm, practical recommendation in the requested language. Use at most 90 words. State that VAREX website design starts from AED 999 and that the final quote depends on pages and features. Never promise guaranteed sales, search ranking, or an exact delivery date. Never request passwords, payment-card data, verification codes, or API keys. End by inviting the prospect to send the prepared brief on WhatsApp for review.",
        input: JSON.stringify(brief),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("VAREX sales AI provider error", {
        status: response.status,
        requestId: response.headers.get("x-request-id"),
      });
      return {
        recommendation: fallback,
        model: null as string | null,
        status: `fallback_provider_${response.status}`,
      };
    }
    const recommendation = cleanText(outputText(payload as Record<string, unknown>), 1600);
    return {
      recommendation: recommendation || fallback,
      model: recommendation ? model : null,
      status: recommendation ? "openai" : "fallback_empty_response",
    };
  } catch (error) {
    console.error("VAREX sales AI request failed", error);
    return { recommendation: fallback, model: null as string | null, status: "fallback_provider_unreachable" };
  }
}

function whatsappMessage(input: LeadInput, leadId: string, recommendation: string) {
  const business = label(businessLabels, input.business_type, input.language);
  const website = label(websiteLabels, input.website_type, input.language);
  const budget = label(budgetLabels, input.budget, input.language);
  const timeline = label(timelineLabels, input.timeline, input.language);

  if (input.language === "en") {
    return [
      "New website request from the VAREX sales agent",
      "",
      `Reference: ${leadId}`,
      `Name: ${input.name}`,
      `Mobile: ${input.phone}`,
      `Email: ${input.email || "-"}`,
      `Business: ${business}`,
      `Website type: ${website}`,
      `Budget: ${budget}`,
      `Timeline: ${timeline}`,
      `Details: ${input.notes || "-"}`,
      "",
      `Recommendation: ${recommendation}`,
    ].join("\n");
  }

  return [
    "طلب موقع جديد من وكيل مبيعات VAREX",
    "",
    `رقم الطلب: ${leadId}`,
    `الاسم: ${input.name}`,
    `الموبايل: ${input.phone}`,
    `البريد: ${input.email || "-"}`,
    `النشاط: ${business}`,
    `نوع الموقع: ${website}`,
    `الميزانية: ${budget}`,
    `المدة: ${timeline}`,
    `التفاصيل: ${input.notes || "-"}`,
    "",
    `توصية الوكيل: ${recommendation}`,
  ].join("\n");
}

Deno.serve(async (request: Request) => {
  if (!isAllowedRequest(request)) {
    return json(request, { success: false, code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." }, 403);
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") {
    return json(request, { success: false, code: "METHOD_NOT_ALLOWED", message: "طريقة الطلب غير مسموحة." }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_000) {
    return json(request, { success: false, code: "PAYLOAD_TOO_LARGE", message: "بيانات الطلب أكبر من الحد المسموح." }, 413);
  }

  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      throw new PublicError(400, "INVALID_BODY", "تعذر قراءة بيانات الطلب.");
    }
    const input = validateBody(rawBody as Record<string, unknown>);
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const admin = createClient(supabaseUrl, projectSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const ipHash = await sha256(`${clientAddress(request)}:${Deno.env.get("SALES_AGENT_HASH_SALT") || supabaseUrl}`);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("varex_sales_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw new Error(`Lead rate-limit lookup failed: ${countError.message}`);
    if ((count || 0) >= 5) {
      throw new PublicError(429, "RATE_LIMITED", "تم إرسال عدة طلبات. يرجى المحاولة بعد ساعة أو التواصل عبر واتساب.");
    }

    const leadScore = scoreLead(input);
    const priority = leadScore >= 70 ? "high" : "normal";
    const ai = await personalizedRecommendation(input);
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("varex_sales_leads")
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email,
        business_type: input.business_type,
        website_type: input.website_type,
        budget: input.budget,
        timeline: input.timeline,
        notes: input.notes,
        language: input.language,
        source: "varex_sales_agent",
        status: "new",
        priority,
        lead_score: leadScore,
        session_id: input.session_id,
        ip_hash: ipHash,
        user_agent: cleanText(request.headers.get("user-agent"), 300) || null,
        page_url: input.page_url,
        consent_to_contact: true,
        consent_to_ai: input.consent_to_ai,
        ai_recommendation: ai.recommendation,
        ai_model: ai.model,
        metadata: input.metadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error || !data?.id) throw new Error(`Lead insert failed: ${error?.message || "missing id"}`);

    const message = whatsappMessage(input, String(data.id), ai.recommendation);
    return json(request, {
      success: true,
      lead_id: data.id,
      recommendation: ai.recommendation,
      ai_personalized: Boolean(ai.model),
      recommendation_source: ai.status,
      whatsapp_url: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      call_url: `tel:${CALL_NUMBER}`,
    }, 201);
  } catch (error) {
    const publicError = error instanceof PublicError ? error : null;
    console.error("VAREX sales agent error", error);
    return json(request, {
      success: false,
      code: publicError?.code || "SALES_AGENT_ERROR",
      message: publicError?.message || "تعذر حفظ الطلب حالياً. يمكنك إرساله مباشرة عبر واتساب.",
    }, publicError?.status || 500);
  }
});
