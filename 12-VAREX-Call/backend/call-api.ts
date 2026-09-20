interface CallEnv {
  DB: D1Database;
}

type CallRole = "host" | "guest";
type CallType = "voice" | "video";
type SignalKind = "ready" | "offer" | "answer" | "ice" | "hangup";

type RoomRow = {
  id: string;
  call_type: CallType;
  status: "waiting" | "active" | "ended";
  host_token_hash: string;
  guest_token_hash: string | null;
  host_name: string;
  guest_name: string | null;
  expires_at: number;
};

const ROOM_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SIGNAL_LIFETIME_MS = 12 * 60 * 60 * 1000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function normalizeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 40) || fallback;
}

function randomCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, value => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 70_000) return null;
  try {
    const text = await request.text();
    if (!text || text.length > 70_000) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requestedRole(request: Request, url: URL): CallRole | null {
  const role = request.headers.get("x-call-role") || url.searchParams.get("role");
  return role === "host" || role === "guest" ? role : null;
}

async function getRoom(env: CallEnv, id: string): Promise<RoomRow | null> {
  return env.DB.prepare(
    `SELECT id, call_type, status, host_token_hash, guest_token_hash, host_name, guest_name, expires_at
     FROM varex_call_room WHERE id = ? LIMIT 1`,
  ).bind(id).first<RoomRow>();
}

async function authenticateRoom(request: Request, env: CallEnv, id: string, url: URL): Promise<{ room: RoomRow; role: CallRole } | Response> {
  const role = requestedRole(request, url);
  const token = bearerToken(request);
  if (!role || !token) return json({ ok: false, error: "unauthorized" }, 401);
  const room = await getRoom(env, id);
  if (!room) return json({ ok: false, error: "room_not_found" }, 404);
  if (room.expires_at <= Date.now() || room.status === "ended") return json({ ok: false, error: "room_ended" }, 410);
  const expected = role === "host" ? room.host_token_hash : room.guest_token_hash;
  const actual = await sha256(token);
  if (!expected || !constantTimeEqual(expected, actual)) return json({ ok: false, error: "unauthorized" }, 401);
  return { room, role };
}

async function rateLimit(request: Request, env: CallEnv, action: "create" | "join", limit: number): Promise<boolean> {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${action}:${await sha256(address)}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
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
  ]);
}

async function createRoom(request: Request, env: CallEnv): Promise<Response> {
  if (!(await rateLimit(request, env, "create", 12))) return json({ ok: false, error: "rate_limited" }, 429);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);
  const callType: CallType = body.callType === "voice" ? "voice" : body.callType === "video" ? "video" : "video";
  const hostName = normalizeName(body.name, "مستخدم VAREX");
  const hostToken = randomToken();
  const hostTokenHash = await sha256(hostToken);
  const now = Date.now();
  let roomId = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomCode();
    try {
      await env.DB.prepare(
        `INSERT INTO varex_call_room
         (id, call_type, status, host_token_hash, host_name, created_at, updated_at, expires_at)
         VALUES (?, ?, 'waiting', ?, ?, ?, ?, ?)`,
      ).bind(candidate, callType, hostTokenHash, hostName, now, now, now + ROOM_LIFETIME_MS).run();
      roomId = candidate;
      break;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }

  if (!roomId) return json({ ok: false, error: "room_unavailable" }, 503);
  return json({ ok: true, roomId, hostToken, callType, expiresAt: now + ROOM_LIFETIME_MS }, 201);
}

async function joinRoom(request: Request, env: CallEnv, id: string): Promise<Response> {
  if (!(await rateLimit(request, env, "join", 40))) return json({ ok: false, error: "rate_limited" }, 429);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);
  const room = await getRoom(env, id);
  const now = Date.now();
  if (!room) return json({ ok: false, error: "room_not_found" }, 404);
  if (room.expires_at <= now || room.status === "ended") return json({ ok: false, error: "room_ended" }, 410);
  if (room.guest_token_hash) return json({ ok: false, error: "room_full" }, 409);

  const guestName = normalizeName(body.name, "ضيف VAREX");
  const guestToken = randomToken();
  const guestTokenHash = await sha256(guestToken);
  const update = await env.DB.prepare(
    `UPDATE varex_call_room
     SET guest_token_hash = ?, guest_name = ?, status = 'active', updated_at = ?
     WHERE id = ? AND guest_token_hash IS NULL AND status = 'waiting' AND expires_at > ?`,
  ).bind(guestTokenHash, guestName, now, id, now).run();
  if (!update.success || Number(update.meta?.changes || 0) !== 1) return json({ ok: false, error: "room_full" }, 409);
  await env.DB.prepare(
    `INSERT INTO varex_call_signal
     (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
     VALUES (?, 'guest', 'host', 'ready', ?, ?, ?)`,
  ).bind(id, JSON.stringify({ name: guestName }), now, now + SIGNAL_LIFETIME_MS).run();
  return json({ ok: true, roomId: id, guestToken, callType: room.call_type, hostName: room.host_name, expiresAt: room.expires_at });
}

