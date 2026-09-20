interface CallEnv {
  DB: D1Database;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
}

type CallRole = "host" | "guest";
type CallType = "voice" | "video";
type OtpChannel = "sms" | "whatsapp" | "call";
type SignalKind = "ready" | "offer" | "answer" | "ice" | "hangup";

type AccountRow = {
  id: string;
  phone: string;
  display_name: string;
  avatar_color: string;
  discoverable: number;
  created_at: number;
  last_seen_at: number;
};

type AuthContext = { tokenHash: string; account: AccountRow };

type RoomRow = {
  id: string;
  call_type: CallType;
  status: "waiting" | "active" | "ended";
  host_token_hash: string;
  guest_token_hash: string | null;
  host_name: string;
  guest_name: string | null;
  caller_account_id: string | null;
  callee_account_id: string | null;
  answered_at: number | null;
  ended_reason: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
};

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ROOM_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SIGNAL_LIFETIME_MS = 12 * 60 * 60 * 1000;
const RING_TIMEOUT_MS = 60 * 1000;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, max-age=0" };
const AVATAR_COLORS = ["#3157d5", "#00897b", "#7b4cc2", "#d06038", "#2376a8", "#b64271"];

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers: { ...JSON_HEADERS, ...headers } });
}

async function readJson(request: Request, max = 120_000): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length") || "0") > max) return null;
  try {
    const text = await request.text();
    if (!text || text.length > max) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim().replace(/[\s().-]/g, "");
  const normalized = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
}

function normalizeName(value: unknown, fallback = "مستخدم VAREX"): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 48) || fallback;
}

function normalizeMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 4000);
}

function randomToken(bytesLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function sessionCookie(token: string, maxAge: number): string {
  return `varex_call_session=${token ? encodeURIComponent(token) : ""}; Path=/call; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function requestAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function rateLimit(env: CallEnv, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO varex_call_rate_limit (key, count, window_started_at, expires_at)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_started_at < ? THEN 1 ELSE count + 1 END,
       window_started_at = CASE WHEN window_started_at < ? THEN ? ELSE window_started_at END,
       expires_at = CASE WHEN window_started_at < ? THEN ? ELSE expires_at END`,
  ).bind(key, now, now + windowMs, now - windowMs, now - windowMs, now, now - windowMs, now + windowMs).run();
  const row = await env.DB.prepare("SELECT count FROM varex_call_rate_limit WHERE key = ?").bind(key).first<{ count: number }>();
  return (row?.count || 0) <= limit;
}

async function cleanup(env: CallEnv): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM varex_call_signal WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM varex_call_room WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM varex_call_rate_limit WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM varex_call_session WHERE expires_at < ?").bind(now),
  ]);
}

function publicAccount(account: AccountRow) {
  return {
    id: account.id,
    phone: account.phone,
    displayName: account.display_name,
    avatarColor: account.avatar_color,
    discoverable: Boolean(account.discoverable),
    createdAt: account.created_at,
    lastSeenAt: account.last_seen_at,
  };
}

