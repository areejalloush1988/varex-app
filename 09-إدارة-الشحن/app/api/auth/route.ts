import {
  authErrorMessage,
  clearSessionCookie,
  createSession,
  database,
  hashPassword,
  normalizeEmail,
  normalizeShippingThemeId,
  pendingAuth,
  readShippingSession,
  savePendingReset,
  savePendingSignup,
  sendShippingOtp,
  sessionCookie,
  sessionPayload,
  validEmail,
  validPassword,
  verifyPassword,
  verifyShippingOtp,
} from "@/lib/shipping-auth-server";

type AuthBody = {
  action?: string;
  email?: string;
  password?: string;
  businessName?: string;
  otp?: string;
  purpose?: "signup" | "reset";
  themeId?: string;
};

function json(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie) headers.append("set-cookie", cookie);
  return Response.json(body, { status, headers });
}

async function bodyOf(request: Request) {
  try {
    return await request.json() as AuthBody;
  } catch {
    return {} as AuthBody;
  }
}

export async function GET(request: Request) {
  try {
    const session = await readShippingSession(request);
    if (!session) return json({ session: null }, 401, clearSessionCookie());
    return json({ session: sessionPayload(session) });
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}

export async function POST(request: Request) {
  const body = await bodyOf(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const businessName = String(body.businessName || "").trim();
  const otp = String(body.otp || "").replace(/\D/g, "").slice(0, 6);

  try {
    if (body.action === "register") {
      if (!validEmail(email)) return json({ error: "يجب إدخال بريد إلكتروني صحيح." }, 400);
      if (businessName.length < 2) return json({ error: "يجب إدخال اسم المنشأة." }, 400);
      if (!validPassword(password)) return json({ error: "كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل." }, 400);
      const existing = await database().prepare("SELECT id FROM shipping_users WHERE email = ? LIMIT 1").bind(email).first();
      if (existing) return json({ error: "يوجد حساب شحن مسجّل بهذا البريد الإلكتروني." }, 409);
      const pending = await pendingAuth(email, "signup");
      if (pending && Date.now() - pending.sentAt < 60_000) {
        return json({ error: "يجب الانتظار دقيقة واحدة قبل طلب رمز جديد." }, 429);
      }
      await savePendingSignup(email, businessName, password);
      try {
        await sendShippingOtp(email, "verify", body.themeId);
      } catch (error) {
        await database().prepare("DELETE FROM shipping_pending_auth WHERE email = ? AND purpose = 'signup'").bind(email).run();
        throw error;
      }
      return json({ pending: true });
    }

    if (body.action === "verify-signup") {
      if (!validEmail(email) || !/^\d{6}$/.test(otp)) return json({ error: "يجب إدخال البريد ورمز التحقق المكوّن من 6 أرقام." }, 400);
      const pending = await pendingAuth(email, "signup");
      if (!pending || pending.expiresAt < Date.now() || !pending.businessName || !pending.passwordHash || !pending.passwordSalt) {
        return json({ error: "انتهت صلاحية طلب التسجيل. يجب بدء التسجيل من جديد." }, 400);
      }
      await verifyShippingOtp(email, otp);
      const existing = await database().prepare("SELECT id FROM shipping_users WHERE email = ? LIMIT 1").bind(email).first();
      if (existing) return json({ error: "يوجد حساب شحن مسجّل بهذا البريد الإلكتروني." }, 409);
      const businessId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const now = Date.now();
      await database().batch([
        database().prepare("INSERT INTO shipping_businesses (id, name, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(businessId, pending.businessName, email, now, now),
        database().prepare("INSERT INTO shipping_users (id, business_id, email, password_hash, password_salt, role, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'owner', 1, ?, ?)").bind(userId, businessId, email, pending.passwordHash, pending.passwordSalt, now, now),
        database().prepare("INSERT INTO shipping_settings (business_id, settings_json, updated_at) VALUES (?, ?, ?)").bind(businessId, JSON.stringify({ themeId: normalizeShippingThemeId(body.themeId), language: "ar", autoAssign: true, clientUpdates: true, proofRequired: true, capacityAlerts: true, soundOn: true }), now),
        database().prepare("DELETE FROM shipping_pending_auth WHERE email = ? AND purpose = 'signup'").bind(email),
      ]);
      const token = await createSession(userId, businessId);
      const session = { tokenHash: "", userId, businessId, email, businessName: pending.businessName, role: "owner" };
      return json({ session: sessionPayload(session) }, 201, sessionCookie(token));
    }

    if (body.action === "login") {
      if (!validEmail(email) || !password) return json({ error: "يجب إدخال البريد الإلكتروني وكلمة المرور." }, 400);
      const user = await database().prepare(
        `SELECT u.id AS userId,
                u.business_id AS businessId,
                u.email,
                u.role,
                u.password_hash AS passwordHash,
                u.password_salt AS passwordSalt,
                b.name AS businessName
           FROM shipping_users u
           JOIN shipping_businesses b ON b.id = u.business_id
          WHERE u.email = ?
          LIMIT 1`,
      ).bind(email).first<{ userId: string; businessId: string; email: string; role: string; passwordHash: string; passwordSalt: string; businessName: string }>();
      if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
        return json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." }, 401);
      }
      const token = await createSession(user.userId, user.businessId);
      return json({ session: sessionPayload({ ...user, tokenHash: "" }) }, 200, sessionCookie(token));
    }

    if (body.action === "request-reset") {
      if (!validEmail(email)) return json({ error: "يجب إدخال بريد إلكتروني صحيح." }, 400);
      const user = await database().prepare("SELECT id FROM shipping_users WHERE email = ? LIMIT 1").bind(email).first();
      if (user) {
        const pending = await pendingAuth(email, "reset");
        if (pending && Date.now() - pending.sentAt < 60_000) {
          return json({ error: "يجب الانتظار دقيقة واحدة قبل طلب رمز جديد." }, 429);
        }
        await savePendingReset(email);
        await sendShippingOtp(email, "reset", body.themeId);
      }
      return json({ sent: true });
    }

    if (body.action === "reset-password") {
      if (!validEmail(email) || !/^\d{6}$/.test(otp)) return json({ error: "يجب إدخال البريد ورمز التحقق المكوّن من 6 أرقام." }, 400);
      if (!validPassword(password)) return json({ error: "كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل." }, 400);
      const pending = await pendingAuth(email, "reset");
      if (!pending || pending.expiresAt < Date.now()) return json({ error: "انتهت صلاحية طلب الاستعادة. يجب طلب رمز جديد." }, 400);
      const user = await database().prepare(
        `SELECT u.id AS userId, u.business_id AS businessId, u.email, u.role, b.name AS businessName
           FROM shipping_users u
           JOIN shipping_businesses b ON b.id = u.business_id
          WHERE u.email = ?
          LIMIT 1`,
      ).bind(email).first<{ userId: string; businessId: string; email: string; role: string; businessName: string }>();
      if (!user) return json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته." }, 400);
      await verifyShippingOtp(email, otp);
      const credentials = await hashPassword(password);
      const now = Date.now();
      await database().batch([
        database().prepare("UPDATE shipping_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ? AND business_id = ?").bind(credentials.hash, credentials.salt, now, user.userId, user.businessId),
        database().prepare("DELETE FROM shipping_sessions WHERE user_id = ? AND business_id = ?").bind(user.userId, user.businessId),
        database().prepare("DELETE FROM shipping_pending_auth WHERE email = ? AND purpose = 'reset'").bind(email),
      ]);
      const token = await createSession(user.userId, user.businessId);
      return json({ session: sessionPayload({ ...user, tokenHash: "" }) }, 200, sessionCookie(token));
    }

    if (body.action === "resend") {
      const purpose = body.purpose === "reset" ? "reset" : "signup";
      if (!validEmail(email)) return json({ error: "يجب إدخال بريد إلكتروني صحيح." }, 400);
      const pending = await pendingAuth(email, purpose);
      if (!pending || pending.expiresAt < Date.now()) return json({ error: "انتهت صلاحية الطلب. يجب بدء العملية من جديد." }, 400);
      if (Date.now() - pending.sentAt < 60_000) return json({ error: "يجب الانتظار دقيقة واحدة قبل طلب رمز جديد." }, 429);
      await sendShippingOtp(email, purpose === "signup" ? "verify" : "reset", body.themeId);
      await database().prepare("UPDATE shipping_pending_auth SET sent_at = ?, expires_at = ? WHERE email = ? AND purpose = ?").bind(Date.now(), Date.now() + 60 * 60 * 1000, email, purpose).run();
      return json({ sent: true });
    }

    if (body.action === "logout") {
      const session = await readShippingSession(request);
      if (session) await database().prepare("DELETE FROM shipping_sessions WHERE token_hash = ?").bind(session.tokenHash).run();
      return json({ signedOut: true }, 200, clearSessionCookie());
    }

    return json({ error: "العملية المطلوبة غير معروفة." }, 400);
  } catch (error) {
    return json({ error: authErrorMessage(error) }, 500);
  }
}
