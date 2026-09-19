import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const [html, client, commands, worker, schema, migration] = await Promise.all([
  readFile(new URL('public/legacy-index.html', root), 'utf8'),
  readFile(new URL('public/app.js', root), 'utf8'),
  readFile(new URL('public/command-engine.js', root), 'utf8'),
  readFile(new URL('worker/index.ts', root), 'utf8'),
  readFile(new URL('db/schema.ts', root), 'utf8'),
  readFile(new URL('drizzle/0012_lonely_mister_fear.sql', root), 'utf8'),
]);

test('voice central verifies and uses the owner primary number', () => {
  assert.match(html, /رقمك الأساسي الذي سيظهر عند الاتصال/);
  assert.match(html, /id="voiceUseLinkedNumber"/);
  assert.match(html, /id="voiceVerifyNumber"/);
  assert.match(html, /id="voiceValidationCode"/);
  assert.match(client, /voice\/number\/verify/);
  assert.match(client, /voice\/number\/select/);
  assert.match(client, /voice\/number\/status/);
  assert.match(worker, /OutgoingCallerIds\.json/);
  assert.match(worker, /validation_code/);
  assert.match(worker, /From: fromNumber/);
});

test('voice setup explains missing central settings instead of leaving a dead verification button', () => {
  assert.match(html, /id="voiceSetupNotice"/);
  assert.match(client, /openVoiceGatewaySetup/);
  assert.match(client, /voiceGatewayAdmin/);
  assert.doesNotMatch(client, /voiceVerifyNumber'\)\.disabled = disabled \|\| !state\.voiceReadiness\?\.gateway_configured/);
  assert.match(worker, /action: "select" \| "start" \| "status" \| "disconnect"/);
});

test('spoken phone command becomes a guarded AI voice action', () => {
  const context = { window: {} };
  vm.runInNewContext(commands, context);
  const parsed = context.window.VarexCommandEngine.parse('اتصل بزوجي وقله الاجتماع تأجل للساعة خمسة');
  assert.equal(parsed.type, 'phoneCall');
  assert.equal(parsed.target, 'زوجي');
  assert.equal(parsed.instructions, 'الاجتماع تأجل للساعة خمسة');
  assert.match(client, /app_key: 'voice', action_key: 'speak_on_behalf'/);
  assert.match(worker, /mode === "denied"/);
  assert.match(worker, /mode === "approval"/);
  assert.match(worker, /startAiVoiceCall/);
  const goalCall = context.window.VarexCommandEngine.parse('اتصل بزوجي وحدد معه موعد بكرا واسأله عن السعر');
  assert.equal(goalCall.target, 'زوجي');
  assert.equal(goalCall.instructions, 'حدد معه موعد بكرا واسأله عن السعر');
  assert.doesNotMatch(client, /app_key: 'phone', action_key: 'start_call'/);
  assert.match(client, /direct_owner_command: directOwnerVoice/);
  assert.match(worker, /configuredMode === "approval" && directOwnerVoice/);
  assert.match(worker, /mode === "denied"/);
});

test('outbound call is bridged to signed SIP and only a pending call is accepted', () => {
  assert.match(worker, /sip:\$\{gateway\.projectId\}@sip\.api\.openai\.com;transport=tls\?x-varex-call-id=/);
  assert.match(worker, /<Dial answerOnBridge="true" timeout="30" timeLimit=/);
  assert.match(worker, /client\.webhooks\.unwrap/);
  assert.match(worker, /sipHeaderValue\(data\.sip_headers, "x-varex-call-id"\)/);
  assert.match(worker, /WHERE id=\? AND openai_session_id IS NULL/);
  assert.match(worker, /\/v1\/live\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/accept/);
  assert.match(worker, /gpt-live-1/);
});

test('call policy discloses AI identity and blocks unsafe or excessive calling', () => {
  assert.match(html, /المكالمة لا تُسجّل ولا تُفرّغ افتراضياً/);
  assert.match(worker, /ولا تدّعِ أنك إنسان/);
  assert.match(worker, /VOICE_SELF_CALL_BLOCKED/);
  assert.match(worker, /VOICE_OUTSIDE_ALLOWED_HOURS/);
  assert.match(worker, /VOICE_DAILY_LIMIT_REACHED/);
  assert.match(worker, /recording_enabled: false/);
  assert.match(worker, /transcribing_enabled: false/);
  assert.match(worker, /EMERGENCY_STOP/);
  assert.match(worker, /كمحادثة حقيقية تفاعلية/);
  assert.match(worker, /التاريخ والوقت المناسبين والسعر/);
  assert.match(worker, /INSERT INTO ai_messages \(id,organization_id,contact_name,contact_address,channel,direction,body,send_status/);
});

test('voice credentials are admin-only and encrypted', () => {
  assert.match(html, /إعداد سنترال VAREX — خاص بالإدارة/);
  assert.match(client, /adminRequest\('voice-gateway'/);
  assert.match(worker, /isDeveloperAccount\(user\)/);
  assert.match(worker, /voice_gateway_credentials_encrypted/);
  assert.match(worker, /encryptIntegrationCredentials\(env,/);
  assert.doesNotMatch(worker, /return api\(\{[^\n]*authSecret/);
});

test('voice call records have durable isolated storage and protected writes', () => {
  assert.match(schema, /export const aiVoiceCalls = sqliteTable\("ai_voice_calls"/);
  assert.match(migration, /CREATE TABLE `ai_voice_calls`/);
  assert.match(migration, /CREATE UNIQUE INDEX `ai_voice_calls_provider_unique`/);
  assert.match(migration, /CREATE UNIQUE INDEX `ai_voice_calls_execution_unique`/);
  assert.match(worker, /سجل المكالمات يُكتب فقط من سنترال المكالمات/);
  assert.match(worker, /WHERE organization_id=\?/);
});