async function authenticate(request: Request, env: CallEnv): Promise<AuthContext | Response> {
  const token = cookieValue(request, "varex_call_session");
  if (!token || token.length < 32) return json({ ok: false, error: "unauthorized" }, 401);
  const tokenHash = await sha256(token);
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT a.id, a.phone, a.display_name, a.avatar_color, a.discoverable, a.created_at, a.last_seen_at,
            s.last_seen_at AS session_last_seen_at
     FROM varex_call_session s JOIN varex_call_account a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`,
  ).bind(tokenHash, now).first<AccountRow & { session_last_seen_at: number }>();
  if (!row) return json({ ok: false, error: "unauthorized" }, 401, { "set-cookie": sessionCookie("", 0) });
  if (now - Number(row.session_last_seen_at || 0) > 60_000) {
    await env.DB.batch([
      env.DB.prepare("UPDATE varex_call_session SET last_seen_at = ? WHERE token_hash = ?").bind(now, tokenHash),
      env.DB.prepare("UPDATE varex_call_account SET last_seen_at = ? WHERE id = ?").bind(now, row.id),
    ]);
  }
  row.last_seen_at = now;
  return { tokenHash, account: row };
}

function twilioConfigured(env: CallEnv): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID);
}

async function twilioVerifyRequest(env: CallEnv, resource: "Verifications" | "VerificationCheck", values: Record<string, string>): Promise<{ ok: boolean; status?: string; code?: number }> {
  if (!twilioConfigured(env)) return { ok: false, code: 503 };
  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID!)}/${resource}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      accept: "application/json",
    },
    body: new URLSearchParams(values),
  });
  let payload: { status?: string; code?: number } = {};
  try { payload = await response.json() as { status?: string; code?: number }; } catch { payload = {}; }
  return { ok: response.ok, status: payload.status, code: payload.code || response.status };
}

async function requestOtp(request: Request, env: CallEnv): Promise<Response> {
  if (!twilioConfigured(env)) return json({ ok: false, error: "otp_provider_not_configured" }, 503);
  const body = await readJson(request);
  const phone = normalizePhone(body?.phone);
  const channel = body?.channel;
  if (!phone) return json({ ok: false, error: "invalid_phone" }, 400);
  if (channel !== "sms" && channel !== "whatsapp" && channel !== "call") return json({ ok: false, error: "invalid_channel" }, 400);
  const [ipHash, phoneHash] = await Promise.all([sha256(requestAddress(request)), sha256(phone)]);
  if (!(await rateLimit(env, `otp-request-ip:${ipHash}`, 12, 60 * 60 * 1000)) || !(await rateLimit(env, `otp-request-phone:${phoneHash}`, 6, 60 * 60 * 1000))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  const result = await twilioVerifyRequest(env, "Verifications", { To: phone, Channel: channel as OtpChannel });
  if (!result.ok) {
    console.error("VAREX Call OTP request failed", { status: result.status, code: result.code });
    return json({ ok: false, error: result.code === 60200 ? "invalid_phone" : "otp_delivery_failed" }, 502);
  }
  return json({ ok: true, channel, expiresIn: 600 });
}

async function verifyOtp(request: Request, env: CallEnv): Promise<Response> {
  if (!twilioConfigured(env)) return json({ ok: false, error: "otp_provider_not_configured" }, 503);
  const body = await readJson(request);
  const phone = normalizePhone(body?.phone);
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "").slice(0, 10) : "";
  if (!phone || !/^\d{4,10}$/.test(code)) return json({ ok: false, error: "invalid_code" }, 400);
  const [ipHash, phoneHash] = await Promise.all([sha256(requestAddress(request)), sha256(phone)]);
  if (!(await rateLimit(env, `otp-check-ip:${ipHash}`, 40, 60 * 60 * 1000)) || !(await rateLimit(env, `otp-check-phone:${phoneHash}`, 15, 60 * 60 * 1000))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  const result = await twilioVerifyRequest(env, "VerificationCheck", { To: phone, Code: code });
  if (!result.ok || result.status !== "approved") return json({ ok: false, error: "invalid_code" }, 401);

  const now = Date.now();
  let account = await env.DB.prepare(
    "SELECT id, phone, display_name, avatar_color, discoverable, created_at, last_seen_at FROM varex_call_account WHERE phone_hash = ? LIMIT 1",
  ).bind(phoneHash).first<AccountRow>();
  if (!account) {
    const id = randomId("usr");
    const fallbackName = `مستخدم ${phone.slice(-4)}`;
    const color = AVATAR_COLORS[parseInt(phoneHash.slice(0, 2), 16) % AVATAR_COLORS.length];
    await env.DB.prepare(
      `INSERT INTO varex_call_account
       (id, phone, phone_hash, display_name, avatar_color, discoverable, created_at, updated_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, phone, phoneHash, fallbackName, color, now, now, now).run();
    account = { id, phone, display_name: fallbackName, avatar_color: color, discoverable: 1, created_at: now, last_seen_at: now };
  }
  const token = randomToken();
  const tokenHash = await sha256(token);
  const deviceName = normalizeName(body?.deviceName, "هاتف").slice(0, 80);
  await env.DB.prepare(
    `INSERT INTO varex_call_session (token_hash, account_id, device_name, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(tokenHash, account.id, deviceName, now, now, now + SESSION_LIFETIME_MS).run();
  return json({ ok: true, account: publicAccount(account) }, 200, { "set-cookie": sessionCookie(token, Math.floor(SESSION_LIFETIME_MS / 1000)) });
}

async function logout(request: Request, env: CallEnv): Promise<Response> {
  const token = cookieValue(request, "varex_call_session");
  if (token) await env.DB.prepare("DELETE FROM varex_call_session WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function getMe(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  return json({ ok: true, account: publicAccount(auth.account) });
}

async function updateMe(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);
  const displayName = normalizeName(body.displayName, "");
  if (!displayName || displayName.length < 2) return json({ ok: false, error: "invalid_name" }, 400);
  const discoverable = body.discoverable === false ? 0 : 1;
  const now = Date.now();
  await env.DB.prepare("UPDATE varex_call_account SET display_name = ?, discoverable = ?, updated_at = ?, last_seen_at = ? WHERE id = ?")
    .bind(displayName, discoverable, now, now, auth.account.id).run();
  auth.account.display_name = displayName;
  auth.account.discoverable = discoverable;
  auth.account.last_seen_at = now;
  return json({ ok: true, account: publicAccount(auth.account) });
}

async function contactList(env: CallEnv, ownerId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT c.id, c.phone, c.local_name, c.matched_account_id, c.updated_at,
            a.display_name AS account_name, a.avatar_color, a.last_seen_at
     FROM varex_call_contact c
     LEFT JOIN varex_call_account a ON a.id = c.matched_account_id
     WHERE c.owner_account_id = ?
     ORDER BY COALESCE(a.display_name, c.local_name) COLLATE NOCASE ASC LIMIT 500`,
  ).bind(ownerId).all<Record<string, unknown>>();
  const contacts = (result.results || []).map(row => ({
    id: row.id,
    phone: row.phone,
    localName: row.local_name,
    accountId: row.matched_account_id,
    displayName: row.account_name || row.local_name,
    avatarColor: row.avatar_color || "#5f7188",
    lastSeenAt: row.last_seen_at || null,
    available: Boolean(row.matched_account_id),
    updatedAt: row.updated_at,
  }));
  return json({ ok: true, contacts });
}

