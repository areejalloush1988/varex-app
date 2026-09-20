import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import OpenAI from "openai";
import { continuePendingIntent, normalizePhoneDigits, parseChatIntent, type ChatActionIntent } from "./chat-command";
import { askAiProvider, verifyAiProviderCredential, GEMINI_TTS_MODEL, GEMINI_MODEL, GEMINI_VOICES, OPENAI_MODEL, type AiProvider } from "./ai-provider";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES?: R2Bucket;
  IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  APP_BASE_URL?: string;
  INTEGRATION_ENCRYPTION_KEY?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_GRAPH_VERSION?: string;
  META_LOGIN_CONFIG_ID?: string;
  META_WHATSAPP_CONFIG_ID?: string;
  META_BUSINESS_ID?: string;
  META_WHATSAPP_WABA_ID?: string;
  META_WHATSAPP_SYSTEM_USER_TOKEN?: string;
  META_WHATSAPP_VERIFY_TOKEN?: string;
  META_FACEBOOK_SCOPES?: string;
  META_INSTAGRAM_SCOPES?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_REDIRECT_URI?: string;
  TIKTOK_SCOPES?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENV?: string;
  OPENAI_API_KEY?: string;
  OPENAI_PROJECT_ID?: string;
  OPENAI_WEBHOOK_SECRET?: string;
  VOICE_GATEWAY_ACCOUNT_ID?: string;
  VOICE_GATEWAY_AUTH_SECRET?: string;
  GEMINI_API_KEY?: string;
}
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
type Row = Record<string, unknown>;
type OAuthProvider = "whatsapp" | "facebook" | "instagram" | "tiktok" | "email" | "youtube";
type MetaOAuthProvider = "whatsapp" | "facebook" | "instagram";

const oauthProviders = new Set<OAuthProvider>(["whatsapp", "facebook", "instagram", "tiktok", "email", "youtube"]);
const developerAccountEmail = "areejalloush1988@gmail.com";
const varexAdminEmails = new Set([developerAccountEmail]);
const customerSubscriptionPlans: Record<string, { agentLimit: number | null; monthlyTaskLimit: number; billingCycle: string }> = {
  solo: { agentLimit: 1, monthlyTaskLimit: 3000, billingCycle: "monthly" },
  team3: { agentLimit: 3, monthlyTaskLimit: 10000, billingCycle: "monthly" },
  team5: { agentLimit: 5, monthlyTaskLimit: 25000, billingCycle: "monthly" },
  team10: { agentLimit: 10, monthlyTaskLimit: 60000, billingCycle: "monthly" },
  unlimited: { agentLimit: null, monthlyTaskLimit: 120000, billingCycle: "monthly" },
};
const payPalPlanPrices: Record<string, { amount: string; currency: "USD"; name: string }> = {
  solo: { amount: "244.79", currency: "USD", name: "موظف واحد" },
  team3: { amount: "462.63", currency: "USD", name: "3 موظفين" },
  team5: { amount: "734.92", currency: "USD", name: "5 موظفين" },
  team10: { amount: "1225.05", currency: "USD", name: "10 موظفين" },
  unlimited: { amount: "1905.79", currency: "USD", name: "غير محدود" },
};

const REALTIME_MODEL = "gpt-realtime-2.1";
const REALTIME_TRANSCRIBE_MODEL = "gpt-live-transcribe";
const OPENAI_SPEECH_MODEL = "gpt-4o-mini-tts";
const REALTIME_VOICE_IDS = ["marin", "cedar", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "alloy"] as const;
const REALTIME_VOICES = new Set<string>(REALTIME_VOICE_IDS);
const GEMINI_TO_REALTIME_VOICE: Record<string, string> = {
  Sulafat: "marin", Achird: "cedar", Achernar: "sage", Kore: "coral", Aoede: "shimmer",
  Orus: "echo", Puck: "verse", Alnilam: "ballad", Zephyr: "alloy", Charon: "ash",
};
function realtimeVoiceId(value: unknown) {
  const requested = String(value || "").trim();
  if (REALTIME_VOICES.has(requested)) return requested;
  return GEMINI_TO_REALTIME_VOICE[requested] || "marin";
}

const jsonColumns = new Set(["channels", "metadata", "details", "capabilities", "request_payload", "result_details", "settings"]);
const booleanColumns = new Set(["requires_price_approval", "audit_enabled", "auto_publish", "vat_enabled", "requires_approval"]);
const tableColumns: Record<string, string[]> = {
  ai_organizations: ["owner_id","name","industry","status","trial_ends_at","timezone","ui_language","ui_theme","requires_price_approval","audit_enabled","auto_publish","vat_enabled","legal_name","trn","billing_email"],
  ai_members: ["organization_id","user_id","role"],
  ai_agents: ["organization_id","name","role","objective","language","tone","channels","status","requires_approval","instructions","created_by"],
  ai_tasks: ["organization_id","agent_id","title","instructions","status","priority","requires_approval","output","scheduled_at","started_at","completed_at","created_by"],
  ai_leads: ["organization_id","name","company","service","status","source","priority","score","next_action","notes"],
  ai_approvals: ["organization_id","task_id","action_execution_id","title","summary","status","requested_by","reviewed_by","reviewed_at"],
  ai_integrations: ["organization_id","provider","status","connected_account","last_sync_at","metadata"],
  ai_device_connections: ["organization_id","user_id","device_id","device_name","platform","status","app_version","capabilities","last_seen_at"],
  ai_agent_permissions: ["organization_id","agent_id","app_key","action_key","mode","risk_level","updated_by"],
  ai_action_executions: ["organization_id","agent_id","task_id","app_key","action_key","permission_mode","status","target","device_id","claimed_at","request_payload","result_summary","result_details","error_code","approved_by","approved_at","started_at","completed_at","created_by"],
  ai_voice_settings: ["organization_id","agent_id","provider","status","caller_id","voice_id","disclosure_text","settings","updated_by"],
  ai_voice_calls: ["organization_id","agent_id","action_execution_id","provider_call_id","openai_session_id","from_number","to_number","contact_name","purpose","status","error_code","started_at","answered_at","completed_at","metadata"],
  ai_messages: ["organization_id","contact_name","contact_address","channel","direction","body","send_status","created_by"],
  ai_knowledge_items: ["organization_id","title","file_type","file_size","storage_path","status","created_by"],
  ai_subscriptions: ["organization_id","plan_code","status","agent_limit","monthly_task_limit","trial_ends_at","starts_at","renews_at","billing_cycle","payment_method"],
  ai_audit_logs: ["organization_id","user_id","action","entity_type","entity_id","details"],
};
const defaults: Record<string, Row> = {
  ai_organizations: { status: "subscription_required", timezone: "Asia/Dubai", ui_language: "ar", ui_theme: "navy", requires_price_approval: 1, audit_enabled: 1, auto_publish: 0, vat_enabled: 0 },
  ai_members: { role: "member" }, ai_agents: { objective: "", language: "ar", tone: "professional_friendly", channels: [], status: "draft", requires_approval: 1 },
  ai_tasks: { status: "draft", priority: "medium", requires_approval: 1 }, ai_leads: { status: "new", source: "manual", priority: "medium", score: 50 },
  ai_approvals: { status: "pending" }, ai_integrations: { status: "setup_required", metadata: {} }, ai_messages: { send_status: "draft" },
  ai_knowledge_items: { status: "metadata_only" }, ai_subscriptions: { plan_code: "solo", status: "pending_payment", monthly_task_limit: 3000, billing_cycle: "monthly" }, ai_audit_logs: { details: {} },
  ai_device_connections: { status: "not_connected", platform: "unknown", capabilities: [] },
  ai_agent_permissions: { mode: "denied", risk_level: "standard" },
  ai_action_executions: { permission_mode: "denied", status: "queued", request_payload: {}, result_details: {} },
  ai_voice_settings: { provider: "not_configured", status: "not_connected", disclosure_text: "مرحباً، أنا المساعد الذكي وأتصل نيابة عن صاحب الحساب.", settings: {} },
  ai_voice_calls: { status: "queued", metadata: {} },
};
const permissionModes = new Set(["denied", "approval", "automatic"]);
const permissionRiskLevels = new Set(["standard", "sensitive", "critical"]);
const supportedDeviceApps = new Set(["email", "contacts", "calendar", "alarms", "phone", "voice", "whatsapp", "facebook", "instagram", "tiktok", "youtube", "settings", "parking"]);
const nativeDeviceApps = new Set(["contacts", "calendar", "alarms", "phone", "settings"]);
const nativeDevicePlatforms = new Set(["android", "ios"]);
const nativeDeviceOnlineWindowMs = 2 * 60_000;
const ownerControlledTables = new Set(["ai_device_connections", "ai_agent_permissions", "ai_voice_settings"]);
const deviceAppCatalog: Record<string, { label: string; description: string; connectionType: "cloud" | "native" | "provider"; actions: Record<string, { label: string; risk: "standard" | "sensitive" | "critical" }> }> = {
  email: { label: "البريد الإلكتروني", description: "قراءة البريد وإنشاء المسودات وإرسالها وإدارتها", connectionType: "cloud", actions: {
    read: { label: "قراءة الرسائل", risk: "sensitive" }, create_draft: { label: "إنشاء مسودة", risk: "standard" }, edit_draft: { label: "تعديل مسودة", risk: "standard" },
    send: { label: "إرسال رسالة", risk: "critical" }, reply: { label: "الرد على رسالة", risk: "sensitive" }, forward: { label: "إعادة توجيه رسالة", risk: "sensitive" },
    download_attachments: { label: "تنزيل المرفقات", risk: "sensitive" }, trash: { label: "نقل إلى المهملات", risk: "sensitive" }, delete_permanent: { label: "الحذف النهائي", risk: "critical" },
  } },
  contacts: { label: "جهات الاتصال", description: "البحث عن الأسماء والأرقام وإضافة بياناتها أو تعديلها", connectionType: "native", actions: {
    view: { label: "عرض جهات الاتصال", risk: "sensitive" }, search: { label: "البحث عن اسم أو رقم", risk: "sensitive" }, create: { label: "إضافة جهة اتصال", risk: "sensitive" },
    edit: { label: "تعديل جهة اتصال", risk: "sensitive" }, delete: { label: "حذف جهة اتصال", risk: "critical" },
  } },
  calendar: { label: "التقويم", description: "عرض المواعيد وإنشاؤها وتعديلها أو إلغاؤها", connectionType: "native", actions: {
    view: { label: "عرض المواعيد", risk: "sensitive" }, create: { label: "إنشاء موعد", risk: "sensitive" }, edit: { label: "تعديل موعد", risk: "sensitive" },
    cancel: { label: "إلغاء موعد", risk: "critical" }, delete: { label: "حذف موعد", risk: "critical" },
  } },
  alarms: { label: "المنبّه والتذكيرات", description: "إنشاء التنبيهات وتشغيلها أو تعديلها أو حذفها", connectionType: "native", actions: {
    create: { label: "إنشاء منبّه", risk: "standard" }, edit: { label: "تعديل منبّه", risk: "sensitive" }, enable: { label: "تشغيل منبّه", risk: "standard" },
    disable: { label: "إيقاف منبّه", risk: "sensitive" }, delete: { label: "حذف منبّه", risk: "critical" },
  } },
  phone: { label: "الهاتف", description: "البحث عن الأرقام وبدء الاتصال وإعادته أو تحويله", connectionType: "native", actions: {
    lookup: { label: "البحث عن رقم", risk: "sensitive" }, start_call: { label: "بدء اتصال", risk: "critical" }, redial: { label: "إعادة الاتصال", risk: "critical" },
    transfer: { label: "تحويل المكالمة للمالك", risk: "critical" },
  } },
  voice: { label: "المكالمات الهاتفية", description: "إجراء مكالمات خارجية وتفريغها وتلخيصها بعد ربط رقم اتصال", connectionType: "provider", actions: {
    speak_on_behalf: { label: "التحدث نيابة عن المالك", risk: "critical" }, transcribe: { label: "تفريغ المكالمة نصياً", risk: "sensitive" },
    record: { label: "تسجيل المكالمة", risk: "critical" }, summarize: { label: "تلخيص المكالمة", risk: "standard" }, transfer: { label: "تحويل المكالمة للمالك", risk: "critical" },
  } },
  whatsapp: { label: "WhatsApp Business", description: "قراءة المحادثات وتجهيز الرسائل وإرسالها ومتابعتها", connectionType: "cloud", actions: {
    read: { label: "قراءة المحادثات المتاحة", risk: "sensitive" }, draft: { label: "تجهيز رسالة", risk: "standard" }, send: { label: "إرسال رسالة", risk: "critical" },
    reply: { label: "الرد على رسالة", risk: "critical" }, follow_up: { label: "متابعة المحادثة", risk: "critical" },
  } },
  facebook: { label: "Facebook", description: "عرض منشورات الصفحة المرتبطة ونشر محتوى جديد بعد موافقة المالك", connectionType: "cloud", actions: {
    list_posts: { label: "عرض منشورات الصفحة", risk: "sensitive" }, publish: { label: "نشر على الصفحة", risk: "critical" },
  } },
  instagram: { label: "Instagram", description: "نشر الصور وقراءة التعليقات والرد عليها في الحساب المهني المرتبط", connectionType: "cloud", actions: {
    publish: { label: "نشر صورة", risk: "critical" }, read_comments: { label: "قراءة التعليقات", risk: "sensitive" }, reply_comment: { label: "الرد على تعليق", risk: "critical" },
  } },
  tiktok: { label: "TikTok", description: "إرسال فيديو للنشر من رابط عام بعد منح صلاحية النشر للحساب", connectionType: "cloud", actions: {
    publish_video: { label: "نشر فيديو", risk: "critical" },
  } },
  youtube: { label: "YouTube", description: "البحث ورفع الفيديوهات وتعديلها وإدارتها", connectionType: "cloud", actions: {
    search: { label: "البحث عن فيديو", risk: "standard" }, upload: { label: "رفع فيديو", risk: "critical" }, edit: { label: "تعديل بيانات فيديو", risk: "sensitive" },
    manage: { label: "إدارة القناة والقوائم", risk: "sensitive" }, delete: { label: "حذف فيديو", risk: "critical" },
  } },
  settings: { label: "إعدادات الهاتف", description: "عرض الإعدادات وفتح الصفحات التي يسمح بها نظام الجهاز", connectionType: "native", actions: {
    view: { label: "عرض حالة الإعدادات", risk: "sensitive" }, open: { label: "فتح صفحة إعداد", risk: "standard" }, change: { label: "تغيير إعداد مسموح", risk: "critical" },
  } },
  parking: { label: "المواقف والباركينج", description: "عرض الموقف وبدء الجلسة أو تمديدها والدفع عند توفر الربط", connectionType: "provider", actions: {
    view: { label: "عرض حالة الموقف", risk: "sensitive" }, start_session: { label: "بدء جلسة موقف", risk: "critical" }, extend: { label: "تمديد جلسة موقف", risk: "critical" },
    pay: { label: "دفع رسوم موقف", risk: "critical" },
  } },
};

function api(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
function error(message: string, status = 400) { return api({ message }, status); }
async function noStoreAsset(request: Request, env: Env, assetPath: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("if-none-match");
  requestHeaders.delete("if-modified-since");
  const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url), { method: "GET", headers: requestHeaders }));
  const responseHeaders = new Headers(asset.headers);
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  responseHeaders.set("Pragma", "no-cache");
  responseHeaders.set("Expires", "0");
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers: responseHeaders });
}
function now() { return new Date().toISOString(); }
function plusDays(days: number) { return new Date(Date.now() + days * 86400000).toISOString(); }
function hex(bytes: ArrayBuffer | Uint8Array) { return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
async function sha256(value: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
function bytesToBase64Url(value: Uint8Array) { return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), character => character.charCodeAt(0));
}
function appOrigin(request: Request, env: Env) {
  const configured = String(env.APP_BASE_URL || "").trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}
function tikTokRedirectUri(request: Request, env: Env) {
  const configured = String(env.TIKTOK_REDIRECT_URI || "").trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:") throw new Error("INVALID_TIKTOK_REDIRECT_URI");
    return url.toString();
  }
  return `${appOrigin(request, env)}/api/integrations/callback/tiktok`;
}
function tikTokCallbackMode(request: Request, env: Env) {
  const configured = new URL(tikTokRedirectUri(request, env));
  const direct = new URL(`${appOrigin(request, env)}/api/integrations/callback/tiktok`);
  return configured.origin === direct.origin && configured.pathname.replace(/\/$/, "") === direct.pathname ? "direct" : "external_bridge";
}
function googleRedirectUri(request: Request, env: Env) {
  return `${appOrigin(request, env)}/api/integrations/callback/google`;
}
function googleScopes(provider: "email" | "youtube") {
  const common = ["openid", "email", "profile"];
  return provider === "email"
    ? [...common, "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"]
    : [...common, "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.upload"];
}
async function encryptIntegrationCredentials(env: Env, credentials: Row) {
  if (!env.INTEGRATION_ENCRYPTION_KEY || env.INTEGRATION_ENCRYPTION_KEY.length < 32) throw new Error("INTEGRATION_ENCRYPTION_NOT_CONFIGURED");
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.INTEGRATION_ENCRYPTION_KEY));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(credentials)));
  return { version: 1, algorithm: "AES-256-GCM", iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(cipher)) };
}
async function decryptIntegrationCredentials(env: Env, encrypted: Row) {
  if (!env.INTEGRATION_ENCRYPTION_KEY || env.INTEGRATION_ENCRYPTION_KEY.length < 32) throw new Error("INTEGRATION_ENCRYPTION_NOT_CONFIGURED");
  if (encrypted.version !== 1 || encrypted.algorithm !== "AES-256-GCM" || !encrypted.iv || !encrypted.ciphertext) throw new Error("INVALID_ENCRYPTED_CREDENTIAL");
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.INTEGRATION_ENCRYPTION_KEY));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(String(encrypted.iv)) }, key, base64UrlToBytes(String(encrypted.ciphertext)));
  return JSON.parse(new TextDecoder().decode(plain)) as Row;
}

const aiProviders = new Set<AiProvider>(["openai", "gemini"]);
const aiProviderModels: Record<AiProvider, string> = { openai: OPENAI_MODEL, gemini: GEMINI_MODEL };
const aiProviderLabels: Record<AiProvider, string> = { openai: "ChatGPT", gemini: "Gemini" };

type AiProviderFailure = { provider: AiProvider; code: string; message: string; action_url: string | null };

function aiProviderFailure(provider: AiProvider, caught: unknown): AiProviderFailure {
  const raw = (caught instanceof Error ? caught.message : String(caught || "")).toLocaleLowerCase();
  if (provider === "openai" && /no credits remaining|insufficient_quota|billing/.test(raw)) {
    return { provider, code: "NO_CREDITS", message: "رصيد OpenAI API منتهٍ. إضافة مفتاح وحدها لا تكفي؛ لازم يكون في رصيد API فعّال.", action_url: "https://platform.openai.com/settings/organization/billing/" };
  }
  if (provider === "gemini" && /exceeded your current quota|resource_exhausted|quota/.test(raw)) {
    return { provider, code: "QUOTA_EXHAUSTED", message: "حصة Gemini API الحالية منتهية. فعّل الفوترة أو انتظر تجدد الحصة.", action_url: "https://ai.dev/rate-limit" };
  }
  if (/invalid api key|api key not valid|incorrect api key|unauthenticated|authentication|permission denied/.test(raw)) {
    return { provider, code: "INVALID_KEY", message: `مفتاح ${aiProviderLabels[provider]} مرفوض أو لا يملك الصلاحية المطلوبة.`, action_url: null };
  }
  if (/rate limit|too many requests|429/.test(raw)) {
    return { provider, code: "RATE_LIMITED", message: `${aiProviderLabels[provider]} وصل إلى حد الطلبات المؤقت.`, action_url: null };
  }
  if (/model.*not found|not found.*model|unsupported model/.test(raw)) {
    return { provider, code: "MODEL_UNAVAILABLE", message: `النموذج المحدد غير متاح لهذا الحساب على ${aiProviderLabels[provider]}.`, action_url: null };
  }
  return { provider, code: "PROVIDER_UNAVAILABLE", message: `تعذر الوصول إلى ${aiProviderLabels[provider]} حالياً.`, action_url: null };
}

async function setAiProviderHealth(env: Env, organizationId: string, failure: AiProviderFailure | null) {
  void organizationId;
  const provider = failure?.provider;
  if (!provider) return;
  try {
    const row = await env.DB.prepare("SELECT i.id,i.metadata FROM ai_integrations i JOIN ai_organizations o ON o.id=i.organization_id JOIN ai_users u ON u.id=o.owner_id WHERE LOWER(u.email)=? AND i.provider=? ORDER BY i.updated_at DESC LIMIT 1")
      .bind(developerAccountEmail, provider).first<Row>();
    if (!row?.id) return;
    const metadata = chatMetadata(row.metadata);
    metadata.health = failure.code === "READY"
      ? { state: "ready", code: "READY", message: "جاهز", checked_at: now() }
      : { state: "blocked", code: failure.code, message: failure.message, action_url: failure.action_url, checked_at: now() };
    await env.DB.prepare("UPDATE ai_integrations SET metadata=?,updated_at=? WHERE id=?").bind(JSON.stringify(metadata), now(), row.id).run();
  } catch (caught) {
    console.error("VAREX AI health persistence failed", provider, caught instanceof Error ? caught.message : caught);
  }
}

function readyProviderHealth(provider: AiProvider): AiProviderFailure {
  return { provider, code: "READY", message: "جاهز", action_url: null };
}

async function platformAiProviderKey(env: Env, provider: AiProvider) {
  const environmentKey = String(provider === "openai" ? env.OPENAI_API_KEY || "" : env.GEMINI_API_KEY || "").trim();
  if (environmentKey) return { key: environmentKey, source: "environment" as const, health: null };
  const row = await env.DB.prepare("SELECT i.status,i.metadata FROM ai_integrations i JOIN ai_organizations o ON o.id=i.organization_id JOIN ai_users u ON u.id=o.owner_id WHERE LOWER(u.email)=? AND i.provider=? ORDER BY i.updated_at DESC LIMIT 1")
    .bind(developerAccountEmail, provider).first<Row>();
  if (row?.status === "connected") {
    const metadata = chatMetadata(row.metadata);
    const encrypted = metadata.credential && typeof metadata.credential === "object" ? metadata.credential as Row : null;
    if (encrypted) {
      const credentials = await decryptIntegrationCredentials(env, encrypted);
      const key = String(credentials.api_key || "").trim();
      if (key) return { key, source: "platform" as const, health: metadata.health && typeof metadata.health === "object" ? metadata.health as Row : null };
    }
  }
  return null;
}

async function aiProviderStatuses(env: Env, organizationId: string) {
  void organizationId;
  const statuses = await Promise.all((["openai", "gemini"] as AiProvider[]).map(async provider => {
    try {
      const credential = await platformAiProviderKey(env, provider);
      return {
        provider,
        label: aiProviderLabels[provider],
        configured: Boolean(credential?.key),
        ready: Boolean(credential?.key) && String(credential?.health?.state || "ready") === "ready",
        health: credential?.health || null,
        source: credential?.source || null,
        model: aiProviderModels[provider],
        voice: provider === "gemini" ? { model: GEMINI_TTS_MODEL, default_voice: "Sulafat" } : null,
      };
    } catch (_) {
      return { provider, label: aiProviderLabels[provider], configured: false, ready: false, health: null, source: null, model: aiProviderModels[provider], voice: null };
    }
  }));
  return statuses;
}

