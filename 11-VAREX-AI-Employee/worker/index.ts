import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

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
}
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
type Row = Record<string, unknown>;
type OAuthProvider = "whatsapp" | "facebook" | "instagram" | "tiktok";

const oauthProviders = new Set<OAuthProvider>(["whatsapp", "facebook", "instagram", "tiktok"]);
const developerAccountEmail = "areejalloush1988@gmail.com";
const varexAdminEmails = new Set([developerAccountEmail]);
const customerSubscriptionPlans: Record<string, { agentLimit: number | null; monthlyTaskLimit: number; billingCycle: string }> = {
  solo: { agentLimit: 1, monthlyTaskLimit: 3000, billingCycle: "monthly" },
  team3: { agentLimit: 3, monthlyTaskLimit: 10000, billingCycle: "monthly" },
  team5: { agentLimit: 5, monthlyTaskLimit: 25000, billingCycle: "monthly" },
  team10: { agentLimit: 10, monthlyTaskLimit: 60000, billingCycle: "monthly" },
  unlimited: { agentLimit: null, monthlyTaskLimit: 120000, billingCycle: "monthly" },
};

const jsonColumns = new Set(["channels", "metadata", "details"]);
const booleanColumns = new Set(["requires_price_approval", "audit_enabled", "auto_publish", "vat_enabled", "requires_approval"]);
const tableColumns: Record<string, string[]> = {
  ai_organizations: ["owner_id","name","industry","status","trial_ends_at","timezone","ui_language","ui_theme","requires_price_approval","audit_enabled","auto_publish","vat_enabled","legal_name","trn","billing_email"],
  ai_members: ["organization_id","user_id","role"],
  ai_agents: ["organization_id","name","role","objective","language","tone","channels","status","requires_approval","instructions","created_by"],
  ai_tasks: ["organization_id","agent_id","title","instructions","status","priority","requires_approval","output","scheduled_at","started_at","completed_at","created_by"],
  ai_leads: ["organization_id","name","company","service","status","source","priority","score","next_action","notes"],
  ai_approvals: ["organization_id","task_id","title","summary","status","requested_by","reviewed_by","reviewed_at"],
  ai_integrations: ["organization_id","provider","status","connected_account","last_sync_at","metadata"],
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
      html: `<!doctype html><html lang="${locale}" dir="${direction}"><body style="margin:0;background:${theme.soft};font-family:Arial,Tahoma,sans-serif;color:${theme.ink}"><div style="max-width:560px;margin:28px auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid rgba(23,33,60,.1)"><div style="background:${theme.primary};color:#ffffff;padding:22px 28px;border-bottom:5px solid ${theme.accent}"><div style="font-size:24px;font-weight:900;letter-spacing:2px">VAREX</div><div style="font-size:12px;opacity:.82;margin-top:4px">AI EMPLOYEE</div></div><div style="padding:30px"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.8;margin:0 0 22px">${intro}</p><div style="font-size:12px;color:#6b7280;margin-bottom:8px">${copy.label}</div><div dir="ltr" style="font-size:36px;font-weight:900;letter-spacing:9px;background:${theme.soft};color:${theme.primary};padding:20px;text-align:center;border-radius:16px;border:1px solid ${theme.accent}">${code}</div><p style="font-size:13px;line-height:1.8;color:#6b7280;margin:22px 0 0">${copy.expires}<br>${copy.security}</p></div></div></body></html>`,
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
    user_metadata: { full_name: developer ? "حساب المطوّر" : row.full_name || "", business_name: row.business_name || "" },
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
  return await env.DB.prepare("SELECT * FROM ai_subscriptions WHERE organization_id=? AND status='active' AND plan_code IN ('solo','team3','team5','team10','unlimited') AND (renews_at IS NULL OR renews_at>?) ORDER BY created_at DESC LIMIT 1")
    .bind(orgId, now()).first<Row>() || null;
}
async function hasSubscriptionAccess(env: Env, user: Row, orgId: string) {
  return isDeveloperAccount(user) || Boolean(await activePaidSubscription(env, orgId));
}
function subscriptionRequired() {
  return api({ code: "SUBSCRIPTION_REQUIRED", message: "يلزم اشتراك مدفوع وفعّال لاستخدام النظام" }, 402);
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

async function upsertIntegration(env: Env, organizationId: string, provider: OAuthProvider, values: { status: string; connectedAccount: string; metadata: Row }) {
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

async function subscriptionAdmin(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return error("يلزم تسجيل الدخول", 401);
  if (!isDeveloperAccount(user)) return error("هذه الصفحة متاحة لحساب المطوّر فقط", 403);

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
    },
    graph_version: meta.graphVersion,
  });
}