async function saveContacts(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  const rawContacts = Array.isArray(body?.contacts) ? body.contacts.slice(0, 100) : [];
  const normalized: Array<{ name: string; phone: string; hash: string }> = [];
  const seen = new Set<string>();
  for (const value of rawContacts) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const phone = normalizePhone(item.phone);
    if (!phone || phone === auth.account.phone || seen.has(phone)) continue;
    seen.add(phone);
    normalized.push({ name: normalizeName(item.name, phone), phone, hash: await sha256(phone) });
  }
  if (!normalized.length) return json({ ok: false, error: "no_valid_contacts" }, 400);
  if (!(await rateLimit(env, `contact-import:${auth.account.id}`, 500, 24 * 60 * 60 * 1000))) return json({ ok: false, error: "rate_limited" }, 429);

  const hashes = normalized.map(item => item.hash);
  const placeholders = hashes.map(() => "?").join(",");
  const matches = await env.DB.prepare(
    `SELECT id, phone_hash FROM varex_call_account WHERE discoverable = 1 AND phone_hash IN (${placeholders})`,
  ).bind(...hashes).all<{ id: string; phone_hash: string }>();
  const matchByHash = new Map((matches.results || []).map(item => [item.phone_hash, item.id]));
  const now = Date.now();
  await env.DB.batch(normalized.map(item => env.DB.prepare(
    `INSERT INTO varex_call_contact
     (id, owner_account_id, phone, phone_hash, local_name, matched_account_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_account_id, phone_hash) DO UPDATE SET
       phone = excluded.phone, local_name = excluded.local_name,
       matched_account_id = excluded.matched_account_id, updated_at = excluded.updated_at`,
  ).bind(randomId("ctc"), auth.account.id, item.phone, item.hash, item.name, matchByHash.get(item.hash) || null, now, now)));
  return contactList(env, auth.account.id);
}