async function aiProviderConfiguration(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الإعدادات متاحة لإدارة VAREX فقط", 403);
  if (request.method === "GET") {
    const organizationId = String(new URL(request.url).searchParams.get("organization_id") || "").trim();
    if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
    return api({ ok: true, providers: await aiProviderStatuses(env, organizationId) });
  }
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim();
  const provider = String(body.provider || "").trim() as AiProvider;
  const apiKey = String(body.api_key || "").trim();
  if (!organizationId || !aiProviders.has(provider)) return error("حدد مساحة العمل ومزود الذكاء", 400);
  if (!await authorizeOrg(env, user, organizationId, true)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  if (apiKey.length < 20 || apiKey.length > 500) return error("مفتاح المزود غير صالح", 400);
  try {
    await verifyAiProviderCredential(provider, apiKey);
  } catch (caught) {
    const failure = aiProviderFailure(provider, caught);
    return api({ code: failure.code, message: failure.message, action_url: failure.action_url }, 422);
  }
  const encrypted = await encryptIntegrationCredentials(env, { api_key: apiKey });
  const stamp = now(), existing = await env.DB.prepare("SELECT id FROM ai_integrations WHERE organization_id=? AND provider=? LIMIT 1").bind(organizationId, provider).first<Row>();
  const metadata = JSON.stringify({ credential: encrypted, model: aiProviderModels[provider], configured_by_customer: true, configured_at: stamp, health: { state: "ready", code: "READY", message: "جاهز", checked_at: stamp } });
  const account = `${aiProviderLabels[provider]} ••••${apiKey.slice(-4)}`;
  if (existing?.id) {
    await env.DB.prepare("UPDATE ai_integrations SET status='connected',connected_account=?,last_sync_at=?,metadata=?,updated_at=? WHERE id=?")
      .bind(account, stamp, metadata, stamp, existing.id).run();
  } else {
    await env.DB.prepare("INSERT INTO ai_integrations (id,organization_id,provider,status,connected_account,last_sync_at,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, provider, "connected", account, stamp, metadata, stamp, stamp).run();
  }
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "ai_provider_connected", "integration", provider, JSON.stringify({ provider, model: aiProviderModels[provider] }), stamp, stamp).run();
  return api({ ok: true, provider, configured: true, model: aiProviderModels[provider] });
}

type VoiceGatewayConfig = {
  accountId: string;
  authSecret: string;
  projectId: string;
  webhookSecret: string;
};

function phoneE164(value: unknown) {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
}

async function storedVoiceGatewayConfig(env: Env): Promise<VoiceGatewayConfig> {
  const empty = { accountId: "", authSecret: "", projectId: "", webhookSecret: "" };
  const row = await env.DB.prepare("SELECT value FROM ai_system_secrets WHERE key='voice_gateway_credentials_encrypted' LIMIT 1").first<Row>();
  if (!row?.value) return empty;
  try {
    const encrypted = JSON.parse(String(row.value)) as Row;
    const value = await decryptIntegrationCredentials(env, encrypted);
    return {
      accountId: String(value.account_id || "").trim(),
      authSecret: String(value.auth_secret || "").trim(),
      projectId: String(value.openai_project_id || "").trim(),
      webhookSecret: String(value.openai_webhook_secret || "").trim(),
    };
  } catch (caught) {
    console.error("VAREX voice gateway decryption failed", caught instanceof Error ? caught.message : caught);
    return empty;
  }
}

async function voiceGatewayConfig(env: Env): Promise<VoiceGatewayConfig> {
  const stored = await storedVoiceGatewayConfig(env);
  return {
    accountId: String(env.VOICE_GATEWAY_ACCOUNT_ID || stored.accountId || "").trim(),
    authSecret: String(env.VOICE_GATEWAY_AUTH_SECRET || stored.authSecret || "").trim(),
    projectId: String(env.OPENAI_PROJECT_ID || stored.projectId || "").trim(),
    webhookSecret: String(env.OPENAI_WEBHOOK_SECRET || stored.webhookSecret || "").trim(),
  };
}

async function voiceGatewayRequest(config: VoiceGatewayConfig, path: string, options: { method?: "GET" | "POST"; form?: Record<string, string>; query?: Record<string, string> } = {}) {
  const url = new URL(path === "__account__"
    ? `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountId)}.json`
    : `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountId)}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${btoa(`${config.accountId}:${config.authSecret}`)}`,
      ...(options.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(options.form ? { body: new URLSearchParams(options.form).toString() } : {}),
  });
  const payload = await response.json<Row>().catch(() => ({}));
  if (!response.ok) {
    console.error("VAREX voice gateway request failed", response.status, String(payload.code || ""), String(payload.message || ""));
    throw new AgentActionError("VOICE_GATEWAY_REQUEST_FAILED", "تعذر تنفيذ الطلب عبر سنترال المكالمات. تحقق من بيانات السنترال وصلاحية الاتصال الدولي.", 502);
  }
  return payload;
}

async function voiceReadinessSnapshot(env: Env, organizationId: string, agentId: string) {
  const [config, voice, linkedWhatsApp] = await Promise.all([
    voiceGatewayConfig(env),
    env.DB.prepare("SELECT * FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>(),
    env.DB.prepare("SELECT connected_account FROM ai_integrations WHERE organization_id=? AND provider='whatsapp' AND status='connected' LIMIT 1").bind(organizationId).first<Row>(),
  ]);
  let openaiConfigured = false;
  try { openaiConfigured = Boolean((await platformAiProviderKey(env, "openai"))?.key); } catch (_) { openaiConfigured = false; }
  const callerVerified = voice?.status === "connected" && Boolean(voice?.caller_id);
  const gatewayConfigured = Boolean(config.accountId && config.authSecret);
  const sipConfigured = Boolean(config.projectId && config.webhookSecret);
  return {
    gateway_configured: gatewayConfigured,
    openai_configured: openaiConfigured,
    sip_configured: sipConfigured,
    caller_verified: callerVerified,
    ready: gatewayConfigured && openaiConfigured && sipConfigured && callerVerified,
    caller_id: voice?.caller_id || null,
    caller_status: voice?.status || "not_connected",
    linked_phone: phoneE164(linkedWhatsApp?.connected_account || "") || null,
    webhook_url: `${String(env.APP_BASE_URL || "").replace(/\/$/, "")}/api/webhooks/openai/voice`,
  };
}

async function voiceGatewayAdmin(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الإعدادات متاحة لإدارة VAREX فقط", 403);
  if (request.method === "GET") {
    const config = await voiceGatewayConfig(env);
    let openaiConfigured = false;
    try { openaiConfigured = Boolean((await platformAiProviderKey(env, "openai"))?.key); } catch (_) { openaiConfigured = false; }
    return api({
      configured: Boolean(config.accountId && config.authSecret),
      sip_configured: Boolean(config.projectId && config.webhookSecret),
      openai_configured: openaiConfigured,
      account_hint: config.accountId ? `••••${config.accountId.slice(-4)}` : null,
      project_hint: config.projectId ? `••••${config.projectId.slice(-6)}` : null,
      webhook_url: `${appOrigin(request, env)}/api/webhooks/openai/voice`,
    });
  }
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const body = await request.json<Row>().catch(() => ({}));
  const accountId = String(body.account_id || "").trim();
  const authSecret = String(body.auth_secret || "").trim();
  const projectId = String(body.openai_project_id || "").trim();
  const webhookSecret = String(body.openai_webhook_secret || "").trim();
  if (!/^AC[a-zA-Z0-9]{30,40}$/.test(accountId)) return error("معرّف السنترال غير صالح");
  if (authSecret.length < 20 || authSecret.length > 200 || /\s/.test(authSecret)) return error("مفتاح السنترال غير صالح");
  if (!/^proj_[a-zA-Z0-9_-]{6,}$/.test(projectId)) return error("معرّف مشروع الذكاء غير صالح");
  if (!/^whsec_[a-zA-Z0-9_+/=-]{12,}$/.test(webhookSecret)) return error("مفتاح توقيع المكالمات غير صالح");
  const config = { accountId, authSecret, projectId, webhookSecret };
  try { await voiceGatewayRequest(config, "__account__"); }
  catch (_) { return error("بيانات السنترال مرفوضة أو الحساب غير مفعّل للمكالمات", 422); }
  const encrypted = await encryptIntegrationCredentials(env, { account_id: accountId, auth_secret: authSecret, openai_project_id: projectId, openai_webhook_secret: webhookSecret });
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_system_secrets (key,value,created_at,updated_at) VALUES ('voice_gateway_credentials_encrypted',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(JSON.stringify(encrypted), stamp, stamp).run();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) SELECT ?,id,?,'voice_gateway_configured','system','voice_gateway',?, ?, ? FROM ai_organizations WHERE owner_id=? LIMIT 1")
    .bind(crypto.randomUUID(), user.id, JSON.stringify({ account_hint: accountId.slice(-4), project_hint: projectId.slice(-6) }), stamp, stamp, user.id).run();
  return api({ ok: true, configured: true, sip_configured: true, account_hint: `••••${accountId.slice(-4)}`, project_hint: `••••${projectId.slice(-6)}`, webhook_url: `${appOrigin(request, env)}/api/webhooks/openai/voice` });
}

async function voiceReadiness(request: Request, env: Env) {
  if (request.method !== "GET") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), organizationId = String(url.searchParams.get("organization_id") || ""), agentId = String(url.searchParams.get("agent_id") || "");
  if (!organizationId || !agentId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  return api(await voiceReadinessSnapshot(env, organizationId, agentId));
}

async function upsertVoiceCallerStatus(env: Env, user: Row, organizationId: string, agentId: string, phone: string, status: "verification_pending" | "connected" | "not_connected", extra: Row = {}) {
  const current = await env.DB.prepare("SELECT * FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>();
  let settings: Row = { daily_call_limit: 10, max_call_minutes: 10, allowed_from: "09:00", allowed_to: "18:00" };
  try { settings = { ...settings, ...JSON.parse(String(current?.settings || "{}")) as Row, ...extra }; } catch (_) { settings = { ...settings, ...extra }; }
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_voice_settings (id,organization_id,agent_id,provider,status,caller_id,voice_id,disclosure_text,settings,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,agent_id) DO UPDATE SET provider=excluded.provider,status=excluded.status,caller_id=excluded.caller_id,settings=excluded.settings,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
    .bind(crypto.randomUUID(), organizationId, agentId, status === "not_connected" ? "not_configured" : "sip_gateway", status, phone || null, String(current?.voice_id || "Sulafat"), String(current?.disclosure_text || "مرحباً، أنا المساعد الذكي وأتصل نيابة عن صاحب الحساب."), JSON.stringify(settings), user.id, stamp, stamp).run();
}

async function verifiedOutgoingCaller(config: VoiceGatewayConfig, phone: string) {
  const list = await voiceGatewayRequest(config, "OutgoingCallerIds.json", { query: { PhoneNumber: phone, PageSize: "20" } });
  const callers = Array.isArray(list.outgoing_caller_ids) ? list.outgoing_caller_ids as Row[] : [];
  return callers.find(item => phoneE164(item.phone_number) === phone) || null;
}

async function voiceNumberVerification(request: Request, env: Env, action: "select" | "start" | "status" | "disconnect") {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), agentId = String(body.agent_id || "");
  if (!organizationId || !agentId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع ربط رقم المكالمات", 403);
  const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const existing = await env.DB.prepare("SELECT caller_id,settings FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>();
  if (action === "disconnect") {
    await upsertVoiceCallerStatus(env, user, organizationId, agentId, "", "not_connected", { disconnected_at: now() });
    return api({ ok: true, status: "not_connected", message: "تم فصل رقم المكالمات عن هذا الموظف" });
  }
  const phone = phoneE164(body.phone || existing?.caller_id || "");
  if (!phone) return error("أدخل الرقم الأساسي بصيغة دولية مثل +971...", 400);
  if (action === "select") {
    await upsertVoiceCallerStatus(env, user, organizationId, agentId, phone, "not_connected", { selected_at: now() });
    return api({ ok: true, status: "not_connected", caller_id: phone, message: "تم اختيار رقمك المرتبط وحفظه. بقي توثيقه باتصال واحد." });
  }
  const config = await voiceGatewayConfig(env);
  if (!config.accountId || !config.authSecret) return error("سنترال المكالمات غير مربوط بعد. يلزم أن تضيف إدارة VAREX بيانات السنترال أولاً.", 409);
  const alreadyVerified = await verifiedOutgoingCaller(config, phone);
  if (alreadyVerified) {
    await upsertVoiceCallerStatus(env, user, organizationId, agentId, phone, "connected", { verified_caller_id: alreadyVerified.sid, verified_at: now(), verification_requested_at: null });
    return api({ ok: true, status: "connected", caller_id: phone, message: "تم توثيق الرقم وربطه بالمكالمات الذكية" });
  }
  if (action === "status") return api({ ok: true, status: "verification_pending", caller_id: phone, message: "لم يكتمل إدخال رمز التحقق على المكالمة بعد" }, 202);
  const validation = await voiceGatewayRequest(config, "OutgoingCallerIds.json", { method: "POST", form: { PhoneNumber: phone, FriendlyName: "VAREX primary number", CallDelay: "1" } });
  const validationCode = String(validation.validation_code || "");
  if (!/^\d{6}$/.test(validationCode)) return error("بدأ طلب التحقق لكن لم يصل رمز صالح؛ أعد المحاولة", 502);
  await upsertVoiceCallerStatus(env, user, organizationId, agentId, phone, "verification_pending", { verification_requested_at: now(), verification_call_id: validation.call_sid || null });
  return api({ ok: true, status: "verification_pending", caller_id: phone, validation_code: validationCode, message: "سيصل اتصال تحقق إلى رقمك. أدخل هذا الرمز عندما يُطلب منك." }, 202);
}
async function passwordHash(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(value => Number.parseInt(value, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256));
}
function validPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && (password.match(/\d/g) || []).length >= 6;
}
function passwordRuleError() { return "كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير وحرف صغير و6 أرقام على الأقل"; }
function otpCode() {
  const ceiling = Math.floor(0x100000000 / 1000000) * 1000000;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= ceiling);
  return String(values[0] % 1000000).padStart(6, "0");
}

type LocaleCode = "ar" | "en" | "ur" | "fa" | "zh" | "ko" | "it" | "es" | "he" | "fr" | "ru" | "tr";
const defaultLocale: LocaleCode = "ar";
const rtlLocales = new Set<LocaleCode>(["ar", "ur", "fa", "he"]);
const otpCopy: Record<LocaleCode, { signupSubject: string; resetSubject: string; signupTitle: string; resetTitle: string; signupIntro: string; resetIntro: string; expires: string; security: string; label: string }> = {
  ar: { signupSubject: "رمز تأكيد حساب VAREX AI", resetSubject: "رمز استعادة كلمة مرور VAREX AI", signupTitle: "تأكيد البريد الإلكتروني", resetTitle: "استعادة كلمة المرور", signupIntro: "استخدم هذا الرمز لإكمال إنشاء حسابك في VAREX AI.", resetIntro: "استخدم هذا الرمز لإنشاء كلمة مرور جديدة لحسابك.", expires: "الرمز صالح لمدة 10 دقائق.", security: "لا تشارك هذا الرمز مع أي شخص.", label: "رمز التحقق" },
  en: { signupSubject: "Your VAREX AI verification code", resetSubject: "Your VAREX AI password reset code", signupTitle: "Verify your email", resetTitle: "Reset your password", signupIntro: "Use this code to finish creating your VAREX AI account.", resetIntro: "Use this code to create a new password for your account.", expires: "This code is valid for 10 minutes.", security: "Do not share this code with anyone.", label: "Verification code" },
  ur: { signupSubject: "VAREX AI اکاؤنٹ کی تصدیق کا کوڈ", resetSubject: "VAREX AI پاس ورڈ بحالی کا کوڈ", signupTitle: "ای میل کی تصدیق", resetTitle: "پاس ورڈ بحال کریں", signupIntro: "اپنا VAREX AI اکاؤنٹ مکمل کرنے کے لیے یہ کوڈ استعمال کریں۔", resetIntro: "اپنے اکاؤنٹ کے لیے نیا پاس ورڈ بنانے کو یہ کوڈ استعمال کریں۔", expires: "یہ کوڈ 10 منٹ تک کارآمد ہے۔", security: "یہ کوڈ کسی کے ساتھ شیئر نہ کریں۔", label: "تصدیقی کوڈ" },
  fa: { signupSubject: "کد تأیید حساب VAREX AI", resetSubject: "کد بازیابی رمز عبور VAREX AI", signupTitle: "تأیید ایمیل", resetTitle: "بازیابی رمز عبور", signupIntro: "برای تکمیل ساخت حساب VAREX AI از این کد استفاده کنید.", resetIntro: "برای ساخت رمز عبور جدید حساب از این کد استفاده کنید.", expires: "این کد ۱۰ دقیقه اعتبار دارد.", security: "این کد را با هیچ‌کس به اشتراک نگذارید.", label: "کد تأیید" },
  zh: { signupSubject: "VAREX AI 账户验证码", resetSubject: "VAREX AI 密码重置验证码", signupTitle: "验证电子邮箱", resetTitle: "重置密码", signupIntro: "请使用此验证码完成 VAREX AI 账户创建。", resetIntro: "请使用此验证码为账户创建新密码。", expires: "验证码有效期为 10 分钟。", security: "请勿向任何人透露此验证码。", label: "验证码" },
  ko: { signupSubject: "VAREX AI 계정 인증 코드", resetSubject: "VAREX AI 비밀번호 재설정 코드", signupTitle: "이메일 인증", resetTitle: "비밀번호 재설정", signupIntro: "이 코드를 사용하여 VAREX AI 계정 생성을 완료하세요.", resetIntro: "이 코드를 사용하여 계정의 새 비밀번호를 만드세요.", expires: "이 코드는 10분 동안 유효합니다.", security: "이 코드를 다른 사람과 공유하지 마세요.", label: "인증 코드" },
  it: { signupSubject: "Codice di verifica VAREX AI", resetSubject: "Codice di reimpostazione password VAREX AI", signupTitle: "Verifica l’email", resetTitle: "Reimposta la password", signupIntro: "Usa questo codice per completare la creazione del tuo account VAREX AI.", resetIntro: "Usa questo codice per creare una nuova password per il tuo account.", expires: "Il codice è valido per 10 minuti.", security: "Non condividere questo codice con nessuno.", label: "Codice di verifica" },
  es: { signupSubject: "Código de verificación de VAREX AI", resetSubject: "Código para restablecer la contraseña de VAREX AI", signupTitle: "Verifica tu correo", resetTitle: "Restablece tu contraseña", signupIntro: "Usa este código para completar la creación de tu cuenta de VAREX AI.", resetIntro: "Usa este código para crear una nueva contraseña para tu cuenta.", expires: "El código es válido durante 10 minutos.", security: "No compartas este código con nadie.", label: "Código de verificación" },
  he: { signupSubject: "קוד אימות לחשבון VAREX AI", resetSubject: "קוד איפוס סיסמה של VAREX AI", signupTitle: "אימות כתובת האימייל", resetTitle: "איפוס סיסמה", signupIntro: "יש להשתמש בקוד זה כדי להשלים את יצירת חשבון VAREX AI.", resetIntro: "יש להשתמש בקוד זה כדי ליצור סיסמה חדשה לחשבון.", expires: "הקוד תקף למשך 10 דקות.", security: "אין לשתף קוד זה עם אף אדם.", label: "קוד אימות" },
  fr: { signupSubject: "Code de vérification VAREX AI", resetSubject: "Code de réinitialisation VAREX AI", signupTitle: "Vérifiez votre e-mail", resetTitle: "Réinitialisez votre mot de passe", signupIntro: "Utilisez ce code pour terminer la création de votre compte VAREX AI.", resetIntro: "Utilisez ce code pour créer un nouveau mot de passe pour votre compte.", expires: "Ce code est valable pendant 10 minutes.", security: "Ne partagez ce code avec personne.", label: "Code de vérification" },
  ru: { signupSubject: "Код подтверждения VAREX AI", resetSubject: "Код сброса пароля VAREX AI", signupTitle: "Подтвердите электронную почту", resetTitle: "Сбросьте пароль", signupIntro: "Используйте этот код, чтобы завершить создание аккаунта VAREX AI.", resetIntro: "Используйте этот код, чтобы создать новый пароль для аккаунта.", expires: "Код действителен 10 минут.", security: "Никому не сообщайте этот код.", label: "Код подтверждения" },
  tr: { signupSubject: "VAREX AI doğrulama kodu", resetSubject: "VAREX AI parola sıfırlama kodu", signupTitle: "E-postanızı doğrulayın", resetTitle: "Parolanızı sıfırlayın", signupIntro: "VAREX AI hesabınızı oluşturmayı tamamlamak için bu kodu kullanın.", resetIntro: "Hesabınız için yeni bir parola oluşturmak üzere bu kodu kullanın.", expires: "Bu kod 10 dakika geçerlidir.", security: "Bu kodu hiç kimseyle paylaşmayın.", label: "Doğrulama kodu" },
};
const emailThemes: Record<string, { primary: string; accent: string; soft: string; ink: string }> = {
  navy: { primary: "#091433", accent: "#3157ed", soft: "#eef2ff", ink: "#17213c" },
  emerald: { primary: "#064e3b", accent: "#10b981", soft: "#ecfdf5", ink: "#123d32" },
  cyan: { primary: "#164e63", accent: "#06b6d4", soft: "#ecfeff", ink: "#16444f" },
  mauve: { primary: "#5b315e", accent: "#a855a5", soft: "#fdf4ff", ink: "#45294a" },
  terracotta: { primary: "#7c2d12", accent: "#c65d3b", soft: "#fff7ed", ink: "#5d2e20" },
  "burnt-orange": { primary: "#7c3a06", accent: "#d97706", soft: "#fff7ed", ink: "#5c3213" },
  red: { primary: "#7f1d1d", accent: "#dc2626", soft: "#fef2f2", ink: "#5f2424" },
  "royal-blue": { primary: "#172554", accent: "#2563eb", soft: "#eff6ff", ink: "#1e315f" },
  indigo: { primary: "#312e81", accent: "#6366f1", soft: "#eef2ff", ink: "#2f315d" },
  coffee: { primary: "#4a2c20", accent: "#9a6a45", soft: "#faf5f0", ink: "#3d2b24" },
  graphite: { primary: "#27272a", accent: "#71717a", soft: "#f4f4f5", ink: "#27272a" },
  "steel-blue": { primary: "#263f55", accent: "#527a9b", soft: "#f0f6fa", ink: "#243d50" },
  plum: { primary: "#581c4f", accent: "#a21caf", soft: "#fdf4ff", ink: "#4d2347" },
  gray: { primary: "#374151", accent: "#6b7280", soft: "#f3f4f6", ink: "#27313f" },
  fuchsia: { primary: "#701a75", accent: "#d946ef", soft: "#fdf4ff", ink: "#59205d" },
  coral: { primary: "#7f2d2d", accent: "#f9736d", soft: "#fff1f2", ink: "#5f2d32" },
};
function localeCode(value: unknown): LocaleCode { const code = String(value || "").trim().toLowerCase() as LocaleCode; return code in otpCopy ? code : defaultLocale; }
function themeCode(value: unknown) { const code = String(value || "").trim().toLowerCase(); return emailThemes[code] ? code : "navy"; }
async function resendApiKey(env: Env) {
  if (env.RESEND_API_KEY) return env.RESEND_API_KEY;
  const row = await env.DB.prepare("SELECT value FROM ai_system_secrets WHERE key='resend_api_key' LIMIT 1").first<Row>();
  return row?.value ? String(row.value) : "";
}
async function sendOtpEmail(env: Env, email: string, code: string, purpose: "signup" | "reset", localeValue: unknown, themeValue: unknown) {
  const apiKey = await resendApiKey(env);
  if (!apiKey) throw new Error("OTP_EMAIL_NOT_CONFIGURED");
  const locale = localeCode(localeValue), copy = otpCopy[locale], theme = emailThemes[themeCode(themeValue)];
  const direction = rtlLocales.has(locale) ? "rtl" : "ltr";
  const subject = purpose === "signup" ? copy.signupSubject : copy.resetSubject;
  const title = purpose === "signup" ? copy.signupTitle : copy.resetTitle;
  const intro = purpose === "signup" ? copy.signupIntro : copy.resetIntro;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM || "VAREX AI <no-reply@varexapp.com>",
      to: [email],
      subject,
      html: `<!doctype html><html lang="${locale}" dir="${direction}"><body style="margin:0;background:${theme.soft};font-family:Arial,Tahoma,sans-serif;color:${theme.ink}"><div style="max-width:560px;margin:28px auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid rgba(23,33,60,.1)"><div style="background:${theme.primary};color:#ffffff;padding:22px 28px;border-bottom:5px solid ${theme.accent}"><div style="font-size:24px;font-weight:900;letter-spacing:2px">VAREX AI</div></div><div style="padding:30px"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.8;margin:0 0 22px">${intro}</p><div style="font-size:12px;color:#6b7280;margin-bottom:8px">${copy.label}</div><div dir="ltr" style="font-size:36px;font-weight:900;letter-spacing:9px;background:${theme.soft};color:${theme.primary};padding:20px;text-align:center;border-radius:16px;border:1px solid ${theme.accent}">${code}</div><p style="font-size:13px;line-height:1.8;color:#6b7280;margin:22px 0 0">${copy.expires}<br>${copy.security}</p></div></div></body></html>`,
    }),
  });
  if (!response.ok) {
    console.error("VAREX AI OTP delivery failed", response.status, await response.text());
    throw new Error("OTP_EMAIL_DELIVERY_FAILED");
  }
}
async function createOtp(env: Env, email: string, purpose: "signup" | "reset", payload: Row | null, locale: unknown, theme: unknown) {
  if (!await resendApiKey(env)) throw new Error("OTP_EMAIL_NOT_CONFIGURED");
  const stamp = now();
  const latest = await env.DB.prepare("SELECT created_at FROM ai_auth_otps WHERE email=? AND purpose=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email, purpose).first<Row>();
  if (latest && Date.now() - new Date(String(latest.created_at)).getTime() < 60000) return { wait: true };
  await env.DB.prepare("DELETE FROM ai_auth_otps WHERE expires_at<? OR (email=? AND purpose=? AND consumed_at IS NULL)").bind(stamp, email, purpose).run();
  const code = otpCode(), id = crypto.randomUUID(), expiresAt = new Date(Date.now() + 600000).toISOString();
  await env.DB.prepare("INSERT INTO ai_auth_otps (id,email,purpose,code_hash,payload,attempts,expires_at,created_at) VALUES (?,?,?,?,?,0,?,?)")
    .bind(id, email, purpose, await sha256(`${email}:${purpose}:${code}`), payload ? JSON.stringify(payload) : null, expiresAt, stamp).run();
  try { await sendOtpEmail(env, email, code, purpose, locale, theme); }
  catch (caught) { await env.DB.prepare("DELETE FROM ai_auth_otps WHERE id=?").bind(id).run(); throw caught; }
  return { wait: false };
}
async function consumeOtp(env: Env, email: string, purpose: "signup" | "reset", code: string) {
  const record = await env.DB.prepare("SELECT * FROM ai_auth_otps WHERE email=? AND purpose=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(email, purpose).first<Row>();
  if (!record || String(record.expires_at) <= now()) return { error: "انتهت صلاحية الرمز؛ اطلب رمزاً جديداً" } as const;
  if (Number(record.attempts || 0) >= 5) return { error: "تم تجاوز عدد المحاولات؛ اطلب رمزاً جديداً" } as const;
  const matches = await sha256(`${email}:${purpose}:${code}`) === record.code_hash;
  if (!matches) {
    await env.DB.prepare("UPDATE ai_auth_otps SET attempts=attempts+1 WHERE id=?").bind(record.id).run();
    return { error: "رمز التحقق غير صحيح" } as const;
  }
  await env.DB.prepare("UPDATE ai_auth_otps SET consumed_at=? WHERE id=?").bind(now(), record.id).run();
  return { record } as const;
}
function isDeveloperAccount(user: Row | null | undefined) { return String(user?.email || "").trim().toLowerCase() === developerAccountEmail; }
function publicUser(row: Row) {
  const developer = isDeveloperAccount(row);
  return {
    id: row.id,
    email: row.email,
    account_type: developer ? "developer" : "customer",
    user_metadata: { full_name: row.full_name || "", business_name: row.business_name || "" },
  };
}
async function issueSession(env: Env, user: Row) {
  const accessToken = randomToken(), refreshToken = randomToken(), created = now();
  const accessExpiresAt = new Date(Date.now() + 3600000).toISOString(), refreshExpiresAt = plusDays(30);
  await env.DB.prepare("INSERT INTO ai_sessions (id,user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), user.id, await sha256(accessToken), await sha256(refreshToken), accessExpiresAt, refreshExpiresAt, created).run();
  return { access_token: accessToken, refresh_token: refreshToken, expires_at: Math.floor(new Date(accessExpiresAt).getTime() / 1000), token_type: "bearer", user: publicUser(user) };
}
async function currentUser(request: Request, env: Env): Promise<Row | null> {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!bearer) return null;
  return await env.DB.prepare("SELECT u.* FROM ai_sessions s JOIN ai_users u ON u.id=s.user_id WHERE s.access_token_hash=? AND s.access_expires_at>? LIMIT 1")
    .bind(await sha256(bearer), now()).first<Row>() || null;
}

async function auth(request: Request, env: Env, route: string) {
  const body = await request.json<Row>().catch(() => ({}));
  if (route === "signup") {
    const email = String(body.email || "").trim().toLowerCase(), password = String(body.password || "");
    const locale = localeCode(body.locale), theme = themeCode(body.theme);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("اكتب بريداً إلكترونياً صحيحاً");
    if (!validPassword(password)) return error(passwordRuleError());
    if (await env.DB.prepare("SELECT id FROM ai_users WHERE email=? LIMIT 1").bind(email).first()) return error("هذا البريد مسجّل مسبقاً في VAREX AI", 409);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), stamp = now();
    const data = body.data && typeof body.data === "object" ? body.data as Row : {};
    const pending: Row = { id: crypto.randomUUID(), email, password_hash: await passwordHash(password, salt), password_salt: salt, full_name: String(data.full_name || ""), locale, theme, created_at: stamp };
    try {
      const result = await createOtp(env, email, "signup", pending, locale, theme);
      if (result.wait) return error("تم إرسال رمز قبل قليل؛ انتظر دقيقة ثم حاول مجدداً", 429);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "OTP_EMAIL_NOT_CONFIGURED") return error("إرسال رمز البريد غير مفعّل بعد. تواصل مع إدارة VAREX.", 503);
      return error("تعذر إرسال رمز التحقق إلى البريد. حاول مرة أخرى.", 502);
    }
    return api({ otp_required: true, email, expires_in: 600 }, 202);
  }
  if (route === "verify-email") {
    const email = String(body.email || "").trim().toLowerCase(), code = String(body.code || "").trim();
    if (!/^\d{6}$/.test(code)) return error("أدخل رمز التحقق المكوّن من 6 أرقام");
    const result = await consumeOtp(env, email, "signup", code);
    if ("error" in result) return error(result.error, 400);
    const payload = JSON.parse(String(result.record.payload || "{}")) as Row;
    if (await env.DB.prepare("SELECT id FROM ai_users WHERE email=? LIMIT 1").bind(email).first()) return error("هذا البريد مسجّل مسبقاً في VAREX AI", 409);
    const stamp = now();
    const user: Row = { id: payload.id || crypto.randomUUID(), email, full_name: String(payload.full_name || ""), business_name: "", email_verified: 1 };
    await env.DB.prepare("INSERT INTO ai_users (id,email,password_hash,password_salt,email_verified,full_name,business_name,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?,?)")
      .bind(user.id, email, payload.password_hash, payload.password_salt, user.full_name, "", stamp, stamp).run();
    return api(await issueSession(env, user), 201);
  }
  if (route === "login") {
    const email = String(body.email || "").trim().toLowerCase(), password = String(body.password || "");
    const user = await env.DB.prepare("SELECT * FROM ai_users WHERE email=? LIMIT 1").bind(email).first<Row>();
    if (!user || await passwordHash(password, String(user.password_salt)) !== user.password_hash) return error("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);
    if (!Number(user.email_verified ?? 1)) return error("يلزم تأكيد البريد الإلكتروني قبل تسجيل الدخول", 403);
    return api(await issueSession(env, user));
  }
  if (route === "change-password") {
    const user = await currentUser(request, env);
    if (!user) return error("انتهت الجلسة؛ سجّل الدخول مجدداً", 401);
    const currentPassword = String(body.current_password || ""), newPassword = String(body.new_password || "");
    if (await passwordHash(currentPassword, String(user.password_salt)) !== user.password_hash) return error("كلمة المرور الحالية غير صحيحة", 401);
    if (!validPassword(newPassword)) return error(passwordRuleError());
    if (newPassword === currentPassword) return error("اختر كلمة مرور جديدة مختلفة عن الحالية");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), stamp = now();
    await env.DB.prepare("UPDATE ai_users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?")
      .bind(await passwordHash(newPassword, salt), salt, stamp, user.id).run();
    await env.DB.prepare("DELETE FROM ai_sessions WHERE user_id=?").bind(user.id).run();
    return api({ ok: true, message: "تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة." });
  }
  if (route === "delete-account") {
    const user = await currentUser(request, env);
    if (!user) return error("انتهت الجلسة؛ سجّل الدخول مجدداً", 401);
    if (isDeveloperAccount(user)) return error("حساب المالك محمي ولا يمكن حذفه من داخل التطبيق", 403);
    if (String(body.confirmation || "") !== "DELETE_ACCOUNT") return error("يلزم تأكيد حذف الحساب");
    const currentPassword = String(body.current_password || "");
    if (await passwordHash(currentPassword, String(user.password_salt)) !== user.password_hash) return error("كلمة المرور الحالية غير صحيحة", 401);

    const organizationResult = await env.DB.prepare("SELECT id FROM ai_organizations WHERE owner_id=?").bind(user.id).all<Row>();
    const organizations = organizationResult.results || [];
    if (env.FILES) {
      for (const organization of organizations) {
        const knowledgeResult = await env.DB.prepare("SELECT storage_path FROM ai_knowledge_items WHERE organization_id=? AND storage_path IS NOT NULL")
          .bind(organization.id).all<Row>();
        for (const item of knowledgeResult.results || []) if (item.storage_path) await env.FILES.delete(String(item.storage_path));
      }
    }

    const statements: D1PreparedStatement[] = [];
    for (const organization of organizations) {
      const organizationId = String(organization.id);
      for (const table of ["ai_approvals", "ai_chat_messages", "ai_voice_calls", "ai_action_executions", "ai_agent_permissions", "ai_voice_settings", "ai_device_connections", "ai_audit_logs", "ai_integrations", "ai_knowledge_items", "ai_leads", "ai_messages", "ai_oauth_states", "ai_payments", "ai_subscriptions", "ai_tasks", "ai_agents", "ai_members"]) {
        statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE organization_id=?`).bind(organizationId));
      }
      statements.push(env.DB.prepare("DELETE FROM ai_activation_codes WHERE redeemed_organization_id=?").bind(organizationId));
    }
    statements.push(env.DB.prepare("DELETE FROM ai_members WHERE user_id=?").bind(user.id));
    statements.push(env.DB.prepare("DELETE FROM ai_oauth_states WHERE user_id=?").bind(user.id));
    statements.push(env.DB.prepare("DELETE FROM ai_activation_codes WHERE created_by=? OR redeemed_by=?").bind(user.id, user.id));
    statements.push(env.DB.prepare("DELETE FROM ai_sessions WHERE user_id=?").bind(user.id));
    statements.push(env.DB.prepare("DELETE FROM ai_auth_otps WHERE email=?").bind(user.email));
    statements.push(env.DB.prepare("DELETE FROM ai_organizations WHERE owner_id=?").bind(user.id));
    statements.push(env.DB.prepare("DELETE FROM ai_users WHERE id=?").bind(user.id));
    await env.DB.batch(statements);
    return api({ deleted: true, message: "تم حذف الحساب وبياناته نهائياً" });
  }
  if (route === "forgot-password") {
    const email = String(body.email || "").trim().toLowerCase();
    const locale = localeCode(body.locale), theme = themeCode(body.theme);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("اكتب بريداً إلكترونياً صحيحاً");
    if (!await resendApiKey(env)) return error("استعادة كلمة المرور عبر البريد غير مفعّلة بعد. تواصل مع إدارة VAREX.", 503);
    const user = await env.DB.prepare("SELECT id FROM ai_users WHERE email=? LIMIT 1").bind(email).first<Row>();
    if (user) {
      try {
        const result = await createOtp(env, email, "reset", { user_id: user.id, locale, theme }, locale, theme);
        if (result.wait) return error("تم إرسال رمز قبل قليل؛ انتظر دقيقة ثم حاول مجدداً", 429);
      } catch (_) { return error("تعذر إرسال رمز الاستعادة إلى البريد. حاول مرة أخرى.", 502); }
    }
    return api({ ok: true, message: "إذا كان البريد مسجلاً فسيصلك رمز الاستعادة خلال دقائق" });
  }
  if (route === "reset-password") {
    const email = String(body.email || "").trim().toLowerCase(), code = String(body.code || "").trim(), password = String(body.password || "");
    if (!validPassword(password)) return error(passwordRuleError());
    if (!/^\d{6}$/.test(code)) return error("أدخل رمز التحقق المكوّن من 6 أرقام");
    const result = await consumeOtp(env, email, "reset", code);
    if ("error" in result) return error(result.error, 400);
    const payload = JSON.parse(String(result.record.payload || "{}")) as Row;
    const user = await env.DB.prepare("SELECT id FROM ai_users WHERE id=? AND email=? LIMIT 1").bind(payload.user_id, email).first<Row>();
    if (!user) return error("تعذر استعادة هذا الحساب", 404);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), stamp = now();
    await env.DB.prepare("UPDATE ai_users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?")
      .bind(await passwordHash(password, salt), salt, stamp, user.id).run();
    await env.DB.prepare("DELETE FROM ai_sessions WHERE user_id=?").bind(user.id).run();
    return api({ ok: true, message: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." });
  }
  if (route === "refresh") {
    const record = await env.DB.prepare("SELECT s.id AS session_id,u.* FROM ai_sessions s JOIN ai_users u ON u.id=s.user_id WHERE s.refresh_token_hash=? AND s.refresh_expires_at>? LIMIT 1")
      .bind(await sha256(String(body.refresh_token || "")), now()).first<Row>();
    if (!record) return error("انتهت الجلسة؛ سجّل الدخول مجدداً", 401);
    await env.DB.prepare("DELETE FROM ai_sessions WHERE id=?").bind(record.session_id).run(); return api(await issueSession(env, record));
  }
  if (route === "logout") {
    const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) await env.DB.prepare("DELETE FROM ai_sessions WHERE access_token_hash=?").bind(await sha256(bearer)).run(); return api({ ok: true });
  }
  return error("المسار غير موجود", 404);
}

async function memberRole(env: Env, userId: string, orgId: string) { const row = await env.DB.prepare("SELECT role FROM ai_members WHERE user_id=? AND organization_id=? LIMIT 1").bind(userId, orgId).first<Row>(); return row?.role ? String(row.role) : null; }
function decodeValue(value: string) { return decodeURIComponent(value.replace(/^eq\./, "")); }
function storedValue(column: string, value: unknown) { if (jsonColumns.has(column)) return JSON.stringify(value ?? (column === "channels" ? [] : {})); if (booleanColumns.has(column)) return value ? 1 : 0; return value === undefined ? null : value; }
function hydrate(row: Row) { for (const column of jsonColumns) if (typeof row[column] === "string") try { row[column] = JSON.parse(row[column] as string); } catch { row[column] = column === "channels" ? [] : {}; } for (const column of booleanColumns) if (column in row) row[column] = Boolean(row[column]); return row; }
function presentRow(table: string, row: Row) {
  const hydrated = hydrate(row);
  if (table === "ai_integrations" && hydrated.metadata && typeof hydrated.metadata === "object") {
    const metadata = { ...(hydrated.metadata as Row) };
    const hasCredential = Boolean(metadata.credential);
    delete metadata.credential;
    hydrated.metadata = { ...metadata, credentials_stored: hasCredential };
  }
  return hydrated;
}
async function activePaidSubscription(env: Env, orgId: string) {
  return await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE organization_id=? AND status='active' AND plan_code IN ('gift','solo','team3','team5','team10','unlimited') AND (renews_at IS NULL OR renews_at>?) ORDER BY created_at DESC LIMIT 1")
    .bind(orgId, now()).first<Row>() || null;
}
async function hasSubscriptionAccess(env: Env, user: Row, orgId: string) {
  return isDeveloperAccount(user) || Boolean(await activePaidSubscription(env, orgId));
}
function subscriptionRequired() {
  return api({ code: "SUBSCRIPTION_REQUIRED", message: "يلزم اشتراك فعّال أو كود تفعيل مجاني لاستخدام النظام" }, 402);
}
async function authorizeOrg(env: Env, user: Row, orgId: string, admin = false, allowInactive = false) {
  const role = await memberRole(env, String(user.id), orgId);
  if (!role || (admin && role !== "owner" && role !== "admin")) return false;
  return allowInactive || await hasSubscriptionAccess(env, user, orgId);
}

function integrationReturnUrl(request: Request, env: Env, params: Record<string, string>) {
  const url = new URL("/", appOrigin(request, env));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.hash = "integrations";
  return url.toString();
}

function integrationPopupResponse(request: Request, env: Env, params: Record<string, string>) {
  const fallback = integrationReturnUrl(request, env, params);
  const origin = appOrigin(request, env);
  const payload = JSON.stringify({ type: "VAREX_INTEGRATION_CALLBACK", ...params }).replaceAll("<", "\\u003c");
  const targetOrigin = JSON.stringify(origin).replaceAll("<", "\\u003c");
  const fallbackUrl = JSON.stringify(fallback).replaceAll("<", "\\u003c");
  const successful = params.integration === "connected";
  const title = successful ? "تم الربط بنجاح" : params.integration === "action_required" ? "يلزم إكمال إعداد الحساب" : "لم يكتمل الربط";
  const description = successful ? "تم إرسال النتيجة إلى VAREX AI." : "تم إرسال حالة الربط إلى VAREX AI ويمكن إعادة المحاولة من التطبيق.";
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VAREX AI — ${title}</title><style>body{font-family:Arial,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#07102b,#172d70);color:#14204a}.card{width:min(380px,calc(100% - 40px));box-sizing:border-box;background:#fff;border-radius:24px;padding:30px;text-align:center;box-shadow:0 28px 70px rgba(0,0,0,.3)}.mark{width:54px;height:54px;display:grid;place-items:center;margin:0 auto 15px;border-radius:18px;background:${successful ? "#e7faf2" : "#fff4df"};color:${successful ? "#07815a" : "#ad7118"};font-size:26px;font-weight:900}h1{font-size:20px;margin:0 0 8px}p{font-size:13px;line-height:1.8;color:#69748d;margin:0 0 18px}a{display:inline-block;text-decoration:none;background:#3156ec;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:700}</style></head><body><main class="card"><div class="mark">${successful ? "✓" : "!"}</div><h1>${title}</h1><p id="status">${description}<br>ستُغلق هذه النافذة تلقائياً.</p><a id="returnLink" href="${fallback}">العودة إلى VAREX AI</a></main><script>const payload=${payload};const targetOrigin=${targetOrigin};const fallback=${fallbackUrl};try{if(window.opener&&!window.opener.closed)window.opener.postMessage(payload,targetOrigin)}catch(_){}try{const channel=new BroadcastChannel('varex-integration');channel.postMessage(payload);channel.close()}catch(_){}setTimeout(()=>{window.close();setTimeout(()=>window.location.replace(fallback),500)},450);document.getElementById('returnLink').addEventListener('click',event=>{event.preventDefault();window.close();setTimeout(()=>window.location.replace(fallback),300)});</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function responseJson(response: Response) {
  const payload = await response.json<Row>().catch(() => ({}));
  const providerError = payload.error && typeof payload.error === "object" ? payload.error as Row : payload;
  const providerErrorCode = String(payload.error && typeof payload.error === "object" ? (payload.error as Row).code ?? "" : "").trim().toLowerCase();
  const providerReportedFailure = Boolean(payload.error) && !["ok", "0"].includes(providerErrorCode);
  if (!response.ok || providerReportedFailure) {
    console.error("VAREX AI provider request failed", response.status, providerError);
    throw new Error("PROVIDER_REQUEST_FAILED");
  }
  return payload;
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifyMetaWebhookSignature(env: Env, body: string, signature: string | null) {
  const appSecret = await metaAppSecret(env);
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return timingSafeEqual(signature.slice(7).toLowerCase(), digest.toLowerCase());
}

async function upsertIntegration(env: Env, organizationId: string, provider: string, values: { status: string; connectedAccount: string; metadata: Row }) {
  const stamp = now();
  const existing = await env.DB.prepare("SELECT id FROM ai_integrations WHERE organization_id=? AND provider=? LIMIT 1").bind(organizationId, provider).first<Row>();
  if (existing) {
    await env.DB.prepare("UPDATE ai_integrations SET status=?,connected_account=?,last_sync_at=?,metadata=?,updated_at=? WHERE id=?")
      .bind(values.status, values.connectedAccount, stamp, JSON.stringify(values.metadata), stamp, existing.id).run();
    return String(existing.id);
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO ai_integrations (id,organization_id,provider,status,connected_account,last_sync_at,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, organizationId, provider, values.status, values.connectedAccount, stamp, JSON.stringify(values.metadata), stamp, stamp).run();
  return id;
}

async function metaAppSecret(env: Env) {
  if (env.META_APP_SECRET) return String(env.META_APP_SECRET);
  const row = await env.DB.prepare("SELECT value FROM ai_system_secrets WHERE key='meta_app_secret_encrypted' LIMIT 1").first<Row>();
  if (!row?.value) return "";
  try {
    const decrypted = await decryptIntegrationCredentials(env, JSON.parse(String(row.value)) as Row);
    return String(decrypted.app_secret || "");
  } catch (caught) {
    console.error("VAREX AI Meta secret decryption failed", caught);
    return "";
  }
}

async function metaConfig(env: Env) {
  return { appId: String(env.META_APP_ID || ""), appSecret: await metaAppSecret(env), graphVersion: String(env.META_GRAPH_VERSION || "v26.0") };
}

const defaultMetaFacebookScopes = [
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_posts",
  "pages_messaging",
];
const defaultMetaInstagramScopes = [
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
];
const blockedMetaLoginScopes = new Set(["pages_manage_engagement", "pages_read_user_content"]);

function metaLoginScopes(env: Env, provider: "facebook" | "instagram") {
  const configured = provider === "facebook" ? env.META_FACEBOOK_SCOPES : env.META_INSTAGRAM_SCOPES;
  const defaults = provider === "facebook" ? defaultMetaFacebookScopes : defaultMetaInstagramScopes;
  const scopes = String(configured || defaults.join(","))
    .split(",")
    .map(scope => scope.trim())
    .filter(scope => /^[a-z][a-z0-9._-]{2,80}$/i.test(scope))
    .filter(scope => !blockedMetaLoginScopes.has(scope));
  return [...new Set(scopes)];
}

function tikTokScopes(env: Env) {
  const scopes = String(env.TIKTOK_SCOPES || "user.info.basic")
    .split(",")
    .map(scope => scope.trim())
    .filter(scope => /^[a-z][a-z0-9._-]{2,80}$/i.test(scope));
  if (!scopes.includes("user.info.basic")) scopes.unshift("user.info.basic");
  return [...new Set(scopes)];
}

async function metaAdmin(request: Request, env: Env, route: "status" | "secret") {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!varexAdminEmails.has(String(user.email || "").trim().toLowerCase())) return error("هذه الإعدادات متاحة لإدارة VAREX فقط", 403);
  if (route === "status" && request.method === "GET") {
    const config = await metaConfig(env);
    return api({
      configured: Boolean(config.appId && config.appSecret),
      app_id_configured: Boolean(config.appId),
      login_configured: Boolean(config.appId && config.appSecret),
      login_configuration_id_configured: Boolean(env.META_LOGIN_CONFIG_ID),
      whatsapp_configured: Boolean(config.appId && config.appSecret && env.META_WHATSAPP_CONFIG_ID),
      whatsapp_webhook_configured: Boolean(env.META_WHATSAPP_VERIFY_TOKEN),
      tiktok_configured: Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
      tiktok_callback_mode: tikTokCallbackMode(request, env),
      graph_version: config.graphVersion,
    });
  }
  if (route === "secret" && request.method === "POST") {
    const body = await request.json<Row>().catch(() => ({}));
    const appSecret = String(body.app_secret || "").trim();
    if (appSecret.length < 20 || appSecret.length > 200 || /\s/.test(appSecret)) return error("أدخل المفتاح السري الصحيح لتطبيق Meta");
    const encrypted = await encryptIntegrationCredentials(env, { app_secret: appSecret });
    const stamp = now();
    await env.DB.prepare("INSERT INTO ai_system_secrets (key,value,created_at,updated_at) VALUES ('meta_app_secret_encrypted',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
      .bind(JSON.stringify(encrypted), stamp, stamp).run();
    return api({ configured: true });
  }
  return error("الطريقة غير مدعومة", 405);
}

type PayPalConfig = { clientId: string; clientSecret: string; environment: "live" | "sandbox"; source: "environment" | "database" };

function payPalEnvironment(value: unknown): "live" | "sandbox" {
  return String(value || "live").trim().toLowerCase() === "sandbox" ? "sandbox" : "live";
}

function payPalApiBase(environment: "live" | "sandbox") {
  return environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function payPalConfig(env: Env): Promise<PayPalConfig | null> {
  const envClientId = String(env.PAYPAL_CLIENT_ID || "").trim();
  const envClientSecret = String(env.PAYPAL_CLIENT_SECRET || "").trim();
  if (envClientId && envClientSecret) return { clientId: envClientId, clientSecret: envClientSecret, environment: payPalEnvironment(env.PAYPAL_ENV), source: "environment" };
  const row = await env.DB.prepare("SELECT value FROM ai_system_secrets WHERE key='paypal_credentials_encrypted' LIMIT 1").first<Row>();
  if (!row?.value) return null;
  try {
    const decrypted = await decryptIntegrationCredentials(env, JSON.parse(String(row.value)) as Row);
    const clientId = String(decrypted.client_id || "").trim(), clientSecret = String(decrypted.client_secret || "").trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, environment: payPalEnvironment(decrypted.environment), source: "database" };
  } catch (caught) {
    console.error("VAREX AI PayPal credential decryption failed", caught);
    return null;
  }
}

async function payPalTokenFor(config: PayPalConfig) {
  const response = await fetch(`${payPalApiBase(config.environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const payload = await response.json<Row>().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    console.error("VAREX AI PayPal authentication failed", response.status, payload.error || payload.error_description || "unknown_error");
    throw new Error("PAYPAL_AUTH_FAILED");
  }
  return String(payload.access_token);
}

async function payPalApiRequest(env: Env, path: string, init: { method?: string; body?: Row; requestId?: string } = {}) {
  const config = await payPalConfig(env);
  if (!config) throw new Error("PAYPAL_NOT_CONFIGURED");
  const token = await payPalTokenFor(config);
  const response = await fetch(`${payPalApiBase(config.environment)}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = await response.json<Row>().catch(() => ({}));
  if (!response.ok) {
    console.error("VAREX AI PayPal API failed", response.status, payload.name || payload.message || "unknown_error");
    throw new Error("PAYPAL_API_FAILED");
  }
  return payload;
}

async function payPalAdmin(request: Request, env: Env, route: "status" | "credentials") {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الإعدادات متاحة للمالك فقط", 403);

  if (route === "status" && request.method === "GET") {
    const config = await payPalConfig(env);
    return api({
      configured: Boolean(config),
      environment: config?.environment || "live",
      source: config?.source || null,
      client_id_hint: config ? `••••${config.clientId.slice(-6)}` : null,
    });
  }

  if (route === "credentials" && request.method === "POST") {
    const body = await request.json<Row>().catch(() => ({}));
    const clientId = String(body.client_id || "").trim(), clientSecret = String(body.client_secret || "").trim();
    const environment = payPalEnvironment(body.environment);
    if (clientId.length < 20 || clientId.length > 300 || /\s/.test(clientId)) return error("أدخل PayPal Client ID الصحيح");
    if (clientSecret.length < 20 || clientSecret.length > 300 || /\s/.test(clientSecret)) return error("أدخل PayPal Client Secret الصحيح");
    const candidate: PayPalConfig = { clientId, clientSecret, environment, source: "database" };
    try { await payPalTokenFor(candidate); }
    catch (_) { return error("بيانات PayPal غير صحيحة أو لا تطابق بيئة الحساب", 400); }
    const encrypted = await encryptIntegrationCredentials(env, { client_id: clientId, client_secret: clientSecret, environment });
    const stamp = now();
    await env.DB.prepare("INSERT INTO ai_system_secrets (key,value,created_at,updated_at) VALUES ('paypal_credentials_encrypted',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
      .bind(JSON.stringify(encrypted), stamp, stamp).run();
    return api({ configured: true, environment, client_id_hint: `••••${clientId.slice(-6)}` });
  }

  return error("الطريقة غير مدعومة", 405);
}

function normalizeActivationCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const token = [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
  return `VAREX-FREE-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`;
}

async function activationCodeAdmin(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الصفحة متاحة للمالك فقط", 403);

  if (request.method === "GET") {
    const result = await env.DB.prepare("SELECT id,code_prefix,status,redeemed_at,created_at FROM ai_activation_codes ORDER BY created_at DESC LIMIT 50").all<Row>();
    return api(result.results);
  }

  if (request.method === "POST") {
    const code = randomActivationCode(), stamp = now();
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO ai_activation_codes (id,code_hash,code_prefix,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id, await sha256(normalizeActivationCode(code)), code.slice(0, 15), "active", user.id, stamp, stamp).run();
    return api({ id, code, status: "active", created_at: stamp }, 201);
  }

  return error("الطريقة غير مدعومة", 405);
}

async function redeemActivationCode(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (isDeveloperAccount(user)) return error("حساب المالك مفتوح مجاناً ولا يحتاج إلى كود");
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), normalized = normalizeActivationCode(body.code);
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true, true)) return error("ليست لديك صلاحية إدارة مساحة العمل", 403);
  if (!normalized.startsWith("VAREXFREE") || normalized.length !== 21) return error("كود التفعيل غير صحيح");
  const code = await env.DB.prepare("SELECT * FROM ai_activation_codes WHERE code_hash=? LIMIT 1").bind(await sha256(normalized)).first<Row>();
  if (!code) return error("كود التفعيل غير صحيح", 404);
  if (code.status !== "active") return error("تم استخدام هذا الكود مسبقاً", 409);
  const stamp = now(), subscriptionId = crypto.randomUUID();
  const claimed = await env.DB.prepare("UPDATE ai_activation_codes SET status='redeemed',redeemed_by=?,redeemed_organization_id=?,redeemed_at=?,updated_at=? WHERE id=? AND status='active'")
    .bind(user.id, organizationId, stamp, stamp, code.id).run();
  if (!claimed.meta?.changes) return error("تم استخدام هذا الكود مسبقاً", 409);
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE ai_subscriptions SET status='superseded',updated_at=? WHERE organization_id=? AND status IN ('active','pending_payment')").bind(stamp, organizationId),
      env.DB.prepare("INSERT INTO ai_subscriptions (id,organization_id,plan_code,status,agent_limit,monthly_task_limit,starts_at,renews_at,billing_cycle,payment_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(subscriptionId, organizationId, "gift", "active", null, 120000, stamp, null, "gift", "كود تفعيل مجاني", stamp, stamp),
      env.DB.prepare("UPDATE ai_organizations SET status='active',updated_at=? WHERE id=?").bind(stamp, organizationId),
      env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), organizationId, user.id, "free_activation_redeemed", "activation_code", code.id, JSON.stringify({ subscription_id: subscriptionId }), stamp, stamp),
    ]);
  } catch (caught) {
    await env.DB.prepare("UPDATE ai_activation_codes SET status='active',redeemed_by=NULL,redeemed_organization_id=NULL,redeemed_at=NULL,updated_at=? WHERE id=? AND redeemed_by=? AND redeemed_organization_id=?")
      .bind(now(), code.id, user.id, organizationId).run().catch(() => undefined);
    throw caught;
  }
  const subscription = await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE id=? LIMIT 1").bind(subscriptionId).first<Row>();
  return api({ activated: true, subscription });
}

async function createPayPalOrder(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (isDeveloperAccount(user)) return error("حساب المالك مفتوح مجاناً ولا يحتاج إلى دفع");
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), planCode = String(body.plan_code || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true, true)) return error("ليست لديك صلاحية إدارة مساحة العمل", 403);
  const plan = customerSubscriptionPlans[planCode], price = payPalPlanPrices[planCode];
  if (!plan || !price) return error("الباقة المختارة غير صالحة");
  const paymentId = crypto.randomUUID(), stamp = now();
  const returnUrl = new URL("/", appOrigin(request, env)); returnUrl.searchParams.set("paypal", "approved"); returnUrl.hash = "billing";
  const cancelUrl = new URL("/", appOrigin(request, env)); cancelUrl.searchParams.set("paypal", "cancelled"); cancelUrl.hash = "billing";
  let order: Row;
  try {
    order = await payPalApiRequest(env, "/v2/checkout/orders", {
      method: "POST",
      requestId: paymentId,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: paymentId,
          custom_id: organizationId,
          invoice_id: `VAREX-${paymentId}`,
          description: `VAREX AI — ${price.name}`,
          amount: { currency_code: price.currency, value: price.amount },
        }],
        payment_source: { paypal: { experience_context: { brand_name: "VAREX AI", landing_page: "LOGIN", user_action: "PAY_NOW", return_url: returnUrl.toString(), cancel_url: cancelUrl.toString() } } },
      },
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "PAYPAL_NOT_CONFIGURED") return error("ربط PayPal غير مكتمل بعد؛ تواصل مع المالك", 503);
    if (caught instanceof Error && caught.message === "PAYPAL_AUTH_FAILED") return error("تعذر التحقق من حساب PayPal؛ راجع المالك", 503);
    return error("تعذر إنشاء عملية الدفع عبر PayPal الآن", 502);
  }
  const orderId = String(order.id || "");
  const links = Array.isArray(order.links) ? order.links as Row[] : [];
  const approvalUrl = String(links.find(link => ["approve", "payer-action"].includes(String(link.rel)))?.href || "");
  if (!orderId || !approvalUrl.startsWith("https://")) return error("لم يرجع PayPal رابط دفع صالحاً", 502);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ai_payments (id,organization_id,created_by,provider,provider_order_id,plan_code,amount,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(paymentId, organizationId, user.id, "paypal", orderId, planCode, price.amount, price.currency, "created", stamp, stamp),
    env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, user.id, "paypal_order_created", "payment", paymentId, JSON.stringify({ plan_code: planCode, amount: price.amount, currency: price.currency }), stamp, stamp),
  ]);
  return api({ order_id: orderId, approval_url: approvalUrl, amount: price.amount, currency: price.currency }, 201);
}

async function capturePayPalOrder(request: Request, env: Env, orderId: string) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  const payment = await env.DB.prepare("SELECT * FROM ai_payments WHERE provider='paypal' AND provider_order_id=? LIMIT 1").bind(orderId).first<Row>();
  if (!payment) return error("عملية PayPal غير موجودة", 404);
  const organizationId = String(payment.organization_id || "");
  if (!await authorizeOrg(env, user, organizationId, true, true)) return error("ليست لديك صلاحية تأكيد هذه الدفعة", 403);
  if (payment.status === "completed") {
    const subscription = await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE id=? LIMIT 1").bind(payment.id).first<Row>();
    return api({ completed: true, subscription });
  }
  let order: Row;
  try { order = await payPalApiRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", requestId: `${payment.id}-capture` }); }
  catch (caught) {
    if (caught instanceof Error && caught.message === "PAYPAL_NOT_CONFIGURED") return error("ربط PayPal غير مكتمل بعد", 503);
    try { order = await payPalApiRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`); }
    catch (_) { return error("لم يؤكد PayPal اكتمال الدفعة", 502); }
  }
  const purchaseUnits = Array.isArray(order.purchase_units) ? order.purchase_units as Row[] : [];
  const payments = purchaseUnits[0]?.payments && typeof purchaseUnits[0].payments === "object" ? purchaseUnits[0].payments as Row : {};
  const captures = Array.isArray(payments.captures) ? payments.captures as Row[] : [];
  const capture = captures.find(item => String(item.status) === "COMPLETED") || captures[0];
  const capturedAmount = capture?.amount && typeof capture.amount === "object" ? capture.amount as Row : {};
  if (String(order.status) !== "COMPLETED" || String(capture?.status) !== "COMPLETED") return error("دفعة PayPal لم تكتمل بعد", 409);
  if (String(capturedAmount.value) !== String(payment.amount) || String(capturedAmount.currency_code) !== String(payment.currency)) return error("قيمة الدفعة لا تطابق الباقة المختارة", 409);
  const plan = customerSubscriptionPlans[String(payment.plan_code || "")];
  if (!plan) return error("الباقة المرتبطة بالدفعة غير صالحة", 409);
  const stamp = now(), renewal = new Date(); renewal.setUTCMonth(renewal.getUTCMonth() + 1);
  const payer = order.payer && typeof order.payer === "object" ? order.payer as Row : {};
  const captureId = String(capture?.id || ""), payerEmail = String(payer.email_address || "") || null;
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_subscriptions SET status='superseded',updated_at=? WHERE organization_id=? AND id<>? AND status IN ('active','pending_payment')").bind(stamp, organizationId, payment.id),
    env.DB.prepare("INSERT INTO ai_subscriptions (id,organization_id,plan_code,status,agent_limit,monthly_task_limit,starts_at,renews_at,billing_cycle,payment_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,agent_limit=excluded.agent_limit,monthly_task_limit=excluded.monthly_task_limit,starts_at=excluded.starts_at,renews_at=excluded.renews_at,billing_cycle=excluded.billing_cycle,payment_method=excluded.payment_method,updated_at=excluded.updated_at")
      .bind(payment.id, organizationId, payment.plan_code, "active", plan.agentLimit, plan.monthlyTaskLimit, stamp, renewal.toISOString(), plan.billingCycle, "PayPal", stamp, stamp),
    env.DB.prepare("UPDATE ai_payments SET status='completed',provider_capture_id=?,payer_email=?,updated_at=? WHERE id=?").bind(captureId || null, payerEmail, stamp, payment.id),
    env.DB.prepare("UPDATE ai_organizations SET status='active',updated_at=? WHERE id=?").bind(stamp, organizationId),
    env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, user.id, "paypal_payment_captured", "payment", payment.id, JSON.stringify({ plan_code: payment.plan_code, capture_id: captureId, amount: payment.amount, currency: payment.currency }), stamp, stamp),
  ]);
  const subscription = await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE id=? LIMIT 1").bind(payment.id).first<Row>();
  return api({ completed: true, subscription });
}

