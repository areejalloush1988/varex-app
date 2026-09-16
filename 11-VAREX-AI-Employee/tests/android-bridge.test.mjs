import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8');
const schema = await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../drizzle/0010_neat_cerebro.sql', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const mainActivity = await readFile(new URL('../android/app/src/main/java/com/varex/ai/MainActivity.java', import.meta.url), 'utf8');
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

test('server exposes authenticated Android register, poll, result, and disconnect routes', () => {
  for (const route of [
    '/api/devices/android/register',
    '/api/devices/android/disconnect',
    '/api/devices/android/commands',
  ]) assert.match(worker, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(worker, /androidCommandResult/);
  assert.match(worker, /authorizeOrg\(env, user, organizationId, true\)/);
  assert.match(worker, /nativeDeviceApps\.has\(appKey\)/);
  assert.doesNotMatch(worker, /DEVICE_BRIDGE_NOT_READY/);
});

test('Android manifest requests only explicit supported device capabilities', () => {
  for (const permission of ['READ_CONTACTS', 'WRITE_CONTACTS', 'READ_CALENDAR', 'WRITE_CALENDAR', 'CALL_PHONE', 'POST_NOTIFICATIONS', 'FOREGROUND_SERVICE_DATA_SYNC']) {
    assert.match(manifest, new RegExp(`android\\.permission\\.${permission}`));
  }
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|BIND_ACCESSIBILITY_SERVICE|RECORD_AUDIO|READ_CALL_LOG/);
  assert.match(manifest, /usesCleartextTraffic="false"/);
});

test('Android app protects sessions and requires the owner to connect the bridge visibly', () => {
  assert.match(session, /AndroidKeyStore/);
  assert.match(session, /AES\/GCM\/NoPadding/);
  assert.match(session, /setPendingResult/);
  assert.match(mainActivity, /\/devices\/android\/register/);
  assert.match(mainActivity, /requestPermissions/);
  assert.match(bridge, /startForeground/);
  assert.match(bridge, /deliverResult\(pendingResult\)/);
  assert.match(bridge, /\/devices\/android\/commands/);
  assert.match(bridge, /CommandExecutor/);
});

test('VAREX dashboard opens inside the Android app with the native session', () => {
  assert.match(manifest, /\.DashboardActivity/);
  assert.match(mainActivity, /new Intent\(this, DashboardActivity\.class\)/);
  assert.doesNotMatch(mainActivity, /Intent\.ACTION_VIEW, Uri\.parse\(BuildConfig\.DASHBOARD_URL\)/);
  assert.match(dashboardActivity, /loadDataWithBaseURL/);
  assert.match(dashboardActivity, /sessionStorage\.setItem/);
  assert.match(dashboardActivity, /isTrustedDashboard/);
  assert.doesNotMatch(dashboardActivity, /addJavascriptInterface/);
});