async function listContacts(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  return contactList(env, auth.account.id);
}

async function authorizeConversation(env: CallEnv, conversationId: string, accountId: string): Promise<{ id: string; member_low_id: string; member_high_id: string } | null> {
  return env.DB.prepare(
    `SELECT id, member_low_id, member_high_id FROM varex_call_conversation
     WHERE id = ? AND (member_low_id = ? OR member_high_id = ?) LIMIT 1`,
  ).bind(conversationId, accountId, accountId).first<{ id: string; member_low_id: string; member_high_id: string }>();
}

async function createConversation(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  const targetId = typeof body?.accountId === "string" ? body.accountId : "";
  if (!targetId || targetId === auth.account.id) return json({ ok: false, error: "invalid_contact" }, 400);
  const target = await env.DB.prepare("SELECT id, display_name, avatar_color FROM varex_call_account WHERE id = ? LIMIT 1")
    .bind(targetId).first<{ id: string; display_name: string; avatar_color: string }>();
  if (!target) return json({ ok: false, error: "contact_not_available" }, 404);
  const [low, high] = [auth.account.id, targetId].sort();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO varex_call_conversation (id, member_low_id, member_high_id, created_at, updated_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_low_id, member_high_id) DO NOTHING`,
  ).bind(randomId("cnv"), low, high, now, now, now).run();
  const conversation = await env.DB.prepare(
    "SELECT id, created_at, last_message_at FROM varex_call_conversation WHERE member_low_id = ? AND member_high_id = ? LIMIT 1",
  ).bind(low, high).first<Record<string, unknown>>();
  return json({ ok: true, conversation: { id: conversation?.id, contact: { id: target.id, displayName: target.display_name, avatarColor: target.avatar_color } } }, 201);
}

async function listConversations(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const id = auth.account.id;
  const result = await env.DB.prepare(
    `SELECT c.id, c.created_at, c.updated_at, c.last_message_at,
            a.id AS contact_id, a.display_name, a.avatar_color, a.last_seen_at,
            (SELECT body FROM varex_call_message m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM varex_call_message m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body_at,
            (SELECT COUNT(*) FROM varex_call_message m WHERE m.conversation_id = c.id AND m.sender_account_id != ? AND m.read_at IS NULL AND m.deleted_at IS NULL) AS unread_count
     FROM varex_call_conversation c
     JOIN varex_call_account a ON a.id = CASE WHEN c.member_low_id = ? THEN c.member_high_id ELSE c.member_low_id END
     WHERE c.member_low_id = ? OR c.member_high_id = ?
     ORDER BY COALESCE(last_body_at, c.last_message_at) DESC LIMIT 200`,
  ).bind(id, id, id, id).all<Record<string, unknown>>();
  return json({ ok: true, conversations: (result.results || []).map(row => ({
    id: row.id,
    contact: { id: row.contact_id, displayName: row.display_name, avatarColor: row.avatar_color, lastSeenAt: row.last_seen_at },
    lastMessage: row.last_body || "",
    lastMessageAt: row.last_body_at || row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
  })) });
}

async function listMessages(request: Request, env: CallEnv, conversationId: string, url: URL): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  if (!(await authorizeConversation(env, conversationId, auth.account.id))) return json({ ok: false, error: "conversation_not_found" }, 404);
  const afterValue = Number(url.searchParams.get("after") || "0");
  const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0;
  const result = await env.DB.prepare(
    `SELECT id, sender_account_id, client_nonce, body, created_at, read_at
     FROM varex_call_message
     WHERE conversation_id = ? AND created_at >= ? AND deleted_at IS NULL
     ORDER BY created_at ASC, id ASC LIMIT 300`,
  ).bind(conversationId, after).all<Record<string, unknown>>();
  const now = Date.now();
  await env.DB.prepare("UPDATE varex_call_message SET read_at = ? WHERE conversation_id = ? AND sender_account_id != ? AND read_at IS NULL")
    .bind(now, conversationId, auth.account.id).run();
  return json({ ok: true, messages: (result.results || []).map(row => ({
    id: row.id,
    senderId: row.sender_account_id,
    clientNonce: row.client_nonce,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.sender_account_id === auth.account.id ? row.read_at : now,
    mine: row.sender_account_id === auth.account.id,
  })) });
}

async function sendMessage(request: Request, env: CallEnv, conversationId: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  if (!(await authorizeConversation(env, conversationId, auth.account.id))) return json({ ok: false, error: "conversation_not_found" }, 404);
  const body = await readJson(request);
  const message = normalizeMessage(body?.body);
  const clientNonce = typeof body?.clientNonce === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(body.clientNonce) ? body.clientNonce : randomToken(12);
  if (!message) return json({ ok: false, error: "empty_message" }, 400);
  if (!(await rateLimit(env, `message:${auth.account.id}`, 240, 60 * 60 * 1000))) return json({ ok: false, error: "rate_limited" }, 429);
  const id = randomId("msg");
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO varex_call_message (id, conversation_id, sender_account_id, client_nonce, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(sender_account_id, client_nonce) DO NOTHING`,
    ).bind(id, conversationId, auth.account.id, clientNonce, message, now),
    env.DB.prepare("UPDATE varex_call_conversation SET updated_at = ?, last_message_at = ? WHERE id = ?").bind(now, now, conversationId),
  ]);
  const saved = await env.DB.prepare(
    `SELECT id, sender_account_id, client_nonce, body, created_at, read_at
     FROM varex_call_message WHERE sender_account_id = ? AND client_nonce = ? LIMIT 1`,
  ).bind(auth.account.id, clientNonce).first<Record<string, unknown>>();
  return json({ ok: true, message: {
    id: saved?.id,
    senderId: saved?.sender_account_id,
    clientNonce: saved?.client_nonce,
    body: saved?.body,
    createdAt: saved?.created_at,
    readAt: saved?.read_at,
    mine: true,
  } }, 201);
}

