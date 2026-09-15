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

test("password policy requires uppercase, lowercase, and six digits", () => {
  assert.match(worker, /\[A-Z\]/);
  assert.match(worker, /\[a-z\]/);
  assert.match(worker, /match\(\/\\d\/g\).*length >= 6/);
});

test("developer account is free while every customer workspace requires a paid activation", () => {
  assert.match(worker, /const developerAccountEmail = "areejalloush1988@gmail\.com"/);
  assert.doesNotMatch(worker, /varexAdminEmails = new Set\(\[.*varexapp@gmail\.com/);
  assert.match(worker, /function subscriptionRequired\(\)/);
  assert.match(worker, /status='active' AND plan_code IN \('solo','team3','team5','team10','unlimited'\)/);
  assert.match(worker, /url\.pathname === "\/api\/admin\/subscriptions"/);
  assert.match(client, /function applySubscriptionGate\(\)/);
  assert.match(client, /DEVELOPER_EMAIL = 'areejalloush1988@gmail\.com'/);
  assert.match(html, /id="developerSubscriptionsPanel"/);
  assert.match(html, /id="subscriptionHistoryBody"/);
  assert.match(html, /إرسال طلب الاشتراك/);
  assert.doesNotMatch(html, /<h3>تجربة مجانية<\/h3>/);
  assert.doesNotMatch(client, /plan_code: 'trial'/);
});

test("integration screen contains communication channels only", () => {
  const integrationSection = html.match(/<section class="view" id="integrations">([\s\S]*?)<\/section>/)?.[1] || "";
  assert.match(integrationSection, /WhatsApp Business/);
  assert.match(integrationSection, /Instagram/);
  assert.match(integrationSection, /Facebook/);
  assert.match(integrationSection, /TikTok/);
  assert.match(integrationSection, /data-provider="whatsapp"/);
  assert.match(integrationSection, /data-provider="facebook"/);
  assert.match(integrationSection, /data-provider="instagram"/);
  assert.match(integrationSection, /data-provider="tiktok"/);
  assert.doesNotMatch(integrationSection, /البريد الإلكتروني|موقع الشركة/);
  assert.doesNotMatch(integrationSection, /نظام الصيدليات|نظام العقارات|الكاشير|نظام مخصص|ربط أنظمة VAREX/);
});

test("integration cards use local official-style brand assets without oversized phone artwork", () => {
  const integrationSection = html.match(/<section class="view" id="integrations">([\s\S]*?)<\/section>/)?.[1] || "";
  for (const provider of ["whatsapp", "instagram", "facebook", "tiktok"]) {
    assert.match(integrationSection, new RegExp(`/brands/${provider}\\.svg`));
  }
  assert.match(html, /\.brand-logo\{width:24px;height:24px/);
  assert.match(html, /\.network\{width:46px;height:46px;flex:0 0 46px/);
  assert.match(html, /rel="icon" href="\/favicon\.svg"/);
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
  assert.match(worker, /url\.pathname === "\/api\/integrations\/callback\/tiktok" && request\.method === "GET"\) return integrationCallback\(request, env, "tiktok"\)/);
  assert.match(worker, /\/api\/integrations\/readiness/);
  assert.match(worker, /provider IN \('whatsapp','facebook','instagram','tiktok'\)/);
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