async function subscriptionAdmin(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الصفحة متاحة للمالك فقط", 403);

  if (request.method === "GET") {
    const result = await env.DB.prepare("SELECT s.id,s.organization_id,s.plan_code,s.status,s.agent_limit,s.monthly_task_limit,s.starts_at,s.renews_at,s.billing_cycle,s.payment_method,s.created_at,s.updated_at,o.name AS organization_name,u.email AS owner_email FROM ai_subscriptions s JOIN ai_organizations o ON o.id=s.organization_id JOIN ai_users u ON u.id=o.owner_id WHERE s.status IN ('pending_payment','active') ORDER BY CASE s.status WHEN 'pending_payment' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 200").all<Row>();
    return api(result.results);
  }

  if (request.method === "PATCH") {
    const body = await request.json<Row>().catch(() => ({}));
    const subscriptionId = String(body.subscription_id || "");
    if (!subscriptionId || body.action !== "activate") return error("طلب التفعيل غير صالح");
    const subscription = await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE id=? LIMIT 1").bind(subscriptionId).first<Row>();
    if (!subscription) return error("طلب الاشتراك غير موجود", 404);
    const plan = customerSubscriptionPlans[String(subscription.plan_code || "")];
    if (!plan) return error("الباقة المختارة غير صالحة");
    const stamp = now();
    const renewal = new Date();
    renewal.setUTCMonth(renewal.getUTCMonth() + 1);
    await env.DB.batch([
      env.DB.prepare("UPDATE ai_subscriptions SET status='superseded',updated_at=? WHERE organization_id=? AND id<>? AND status='active'").bind(stamp, subscription.organization_id, subscriptionId),
      env.DB.prepare("UPDATE ai_subscriptions SET status='active',agent_limit=?,monthly_task_limit=?,billing_cycle=?,starts_at=?,renews_at=?,updated_at=? WHERE id=?").bind(plan.agentLimit, plan.monthlyTaskLimit, plan.billingCycle, stamp, renewal.toISOString(), stamp, subscriptionId),
      env.DB.prepare("UPDATE ai_organizations SET status='active',updated_at=? WHERE id=?").bind(stamp, subscription.organization_id),
      env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), subscription.organization_id, user.id, "subscription_payment_confirmed", "subscription", subscriptionId, JSON.stringify({ plan_code: subscription.plan_code, activation_mode: "developer_manual" }), stamp, stamp),
    ]);
    const activated = await env.DB.prepare("SELECT s.id,s.organization_id,s.plan_code,s.status,s.agent_limit,s.monthly_task_limit,s.starts_at,s.renews_at,s.billing_cycle,s.payment_method,s.created_at,s.updated_at,o.name AS organization_name,u.email AS owner_email FROM ai_subscriptions s JOIN ai_organizations o ON o.id=s.organization_id JOIN ai_users u ON u.id=o.owner_id WHERE s.id=? LIMIT 1").bind(subscriptionId).first<Row>();
    return api({ activated: true, subscription: activated });
  }

  return error("الطريقة غير مدعومة", 405);
}

async function syncExistingWhatsAppAccount(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!varexAdminEmails.has(String(user.email || "").trim().toLowerCase())) return error("هذه العملية متاحة لإدارة VAREX فقط", 403);

  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true)) return error("ليست لديك صلاحية إدارة مساحة العمل", 403);

  const businessId = String(env.META_BUSINESS_ID || "").trim();
  const wabaId = String(env.META_WHATSAPP_WABA_ID || "").trim();
  if (!businessId || !wabaId) return error("لم تُحفظ بيانات حساب واتساب الموجود بعد", 503);

  const integrations = await env.DB.prepare("SELECT provider,metadata FROM ai_integrations WHERE organization_id=? AND provider IN ('facebook','instagram') AND status='connected' ORDER BY CASE provider WHEN 'facebook' THEN 0 ELSE 1 END")
    .bind(organizationId).all<Row>();
  const tokenCandidates: Array<{ sourceProvider: string; accessToken?: string; integration?: Row }> = [];
  const systemUserToken = String(env.META_WHATSAPP_SYSTEM_USER_TOKEN || "").trim();
  if (systemUserToken) tokenCandidates.push({ sourceProvider: "system_user", accessToken: systemUserToken });
  for (const integration of integrations.results) {
    tokenCandidates.push({ sourceProvider: String(integration.provider || "unknown"), integration });
  }
  const diagnostics: Row[] = [];

  for (const candidate of tokenCandidates) {
    const diagnostic: Row = { source_provider: candidate.sourceProvider };
    let failureStep = "read_saved_token";
    try {
      let credentials: Row;
      if (candidate.accessToken) {
        credentials = {
          access_token: candidate.accessToken,
          expires_in: 0,
          owner: { id: businessId, name: "Varex" },
        };
      } else {
        const metadata = JSON.parse(String(candidate.integration?.metadata || "{}")) as Row;
        if (!metadata.credential || typeof metadata.credential !== "object") continue;
        credentials = await decryptIntegrationCredentials(env, metadata.credential as Row);
      }
      const accessToken = String(credentials.access_token || "");
      if (!accessToken) continue;

      if (candidate.sourceProvider === "system_user") {
        diagnostic.whatsapp_business_management = true;
        diagnostic.whatsapp_business_messaging = true;
      } else {
        failureStep = "read_permissions";
        const permissionsPayload = await metaGet(env, "me/permissions?limit=100", accessToken);
        const permissionRows = Array.isArray(permissionsPayload.data) ? permissionsPayload.data as Row[] : [];
        const grantedPermissions = new Set(permissionRows
          .filter(permission => String(permission.status || "").toLowerCase() === "granted")
          .map(permission => String(permission.permission || "")));
        diagnostic.whatsapp_business_management = grantedPermissions.has("whatsapp_business_management");
        diagnostic.whatsapp_business_messaging = grantedPermissions.has("whatsapp_business_messaging");
      }

      failureStep = "read_business";
      const [business, owned, client] = await Promise.all([
        metaGet(env, `${businessId}?fields=id,name`, accessToken).catch(() => ({ id: businessId, name: "Varex" })),
        metaGet(env, `${businessId}/owned_whatsapp_business_accounts?fields=id,name`, accessToken).catch(() => ({ data: [] })),
        metaGet(env, `${businessId}/client_whatsapp_business_accounts?fields=id,name`, accessToken).catch(() => ({ data: [] })),
      ]);
      diagnostic.business_access = Boolean(business.id);
      const availableAccounts = [owned, client]
        .flatMap(payload => Array.isArray(payload.data) ? payload.data as Row[] : []);
      diagnostic.visible_whatsapp_accounts = availableAccounts.length;
      diagnostic.visible_whatsapp_account_ids = availableAccounts
        .map(account => String(account.id || ""))
        .filter(Boolean)
        .slice(0, 20);
      const listedWaba = availableAccounts.find(account => String(account.id || "") === wabaId);
      diagnostic.target_account_visible = Boolean(listedWaba);

      failureStep = "read_whatsapp_account";
      const directWaba = await metaGet(env, `${wabaId}?fields=id,name`, accessToken).catch(() => null);
      diagnostic.target_account_directly_accessible = Boolean(directWaba && String(directWaba.id || "") === wabaId);

      // Meta can omit a newly assigned WABA from the business account edges even
      // while the same token already has direct access to the WABA and its phone.
      // The phone-number edge is the authoritative capability check for VAREX.
      failureStep = "read_whatsapp_phone_numbers";
      const phonesPayload = await metaGet(env, `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`, accessToken);
      const phones = Array.isArray(phonesPayload.data) ? phonesPayload.data as Row[] : [];
      diagnostic.phone_count = phones.length;
      if (!phones.length) {
        diagnostic.failure_step = failureStep;
        diagnostics.push(diagnostic);
        continue;
      }

      failureStep = "subscribe_webhooks";
      const subscribed = await subscribeWhatsAppBusinessAccount(env, wabaId, accessToken);
      diagnostic.webhook_subscribed = subscribed;
      if (!subscribed) {
        diagnostic.failure_step = failureStep;
        diagnostics.push(diagnostic);
        continue;
      }

      const account = {
        business_id: String(business.id || businessId),
        business_name: String(business.name || "Varex"),
        waba_id: wabaId,
        waba_name: String(directWaba?.name || listedWaba?.name || "VAREX"),
        phones,
      };
      const encrypted = await encryptIntegrationCredentials(env, {
        access_token: accessToken,
        expires_in: Number(credentials.expires_in || 0),
        owner: credentials.owner || { id: businessId, name: business.name || "Varex" },
        accounts: [account],
      });
      const connectedAccount = String(phones[0]?.display_phone_number || directWaba?.name || listedWaba?.name || "VAREX");
      await upsertIntegration(env, organizationId, "whatsapp", {
        status: "connected",
        connectedAccount,
        metadata: {
          credential: encrypted,
          accounts: [account],
          account_count: 1,
          subscribed_waba_ids: [wabaId],
          connected_by_customer: true,
          coexistence: true,
          preserves_whatsapp_business_app: true,
          manual_recovery: true,
          source_provider: candidate.sourceProvider,
          connected_at: now(),
        },
      });
      const stamp = now();
      await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), organizationId, user.id, "whatsapp_existing_account_synced", "integration", wabaId, JSON.stringify({ business_id: businessId, phone_count: phones.length }), stamp, stamp).run();
      return api({ connected: true, status: "connected", connected_account: connectedAccount });
    } catch (caught) {
      console.error("VAREX AI existing WhatsApp sync candidate failed", candidate.sourceProvider, caught);
      diagnostic.failure_step = failureStep;
      diagnostics.push(diagnostic);
    }
  }

  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "whatsapp_existing_account_sync_failed", "integration", wabaId, JSON.stringify({ attempts: diagnostics }), stamp, stamp).run();

  const whatsappPermissionsMissing = diagnostics.some(item => item.whatsapp_business_management !== true || item.whatsapp_business_messaging !== true);
  const targetAccountHidden = diagnostics.some(item =>
    item.whatsapp_business_management === true &&
    item.target_account_visible === false &&
    item.target_account_directly_accessible !== true &&
    Number(item.phone_count || 0) === 0
  );

  return api({
    message: whatsappPermissionsMissing
      ? "إعادة ربط Facebook اكتملت، لكن Meta لم تمنح صلاحيتَي واتساب للتصريح الجديد."
      : targetAccountHidden
      ? "صلاحيتا واتساب وصلتا، لكن Meta لا تعرض حساب واتساب الموجود لهذا التصريح."
      : "صلاحيات واتساب وصلت، لكن Meta رفضت قراءة الحساب في خطوة لاحقة.",
    needs_whatsapp_permission: true,
  }, 409);
}

async function integrationReadiness(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), organizationId = String(url.searchParams.get("organization_id") || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const meta = await metaConfig(env), metaBaseReady = Boolean(meta.appId && meta.appSecret), scopes = tikTokScopes(env);
  const googleReady = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return api({
    providers: {
      whatsapp: {
        configured: Boolean(metaBaseReady && env.META_WHATSAPP_CONFIG_ID),
        webhook_configured: Boolean(env.META_WHATSAPP_VERIFY_TOKEN),
        capability: env.META_WHATSAPP_VERIFY_TOKEN ? "messaging" : "account_linking",
      },
      facebook: { configured: metaBaseReady, capability: "page_linking", scopes: metaLoginScopes(env, "facebook") },
      instagram: { configured: metaBaseReady, capability: "professional_account_linking", scopes: metaLoginScopes(env, "instagram") },
      tiktok: {
        configured: Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
        capability: scopes.includes("video.publish") ? "content_posting" : "account_identity",
        callback_mode: tikTokCallbackMode(request, env),
      },
      email: { configured: googleReady, capability: "gmail_account_linking", scopes: googleScopes("email") },
      youtube: { configured: googleReady, capability: "youtube_channel_linking", scopes: googleScopes("youtube") },
    },
    graph_version: meta.graphVersion,
  });
}