async function getRoom(env: CallEnv, id: string): Promise<RoomRow | null> {
  return env.DB.prepare(
    `SELECT id, call_type, status, host_token_hash, guest_token_hash, host_name, guest_name,
            caller_account_id, callee_account_id, answered_at, ended_reason, created_at, updated_at, expires_at
     FROM varex_call_room WHERE id = ? LIMIT 1`,
  ).bind(id).first<RoomRow>();
}

function roomPayload(room: RoomRow, accountId: string) {
  const incoming = room.callee_account_id === accountId;
  return {
    id: room.id,
    callType: room.call_type,
    status: room.status,
    role: incoming ? "guest" : "host",
    partnerName: incoming ? room.host_name : room.guest_name,
    createdAt: room.created_at,
    answeredAt: room.answered_at,
    updatedAt: room.updated_at,
    expiresAt: room.expires_at,
    endedReason: room.ended_reason,
  };
}

async function startCall(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  const calleeId = typeof body?.accountId === "string" ? body.accountId : "";
  const callType: CallType = body?.callType === "voice" ? "voice" : "video";
  if (!calleeId || calleeId === auth.account.id) return json({ ok: false, error: "invalid_contact" }, 400);
  const callee = await env.DB.prepare("SELECT id, display_name FROM varex_call_account WHERE id = ? LIMIT 1")
    .bind(calleeId).first<{ id: string; display_name: string }>();
  if (!callee) return json({ ok: false, error: "contact_not_available" }, 404);
  if (!(await rateLimit(env, `call:${auth.account.id}`, 50, 60 * 60 * 1000))) return json({ ok: false, error: "rate_limited" }, 429);
  const roomId = randomId("call");
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO varex_call_room
     (id, call_type, status, host_token_hash, guest_token_hash, host_name, guest_name,
      caller_account_id, callee_account_id, created_at, updated_at, expires_at)
     VALUES (?, ?, 'waiting', ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(roomId, callType, tokenHash, auth.account.display_name, callee.display_name, auth.account.id, callee.id, now, now, now + ROOM_LIFETIME_MS).run();
  return json({ ok: true, call: { id: roomId, callType, status: "waiting", role: "host", partnerName: callee.display_name, token, createdAt: now, expiresAt: now + ROOM_LIFETIME_MS } }, 201);
}

async function incomingCalls(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE varex_call_room SET status = 'ended', ended_reason = 'missed', updated_at = ? WHERE status = 'waiting' AND created_at < ?",
  ).bind(now, now - RING_TIMEOUT_MS).run();
  const result = await env.DB.prepare(
    `SELECT id, call_type, status, host_token_hash, guest_token_hash, host_name, guest_name,
            caller_account_id, callee_account_id, answered_at, ended_reason, created_at, updated_at, expires_at
     FROM varex_call_room WHERE callee_account_id = ? AND status = 'waiting' AND expires_at > ?
     ORDER BY created_at DESC LIMIT 10`,
  ).bind(auth.account.id, now).all<RoomRow>();
  return json({ ok: true, calls: (result.results || []).map(room => roomPayload(room, auth.account.id)) });
}

