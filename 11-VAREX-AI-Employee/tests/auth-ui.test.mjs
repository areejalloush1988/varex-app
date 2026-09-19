import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/legacy-index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

test("signup has password confirmation and no company field", () => {
  assert.match(html, /id="authPasswordConfirm"/);
  assert.doesNotMatch(html, /id="authCompany"/);
  assert.match(client, /authPasswordConfirm/);
});

test("authentication includes password visibility, email verification, and reset", () => {
  assert.match(html, /data-password-toggle="authPassword"/);
  assert.match(html, /id="otpForm"/);
  assert.match(html, /id="forgotPassword"/);
  assert.match(html, /id="resetForm"/);
  assert.match(worker, /route === "verify-email"/);
  assert.match(worker, /route === "forgot-password"/);
  assert.match(worker, /route === "reset-password"/);
});

test("settings provide secure password changes, email reset, and confirmed account deletion", () => {
  assert.match(html, /id="changePasswordForm"/);
  assert.match(html, /id="settingsCurrentPassword"/);
  assert.match(html, /id="settingsNewPassword"/);
  assert.match(html, /id="settingsPasswordReset"/);
  assert.match(html, /id="deleteAccountModal"/);
  assert.match(html, /id="deleteAccountConfirmation"/);
  assert.match(client, /accountRequest\('change-password'/);
  assert.match(client, /accountRequest\('delete-account'/);
  assert.match(worker, /route === "change-password"/);
  assert.match(worker, /route === "delete-account"/);
  assert.match(worker, /حساب المالك محمي ولا يمكن حذفه/);
});

test("password policy requires uppercase, lowercase, and six digits", () => {
  assert.match(worker, /\[A-Z\]/);
  assert.match(worker, /\[a-z\]/);
  assert.match(worker, /match\(\/\\d\/g\).*length >= 6/);
});

test("owner account is free while customer workspaces require a paid or gift activation", () => {
  assert.match(worker, /const developerAccountEmail = "areejalloush1988@gmail\.com"/);
  assert.doesNotMatch(worker, /varexAdminEmails = new Set\(\[.*varexapp@gmail\.com/);
  assert.match(worker, /function subscriptionRequired\(\)/);
  assert.match(worker, /status='active' AND plan_code IN \('gift','solo','team3','team5','team10','unlimited'\)/);
  assert.match(worker, /url\.pathname === "\/api\/admin\/subscriptions"/);
  assert.match(client, /function applySubscriptionGate\(\)/);
  assert.match(client, /DEVELOPER_EMAIL = 'areejalloush1988@gmail\.com'/);
  assert.match(html, /id="developerSubscriptionsPanel"/);
  assert.match(html, /id="subscriptionHistoryBody"/);
  assert.match(html, />الدفع عبر PayPal</);
  assert.doesNotMatch(html, /<h3>تجربة مجانية<\/h3>/);
  assert.doesNotMatch(client, /plan_code: 'trial'/);
});

test("logout uses an in-app confirmation from the right sidebar", () => {
  assert.match(html, /id="logoutButton"/);
  assert.match(html, /id="logoutModal"/);
  assert.match(html, /id="confirmLogout"/);
  assert.doesNotMatch(client, /confirm\('تسجيل الخروج/);
});

test("gift codes are one-time server-side entitlements", () => {
  assert.match(html, /id="activationCodeCard"/);
  assert.match(html, /id="ownerCodeGeneratorCard"/);
  assert.match(html, /مولّد أكواد الدخول المجاني/);
  assert.match(html, /id="generateActivationCode"/);
  assert.match(html, /id="redeemActivationCode"/);
  assert.match(worker, /randomActivationCode/);
  assert.match(worker, /code_hash/);
  assert.match(worker, /WHERE id=\? AND status='active'/);
  assert.match(worker, /plan_code IN \('gift'/);
  assert.match(schema, /aiActivationCodes/);
});

test("PayPal checkout is created and captured on the server", () => {
  assert.match(html, /id="paypalAdminPanel"/);
  assert.match(html, /id="savePayPalCredentials"/);
  assert.match(client, /authorizedRequest\('paypal\/orders'/);
  assert.match(client, /paypal\/orders\/\$\{encodeURIComponent\(orderId\)\}\/capture/);
  assert.match(worker, /\/v2\/checkout\/orders/);
  assert.match(worker, /String\(order\.status\) !== "COMPLETED"/);
  assert.match(worker, /capturedAmount\.value/);
  assert.match(schema, /aiPayments/);
});

test("selected subscription card rises while the other cards move down", () => {
  assert.match(html, /\.plan-grid\.has-selection \.plan-card:not\(\.selected\)\{transform:translateY\(18px\) scale\(\.985\)/);
  assert.match(html, /\.plan-card\.selected\{[^}]*border:3px solid var\(--blue\)[^}]*transform:translateY\(-24px\) scale\(1\.025\)/);
  assert.match(client, /classList\.toggle\('has-selection', Boolean\(card\)\)/);
  assert.doesNotMatch(html, /\.plan-card\.recommended\{/);
});

test("subscription actions use PayPal labels and PayPal yellow", () => {
  assert.match(html, /class="btn choose-plan paypal-button"[^>]*>الدفع عبر PayPal</);
  assert.match(html, /\.paypal-button\{background:#ffc439!important/);
  assert.match(html, /id="addPayment">الدفع عبر PayPal</);
});

test("login sessions are tab-scoped and cleared when leaving the page", () => {
  assert.match(client, /sessionStorage\.setItem\(SESSION_KEY/);
  assert.match(client, /sessionStorage\.getItem\(SESSION_KEY/);
  assert.match(client, /window\.addEventListener\('pagehide'/);
  assert.match(client, /localStorage\.removeItem\(SESSION_KEY\)/);
  assert.doesNotMatch(client, /localStorage\.getItem\(SESSION_KEY/);
});

test("integration screen contains connectable customer channels", () => {
  const integrationSection = html.match(/<section class="view" id="integrations">([\s\S]*?)<\/section>/)?.[1] || "";
  assert.match(integrationSection, /WhatsApp Business/);
  assert.match(integrationSection, /Instagram/);
  assert.match(integrationSection, /Facebook/);
  assert.match(integrationSection, /TikTok/);
  assert.match(integrationSection, /data-provider="whatsapp"/);
  assert.match(integrationSection, /data-provider="facebook"/);
  assert.match(integrationSection, /data-provider="instagram"/);
  assert.match(integrationSection, /data-provider="tiktok"/);
  assert.match(integrationSection, /data-provider="email"/);
  assert.match(integrationSection, /data-provider="youtube"/);
  assert.match(integrationSection, /البريد الإلكتروني/);
  assert.match(integrationSection, /YouTube/);
  assert.doesNotMatch(integrationSection, /موقع الشركة/);
  assert.doesNotMatch(integrationSection, /نظام الصيدليات|نظام العقارات|الكاشير|نظام مخصص|ربط أنظمة VAREX/);
});

test("integration cards use local official-style brand assets without oversized phone artwork", () => {
  const integrationSection = html.match(/<section class="view" id="integrations">([\s\S]*?)<\/section>/)?.[1] || "";
  for (const provider of ["whatsapp", "instagram", "facebook", "tiktok", "email", "youtube"]) {
    assert.match(integrationSection, new RegExp(`/brands/${provider}\\.svg`));
  }
  assert.match(html, /\.brand-logo\{width:24px;height:24px/);
  assert.match(html, /\.network\{width:46px;height:46px;flex:0 0 46px/);
  assert.match(html, /rel="icon" href="\/favicon\.svg\?v=20260916-2"/);
});

test("customer social accounts use tenant-scoped OAuth with encrypted credentials", () => {
  assert.match(client, /\/integrations\/start/);
  assert.match(client, /organization_id: state\.org\.id/);
  assert.match(worker, /authorizeOrg\(env, user, organizationId\)/);
  assert.match(worker, /ai_oauth_states/);
  assert.match(worker, /AES-GCM/);
  assert.match(worker, /connected_by_customer: true/);
  assert.match(worker, /META_LOGIN_CONFIG_ID/);
  assert.match(worker, /metaLoginScopes\(env, provider\)\.join\(","\)/);
  assert.match(worker, /META_FACEBOOK_SCOPES/);
  assert.match(worker, /META_INSTAGRAM_SCOPES/);
  assert.doesNotMatch(worker, /authorizationUrl\.searchParams\.set\("config_id", env\.META_LOGIN_CONFIG_ID/);
  assert.match(worker, /blockedMetaLoginScopes = new Set\(\["pages_manage_engagement", "pages_read_user_content"\]\)/);
  assert.match(worker, /\/api\/integrations\/callback\/meta/);
  assert.match(worker, /\/api\/integrations\/callback\/tiktok/);
  assert.match(worker, /\/api\/integrations\/callback\/google/);
  assert.match(worker, /url\.pathname === "\/api\/integrations\/callback\/tiktok" && request\.method === "GET"\) return integrationCallback\(request, env, "tiktok"\)/);
  assert.match(worker, /\/api\/integrations\/readiness/);
  assert.match(worker, /provider IN \('whatsapp','facebook','instagram','tiktok','email','youtube','parking','website'\)/);
  assert.match(schema, /aiOauthStates/);
});

test("TikTok web OAuth follows the documented web authorization flow", () => {
  assert.match(worker, /https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\//);
  assert.match(worker, /https:\/\/open\.tiktokapis\.com\/v2\/oauth\/token\//);
  assert.match(worker, /tikTokScopes\(env\)\.join\(","\)/);
  assert.match(worker, /tikTokCallbackMode/);
  assert.match(worker, /providerErrorCode = String\(payload\.error && typeof payload\.error === "object"/);
  assert.match(worker, /!\["ok", "0"\]\.includes\(providerErrorCode\)/);
  assert.doesNotMatch(worker, /code_challenge/);
  assert.doesNotMatch(worker, /code_verifier: codeVerifier/);
});

test("WhatsApp uses Meta coexistence without unlinking the Business app", () => {
  assert.match(client, /whatsapp_business_app_onboarding/);
  assert.match(client, /version: 'v4'/);
  assert.doesNotMatch(client, /sessionInfoVersion: '3'/);
  assert.doesNotMatch(client, /setup: \{\}/);
  assert.match(client, /FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING/);
  assert.match(client, /\/integrations\/complete\/meta-sdk/);
  assert.match(worker, /exchangeMetaCode\(request, env, code, true\)/);
  assert.match(worker, /preserves_whatsapp_business_app: true/);
  assert.match(worker, /اختر ربط حساب WhatsApp Business الحالي للمحافظة على الرقم والمحادثات/);
});

test("WhatsApp recovery probes the configured WABA directly when Meta omits it from business edges", () => {
  assert.match(worker, /META_WHATSAPP_SYSTEM_USER_TOKEN/);
  assert.match(worker, /sourceProvider: "system_user"/);
  assert.match(worker, /candidate\.sourceProvider === "system_user"/);
  assert.match(worker, /metaGet\(env, `\$\{businessId\}\?fields=id,name`, accessToken\)\.catch/);
  assert.match(worker, /visible_whatsapp_account_ids/);
  assert.match(worker, /target_account_directly_accessible/);
  assert.match(worker, /read_whatsapp_phone_numbers/);
  assert.doesNotMatch(worker, /if \(!diagnostic\.target_account_visible\) \{ diagnostics\.push\(diagnostic\); continue; \}/);
});

test("WhatsApp prepares Meta before the mobile click and opens signup synchronously in one click", () => {
  assert.match(client, /async function prepareWhatsAppSignup\(\)/);
  assert.match(client, /function launchWhatsAppSignup\(context, button, previousLabel\)/);
  assert.doesNotMatch(client, /async function launchWhatsAppSignup/);
  assert.match(client, /const sdk = window\.FB;/);
  assert.match(client, /launchWhatsAppSignup\(whatsappSignupContext, button, previousLabel\);/);
  assert.doesNotMatch(client, /showIntegrationModal\(provider, 'اضغط الزر أدناه لفتح نافذة ربط WhatsApp الرسمية/);
  assert.match(client, /integrationsViewActive/);
});

test("WhatsApp linking allows one Meta attempt and never reopens the prompt automatically", () => {
  const launch = client.match(/function launchWhatsAppSignup[\s\S]*?\n  function setLoading/)?.[0] || "";
  assert.match(client, /let whatsappSignupInFlight = false;/);
  assert.match(client, /let whatsappSignupAttempt = 0;/);
  assert.match(client, /if \(whatsappSignupInFlight\)/);
  assert.match(client, /if \(callbackReceived \|\| attempt !== whatsappSignupAttempt\) return;/);
  assert.doesNotMatch(launch, /blockedHintTimer/);
  assert.doesNotMatch(launch, /لم تظهر نافذة Meta على هذا الجهاز/);
  assert.doesNotMatch(launch, /void prepareWhatsAppSignup\(\)\.then\(renderIntegrations\)/);
  assert.match(launch, /10 \* 60 \* 1000/);
  assert.match(client, /for \(let attempt = 0; attempt < 150; attempt \+= 1\)/);
});

test("social sign-in keeps VAREX open and returns through a secure popup", () => {
  assert.doesNotMatch(client, /location\.assign\(data\.authorization_url\)/);
  assert.match(client, /window\.open\('', `varex-\$\{provider\}-connection`/);
  assert.match(client, /popup\.location\.replace\(data\.authorization_url\)/);
  assert.match(client, /new BroadcastChannel\('varex-integration'\)/);
  assert.match(client, /VAREX_INTEGRATION_CALLBACK/);
  assert.match(worker, /function integrationPopupResponse/);
  assert.match(worker, /window\.opener\.postMessage\(payload,targetOrigin\)/);
  assert.match(worker, /authorizationUrl\.searchParams\.set\("display", "popup"\)/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(html, /id="integrationModal"/);
  assert.match(html, /id="integrationModalLogo"/);
});

test("integration credentials cannot be written through the generic data API", () => {
  assert.match(worker, /table === "ai_integrations" && method !== "GET"/);
  assert.match(worker, /delete metadata\.credential/);
});

test("Meta publication policy routes are available on VAREX", async () => {
  const privacy = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
  const terms = await readFile(new URL("../public/terms.html", import.meta.url), "utf8");
  const deletion = await readFile(new URL("../public/data-deletion.html", import.meta.url), "utf8");
  assert.match(privacy, /سياسة الخصوصية/);
  assert.match(terms, /شروط الاستخدام/);
  assert.match(deletion, /تعليمات حذف البيانات/);
  assert.match(worker, /\["\/privacy", "\/privacy\.html"\]/);
  assert.match(worker, /\["\/terms", "\/terms\.html"\]/);
  assert.match(worker, /\["\/data-deletion", "\/data-deletion\.html"\]/);
});

test("user-facing Arabic instructions use neutral wording", () => {
  const userFacing = `${html}\n${client}\n${worker}`;
  assert.doesNotMatch(userFacing, /أدخلي|اكتبي|أعيدي|اختاري|استخدمي|أضيفي|حاولي|انتظري|اطلبي|سجّلي|تواصلي|لا تشاركي|ابحثي|لا تملكين/);
});
