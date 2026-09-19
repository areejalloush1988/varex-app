import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8');
const schema = await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../drizzle/0010_neat_cerebro.sql', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const mainActivity = await readFile(new URL('../android/app/src/main/java/com/varex/ai/MainActivity.java', import.meta.url), 'utf8');
const chatActivity = await readFile(new URL('../android/app/src/main/java/com/varex/ai/ChatActivity.java', import.meta.url), 'utf8');
const dashboardActivity = await readFile(new URL('../android/app/src/main/java/com/varex/ai/DashboardActivity.java', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../android/app/src/main/java/com/varex/ai/bridge/BridgeService.java', import.meta.url), 'utf8');
const session = await readFile(new URL('../android/app/src/main/java/com/varex/ai/storage/SessionStore.java', import.meta.url), 'utf8');

test('native Android commands are durable and claimable by one device', () => {
  assert.match(schema, /deviceId: text\("device_id"\)/);
  assert.match(schema, /claimedAt: text\("claimed_at"\)/);
  assert.match(migration, /ADD `device_id` text/);
  assert.match(migration, /ai_action_executions_device_queue_idx/);
  assert.match(worker, /status='running',device_id=\?,claimed_at=\?/);
  assert.match(worker, /DEVICE_RESULT_TIMEOUT/);
  assert.match(worker, /last_seen_at>=\?/);
  assert.match(worker, /SET status='queued',device_id=\?/);
});

test('server exposes device-neutral register, poll, result, and disconnect routes with Android compatibility aliases', () => {
  for (const route of [
    '/api/devices/register',
    '/api/devices/disconnect',
    '/api/devices/commands',
    '/api/devices/android/register',
    '/api/devices/android/disconnect',
    '/api/devices/android/commands',
  ]) assert.match(worker, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(worker, /deviceCommandResult/);
  assert.match(worker, /authorizeOrg\(env, user, organizationId, true\)/);
  assert.match(worker, /nativeDeviceApps\.has\(appKey\)/);
  assert.match(worker, /nativeDevicePlatforms/);
  assert.doesNotMatch(worker, /platform='android'/);
  assert.doesNotMatch(worker, /VAREX AI Android/);
});

test('phone actions can hand off safely to the current device when no native bridge is online', () => {
  assert.match(worker, /prepareCallHandoff/);
  assert.match(worker, /status='action_required'/);
  assert.match(worker, /call_uri/);
  assert.match(worker, /requires_user_confirmation/);
  assert.match(worker, /DEVICE_CAPABILITY_REQUIRED/);
});

test('Android manifest requests only explicit supported device and voice capabilities', () => {
  for (const permission of ['READ_CONTACTS', 'WRITE_CONTACTS', 'READ_CALENDAR', 'WRITE_CALENDAR', 'CALL_PHONE', 'RECORD_AUDIO', 'POST_NOTIFICATIONS', 'FOREGROUND_SERVICE_DATA_SYNC']) {
    assert.match(manifest, new RegExp(`android\\.permission\\.${permission}`));
  }
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|BIND_ACCESSIBILITY_SERVICE|READ_CALL_LOG/);
  assert.match(manifest, /usesCleartextTraffic="false"/);
});

test('Android app protects sessions and requires the owner to connect the bridge visibly', () => {
  assert.match(session, /AndroidKeyStore/);
  assert.match(session, /AES\/GCM\/NoPadding/);
  assert.match(session, /setPendingResult/);
  assert.match(mainActivity, /\.put\("platform", "android"\)/);
  assert.match(mainActivity, /\/devices\/register/);
  assert.match(mainActivity, /requestPermissions/);
  assert.match(bridge, /startForeground/);
  assert.match(bridge, /deliverResult\(pendingResult\)/);
  assert.match(bridge, /\/devices\/commands/);
  assert.match(bridge, /CommandExecutor/);
});

test('VAREX keeps the employee chat inside the main Android activity', () => {
  assert.doesNotMatch(manifest, /\.ChatActivity/);
  assert.match(mainActivity, /extends ChatActivity/);
  assert.match(mainActivity, /showChatHome\(\)/);
  assert.match(chatActivity, /SpeechRecognizer/);
  assert.match(chatActivity, /MediaPlayer/);
  assert.match(chatActivity, /\/chat\/speech/);
  assert.doesNotMatch(chatActivity, /TextToSpeech/);
  assert.match(chatActivity, /\/chat\/messages/);
  assert.match(chatActivity, /input_mode/);
  assert.doesNotMatch(chatActivity, /model_provider|ChatGPT|Gemini|OpenAI/);
  assert.doesNotMatch(mainActivity, /\/ai\/providers|ChatGPT|Gemini|OpenAI/);
  assert.doesNotMatch(mainActivity, /new Intent\(this, DashboardActivity\.class\)/);
});

test('legacy dashboard remains sandboxed if opened by an older deep link', () => {
  assert.match(manifest, /\.DashboardActivity/);
  assert.doesNotMatch(mainActivity, /Intent\.ACTION_VIEW, Uri\.parse\(BuildConfig\.DASHBOARD_URL\)/);
  assert.match(dashboardActivity, /loadDataWithBaseURL/);
  assert.match(dashboardActivity, /sessionStorage\.setItem/);
  assert.match(dashboardActivity, /isTrustedDashboard/);
  assert.doesNotMatch(dashboardActivity, /addJavascriptInterface/);
});