async function callHistory(request: Request, env: CallEnv): Promise<Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const result = await env.DB.prepare(
    `SELECT id, call_type, status, host_token_hash, guest_token_hash, host_name, guest_name,
            caller_account_id, callee_account_id, answered_at, ended_reason, created_at, updated_at, expires_at
     FROM varex_call_room WHERE caller_account_id = ? OR callee_account_id = ?
     ORDER BY created_at DESC LIMIT 100`,
  ).bind(auth.account.id, auth.account.id).all<RoomRow>();
  return json({ ok: true, calls: (result.results || []).map(room => ({
    ...roomPayload(room, auth.account.id),
    direction: room.caller_account_id === auth.account.id ? "outgoing" : "incoming",
  })) });
}

async function participantRoom(request: Request, env: CallEnv, id: string): Promise<{ auth: AuthContext; room: RoomRow } | Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const room = await getRoom(env, id);
  if (!room || (room.caller_account_id !== auth.account.id && room.callee_account_id !== auth.account.id)) return json({ ok: false, error: "call_not_found" }, 404);
  return { auth, room };
}

async function callStatus(request: Request, env: CallEnv, id: string): Promise<Response> {
  const context = await participantRoom(request, env, id);
  if (context instanceof Response) return context;
  if (context.room.status === "waiting" && context.room.created_at < Date.now() - RING_TIMEOUT_MS) {
    const now = Date.now();
    await env.DB.prepare("UPDATE varex_call_room SET status = 'ended', ended_reason = 'missed', updated_at = ? WHERE id = ? AND status = 'waiting'").bind(now, id).run();
    context.room.status = "ended";
    context.room.ended_reason = "missed";
    context.room.updated_at = now;
  }
  return json({ ok: true, call: roomPayload(context.room, context.auth.account.id) });
}

async function acceptCall(request: Request, env: CallEnv, id: string): Promise<Response> {
  const context = await participantRoom(request, env, id);
  if (context instanceof Response) return context;
  if (context.room.callee_account_id !== context.auth.account.id) return json({ ok: false, error: "forbidden" }, 403);
  if (context.room.status !== "waiting" || context.room.expires_at <= Date.now() || context.room.created_at < Date.now() - RING_TIMEOUT_MS) return json({ ok: false, error: "call_unavailable" }, 409);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  const result = await env.DB.prepare(
    `UPDATE varex_call_room SET guest_token_hash = ?, status = 'active', answered_at = ?, updated_at = ?
     WHERE id = ? AND callee_account_id = ? AND status = 'waiting' AND guest_token_hash IS NULL`,
  ).bind(tokenHash, now, now, id, context.auth.account.id).run();
  if (!result.success || Number(result.meta?.changes || 0) !== 1) return json({ ok: false, error: "call_unavailable" }, 409);
  await env.DB.prepare(
    `INSERT INTO varex_call_signal (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
     VALUES (?, 'guest', 'host', 'ready', ?, ?, ?)`,
  ).bind(id, JSON.stringify({ name: context.auth.account.display_name }), now, now + SIGNAL_LIFETIME_MS).run();
  return json({ ok: true, call: {
    ...roomPayload({ ...context.room, status: "active", guest_token_hash: tokenHash, answered_at: now, updated_at: now }, context.auth.account.id), token,
  } });
}