async function listSignals(request: Request, env: CallEnv, id: string, url: URL): Promise<Response> {
  const auth = await authenticateRoom(request, env, id, url);
  if (auth instanceof Response) return auth;
  const afterValue = Number(url.searchParams.get("after") || "0");
  const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0;
  const result = await env.DB.prepare(
    `SELECT id, sender_role, kind, payload_json, created_at
     FROM varex_call_signal
     WHERE room_id = ? AND recipient_role = ? AND id > ? AND expires_at > ?
     ORDER BY id ASC LIMIT 200`,
  ).bind(id, auth.role, after, Date.now()).all<{
    id: number;
    sender_role: CallRole;
    kind: SignalKind;
    payload_json: string;
    created_at: number;
  }>();
  const events = (result.results || []).map(item => {
    let payload: unknown = null;
    try { payload = JSON.parse(item.payload_json); } catch { payload = null; }
    return { id: item.id, senderRole: item.sender_role, kind: item.kind, payload, createdAt: item.created_at };
  });
  const latest = events.length ? events[events.length - 1].id : after;
  const freshRoom = await getRoom(env, id);
  return json({
    ok: true,
    events,
    cursor: latest,
    room: freshRoom ? {
      id: freshRoom.id,
      callType: freshRoom.call_type,
      status: freshRoom.status,
      hostName: freshRoom.host_name,
      guestName: freshRoom.guest_name,
      expiresAt: freshRoom.expires_at,
    } : null,
  });
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
    `INSERT INTO varex_call_signal
     (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, auth.role, recipientRole, kind, payloadJson, now, now + SIGNAL_LIFETIME_MS).run();
  if (kind === "hangup") {
    await env.DB.prepare("UPDATE varex_call_room SET status = 'ended', updated_at = ? WHERE id = ?").bind(now, id).run();
  }
  return json({ ok: true }, 201);
}

async function endRoom(request: Request, env: CallEnv, id: string, url: URL): Promise<Response> {
  const auth = await authenticateRoom(request, env, id, url);
  if (auth instanceof Response) return auth;
  const recipientRole: CallRole = auth.role === "host" ? "guest" : "host";
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE varex_call_room SET status = 'ended', updated_at = ? WHERE id = ?").bind(now, id),
    env.DB.prepare(
      `INSERT INTO varex_call_signal
       (room_id, sender_role, recipient_role, kind, payload_json, created_at, expires_at)
       VALUES (?, ?, ?, 'hangup', 'null', ?, ?)`,
    ).bind(id, auth.role, recipientRole, now, now + SIGNAL_LIFETIME_MS),
  ]);
  return json({ ok: true });
}

export async function callApi(request: Request, env: CallEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const roomMatch = path.match(/^\/call\/api\/rooms\/([A-Z2-9]{8})(?:\/(join|signals|hangup))?$/);

  try {
    if (path === "/call/api/rooms" && request.method === "POST") {
      const response = await createRoom(request, env);
      await cleanup(env);
      return response;
    }
    if (!roomMatch) return json({ ok: false, error: "not_found" }, 404);
    const roomId = roomMatch[1];
    const action = roomMatch[2];
    if (action === "join" && request.method === "POST") return joinRoom(request, env, roomId);
    if (action === "signals" && request.method === "GET") return listSignals(request, env, roomId, url);
    if (action === "signals" && request.method === "POST") return sendSignal(request, env, roomId, url);
    if (action === "hangup" && (request.method === "POST" || request.method === "DELETE")) return endRoom(request, env, roomId, url);
    return json({ ok: false, error: "method_not_allowed" }, 405);
  } catch (error) {
    console.error("VAREX Call API error", error);
    return json({ ok: false, error: "service_unavailable" }, 503);
  }
}