function normalizeWebsiteSources(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const websites: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();
  for (const candidate of rows.slice(0, 25)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Row;
    const rawUrl = String(row.url || "").trim();
    if (!rawUrl) continue;
    let url: URL;
    try { url = new URL(rawUrl); } catch (_) { throw new AgentActionError("INVALID_WEBSITE_URL", `رابط الموقع غير صالح: ${rawUrl}`, 400); }
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new AgentActionError("INVALID_WEBSITE_URL", `استخدم رابط موقع عاماً يبدأ بـ https:// أو http:// من دون بيانات دخول: ${rawUrl}`, 400);
    }
    url.hash = "";
    const normalized = url.toString();
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = String(row.name || url.hostname.replace(/^www\./i, "")).trim().slice(0, 100);
    websites.push({ name: name || url.hostname, url: normalized.slice(0, 1200) });
  }
  return websites;
}

async function websiteSources(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const organizationId = String(url.searchParams.get("organization_id") || "").trim();
    if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
    const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE organization_id=? AND provider='website' LIMIT 1").bind(organizationId).first<Row>();
    if (!integration) return api({ websites: [], integration: null });
    let metadata: Row = {}; try { metadata = JSON.parse(String(integration.metadata || "{}")) as Row; } catch (_) { metadata = {}; }
    return api({ websites: normalizeWebsiteSources(metadata.websites), integration: hydrate(integration) });
  }
  if (request.method !== "PUT") return error("الطريقة غير مدعومة", 405);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim();
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع تعديل مواقع الموظف", 403);
  let websites: Array<{ name: string; url: string }>;
  try { websites = normalizeWebsiteSources(body.websites); }
  catch (caught) {
    const failure = caught instanceof AgentActionError ? caught : new AgentActionError("INVALID_WEBSITE_URL", "تحقق من روابط المواقع المضافة", 400);
    return api({ code: failure.code, message: failure.message }, failure.status);
  }
  const integrationId = await upsertIntegration(env, organizationId, "website", {
    status: websites.length ? "connected" : "setup_required",
    connectedAccount: websites.length ? `${websites.length} مواقع معتمدة` : "لا توجد مواقع",
    metadata: { websites, updated_by_customer: true, updated_at: now() },
  });
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "website_sources_updated", "integration", integrationId, JSON.stringify({ website_count: websites.length }), stamp, stamp).run();
  const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE id=? LIMIT 1").bind(integrationId).first<Row>();
  return api({ ok: true, websites, integration: integration ? hydrate(integration) : null });
}

async function parkingConnection(request: Request, env: Env) {
  if (request.method !== "PUT") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim();
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع إعداد خدمة المواقف", 403);
  const serviceProvider = String(body.service_provider || "").trim();
  const accountReference = String(body.account_reference || "").trim();
  const labels: Record<string, string> = { rta_dubai: "مواقف دبي", mawaqif_abudhabi: "مواقف أبوظبي", other: "مزود مواقف آخر" };
  if (!labels[serviceProvider]) return error("اختر مزود المواقف", 400);
  if (accountReference.length < 3 || accountReference.length > 120) return error("اكتب رقم الحساب أو رقم الهاتف المرتبط بخدمة المواقف", 400);
  const integrationId = await upsertIntegration(env, organizationId, "parking", {
    status: "action_required",
    connectedAccount: `${labels[serviceProvider]} • ${accountReference.slice(-4).padStart(Math.min(4, accountReference.length), "•")}`,
    metadata: { service_provider: serviceProvider, account_reference: accountReference, setup_saved: true, updated_by_customer: true, updated_at: now() },
  });
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "parking_connection_setup_saved", "integration", integrationId, JSON.stringify({ service_provider: serviceProvider }), stamp, stamp).run();
  const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE id=? LIMIT 1").bind(integrationId).first<Row>();
  return api({ ok: true, integration: integration ? hydrate(integration) : null, message: "تم حفظ مزود المواقف. يبقى التنفيذ والدفع بانتظار تفعيل واجهة المزود وموافقتك." });
}

async function beginIntegration(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), provider = url.searchParams.get("provider") as OAuthProvider, organizationId = String(url.searchParams.get("organization_id") || "");
  if (!oauthProviders.has(provider)) return error("قناة الربط غير مدعومة", 400);
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  if (provider === "tiktok" && (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET)) return error("بوابة ربط TikTok تحتاج تفعيلها من إدارة VAREX", 503);
  if (["email", "youtube"].includes(provider) && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) return error("بوابة ربط حساب Google تحتاج تفعيلها من إدارة VAREX", 503);
  if (!["tiktok", "email", "youtube"].includes(provider)) {
    const meta = await metaConfig(env);
    if (!meta.appId || !meta.appSecret) return error("بوابة ربط Meta تحتاج تفعيلها من إدارة VAREX", 503);
    if (provider === "whatsapp" && !env.META_WHATSAPP_CONFIG_ID) return error("إعداد WhatsApp Business يحتاج إكماله من إدارة VAREX", 503);
  }
  const origin = appOrigin(request, env), state = randomToken();
  const returnTo = integrationReturnUrl(request, env, {}), stamp = now(), expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM ai_oauth_states WHERE expires_at<? OR consumed_at IS NOT NULL").bind(stamp).run();
  await env.DB.prepare("INSERT INTO ai_oauth_states (id,organization_id,user_id,provider,state_hash,code_verifier,return_to,expires_at,consumed_at,created_at) VALUES (?,?,?,?,?,?,?,?,NULL,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, provider, await sha256(state), null, returnTo, expiresAt, stamp).run();

  let authorizationUrl: URL;
  if (provider === "tiktok") {
    const redirectUri = tikTokRedirectUri(request, env);
    authorizationUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authorizationUrl.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", tikTokScopes(env).join(","));
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("state", state);
  } else if (provider === "email" || provider === "youtube") {
    authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
    authorizationUrl.searchParams.set("redirect_uri", googleRedirectUri(request, env));
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", googleScopes(provider).join(" "));
    authorizationUrl.searchParams.set("access_type", "offline");
    authorizationUrl.searchParams.set("include_granted_scopes", "true");
    authorizationUrl.searchParams.set("prompt", "consent");
    authorizationUrl.searchParams.set("state", state);
  } else {
    const meta = await metaConfig(env);
    if (provider === "whatsapp") {
      return api({
        flow: "whatsapp_embedded_signup",
        provider,
        organization_id: organizationId,
        app_id: meta.appId,
        config_id: env.META_WHATSAPP_CONFIG_ID,
        graph_version: meta.graphVersion,
        oauth_state: state,
        expires_at: expiresAt,
      });
    }
    const redirectUri = `${origin}/api/integrations/callback/meta`;
    authorizationUrl = new URL(`https://www.facebook.com/${meta.graphVersion}/dialog/oauth`);
    authorizationUrl.searchParams.set("client_id", meta.appId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("display", "popup");
    authorizationUrl.searchParams.set("scope", metaLoginScopes(env, provider).join(","));
  }
  return api({ authorization_url: authorizationUrl.toString(), provider, organization_id: organizationId });
}

async function metaGet(env: Env, path: string, accessToken: string) {
  const { graphVersion } = await metaConfig(env), url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  return responseJson(await fetch(url));
}

async function subscribeWhatsAppBusinessAccount(env: Env, wabaId: string, accessToken: string) {
  const { graphVersion } = await metaConfig(env);
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const payload = await responseJson(response);
  return payload.success !== false;
}

async function exchangeMetaCode(request: Request, env: Env, code: string, embeddedSignup = false) {
  const { appId, appSecret, graphVersion } = await metaConfig(env), redirectUri = `${appOrigin(request, env)}/api/integrations/callback/meta`;
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId); tokenUrl.searchParams.set("client_secret", appSecret); tokenUrl.searchParams.set("code", code);
  if (!embeddedSignup) tokenUrl.searchParams.set("redirect_uri", redirectUri);
  const token = await responseJson(await fetch(tokenUrl));
  const shortToken = String(token.access_token || ""); if (!shortToken) throw new Error("PROVIDER_TOKEN_MISSING");
  if (embeddedSignup) return { accessToken: shortToken, expiresIn: Number(token.expires_in || 0) };
  const longUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token"); longUrl.searchParams.set("client_id", appId); longUrl.searchParams.set("client_secret", appSecret); longUrl.searchParams.set("fb_exchange_token", shortToken);
  const longToken = await responseJson(await fetch(longUrl)).catch(() => token);
  return { accessToken: String(longToken.access_token || shortToken), expiresIn: Number(longToken.expires_in || token.expires_in || 0) };
}

async function completeWhatsAppEmbeddedSignup(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), state = String(body.oauth_state || ""), code = String(body.code || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  if (!state || !code) return error("بيانات إكمال ربط واتساب غير مكتملة");
  const record = await env.DB.prepare("SELECT * FROM ai_oauth_states WHERE state_hash=? AND consumed_at IS NULL LIMIT 1").bind(await sha256(state)).first<Row>();
  if (!record || String(record.expires_at) <= now() || String(record.provider) !== "whatsapp" || String(record.organization_id) !== organizationId || String(record.user_id) !== String(user.id)) return error("انتهت جلسة ربط واتساب؛ ابدأ الربط من جديد", 400);

  const session = body.session_event && typeof body.session_event === "object" ? body.session_event as Row : {};
  const sessionData = session.data && typeof session.data === "object" ? session.data as Row : {};
  if (String(session.type || "") !== "WA_EMBEDDED_SIGNUP" || String(session.event || "") !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") return error("اختر ربط حساب WhatsApp Business الحالي للمحافظة على الرقم والمحادثات", 409);
  const wabaId = String(sessionData.waba_id || "");
  if (!wabaId) return error("لم تُرجع ميتا حساب واتساب التجاري المطلوب", 409);

  await env.DB.prepare("UPDATE ai_oauth_states SET consumed_at=? WHERE id=?").bind(now(), record.id).run();
  try {
    const token = await exchangeMetaCode(request, env, code, true);
    const [owner, waba, phonesPayload] = await Promise.all([
      metaGet(env, "me?fields=id,name", token.accessToken).catch(() => ({ id: "business_integration_system_user", name: "Meta Business" })),
      metaGet(env, `${wabaId}?fields=id,name`, token.accessToken).catch(() => ({ id: wabaId, name: "WhatsApp Business" })),
      metaGet(env, `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, token.accessToken),
    ]);
    const phones = Array.isArray(phonesPayload.data) ? phonesPayload.data as Row[] : [];
    const subscribed = await subscribeWhatsAppBusinessAccount(env, wabaId, token.accessToken).catch(() => false);
    const account = { business_id: String(sessionData.business_id || ""), waba_id: wabaId, waba_name: String(waba.name || "WhatsApp Business"), phones };
    const label = String(phones[0]?.display_phone_number || waba.name || "WhatsApp Business");
    const ready = phones.length > 0 && subscribed;
    const encrypted = await encryptIntegrationCredentials(env, { access_token: token.accessToken, expires_in: token.expiresIn, owner, accounts: [account] });
    await upsertIntegration(env, organizationId, "whatsapp", {
      status: ready ? "connected" : "action_required",
      connectedAccount: label,
      metadata: {
        credential: encrypted,
        accounts: [account],
        account_count: 1,
        subscribed_waba_ids: subscribed ? [wabaId] : [],
        connected_by_customer: true,
        coexistence: true,
        preserves_whatsapp_business_app: true,
        history_sync_status: "not_requested",
        embedded_signup_event: String(session.event),
        connected_at: now(),
      },
    });
    return api({ connected: ready, status: ready ? "connected" : "action_required", connected_account: label, coexistence: true });
  } catch (caught) {
    console.error("VAREX AI WhatsApp embedded signup failed", caught);
    return error("تعذر إكمال ربط واتساب مع ميتا. ابدأ الربط من جديد.", 502);
  }
}

async function discoverMetaAssets(env: Env, provider: MetaOAuthProvider, accessToken: string) {
  const owner = await metaGet(env, "me?fields=id,name", accessToken);
  if (provider === "whatsapp") {
    const businessesPayload = await metaGet(env, "me/businesses?fields=id,name", accessToken);
    const businesses = Array.isArray(businessesPayload.data) ? businessesPayload.data as Row[] : [];
    const accounts: Row[] = [];
    for (const business of businesses.slice(0, 20)) {
      const [ownedPayload, clientPayload] = await Promise.all([
        metaGet(env, `${business.id}/owned_whatsapp_business_accounts?fields=id,name`, accessToken).catch(() => ({ data: [] })),
        metaGet(env, `${business.id}/client_whatsapp_business_accounts?fields=id,name`, accessToken).catch(() => ({ data: [] })),
      ]);
      const wabasById = new Map<string, Row>();
      for (const payload of [ownedPayload, clientPayload]) {
        const rows = Array.isArray(payload.data) ? payload.data as Row[] : [];
        for (const waba of rows) if (waba.id) wabasById.set(String(waba.id), waba);
      }
      const wabas = [...wabasById.values()];
      for (const waba of wabas.slice(0, 20)) {
        const phonesPayload = await metaGet(env, `${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name`, accessToken).catch(() => ({ data: [] }));
        const phones = Array.isArray(phonesPayload.data) ? phonesPayload.data as Row[] : [];
        accounts.push({ business_id: business.id, business_name: business.name, waba_id: waba.id, waba_name: waba.name, phones });
      }
    }
    const firstPhone = accounts.flatMap(account => Array.isArray(account.phones) ? account.phones as Row[] : [])[0];
    return { owner, accounts, label: String(firstPhone?.display_phone_number || accounts[0]?.waba_name || owner.name || "WhatsApp Business"), ready: Boolean(firstPhone) };
  }
  const pagesPayload = await metaGet(env, "me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}", accessToken);
  const pages = Array.isArray(pagesPayload.data) ? pagesPayload.data as Row[] : [];
  if (provider === "facebook") return { owner, accounts: pages, label: String(pages[0]?.name || owner.name || "Facebook"), ready: pages.length > 0 };
  const instagram = pages.filter(page => page.instagram_business_account).map(page => ({ page_id: page.id, page_name: page.name, page_access_token: page.access_token, ...(page.instagram_business_account as Row) }));
  return { owner, accounts: instagram, label: String(instagram[0]?.username || instagram[0]?.name || owner.name || "Instagram"), ready: instagram.length > 0 };
}

async function completeMetaIntegration(request: Request, env: Env, provider: MetaOAuthProvider, organizationId: string, code: string) {
  const token = await exchangeMetaCode(request, env, code), assets = await discoverMetaAssets(env, provider, token.accessToken);
  const subscribedWabaIds: string[] = [];
  if (provider === "whatsapp") {
    for (const account of assets.accounts) {
      const wabaId = String(account.waba_id || "");
      if (!wabaId) continue;
      const subscribed = await subscribeWhatsAppBusinessAccount(env, wabaId, token.accessToken).catch(() => false);
      if (subscribed) subscribedWabaIds.push(wabaId);
    }
  }
  const encrypted = await encryptIntegrationCredentials(env, { access_token: token.accessToken, expires_in: token.expiresIn, owner: assets.owner, accounts: assets.accounts });
  const publicAccounts = assets.accounts.map(account => {
    const copy = { ...account }; delete copy.access_token; delete copy.page_access_token; return copy;
  });
  const ready = provider === "whatsapp" ? assets.ready && subscribedWabaIds.length > 0 : assets.ready;
  await upsertIntegration(env, organizationId, provider, {
    status: ready ? "connected" : "action_required",
    connectedAccount: assets.label,
    metadata: { credential: encrypted, accounts: publicAccounts, account_count: publicAccounts.length, subscribed_waba_ids: subscribedWabaIds, connected_by_customer: true, connected_at: now() },
  });
  return ready;
}

function whatsappMessageBody(message: Row) {
  if (message.type === "text" && message.text && typeof message.text === "object") return String((message.text as Row).body || "");
  if (message.type === "button" && message.button && typeof message.button === "object") return String((message.button as Row).text || "[زر واتساب]");
  if (message.type === "interactive" && message.interactive && typeof message.interactive === "object") {
    const interactive = message.interactive as Row;
    const reply = (interactive.button_reply || interactive.list_reply) as Row | undefined;
    return String(reply?.title || reply?.id || "[رد تفاعلي من واتساب]");
  }
  return `[رسالة واتساب: ${String(message.type || "غير معروفة")}]`;
}

async function whatsappIntegrationByPhone(env: Env, phoneNumberId: string) {
  const result = await env.DB.prepare("SELECT * FROM ai_integrations WHERE provider='whatsapp' AND status='connected'").all<Row>();
  for (const integration of result.results) {
    let metadata: Row = {};
    try { metadata = JSON.parse(String(integration.metadata || "{}")) as Row; } catch (_) { continue; }
    const accounts = Array.isArray(metadata.accounts) ? metadata.accounts as Row[] : [];
    const ownsPhone = accounts.some(account => Array.isArray(account.phones) && (account.phones as Row[]).some(phone => String(phone.id || "") === phoneNumberId));
    if (ownsPhone) return { integration, metadata };
  }
  return null;
}

function whatsappReplyNeedsApproval(value: string) {
  return /(?:سعر|الاسعار|الأسعار|تكلفة|كلفة|خصم|عرض\s+مالي|دفعة|دفع|تحويل\s+بنكي|فاتورة|عقد|بند|استرداد|إرجاع|ضمان|تعويض|التزام|قانون|price|pricing|cost|discount|payment|invoice|contract|refund|guarantee|warranty|legal)/iu.test(value);
}

async function recordWhatsAppReplyAudit(env: Env, organizationId: string, userId: string | null, action: string, entityId: string, details: Row) {
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, userId, action, "whatsapp_message", entityId, JSON.stringify(details), stamp, stamp).run();
}

async function replyToWhatsAppInbound(env: Env, inbound: { organizationId: string; messageId: string; sender: string; customerName: string; body: string; phoneNumberId: string }) {
  const agent = await env.DB.prepare("SELECT a.*,p.mode AS reply_mode,o.name AS business_name,o.owner_id,o.requires_price_approval FROM ai_agents a JOIN ai_agent_permissions p ON p.organization_id=a.organization_id AND p.agent_id=a.id AND p.app_key='whatsapp' AND p.action_key='reply' JOIN ai_organizations o ON o.id=a.organization_id WHERE a.organization_id=? AND a.status='active' AND p.mode IN ('approval','automatic') ORDER BY a.created_at ASC LIMIT 1")
    .bind(inbound.organizationId).first<Row>();
  if (!agent) return;
  const owner = await env.DB.prepare("SELECT * FROM ai_users WHERE id=? LIMIT 1").bind(agent.owner_id).first<Row>();
  if (!owner?.id) return;
  const [messageRows, websiteIntegration] = await Promise.all([
    env.DB.prepare("SELECT direction,body,created_at FROM ai_messages WHERE organization_id=? AND channel='whatsapp' AND contact_address=? ORDER BY created_at DESC LIMIT 24").bind(inbound.organizationId, inbound.sender).all<Row>(),
    env.DB.prepare("SELECT metadata FROM ai_integrations WHERE organization_id=? AND provider='website' AND status='connected' LIMIT 1").bind(inbound.organizationId).first<Row>(),
  ]);
  let websiteMetadata: Row = {};
  try { websiteMetadata = JSON.parse(String(websiteIntegration?.metadata || "{}")) as Row; } catch (_) { websiteMetadata = {}; }
  let trustedWebsites: Array<{ name: string; url: string }> = [];
  try { trustedWebsites = normalizeWebsiteSources(websiteMetadata.websites); } catch (_) { trustedWebsites = []; }
  const transcript = ((messageRows.results || []) as Row[]).reverse().map((message: Row) => ({ role: message.direction === "outbound" ? "assistant" : "user", body: String(message.body || "") })).filter((message: { role: string; body: string }) => message.body);
  let credential: { key: string } | null = null;
  try { credential = await platformAiProviderKey(env, "openai"); }
  catch (caught) {
    await recordWhatsAppReplyAudit(env, inbound.organizationId, String(owner.id), "whatsapp_auto_reply_skipped", inbound.messageId, { reason: "AI_ENGINE_NOT_CONFIGURED" }).catch(() => {});
    return;
  }
  if (!credential?.key) return;
  try {
    const reply = await askAiProvider("openai", credential.key, {
      audience: "customer",
      agentName: String(agent.name || "الموظف الذكي"),
      agentRole: String(agent.role || "خدمة عملاء"),
      agentObjective: String(agent.objective || ""),
      agentInstructions: String(agent.instructions || ""),
      language: String(agent.language || "ar"),
      customerName: inbound.customerName,
      businessName: String(agent.business_name || "الشركة"),
      trustedWebsites,
      actionCatalog: "",
      transcript,
    });
    await setAiProviderHealth(env, inbound.organizationId, readyProviderHealth("openai"));
    if (reply.kind !== "text" || !reply.text) {
      await recordWhatsAppReplyAudit(env, inbound.organizationId, String(owner.id), "whatsapp_auto_reply_skipped", inbound.messageId, { reason: "NON_TEXT_REPLY" }).catch(() => {});
      return;
    }
    const replyBody = customerSafeAiText(reply.text).replace(/^\s*(?:الرد\s+المقترح|الرد|رسالة\s+للعميل)\s*[:：-]\s*/iu, "").trim().slice(0, 4096);
    if (!replyBody) return;
    const sensitive = whatsappReplyNeedsApproval(`${inbound.body}\n${replyBody}`);
    const configuredMode = String(agent.reply_mode || "approval");
    const mode = sensitive || (Boolean(agent.requires_price_approval) && whatsappReplyNeedsApproval(replyBody)) ? "approval" : configuredMode;
    const actionBody: Row = {
      organization_id: inbound.organizationId,
      agent_id: agent.id,
      app_key: "whatsapp",
      action_key: "reply",
      target: inbound.customerName || inbound.sender,
      payload: { message: replyBody, to: inbound.sender, phone_number_id: inbound.phoneNumberId, source_message_id: inbound.messageId },
    };
    if (mode === "approval") {
      const execution = await createActionExecution(env, owner, actionBody, "approval", "awaiting_approval");
      if (!execution) return;
      const stamp = now(), preview = replyBody.length > 900 ? `${replyBody.slice(0, 900)}…` : replyBody;
      await env.DB.prepare("INSERT INTO ai_approvals (id,organization_id,task_id,action_execution_id,title,summary,status,requested_by,reviewed_by,reviewed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), inbound.organizationId, null, execution.id, `اعتماد رد WhatsApp إلى ${inbound.customerName || inbound.sender}`, `النص الجاهز للإرسال:\n«${preview}»${sensitive ? "\nتم تحويله للموافقة لأنه يتضمن موضوعاً مالياً أو تعاقدياً حساساً." : ""}`, "pending", owner.id, null, null, stamp, stamp).run();
      await recordWhatsAppReplyAudit(env, inbound.organizationId, String(owner.id), "whatsapp_reply_awaiting_approval", inbound.messageId, { execution_id: execution.id, sensitive });
      return;
    }
    const execution = await createActionExecution(env, owner, actionBody, "automatic", "queued");
    if (!execution) return;
    const executionResult = await performActionExecution(new Request("https://varex.internal/whatsapp-auto-reply"), env, owner, execution);
    await recordWhatsAppReplyAudit(env, inbound.organizationId, String(owner.id), executionResult.ok ? "whatsapp_auto_reply_sent" : "whatsapp_auto_reply_failed", inbound.messageId, { execution_id: execution.id, code: "code" in executionResult ? executionResult.code || null : null });
  } catch (caught) {
    const failure = aiProviderFailure("openai", caught);
    await setAiProviderHealth(env, inbound.organizationId, failure).catch(() => {});
    await recordWhatsAppReplyAudit(env, inbound.organizationId, String(owner.id), "whatsapp_auto_reply_skipped", inbound.messageId, { reason: failure.code }).catch(() => {});
  }
}

async function processWhatsAppWebhook(env: Env, payload: Row, ctx: ExecutionContext) {
  const entries = Array.isArray(payload.entry) ? payload.entry as Row[] : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes as Row[] : [];
    for (const change of changes) {
      if (change.field !== "messages" || !change.value || typeof change.value !== "object") continue;
      const value = change.value as Row;
      const webhookMetadata = value.metadata && typeof value.metadata === "object" ? value.metadata as Row : {};
      const phoneNumberId = String(webhookMetadata.phone_number_id || "");
      if (!phoneNumberId) continue;
      const match = await whatsappIntegrationByPhone(env, phoneNumberId);
      if (!match) continue;
      const organizationId = String(match.integration.organization_id);
      const contacts = Array.isArray(value.contacts) ? value.contacts as Row[] : [];
      const namesByWaId = new Map<string, string>();
      for (const contact of contacts) {
        const profile = contact.profile && typeof contact.profile === "object" ? contact.profile as Row : {};
        namesByWaId.set(String(contact.wa_id || ""), String(profile.name || contact.wa_id || "عميل واتساب"));
      }
      const messages = Array.isArray(value.messages) ? value.messages as Row[] : [];
      for (const message of messages) {
        const messageId = String(message.id || "");
        if (!messageId) continue;
        const sender = String(message.from || "");
        const timestamp = Number(message.timestamp || 0);
        const createdAt = timestamp > 0 ? new Date(timestamp * 1000).toISOString() : now();
        const customerName = namesByWaId.get(sender) || sender || "عميل واتساب";
        const messageBody = whatsappMessageBody(message);
        const inserted = await env.DB.prepare("INSERT OR IGNORE INTO ai_messages (id,organization_id,contact_name,contact_address,channel,direction,body,send_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
          .bind(`wa:${messageId}`, organizationId, customerName, sender || null, "whatsapp", "inbound", messageBody, "received", null, createdAt, now()).run();
        if (Number(inserted.meta?.changes || 0) && sender && !messageBody.startsWith("[رسالة واتساب:")) {
          ctx.waitUntil(replyToWhatsAppInbound(env, { organizationId, messageId: `wa:${messageId}`, sender, customerName, body: messageBody, phoneNumberId }));
        }
      }
      const statuses = Array.isArray(value.statuses) ? value.statuses as Row[] : [];
      for (const status of statuses) {
        const messageId = String(status.id || "");
        if (messageId) await env.DB.prepare("UPDATE ai_messages SET send_status=?,updated_at=? WHERE id=? AND organization_id=?")
          .bind(String(status.status || "updated"), now(), `wa:${messageId}`, organizationId).run();
      }
      await env.DB.prepare("UPDATE ai_integrations SET last_sync_at=?,updated_at=? WHERE id=?").bind(now(), now(), match.integration.id).run();
    }
  }
}

async function whatsappWebhook(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = String(url.searchParams.get("hub.mode") || "");
    const token = String(url.searchParams.get("hub.verify_token") || "");
    const challenge = String(url.searchParams.get("hub.challenge") || "");
    if (mode === "subscribe" && env.META_WHATSAPP_VERIFY_TOKEN && timingSafeEqual(token, env.META_WHATSAPP_VERIFY_TOKEN)) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return error("تعذر التحقق من رابط WhatsApp", 403);
  }
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const rawBody = await request.text();
  if (!await verifyMetaWebhookSignature(env, rawBody, request.headers.get("X-Hub-Signature-256"))) return error("توقيع Meta غير صالح", 401);
  const payload = await Promise.resolve().then(() => JSON.parse(rawBody || "{}") as Row).catch(() => null);
  if (!payload) return error("بيانات WhatsApp المرسلة غير صالحة", 400);
  if (payload.object === "whatsapp_business_account") await processWhatsAppWebhook(env, payload, ctx);
  return api({ received: true });
}

async function deliverWhatsAppText(env: Env, params: { organizationId: string; to: string; messageBody: string; contactName?: string; phoneNumberId?: string; createdBy?: string | null }) {
  const organizationId = String(params.organizationId || ""), to = normalizePhoneDigits(params.to), messageBody = String(params.messageBody || "").trim();
  if (!organizationId || !to || !messageBody || messageBody.length > 4096) return { ok: false, status: 400, code: "INVALID_WHATSAPP_MESSAGE", message: "رقم المستلم ونص الرسالة مطلوبان" };
  const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE organization_id=? AND provider='whatsapp' AND status='connected' LIMIT 1").bind(organizationId).first<Row>();
  if (!integration) return { ok: false, status: 409, code: "WHATSAPP_NOT_CONNECTED", message: "اربط حساب WhatsApp Business أولاً" };
  let metadata: Row = {};
  try { metadata = JSON.parse(String(integration.metadata || "{}")) as Row; } catch (_) { return { ok: false, status: 500, code: "WHATSAPP_LINK_INVALID", message: "بيانات ربط WhatsApp غير صالحة" }; }
  const accounts = Array.isArray(metadata.accounts) ? metadata.accounts as Row[] : [];
  const phones = accounts.flatMap(account => Array.isArray(account.phones) ? account.phones as Row[] : []);
  const requestedPhoneId = String(params.phoneNumberId || "");
  const phone = phones.find(item => String(item.id || "") === requestedPhoneId) || phones[0];
  if (!phone?.id) return { ok: false, status: 409, code: "WHATSAPP_PHONE_NOT_FOUND", message: "لم يتم العثور على رقم WhatsApp Business صالح" };
  const encrypted = metadata.credential && typeof metadata.credential === "object" ? metadata.credential as Row : null;
  if (!encrypted) return { ok: false, status: 500, code: "WHATSAPP_CREDENTIAL_MISSING", message: "بيانات دخول WhatsApp غير متوفرة" };
  const credentials = await decryptIntegrationCredentials(env, encrypted);
  const accessToken = String(credentials.access_token || "");
  if (!accessToken) return { ok: false, status: 401, code: "WHATSAPP_LINK_EXPIRED", message: "انتهت صلاحية ربط WhatsApp؛ أعد الربط" };
  const { graphVersion } = await metaConfig(env);
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(String(phone.id))}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: messageBody } }),
  });
  const result = await response.json<Row>().catch(() => ({}));
  const metaError = result.error && typeof result.error === "object" ? result.error as Row : null;
  if (!response.ok || metaError) {
    const code = Number(metaError?.code || 0), subcode = Number(metaError?.error_subcode || 0);
    console.error("VAREX AI WhatsApp send failed", response.status, { code, subcode, type: metaError?.type || null });
    if (code === 131047) return { ok: false, status: 409, code: "WHATSAPP_TEMPLATE_REQUIRED", message: "انتهت نافذة محادثة واتساب لمدة 24 ساعة. لازم تبدأ الرسالة بقالب معتمد من Meta، وبعد ما يرد المستلم فينا نكمل رسائل عادية." };
    if (code === 131030) return { ok: false, status: 409, code: "WHATSAPP_RECIPIENT_NOT_ALLOWED", message: "Meta رفضت رقم المستلم. تأكدي أن الرقم صحيح مع رمز الدولة وأنه حساب واتساب فعّال." };
    if (code === 190) return { ok: false, status: 401, code: "WHATSAPP_LINK_EXPIRED", message: "انتهت صلاحية ربط WhatsApp Business. يجب إعادة ربط الحساب من إعدادات VAREX AI." };
    return { ok: false, status: 502, code: "WHATSAPP_META_REJECTED", message: `رفضت Meta إرسال الرسالة${code ? ` (رمز ${code})` : ""}. تحقق من الرقم ونافذة 24 ساعة أو استخدم قالباً معتمداً.` };
  }
  const sent = Array.isArray(result.messages) ? (result.messages as Row[])[0] : null;
  const messageId = String(sent?.id || crypto.randomUUID());
  const stamp = now();
  await env.DB.prepare("INSERT OR REPLACE INTO ai_messages (id,organization_id,contact_name,contact_address,channel,direction,body,send_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(`wa:${messageId}`, organizationId, String(params.contactName || to), to, "whatsapp", "outbound", messageBody, "sent", params.createdBy || null, stamp, stamp).run();
  return { ok: true, status: 200, messageId, message: "تم إرسال رسالة WhatsApp" };
}

async function sendWhatsAppMessage(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const result = await deliverWhatsAppText(env, {
    organizationId,
    to: String(body.to || ""),
    messageBody: String(body.body || ""),
    contactName: String(body.contact_name || body.to || ""),
    phoneNumberId: String(body.phone_number_id || ""),
    createdBy: String(user.id),
  });
  return api(result.ok ? { ok: true, message_id: result.messageId } : { code: result.code, message: result.message }, result.status);
}

const knowledgeMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function uploadKnowledgeFile(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!env.FILES) return error("تخزين الملفات غير مفعّل في هذه النسخة", 503);
  const form = await request.formData().catch(() => null);
  if (!form) return error("تعذر قراءة الملف المرسل");
  const organizationId = String(form.get("organization_id") || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const candidate = form.get("file");
  if (!(candidate instanceof File)) return error("اختر ملفاً صالحاً");
  if (!knowledgeMimeTypes.has(candidate.type)) return error("نوع الملف غير مدعوم؛ استخدم PDF أو DOCX أو XLSX");
  if (candidate.size <= 0 || candidate.size > 10 * 1024 * 1024) return error("حجم الملف يجب أن يكون بين 1 بايت و10 MB");
  const displayName = candidate.name.trim().slice(0, 180) || "knowledge-file";
  const safeName = displayName.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "file";
  const id = crypto.randomUUID(), storagePath = `${organizationId}/${id}/${safeName}`, stamp = now();
  await env.FILES.put(storagePath, candidate.stream(), {
    httpMetadata: { contentType: candidate.type },
    customMetadata: { organizationId, itemId: id, originalName: displayName },
  });
  try {
    await env.DB.prepare("INSERT INTO ai_knowledge_items (id,organization_id,title,file_type,file_size,storage_path,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(id, organizationId, displayName, candidate.type, candidate.size, storagePath, "stored", user.id, stamp, stamp).run();
  } catch (caught) {
    await env.FILES.delete(storagePath);
    throw caught;
  }
  const row = await env.DB.prepare("SELECT * FROM ai_knowledge_items WHERE id=? LIMIT 1").bind(id).first<Row>();
  return api([hydrate(row!)], 201);
}

async function downloadKnowledgeFile(request: Request, env: Env, itemId: string) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!env.FILES) return error("تخزين الملفات غير مفعّل في هذه النسخة", 503);
  const item = await env.DB.prepare("SELECT * FROM ai_knowledge_items WHERE id=? LIMIT 1").bind(itemId).first<Row>();
  if (!item) return error("الملف غير موجود", 404);
  if (!await authorizeOrg(env, user, String(item.organization_id))) return error("ليست لديك صلاحية على هذا الملف", 403);
  const storagePath = String(item.storage_path || "");
  if (!storagePath) return error("محتوى هذا المرجع غير مخزّن", 409);
  const object = await env.FILES.get(storagePath);
  if (!object) return error("تعذر العثور على محتوى الملف", 404);
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  object.writeHttpMetadata(headers);
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(item.title || "VAREX-file"))}`);
  return new Response(object.body, { headers });
}

async function completeTikTokIntegration(request: Request, env: Env, organizationId: string, code: string) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) throw new Error("PROVIDER_NOT_CONFIGURED");
  const redirectUri = tikTokRedirectUri(request, env);
  const body = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirectUri });
  const payload = await responseJson(await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }));
  const token = payload.data && typeof payload.data === "object" ? payload.data as Row : payload;
  const accessToken = String(token.access_token || ""); if (!accessToken) throw new Error("PROVIDER_TOKEN_MISSING");
  const profilePayload = await responseJson(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", { headers: { Authorization: `Bearer ${accessToken}` } }));
  const profileContainer = profilePayload.data && typeof profilePayload.data === "object" ? profilePayload.data as Row : profilePayload;
  const profile = profileContainer.user && typeof profileContainer.user === "object" ? profileContainer.user as Row : profileContainer;
  const scopes = String(token.scope || "").split(",").map(scope => scope.trim()).filter(Boolean);
  const encrypted = await encryptIntegrationCredentials(env, { access_token: accessToken, refresh_token: token.refresh_token, access_token_expires_in: token.expires_in, refresh_token_expires_in: token.refresh_expires_in, open_id: token.open_id, scope: scopes });
  await upsertIntegration(env, organizationId, "tiktok", { status: "connected", connectedAccount: String(profile.display_name || token.open_id || "TikTok"), metadata: { credential: encrypted, account: profile, scopes, connected_by_customer: true, connected_at: now(), capability: scopes.includes("video.publish") ? "content_posting" : "account_identity" } });
}

