export type VarexAuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    business_name?: string;
    business_type?: string;
    full_name?: string;
    name?: string;
    varex_system?: string;
    varex_theme?: string;
  };
};

export type VarexAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: VarexAuthUser;
};

export type PendingAuth = {
  email: string;
  businessName?: string;
  purpose: "signup" | "reset";
};

const SUPABASE_URL = "https://eibadfdqzpeigccfdipt.supabase.co";
const SUPABASE_KEY = "sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336";
const SESSION_KEY = "varex_shipping_auth_session";
const PENDING_KEY = "varex_shipping_pending_auth";
const REMEMBERED_EMAIL_KEY = "varex_shipping_remembered_email";

const shippingMetadata = (businessName?: string) => ({
  name: businessName || "VAREX Shipping",
  full_name: businessName || "VAREX Shipping",
  business_name: businessName || "VAREX Shipping",
  business_type: "shipping",
  varex_system: "shipping",
  varex_system_name: "VAREX Shipping",
  varex_theme: "coffee",
  varex_color: "#8A5A44",
});

function headers(token?: string) {
  return {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function messageFrom(error: unknown) {
  const raw = String(
    (error as { message?: string; msg?: string; error_description?: string; error?: string })?.message ||
      (error as { msg?: string })?.msg ||
      (error as { error_description?: string })?.error_description ||
      (error as { error?: string })?.error ||
      "",
  ).toLowerCase();
  if (raw.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (raw.includes("email not confirmed")) return "يجب تأكيد البريد الإلكتروني أولًا.";
  if (raw.includes("already registered") || raw.includes("already been registered")) return "يوجد حساب مسجّل بهذا البريد الإلكتروني.";
  if (raw.includes("password") && raw.includes("least")) return "كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل.";
  if (raw.includes("expired")) return "انتهت صلاحية رمز التحقق. اطلبي رمزًا جديدًا.";
  if (raw.includes("invalid otp") || raw.includes("invalid token")) return "رمز التحقق غير صحيح.";
  if (raw.includes("rate") || raw.includes("security purposes")) return "تمت محاولات كثيرة. انتظري قليلًا ثم أعيدي المحاولة.";
  if (raw.includes("failed to fetch") || raw.includes("network")) return "تعذّر الاتصال بالخادم. تحققي من الإنترنت.";
  return String((error as { message?: string })?.message || "تعذّر إكمال العملية.");
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init.headers || {}) },
  });
  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) throw new Error(messageFrom(payload));
  return payload as T;
}

function normalizeSession(payload: VarexAuthSession): VarexAuthSession {
  return {
    ...payload,
    expires_at:
      payload.expires_at ||
      Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
  };
}

export function readSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as VarexAuthSession | null;
  } catch {
    return null;
  }
}

export function saveSession(payload: VarexAuthSession) {
  const session = normalizeSession(payload);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function readPendingAuth() {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) || "null") as PendingAuth | null;
  } catch {
    return null;
  }
}

export function savePendingAuth(pending: PendingAuth) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function clearPendingAuth() {
  window.localStorage.removeItem(PENDING_KEY);
}

export function getRememberedEmail() {
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
}

export function setRememberedEmail(email: string, remember: boolean) {
  if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

export async function restoreSession() {
  const stored = readSession();
  if (!stored?.access_token) return null;
  try {
    const user = await request<VarexAuthUser>("/auth/v1/user", { method: "GET" }, stored.access_token);
    return saveSession({ ...stored, user });
  } catch {
    if (!stored.refresh_token) {
      clearSession();
      return null;
    }
  }
  try {
    const refreshed = await request<VarexAuthSession>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    });
    return saveSession(refreshed);
  } catch {
    clearSession();
    return null;
  }
}

export async function signIn(email: string, password: string) {
  const payload = await request<VarexAuthSession>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const session = saveSession(payload);
  await syncShippingBusiness(session).catch(() => undefined);
  return session;
}

export async function registerBusiness(businessName: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = await request<{
    user?: VarexAuthUser;
    session?: VarexAuthSession | null;
    access_token?: string;
    refresh_token?: string;
  }>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: normalizedEmail,
      password,
      data: {
        ...shippingMetadata(businessName),
        username: normalizedEmail.split("@")[0],
      },
    }),
  });
  savePendingAuth({ email: normalizedEmail, businessName, purpose: "signup" });
  const directSession = payload.session ||
    (payload.access_token && payload.refresh_token && payload.user
      ? ({ ...payload, user: payload.user } as VarexAuthSession)
      : null);
  if (directSession) {
    const session = saveSession(directSession);
    await syncShippingBusiness(session, businessName).catch(() => undefined);
    clearPendingAuth();
    return session;
  }
  return null;
}

export async function verifySignup(email: string, token: string, businessName?: string) {
  const payload = await request<VarexAuthSession>("/auth/v1/verify", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), token, type: "signup" }),
  });
  const session = saveSession(payload);
  await syncShippingBusiness(session, businessName).catch(() => undefined);
  clearPendingAuth();
  return session;
}

export async function resendSignupOtp(email: string) {
  await request("/auth/v1/resend", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email: email.trim().toLowerCase() }),
  });
}

export async function requestPasswordOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await request("/auth/v1/otp", {
    method: "POST",
    body: JSON.stringify({
      email: normalizedEmail,
      create_user: false,
      data: shippingMetadata(),
    }),
  });
  savePendingAuth({ email: normalizedEmail, purpose: "reset" });
}

export async function resetPasswordWithOtp(email: string, token: string, password: string) {
  const sessionPayload = await request<VarexAuthSession>("/auth/v1/verify", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), token, type: "email" }),
  });
  const session = saveSession(sessionPayload);
  const user = await request<VarexAuthUser>(
    "/auth/v1/user",
    { method: "PUT", body: JSON.stringify({ password, data: shippingMetadata(session.user.user_metadata?.business_name) }) },
    session.access_token,
  );
  const updated = saveSession({ ...session, user });
  await syncShippingBusiness(updated).catch(() => undefined);
  clearPendingAuth();
  return updated;
}

export async function signOut(session: VarexAuthSession | null) {
  if (session?.access_token) {
    await request("/auth/v1/logout", { method: "POST" }, session.access_token).catch(() => undefined);
  }
  clearSession();
}

export async function syncShippingBusiness(session: VarexAuthSession, requestedName?: string) {
  const profiles = await request<Array<{ business_id: string | null; name?: string }>>(
    `/rest/v1/users?auth_user_id=eq.${encodeURIComponent(session.user.id)}&select=business_id,name&limit=1`,
    { method: "GET" },
    session.access_token,
  );
  const businessId = profiles[0]?.business_id;
  if (!businessId) return;
  const metadata = session.user.user_metadata || {};
  const businessName = requestedName || metadata.business_name || metadata.name || profiles[0]?.name || "VAREX Shipping";
  await request(
    `/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        business_name: businessName,
        owner_name: businessName,
        owner_email: session.user.email || "",
        business_type: "shipping",
      }),
    },
    session.access_token,
  );
}

export function getAuthErrorMessage(error: unknown) {
  return messageFrom(error);
}

export async function withMinimumDelay<T>(operation: Promise<T>, minimum = 2200) {
  const started = Date.now();
  try {
    return await operation;
  } finally {
    const remaining = minimum - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
  }
}