async function beginIntegration(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), provider = url.searchParams.get("provider") as OAuthProvider, organizationId = String(url.searchParams.get("organization_id") || "");
  if (!oauthProviders.has(provider)) return error("قناة الربط غير مدعومة", 400);
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  if (provider === "tiktok" && (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET)) return error("بوابة ربط TikTok تحتاج تفعيلها من إدارة VAREX", 503);
  if (provider !== "tiktok") {
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

async function discoverMetaAssets(env: Env, provider: Exclude<OAuthProvider, "tiktok">, accessToken: string) {
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

async function completeMetaIntegration(request: Request, env: Env, provider: Exclude<OAuthProvider, "tiktok">, organizationId: string, code: string) {
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

async function processWhatsAppWebhook(env: Env, payload: Row) {
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
        await env.DB.prepare("INSERT OR IGNORE INTO ai_messages (id,organization_id,contact_name,contact_address,channel,direction,body,send_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
          .bind(`wa:${messageId}`, organizationId, namesByWaId.get(sender) || sender || "عميل واتساب", sender || null, "whatsapp", "inbound", whatsappMessageBody(message), "received", null, createdAt, now()).run();
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

async function whatsappWebhook(request: Request, env: Env) {
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
  if (payload.object === "whatsapp_business_account") await processWhatsAppWebhook(env, payload);
  return api({ received: true });
}

async function sendWhatsAppMessage(request: Request, env: Env) {
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const body = await request.json<Row>().catch(() => ({}));
  const organizationId = String(body.organization_id || ""), to = String(body.to || "").replace(/\D/g, ""), messageBody = String(body.body || "").trim();
  if (!organizationId || !await authorizeOrg(env, user, organizationId)) return error("ليست لديك صلاحية على مساحة العمل", 403);
  if (!to || !messageBody || messageBody.length > 4096) return error("رقم المستلم ونص الرسالة مطلوبان", 400);
  const integration = await env.DB.prepare("SELECT * FROM ai_integrations WHERE organization_id=? AND provider='whatsapp' AND status='connected' LIMIT 1").bind(organizationId).first<Row>();
  if (!integration) return error("اربط حساب WhatsApp Business أولاً", 409);
  let metadata: Row = {};
  try { metadata = JSON.parse(String(integration.metadata || "{}")) as Row; } catch (_) { return error("بيانات ربط WhatsApp غير صالحة", 500); }
  const accounts = Array.isArray(metadata.accounts) ? metadata.accounts as Row[] : [];
  const phones = accounts.flatMap(account => Array.isArray(account.phones) ? account.phones as Row[] : []);
  const requestedPhoneId = String(body.phone_number_id || "");
  const phone = phones.find(item => String(item.id || "") === requestedPhoneId) || phones[0];
  if (!phone?.id) return error("لم يتم العثور على رقم WhatsApp Business صالح", 409);
  const encrypted = metadata.credential && typeof metadata.credential === "object" ? metadata.credential as Row : null;
  if (!encrypted) return error("بيانات دخول WhatsApp غير متوفرة", 500);
  const credentials = await decryptIntegrationCredentials(env, encrypted);
  const accessToken = String(credentials.access_token || "");
  if (!accessToken) return error("انتهت صلاحية ربط WhatsApp؛ أعد الربط", 401);
  const { graphVersion } = await metaConfig(env);
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(String(phone.id))}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: messageBody } }),
  });
  const result = await responseJson(response);
  const sent = Array.isArray(result.messages) ? (result.messages as Row[])[0] : null;
  const messageId = String(sent?.id || crypto.randomUUID());
  const stamp = now();
  await env.DB.prepare("INSERT OR REPLACE INTO ai_messages (id,organization_id,contact_name,contact_address,channel,direction,body,send_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(`wa:${messageId}`, organizationId, String(body.contact_name || to), to, "whatsapp", "outbound", messageBody, "sent", user.id, stamp, stamp).run();
  return api({ ok: true, message_id: messageId });
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

async function integrationCallback(request: Request, env: Env, callbackProvider: "meta" | "tiktok") {
  const url = new URL(request.url), state = String(url.searchParams.get("state") || "");
  if (!state) return integrationPopupResponse(request, env, { integration: "error", reason: "invalid_state" });
  const record = await env.DB.prepare("SELECT * FROM ai_oauth_states WHERE state_hash=? AND consumed_at IS NULL LIMIT 1").bind(await sha256(state)).first<Row>();
  if (!record || String(record.expires_at) <= now()) return integrationPopupResponse(request, env, { integration: "error", reason: "invalid_state" });
  const provider = String(record.provider) as OAuthProvider;
  if ((callbackProvider === "tiktok") !== (provider === "tiktok")) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "invalid_provider" });
  await env.DB.prepare("UPDATE ai_oauth_states SET consumed_at=? WHERE id=?").bind(now(), record.id).run();
  if (url.searchParams.get("error")) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "cancelled" });
  const code = String(url.searchParams.get("code") || "");
  if (!code) return integrationPopupResponse(request, env, { integration: "error", provider, reason: "missing_code" });
  try {
    let ready = true;
    if (provider === "tiktok") await completeTikTokIntegration(request, env, String(record.organization_id), code);
    else ready = await completeMetaIntegration(request, env, provider, String(record.organization_id), code);
    return integrationPopupResponse(request, env, { integration: ready ? "connected" : "action_required", provider });
  } catch (caught) {
    console.error("VAREX AI integration callback failed", provider, caught);
    return integrationPopupResponse(request, env, { integration: "error", provider, reason: caught instanceof Error ? caught.message : "connection_failed" });
  }
}