async function completeGoogleIntegration(request: Request, env: Env, organizationId: string, provider: "email" | "youtube", code: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("PROVIDER_NOT_CONFIGURED");
  const tokenPayload = await responseJson(await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(request, env),
    }),
  }));
  const accessToken = String(tokenPayload.access_token || "");
  if (!accessToken) throw new Error("PROVIDER_TOKEN_MISSING");
  const profile = await responseJson(await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } }));
  const scopes = String(tokenPayload.scope || "").split(/\s+/).filter(Boolean);
  let connectedAccount = String(profile.email || profile.name || "Google account");
  let status = "connected";
  let channel: Row | null = null;
  if (provider === "email") {
    const gmail = await responseJson(await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${accessToken}` } }));
    connectedAccount = String(gmail.emailAddress || connectedAccount);
  } else {
    const channelPayload = await responseJson(await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } }));
    const channels = Array.isArray(channelPayload.items) ? channelPayload.items as Row[] : [];
    channel = channels[0] || null;
    if (channel) {
      const snippet = channel.snippet && typeof channel.snippet === "object" ? channel.snippet as Row : {};
      connectedAccount = String(snippet.title || connectedAccount);
    } else status = "action_required";
  }
  const encrypted = await encryptIntegrationCredentials(env, {
    access_token: accessToken,
    refresh_token: tokenPayload.refresh_token || null,
    expires_in: tokenPayload.expires_in || null,
    token_type: tokenPayload.token_type || "Bearer",
    scope: scopes,
  });
  await upsertIntegration(env, organizationId, provider, {
    status,
    connectedAccount,
    metadata: { credential: encrypted, account: profile, channel, scopes, connected_by_customer: true, connected_at: now() },
  });
  return status === "connected";
}

async function integrationCallback(request: Request, env: Env, callbackProvider: "meta" | "tiktok" | "google") {
  const url = new URL(request.url), state = String(url.searchParams.get("state") || "");
  if (!state) return integrationPopupResponse(request, env, { integration: "error", reason: "invalid_state" });
  const record = await env.DB.prepare("SELECT * FROM ai_oauth_states WHERE state_hash=? AND consumed_at IS NULL LIMIT 1").bind(await sha256(state)).first<Row>();
  if (!record || String(record.expires_at) <= now()) return integrationPopupResponse(request, env, { integration: "error", reason: "invalid_state" });
  const provider = String(record.provider) as OAuthProvider;
  const expectedCallback = provider === "tiktok" ? "tiktok" : provider === "email" || provider === "youtube" ? "google" : "meta";
  if (callbackProvider !== expectedCallback) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "invalid_provider" });
  await env.DB.prepare("UPDATE ai_oauth_states SET consumed_at=? WHERE id=?").bind(now(), record.id).run();
  if (url.searchParams.get("error")) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "cancelled" });
  const code = String(url.searchParams.get("code") || "");
  if (!code) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "missing_code" });
  try {
    let ready = true;
    if (provider === "tiktok") await completeTikTokIntegration(request, env, String(record.organization_id), code);
    else if (provider === "email" || provider === "youtube") ready = await completeGoogleIntegration(request, env, String(record.organization_id), provider, code);
    else ready = await completeMetaIntegration(request, env, provider, String(record.organization_id), code);
    return integrationPopupResponse(request, env, { integration: ready ? "connected" : "action_required", provider });
  } catch (caught) {
    console.error("VAREX AI integration callback failed", provider, caught);
    return integrationPopupResponse(request, env, { integration: "error", provider, reason: caught instanceof Error ? caught.message : "connection_failed" });
  }
}

async function disconnectIntegration(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim();
  const provider = String(body.provider || "").trim();
  const disconnectable = new Set([...oauthProviders, "parking"]);
  if (!organizationId || !disconnectable.has(provider)) return error("حدد التطبيق المطلوب إلغاء ربطه", 400);
  if (!await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع إلغاء الربط", 403);
  const record = await env.DB.prepare("SELECT * FROM ai_integrations WHERE organization_id=? AND provider=? LIMIT 1").bind(organizationId, provider).first<Row>();
  if (!record) return api({ ok: true, provider, status: "disconnected" });
  if (provider === "email" || provider === "youtube") {
    try {
      const metadata = JSON.parse(String(record.metadata || "{}")) as Row;
      if (metadata.credential && typeof metadata.credential === "object") {
        const credentials = await decryptIntegrationCredentials(env, metadata.credential as Row);
        const token = String(credentials.refresh_token || credentials.access_token || "");
        if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      }
    } catch (caught) { console.error("VAREX Google revoke failed", provider, caught instanceof Error ? caught.message : caught); }
  }
  const stamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_integrations SET status='disconnected',connected_account=NULL,last_sync_at=?,metadata=?,updated_at=? WHERE id=?")
      .bind(stamp, JSON.stringify({ disconnected_at: stamp, disconnected_by_customer: true }), stamp, record.id),
    env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, user.id, "integration_disconnected", "integration", record.id, JSON.stringify({ provider }), stamp, stamp),
  ]);
  return api({ ok: true, provider, status: "disconnected" });
}

async function permissionCenterSnapshot(env: Env, organizationId: string, agentId: string) {
  const [permissions, devices, voice, integrations] = await Promise.all([
    env.DB.prepare("SELECT * FROM ai_agent_permissions WHERE organization_id=? AND agent_id=? ORDER BY app_key,action_key").bind(organizationId, agentId).all<Row>(),
    env.DB.prepare("SELECT * FROM ai_device_connections WHERE organization_id=? ORDER BY updated_at DESC").bind(organizationId).all<Row>(),
    env.DB.prepare("SELECT * FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>(),
    env.DB.prepare("SELECT provider,status,connected_account,last_sync_at FROM ai_integrations WHERE organization_id=?").bind(organizationId).all<Row>(),
  ]);
  return {
    catalog: deviceAppCatalog,
    permissions: permissions.results.map(row => hydrate(row as Row)),
    devices: devices.results.map(row => presentDeviceConnection(row as Row)),
    voice: voice ? hydrate(voice) : null,
    integrations: integrations.results,
  };
}

async function permissionCenter(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), method = request.method.toUpperCase();
  const body = method === "GET" ? {} as Row : await request.json<Row>().catch(() => ({}));
  const organizationId = String(method === "GET" ? url.searchParams.get("organization_id") || "" : body.organization_id || "");
  const agentId = String(method === "GET" ? url.searchParams.get("agent_id") || "" : body.agent_id || "");
  if (!organizationId || !agentId) return error("اختر الموظف الذكي أولاً");
  const ownerOnly = method !== "GET";
  if (!await authorizeOrg(env, user, organizationId, ownerOnly)) return error(ownerOnly ? "مالك المساحة فقط يستطيع تعديل الصلاحيات" : "ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id,name,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  if (method === "GET") return api({ agent: hydrate(agent), ...(await permissionCenterSnapshot(env, organizationId, agentId)) });
  if (method !== "PUT") return error("الطريقة غير مدعومة", 405);
  const requested = Array.isArray(body.permissions) ? body.permissions as Row[] : [];
  if (!requested.length || requested.length > 100) return error("أرسل قائمة صلاحيات صالحة");
  const stamp = now(), statements: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  for (const item of requested) {
    const appKey = String(item.app_key || ""), actionKey = String(item.action_key || ""), mode = String(item.mode || "");
    const action = deviceAppCatalog[appKey]?.actions[actionKey];
    if (!action || !permissionModes.has(mode)) return error(`إعداد الصلاحية غير صالح: ${appKey}.${actionKey}`);
    const key = `${appKey}.${actionKey}`; if (seen.has(key)) continue; seen.add(key);
    statements.push(env.DB.prepare("INSERT INTO ai_agent_permissions (id,organization_id,agent_id,app_key,action_key,mode,risk_level,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,agent_id,app_key,action_key) DO UPDATE SET mode=excluded.mode,risk_level=excluded.risk_level,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
      .bind(crypto.randomUUID(), organizationId, agentId, appKey, actionKey, mode, action.risk, user.id, stamp, stamp));
  }
  const permissionCount = statements.length;
  if (body.voice && typeof body.voice === "object") {
    const voice = body.voice as Row;
    const settings = voice.settings && typeof voice.settings === "object" ? voice.settings as Row : {};
    const currentVoice = await env.DB.prepare("SELECT caller_id,status,settings FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>();
    const requestedCallerId = String(voice.caller_id || "").trim();
    if (currentVoice?.status === "connected" && phoneE164(requestedCallerId) !== phoneE164(currentVoice.caller_id)) return error("لفصل الرقم الموثّق أو تغييره استخدم زر فصل الرقم ثم أعد التوثيق");
    const callerId = currentVoice?.status === "connected" ? String(currentVoice.caller_id || "") : requestedCallerId;
    const voiceId = String(voice.voice_id || "Sulafat").trim();
    const disclosureText = String(voice.disclosure_text || "").trim();
    const dailyCallLimit = Number(settings.daily_call_limit || 0), maxCallMinutes = Number(settings.max_call_minutes || 0);
    const allowedFrom = String(settings.allowed_from || ""), allowedTo = String(settings.allowed_to || "");
    if (callerId.length > 40) return error("رقم المتصل أطول من الحد المسموح");
    if (!GEMINI_VOICES.has(voiceId)) return error("اختر صوتاً متاحاً من مكتبة VAREX");
    if (disclosureText.length < 10 || disclosureText.length > 500) return error("نص تعريف الموظف الصوتي يجب أن يكون بين 10 و500 حرف");
    if (!Number.isInteger(dailyCallLimit) || dailyCallLimit < 1 || dailyCallLimit > 100) return error("حد المكالمات اليومي يجب أن يكون بين 1 و100");
    if (!Number.isInteger(maxCallMinutes) || maxCallMinutes < 1 || maxCallMinutes > 60) return error("حد مدة المكالمة يجب أن يكون بين دقيقة و60 دقيقة");
    if (!/^\d{2}:\d{2}$/.test(allowedFrom) || !/^\d{2}:\d{2}$/.test(allowedTo) || allowedFrom >= allowedTo) return error("حدد ساعات اتصال صحيحة؛ وقت البداية يجب أن يسبق وقت النهاية");
    let savedSettings: Row = {};
    try { savedSettings = JSON.parse(String(currentVoice?.settings || "{}")) as Row; } catch (_) { savedSettings = {}; }
    const voiceSettings = { ...savedSettings, daily_call_limit: dailyCallLimit, max_call_minutes: maxCallMinutes, allowed_from: allowedFrom, allowed_to: allowedTo };
    statements.push(env.DB.prepare("INSERT INTO ai_voice_settings (id,organization_id,agent_id,provider,status,caller_id,voice_id,disclosure_text,settings,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,agent_id) DO UPDATE SET caller_id=excluded.caller_id,voice_id=excluded.voice_id,disclosure_text=excluded.disclosure_text,settings=excluded.settings,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
      .bind(crypto.randomUUID(), organizationId, agentId, "not_configured", "not_connected", callerId || null, voiceId, disclosureText, JSON.stringify(voiceSettings), user.id, stamp, stamp));
  }
  if (statements.length) await env.DB.batch(statements);
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "agent_permissions_updated", "agent", agentId, JSON.stringify({ permission_count: permissionCount }), stamp, stamp).run();
  return api({ ok: true, agent: hydrate(agent), ...(await permissionCenterSnapshot(env, organizationId, agentId)) });
}

async function emergencyStopAgent(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), agentId = String(body.agent_id || "");
  if (!organizationId || !agentId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع إيقاف الموظف وسحب صلاحياته", 403);
  const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const stamp = now();
  const activeCalls = await env.DB.prepare("SELECT provider_call_id FROM ai_voice_calls WHERE organization_id=? AND agent_id=? AND status IN ('queued','initiated','ringing','accepting','in_progress') AND provider_call_id IS NOT NULL").bind(organizationId, agentId).all<Row>();
  const gateway = await voiceGatewayConfig(env);
  if (gateway.accountId && gateway.authSecret) {
    for (const call of activeCalls.results || []) {
      try { await voiceGatewayRequest(gateway, `Calls/${encodeURIComponent(String(call.provider_call_id))}.json`, { method: "POST", form: { Status: "completed" } }); }
      catch (_) { /* The database stop remains authoritative even if the carrier already ended the call. */ }
    }
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_agents SET status='paused',updated_at=? WHERE id=? AND organization_id=?").bind(stamp, agentId, organizationId),
    env.DB.prepare("UPDATE ai_agent_permissions SET mode='denied',updated_by=?,updated_at=? WHERE agent_id=? AND organization_id=?").bind(user.id, stamp, agentId, organizationId),
    env.DB.prepare("UPDATE ai_tasks SET status='cancelled',output='أوقف المالك الموظف وسحب صلاحياته',completed_at=?,updated_at=? WHERE organization_id=? AND id IN (SELECT task_id FROM ai_action_executions WHERE agent_id=? AND organization_id=? AND status IN ('queued','awaiting_approval','running') AND task_id IS NOT NULL)").bind(stamp, stamp, organizationId, agentId, organizationId),
    env.DB.prepare("UPDATE ai_action_executions SET status='cancelled',error_code='EMERGENCY_STOP',result_summary='أوقف المالك الموظف وسحب صلاحياته',completed_at=?,updated_at=? WHERE agent_id=? AND organization_id=? AND status IN ('queued','awaiting_approval','running')").bind(stamp, stamp, agentId, organizationId),
    env.DB.prepare("UPDATE ai_voice_calls SET status='cancelled',error_code='EMERGENCY_STOP',completed_at=?,updated_at=? WHERE agent_id=? AND organization_id=? AND status IN ('queued','initiated','ringing','accepting','in_progress')").bind(stamp, stamp, agentId, organizationId),
    env.DB.prepare("UPDATE ai_approvals SET status='rejected',reviewed_by=?,reviewed_at=?,updated_at=? WHERE organization_id=? AND action_execution_id IN (SELECT id FROM ai_action_executions WHERE agent_id=? AND organization_id=? AND error_code='EMERGENCY_STOP') AND status='pending'").bind(user.id, stamp, stamp, organizationId, agentId, organizationId),
    env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), organizationId, user.id, "agent_emergency_stopped", "agent", agentId, JSON.stringify({ permissions_revoked: true }), stamp, stamp),
  ]);
  return api({ ok: true, message: "تم إيقاف الموظف فوراً وسحب جميع صلاحياته" });
}

function nativeCapabilities(value: unknown) {
  const requested = Array.isArray(value) ? value.map(item => String(item)) : [];
  return [...new Set(requested.filter(item => nativeDeviceApps.has(item)))];
}

function presentDeviceConnection(row: Row) {
  const device = hydrate(row);
  const lastSeen = Date.parse(String(device.last_seen_at || ""));
  const online = device.status === "connected" && Number.isFinite(lastSeen) && lastSeen >= Date.now() - nativeDeviceOnlineWindowMs;
  device.online = online;
  device.connection_state = device.status !== "connected" ? "disconnected" : online ? "online" : "offline";
  return device;
}

function requestedDevicePlatform(request: Request, body: Row) {
  const legacyAndroidRoute = new URL(request.url).pathname.includes("/devices/android/");
  const platform = String(body.platform || (legacyAndroidRoute ? "android" : "")).trim().toLocaleLowerCase();
  return nativeDevicePlatforms.has(platform) ? platform : "";
}

async function registerDevice(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  const platform = requestedDevicePlatform(request, body);
  const deviceName = String(body.device_name || (platform === "ios" ? "iPhone أو iPad" : "هاتف Android")).trim();
  const appVersion = String(body.app_version || "1.0.0").trim();
  const capabilities = nativeCapabilities(body.capabilities);
  if (!organizationId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع ربط الهاتف", 403);
  if (!platform) return error("نظام الجهاز غير مدعوم أو غير محدد");
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(deviceId)) return error("معرّف الهاتف غير صالح");
  if (!deviceName || deviceName.length > 80 || appVersion.length > 32) return error("بيانات الهاتف غير صالحة");
  if (!capabilities.length) return error("لم يمنح الجهاز أي صلاحية مدعومة بعد");
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_device_connections (id,organization_id,user_id,device_id,device_name,platform,status,app_version,capabilities,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'connected',?,?,?,?,?) ON CONFLICT(organization_id,device_id) DO UPDATE SET user_id=excluded.user_id,device_name=excluded.device_name,platform=excluded.platform,status='connected',app_version=excluded.app_version,capabilities=excluded.capabilities,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at")
    .bind(crypto.randomUUID(), organizationId, user.id, deviceId, deviceName, platform, appVersion, JSON.stringify(capabilities), stamp, stamp, stamp).run();
  const device = await env.DB.prepare("SELECT * FROM ai_device_connections WHERE organization_id=? AND device_id=? LIMIT 1").bind(organizationId, deviceId).first<Row>();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "device_connected", "device", device?.id || deviceId, JSON.stringify({ device_id: deviceId, platform, app_version: appVersion, capabilities }), stamp, stamp).run();
  return api({ ok: true, message: `تم ربط ${deviceName} بنجاح`, device: device ? presentDeviceConnection(device) : null });
}

async function disconnectDevice(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), deviceId = String(body.device_id || "").trim();
  if (!organizationId || !deviceId || !await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع فصل الهاتف", 403);
  const stamp = now();
  const result = await env.DB.prepare("UPDATE ai_device_connections SET status='disconnected',last_seen_at=?,updated_at=? WHERE organization_id=? AND device_id=? AND user_id=?")
    .bind(stamp, stamp, organizationId, deviceId, user.id).run();
  if (!Number(result.meta?.changes || 0)) return error("الهاتف غير مربوط بهذا الحساب", 404);
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_tasks SET status='cancelled',output='تم فصل الهاتف قبل اكتمال التنفيذ',completed_at=?,updated_at=? WHERE organization_id=? AND id IN (SELECT task_id FROM ai_action_executions WHERE organization_id=? AND device_id=? AND status IN ('queued','running') AND task_id IS NOT NULL)")
      .bind(stamp, stamp, organizationId, organizationId, deviceId),
    env.DB.prepare("UPDATE ai_action_executions SET status='cancelled',error_code='DEVICE_DISCONNECTED',result_summary='تم فصل الهاتف قبل اكتمال التنفيذ',completed_at=?,updated_at=? WHERE organization_id=? AND device_id=? AND status IN ('queued','running')")
      .bind(stamp, stamp, organizationId, deviceId),
  ]);
  return api({ ok: true, message: "تم فصل الهاتف وإيقاف استقبال الأوامر" });
}

async function pollDeviceCommand(request: Request, env: Env) {
  if (request.method !== "GET") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), organizationId = String(url.searchParams.get("organization_id") || "").trim(), deviceId = String(url.searchParams.get("device_id") || "").trim();
  if (!organizationId || !deviceId || !await authorizeOrg(env, user, organizationId, true)) return error("تعذر التحقق من الهاتف المربوط", 403);
  const device = await env.DB.prepare("SELECT * FROM ai_device_connections WHERE organization_id=? AND device_id=? AND user_id=? AND status='connected' LIMIT 1")
    .bind(organizationId, deviceId, user.id).first<Row>();
  if (!device) return error("هذا الهاتف غير مربوط أو تم فصله", 409);
  const stamp = now(), staleBefore = new Date(Date.now() - 5 * 60000).toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_device_connections SET last_seen_at=?,updated_at=? WHERE id=?").bind(stamp, stamp, device.id),
    env.DB.prepare("UPDATE ai_tasks SET status='failed',output='انقطع اتصال الهاتف قبل تأكيد النتيجة؛ لم تُكرر العملية تلقائياً حمايةً من التنفيذ المزدوج.',completed_at=?,updated_at=? WHERE organization_id=? AND id IN (SELECT task_id FROM ai_action_executions WHERE organization_id=? AND status='running' AND claimed_at<? AND app_key IN ('contacts','calendar','alarms','phone','settings') AND task_id IS NOT NULL)")
      .bind(stamp, stamp, organizationId, organizationId, staleBefore),
    env.DB.prepare("UPDATE ai_action_executions SET status='failed',error_code='DEVICE_RESULT_TIMEOUT',result_summary='انقطع اتصال الهاتف قبل تأكيد النتيجة؛ لم تُكرر العملية تلقائياً حمايةً من التنفيذ المزدوج.',completed_at=?,updated_at=? WHERE organization_id=? AND status='running' AND claimed_at<? AND app_key IN ('contacts','calendar','alarms','phone','settings')")
      .bind(stamp, stamp, organizationId, staleBefore),
  ]);
  const candidates = await env.DB.prepare("SELECT e.* FROM ai_action_executions e JOIN ai_agents a ON a.id=e.agent_id AND a.organization_id=e.organization_id JOIN ai_agent_permissions p ON p.organization_id=e.organization_id AND p.agent_id=e.agent_id AND p.app_key=e.app_key AND p.action_key=e.action_key WHERE e.organization_id=? AND e.status='queued' AND e.app_key IN ('contacts','calendar','alarms','phone','settings') AND (e.device_id IS NULL OR e.device_id=?) AND a.status='active' AND p.mode!='denied' ORDER BY e.created_at ASC LIMIT 5")
    .bind(organizationId, deviceId).all<Row>();
  for (const candidate of candidates.results || []) {
    const claim = await env.DB.prepare("UPDATE ai_action_executions SET status='running',device_id=?,claimed_at=?,started_at=COALESCE(started_at,?),result_summary='استلم الجهاز المهمة',updated_at=? WHERE id=? AND organization_id=? AND status='queued' AND (device_id IS NULL OR device_id=?)")
      .bind(deviceId, stamp, stamp, stamp, candidate.id, organizationId, deviceId).run();
    if (!Number(claim.meta?.changes || 0)) continue;
    if (candidate.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='running',started_at=COALESCE(started_at,?),output='استلم الجهاز المهمة',updated_at=? WHERE id=? AND organization_id=?")
      .bind(stamp, stamp, candidate.task_id, organizationId).run();
    const command = hydrate({ ...candidate, status: "running", device_id: deviceId, claimed_at: stamp, started_at: candidate.started_at || stamp });
    return api({ ok: true, command, poll_after_seconds: 3 });
  }
  return api({ ok: true, command: null, poll_after_seconds: 15, server_time: stamp });
}

async function finishDeviceCommand(request: Request, env: Env, executionId: string) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), deviceId = String(body.device_id || "").trim();
  const status = String(body.status || ""), summary = String(body.summary || "").trim().slice(0, 1000), errorCode = String(body.error_code || "").trim().slice(0, 80);
  const details = body.details && typeof body.details === "object" ? body.details as Row : {};
  if (!organizationId || !deviceId || !["completed", "failed", "cancelled"].includes(status)) return error("نتيجة التنفيذ غير صالحة");
  if (JSON.stringify(details).length > 16000) return error("تفاصيل النتيجة أكبر من الحد المسموح");
  if (!await authorizeOrg(env, user, organizationId, true)) return error("تعذر التحقق من الهاتف المربوط", 403);
  const device = await env.DB.prepare("SELECT id,platform FROM ai_device_connections WHERE organization_id=? AND device_id=? AND user_id=? AND status='connected' LIMIT 1")
    .bind(organizationId, deviceId, user.id).first<Row>();
  if (!device) return error("هذا الهاتف غير مربوط أو تم فصله", 409);
  const execution = await env.DB.prepare("SELECT * FROM ai_action_executions WHERE id=? AND organization_id=? AND device_id=? LIMIT 1")
    .bind(executionId, organizationId, deviceId).first<Row>();
  if (!execution) return error("مهمة الهاتف غير موجودة", 404);
  if (execution.status !== "running") return error("تمت معالجة مهمة الهاتف مسبقاً", 409);
  const stamp = now(), finalSummary = summary || (status === "completed" ? "تم تنفيذ المهمة على الجهاز" : "تعذر تنفيذ المهمة على الجهاز");
  const result = await env.DB.prepare("UPDATE ai_action_executions SET status=?,result_summary=?,result_details=?,error_code=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=? AND device_id=? AND status='running'")
    .bind(status, finalSummary, JSON.stringify(details), status === "completed" ? null : errorCode || "DEVICE_EXECUTION_FAILED", stamp, stamp, executionId, organizationId, deviceId).run();
  if (!Number(result.meta?.changes || 0)) return error("تمت معالجة مهمة الهاتف مسبقاً", 409);
  if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status=?,output=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=?")
    .bind(status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "failed", finalSummary, stamp, stamp, execution.task_id, organizationId).run();
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_device_connections SET last_seen_at=?,updated_at=? WHERE id=?").bind(stamp, stamp, device.id),
    env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, user.id, "device_command_finished", "action_execution", executionId, JSON.stringify({ device_id: deviceId, platform: device.platform, status, error_code: status === "completed" ? null : errorCode || "DEVICE_EXECUTION_FAILED" }), stamp, stamp),
  ]);
  return api({ ok: true, message: finalSummary, execution_id: executionId, status });
}

class AgentActionError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.code = code; this.status = status; }
}

async function createActionExecution(env: Env, user: Row, body: Row, mode: string, status: string, errorCode: string | null = null, resultSummary: string | null = null) {
  const id = crypto.randomUUID(), stamp = now();
  await env.DB.prepare("INSERT INTO ai_action_executions (id,organization_id,agent_id,task_id,app_key,action_key,permission_mode,status,target,request_payload,result_summary,result_details,error_code,approved_by,approved_at,started_at,completed_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, body.organization_id, body.agent_id || null, body.task_id || null, body.app_key, body.action_key, mode, status, body.target || null, JSON.stringify(body.payload || {}), resultSummary, JSON.stringify({}), errorCode, null, null, null, status === "blocked" ? stamp : null, user.id, stamp, stamp).run();
  return await env.DB.prepare("SELECT * FROM ai_action_executions WHERE id=? LIMIT 1").bind(id).first<Row>();
}

async function resolveSavedContactNumber(env: Env, organizationId: string, target: string) {
  const digits = normalizePhoneDigits(target);
  if (digits.length >= 8) return digits;
  const normalizeName = (value: string) => value.trim().toLocaleLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
  const result = await env.DB.prepare("SELECT contact_name,contact_address FROM ai_messages WHERE organization_id=? AND contact_address IS NOT NULL ORDER BY created_at DESC LIMIT 250")
    .bind(organizationId).all<Row>();
  const wanted = normalizeName(target);
  const row = result.results.find(item => normalizeName(String(item.contact_name || "")) === wanted);
  return normalizePhoneDigits(row?.contact_address || "");
}

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function voicePolicySettings(row: Row) {
  let settings: Row = {};
  try { settings = JSON.parse(String(row.settings || "{}")) as Row; } catch (_) { settings = {}; }
  return {
    dailyCallLimit: Math.max(1, Math.min(100, Number(settings.daily_call_limit || 10))),
    maxCallMinutes: Math.max(1, Math.min(60, Number(settings.max_call_minutes || 10))),
    allowedFrom: String(settings.allowed_from || "09:00"),
    allowedTo: String(settings.allowed_to || "18:00"),
  };
}

function localTimeInZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const hour = parts.find(part => part.type === "hour")?.value || "00";
    const minute = parts.find(part => part.type === "minute")?.value || "00";
    return `${hour}:${minute}`;
  } catch (_) { return new Date().toISOString().slice(11, 16); }
}

async function startAiVoiceCall(request: Request, env: Env, user: Row, execution: Row, payload: Row) {
  const organizationId = String(execution.organization_id), agentId = String(execution.agent_id || "");
  if (String(execution.action_key) !== "speak_on_behalf") throw new AgentActionError("VOICE_ACTION_NOT_AVAILABLE", "هذه العملية الصوتية لم تُفعّل بعد؛ الاتصال والتحدث هما المتاحان حالياً.");
  const [voice, organization, agent, openaiCredential, gateway] = await Promise.all([
    env.DB.prepare("SELECT * FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>(),
    env.DB.prepare("SELECT timezone FROM ai_organizations WHERE id=? LIMIT 1").bind(organizationId).first<Row>(),
    env.DB.prepare("SELECT name,role,instructions FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>(),
    platformAiProviderKey(env, "openai"),
    voiceGatewayConfig(env),
  ]);
  if (!voice || voice.status !== "connected" || !voice.caller_id) throw new AgentActionError("VOICE_CALLER_NOT_VERIFIED", "وثّق رقمك الأساسي من قسم المكالمات قبل بدء اتصال ذكي.");
  if (!gateway.accountId || !gateway.authSecret) throw new AgentActionError("VOICE_GATEWAY_NOT_CONFIGURED", "سنترال المكالمات غير مربوط بعد. يلزم إعداد السنترال من حساب إدارة VAREX.");
  if (!gateway.projectId || !gateway.webhookSecret) throw new AgentActionError("VOICE_SIP_NOT_CONFIGURED", "مسار SIP غير مكتمل. يلزم إضافة معرّف مشروع الذكاء ومفتاح توقيع المكالمات.");
  if (!openaiCredential?.key) throw new AgentActionError("VOICE_AI_NOT_CONFIGURED", "مفتاح الذكاء غير مضاف إلى VAREX بعد.");
  const explicit = normalizePhoneDigits(payload.phone || payload.to || "");
  const target = String(execution.target || "").trim();
  const digits = explicit.length >= 8 ? explicit : await resolveSavedContactNumber(env, organizationId, target);
  if (digits.length < 8 || digits.length > 15) throw new AgentActionError("CONTACT_NUMBER_REQUIRED", `لم أجد رقم ${target || "المستلم"}. اكتب الرقم مع رمز الدولة أو احفظه أولاً.`);
  const toNumber = `+${digits}`, fromNumber = phoneE164(voice.caller_id);
  if (!fromNumber) throw new AgentActionError("VOICE_CALLER_INVALID", "رقم الاتصال الموثّق غير صالح؛ أعد توثيقه.");
  if (toNumber === fromNumber) throw new AgentActionError("VOICE_SELF_CALL_BLOCKED", "لا يمكن للموظف الاتصال من الرقم نفسه إلى الرقم نفسه.", 400);
  const purpose = String(payload.purpose || payload.message || payload.body || "").trim();
  if (purpose.length < 2 || purpose.length > 1500) throw new AgentActionError("VOICE_PURPOSE_REQUIRED", "اكتب للموظف ماذا يقول أو ما الهدف من المكالمة.", 400);
  const policy = voicePolicySettings(voice);
  const localTime = localTimeInZone(String(organization?.timezone || "Asia/Dubai"));
  if (localTime < policy.allowedFrom || localTime >= policy.allowedTo) throw new AgentActionError("VOICE_OUTSIDE_ALLOWED_HOURS", `المكالمات مسموحة بين ${policy.allowedFrom} و${policy.allowedTo} حسب توقيت مساحة العمل.`);
  const todayCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM ai_voice_calls WHERE organization_id=? AND agent_id=? AND created_at>=datetime('now','start of day') AND status NOT IN ('failed','cancelled')")
    .bind(organizationId, agentId).first<Row>();
  if (Number(todayCount?.count || 0) >= policy.dailyCallLimit) throw new AgentActionError("VOICE_DAILY_LIMIT_REACHED", `وصل الموظف إلى حد ${policy.dailyCallLimit} مكالمة لهذا اليوم.`);
  const callId = crypto.randomUUID(), stamp = now();
  await env.DB.prepare("INSERT INTO ai_voice_calls (id,organization_id,agent_id,action_execution_id,provider_call_id,openai_session_id,from_number,to_number,contact_name,purpose,status,error_code,started_at,answered_at,completed_at,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(callId, organizationId, agentId, execution.id, null, null, fromNumber, toNumber, target || toNumber, purpose, "queued", null, stamp, null, null, JSON.stringify({ recording_enabled: false, transcribing_enabled: false, disclosure_required: true }), stamp, stamp).run();
  const sipUri = `sip:${gateway.projectId}@sip.api.openai.com;transport=tls?x-varex-call-id=${encodeURIComponent(callId)}`;
  const twiml = `<Response><Dial answerOnBridge="true" timeout="30" timeLimit="${policy.maxCallMinutes * 60}" callerId="${xmlEscape(fromNumber)}"><Sip>${xmlEscape(sipUri)}</Sip></Dial></Response>`;
  try {
    const placed = await voiceGatewayRequest(gateway, "Calls.json", { method: "POST", form: { To: toNumber, From: fromNumber, Twiml: twiml, Timeout: "30" } });
    const providerCallId = String(placed.sid || "");
    if (!providerCallId) throw new AgentActionError("VOICE_CALL_NOT_CREATED", "لم يؤكد السنترال إنشاء المكالمة.", 502);
    const providerStatus = String(placed.status || "queued");
    await env.DB.prepare("UPDATE ai_voice_calls SET provider_call_id=?,status=?,metadata=?,updated_at=? WHERE id=?")
      .bind(providerCallId, providerStatus === "in-progress" ? "in_progress" : providerStatus, JSON.stringify({ recording_enabled: false, transcribing_enabled: false, disclosure_required: true, provider_status: providerStatus }), now(), callId).run();
    await env.DB.prepare("INSERT INTO ai_messages (id,organization_id,contact_name,contact_address,channel,direction,body,send_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), organizationId, target || toNumber, toNumber, "voice", "outbound", purpose, "initiated", user.id || null, stamp, stamp).run();
    const summary = `بدأ طلب الاتصال بـ ${target || toNumber} من رقمك الموثّق. حالة المكالمة تُحدّث من السنترال؛ لم نعتبر المحادثة مكتملة بعد.`;
    const details: Row = { mode: "sip_ai_call", voice_call_id: callId, from: fromNumber, to: toNumber, recipient: target || toNumber, purpose, status: providerStatus, recording_enabled: false };
    await env.DB.prepare("UPDATE ai_action_executions SET status='running',result_summary=?,result_details=?,error_code=NULL,started_at=COALESCE(started_at,?),updated_at=? WHERE id=?")
      .bind(summary, JSON.stringify(details), stamp, now(), execution.id).run();
    return { ok: true, status: 202, message: summary, execution: hydrate({ ...execution, status: "running", result_summary: summary, result_details: details, started_at: execution.started_at || stamp }) };
  } catch (caught) {
    const failure = caught instanceof AgentActionError ? caught : new AgentActionError("VOICE_CALL_FAILED", "تعذر على السنترال بدء المكالمة.", 502);
    await env.DB.prepare("UPDATE ai_voice_calls SET status='failed',error_code=?,completed_at=?,updated_at=? WHERE id=?").bind(failure.code, now(), now(), callId).run();
    throw failure;
  }
}

function sipHeaderValue(headers: unknown, name: string) {
  const rows = Array.isArray(headers) ? headers as Row[] : [];
  return String(rows.find(header => String(header.name || "").toLocaleLowerCase() === name.toLocaleLowerCase())?.value || "").trim();
}

function aiVoiceInstructions(call: Row, agent: Row, owner: Row, voice: Row) {
  const agentName = String(agent.name || "مساعد VAREX").replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);
  const ownerName = String(owner.full_name || "صاحب الحساب").replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);
  const recipient = String(call.contact_name || call.to_number || "الطرف الآخر").replace(/[\r\n\t]+/g, " ").trim().slice(0, 100);
  const disclosure = String(voice.disclosure_text || `مرحباً، أنا ${agentName}، مساعد ذكي وأتصل نيابة عن ${ownerName}.`).replace(/[\r\n\t]+/g, " ").trim().slice(0, 500);
  const purpose = String(call.purpose || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 1500);
  const ownerRules = String(agent.instructions || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 1200);
  return [
    `أنت ${agentName}، مساعد صوتي ذكي تابع لـ VAREX AI وتتحدث الآن مع ${recipient} نيابة عن ${ownerName}.`,
    `في أول رد منطوق وبعد أن تسمع الطرف الآخر، قل بوضوح هذا التعريف قبل أي شيء: «${disclosure}» ولا تدّعِ أنك إنسان أو أنك ${ownerName}.`,
    `غرض المكالمة المصرح به فقط: ${purpose}`,
    ownerRules ? `تعليمات المالك المسموحة: ${ownerRules}` : "",
    "نفّذ الغرض كمحادثة حقيقية تفاعلية، ولا تقرأ أمر المالك حرفياً للطرف الآخر. افهم الهدف وصغ كلامك الطبيعي بنفسك.",
    "اسأل الأسئلة اللازمة، واجمع التفاصيل المطلوبة، وناقش البدائل المسموحة، ثم أكّد النتيجة بوضوح. إذا كان الهدف موعداً فاسأل عن التاريخ والوقت المناسبين والسعر وأي تفاصيل مرتبطة ضمن نطاق الهدف.",
    "لا تطلب من المالك التدخل أثناء المكالمة ولا تنتظر منه تلقين كل جملة. أنهِ المكالمة فقط بعد الوصول إلى نتيجة واضحة أو رفض الطرف الآخر أو تعذر تحقيق الهدف ضمن الصلاحيات.",
    "تحدث بالعربية وبأسلوب طبيعي مهني، وابق ضمن غرض المكالمة. لا تخترع معلومات أو أسعاراً أو وعوداً أو موافقات. لا تطلب كلمات مرور أو رموز تحقق أو بيانات مصرفية.",
    "إذا رفض الطرف الآخر المكالمة أو طلب إنهاءها، اعتذر باختصار وأنهِ الحديث. لا تسجّل المكالمة ولا تقل إنها مسجلة.",
  ].filter(Boolean).join("\n");
}

function openAiCallVoice(voiceId: unknown) {
  return new Set(["Achird", "Orus", "Puck", "Alnilam", "Charon", "Fenrir", "Iapetus", "Algenib", "Rasalgethi"]).has(String(voiceId || "")) ? "cedar" : "marin";
}

async function rejectOpenAiSip(apiKey: string, eventType: string, sessionId: string) {
  const base = eventType === "realtime.call.incoming" ? `/v1/realtime/calls/${encodeURIComponent(sessionId)}` : `/v1/live/sessions/${encodeURIComponent(sessionId)}`;
  await fetch(`https://api.openai.com${base}/reject`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ status_code: 603 }) }).catch(() => null);
}

async function openAiVoiceWebhook(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const [gateway, openaiCredential] = await Promise.all([voiceGatewayConfig(env), platformAiProviderKey(env, "openai")]);
  if (!gateway.webhookSecret || !openaiCredential?.key) return new Response("Voice integration is not configured", { status: 503 });
  const rawBody = await request.text();
  let event: Row;
  try {
    const client = new OpenAI({ apiKey: openaiCredential.key, webhookSecret: gateway.webhookSecret });
    event = await client.webhooks.unwrap(rawBody, request.headers, gateway.webhookSecret) as unknown as Row;
  } catch (caught) {
    console.error("VAREX OpenAI voice webhook signature rejected", caught instanceof Error ? caught.message : caught);
    return new Response("Invalid signature", { status: 400 });
  }
  const eventType = String(event.type || ""), data = event.data && typeof event.data === "object" ? event.data as Row : {};
  if (!["live.transport.incoming", "live.call.incoming", "realtime.call.incoming"].includes(eventType)) return new Response(null, { status: 200 });
  const sessionId = String(data.session_id || data.call_id || "");
  const callId = sipHeaderValue(data.sip_headers, "x-varex-call-id");
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(callId)) {
    if (sessionId) await rejectOpenAiSip(openaiCredential.key, eventType, sessionId);
    return new Response(null, { status: 200 });
  }
  const call = await env.DB.prepare("SELECT * FROM ai_voice_calls WHERE id=? LIMIT 1").bind(callId).first<Row>();
  if (!call || !["queued", "initiated", "ringing", "accepting"].includes(String(call.status || ""))) {
    if (!call) await rejectOpenAiSip(openaiCredential.key, eventType, sessionId);
    return new Response(null, { status: 200 });
  }
  const lock = await env.DB.prepare("UPDATE ai_voice_calls SET status='accepting',openai_session_id=?,updated_at=? WHERE id=? AND openai_session_id IS NULL AND status IN ('queued','initiated','ringing')")
    .bind(sessionId, now(), callId).run();
  if (!Number(lock.meta?.changes || 0)) return new Response(null, { status: 200 });
  const [agent, organization, voice, owner] = await Promise.all([
    env.DB.prepare("SELECT name,role,instructions FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(call.agent_id, call.organization_id).first<Row>(),
    env.DB.prepare("SELECT owner_id FROM ai_organizations WHERE id=? LIMIT 1").bind(call.organization_id).first<Row>(),
    env.DB.prepare("SELECT disclosure_text,voice_id FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(call.organization_id, call.agent_id).first<Row>(),
    env.DB.prepare("SELECT full_name FROM ai_users WHERE id=(SELECT owner_id FROM ai_organizations WHERE id=? LIMIT 1) LIMIT 1").bind(call.organization_id).first<Row>(),
  ]);
  if (!agent || !organization || !voice || !owner) {
    await rejectOpenAiSip(openaiCredential.key, eventType, sessionId);
    await env.DB.prepare("UPDATE ai_voice_calls SET status='failed',error_code='VOICE_CONTEXT_MISSING',completed_at=?,updated_at=? WHERE id=?").bind(now(), now(), callId).run();
    return new Response(null, { status: 200 });
  }
  const instructions = aiVoiceInstructions(call, agent, owner, voice);
  const callVoice = openAiCallVoice(voice.voice_id);
  const legacy = eventType === "realtime.call.incoming";
  const endpoint = legacy ? `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(sessionId)}/accept` : `https://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/accept`;
  const acceptBody = legacy
    ? { type: "realtime", model: "gpt-realtime-2.1", instructions, audio: { output: { voice: callVoice } } }
    : { session: { type: "live", model: "gpt-live-1", instructions, audio: { output: { voice: callVoice } }, delegation: { type: "responses", responses: { model: "gpt-5.6-luna", instructions: `التزم بهدف المكالمة وتعليمات المالك التالية:\n${instructions}`, tool_choice: "none" } } } };
  const accepted = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${openaiCredential.key}`, "Content-Type": "application/json" }, body: JSON.stringify(acceptBody) });
  if (!accepted.ok) {
    const providerMessage = await accepted.text().catch(() => "");
    console.error("VAREX OpenAI SIP accept failed", accepted.status, providerMessage.slice(0, 500));
    await env.DB.prepare("UPDATE ai_voice_calls SET status='failed',error_code='OPENAI_SIP_ACCEPT_FAILED',completed_at=?,updated_at=? WHERE id=?").bind(now(), now(), callId).run();
    return new Response(null, { status: 200 });
  }
  const stamp = now();
  await env.DB.prepare("UPDATE ai_voice_calls SET status='in_progress',answered_at=COALESCE(answered_at,?),metadata=?,updated_at=? WHERE id=?")
    .bind(stamp, JSON.stringify({ recording_enabled: false, transcribing_enabled: false, disclosure_required: true, webhook_event_id: event.id || null, openai_api: legacy ? "realtime" : "live" }), stamp, callId).run();
  return new Response(null, { status: 200 });
}

async function refreshVoiceCall(env: Env, gateway: VoiceGatewayConfig, call: Row) {
  if (!call.provider_call_id || ["completed", "failed", "busy", "no_answer", "cancelled"].includes(String(call.status || ""))) return call;
  try {
    const provider = await voiceGatewayRequest(gateway, `Calls/${encodeURIComponent(String(call.provider_call_id))}.json`);
    const providerStatus = String(provider.status || "");
    const mapped = providerStatus === "in-progress" ? "in_progress" : providerStatus === "no-answer" ? "no_answer" : providerStatus;
    const final = ["completed", "failed", "busy", "no_answer", "canceled", "cancelled"].includes(mapped);
    const failed = ["failed", "busy", "no_answer", "canceled", "cancelled"].includes(mapped);
    const status = mapped === "canceled" ? "cancelled" : mapped || String(call.status || "queued");
    const stamp = now();
    await env.DB.prepare("UPDATE ai_voice_calls SET status=?,error_code=?,answered_at=CASE WHEN ?='in_progress' THEN COALESCE(answered_at,?) ELSE answered_at END,completed_at=CASE WHEN ? THEN COALESCE(completed_at,?) ELSE completed_at END,metadata=?,updated_at=? WHERE id=?")
      .bind(status, failed ? `VOICE_${status.toUpperCase()}` : null, status, stamp, final ? 1 : 0, stamp, JSON.stringify({ recording_enabled: false, transcribing_enabled: false, disclosure_required: true, provider_status: providerStatus, duration_seconds: Number(provider.duration || 0) || null }), stamp, call.id).run();
    if (final && call.action_execution_id) {
      const summary = failed ? `انتهت محاولة الاتصال بحالة: ${status}.` : "انتهت المكالمة عبر السنترال.";
      await env.DB.prepare("UPDATE ai_action_executions SET status=?,result_summary=?,error_code=?,completed_at=?,updated_at=? WHERE id=? AND status='running'")
        .bind(failed ? "failed" : "completed", summary, failed ? `VOICE_${status.toUpperCase()}` : null, stamp, stamp, call.action_execution_id).run();
    }
    return { ...call, status, error_code: failed ? `VOICE_${status.toUpperCase()}` : null, completed_at: final ? stamp : call.completed_at, metadata: { recording_enabled: false, transcribing_enabled: false, provider_status: providerStatus, duration_seconds: Number(provider.duration || 0) || null } };
  } catch (_) { return call; }
}

async function voiceCalls(request: Request, env: Env) {
  if (request.method !== "GET") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), organizationId = String(url.searchParams.get("organization_id") || ""), agentId = String(url.searchParams.get("agent_id") || "");
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const result = await env.DB.prepare(`SELECT * FROM ai_voice_calls WHERE organization_id=?${agentId ? " AND agent_id=?" : ""} ORDER BY created_at DESC LIMIT 50`)
    .bind(...(agentId ? [organizationId, agentId] : [organizationId])).all<Row>();
  const gateway = await voiceGatewayConfig(env);
  const rows: Row[] = [];
  for (const row of result.results || []) rows.push(gateway.accountId && gateway.authSecret ? await refreshVoiceCall(env, gateway, row as Row) : row as Row);
  return api(rows.map(row => hydrate(row)));
}

async function connectedIntegrationCredentials(env: Env, organizationId: string, provider: "facebook" | "instagram" | "tiktok") {
  const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE organization_id=? AND provider=? AND status='connected' LIMIT 1")
    .bind(organizationId, provider).first<Row>();
  if (!integration) throw new AgentActionError(`${provider.toUpperCase()}_NOT_CONNECTED`, `اربط حساب ${provider === "facebook" ? "Facebook" : provider === "instagram" ? "Instagram المهني" : "TikTok"} أولاً من صفحة الربط.`);
  let metadata: Row = {};
  try { metadata = JSON.parse(String(integration.metadata || "{}")) as Row; }
  catch (_) { throw new AgentActionError(`${provider.toUpperCase()}_LINK_INVALID`, "بيانات ربط الحساب غير صالحة؛ ألغِ الربط وأعده من جديد."); }
  const encrypted = metadata.credential && typeof metadata.credential === "object" ? metadata.credential as Row : null;
  if (!encrypted) throw new AgentActionError(`${provider.toUpperCase()}_CREDENTIAL_MISSING`, "بيانات دخول الحساب المرتبط غير متوفرة؛ أعد ربط الحساب.");
  try {
    return { integration, metadata, credentials: await decryptIntegrationCredentials(env, encrypted) };
  } catch (_) {
    throw new AgentActionError(`${provider.toUpperCase()}_LINK_INVALID`, "تعذر فتح بيانات الحساب المرتبط؛ أعد ربط الحساب.");
  }
}

function publicHttpsUrl(value: unknown, label: string) {
  const raw = String(value || "").trim();
  let url: URL;
  try { url = new URL(raw); } catch (_) { throw new AgentActionError("INVALID_PUBLIC_URL", `${label} يجب أن يكون رابطاً عاماً صالحاً يبدأ بـ https://`, 400); }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new AgentActionError("INVALID_PUBLIC_URL", `${label} يجب أن يكون رابطاً عاماً صالحاً يبدأ بـ https://`, 400);
  return url.toString();
}

async function metaGraphRequest(env: Env, path: string, accessToken: string, options: { method?: "GET" | "POST"; body?: Row; query?: Record<string, string> } = {}) {
  const { graphVersion } = await metaConfig(env);
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = await response.json<Row>().catch(() => ({}));
  const providerFailure = payload.error && typeof payload.error === "object" ? payload.error as Row : null;
  if (!response.ok || providerFailure) {
    const code = Number(providerFailure?.code || 0);
    console.error("VAREX AI social action rejected", response.status, { code, type: providerFailure?.type || null });
    if (code === 190) throw new AgentActionError("META_LINK_EXPIRED", "انتهت صلاحية ربط الحساب؛ أعد ربطه من صفحة الحسابات الاجتماعية.", 401);
    if (code === 10 || code === 200) throw new AgentActionError("META_PERMISSION_REQUIRED", "الحساب مربوط لكن صلاحية هذه العملية غير ممنوحة. أعد الربط ووافق على صلاحية إدارة المحتوى.");
    throw new AgentActionError("META_ACTION_REJECTED", "رفضت منصة الحساب تنفيذ العملية. تحقق من نوع الحساب والصلاحيات ثم أعد المحاولة.", 502);
  }
  return payload;
}

function selectLinkedAccount(credentials: Row, target: string, provider: "facebook" | "instagram") {
  const accounts = Array.isArray(credentials.accounts) ? credentials.accounts as Row[] : [];
  const wanted = target.trim().toLocaleLowerCase();
  const selected = (wanted ? accounts.find(account => [account.id, account.name, account.username, account.page_id, account.page_name].some(value => String(value || "").toLocaleLowerCase().includes(wanted))) : null) || accounts[0];
  if (!selected) throw new AgentActionError(`${provider.toUpperCase()}_ACCOUNT_NOT_FOUND`, provider === "facebook" ? "لم نجد صفحة Facebook مُدارة ضمن الربط الحالي." : "لم نجد حساب Instagram مهني مرتبطاً بصفحة Facebook.");
  const accessToken = String(selected.page_access_token || selected.access_token || credentials.access_token || "");
  if (!accessToken) throw new AgentActionError("META_TOKEN_MISSING", "رمز وصول الصفحة غير متوفر؛ أعد ربط الحساب.");
  return { account: selected, accessToken };
}

async function executeFacebookAction(env: Env, organizationId: string, actionKey: string, target: string, payload: Row) {
  const linked = await connectedIntegrationCredentials(env, organizationId, "facebook");
  const { account, accessToken } = selectLinkedAccount(linked.credentials, target, "facebook");
  const pageId = String(account.id || "");
  if (!pageId) throw new AgentActionError("FACEBOOK_PAGE_NOT_FOUND", "لم نجد معرّف صفحة Facebook صالحاً في الربط الحالي.");
  if (actionKey === "publish") {
    const message = String(payload.message || payload.body || "").trim();
    const link = payload.link ? publicHttpsUrl(payload.link, "رابط المنشور") : "";
    if (!message && !link) throw new AgentActionError("FACEBOOK_POST_REQUIRED", "اكتب نص المنشور أو أرفق رابطاً عاماً قبل النشر.", 400);
    const result = await metaGraphRequest(env, `${encodeURIComponent(pageId)}/feed`, accessToken, { method: "POST", body: { ...(message ? { message } : {}), ...(link ? { link } : {}) } });
    await env.DB.prepare("UPDATE ai_integrations SET last_sync_at=?,updated_at=? WHERE id=?").bind(now(), now(), linked.integration.id).run();
    return { summary: `تم نشر المحتوى على صفحة ${String(account.name || target || "Facebook")}.`, details: { post_id: result.id || null, page_id: pageId, message, link: link || null } as Row };
  }
  if (actionKey === "list_posts") {
    const limit = Math.max(1, Math.min(25, Number(payload.limit || 10)));
    const result = await metaGraphRequest(env, `${encodeURIComponent(pageId)}/posts`, accessToken, { query: { fields: "id,message,created_time,permalink_url", limit: String(limit) } });
    const posts = Array.isArray(result.data) ? result.data as Row[] : [];
    const lines = posts.slice(0, limit).map((post, index) => `${index + 1}. ${String(post.message || "منشور بلا نص").slice(0, 180)}${post.permalink_url ? `\n${String(post.permalink_url)}` : ""}`);
    return { summary: posts.length ? `آخر منشورات صفحة ${String(account.name || "Facebook")}:\n${lines.join("\n")}` : "لا توجد منشورات متاحة للعرض في الصفحة المرتبطة.", details: { page_id: pageId, posts } as Row };
  }
  throw new AgentActionError("FACEBOOK_ACTION_NOT_AVAILABLE", "عملية Facebook المطلوبة غير متاحة.");
}

async function executeInstagramAction(env: Env, organizationId: string, actionKey: string, target: string, payload: Row) {
  const linked = await connectedIntegrationCredentials(env, organizationId, "instagram");
  const { account, accessToken } = selectLinkedAccount(linked.credentials, target, "instagram");
  const accountId = String(account.id || "");
  if (!accountId) throw new AgentActionError("INSTAGRAM_ACCOUNT_NOT_FOUND", "لم نجد حساب Instagram مهنياً صالحاً في الربط الحالي.");
  if (actionKey === "publish") {
    const mediaUrl = publicHttpsUrl(payload.media_url, "رابط الصورة");
    if (/\.(?:mp4|mov|m4v)(?:\?|$)/i.test(mediaUrl)) throw new AgentActionError("INSTAGRAM_IMAGE_REQUIRED", "هذه النسخة تنشر صورة Instagram من رابط عام. نشر الفيديو يحتاج مسار Reels منفصلاً.", 400);
    const caption = String(payload.message || payload.body || "").trim().slice(0, 2200);
    const container = await metaGraphRequest(env, `${encodeURIComponent(accountId)}/media`, accessToken, { method: "POST", body: { image_url: mediaUrl, ...(caption ? { caption } : {}) } });
    const creationId = String(container.id || "");
    if (!creationId) throw new AgentActionError("INSTAGRAM_CONTAINER_FAILED", "تعذر تجهيز صورة Instagram للنشر.", 502);
    const result = await metaGraphRequest(env, `${encodeURIComponent(accountId)}/media_publish`, accessToken, { method: "POST", body: { creation_id: creationId } });
    await env.DB.prepare("UPDATE ai_integrations SET last_sync_at=?,updated_at=? WHERE id=?").bind(now(), now(), linked.integration.id).run();
    return { summary: `تم نشر الصورة على حساب @${String(account.username || account.name || "Instagram")}.`, details: { media_id: result.id || null, creation_id: creationId, media_url: mediaUrl, caption } as Row };
  }
  if (actionKey === "read_comments") {
    const limit = Math.max(1, Math.min(25, Number(payload.limit || 10)));
    const result = await metaGraphRequest(env, `${encodeURIComponent(accountId)}/media`, accessToken, { query: { fields: "id,caption,permalink,timestamp,comments.limit(25){id,text,username,timestamp}", limit: String(limit) } });
    const media = Array.isArray(result.data) ? result.data as Row[] : [];
    const comments = media.flatMap(item => {
      const container = item.comments && typeof item.comments === "object" ? item.comments as Row : {};
      const rows = Array.isArray(container.data) ? container.data as Row[] : [];
      return rows.map(comment => ({ ...comment, media_id: item.id, media_permalink: item.permalink }));
    }).slice(0, 25);
    const lines = comments.map((comment, index) => `${index + 1}. @${String(comment.username || "مستخدم")}: ${String(comment.text || "").slice(0, 220)} [${String(comment.id || "")}]`);
    return { summary: comments.length ? `أحدث تعليقات Instagram:\n${lines.join("\n")}` : "لا توجد تعليقات متاحة ضمن أحدث المنشورات.", details: { comments } as Row };
  }
  if (actionKey === "reply_comment") {
    const commentId = String(payload.comment_id || target || "").trim();
    const message = String(payload.message || payload.body || "").trim();
    if (!commentId || !message) throw new AgentActionError("INSTAGRAM_COMMENT_REPLY_REQUIRED", "حدد التعليق واكتب نص الرد قبل التنفيذ.", 400);
    const result = await metaGraphRequest(env, `${encodeURIComponent(commentId)}/replies`, accessToken, { method: "POST", body: { message } });
    return { summary: "تم نشر الرد على تعليق Instagram.", details: { reply_id: result.id || null, comment_id: commentId, message } as Row };
  }
  throw new AgentActionError("INSTAGRAM_ACTION_NOT_AVAILABLE", "عملية Instagram المطلوبة غير متاحة.");
}

async function executeTikTokAction(env: Env, organizationId: string, actionKey: string, payload: Row) {
  if (actionKey !== "publish_video") throw new AgentActionError("TIKTOK_ACTION_NOT_AVAILABLE", "عملية TikTok المطلوبة غير متاحة.");
  const linked = await connectedIntegrationCredentials(env, organizationId, "tiktok");
  const scopes = Array.isArray(linked.credentials.scope) ? linked.credentials.scope.map(String) : [];
  if (!scopes.includes("video.publish")) throw new AgentActionError("TIKTOK_PUBLISH_PERMISSION_REQUIRED", "حساب TikTok مربوط للهوية فقط. فعّل صلاحية نشر الفيديو في بوابة VAREX ثم أعد ربط الحساب.");
  const accessToken = String(linked.credentials.access_token || "");
  if (!accessToken) throw new AgentActionError("TIKTOK_LINK_EXPIRED", "انتهت صلاحية ربط TikTok؛ أعد ربط الحساب.", 401);
  const mediaUrl = publicHttpsUrl(payload.media_url, "رابط الفيديو");
  const privacy = new Set(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]).has(String(payload.privacy_level || "")) ? String(payload.privacy_level) : "SELF_ONLY";
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: { title: String(payload.message || payload.body || "").trim().slice(0, 150), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
      source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
    }),
  });
  const result = await response.json<Row>().catch(() => ({}));
  const errorRow = result.error && typeof result.error === "object" ? result.error as Row : {};
  if (!response.ok || (errorRow.code && errorRow.code !== "ok")) {
    console.error("VAREX AI TikTok publish rejected", response.status, { code: errorRow.code || null });
    throw new AgentActionError("TIKTOK_PUBLISH_REJECTED", "رفض TikTok تجهيز الفيديو. يجب أن يكون رابط الفيديو عاماً ومن نطاق موثّق في تطبيق VAREX، وأن تكون صلاحية النشر معتمدة.", 502);
  }
  const data = result.data && typeof result.data === "object" ? result.data as Row : {};
  await env.DB.prepare("UPDATE ai_integrations SET last_sync_at=?,updated_at=? WHERE id=?").bind(now(), now(), linked.integration.id).run();
  return { summary: "تم تسليم الفيديو إلى TikTok وهو الآن قيد المعالجة؛ لم ندّعِ اكتمال النشر قبل تأكيد المنصة.", details: { publish_id: data.publish_id || null, media_url: mediaUrl, privacy_level: privacy, status: "processing" } as Row };
}

