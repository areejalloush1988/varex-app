import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://varexapp.com",
  "https://www.varexapp.com",
  "https://areejalloush1988.github.io",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || localOrigin ? origin : "https://varexapp.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`Missing required secret: ${names.join(" or ")}`);
}

function requiredProjectKey(jsonName: string, legacyName: string) {
  const dictionary = Deno.env.get(jsonName);
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary) as Record<string, unknown>;
      const preferred = keys.default;
      if (typeof preferred === "string" && preferred) return preferred;
      const fallback = Object.values(keys).find((value) => typeof value === "string" && value);
      if (typeof fallback === "string") return fallback;
    } catch {
      // Fall back to the legacy plain-string environment variable below.
    }
  }
  return requiredEnv(legacyName);
}

function decodeClaims(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new Error("Malformed access token.");
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))));
}

function authMethodTimestamp(claims: Record<string, unknown>, method: "password" | "otp") {
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  for (const entry of amr) {
    if (entry === method) return Number(claims.iat || 0);
    if (entry && typeof entry === "object" && (entry as Record<string, unknown>).method === method) {
      return Number((entry as Record<string, unknown>).timestamp || claims.iat || 0);
    }
  }
  return 0;
}

function businessIdFromRpc(value: unknown): string {
  if (typeof value === "string") return value.replace(/^"|"$/g, "").trim();
  if (Array.isArray(value)) return businessIdFromRpc(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row.get_current_business_id || row.business_id || row.id || "").trim();
  }
  return "";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { success: false, code: "METHOD_NOT_ALLOWED", message: "طريقة الطلب غير مسموحة." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action === "prepare" ? "prepare" : body?.action === "delete" ? "delete" : "";
    if (!action) return json(request, { success: false, code: "INVALID_ACTION", message: "مرحلة الحذف المطلوبة غير صالحة." }, 400);
    if (body?.confirmation !== "DELETE_MY_VAREX_ACCOUNT") {
      return json(request, { success: false, code: "CONFIRMATION_REQUIRED", message: "تأكيد الحذف النهائي غير صالح." }, 400);
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(request, { success: false, code: "AUTH_REQUIRED", message: "يلزم تسجيل الدخول بحساب المالك." }, 401);

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const publicKey = requiredProjectKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const serviceKey = requiredProjectKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id || !user.email) {
      return json(request, { success: false, code: "INVALID_SESSION", retryable: false, message: "جلسة حساب المالك غير صالحة. يرجى طلب رمز تحقق جديد." }, 401);
    }

    const claims = decodeClaims(token);
    const now = Math.floor(Date.now() / 1000);
    if (String(claims.sub || "") !== user.id) {
      return json(request, { success: false, code: "OWNER_MISMATCH", retryable: false, message: "جلسة التحقق لا تخص حساب المالك الحالي." }, 403);
    }

    const { data: existingJob, error: jobLookupError } = await admin
      .from("varex_account_deletion_jobs")
      .select("business_id,status,password_verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobLookupError) throw new Error(`Deletion checkpoint lookup failed: ${jobLookupError.message}`);

    if (action === "prepare") {
      const passwordTimestamp = authMethodTimestamp(claims, "password");
      if (!passwordTimestamp || passwordTimestamp > now + 30 || now - passwordTimestamp > 300) {
        return json(request, { success: false, code: "RECENT_PASSWORD_REQUIRED", retryable: false, message: "يلزم التحقق حديثًا من كلمة مرور المالك قبل إرسال رمز الحذف." }, 403);
      }

      let preparedBusinessId = String(existingJob?.business_id || "");
      if (!preparedBusinessId) {
        const userClient = createClient(supabaseUrl, publicKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: businessData, error: businessError } = await userClient.rpc("get_current_business_id");
        if (businessError) throw new Error(`Business ownership lookup failed: ${businessError.message}`);
        preparedBusinessId = businessIdFromRpc(businessData);
        if (!preparedBusinessId) return json(request, { success: false, code: "BUSINESS_NOT_FOUND", retryable: false, message: "لم يتم العثور على منشأة مرتبطة بحساب المالك." }, 404);
      }

      const preparedAt = new Date().toISOString();
      const checkpointPayload = {
        user_id: user.id,
        business_id: preparedBusinessId,
        status: existingJob?.status || "pending",
        error_code: null,
        password_verified_at: preparedAt,
        updated_at: preparedAt,
      };
      const { error: checkpointError } = await admin
        .from("varex_account_deletion_jobs")
        .upsert(checkpointPayload, { onConflict: "user_id" });
      if (checkpointError) throw new Error(`Deletion checkpoint creation failed: ${checkpointError.message}`);

      return json(request, { success: true, code: "DELETE_PREPARED", message: "تم التحقق من كلمة مرور المالك وتجهيز طلب الحذف الآمن." });
    }

    const otpTimestamp = authMethodTimestamp(claims, "otp");
    if (!otpTimestamp || otpTimestamp > now + 30 || now - otpTimestamp > 600) {
      return json(request, { success: false, code: "RECENT_OTP_REQUIRED", retryable: false, message: "يلزم رمز تحقق حديث من بريد المالك قبل تنفيذ الحذف." }, 403);
    }
    if (!existingJob?.business_id || !existingJob.password_verified_at) {
      return json(request, { success: false, code: "PASSWORD_CHECK_REQUIRED", retryable: false, message: "يلزم التحقق من كلمة مرور المالك قبل رمز البريد." }, 403);
    }
    const passwordVerifiedAt = Math.floor(new Date(existingJob.password_verified_at).getTime() / 1000);
    if (!passwordVerifiedAt || passwordVerifiedAt > now + 30 || now - passwordVerifiedAt > 600) {
      return json(request, { success: false, code: "PASSWORD_CHECK_EXPIRED", retryable: false, message: "انتهت صلاحية التحقق من كلمة المرور. يرجى بدء طلب الحذف من جديد." }, 403);
    }

    const businessId = String(existingJob.business_id);

    const { data: deletionData, error: deletionError } = await admin.rpc("varex_delete_business_data", {
      p_business_id: businessId,
      p_user_id: user.id,
    });
    if (deletionError) {
      await admin.from("varex_account_deletion_jobs").update({ status: "failed", error_code: "DATA_DELETE_FAILED", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      console.error("VAREX account data deletion failed", { userId: user.id, businessId, error: deletionError.message });
      return json(request, { success: false, code: "DATA_DELETE_FAILED", retryable: true, message: "تعذر حذف بيانات المنشأة بأمان، لذلك تم إيقاف العملية من دون إغلاق حساب الدخول." }, 500);
    }

    let deleteUserError: { message?: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await admin.auth.admin.deleteUser(user.id, false);
      deleteUserError = error;
      if (!error) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 450));
    }

    if (deleteUserError) {
      await admin.from("varex_account_deletion_jobs").update({ status: "auth_pending", error_code: "AUTH_DELETE_PENDING", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      console.error("VAREX auth account deletion pending", { userId: user.id, businessId, error: deleteUserError.message });
      return json(request, { success: false, code: "AUTH_DELETE_PENDING", retryable: true, partial: true, message: "تم حذف بيانات المنشأة، لكن إغلاق حساب الدخول يحتاج إعادة المحاولة." }, 503);
    }

    await admin.from("varex_account_deletion_jobs").delete().eq("user_id", user.id);
    return json(request, { success: true, code: "ACCOUNT_DELETED", deleted: deletionData, message: "تم حذف حساب المنشأة نهائيًا." });
  } catch (error) {
    console.error("VAREX secure account deletion error", error);
    return json(request, { success: false, code: "DELETE_SERVICE_ERROR", retryable: true, message: "حدث خطأ في خدمة الحذف الآمن. يرجى إعادة المحاولة." }, 500);
  }
});
