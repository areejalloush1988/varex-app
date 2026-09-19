import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, client, worker, aiProvider] = await Promise.all([
  readFile(new URL('public/legacy-index.html', root), 'utf8'),
  readFile(new URL('public/app.js', root), 'utf8'),
  readFile(new URL('worker/index.ts', root), 'utf8'),
  readFile(new URL('worker/ai-provider.ts', root), 'utf8'),
]);

test('dashboard uses the compact two-column command and connections layout', () => {
  assert.match(html, /class="dashboard-top-grid"/);
  assert.match(html, /class="dashboard-chat-column"/);
  assert.match(html, /id="dashboardIntegrationGrid"/);
  assert.match(html, /id="dashboardResultsBody"/);
  assert.match(html, /نتائج البحث والتقارير/);
  assert.match(html, /id="websiteSourcesModal"/);
});

test('all four summary cards open real workspace lists', () => {
  for (const kind of ['agents', 'messages', 'leads', 'approvals']) {
    assert.match(html, new RegExp(`data-dashboard-stat="${kind}"`));
  }
  assert.match(client, /function openDashboardStat/);
  assert.match(client, /function dashboardStatRows/);
  assert.match(client, /dashboardStatViewAll/);
});

test('research and task outputs remain visible in the dashboard results table', () => {
  assert.match(client, /function dashboardResultRows/);
  assert.match(client, /dashboardResearchLines/);
  assert.match(client, /metadata\.sources/);
  assert.match(client, /task\.output/);
  assert.match(client, /عرض التفاصيل/);
});

test('website sources are validated, stored per workspace, and supplied to the employee', () => {
  assert.match(worker, /async function websiteSources/);
  assert.match(worker, /provider='website'/);
  assert.match(worker, /normalizeWebsiteSources/);
  assert.match(worker, /\/api\/integrations\/websites/);
  assert.match(client, /authorizedRequest\('integrations\/websites'/);
  assert.match(aiProvider, /trustedWebsites/);
  assert.match(aiProvider, /المواقع التي أضافها المالك كمصادر معتمدة/);
});

test('incoming WhatsApp replies honor permissions and protect sensitive decisions', () => {
  assert.match(worker, /ctx\.waitUntil\(replyToWhatsAppInbound/);
  assert.match(worker, /p\.app_key='whatsapp' AND p\.action_key='reply'/);
  assert.match(worker, /p\.mode IN \('approval','automatic'\)/);
  assert.match(worker, /whatsappReplyNeedsApproval/);
  assert.match(worker, /whatsapp_reply_awaiting_approval/);
  assert.match(worker, /whatsapp_auto_reply_sent/);
  assert.match(aiProvider, /context\.audience === "customer"/);
  assert.match(aiProvider, /if \(!customerMode\) Object\.assign\(requestBody/);
});