async function performActionExecution(request: Request, env: Env, user: Row, execution: Row) {
  const organizationId = String(execution.organization_id), appKey = String(execution.app_key), actionKey = String(execution.action_key);
  let payload: Row = {}; try { payload = JSON.parse(String(execution.request_payload || "{}")) as Row; } catch (_) { payload = {}; }
  const stamp = now();
  try {
    if (nativeDeviceApps.has(appKey)) {
      const activeAfter = new Date(Date.now() - 2 * 60000).toISOString();
      const devices = await env.DB.prepare("SELECT * FROM ai_device_connections WHERE organization_id=? AND status='connected' AND last_seen_at>=? ORDER BY last_seen_at DESC LIMIT 10").bind(organizationId, activeAfter).all<Row>();
      const device = (devices.results || []).map(row => hydrate(row as Row)).find(row => Array.isArray(row.capabilities) && (row.capabilities as unknown[]).map(String).includes(appKey));
      if (device) {
        const queuedMessage = `تم إرسال «${deviceAppCatalog[appKey].actions[actionKey].label}» إلى ${String(device.device_name || "الجهاز المتصل")}`;
        await env.DB.prepare("UPDATE ai_action_executions SET status='queued',device_id=?,result_summary=?,updated_at=? WHERE id=?").bind(device.device_id, queuedMessage, stamp, execution.id).run();
        if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='running',output=?,updated_at=? WHERE id=? AND organization_id=?")
          .bind("بانتظار استلام الجهاز للمهمة", stamp, execution.task_id, organizationId).run();
        return { ok: true, status: 202, message: queuedMessage, execution: hydrate({ ...execution, status: "queued", device_id: device.device_id, result_summary: queuedMessage }) };
      }
      throw new AgentActionError("DEVICE_CAPABILITY_REQUIRED", `لا يوجد جهاز متصل الآن يملك صلاحية ${deviceAppCatalog[appKey].label}. افتح VAREX AI على جهاز يدعم هذه الصلاحية.`);
    }
    await env.DB.prepare("UPDATE ai_action_executions SET status='running',started_at=?,updated_at=? WHERE id=?").bind(stamp, stamp, execution.id).run();
    if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='running',started_at=COALESCE(started_at,?),updated_at=? WHERE id=? AND organization_id=?")
      .bind(stamp, stamp, execution.task_id, organizationId).run();
    let summary = ""; let details: Row = {};
    if (appKey === "whatsapp" && ["send", "reply", "follow_up"].includes(actionKey)) {
      const target = String(execution.target || payload.to || "").trim();
      const payloadNumber = normalizePhoneDigits(payload.to);
      const to = payloadNumber.length >= 8 ? payloadNumber : await resolveSavedContactNumber(env, organizationId, target);
      if (!to) throw new AgentActionError("CONTACT_NUMBER_REQUIRED", `لم أجد رقم ${target || "المستلم"}. اربط جهات الاتصال أو اكتب الرقم مع رمز الدولة.`);
      const messageBody = String(payload.message || payload.body || "").trim();
      if (!messageBody) throw new AgentActionError("MESSAGE_REQUIRED", "اكتب نص رسالة واتساب المطلوب إرسالها", 400);
      const delivery = await deliverWhatsAppText(env, { organizationId, to, contactName: target || to, messageBody, phoneNumberId: String(payload.phone_number_id || ""), createdBy: String(user.id || "") || null });
      if (!delivery.ok) throw new AgentActionError(String(delivery.code || "WHATSAPP_SEND_FAILED"), String(delivery.message || "تعذر إرسال رسالة WhatsApp"), delivery.status);
      const preview = messageBody.length > 900 ? `${messageBody.slice(0, 900)}…` : messageBody;
      summary = `تم إرسال رسالة WhatsApp إلى ${target || to}:\n«${preview}»`;
      details = { message_id: delivery.messageId, to, message: messageBody };
    } else if (appKey === "facebook") {
      const result = await executeFacebookAction(env, organizationId, actionKey, String(execution.target || ""), payload);
      summary = result.summary; details = result.details;
    } else if (appKey === "instagram") {
      const result = await executeInstagramAction(env, organizationId, actionKey, String(execution.target || ""), payload);
      summary = result.summary; details = result.details;
    } else if (appKey === "tiktok") {
      const result = await executeTikTokAction(env, organizationId, actionKey, payload);
      summary = result.summary; details = result.details;
    } else if (appKey === "voice") {
      return await startAiVoiceCall(request, env, user, execution, payload);
    } else if (appKey === "email") throw new AgentActionError("EMAIL_NOT_CONNECTED", "اربط Gmail أو Outlook أولاً لتنفيذ أوامر البريد الإلكتروني.");
    else if (appKey === "youtube") throw new AgentActionError("YOUTUBE_NOT_CONNECTED", "اربط قناة YouTube وامنح الصلاحيات المطلوبة أولاً.");
    else if (appKey === "parking") throw new AgentActionError("PARKING_PROVIDER_NOT_CONNECTED", "اختر مزود المواقف المدعوم واربط حساب المالك أولاً.");
    else throw new AgentActionError("ACTION_NOT_AVAILABLE", "هذه العملية معروفة، لكنها غير متصلة بمنفّذ فعلي بعد.");
    const completedAt = now();
    await env.DB.prepare("UPDATE ai_action_executions SET status='completed',result_summary=?,result_details=?,error_code=NULL,completed_at=?,updated_at=? WHERE id=?")
      .bind(summary, JSON.stringify(details), completedAt, completedAt, execution.id).run();
    if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='completed',output=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=?")
      .bind(summary, completedAt, completedAt, execution.task_id, organizationId).run();
    return { ok: true, status: 200, message: summary, execution: hydrate({ ...execution, status: "completed", result_summary: summary, result_details: details, completed_at: completedAt }) };
  } catch (caught) {
    const failure = caught instanceof AgentActionError ? caught : new AgentActionError("ACTION_FAILED", caught instanceof Error ? caught.message : "تعذر تنفيذ العملية", 500);
    const failedAt = now();
    await env.DB.prepare("UPDATE ai_action_executions SET status='failed',result_summary=?,error_code=?,completed_at=?,updated_at=? WHERE id=?")
      .bind(failure.message, failure.code, failedAt, failedAt, execution.id).run();
    if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='failed',output=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=?")
      .bind(failure.message, failedAt, failedAt, execution.task_id, organizationId).run();
    return { ok: false, status: failure.status, message: failure.message, code: failure.code, execution: hydrate({ ...execution, status: "failed", result_summary: failure.message, error_code: failure.code, completed_at: failedAt }) };
  }
}

