import { hashPassword } from "better-auth/crypto";
import type { CashierAuthEnv } from "@/lib/auth";
import { canRegisterTradingEmail, isTradingDeveloperEmail, normalizeTradingEmail, provisionVerifiedTradingUser } from "@/lib/trading-access";
import { VAREX_SUPABASE_URL, varexSupabaseHeaders } from "@/lib/varex-supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Purpose = "verify" | "reset";
const TRADING_THEME = {
  system: "trading",
  name: "trading_navy_gold",
  color: "#07111f",
  softColor: "#fff4cc",
  cardTitle: "VAREX AI Trading",
} as const;

class ExistingEmailError extends Error {
  constructor() {
    super("هذا البريد مرتبط بحساب موجود. سجّل الدخول أو استخدم استعادة كلمة المرور.");
    this.name = "ExistingEmailError";
  }
}

async function runtime() { const cloudflare = await import("cloudflare:workers"); return cloudflare.env as unknown as CashierAuthEnv; }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
async function bodyOf(request: Request) { try { return await request.json() as Record<string, unknown>; } catch { return {}; } }
function strongPassword(value: unknown) {
  const password = String(value ?? "");
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
async function localUser(email: string) {
  return (await runtime()).DB.prepare('SELECT id, name, email, email_verified AS emailVerified FROM "user" WHERE lower(email) = ? LIMIT 1')
    .bind(email).first<{ id: string; name: string; email: string; emailVerified: number }>();
}
async function localTradingAccess(userId: string, email: string) {
  if (isTradingDeveloperEmail(email)) return true;
  const profile = await (await runtime()).DB.prepare("SELECT status FROM trading_profile WHERE user_id = ? LIMIT 1")
    .bind(userId).first<{ status: string }>();
  if (profile) return profile.status === "active";
  return canRegisterTradingEmail(email);
}
async function hmacHex(message: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function syncThemeMetadata(email: string) {
  const secret = (await runtime()).VAREX_THEME_SYNC_SECRET;
  if (!secret || secret.length < 32) throw new Error("خدمة رسائل التحقق غير جاهزة.");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacHex(`${email}:${TRADING_THEME.system}:${TRADING_THEME.name}:${timestamp}`, secret);
  const response = await fetch(`${VAREX_SUPABASE_URL}/rest/v1/rpc/varex_sync_email_theme`, {
    method: "POST",
    headers: varexSupabaseHeaders({ "x-client-info": "varex-trading-theme-sync/1.0" }),
    body: JSON.stringify({ p_email: email, p_system: TRADING_THEME.system, p_theme: TRADING_THEME.name, p_timestamp: timestamp, p_signature: signature }),
  });
  if (!response.ok) throw new Error("تعذر تجهيز رسالة التحقق لحساب التداول.");
  const payload = await response.json().catch(() => ({})) as { updated?: boolean };
  if (payload.updated !== true) throw new Error("تعذر ربط رسالة التحقق بحساب التداول.");
}
function emailMetadata(email: string, name = "") {
  return {
    name: String(name || "").trim() || email.split("@")[0],
    username: email.split("@")[0],
    varex_otp_relay: true,
    varex_system: TRADING_THEME.system,
    varex_theme: TRADING_THEME.name,
    varex_system_name: "VAREX AI Trading",
    varex_card_title: TRADING_THEME.cardTitle,
    varex_color: TRADING_THEME.color,
    varex_soft_color: TRADING_THEME.softColor,
    varex_text_color: "#FFFFFF",
    varex_logo_color: "#f5b82e",
  };
}
async function relayError(response: Response, fallback: string) {
  let detail = fallback;
  try { const payload = await response.json() as Record<string, unknown>; detail = String(payload.msg || payload.message || payload.error_description || payload.error || detail); } catch {}
  return new Error(detail);
}
async function relaySignup(email: string, password: string, name: string) {
  const response = await fetch(`${VAREX_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: varexSupabaseHeaders({ "x-client-info": "varex-trading-signup/1.0" }),
    body: JSON.stringify({ email, password, data: emailMetadata(email, name) }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { user?: { identities?: unknown[] } };
  if (!response.ok) {
    const code = String(payload.code || payload.error_code || "");
    const detail = String(payload.msg || payload.message || payload.error_description || payload.error || "تعذر إرسال رمز تأكيد الحساب.");
    if (code === "user_already_exists" || /already|registered|exists|موجود|مسجل/i.test(detail)) throw new ExistingEmailError();
    throw new Error(detail);
  }
  if (Array.isArray(payload.user?.identities) && payload.user.identities.length === 0) throw new ExistingEmailError();
}
async function relayRequest(email: string, purpose: Purpose) {
  await syncThemeMetadata(email);
  const response = await fetch(`${VAREX_SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: varexSupabaseHeaders({ "x-client-info": "varex-trading-otp/1.0" }),
    body: JSON.stringify({ email, create_user: false, data: { ...emailMetadata(email), varex_purpose: purpose } }),
  });
  if (!response.ok) throw await relayError(response, "تعذر إرسال رمز التحقق.");
}
async function relayVerify(email: string, otp: string, purpose: Purpose) {
  const types = purpose === "verify" ? ["signup", "email"] : ["email"];
  let lastError = "رمز التحقق غير صحيح أو انتهت صلاحيته.";
  for (const type of types) {
    const response = await fetch(`${VAREX_SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: varexSupabaseHeaders({ "x-client-info": "varex-trading-otp-verify/1.0" }),
      body: JSON.stringify({ email, token: otp, type }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.ok) return payload;
    lastError = String(payload.msg || payload.message || payload.error_description || payload.error || lastError);
  }
  throw new Error(lastError);
}
async function relayPasswordSession(email: string, password: string) {
  const response = await fetch(`${VAREX_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: varexSupabaseHeaders({ "x-client-info": "varex-trading-password-session/1.0" }),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await relayError(response, "تعذر استرداد جلسة الحساب المؤكد.");
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}
async function syncRemotePassword(accessToken: string, password: string) {
  const response = await fetch(`${VAREX_SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: varexSupabaseHeaders({ authorization: `Bearer ${accessToken}`, "x-client-info": "varex-trading-password-sync/1.0" }),
    body: JSON.stringify({ password }),
  });
  if (response.ok) return;
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(payload.code || payload.error_code || ""), message = String(payload.msg || payload.message || payload.error_description || payload.error || "تعذر مزامنة كلمة المرور.");
  if (code === "same_password" || /new password should be different/i.test(message)) return;
  throw new Error(message);
}
async function closeRelaySession(payload: Record<string, unknown>) {
  const token = String(payload.access_token || "");
  if (!token) return;
  try { await fetch(`${VAREX_SUPABASE_URL}/auth/v1/logout?scope=local`, { method: "POST", headers: varexSupabaseHeaders({ authorization: `Bearer ${token}` }) }); } catch {}
}
async function guard(email: string, purpose: Purpose) {
  return (await runtime()).DB.prepare("SELECT last_sent_at AS lastSentAt, attempts, expires_at AS expiresAt FROM otp_guard WHERE email = ? AND purpose = ?")
    .bind(email, purpose).first<{ lastSentAt: number; attempts: number; expiresAt: number }>();
}
async function verifyGuard(email: string, purpose: Purpose) {
  const current = await guard(email, purpose), now = Date.now();
  if (!current || current.expiresAt < now) return json({ error: "انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً." }, 400);
  if (current.attempts >= 5) return json({ error: "تم تجاوز عدد المحاولات. اطلب رمزاً جديداً." }, 429);
  await (await runtime()).DB.prepare("UPDATE otp_guard SET attempts = attempts + 1 WHERE email = ? AND purpose = ?").bind(email, purpose).run();
  return null;
}

export async function sendTradingOtp(request: Request) {
  const body = await bodyOf(request), email = normalizeTradingEmail(body.email), purpose: Purpose = body.purpose === "reset" ? "reset" : "verify";
  if (!EMAIL_PATTERN.test(email)) return json({ error: "يرجى إدخال بريد إلكتروني صحيح." }, 400);
  const user = await localUser(email);
  if (!user) return purpose === "reset" ? json({ sent: true }) : json({ error: "أنشئ الحساب أولاً ثم اطلب رمز التحقق." }, 404);
  if (!await localTradingAccess(user.id, email)) return purpose === "reset" ? json({ sent: true }) : json({ error: "هذا الحساب موقوف من إدارة النظام." }, 403);
  if (purpose === "verify" && Boolean(user.emailVerified)) return json({ error: "هذا البريد مؤكد مسبقاً. استخدم تسجيل الدخول." }, 409);
  const now = Date.now(), current = await guard(email, purpose);
  if (current && now - current.lastSentAt < 60_000) return json({ error: "انتظر دقيقة واحدة قبل طلب رمز جديد.", retryAfter: Math.ceil((60_000 - (now - current.lastSentAt)) / 1000) }, 429);
  try {
    if (purpose === "verify") {
      const password = String(body.password ?? "");
      if (password) {
        if (!strongPassword(password)) return json({ error: "استخدم 8 أحرف على الأقل، وحرفاً كبيراً وصغيراً، ورقماً، ورمزاً خاصاً." }, 400);
        try { await relaySignup(email, password, user.name); } catch (error) { if (error instanceof ExistingEmailError) await relayRequest(email, purpose); else throw error; }
      } else await relayRequest(email, purpose);
    } else await relayRequest(email, purpose);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "تعذر إرسال رمز التحقق." }, 502); }
  await (await runtime()).DB.prepare(`INSERT INTO otp_guard (email, purpose, last_sent_at, attempts, expires_at) VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email, purpose) DO UPDATE SET last_sent_at = excluded.last_sent_at, attempts = 0, expires_at = excluded.expires_at`)
    .bind(email, purpose, now, now + 60 * 60 * 1000).run();
  return json({ sent: true });
}

export async function verifyTradingEmail(request: Request) {
  const body = await bodyOf(request), email = normalizeTradingEmail(body.email), otp = String(body.otp ?? "").replace(/\D/g, ""), password = String(body.password ?? "");
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) return json({ error: "أدخل البريد ورمز OTP المكوّن من 6 أرقام." }, 400);
  const user = await localUser(email);
  if (!user) return json({ error: "الحساب غير موجود." }, 404);
  if (!await localTradingAccess(user.id, email)) return json({ error: "هذا الحساب موقوف من إدارة النظام." }, 403);
  const guardError = await verifyGuard(email, "verify"); if (guardError) return guardError;
  let relay: Record<string, unknown>;
  try { relay = await relayVerify(email, otp, "verify"); }
  catch (verifyError) {
    if (!password || !strongPassword(password)) return json({ error: verifyError instanceof Error ? verifyError.message : "رمز التحقق غير صحيح." }, 400);
    try { relay = await relayPasswordSession(email, password); } catch { return json({ error: verifyError instanceof Error ? verifyError.message : "رمز التحقق غير صحيح." }, 400); }
  }
  const relayToken = String(relay.access_token || "");
  if (relayToken && password && strongPassword(password)) await syncRemotePassword(relayToken, password);
  const displayName = String(body.displayName ?? user.name).trim().slice(0, 80) || "مستخدم VAREX", now = Date.now(), database = (await runtime()).DB;
  const updates = [
    database.prepare('UPDATE "user" SET name = ?, email_verified = 1, updated_at = ? WHERE id = ?').bind(displayName, now, user.id),
    database.prepare("DELETE FROM otp_guard WHERE email = ? AND purpose = 'verify'").bind(email),
  ];
  if (password && strongPassword(password)) {
    const passwordHash = await hashPassword(password);
    updates.push(database.prepare("UPDATE account SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential' AND issuer = 'local:credential'").bind(passwordHash, now, user.id));
  }
  await database.batch(updates);
  const profile = await provisionVerifiedTradingUser({ id: user.id, name: displayName, email, emailVerified: true }, displayName);
  await closeRelaySession(relay);
  return json({ verified: true, profile });
}

export async function resetTradingPassword(request: Request) {
  const body = await bodyOf(request), email = normalizeTradingEmail(body.email), otp = String(body.otp ?? "").replace(/\D/g, ""), password = String(body.password ?? "");
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) return json({ error: "أدخل البريد ورمز OTP المكوّن من 6 أرقام." }, 400);
  if (!strongPassword(password)) return json({ error: "استخدم 8 أحرف على الأقل، وحرفاً كبيراً وصغيراً، ورقماً، ورمزاً خاصاً." }, 400);
  const user = await localUser(email);
  if (!user || !await localTradingAccess(user.id, email)) return json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته." }, 400);
  const guardError = await verifyGuard(email, "reset"); if (guardError) return guardError;
  let relay: Record<string, unknown>;
  try { relay = await relayVerify(email, otp, "reset"); } catch (error) { return json({ error: error instanceof Error ? error.message : "رمز التحقق غير صحيح." }, 400); }
  const relayToken = String(relay.access_token || "");
  if (relayToken) await syncRemotePassword(relayToken, password);
  const passwordHash = await hashPassword(password), now = Date.now(), database = (await runtime()).DB;
  const updated = await database.prepare("UPDATE account SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential' AND issuer = 'local:credential'")
    .bind(passwordHash, now, user.id).run();
  if (!updated.meta.changes) return json({ error: "تعذر تحديث كلمة المرور لهذا الحساب." }, 409);
  await database.batch([
    database.prepare('UPDATE "user" SET email_verified = 1, updated_at = ? WHERE id = ?').bind(now, user.id),
    database.prepare("DELETE FROM session WHERE user_id = ?").bind(user.id),
    database.prepare("DELETE FROM otp_guard WHERE email = ? AND purpose = 'reset'").bind(email),
  ]);
  await closeRelaySession(relay);
  return json({ reset: true });
}