async function dataApi(request: Request, env: Env, table: string) {
  const columns = tableColumns[table]; if (!columns) return error("الجدول غير متاح", 404);
  const user = await currentUser(request, env); if (!user) return error("يلزم تسجيل الدخول", 401);
  const url = new URL(request.url), method = request.method.toUpperCase();
  const subscriptionSetupTables = new Set(["ai_organizations", "ai_members", "ai_subscriptions"]);
  if (table === "ai_integrations" && method !== "GET") return error("تعديل ربط الحسابات متاح فقط عبر بوابة الربط الآمنة", 405);
  if (table === "ai_knowledge_items" && method !== "GET") return error("إضافة الملفات متاحة فقط عبر مسار الرفع الآمن", 405);
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
    if (table === "ai_integrations") where.push("provider IN ('whatsapp','facebook','instagram','tiktok')");
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
      if (!orgId || (!ownsNewWorkspace && !await authorizeOrg(env, user, orgId, subscriptionRequest, subscriptionRequest))) return error("ليست لديك صلاحية على مساحة العمل", 403);
      if (table === "ai_members") {
        if (!ownsNewWorkspace) return error("إضافة أعضاء الفريق تحتاج مسار دعوة إدارياً آمناً", 403);
        body.user_id = user.id; body.role = "owner";
      }
      if (subscriptionRequest) {
        if (isDeveloperAccount(user)) return error("حساب المطوّر لا يحتاج اشتراكاً مدفوعاً", 409);
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
    if (table === "ai_subscriptions") return error("يُفعّل الاشتراك من حساب المطوّر بعد تأكيد استلام الدفع", 403);
    if (!await authorizeOrg(env, user, orgId, table === "ai_organizations" || table === "ai_subscriptions" || table === "ai_members")) return error("ليست لديك صلاحية تعديل السجل", 403);
    const body = await request.json<Row>().catch(() => ({})); const mutable = columns.filter(column => !["owner_id","organization_id","user_id","created_by"].includes(column) && body[column] !== undefined);
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
    if (["/app.js", "/i18n.js", "/command-engine.js"].includes(url.pathname) || /^\/locales\/[a-z]{2}\.json$/.test(url.pathname)) return noStoreAsset(request, env, url.pathname);
    if (url.pathname === "/favicon.ico") return noStoreAsset(request, env, "/favicon.svg");
    if (["/privacy", "/privacy.html"].includes(url.pathname)) return noStoreAsset(request, env, "/privacy.html");
    if (["/terms", "/terms.html"].includes(url.pathname)) return noStoreAsset(request, env, "/terms.html");
    if (["/data-deletion", "/data-deletion.html"].includes(url.pathname)) return noStoreAsset(request, env, "/data-deletion.html");
    if (url.pathname.startsWith("/api/auth/")) return auth(request, env, url.pathname.slice(10));
    if (url.pathname === "/api/admin/meta-status") return metaAdmin(request, env, "status");
    if (url.pathname === "/api/admin/meta-secret") return metaAdmin(request, env, "secret");
    if (url.pathname === "/api/admin/subscriptions") return subscriptionAdmin(request, env);
    if (url.pathname === "/api/admin/whatsapp-sync-existing" && request.method === "POST") return syncExistingWhatsAppAccount(request, env);
    if (url.pathname === "/api/integrations/readiness" && request.method === "GET") return integrationReadiness(request, env);
    if (url.pathname === "/api/integrations/start" && request.method === "GET") return beginIntegration(request, env);
    if (url.pathname === "/api/integrations/complete/meta-sdk" && request.method === "POST") return completeWhatsAppEmbeddedSignup(request, env);
    if (url.pathname === "/api/integrations/callback/meta" && request.method === "GET") return integrationCallback(request, env, "meta");
    if (url.pathname === "/api/integrations/callback/tiktok" && request.method === "GET") return integrationCallback(request, env, "tiktok");
    if (url.pathname === "/api/webhooks/meta/whatsapp") return whatsappWebhook(request, env);
    if (url.pathname === "/api/integrations/whatsapp/send" && request.method === "POST") return sendWhatsAppMessage(request, env);
    if (url.pathname === "/api/knowledge/upload" && request.method === "POST") return uploadKnowledgeFile(request, env);
    const knowledgeDownload = url.pathname.match(/^\/api\/knowledge\/([^/]+)\/download$/);
    if (knowledgeDownload && request.method === "GET") return downloadKnowledgeFile(request, env, decodeURIComponent(knowledgeDownload[1]));
    if (url.pathname.startsWith("/api/data/")) return dataApi(request, env, url.pathname.slice(10));
    if (url.pathname === "/_vinext/image") return handleImageOptimization(request, { fetchAsset: path => env.ASSETS.fetch(new Request(new URL(path, request.url))), transformImage: async (body, { width, format, quality }) => (await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality })).response() }, [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES]);
    return handler.fetch(request, env, ctx);
  } catch (caught) { console.error("VAREX AI request failed", caught); return error("حدث خطأ تقني مؤقت. حاول مرة أخرى.", 500); }
} };
export default worker;
