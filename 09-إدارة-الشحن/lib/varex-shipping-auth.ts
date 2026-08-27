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
  business_id: string;
  user: VarexAuthUser;
};

export type PendingAuth = {
  email: string;
  businessName?: string;
  purpose: "signup" | "reset";
};

const PENDING_KEY = "varex_shipping_pending_auth";
const REMEMBERED_EMAIL_KEY = "varex_shipping_remembered_email";

function messageFrom(error: unknown) {
  const direct = error instanceof Error ? error.message : "";
  const raw = String(
    direct ||
      (error as { message?: string; error?: string })?.message ||
      (error as { error?: string })?.error ||
      "",
  );
  const lower = raw.toLowerCase();
  if (lower.includes("invalid") && (lower.includes("otp") || lower.includes("token"))) return "رمز التحقق غير صحيح.";
  if (lower.includes("expired")) return "انتهت صلاحية رمز التحقق. يجب طلب رمز جديد.";
  if (lower.includes("rate") || lower.includes("security purposes")) return "تمت محاولات كثيرة. يجب الانتظار قليلًا قبل إعادة المحاولة.";
  if (lower.includes("failed to fetch") || lower.includes("network")) return "تعذّر الاتصال بالخادم. يجب التحقق من اتصال الإنترنت.";
  return raw || "تعذّر إكمال العملية.";
}

async function request<T>(body?: Record<string, unknown>, method: "GET" | "POST" = "POST"): Promise<T> {
  const response = await fetch("/api/auth", {
    method,
    credentials: "include",
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    cache: "no-store",
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {}
  if (!response.ok) throw new Error(String(payload.error || "تعذّر إكمال العملية."));
  return payload as T;
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
  try {
    const payload = await request<{ session: VarexAuthSession }>(undefined, "GET");
    return payload.session;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string) {
  const payload = await request<{ session: VarexAuthSession }>({
    action: "login",
    email: email.trim().toLowerCase(),
    password,
  });
  return payload.session;
}

export async function registerBusiness(businessName: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await request({
    action: "register",
    businessName: businessName.trim(),
    email: normalizedEmail,
    password,
  });
  savePendingAuth({ email: normalizedEmail, businessName: businessName.trim(), purpose: "signup" });
  return null;
}

export async function verifySignup(email: string, token: string, _businessName?: string) {
  void _businessName;
  const payload = await request<{ session: VarexAuthSession }>({
    action: "verify-signup",
    email: email.trim().toLowerCase(),
    otp: token,
  });
  clearPendingAuth();
  return payload.session;
}

export async function resendSignupOtp(email: string) {
  await request({ action: "resend", purpose: "signup", email: email.trim().toLowerCase() });
}

export async function requestPasswordOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await request({ action: "request-reset", email: normalizedEmail });
  savePendingAuth({ email: normalizedEmail, purpose: "reset" });
}

export async function resetPasswordWithOtp(email: string, token: string, password: string) {
  const payload = await request<{ session: VarexAuthSession }>({
    action: "reset-password",
    email: email.trim().toLowerCase(),
    otp: token,
    password,
  });
  clearPendingAuth();
  return payload.session;
}

export async function signOut(_session: VarexAuthSession | null) {
  void _session;
  await request({ action: "logout" }).catch(() => undefined);
}

export function getAuthErrorMessage(error: unknown) {
  return messageFrom(error);
}

export async function withMinimumDelay<T>(operation: Promise<T>, minimum = 900) {
  const started = Date.now();
  try {
    return await operation;
  } finally {
    const remaining = minimum - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
  }
}