async function executeAgentAction(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), agentId = String(body.agent_id || ""), appKey = String(body.app_key || ""), actionKey = String(body.action_key || "");
  const action = deviceAppCatalog[appKey]?.actions[actionKey];
  if (!organizationId || !agentId || !action) return error("حدد الموظف والتطبيق والعملية المطلوبة", 400);
  if (!await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id,name,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const permission = await env.DB.prepare("SELECT mode FROM ai_agent_permissions WHERE organization_id=? AND agent_id=? AND app_key=? AND action_key=? LIMIT 1").bind(organizationId, agentId, appKey, actionKey).first<Row>();
  const configuredMode = String(permission?.mode || "denied");
  const directOwnerVoice = body.direct_owner_command === true
    && !body.task_id
    && body.force_approval !== true
    && appKey === "voice"
    && actionKey === "speak_on_behalf"
    && await authorizeOrg(env, user, organizationId, true);
  const mode = configuredMode === "approval" && directOwnerVoice
    ? "automatic"
    : body.force_approval === true && configuredMode === "automatic" ? "approval" : configuredMode;
  if (agent.status !== "active") {
    const execution = await createActionExecution(env, user, body, mode, "blocked", "AGENT_PAUSED", "الموظف متوقف");
    if (body.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='failed',output='فعّل الموظف أولاً؛ لم يتم تنفيذ أي شيء.',completed_at=?,updated_at=? WHERE id=? AND organization_id=?").bind(now(), now(), body.task_id, organizationId).run();
    return api({ code: "AGENT_PAUSED", message: "فعّل الموظف أولاً؛ لم يتم تنفيذ أي شيء.", execution: hydrate(execution!) }, 409);
  }
  if (mode === "denied") {
    const execution = await createActionExecution(env, user, body, mode, "blocked", "PERMISSION_DENIED", "الصلاحية ممنوعة من المالك");
    if (body.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='failed',output=?,completed_at=?,updated_at=? WHERE id=? AND organization_id=?").bind(`صلاحية «${action.label}» ممنوعة لهذا الموظف؛ لم يتم تنفيذ أي شيء.`, now(), now(), body.task_id, organizationId).run();
    return api({ code: "PERMISSION_DENIED", message: `صلاحية «${action.label}» ممنوعة لهذا الموظف؛ لم يتم تنفيذ أي شيء.`, execution: hydrate(execution!) }, 403);
  }
  if (mode === "approval") {
    const execution = await createActionExecution(env, user, body, mode, "awaiting_approval");
    const stamp = now(), approvalId = crypto.randomUUID();
    const payload = body.payload && typeof body.payload === "object" ? body.payload as Row : {};
    const finalMessage = String(payload.message || payload.body || "").trim();
    const messagePreview = finalMessage ? `\nالنص الجاهز للإرسال:\n«${finalMessage.length > 900 ? `${finalMessage.slice(0, 900)}…` : finalMessage}»` : "";
    await env.DB.prepare("INSERT INTO ai_approvals (id,organization_id,task_id,action_execution_id,title,summary,status,requested_by,reviewed_by,reviewed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(approvalId, organizationId, body.task_id || null, execution!.id, `اعتماد ${action.label}`, `${deviceAppCatalog[appKey].label}: ${String(body.target || "بدون مستلم محدد")}${messagePreview}`, "pending", user.id, null, null, stamp, stamp).run();
    if (body.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='awaiting_approval',output='بانتظار موافقة المالك قبل التنفيذ',updated_at=? WHERE id=? AND organization_id=?").bind(stamp, body.task_id, organizationId).run();
    return api({ code: "APPROVAL_REQUIRED", message: `جهزت العملية ولم أنفّذها بعد.${messagePreview}\nبانتظار موافقتك.`, execution: hydrate(execution!), approval_id: approvalId }, 202);
  }
  const execution = await createActionExecution(env, user, body, mode, "queued");
  const result = await performActionExecution(request, env, user, execution!);
  return api(result, result.status);
}

async function decideAgentAction(request: Request, env: Env, executionId: string) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({})), decision = String(body.decision || "");
  if (!["approved", "rejected"].includes(decision)) return error("اختر الموافقة أو الرفض");
  const execution = await env.DB.prepare("SELECT * FROM ai_action_executions WHERE id=? LIMIT 1").bind(executionId).first<Row>();
  if (!execution) return error("عملية التنفيذ غير موجودة", 404);
  const organizationId = String(execution.organization_id);
  if (!await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع اعتماد هذه العملية", 403);
  if (execution.status !== "awaiting_approval") return error("تمت معالجة هذه العملية مسبقاً", 409);
  const stamp = now();
  await env.DB.prepare("UPDATE ai_approvals SET status=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE action_execution_id=? AND status='pending'")
    .bind(decision, user.id, stamp, stamp, executionId).run();
  if (decision === "rejected") {
    await env.DB.prepare("UPDATE ai_action_executions SET status='rejected',result_summary='رفض المالك العملية',error_code='OWNER_REJECTED',approved_by=?,approved_at=?,completed_at=?,updated_at=? WHERE id=?")
      .bind(user.id, stamp, stamp, stamp, executionId).run();
    if (execution.task_id) await env.DB.prepare("UPDATE ai_tasks SET status='cancelled',output='رفض المالك العملية؛ لم يتم تنفيذ أي شيء.',completed_at=?,updated_at=? WHERE id=? AND organization_id=?")
      .bind(stamp, stamp, execution.task_id, organizationId).run();
    return api({ ok: true, message: "تم رفض العملية ولم يُنفّذ أي شيء." });
  }
  await env.DB.prepare("UPDATE ai_action_executions SET status='queued',approved_by=?,approved_at=?,updated_at=? WHERE id=?").bind(user.id, stamp, stamp, executionId).run();
  const result = await performActionExecution(request, env, user, { ...execution, status: "queued", approved_by: user.id, approved_at: stamp });
  return api(result, result.status);
}

function aiActionCatalogText() {
  return Object.entries(deviceAppCatalog).map(([appKey, app]) => {
    const actions = Object.entries(app.actions).map(([actionKey, action]) => `${actionKey} (${action.label})`).join("، ");
    return `- ${appKey} / ${app.label}: ${actions}`;
  }).join("\n");
}

function chatDisplayName(user: Row) {
  const storedName = String(user.full_name || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const emailName = String(user.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return (storedName || emailName || "صاحب الحساب").slice(0, 80);
}

async function intelligentChatReply(env: Env, organizationId: string, agent: Row, user: Row) {
  const userId = String(user.id);
  const order: AiProvider[] = ["openai"];
  const [history, websiteIntegration] = await Promise.all([
    loadChatMessages(env, organizationId, String(agent.id), userId, 50),
    env.DB.prepare("SELECT metadata FROM ai_integrations WHERE organization_id=? AND provider='website' AND status='connected' LIMIT 1").bind(organizationId).first<Row>(),
  ]);
  let websiteMetadata: Row = {};
  try { websiteMetadata = JSON.parse(String(websiteIntegration?.metadata || "{}")) as Row; } catch (_) { websiteMetadata = {}; }
  let trustedWebsites: Array<{ name: string; url: string }> = [];
  try { trustedWebsites = normalizeWebsiteSources(websiteMetadata.websites); } catch (_) { trustedWebsites = []; }
  const context = {
    agentName: String(agent.name || "الموظف الذكي"),
    agentRole: String(agent.role || "مساعد تنفيذي"),
    userName: chatDisplayName(user),
    agentObjective: String(agent.objective || ""),
    agentInstructions: String(agent.instructions || ""),
    language: String(agent.language || "ar"),
    trustedWebsites,
    actionCatalog: aiActionCatalogText(),
    transcript: history
      .filter((message: Row) => !(message.role === "assistant" && message.kind === "error"))
      .map((message: Row) => ({ role: String(message.role || "user"), body: String(message.display_body || message.body || "") }))
      .filter((message: { role: string; body: string }) => message.body),
  };
  let configured = false;
  const failures: AiProviderFailure[] = [];
  for (const provider of order) {
    let credential;
    try { credential = await platformAiProviderKey(env, provider); }
    catch (caught) {
      console.error("VAREX AI credential unavailable", provider, caught instanceof Error ? caught.message : caught);
      continue;
    }
    if (!credential?.key) continue;
    configured = true;
    try {
      const reply = await askAiProvider(provider, credential.key, context);
      await setAiProviderHealth(env, organizationId, readyProviderHealth(provider));
      return { reply, configured: true, error: "", failures };
    }
    catch (caught) {
      console.error("VAREX AI provider failed", provider, caught instanceof Error ? caught.message : caught);
      const failure = aiProviderFailure(provider, caught);
      failures.push(failure);
      await setAiProviderHealth(env, organizationId, failure);
    }
  }
  return { reply: null, configured, error: configured ? "AI_PROVIDER_UNAVAILABLE" : "AI_PROVIDER_NOT_CONFIGURED", failures };
}

function aiProviderUnavailableMessage(failures: AiProviderFailure[]) {
  void failures;
  return "المحادثة الذكية متوقفة حالياً، لذلك ما رح أعطيك رداً محفوظاً وكأنه من الموظف. يلزم تفعيل خدمة الذكاء من إعدادات الإدارة، ولم يتم إرسال أو تنفيذ أي شيء.";
}

async function employeeVoicePreference(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), method = request.method.toUpperCase();
  const body = method === "GET" ? {} as Row : await request.json<Row>().catch(() => ({}));
  const organizationId = String(method === "GET" ? url.searchParams.get("organization_id") || "" : body.organization_id || "").trim();
  const agentId = String(method === "GET" ? url.searchParams.get("agent_id") || "" : body.agent_id || "").trim();
  if (!organizationId || !agentId) return error("حدد الموظف الذكي أولاً", 400);
  if (!await authorizeOrg(env, user, organizationId, method === "PUT")) return error(method === "PUT" ? "مالك المساحة فقط يستطيع اختيار صوت الموظف" : "ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id,name FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const existing = await env.DB.prepare("SELECT * FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>();
  const savedVoice = String(existing?.voice_id || "");
  if (method === "GET") return api({ ok: true, agent: hydrate(agent), voice_id: realtimeVoiceId(savedVoice) });
  if (method !== "PUT") return error("الطريقة غير مدعومة", 405);
  const voiceId = String(body.voice_id || "").trim();
  if (!REALTIME_VOICES.has(voiceId) && !GEMINI_VOICES.has(voiceId)) return error("اختر صوتاً متاحاً من مكتبة VAREX", 400);
  const storedVoiceId = realtimeVoiceId(voiceId);
  const stamp = now();
  await env.DB.prepare("INSERT INTO ai_voice_settings (id,organization_id,agent_id,provider,status,caller_id,voice_id,disclosure_text,settings,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,agent_id) DO UPDATE SET voice_id=excluded.voice_id,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
    .bind(crypto.randomUUID(), organizationId, agentId, "not_configured", "not_connected", null, storedVoiceId, "مرحباً، أنا المساعد الذكي وأتصل نيابة عن صاحب الحساب.", JSON.stringify({ realtime_voice_id: storedVoiceId }), user.id, stamp, stamp).run();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, user.id, "agent_chat_voice_updated", "agent", agentId, JSON.stringify({ voice_id: storedVoiceId }), stamp, stamp).run();
  return api({ ok: true, agent: hydrate(agent), voice_id: storedVoiceId });
}

async function chatSpeech(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), agentId = String(body.agent_id || "").trim();
  const text = String(body.text || "").replace(/https?:\/\/\S+/g, "رابط").trim();
  const requestedVoice = String(body.voice || "marin").trim();
  if (!organizationId || !agentId || !text) return error("حدد الموظف والنص المطلوب قراءته", 400);
  if (text.length > 2200) return error("النص أطول من الحد المسموح للصوت", 400);
  if (!await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const voiceSettings = await env.DB.prepare("SELECT voice_id FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>();
  const savedVoice = String(voiceSettings?.voice_id || "");
  const voice = realtimeVoiceId(savedVoice || requestedVoice);
  let credential;
  try { credential = await platformAiProviderKey(env, "openai"); }
  catch (_) { credential = null; }
  if (!credential?.key) return api({ code: "VOICE_NOT_CONFIGURED", message: "الصوت الطبيعي غير متاح حالياً." }, 409);
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${credential.key}`, "Content-Type": "application/json" };
    if (env.OPENAI_PROJECT_ID) headers["OpenAI-Project"] = env.OPENAI_PROJECT_ID;
    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: OPENAI_SPEECH_MODEL,
        voice,
        input: text,
        instructions: "تحدث بصوت طبيعي وواضح وبسرعة محادثة مريحة، من دون إضافة أي كلام غير موجود في النص.",
        response_format: "mp3",
      }),
    });
    if (!upstream.ok) {
      const details = await upstream.text();
      throw new Error(`OPENAI_SPEECH_FAILED_${upstream.status}: ${details.slice(0, 500)}`);
    }
    const audio = await upstream.arrayBuffer();
    await setAiProviderHealth(env, organizationId, readyProviderHealth("openai"));
    return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-VAREX-Voice": voice } });
  } catch (caught) {
    console.error("VAREX speech generation failed", caught instanceof Error ? caught.message : caught);
    const failure = aiProviderFailure("openai", caught);
    await setAiProviderHealth(env, organizationId, failure);
    return api({ code: failure.code, message: failure.code === "NO_CREDITS" ? failure.message : "تعذر تشغيل الصوت الطبيعي حالياً." }, failure.code === "NO_CREDITS" ? 402 : 502);
  }
}

function normalizeEmployeeName(value: unknown) {
  const name = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").replace(/^["'«»]+|["'«»]+$/g, "").trim();
  if (name.length < 2 || name.length > 48) return "";
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._'’\-]{1,47}$/u.test(name)) return "";
  if (/^(?:شو|ما|ماذا|مين|من|what|who|name|اسمك|المساعد|الموظف)$/iu.test(name)) return "";
  return name;
}

function requestedEmployeeName(value: unknown) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:^|[،,.!?؟]\s*)(?:إنت|انت|أنت)\s+اسمك\s+(?:هو\s+)?["«]?([^"»،,.!?؟]{2,48})["»]?(?:[،,.!?؟]|$)/iu,
    /(?:^|[،,.!?؟]\s*)(?:سمّيتك|سميتك|رح\s+سمّيك|رح\s+سميك|بدي\s+سمّيك|بدي\s+سميك|خلّي\s+اسمك|خلي\s+اسمك|غيّر\s+اسمك|غير\s+اسمك|اجعل\s+اسمك)\s*(?:إلى|الى|هو|يكون|:)?\s*["«]?([^"»،,.!?؟]{2,48})["»]?(?:[،,.!?؟]|$)/iu,
    /(?:^|[،,.!?؟]\s*)اسمك\s+(?:من\s+(?:هلا|الآن|اليوم)\s+)?(?:هو|يكون|صار)\s+["«]?([^"»،,.!?؟]{2,48})["»]?(?:[،,.!?؟]|$)/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = normalizeEmployeeName(match?.[1]?.replace(/\s+(?:من\s+هلا|من\s+الآن|من\s+اليوم|تمام|أوكي|اوكي)$/iu, ""));
    if (candidate) return candidate;
  }
  return "";
}

async function saveEmployeeName(env: Env, organizationId: string, agentId: string, userId: string, requestedName: unknown, source: string) {
  const name = normalizeEmployeeName(requestedName);
  if (!name) throw new Error("EMPLOYEE_NAME_INVALID");
  const existing = await env.DB.prepare("SELECT id,name,role,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!existing) throw new Error("EMPLOYEE_NOT_FOUND");
  if (String(existing.name || "") === name) return hydrate(existing);
  const stamp = now();
  await env.DB.prepare("UPDATE ai_agents SET name=?,updated_at=? WHERE id=? AND organization_id=?").bind(name, stamp, agentId, organizationId).run();
  await env.DB.prepare("INSERT INTO ai_audit_logs (id,organization_id,user_id,action,entity_type,entity_id,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), organizationId, userId, "agent_name_updated", "agent", agentId, JSON.stringify({ previous_name: existing.name || null, name, source }), stamp, stamp).run();
  return { ...hydrate(existing), name, updated_at: stamp };
}

async function employeeIdentity(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const body = method === "GET" ? {} as Row : await request.json<Row>().catch(() => ({}));
  const organizationId = String(method === "GET" ? url.searchParams.get("organization_id") || "" : body.organization_id || "").trim();
  const agentId = String(method === "GET" ? url.searchParams.get("agent_id") || "" : body.agent_id || "").trim();
  if (!organizationId || !agentId) return error("حدد الموظف الذكي أولاً", 400);
  if (!await authorizeOrg(env, user, organizationId, method === "PUT")) return error(method === "PUT" ? "مالك المساحة فقط يستطيع تغيير اسم الموظف" : "ليست لديك صلاحية على مساحة العمل", 403);
  if (method === "GET") {
    const agent = await env.DB.prepare("SELECT id,name,role,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
    return agent ? api({ ok: true, agent: hydrate(agent) }) : error("الموظف المحدد غير موجود", 404);
  }
  if (method !== "PUT") return error("الطريقة غير مدعومة", 405);
  try {
    const agent = await saveEmployeeName(env, organizationId, agentId, String(user.id), body.name, String(body.source || "settings"));
    return api({ ok: true, agent, message: `تم حفظ الاسم ${String(agent.name)}.` });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    return code === "EMPLOYEE_NOT_FOUND" ? error("الموظف المحدد غير موجود", 404) : error("اكتب اسماً واضحاً من حرفين إلى 48 حرفاً", 400);
  }
}

async function liveChatMessage(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), agentId = String(body.agent_id || "").trim();
  const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : "";
  const content = String(body.body || "").trim().slice(0, 12000);
  const clientMessageId = String(body.client_message_id || "").trim().slice(0, 120);
  if (!organizationId || !agentId || !role || !content || !clientMessageId) return error("بيانات رسالة اللايف غير مكتملة", 400);
  if (!await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  const duplicate = await env.DB.prepare("SELECT * FROM ai_chat_messages WHERE organization_id=? AND user_id=? AND client_message_id=? LIMIT 1")
    .bind(organizationId, user.id, clientMessageId).first<Row>();
  if (duplicate) return api({ ok: true, duplicate: true, message: presentChatRow(duplicate) });
  const saved = await insertChatMessage(env, {
    organizationId, agentId, userId: String(user.id), role, body: content, kind: "live_voice", clientMessageId,
    metadata: { input_mode: "live_voice", realtime: true, speak: false },
  });
  return api({ ok: true, message: presentChatRow(saved!) }, 201);
}

function realtimeEmployeeInstructions(agent: Row, user: Row, history: Row[]) {
  const name = String(agent.name || "الموظف الذكي").trim();
  const recent = history.slice(-16).map(message => `${message.role === "assistant" ? name : chatDisplayName(user)}: ${String(message.display_body || message.body || "").slice(0, 1000)}`).join("\n");
  return [
    `اسمك المحفوظ هو «${name}» وأنت موظف ذكي داخل VAREX AI. هذا هو اسمك الوحيد في هذه الجلسة.`,
    `دورك: ${String(agent.role || "مساعد تنفيذي")}.`,
    agent.objective ? `هدفك: ${String(agent.objective)}.` : "",
    agent.instructions ? `تعليمات المالك: ${String(agent.instructions)}.` : "",
    `أنت تتحدث الآن مباشرة مع ${chatDisplayName(user)} بالصوت. رد بنفس لغة المستخدم، وبالعربية الشامية عندما يتحدث بها.`,
    "ابدأ الرد فور اكتمال كلام المستخدم. اجعل الردود قصيرة وطبيعية، غالباً جملة إلى ثلاث جمل، ولا تكرر السؤال ولا تقدم مقدمات طويلة.",
    "إذا قاطعك المستخدم، توقف فوراً واستمع إليه ثم أكمل على أساس كلامه الجديد.",
    `عندما يناديك المستخدم باسم «${name}» استجب بصورة طبيعية. لا تخترع لنفسك اسماً ولا تستخدم اسماً آخر.`,
    "إذا طلب المستخدم صراحة تغيير اسمك، استدعِ أداة save_employee_name بالاسم الجديد أولاً، ولا تؤكد نجاح التغيير قبل أن ترجع الأداة بنتيجة ناجحة.",
    "بعد نجاح أداة save_employee_name يصبح الاسم الذي أعادته الأداة اسمك الوحيد لباقي الجلسة، واستجب فوراً عند مناداتك به.",
    "لا تقل إنك اتصلت أو أرسلت أو حذفت أو دفعت أو نفذت إجراءً خارج المحادثة ما لم تكن هناك أداة تنفيذ أعادت نجاحاً حقيقياً. في هذه الجلسة الصوتية يمكنك الحوار والشرح وتسجيل طلب المستخدم فقط.",
    "لا تذكر اسم مزود النموذج أو المفتاح أو البنية التقنية. عرّف نفسك كموظف ذكي داخل VAREX AI فقط إذا سُئلت.",
    recent ? `سياق مختصر من المحادثة المحفوظة:\n${recent}` : "",
  ].filter(Boolean).join("\n");
}

async function employeeLiveSession(request: Request, env: Env) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url);
  const organizationId = String(url.searchParams.get("organization_id") || "").trim();
  const agentId = String(url.searchParams.get("agent_id") || "").trim();
  const requestedVoice = String(url.searchParams.get("voice_id") || "").trim();
  const sdp = (await request.text()).trim();
  if (!organizationId || !agentId || !sdp) return error("تعذر تجهيز جلسة الصوت؛ أعد المحاولة", 400);
  if (sdp.length > 120000 || !sdp.startsWith("v=0")) return error("بيانات الاتصال الصوتي غير صالحة", 400);
  if (!await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const [agent, voiceSettings, history, credential] = await Promise.all([
    env.DB.prepare("SELECT id,name,role,objective,instructions,language,tone,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>(),
    env.DB.prepare("SELECT voice_id FROM ai_voice_settings WHERE organization_id=? AND agent_id=? LIMIT 1").bind(organizationId, agentId).first<Row>(),
    loadChatMessages(env, organizationId, agentId, String(user.id), 16),
    platformAiProviderKey(env, "openai").catch(() => null),
  ]);
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  if (!credential?.key) return error("المحادثة الصوتية المباشرة غير مفعّلة بعد في حساب VAREX", 409);
  const voice = realtimeVoiceId(voiceSettings?.voice_id || requestedVoice);
  const session = {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions: realtimeEmployeeInstructions(agent, user, history as Row[]),
    audio: {
      input: {
        transcription: { model: REALTIME_TRANSCRIBE_MODEL, languages: ["ar", "en"], delay: "minimal" },
        turn_detection: { type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true },
      },
      output: { voice },
    },
    tools: [{
      type: "function",
      name: "save_employee_name",
      description: "Save a new name for this VAREX employee when the account owner explicitly asks to rename the employee. Always call this before confirming the new name.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The exact new employee name chosen by the user." } },
        required: ["name"],
        additionalProperties: false,
      },
    }],
    tool_choice: "auto",
  };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential.key}`,
    "Content-Type": "application/json",
    "OpenAI-Safety-Identifier": `varex_${(await sha256(`${user.id}:${organizationId}`)).slice(0, 48)}`,
  };
  if (env.OPENAI_PROJECT_ID) headers["OpenAI-Project"] = env.OPENAI_PROJECT_ID;
  let secretResponse: Response;
  try {
    secretResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers,
      body: JSON.stringify({ session }),
    });
  } catch (caught) {
    console.error("VAREX realtime token network failure", caught instanceof Error ? caught.message : caught);
    return error("تعذر بدء المحادثة اللايف حالياً. حاول مرة ثانية بعد قليل.", 502);
  }
  const secretPayload = await secretResponse.json<Row>().catch(() => ({}));
  if (!secretResponse.ok || !secretPayload.value) {
    console.error("VAREX realtime token rejected", secretResponse.status, JSON.stringify(secretPayload).slice(0, 500));
    const message = secretResponse.status === 429
      ? "رصيد أو سعة المحادثة الصوتية غير متاحة حالياً. تحقق من رصيد API ثم أعد المحاولة."
      : secretResponse.status === 401 || secretResponse.status === 403
        ? "إعداد مفتاح الذكاء لا يسمح بالمحادثة الصوتية المباشرة بعد."
        : "تعذر بدء المحادثة اللايف حالياً. حاول مرة ثانية بعد قليل.";
    return error(message, secretResponse.status === 429 ? 429 : 502);
  }
  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(secretPayload.value)}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp",
      },
      body: sdp,
    });
  } catch (caught) {
    console.error("VAREX realtime SDP network failure", caught instanceof Error ? caught.message : caught);
    return error("تعذر بدء المحادثة اللايف حالياً. حاول مرة ثانية بعد قليل.", 502);
  }
  const answer = await upstream.text();
  if (!upstream.ok || !answer.trim().startsWith("v=0")) {
    console.error("VAREX realtime SDP rejected", upstream.status, answer.slice(0, 500));
    const message = upstream.status === 429
      ? "رصيد أو سعة المحادثة الصوتية غير متاحة حالياً. تحقق من رصيد API ثم أعد المحاولة."
      : upstream.status === 401 || upstream.status === 403
        ? "إعداد مفتاح الذكاء لا يسمح بالمحادثة الصوتية المباشرة بعد."
        : "تعذر بدء المحادثة اللايف حالياً. حاول مرة ثانية بعد قليل.";
    return error(message, upstream.status === 429 ? 429 : 502);
  }
  return new Response(answer, {
    status: 201,
    headers: { "Content-Type": "application/sdp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-VAREX-Voice": voice },
  });
}

function chatMetadata(value: unknown) {
  if (value && typeof value === "object") return value as Row;
  try { return JSON.parse(String(value || "{}")) as Row; }
  catch (_) { return {}; }
}

function customerSafeAiText(value: unknown) {
  const message = String(value || "");
  if (/(?:ai\.dev\/rate-limit|platform\.openai\.com\/settings\/organization\/billing|NO_CREDITS|QUOTA_EXHAUSTED|insufficient_quota|مزود الذكاء متوقف|الحصة الحالية منتهية|حصة\s+[^\n]*API\s+الحالية\s+منتهية|رصيد\s+[^\n]*API\s+منته)/iu.test(message)) {
    return "الموظف الذكي غير متاح مؤقتاً. لم يتم إرسال أو تنفيذ أي شيء؛ حاول مرة أخرى بعد قليل.";
  }
  return message
    .replace(/\b(?:ChatGPT|Open\s*AI|Gemini|Google\s*AI|GPT(?:-[\w.]+)?)\b/giu, "VAREX AI")
    .replace(/(?:شات\s*جي\s*بي\s*تي|أوبن\s*أي\s*آي|جيميناي|جيميني)/giu, "VAREX AI");
}