async function declineCall(request: Request, env: CallEnv, id: string): Promise<Response> {
  const context = await participantRoom(request, env, id);
  if (context instanceof Response) return context;
  if (context.room.callee_account_id !== context.auth.account.id) return json({ ok: false, error: "forbidden" }, 403);
  if (context.room.status !== "waiting") return json({ ok: false, error: "call_unavailable" }, 409);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE varex_call_room SET status = 'ended', ended_reason = 'declined', updated_at = ? WHERE id = ? AND status = 'waiting'").bind(now, id),
    env.DB.prepare(
      `INSERT INTO varex_call_signal (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
       VALUES (?, 'guest', 'host', 'hangup', ?, ?, ?)`,
    ).bind(id, JSON.stringify({ reason: "declined" }), now, now + SIGNAL_LIFETIME_MS),
  ]);
  return json({ ok: true });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requestedRole(request: Request, url: URL): CallRole | null {
  const role = request.headers.get("x-call-role") || url.searchParams.get("role");
  return role === "host" || role === "guest" ? role : null;
}

async function authenticateRoom(request: Request, env: CallEnv, id: string, url: URL): Promise<{ room: RoomRow; role: CallRole; auth: AuthContext } | Response> {
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;
  const role = requestedRole(request, url);
  const token = bearerToken(request);
  if (!role || !token) return json({ ok: false, error: "unauthorized" }, 401);
  const room = await getRoom(env, id);
  if (!room || (room.caller_account_id !== auth.account.id && room.callee_account_id !== auth.account.id)) return json({ ok: false, error: "call_not_found" }, 404);
  if (room.expires_at <= Date.now() || room.status === "ended") return json({ ok: false, error: "call_ended" }, 410);
  if ((role === "host" && room.caller_account_id !== auth.account.id) || (role === "guest" && room.callee_account_id !== auth.account.id)) return json({ ok: false, error: "forbidden" }, 403);
  const expected = role === "host" ? room.host_token_hash : room.guest_token_hash;
  const actual = await sha256(token);
  if (!expected || !constantTimeEqual(expected, actual)) return json({ ok: false, error: "unauthorized" }, 401);
  return { room, role, auth };
}

async function listSignals(request: Request, env: CallEnv, id: string, url: URL): Promise<Response> {
  const auth = await authenticateRoom(request, env, id, url);
  if (auth instanceof Response) return auth;
  const afterValue = Number(url.searchParams.get("after") || "0");
  const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0;
  const result = await env.DB.prepare(
    `SELECT id, sender_role, kind, payload_json, created_at FROM varex_call_signal
     WHERE room_id = ? AND recipient_role = ? AND id > ? AND expires_at > ? ORDER BY id ASC LIMIT 200`,
  ).bind(id, auth.role, after, Date.now()).all<{ id: number; sender_role: CallRole; kind: SignalKind; payload_json: string; created_at: number }>();
  const events = (result.results || []).map(item => {
    let payload: unknown = null;
    try { payload = JSON.parse(item.payload_json); } catch { payload = null; }
    return { id: item.id, senderRole: item.sender_role, kind: item.kind, payload, createdAt: item.created_at };
  });
  return json({ ok: true, events, cursor: events.length ? events[events.length - 1].id : after, call: roomPayload(auth.room, auth.auth.account.id) });
}

