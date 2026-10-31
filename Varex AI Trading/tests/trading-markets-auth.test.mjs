import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const script = readFileSync(new URL('../markets-page.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../trading/markets.html', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function harness(replies, search = '?symbol=BTC-USD&interval=W') {
  const calls = [], redirects = [], mounts = [], listeners = new Map(), target = { innerHTML: '' };
  let destroyed = 0, refreshed = 0, reloads = 0;
  const window = {
    location: { search, origin: 'https://app.varexapp.com', href: 'https://app.varexapp.com/trading/markets.html' + search,
      replace: url => redirects.push(url), reload: () => { reloads++; } },
    history: { replaceState() {} }, addEventListener: (name, handler) => listeners.set(name, handler),
    VarexMarketWorkspace: {
      intervals: ['1', '5', '15', '60', '240', 'D', 'W', 'M'].map(id => ({ id })),
      getMarket: id => ['EURUSD', 'BTC-USD'].includes(id) ? { id, label: id } : null,
      mount: (element, options) => { mounts.push(options); return { destroy: () => destroyed++, refresh: () => refreshed++ }; },
    },
  };
  if (replies !== null) window.varexTradingRequest = async path => {
    calls.push(path);
    const reply = replies[calls.length - 1];
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply?.body ?? null), { status: reply?.status || 200, headers: { 'Content-Type': 'application/json' } });
  };
  const document = { readyState: 'complete', getElementById: id => id === 'publicMarkets' ? target : null };
  vm.runInNewContext(script, { window, document, URL, URLSearchParams });
  return { calls, redirects, mounts, target, listeners, get destroyed() { return destroyed; }, get refreshed() { return refreshed; }, get reloads() { return reloads; } };
}

test('unauthenticated market visitors are sent to signup before any chart or data mount', async () => {
  const h = harness([{ body: null }]); await settle();
  assert.deepEqual(h.calls, ['/api/auth/get-session']); assert.equal(h.mounts.length, 0);
  const url = new URL(h.redirects[0]);
  assert.equal(url.origin, 'https://app.varexapp.com'); assert.equal(url.pathname, '/trading/');
  assert.equal(url.searchParams.get('auth'), 'signup'); assert.equal(url.searchParams.get('next'), 'markets');
  assert.equal(url.searchParams.get('symbol'), 'BTC-USD'); assert.equal(url.searchParams.get('interval'), 'W');
});
test('a cached user object alone cannot open markets without a verified active server profile', async () => {
  for (const reply of [{ status: 401, body: { error: 'expired' } }, { body: { profile: { id: 'u1', status: 'inactive' } } }, { body: {} }]) {
    const h = harness([{ body: { user: { id: 'u1' } } }, reply]); await settle();
    assert.deepEqual(h.calls, ['/api/auth/get-session', '/api/trading?action=access']);
    assert.equal(h.mounts.length, 0); assert.equal(h.redirects.length, 1);
  }
});
test('verified readers mount the requested calendar timeframe without exposing an order action', async () => {
  const h = harness([{ body: { user: { id: 'u1' } } }, { body: { profile: { id: 'u1', status: 'active', canTrade: true } } }]);
  await settle(); assert.equal(h.redirects.length, 0); assert.equal(h.mounts.length, 1);
  assert.equal(h.mounts[0].initialSymbol, 'BTC-USD'); assert.equal(h.mounts[0].interval, 'W');
  assert.equal(h.mounts[0].authenticated, true); assert.equal(h.mounts[0].canTrade, false);
  assert.equal(h.mounts[0].onTrade, undefined);
  h.listeners.get('pagehide')({ persisted: true }); assert.equal(h.destroyed, 0);
  h.listeners.get('pageshow')({ persisted: true }); assert.equal(h.reloads, 1); assert.equal(h.refreshed, 0);
  h.listeners.get('pagehide')({ persisted: false }); assert.equal(h.destroyed, 1);
});
test('missing transport and malformed destination parameters cannot bypass login or create external redirects', async () => {
  const h = harness(null, '?symbol=https://evil.example&interval=javascript:bad&next=https://evil.example');
  await settle(); assert.equal(h.mounts.length, 0);
  const url = new URL(h.redirects[0]); assert.equal(url.origin, 'https://app.varexapp.com');
  assert.equal(url.searchParams.get('symbol'), 'EURUSD'); assert.equal(url.searchParams.get('interval'), '60');
});
test('auth service failure remains closed and offers a registration link', async () => {
  const h = harness([new Error('offline')]); await settle();
  assert.equal(h.mounts.length, 0); assert.match(h.target.innerHTML, /يلزم تسجيل الدخول/);
});
test('the retired standalone market page returns to the guarded assistant without loading the old workspace', () => {
  assert.match(html, /href="\.\/"|new URL\(["']\.\/["'],\s*(?:window\.)?location\.href\)/);
  assert.doesNotMatch(html, /(?:supabase-api|markets-page|market-workspace|app)\.js\?|id="publicMarkets"/);
});
