import { hashPassword } from "better-auth/crypto";
import type { CafeAuthEnv } from "@/lib/auth";

const SUPABASE_URL = "https://eibadfdqzpeigccfdipt.supabase.co";
const SUPABASE_KEY = "sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Purpose = "verify" | "reset";
const THEME_COLORS: Record<string, string> = { orange:"#C75A1B",coffee:"#8A4B2A",olive:"#6F7A3D",teal:"#2F6F68",plum:"#76506F",navy:"#243B67",royal:"#2F5FA7",berry:"#9A3E68",maroon:"#7A2639",graphite:"#4B5057",emerald:"#2F7A56",forest:"#3F6842",mint:"#4F8D78",cyan:"#287C91",sky:"#4B86B4",indigo:"#4B4F9A",violet:"#6C4AA1",lavender:"#8A6CAD",magenta:"#A43D82",rose:"#B44F65",coral:"#C65F4A",brick:"#A44832",red:"#B43B32",gold:"#B88422",mustard:"#A87A18",sand:"#A66E45",caramel:"#B86B31",steel:"#567488",slate:"#5E6878",charcoal:"#343A40" };

async function runtime() { const cloudflare = await import("cloudflare:workers"); return cloudflare.env as unknown as CafeAuthEnv; }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
async function bodyOf(request: Request) { try { return await request.json() as Record<string, unknown>; } catch { return {}; } }
function normalizeEmail(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
function strongPassword(value: unknown) {
  const password = String(value ?? "");
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
async function localUser(email: string) {
  return (await runtime()).DB.prepare('SELECT id, name, email, email_verified AS emailVerified FROM "user" WHERE lower(email) = ? LIMIT 1')
    .bind(email).first<{ id: string; name: string; email: string; emailVerified: number }>();
}
type ThemeInfo={name:string;color:string;softColor:string};
async function currentTheme():Promise<ThemeInfo> {
  const row = await (await runtime()).DB.prepare("SELECT theme FROM cafe_settings WHERE id = 'main' LIMIT 1").first<{ theme: string }>();
  const name=THEME_COLORS[row?.theme || ""]?row!.theme:"orange",color=THEME_COLORS[name];
  return{name,color,softColor:mixWithWhite(color)};
}
function mixWithWhite(hex: string, ratio = .88) {
  const source = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => Number.parseInt(source.slice(index, index + 2), 16));
  return `#${channels.map((value) => Math.round(value + (255 - value) * ratio).toString(16).padStart(2, "0")).join("")}`;
}
async function hmacHex(message:string,secret:string){
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,encoder.encode(message));
  return Array.from(new Uint8Array(signature),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function syncThemeMetadata(email:string,theme:ThemeInfo){
  const secret=(await runtime()).VAREX_THEME_SYNC_SECRET;
  if(!secret||secret.length<32)throw new Error("خدمة ربط لون رسائل التحقق غير جاهزة.");
  const timestamp=Math.floor(Date.now()/1000),signature=await hmacHex(`${email}:cafe:${theme.name}:${timestamp}`,secret);
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/varex_sync_email_theme`,{
    method:"POST",headers:{apikey:SUPABASE_KEY,authorization:`Bearer ${SUPABASE_KEY}`,"content-type":"application/json","x-client-info":"varex-theme-sync/1.0"},
    body:JSON.stringify({p_email:email,p_system:"cafe",p_theme:theme.name,p_timestamp:timestamp,p_signature:signature}),
  });
  if(!response.ok)throw new Error("تعذر ربط لون رسالة التحقق بالمظهر الحالي.");
}
async function relayRequest(email: string, purpose: Purpose, theme:ThemeInfo) {
  await syncThemeMetadata(email,theme);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json", "x-client-info": "varex-cafe-otp-relay/1.0" },
    body: JSON.stringify({ email, create_user: true, data: {
      varex_otp_relay: true,
      varex_system: "cafe",
      varex_theme: theme.name,
      varex_purpose: purpose,
      varex_system_name: "VAREX Café",
      varex_card_title: "VAREX BUSINESS MANAGEMENT SYSTEM",
      varex_color: theme.color,
      varex_soft_color: theme.softColor,
      varex_text_color: "#FFFFFF",
      varex_logo_color: theme.color,
    } }),
  });
  if (!response.ok) {
    let detail = "تعذر إرسال رمز التحقق.";
    try { const payload = await response.json() as Record<string, unknown>; detail = String(payload.msg || payload.message || payload.error_description || payload.error || detail); } catch {}
    throw new Error(detail);
  }
}
async function relayVerify(email: string, otp: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json", "x-client-info": "varex-cafe-otp-relay/1.0" },
    body: JSON.stringify({ email, token: otp, type: "email" }),
  });
  let payload: Record<string, unknown> = {};
  try { payload = await response.json() as Record<string, unknown>; } catch {}
  if (!response.ok) throw new Error(String(payload.msg || payload.message || payload.error_description || payload.error || "رمز التحقق غير صحيح أو انتهت صلاحيته."));
  return payload;
}
async function closeRelaySession(payload: Record<string, unknown>) {
  const token = String(payload.access_token || "");
  if (!token) return;
  try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` } }); } catch {}
}
async function guard(email: string, purpose: Purpose) {
  return (await runtime()).DB.prepare("SELECT last_sent_at AS lastSentAt, attempts, expires_at AS expiresAt FROM otp_guard WHERE email = ? AND purpose = ?")
    .bind(email, purpose).first<{ lastSentAt: number; attempts: number; expiresAt: number }>();
}
export async function sendOtp(request: Request) {
  const body = await bodyOf(request), email = normalizeEmail(body.email), purpose: Purpose = body.purpose === "reset" ? "reset" : "verify";
  if (!EMAIL_PATTERN.test(email)) return json({ error: "يرجى إدخال بريد إلكتروني صحيح." }, 400);
  const user = await localUser(email);
  if (!user) return purpose === "reset" ? json({ sent: true }) : json({ error: "لا يوجد حساب مقاهي مرتبط بهذا البريد." }, 404);
  const now = Date.now(), current = await guard(email, purpose);
  if (current && now - current.lastSentAt < 60_000) return json({ error: "انتظر دقيقة واحدة قبل طلب رمز جديد.", retryAfter: Math.ceil((60_000 - (now - current.lastSentAt)) / 1000) }, 429);
  try { await relayRequest(email, purpose, await currentTheme()); } catch (error) { return json({ error: error instanceof Error ? error.message : "تعذر إرسال رمز التحقق." }, 502); }
  await (await runtime()).DB.prepare(`INSERT INTO otp_guard (email, purpose, last_sent_at, attempts, expires_at) VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email, purpose) DO UPDATE SET last_sent_at = excluded.last_sent_at, attempts = 0, expires_at = excluded.expires_at`)
    .bind(email, purpose, now, now + 60 * 60 * 1000).run();
  return json({ sent: true });
}
async function verifyGuard(email: string, purpose: Purpose) {
  const current = await guard(email, purpose), now = Date.now();
  if (!current || current.expiresAt < now) return json({ error: "انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً." }, 400);
  if (current.attempts >= 5) return json({ error: "تم تجاوز عدد المحاولات. يرجى طلب رمز جديد." }, 429);
  await (await runtime()).DB.prepare("UPDATE otp_guard SET attempts = attempts + 1 WHERE email = ? AND purpose = ?").bind(email, purpose).run();
  return null;
}
export async function verifyEmailOtp(request: Request) {
  const body = await bodyOf(request), email = normalizeEmail(body.email), otp = String(body.otp ?? "").replace(/\D/g, "");
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) return json({ error: "أدخل البريد ورمز OTP المكوّن من 6 أرقام." }, 400);
  const user = await localUser(email); if (!user) return json({ error: "لا يوجد حساب مقاهي مرتبط بهذا البريد." }, 404);
  const guardError = await verifyGuard(email, "verify"); if (guardError) return guardError;
  let relay: Record<string, unknown>; try { relay = await relayVerify(email, otp); } catch (error) { return json({ error: error instanceof Error ? error.message : "رمز التحقق غير صحيح." }, 400); }
  const now = Date.now();
  const database = (await runtime()).DB;
  await database.batch([
    database.prepare('UPDATE "user" SET email_verified = 1, updated_at = ? WHERE id = ?').bind(now, user.id),
    database.prepare("DELETE FROM otp_guard WHERE email = ? AND purpose = 'verify'").bind(email),
    database.prepare(`INSERT INTO cafe_settings (id, name, branch, currency, language, trn, phone, theme, printing, alerts, routing, receipts, users_json, updated_at)
      VALUES ('main', ?, 'دبي', 'درهم إماراتي', 'العربية', '', '', 'orange', 1, 1, 1, 0, '[]', ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`).bind(user.name, now),
  ]);
  await closeRelaySession(relay);
  return json({ verified: true, user: { id: user.id, name: user.name, email: user.email, role: "مالك" } });
}
export async function resetPasswordWithOtp(request: Request) {
  const body = await bodyOf(request), email = normalizeEmail(body.email), otp = String(body.otp ?? "").replace(/\D/g, ""), password = String(body.password ?? "");
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) return json({ error: "أدخل البريد ورمز OTP المكوّن من 6 أرقام." }, 400);
  if (!strongPassword(password)) return json({ error: "كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير وصغير، ورقم، ورمز خاص." }, 400);
  const user = await localUser(email); if (!user) return json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته." }, 400);
  const guardError = await verifyGuard(email, "reset"); if (guardError) return guardError;
  let relay: Record<string, unknown>; try { relay = await relayVerify(email, otp); } catch (error) { return json({ error: error instanceof Error ? error.message : "رمز التحقق غير صحيح." }, 400); }
  const passwordHash = await hashPassword(password), now = Date.now();
  const database = (await runtime()).DB;
  const updated = await database.prepare("UPDATE account SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential' AND issuer = 'local:credential'")
    .bind(passwordHash, now, user.id).run();
  if (!updated.meta.changes) return json({ error: "تعذر تحديث كلمة المرور لهذا الحساب." }, 409);
  await database.batch([
    database.prepare("DELETE FROM session WHERE user_id = ?").bind(user.id),
    database.prepare("DELETE FROM otp_guard WHERE email = ? AND purpose = 'reset'").bind(email),
  ]);
  await closeRelaySession(relay);
  return json({ reset: true });
}
