import { env } from "cloudflare:workers";

const SUPABASE_URL = "https://eibadfdqzpeigccfdipt.supabase.co";
const SUPABASE_KEY = "sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336";
const SESSION_COOKIE = "__Host-varex_shipping_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ShippingRuntimeEnv = {
  DB: D1Database;
};

export type ShippingSession = {
  tokenHash: string;
  userId: string;
  businessId: string;
  email: string;
  businessName: string;
  role: string;
};

type PendingAuthRow = {
  email: string;
  purpose: "signup" | "reset";
  businessName: string | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  sentAt: number;
  expiresAt: number;
};

function runtime() {
  return env as unknown as ShippingRuntimeEnv;
}

export function database() {
  const db = runtime().DB;
  if (!db) throw new Error("قاعدة بيانات الشحن غير متاحة حاليًا.");
  return db;
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function validEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export function validPassword(password: string) {
  return password.length >= 8;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    result[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return result;
}

function randomHex(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = (await hashPassword(password, salt)).hash;
  if (actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

export function sessionCookie(token: string, maxAge = SESSION_AGE_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(userId: string, businessId: string) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await database()
    .prepare("INSERT INTO shipping_sessions (token_hash, user_id, business_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(tokenHash, userId, businessId, now + SESSION_AGE_SECONDS * 1000, now)
    .run();
  return token;
}

export async function readShippingSession(request: Request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await database().prepare(
    `SELECT s.token_hash AS tokenHash,
            s.user_id AS userId,
            s.business_id AS businessId,
            u.email AS email,
            u.role AS role,
            b.name AS businessName
       FROM shipping_sessions s
       JOIN shipping_users u ON u.id = s.user_id AND u.business_id = s.business_id
       JOIN shipping_businesses b ON b.id = s.business_id
      WHERE s.token_hash = ? AND s.expires_at > ?
      LIMIT 1`,
  ).bind(tokenHash, now).first<ShippingSession>();
  if (!row) {
    await database().prepare("DELETE FROM shipping_sessions WHERE token_hash = ?").bind(tokenHash).run().catch(() => undefined);
    return null;
  }
  return row;
}

export function sessionPayload(session: ShippingSession) {
  return {
    business_id: session.businessId,
    user: {
      id: session.userId,
      email: session.email,
      user_metadata: {
        name: session.businessName,
        full_name: session.businessName,
        business_name: session.businessName,
        business_type: "shipping",
        varex_system: "shipping",
        varex_theme: "coffee",
      },
    },
  };
}

export async function sendShippingOtp(email: string, purpose: "verify" | "reset") {
  const metadata = {
    varex_otp_relay: true,
    varex_system: "shipping",
    varex_theme: "coffee",
    varex_purpose: purpose,
    varex_system_name: "VAREX Shipping",
    varex_card_title: "VAREX BUSINESS MANAGEMENT SYSTEM",
    varex_color: "#8A5A44",
    varex_soft_color: "#F1E9E5",
    varex_text_color: "#FFFFFF",
    varex_logo_color: "#8A5A44",
  };
  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      "x-client-info": "varex-shipping-otp-relay/1.0",
    },
    body: JSON.stringify({ email, create_user: true, data: metadata }),
  });
  if (!response.ok) {
    let detail = "تعذّر إرسال رمز التحقق.";
    try {
      const payload = await response.json() as Record<string, unknown>;
      detail = String(payload.msg || payload.message || payload.error_description || payload.error || detail);
    } catch {}
    throw new Error(detail);
  }
}

export async function verifyShippingOtp(email: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      "x-client-info": "varex-shipping-otp-relay/1.0",
    },
    body: JSON.stringify({ email, token, type: "email" }),
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {}
  if (!response.ok) {
    throw new Error(String(payload.msg || payload.message || payload.error_description || payload.error || "رمز التحقق غير صحيح أو انتهت صلاحيته."));
  }
  const accessToken = String(payload.access_token || "");
  if (accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }
}

export async function pendingAuth(email: string, purpose: "signup" | "reset") {
  return database().prepare(
    `SELECT email,
            purpose,
            business_name AS businessName,
            password_hash AS passwordHash,
            password_salt AS passwordSalt,
            sent_at AS sentAt,
            expires_at AS expiresAt
       FROM shipping_pending_auth
      WHERE email = ? AND purpose = ?
      LIMIT 1`,
  ).bind(email, purpose).first<PendingAuthRow>();
}

export async function savePendingSignup(email: string, businessName: string, password: string) {
  const credentials = await hashPassword(password);
  const now = Date.now();
  await database().prepare(
    `INSERT INTO shipping_pending_auth
       (email, purpose, business_name, password_hash, password_salt, sent_at, expires_at, attempts)
     VALUES (?, 'signup', ?, ?, ?, ?, ?, 0)
     ON CONFLICT(email, purpose) DO UPDATE SET
       business_name = excluded.business_name,
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       sent_at = excluded.sent_at,
       expires_at = excluded.expires_at,
       attempts = 0`,
  ).bind(email, businessName, credentials.hash, credentials.salt, now, now + 60 * 60 * 1000).run();
}

export async function savePendingReset(email: string) {
  const now = Date.now();
  await database().prepare(
    `INSERT INTO shipping_pending_auth
       (email, purpose, business_name, password_hash, password_salt, sent_at, expires_at, attempts)
     VALUES (?, 'reset', NULL, NULL, NULL, ?, ?, 0)
     ON CONFLICT(email, purpose) DO UPDATE SET
       sent_at = excluded.sent_at,
       expires_at = excluded.expires_at,
       attempts = 0`,
  ).bind(email, now, now + 60 * 60 * 1000).run();
}

export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid") && (lower.includes("otp") || lower.includes("token"))) return "رمز التحقق غير صحيح.";
  if (lower.includes("expired")) return "انتهت صلاحية رمز التحقق. يجب طلب رمز جديد.";
  if (lower.includes("rate") || lower.includes("security purposes")) return "تمت محاولات كثيرة. يجب الانتظار قليلًا قبل إعادة المحاولة.";
  if (lower.includes("network") || lower.includes("fetch")) return "تعذّر الاتصال بالخادم. يجب التحقق من اتصال الإنترنت.";
  return message || "تعذّر إكمال العملية.";
}
