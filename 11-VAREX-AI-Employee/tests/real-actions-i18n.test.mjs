import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/legacy-index.html', root), 'utf8');
const client = await readFile(new URL('public/app.js', root), 'utf8');
const worker = await readFile(new URL('worker/index.ts', root), 'utf8');
const commandSource = await readFile(new URL('public/command-engine.js', root), 'utf8');

const localeCodes = ['ar', 'en', 'ur', 'fa', 'zh', 'ko', 'it', 'es', 'he', 'fr', 'ru', 'tr'];
const localePayloads = new Map();
for (const code of localeCodes) {
  localePayloads.set(code, JSON.parse(await readFile(new URL(`public/locales/${code}.json`, root), 'utf8')));
}

test('ships twelve complete first-party locale files with correct writing direction', () => {
  const rtl = new Set(['ar', 'ur', 'fa', 'he']);
  const englishKeys = Object.keys(localePayloads.get('en').strings).sort();
  assert.equal(englishKeys.length, 151);
  for (const code of localeCodes) {
    const payload = localePayloads.get(code);
    assert.equal(payload.code, code);
    assert.equal(payload.dir, rtl.has(code) ? 'rtl' : 'ltr');
    assert.deepEqual(Object.keys(payload.strings).sort(), englishKeys, `${code} must translate every interface key`);
    assert.doesNotMatch(JSON.stringify(payload), /translate\.google|googletrans|goog-translate/i);
  }
});

test('recognizes real command verbs in all twelve supported languages', () => {
  const context = { window: {} };
  vm.runInNewContext(commandSource, context);
  const parse = context.window.VarexCommandEngine.parse;
  const commands = {
    ar: 'أضف موظف: Sami | مبيعات', en: 'add employee: Sami | Sales', ur: 'ملازم شامل کریں: Sami | سیلز',
    fa: 'افزودن کارمند: Sami | فروش', zh: '添加员工: Sami | 销售', ko: '직원 추가: Sami | 영업',
    it: 'aggiungi dipendente: Sami | Vendite', es: 'añadir empleado: Sami | Ventas', he: 'הוסף עובד: Sami | מכירות',
    fr: 'ajouter un employé : Sami | Ventes', ru: 'добавить сотрудника: Sami | Продажи', tr: 'çalışan ekle: Sami | Satış'
  };
  for (const [code, command] of Object.entries(commands)) {
    const result = parse(command);
    assert.equal(result.type, 'addAgent', `${code} employee command`);
    assert.equal(result.name, 'Sami');
    assert.ok(result.role);
  }
  assert.equal(parse('طباعة').type, 'print');
  assert.deepEqual({ ...parse('انسخ: نص حقيقي') }, { type: 'copy', raw: 'انسخ: نص حقيقي', text: 'نص حقيقي' });
  assert.equal(parse('لصق').type, 'paste');
  assert.equal(parse('افحص البوابات').type, 'integrations');
  assert.equal(parse('أمر غير موجود').type, 'unsupported');
});

test('command center executes supported actions and explicitly rejects unsupported input', () => {
  assert.match(html, /id="commandForm"/);
  assert.match(html, /id="commandResult"[^>]+aria-live="polite"/);
  assert.match(client, /window\.VarexCommandEngine\.parse\(value\)/);
  assert.match(client, /rest\('ai_agents', \{ method: 'POST'/);
  assert.match(client, /rest\('ai_leads', \{ method: 'POST'/);
  assert.match(client, /window\.print\(\)/);
  assert.match(client, /navigator\.clipboard\?\.writeText/);
  assert.match(client, /navigator\.clipboard\?\.readText/);
  assert.match(client, /command\.unsupported/);
});

test('appearance catalog has all approved colors and is shared with OTP email branding', () => {
  const expected = ['navy', 'emerald', 'cyan', 'mauve', 'terracotta', 'burnt-orange', 'red', 'royal-blue', 'indigo', 'coffee', 'graphite', 'steel-blue', 'plum', 'gray', 'fuchsia', 'coral'];
  for (const code of expected) {
    assert.match(client, new RegExp(`['"]?${code.replace('-', '\\-')}['"]?\\s*:`));
    assert.match(worker, new RegExp(`['"]?${code.replace('-', '\\-')}['"]?\\s*:`));
  }
  assert.match(client, /ui_theme: activeTheme/);
  assert.match(client, /theme: activeTheme/);
  assert.match(worker, /emailThemes\[themeCode\(themeValue\)\]/);
  assert.match(worker, /border-bottom:5px solid \$\{theme\.accent\}/);
});

test('OTP, login, reset, and logout use real server-side flows', () => {
  assert.match(client, /authRequest\('signup', \{ email, password, locale: currentLocale\(\), theme: activeTheme/);
  assert.match(client, /authRequest\('forgot-password', \{ email: pendingAuthEmail, locale: currentLocale\(\), theme: activeTheme/);
  assert.match(worker, /fetch\("https:\/\/api\.resend\.com\/emails"/);
  assert.match(worker, /expiresAt = new Date\(Date\.now\(\) \+ 600000\)/);
  assert.match(worker, /Number\(record\.attempts \|\| 0\) >= 5/);
  assert.match(worker, /DELETE FROM ai_sessions WHERE access_token_hash=/);
  assert.match(worker, /DELETE FROM ai_sessions WHERE user_id=/);
  assert.match(client, /saveSession\(null\); location\.reload\(\)/);
});

test('knowledge files and WhatsApp messages take real provider or storage paths', () => {
  assert.match(worker, /env\.FILES\.put\(storagePath, candidate\.stream\(\)/);
  assert.match(worker, /env\.FILES\.get\(storagePath\)/);
  assert.match(worker, /ai_knowledge_items" && method !== "GET"/);
  assert.match(client, /new FormData\(\)/);
  assert.match(client, /\/knowledge\/upload/);
  assert.match(client, /\/integrations\/whatsapp\/send/);
  assert.match(client, /whatsappConnected/);
  assert.match(client, /send_status: 'draft'/);
  assert.match(client, /inbox\.draftSaved/);
});

test('demo records and retired fake handlers are absent from the active application shell', () => {
  assert.doesNotMatch(html, /Jason AI|سارة حمدان|مدى العقارية|شركة ترحال|صيدلية الحياة/);
  assert.doesNotMatch(html, /type="text\/plain"/);
  assert.doesNotMatch(html, /\+18%|1,240|محادثة عرض|محفوظ في المعاينة/);
  assert.match(html, /id="reportMessages">0</);
  assert.match(html, /id="chatItems"><\/div>/);
});

test('organization gates prevent member self-promotion and protect provider credentials', () => {
  assert.match(worker, /إضافة أعضاء الفريق تحتاج مسار دعوة إدارياً آمناً/);
  assert.match(worker, /table === "ai_members"\)\) return error/);
  assert.match(worker, /table === "ai_integrations" && method !== "GET"/);
  assert.match(worker, /delete metadata\.credential/);
  assert.match(worker, /authorizeOrg\(env, user, organizationId\)/);
});