async function sendSignal(request: Request, env: CallEnv, id: string, url: URL): Promise<Response> {
  const auth = await authenticateRoom(request, env, id, url);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);
  const allowed = new Set<SignalKind>(["offer", "answer", "ice", "hangup"]);
  const kind = typeof body.kind === "string" && allowed.has(body.kind as SignalKind) ? body.kind as SignalKind : null;
  if (!kind) return json({ ok: false, error: "invalid_signal" }, 400);
  const payloadJson = JSON.stringify(body.payload ?? null);
  if (payloadJson.length > 60_000) return json({ ok: false, error: "signal_too_large" }, 413);
  const recipientRole: CallRole = auth.role === "host" ? "guest" : "host";
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO varex_call_signal (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, auth.role, recipientRole, kind, payloadJson, now, now + SIGNAL_LIFETIME_MS).run();
  if (kind === "hangup") await env.DB.prepare("UPDATE varex_call_room SET status = 'ended', ended_reason = 'completed', updated_at = ? WHERE id = ?").bind(now, id).run();
  return json({ ok: true }, 201);
}

async function hangupCall(request: Request, env: CallEnv, id: string, url: URL): Promise<Response> {
  const auth = await authenticateRoom(request, env, id, url);
  if (auth instanceof Response) return auth;
  const recipientRole: CallRole = auth.role === "host" ? "guest" : "host";
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE varex_call_room SET status = 'ended', ended_reason = 'completed', updated_at = ? WHERE id = ?").bind(now, id),
    env.DB.prepare(
      `INSERT INTO varex_call_signal (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
       VALUES (?, ?, ?, 'hangup', ?, ?, ?)`,
    ).bind(id, auth.role, recipientRole, JSON.stringify({ reason: "completed" }), now, now + SIGNAL_LIFETIME_MS),
  ]);
  return json({ ok: true });
}

export async function callApi(request: Request, env: CallEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const conversationMatch = path.match(/^\/call\/api\/conversations\/([a-zA-Z0-9_-]+)\/messages$/);
  const callMatch = path.match(/^\/call\/api\/calls\/([a-zA-Z0-9_-]+)(?:\/(status|accept|decline|signals|hangup))?$/);
  try {
    if (path === "/call/api/config" && request.method === "GET") return json({ ok: true, otpConfigured: twilioConfigured(env), channels: ["sms", "whatsapp", "call"] });
    if (path === "/call/api/auth/request" && request.method === "POST") return requestOtp(request, env);
    if (path === "/call/api/auth/verify" && request.method === "POST") return verifyOtp(request, env);
    if (path === "/call/api/auth/logout" && request.method === "POST") return logout(request, env);
    if (path === "/call/api/me" && request.method === "GET") return getMe(request, env);
    if (path === "/call/api/me" && request.method === "PATCH") return updateMe(request, env);
    if (path === "/call/api/contacts" && request.method === "GET") return listContacts(request, env);
    if (path === "/call/api/contacts" && request.method === "POST") return saveContacts(request, env);
    if (path === "/call/api/conversations" && request.method === "GET") return listConversations(request, env);
    if (path === "/call/api/conversations" && request.method === "POST") return createConversation(request, env);
    if (conversationMatch && request.method === "GET") return listMessages(request, env, conversationMatch[1], url);
    if (conversationMatch && request.method === "POST") return sendMessage(request, env, conversationMatch[1]);
    if (path === "/call/api/calls" && request.method === "POST") return startCall(request, env);
    if (path === "/call/api/calls/incoming" && request.method === "GET") return incomingCalls(request, env);
    if (path === "/call/api/calls/history" && request.method === "GET") return callHistory(request, env);
    if (callMatch) {
      const [, id, action] = callMatch;
      if ((!action || action === "status") && request.method === "GET") return callStatus(request, env, id);
      if (action === "accept" && request.method === "POST") return acceptCall(request, env, id);
      if (action === "decline" && request.method === "POST") return declineCall(request, env, id);
      if (action === "signals" && request.method === "GET") return listSignals(request, env, id, url);
      if (action === "signals" && request.method === "POST") return sendSignal(request, env, id, url);
      if (action === "hangup" && (request.method === "POST" || request.method === "DELETE")) return hangupCall(request, env, id, url);
    }
    return json({ ok: false, error: "not_found" }, 404);
  } catch (error) {
    console.error("VAREX Call API error", error);
    return json({ ok: false, error: "service_unavailable" }, 503);
  } finally {
    if (Math.random() < 0.04) cleanup(env).catch(error => console.error("VAREX Call cleanup failed", error));
  }
}
