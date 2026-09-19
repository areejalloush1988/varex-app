import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const [html, client, worker, commands, migration] = await Promise.all([
  readFile(new URL('public/legacy-index.html', root), 'utf8'),
  readFile(new URL('public/app.js', root), 'utf8'),
  readFile(new URL('worker/index.ts', root), 'utf8'),
  readFile(new URL('public/command-engine.js', root), 'utf8'),
  readFile(new URL('drizzle/0007_complex_dust.sql', root), 'utf8')
]);

test('permission center exposes granular owner-controlled modes and emergency stop', () => {
  assert.match(html, /id="permissions"/);
  assert.match(html, /ممنوع/);
  assert.match(client, /data-mode="approval"/);
  assert.match(client, /data-mode="automatic"/);
  assert.match(worker, /\/api\/permissions\/emergency-stop/);
  assert.match(worker, /agent_emergency_stopped/);
});

test('every permission card exposes a real connection action', () => {
  assert.match(client, /data-permission-connect/);
  assert.match(client, /permissionConnectionLabel/);
  assert.match(client, /disconnectIntegration/);
  assert.match(client, /connectNativeDevice/);
  assert.match(client, /devices\/disconnect/);
  assert.match(html, /data-provider="email"/);
  assert.match(html, /data-provider="youtube"/);
  assert.match(worker, /\/api\/integrations\/disconnect/);
  assert.match(worker, /\/api\/integrations\/callback\/google/);
  assert.match(worker, /googleScopes\("email"\)/);
  assert.match(worker, /googleScopes\("youtube"\)/);
});

test('web phone handoff stays truthful and device-neutral', () => {
  assert.match(client, /callUriForExecution/);
  assert.match(client, /بدء الاتصال الآن/);
  assert.match(client, /\^tel:/);
  assert.match(client, /device\.online === false/);
  assert.doesNotMatch(client, /استخدم تطبيق Android/);
});

test('parking setup remains truthful until its provider interface is active', () => {
  assert.match(html, /id="parkingConnectionModal"/);
  assert.match(client, /openParkingConnection/);
  assert.match(worker, /parking_connection_setup_saved/);
  assert.match(worker, /status: "action_required"/);
  assert.match(html, /لا ينفّذ جلسة أو دفعاً تلقائياً/);
});

test('permission and execution records have durable database tables', () => {
  for (const table of ['ai_device_connections', 'ai_agent_permissions', 'ai_action_executions', 'ai_voice_settings']) {
    assert.match(migration, new RegExp('CREATE TABLE `' + table + '`'));
  }
  assert.match(worker, /سجل التنفيذ يُكتب فقط من محرك التنفيذ/);
});

test('Arabic WhatsApp and phone commands resolve recipient and message', () => {
  const context = { window: {} };
  vm.runInNewContext(commands, context);
  const parse = context.window.VarexCommandEngine.parse;
  assert.deepEqual(
    { ...parse('يبعت رسالة لابو كرم على الواتساب | مرحبا أبو كرم') },
    { type: 'whatsappSend', raw: 'يبعت رسالة لابو كرم على الواتساب | مرحبا أبو كرم', target: 'ابو كرم', message: 'مرحبا أبو كرم' }
  );
  const call = parse('اتصل على أبو كرم | اسأله عن الموعد');
  assert.equal(call.type, 'phoneCall');
  assert.equal(call.target, 'أبو كرم');
  assert.equal(call.instructions, 'اسأله عن الموعد');
  const alarm = parse('اضبط منبه الساعة 7 صباحاً');
  assert.equal(alarm.type, 'agentAction');
  assert.equal(alarm.appKey, 'alarms');
  assert.equal(alarm.actionKey, 'create');
  const parking = parse('مدد الباركينج ساعة');
  assert.equal(parking.appKey, 'parking');
  assert.equal(parking.actionKey, 'extend');
});

test('WhatsApp execution goes through permission checks and the real provider', () => {
  assert.match(worker, /mode === "denied"/);
  assert.match(worker, /mode === "approval"/);
  assert.match(worker, /deliverWhatsAppText\(env,/);
  assert.match(worker, /CONTACT_NUMBER_REQUIRED/);
  assert.match(client, /actions\/execute/);
});

test('linked social accounts expose guarded real publishing actions', () => {
  for (const app of ['facebook', 'instagram', 'tiktok']) assert.match(worker, new RegExp(`${app}: \\{ label:`));
  assert.match(worker, /executeFacebookAction/);
  assert.match(worker, /\/feed/);
  assert.match(worker, /executeInstagramAction/);
  assert.match(worker, /media_publish/);
  assert.match(worker, /executeTikTokAction/);
  assert.match(worker, /post\/publish\/video\/init/);
  assert.match(worker, /TIKTOK_PUBLISH_PERMISSION_REQUIRED/);
  assert.match(client, /publish_video/);
});