async function insertChatMessage(env: Env, params: {
  organizationId: string;
  agentId: string;
  userId: string;
  role: "user" | "assistant";
  body: string;
  kind?: string;
  clientMessageId?: string | null;
  actionExecutionId?: string | null;
  metadata?: Row;
}) {
  const id = crypto.randomUUID(), stamp = now();
  await env.DB.prepare("INSERT INTO ai_chat_messages (id,organization_id,agent_id,user_id,role,body,kind,client_message_id,action_execution_id,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, params.organizationId, params.agentId, params.userId, params.role, params.body.slice(0, 12000), params.kind || "text", params.clientMessageId || null, params.actionExecutionId || null, JSON.stringify(params.metadata || {}), stamp, stamp).run();
  return await env.DB.prepare("SELECT * FROM ai_chat_messages WHERE id=? LIMIT 1").bind(id).first<Row>();
}

function presentChatRow(row: Row) {
  const message = hydrate(row);
  if (message.role === "assistant") message.body = customerSafeAiText(message.body);
  const metadata = { ...chatMetadata(row.metadata) };
  for (const key of ["provider", "model", "requested_provider", "provider_error", "provider_failures", "provider_fallback"]) delete metadata[key];
  message.metadata = metadata;
  const executionId = String(row.action_execution_id || "");
  if (executionId) {
    const status = String(row.execution_status || "");
    const resultSummary = String(row.execution_result_summary || "").trim();
    let resultDetails: Row = {};
    try { resultDetails = JSON.parse(String(row.execution_result_details || "{}")) as Row; } catch (_) { resultDetails = {}; }
    message.execution = {
      id: executionId,
      status,
      permission_mode: row.execution_permission_mode || null,
      app_key: row.execution_app_key || null,
      action_key: row.execution_action_key || null,
      result_summary: resultSummary || null,
      result_details: resultDetails,
      error_code: row.execution_error_code || null,
      approval_id: row.approval_id || null,
      approval_status: row.approval_status || null,
    };
    if (resultSummary && ["queued", "running", "action_required", "completed", "failed", "cancelled", "rejected", "blocked"].includes(status)) message.display_body = customerSafeAiText(resultSummary);
  }
  for (const key of ["execution_status", "execution_result_summary", "execution_result_details", "execution_permission_mode", "execution_app_key", "execution_action_key", "execution_error_code", "approval_id", "approval_status"]) delete message[key];
  return message;
}

function isLegacyCannedChatReply(row: Row) {
  if (row.role !== "assistant") return false;
  const body = String(row.body || "").replace(/\s+/g, " ").trim();
  return /^أنا\s+.{0,100}(?:تحدث|احكي)\s+معي\s+بطريقتك(?:\s+المفضلة)?.{0,80}(?:اكتب|أكتب)\s+(?:(?:أ|ا)مر(?:اً|ا)?|المهمة)/iu.test(body)
    || /^أنا\s+موظف(?:ك)?\s+الذكي\b.{0,160}(?:اكتب|أكتب)\s+(?:(?:أ|ا)مر(?:اً|ا)?|المهمة)/iu.test(body);
}

async function loadChatMessages(env: Env, organizationId: string, agentId: string, userId: string, limit = 100) {
  const result = await env.DB.prepare("SELECT m.*,e.status AS execution_status,e.result_summary AS execution_result_summary,e.result_details AS execution_result_details,e.permission_mode AS execution_permission_mode,e.app_key AS execution_app_key,e.action_key AS execution_action_key,e.error_code AS execution_error_code,a.id AS approval_id,a.status AS approval_status FROM ai_chat_messages m LEFT JOIN ai_action_executions e ON e.id=m.action_execution_id AND e.organization_id=m.organization_id LEFT JOIN ai_approvals a ON a.action_execution_id=e.id WHERE m.organization_id=? AND m.agent_id=? AND m.user_id=? ORDER BY m.created_at DESC LIMIT ?")
    .bind(organizationId, agentId, userId, Math.min(150, Math.max(1, limit))).all<Row>();
  return (result.results || []).reverse().filter(row => !isLegacyCannedChatReply(row as Row)).map(row => presentChatRow(row as Row));
}

async function chatReport(env: Env, organizationId: string, agentId: string, agentName: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [counts, recent] = await Promise.all([
    env.DB.prepare("SELECT status,COUNT(*) AS total FROM ai_action_executions WHERE organization_id=? AND agent_id=? AND created_at>=? GROUP BY status").bind(organizationId, agentId, since).all<Row>(),
    env.DB.prepare("SELECT status,result_summary,app_key,action_key,created_at FROM ai_action_executions WHERE organization_id=? AND agent_id=? ORDER BY created_at DESC LIMIT 5").bind(organizationId, agentId).all<Row>(),
  ]);
  const totals = new Map((counts.results || []).map(row => [String(row.status), Number(row.total || 0)]));
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const lines = [
    `تقرير ${agentName} لآخر 7 أيام:`,
    `• ${total} عملية: ${totals.get("completed") || 0} مكتملة، ${totals.get("awaiting_approval") || 0} بانتظار موافقتك، ${totals.get("action_required") || 0} بانتظار إجراء على جهازك، ${totals.get("failed") || 0} فشلت.`,
  ];
  const latest = recent.results || [];
  if (latest.length) {
    lines.push("آخر النتائج:");
    for (const item of latest.slice(0, 3)) lines.push(`• ${String(item.result_summary || `${item.app_key}: ${item.status}`)}`);
  } else lines.push("ما في عمليات منفّذة بعد.");
  return lines.join("\n");
}

function pendingPrompt(intent: ChatActionIntent) {
  if (intent.missing === "target") return ["phone", "voice"].includes(intent.appKey) ? "أكيد. بمين بدك أتصل؟ اكتب الاسم أو الرقم." : "أكيد. لمين بدك أرسل الرسالة؟ اكتب الاسم أو الرقم.";
  if (intent.missing === "message") return intent.appKey === "voice" ? `تمام، الاتصال مع ${intent.target}. شو بدك الموظف الذكي يحكي نيابة عنك؟` : `تمام، فهمت إن المستلم هو ${intent.target}. شو نص الرسالة اللي بدك أبعتها؟`;
  if (intent.missing === "time") return intent.appKey === "alarms" ? "على أي ساعة بدك المنبّه؟ مثلاً: 7 صباحاً." : "متى الموعد؟ اكتب اليوم والساعة، مثلاً: بكرا الساعة 2 ظهراً.";
  if (intent.missing === "contact_details") return `لم أجد رقم ${intent.target || "المستلم"}. اكتب الرقم مع رمز الدولة مرة واحدة، مثلاً +971501234567، وسأتذكره لهذا الاسم في المرات القادمة.`;
  return "بدي معلومة إضافية قبل ما أنفّذ المهمة.";
}

async function latestPendingChatIntent(env: Env, organizationId: string, agentId: string, userId: string) {
  const row = await env.DB.prepare("SELECT role,kind,metadata FROM ai_chat_messages WHERE organization_id=? AND agent_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1")
    .bind(organizationId, agentId, userId).first<Row>();
  if (row?.role !== "assistant" || row.kind !== "clarification") return null;
  const metadata = chatMetadata(row?.metadata);
  return metadata.pending_intent && typeof metadata.pending_intent === "object" ? metadata.pending_intent as Row : null;
}

async function latestPendingChatExecution(env: Env, organizationId: string, agentId: string, userId: string) {
  return await env.DB.prepare("SELECT e.id FROM ai_action_executions e JOIN ai_chat_messages m ON m.action_execution_id=e.id AND m.organization_id=e.organization_id WHERE e.organization_id=? AND e.agent_id=? AND m.user_id=? AND e.status='awaiting_approval' ORDER BY e.created_at DESC LIMIT 1")
    .bind(organizationId, agentId, userId).first<Row>();
}

async function executeChatDecision(request: Request, env: Env, organizationId: string, agentId: string, user: Row, executionId: string, decision: "approved" | "rejected") {
  const linked = await env.DB.prepare("SELECT m.id FROM ai_chat_messages m JOIN ai_action_executions e ON e.id=m.action_execution_id WHERE m.organization_id=? AND m.agent_id=? AND m.user_id=? AND e.id=? LIMIT 1")
    .bind(organizationId, agentId, user.id, executionId).first<Row>();
  if (!linked) return { ok: false, status: 404, data: { message: "ما لقيت عملية معلّقة بهالمحادثة." } as Row };
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { Authorization: request.headers.get("Authorization") || "", "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  const response = await decideAgentAction(forwarded, env, executionId);
  const data = await response.json<Row>().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function normalizeChatAction(action: { appKey: string; actionKey: string; target: string; payload: Record<string, unknown> }): ChatActionIntent {
  const payload = action.payload && typeof action.payload === "object" ? { ...action.payload } : {};
  const target = String(action.target || "").trim();
  const isCallRequest = action.appKey === "voice" && action.actionKey === "speak_on_behalf"
    || action.appKey === "phone" && ["start_call", "redial"].includes(action.actionKey);
  if (!isCallRequest) return { kind: "action", appKey: action.appKey, actionKey: action.actionKey, target, payload };
  const purpose = String(payload.purpose || payload.message || payload.instruction || "").trim();
  if (purpose) {
    payload.purpose = purpose;
    payload.message = purpose;
  }
  return {
    kind: "action",
    appKey: "voice",
    actionKey: "speak_on_behalf",
    target,
    payload,
    missing: !target ? "target" : !purpose ? "message" : undefined,
  };
}

async function dispatchChatAction(request: Request, env: Env, organizationId: string, agentId: string, action: { appKey: string; actionKey: string; target: string; payload: Record<string, unknown> }) {
  const normalized = normalizeChatAction(action);
  if (!deviceAppCatalog[normalized.appKey]?.actions[normalized.actionKey]) {
    return { body: "فهمت الطلب، لكن العملية التي اختارها نموذج الذكاء غير موجودة ضمن صلاحيات VAREX، لذلك لم يُنفّذ أي شيء.", kind: "error", executionId: null as string | null, metadata: { app_key: normalized.appKey, action_key: normalized.actionKey, invalid_tool_action: true } as Row };
  }
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { Authorization: request.headers.get("Authorization") || "", "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: organizationId,
      agent_id: agentId,
      app_key: normalized.appKey,
      action_key: normalized.actionKey,
      target: normalized.target,
      payload: normalized.payload,
      direct_owner_command: normalized.appKey === "voice" && normalized.actionKey === "speak_on_behalf",
    }),
  });
  const response = await executeAgentAction(forwarded, env);
  const result = await response.json<Row>().catch(() => ({}));
  const execution = result.execution && typeof result.execution === "object" ? result.execution as Row : null;
  const needsContactNumber = result.code === "CONTACT_NUMBER_REQUIRED" && ["voice", "whatsapp"].includes(normalized.appKey);
  const pendingIntent = needsContactNumber ? { ...normalized, missing: "contact_details" } : null;
  return {
    body: pendingIntent ? pendingPrompt(pendingIntent) : String(result.message || "تعذر تنفيذ المهمة حالياً."),
    kind: pendingIntent ? "clarification" : execution?.status === "awaiting_approval" ? "approval" : response.ok ? "action" : "error",
    executionId: execution?.id ? String(execution.id) : null,
    metadata: { app_key: normalized.appKey, action_key: normalized.actionKey, approval_id: result.approval_id || null, ...(pendingIntent ? { pending_intent: pendingIntent } : {}) } as Row,
  };
}

async function chatMessages(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  if (request.method === "GET") {
    const url = new URL(request.url), organizationId = String(url.searchParams.get("organization_id") || "").trim(), agentId = String(url.searchParams.get("agent_id") || "").trim();
    if (!organizationId || !agentId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
    const agent = await env.DB.prepare("SELECT id,name,role,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
    if (!agent) return error("الموظف المحدد غير موجود", 404);
    const messages = await loadChatMessages(env, organizationId, agentId, String(user.id), Number(url.searchParams.get("limit") || 100));
    return api({ ok: true, agent: hydrate(agent), messages });
  }
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), agentId = String(body.agent_id || "").trim(), content = String(body.body || "").trim();
  const clientMessageId = String(body.client_message_id || "").trim().slice(0, 120);
  const inputMode = body.input_mode === "voice" ? "voice" : "text";
  if (!organizationId || !agentId || !content) return error("حدد الموظف واكتب الرسالة", 400);
  if (content.length > 12000) return error("الرسالة أطول من الحد المسموح", 400);
  if (!await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  const agent = await env.DB.prepare("SELECT id,name,role,objective,instructions,language,tone,status FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(agentId, organizationId).first<Row>();
  if (!agent) return error("الموظف المحدد غير موجود", 404);
  if (clientMessageId) {
    const existing = await env.DB.prepare("SELECT id FROM ai_chat_messages WHERE organization_id=? AND user_id=? AND client_message_id=? LIMIT 1").bind(organizationId, user.id, clientMessageId).first<Row>();
    if (existing) return api({ ok: true, duplicate: true, messages: await loadChatMessages(env, organizationId, agentId, String(user.id), 100) });
  }
  const pendingIntent = await latestPendingChatIntent(env, organizationId, agentId, String(user.id));
  const userMessage = await insertChatMessage(env, { organizationId, agentId, userId: String(user.id), role: "user", body: content, kind: inputMode, clientMessageId: clientMessageId || null, metadata: { input_mode: inputMode } });
  const requestedName = requestedEmployeeName(content);
  let intent = parseChatIntent(content);
  if (pendingIntent && !["approve", "reject"].includes(intent.kind)) {
    const continued = continuePendingIntent(pendingIntent, content);
    if (continued) intent = continued;
  }
  let assistantBody = "", assistantKind = "text", executionId: string | null = null, metadata: Row = { speak: true };
  if (requestedName) {
    if (!await authorizeOrg(env, user, organizationId, true)) {
      assistantBody = "تغيير اسم الموظف متاح لمالك مساحة العمل فقط.";
      assistantKind = "error";
      metadata.speak = false;
    } else {
      try {
        const renamed = await saveEmployeeName(env, organizationId, agentId, String(user.id), requestedName, "chat");
        agent.name = renamed.name;
        assistantBody = `تمام، اسمي «${String(renamed.name)}» من هلا. لما تناديني بهالاسم برد عليك.`;
        metadata.agent_name = renamed.name;
        metadata.identity_updated = true;
      } catch (_) {
        assistantBody = "اكتب الاسم الجديد بشكل واضح، من حرفين إلى 48 حرفاً.";
        assistantKind = "error";
        metadata.speak = false;
      }
    }
  } else if ((intent.kind === "approve" || intent.kind === "reject")) {
    const pendingExecution = await latestPendingChatExecution(env, organizationId, agentId, String(user.id));
    if (!pendingExecution?.id) assistantBody = "ما في عملية معلّقة تنتظر موافقتك بهالمحادثة.";
    else {
      const decision = intent.kind === "approve" ? "approved" : "rejected";
      const decided = await executeChatDecision(request, env, organizationId, agentId, user, String(pendingExecution.id), decision);
      assistantBody = String(decided.data.message || (decision === "approved" ? "تمت الموافقة." : "تم الرفض."));
      assistantKind = decided.ok ? "action" : "error";
      executionId = String(pendingExecution.id);
    }
  } else if (intent.kind === "action" && intent.appKey === "voice") {
    if (intent.missing) {
      assistantBody = pendingPrompt(intent);
      assistantKind = "clarification";
      metadata.pending_intent = intent;
    } else {
      const dispatched = await dispatchChatAction(request, env, organizationId, agentId, intent);
      assistantBody = dispatched.body; assistantKind = dispatched.kind; executionId = dispatched.executionId;
      metadata = { ...metadata, ...dispatched.metadata };
    }
  } else {
    const intelligent = await intelligentChatReply(env, organizationId, agent, user);
    if (intelligent.reply) {
      if (intelligent.reply.kind === "text") {
        assistantBody = String(intelligent.reply.text || "").trim();
        if (intelligent.reply.sources?.length) metadata.sources = intelligent.reply.sources;
      }
      else if (intelligent.reply.kind === "report") {
        assistantBody = await chatReport(env, organizationId, agentId, String(agent.name || "الموظف"));
        assistantKind = "report";
      } else if (intelligent.reply.kind === "action" && intelligent.reply.action) {
        const normalizedAction = normalizeChatAction(intelligent.reply.action);
        if (normalizedAction.missing) {
          assistantBody = pendingPrompt(normalizedAction);
          assistantKind = "clarification";
          metadata.pending_intent = normalizedAction;
        } else {
          const dispatched = await dispatchChatAction(request, env, organizationId, agentId, normalizedAction);
          assistantBody = dispatched.body; assistantKind = dispatched.kind; executionId = dispatched.executionId;
          metadata = { ...metadata, ...dispatched.metadata };
        }
      }
    } else if (intent.kind === "report") assistantBody = await chatReport(env, organizationId, agentId, String(agent.name || "الموظف"));
    else if (intelligent.error === "AI_PROVIDER_UNAVAILABLE") {
      assistantBody = aiProviderUnavailableMessage(intelligent.failures);
      assistantKind = "error";
      metadata.speak = false;
    }
    else if (intelligent.error === "AI_PROVIDER_NOT_CONFIGURED") {
      assistantBody = "المحادثة الذكية غير مفعّلة حالياً. تواصل مع إدارة VAREX؛ لم يتم إرسال أو تنفيذ أي شيء.";
      assistantKind = "error";
      metadata.speak = false;
    } else if (intent.kind === "action" && intent.missing) {
      assistantBody = pendingPrompt(intent);
      assistantKind = "clarification";
      metadata.pending_intent = intent;
    } else if (intent.kind === "action") {
      const dispatched = await dispatchChatAction(request, env, organizationId, agentId, intent);
      assistantBody = dispatched.body; assistantKind = dispatched.kind; executionId = dispatched.executionId;
      metadata = { ...metadata, ...dispatched.metadata };
    }
  }
  if (!assistantBody) {
    assistantBody = "ما وصلني رد واضح، لذلك لم أنفّذ أي شيء. جرّب صياغة الطلب مرة ثانية.";
    assistantKind = "error";
  }
  const assistantMessage = await insertChatMessage(env, { organizationId, agentId, userId: String(user.id), role: "assistant", body: assistantBody, kind: assistantKind, actionExecutionId: executionId, metadata });
  return api({ ok: true, messages: [presentChatRow(userMessage!), presentChatRow(assistantMessage!)] }, 201);
}

async function decideChatAction(request: Request, env: Env, executionId: string) {
  if (request.method !== "POST") return error("الطريقة غير مدعومة", 405);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim(), agentId = String(body.agent_id || "").trim();
  const decision = String(body.decision || "") as "approved" | "rejected";
  if (!organizationId || !agentId || !["approved", "rejected"].includes(decision)) return error("قرار الموافقة غير صالح", 400);
  if (!await authorizeOrg(env, user, organizationId, true)) return error("مالك المساحة فقط يستطيع اعتماد العملية", 403);
  const result = await executeChatDecision(request, env, organizationId, agentId, user, executionId, decision);
  return api(result.data, result.status);
}

async function dataApi(request: Request, env: Env, table: string) {
  const columns = tableColumns[table]; if (!columns) return error("الجدول غير متاح", 404);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), method = request.method.toUpperCase();
  const subscriptionSetupTables = new Set(["ai_organizations", "ai_members", "ai_subscriptions"]);
  if (table === "ai_integrations" && method !== "GET") return error("تعديل ربط الحسابات متاح فقط عبر بوابة الربط الآمنة", 405);
  if (table === "ai_knowledge_items" && method !== "GET") return error("إضافة الملفات متاحة فقط عبر مسار الرفع الآمن", 405);
  if (table === "ai_action_executions" && method !== "GET") return error("سجل التنفيذ يُكتب فقط من محرك التنفيذ", 405);
  if (table === "ai_voice_calls" && method !== "GET") return error("سجل المكالمات يُكتب فقط من سنترال المكالمات", 405);
  if (table === "ai_voice_settings" && method !== "GET") return error("ربط رقم المكالمات متاح فقط عبر مسار التوثيق الآمن", 405);
  if (method === "GET") {
    if (!subscriptionSetupTables.has(table) && !isDeveloperAccount(user)) {
      const requestedOrg = url.searchParams.get("organization_id");
      const orgId = requestedOrg?.startsWith("eq.") ? decodeValue(requestedOrg) : "";
      if (!orgId || !await authorizeOrg(env, user, orgId)) return subscriptionRequired();
    }
    const where: string[] = [], binds: unknown[] = [];
    if (table === "ai_organizations") { where.push("(owner_id=? OR id IN (SELECT organization_id FROM ai_members WHERE user_id=?))"); binds.push(user.id, user.id); }
    else if (table === "ai_members") { where.push("user_id=?"); binds.push(user.id); }
    else { where.push("organization_id IN (SELECT organization_id FROM ai_members WHERE user_id=?)"); binds.push(user.id); }
    if (table === "ai_integrations") where.push("provider IN ('whatsapp','facebook','instagram','tiktok','email','youtube','parking','website')");
    for (const column of ["id", "organization_id", "user_id"]) { const value = url.searchParams.get(column); if (value?.startsWith("eq.")) { where.push(`${column}=?`); binds.push(decodeValue(value)); } }
    let order = "created_at DESC"; const requestedOrder = url.searchParams.get("order");
    if (requestedOrder) { const [column, direction] = requestedOrder.split("."); if (["created_at","updated_at","name"].includes(column)) order = `${column} ${direction === "asc" ? "ASC" : "DESC"}`; }
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const result = await env.DB.prepare(`SELECT * FROM ${table} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`).bind(...binds, limit).all<Row>();
    return api(result.results.map(row => presentRow(table, row as Row)));
  }
  if (method === "POST") {
    const body = await request.json<Row>().catch(() => ({})), stamp = now();
    if (table === "ai_organizations") { body.owner_id = user.id; body.trial_ends_at ||= stamp; }
    else {
      const orgId = String(body.organization_id || "");
      const ownsNewWorkspace = table === "ai_members" && Boolean(await env.DB.prepare("SELECT id FROM ai_organizations WHERE id=? AND owner_id=? LIMIT 1").bind(orgId, user.id).first());
      const subscriptionRequest = table === "ai_subscriptions";
      const ownerControlled = ownerControlledTables.has(table);
      if (!orgId || (!ownsNewWorkspace && !await authorizeOrg(env, user, orgId, subscriptionRequest || ownerControlled, subscriptionRequest))) return error(ownerControlled ? "مالك المساحة فقط يستطيع تعديل صلاحيات الموظف" : "ليست لديك صلاحية على مساحة العمل", 403);
      if (table === "ai_members") {
        if (!ownsNewWorkspace) return error("إضافة أعضاء الفريق تحتاج مسار دعوة إدارياً آمناً", 403);
        body.user_id = user.id; body.role = "owner";
      }
      if (subscriptionRequest) {
        if (isDeveloperAccount(user)) return error("حساب المالك لا يحتاج اشتراكاً مدفوعاً", 409);
        const plan = customerSubscriptionPlans[String(body.plan_code || "")];
        if (!plan) return error("اختر باقة اشتراك صالحة");
        body.status = "pending_payment";
        body.agent_limit = plan.agentLimit;
        body.monthly_task_limit = plan.monthlyTaskLimit;
        body.billing_cycle = plan.billingCycle;
        body.payment_method = ["PayPal", "تحويل بنكي"].includes(String(body.payment_method || "")) ? body.payment_method : "تحويل بنكي";
        body.renews_at = null;
        await env.DB.prepare("UPDATE ai_subscriptions SET status='superseded',updated_at=? WHERE organization_id=? AND status='pending_payment'").bind(stamp, orgId).run();
      }
      if (["ai_agents","ai_tasks","ai_messages","ai_knowledge_items"].includes(table)) body.created_by = user.id;
      if (table === "ai_audit_logs") body.user_id = user.id;
      if (table === "ai_device_connections") body.user_id = user.id;
      if (["ai_agent_permissions","ai_voice_settings"].includes(table)) body.updated_by = user.id;
      if (table === "ai_agent_permissions") {
        if (!permissionModes.has(String(body.mode || ""))) return error("اختر وضع صلاحية صالحاً");
        if (!permissionRiskLevels.has(String(body.risk_level || ""))) return error("مستوى خطورة الصلاحية غير صالح");
        if (!supportedDeviceApps.has(String(body.app_key || "")) || !String(body.action_key || "").trim()) return error("التطبيق أو العملية غير مدعومين");
        const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(body.agent_id, orgId).first<Row>();
        if (!agent) return error("الموظف المحدد غير موجود", 404);
      }
      if (table === "ai_voice_settings") {
        const agent = await env.DB.prepare("SELECT id FROM ai_agents WHERE id=? AND organization_id=? LIMIT 1").bind(body.agent_id, orgId).first<Row>();
        if (!agent) return error("الموظف المحدد غير موجود", 404);
      }
    }
    const record: Row = { ...defaults[table], ...body, id: crypto.randomUUID(), created_at: stamp, updated_at: stamp };
    if (table === "ai_subscriptions") record.starts_at ||= stamp;
    const insertColumns = ["id", ...columns, "created_at", "updated_at"].filter((column, index, all) => all.indexOf(column) === index && record[column] !== undefined);
    if (table === "ai_integrations") {
      const existing = await env.DB.prepare("SELECT id FROM ai_integrations WHERE organization_id=? AND provider=? LIMIT 1").bind(record.organization_id, record.provider).first<Row>();
      if (existing) { await env.DB.prepare("UPDATE ai_integrations SET status=?,metadata=?,updated_at=? WHERE id=?").bind(storedValue("status", record.status), storedValue("metadata", record.metadata), stamp, existing.id).run(); const row = await env.DB.prepare("SELECT * FROM ai_integrations WHERE id=?").bind(existing.id).first<Row>(); return api([hydrate(row!)]); }
    }
    await env.DB.prepare(`INSERT INTO ${table} (${insertColumns.join(",")}) VALUES (${insertColumns.map(() => "?").join(",")})`).bind(...insertColumns.map(column => storedValue(column, record[column]))).run();
    const inserted = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(record.id).first<Row>(); return api([hydrate(inserted!)], 201);
  }
  if (method === "PATCH") {
    const idParam = url.searchParams.get("id"); if (!idParam?.startsWith("eq.")) return error("معرّف السجل مطلوب"); const id = decodeValue(idParam);
    const existing = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? LIMIT 1`).bind(id).first<Row>(); if (!existing) return error("السجل غير موجود", 404);
    const orgId = table === "ai_organizations" ? String(existing.id) : String(existing.organization_id || "");
    if (table === "ai_subscriptions") return error("يُفعّل الاشتراك من حساب المالك بعد تأكيد استلام الدفع", 403);
    const ownerControlled = ownerControlledTables.has(table);
    if (!ownerControlled && !await authorizeOrg(env, user, orgId, table === "ai_organizations" || table === "ai_subscriptions" || table === "ai_members")) return error("ليست لديك صلاحية تعديل السجل", 403);
    if (ownerControlled && !await authorizeOrg(env, user, orgId, true)) return error("مالك المساحة فقط يستطيع تعديل صلاحيات الموظف", 403);
    const body = await request.json<Row>().catch(() => ({}));
    if (table === "ai_agent_permissions") {
      if (body.mode !== undefined && !permissionModes.has(String(body.mode))) return error("اختر وضع صلاحية صالحاً");
      if (body.risk_level !== undefined && !permissionRiskLevels.has(String(body.risk_level))) return error("مستوى خطورة الصلاحية غير صالح");
      body.updated_by = user.id;
    }
    if (table === "ai_voice_settings") body.updated_by = user.id;
    if (table === "ai_device_connections") body.user_id = user.id;
    const mutable = columns.filter(column => !["owner_id","organization_id","created_by"].includes(column) && body[column] !== undefined);
    if (!mutable.length) return api([hydrate(existing)]);
    await env.DB.prepare(`UPDATE ${table} SET ${[...mutable,"updated_at"].map(column => `${column}=?`).join(",")} WHERE id=?`).bind(...mutable.map(column => storedValue(column, body[column])), now(), id).run();
    const updated = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Row>(); return api([hydrate(updated!)]);
  }
  return error("الطريقة غير مدعومة", 405);
}

const worker = { async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (["/", "/index.html", "/legacy-index", "/legacy-index.html"].includes(url.pathname)) return noStoreAsset(request, env, "/legacy-index.html");
    if (url.pathname === "/install/") {
      const canonical = new URL(request.url);
      canonical.pathname = "/install";
      return Response.redirect(canonical.toString(), 308);
    }
    if (["/install", "/install.html"].includes(url.pathname)) return noStoreAsset(request, env, "/install.html");
    if (["/manifest.webmanifest", "/sw.js", "/install.css", "/install.js", "/favicon.svg", "/varex-icon-64.png"].includes(url.pathname) || /^\/icons\/(?:icon-(?:192|512)|icon-maskable-512|apple-touch-icon)\.png$/.test(url.pathname)) {
      const asset = await noStoreAsset(request, env, url.pathname);
      const headers = new Headers(asset.headers);
      if (url.pathname === "/manifest.webmanifest") headers.set("Content-Type", "application/manifest+json; charset=utf-8");
      if (url.pathname === "/sw.js") {
        headers.set("Content-Type", "text/javascript; charset=utf-8");
        headers.set("Service-Worker-Allowed", "/");
      }
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
    if (["/app.js", "/i18n.js", "/command-engine.js"].includes(url.pathname) || /^\/locales\/[a-z]{2}\.json$/.test(url.pathname)) return noStoreAsset(request, env, url.pathname);
    if (url.pathname === "/favicon.ico") return noStoreAsset(request, env, "/favicon.svg");
    if (["/privacy", "/privacy.html"].includes(url.pathname)) return noStoreAsset(request, env, "/privacy.html");
    if (["/terms", "/terms.html"].includes(url.pathname)) return noStoreAsset(request, env, "/terms.html");
    if (["/data-deletion", "/data-deletion.html"].includes(url.pathname)) return noStoreAsset(request, env, "/data-deletion.html");
    if (url.pathname.startsWith("/api/auth/")) return auth(request, env, url.pathname.slice(10));
    if (url.pathname === "/api/admin/meta-status") return metaAdmin(request, env, "status");
    if (url.pathname === "/api/admin/meta-secret") return metaAdmin(request, env, "secret");
    if (url.pathname === "/api/admin/paypal-status") return payPalAdmin(request, env, "status");
    if (url.pathname === "/api/admin/paypal-credentials") return payPalAdmin(request, env, "credentials");
    if (url.pathname === "/api/admin/voice-gateway") return voiceGatewayAdmin(request, env);
    if (url.pathname === "/api/admin/activation-codes") return activationCodeAdmin(request, env);
    if (url.pathname === "/api/admin/subscriptions") return subscriptionAdmin(request, env);
    if (url.pathname === "/api/activation-codes/redeem") return redeemActivationCode(request, env);
    if (url.pathname === "/api/paypal/orders") return createPayPalOrder(request, env);
    const payPalCapture = url.pathname.match(/^\/api\/paypal\/orders\/([^/]+)\/capture$/);
    if (payPalCapture) return capturePayPalOrder(request, env, decodeURIComponent(payPalCapture[1]));
    if (url.pathname === "/api/admin/whatsapp-sync-existing" && request.method === "POST") return syncExistingWhatsAppAccount(request, env);
    if (url.pathname === "/api/integrations/readiness" && request.method === "GET") return integrationReadiness(request, env);
    if (url.pathname === "/api/integrations/websites") return websiteSources(request, env);
    if (url.pathname === "/api/integrations/parking") return parkingConnection(request, env);
    if (url.pathname === "/api/integrations/start" && request.method === "GET") return beginIntegration(request, env);
    if (url.pathname === "/api/integrations/complete/meta-sdk" && request.method === "POST") return completeWhatsAppEmbeddedSignup(request, env);
    if (url.pathname === "/api/integrations/callback/meta" && request.method === "GET") return integrationCallback(request, env, "meta");
    if (url.pathname === "/api/integrations/callback/tiktok" && request.method === "GET") return integrationCallback(request, env, "tiktok");
    if (url.pathname === "/api/integrations/callback/google" && request.method === "GET") return integrationCallback(request, env, "google");
    if (url.pathname === "/api/integrations/disconnect") return disconnectIntegration(request, env);
    if (url.pathname === "/api/webhooks/meta/whatsapp") return whatsappWebhook(request, env, ctx);
    if (url.pathname === "/api/webhooks/openai/voice") return openAiVoiceWebhook(request, env);
    if (url.pathname === "/api/integrations/whatsapp/send" && request.method === "POST") return sendWhatsAppMessage(request, env);
    if (url.pathname === "/api/permissions") return permissionCenter(request, env);
    if (url.pathname === "/api/permissions/emergency-stop") return emergencyStopAgent(request, env);
    if (url.pathname === "/api/voice/readiness") return voiceReadiness(request, env);
    if (url.pathname === "/api/voice/number/select") return voiceNumberVerification(request, env, "select");
    if (url.pathname === "/api/voice/number/verify") return voiceNumberVerification(request, env, "start");
    if (url.pathname === "/api/voice/number/status") return voiceNumberVerification(request, env, "status");
    if (url.pathname === "/api/voice/number/disconnect") return voiceNumberVerification(request, env, "disconnect");
    if (url.pathname === "/api/voice/calls") return voiceCalls(request, env);
    if (url.pathname === "/api/ai/providers") return aiProviderConfiguration(request, env);
    if (url.pathname === "/api/chat/messages") return chatMessages(request, env);
    if (url.pathname === "/api/chat/voice") return employeeVoicePreference(request, env);
    if (url.pathname === "/api/chat/speech") return chatSpeech(request, env);
    if (url.pathname === "/api/chat/identity") return employeeIdentity(request, env);
    if (url.pathname === "/api/chat/live/message") return liveChatMessage(request, env);
    if (url.pathname === "/api/chat/live/session") return employeeLiveSession(request, env);
    const chatActionDecision = url.pathname.match(/^\/api\/chat\/actions\/([^/]+)\/decision$/);
    if (chatActionDecision) return decideChatAction(request, env, decodeURIComponent(chatActionDecision[1]));
    if (url.pathname === "/api/actions/execute") return executeAgentAction(request, env);
    const actionDecision = url.pathname.match(/^\/api\/actions\/([^/]+)\/decision$/);
    if (actionDecision) return decideAgentAction(request, env, decodeURIComponent(actionDecision[1]));
    if (["/api/devices/register", "/api/devices/android/register"].includes(url.pathname)) return registerDevice(request, env);
    if (["/api/devices/disconnect", "/api/devices/android/disconnect"].includes(url.pathname)) return disconnectDevice(request, env);
    if (["/api/devices/commands", "/api/devices/android/commands"].includes(url.pathname)) return pollDeviceCommand(request, env);
    const deviceCommandResult = url.pathname.match(/^\/api\/devices(?:\/android)?\/commands\/([^/]+)\/result$/);
    if (deviceCommandResult) return finishDeviceCommand(request, env, decodeURIComponent(deviceCommandResult[1]));
    if (url.pathname === "/api/knowledge/upload" && request.method === "POST") return uploadKnowledgeFile(request, env);
    const knowledgeDownload = url.pathname.match(/^\/api\/knowledge\/([^/]+)\/download$/);
    if (knowledgeDownload && request.method === "GET") return downloadKnowledgeFile(request, env, decodeURIComponent(knowledgeDownload[1]));
    if (url.pathname.startsWith("/api/data/")) return dataApi(request, env, url.pathname.slice(10));
    if (url.pathname === "/_vinext/image") return handleImageOptimization(request, { fetchAsset: path => env.ASSETS.fetch(new Request(new URL(path, request.url))), transformImage: async (body, { width, format, quality }) => (await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality })).response() }, [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES]);
    return handler.fetch(request, env, ctx);
  } catch (caught) { console.error("VAREX AI request failed", caught); return error("حدث خطأ تقني مؤقت. حاول مرة أخرى.", 500); }
} };
export default worker;
