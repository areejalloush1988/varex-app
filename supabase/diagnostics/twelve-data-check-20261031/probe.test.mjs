import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { createDiagnosticHandler, PROBE_EXPIRES_AT } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-31T21:45:30Z');
const operator = 'sb_secret_operator-fixture-not-real';
const provider = 'provider-fixture-not-real';
const environment = { SUPABASE_SECRET_KEYS: JSON.stringify({ default: operator }), TWELVE_DATA_API_KEY: provider };
const req = ({ token = operator, bearer, body = '{}', query = '', method = 'POST' } = {}) => new Request('https://fixture.supabase.co/functions/v1/probe' + query, {
  method, headers: { ...(token ? { apikey: token } : {}), ...(bearer ? { authorization: 'Bearer ' + bearer } : {}), 'content-type': 'application/json' },
  ...(method === 'POST' ? { body } : {}),
});
const candle = (datetime) => ({ datetime, open: '2001.25', high: '2002.25', low: '2000.25', close: '2001.75' });
const payload = (symbol) => ({ status: 'ok', meta: { symbol, interval: '1min', timezone: 'UTC', exchange_timezone: symbol === 'AAPL' ? 'America/New_York' : 'Australia/Sydney' },
  values: [candle('2026-10-31 21:45:00'), candle('2026-10-31 21:44:00'), candle('2026-10-31 21:43:00')] });
function setup(options = {}) {
  const calls = [];
  let active = 0, maxActive = 0;
  const handler = createDiagnosticHandler({ env: (name) => (options.env || environment)[name], now: () => options.now ?? now,
    fetch: async (url, init) => {
      calls.push({ url, init }); active++; maxActive = Math.max(maxActive, active);
      try {
        await Promise.resolve();
        if (options.fetch) return await options.fetch(url, init);
        const parsed = new URL(url);
        return Response.json(parsed.pathname === '/api_usage' ? { plan_category: 'basic', plan_limit: 8, plan_daily_limit: 800 } : payload(parsed.searchParams.get('symbol')));
      } finally { active--; }
    } });
  return { handler, calls, maxActive: () => maxActive };
}

test('only exact default secret via apikey is authorized; no outbound work on denial', async () => {
  const fixture = setup();
  for (const request of [req({ token: '' }), req({ token: 'sb_secret_wrong' }), req({ token: '', bearer: operator }), req({ token: 'eyJ.fake.user' })]) {
    assert.equal((await fixture.handler(request)).status, 401);
  }
  assert.equal(fixture.calls.length, 0);
  const missingDefault = setup({ env: { ...environment, SUPABASE_SECRET_KEYS: JSON.stringify({ alternate: operator }) } });
  assert.equal((await missingDefault.handler(req())).status, 503);
  assert.equal(missingDefault.calls.length, 0);
});

test('hard expiration fails closed without outbound work', async () => {
  const fixture = setup({ now: Date.parse(PROBE_EXPIRES_AT) });
  assert.equal((await fixture.handler(req())).status, 410);
  assert.equal(fixture.calls.length, 0);
});

test('crossing deadline during authenticated request cannot start provider work', async () => {
  let current = now, calls = 0;
  const handler = createDiagnosticHandler({
    env: name => { if (name === 'TWELVE_DATA_API_KEY') current = Date.parse(PROBE_EXPIRES_AT); return environment[name]; },
    now: () => current,
    fetch: async () => { calls++; return Response.json({}); },
  });
  assert.equal((await handler(req())).status, 410);
  assert.equal(calls, 0);
});

test('in-flight provider request is aborted at hard deadline', async () => {
  const started = Date.now(), expires = Date.parse(PROBE_EXPIRES_AT);
  let calls = 0, aborted = false;
  const handler = createDiagnosticHandler({ env: name => environment[name], now: () => expires - 60 + Date.now() - started,
    fetch: async (_url, init) => {
      calls++;
      return await new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('fixture aborted')); }, { once: true }));
    } });
  assert.equal((await handler(req())).status, 410);
  assert.equal(aborted, true);
  assert.equal(calls, 1);
});

test('fixed request rejects arbitrary bodies, query strings and methods', async () => {
  const fixture = setup();
  for (const request of [req({ body: '{"url":"https://attacker.example"}' }), req({ body: 'null' }), req({ body: '[]' }), req({ body: 'x'.repeat(257) }), req({ query: '?symbol=OTHER' })]) {
    assert.equal((await fixture.handler(request)).status, 400);
  }
  assert.equal((await fixture.handler(req({ method: 'GET' }))).status, 405);
  assert.equal(fixture.calls.length, 0);
});

test('four fixed sequential requests, validated metadata/counts and no price or credential output', async () => {
  const fixture = setup();
  const responses = await Promise.all([fixture.handler(req()), fixture.handler(req())]);
  const result = await responses[0].json();
  assert.equal(fixture.calls.length, 4);
  assert.equal(fixture.maxActive(), 1);
  assert.equal(result.usage.plan_category, 'basic');
  assert.equal(result.usage.plan_limit, 8);
  assert.equal(result.usage.plan_daily_limit, 800);
  assert.deepEqual(result.results.map(r => [r.symbol, r.candleCount, r.closedCandleCount, r.metadataChecked, r.ok]),
    [['XAU/USD', 3, 2, true, true], ['EUR/USD', 3, 2, true, true], ['AAPL', 3, 2, true, true]]);
  assert.equal(result.productionSettingsChanged, false);
  assert.equal(result.licenseVerified, false);
  assert.equal(new URL(fixture.calls[0].url).pathname, '/api_usage');
  for (const { url, init } of fixture.calls) {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.twelvedata.com');
    assert.equal(target.searchParams.has('apikey'), false);
    assert.equal(init.headers.Authorization, 'apikey ' + provider);
    assert.equal(init.redirect, 'error');
    if (target.pathname === '/time_series') {
      assert.equal(target.searchParams.get('interval'), '1min');
      assert.equal(target.searchParams.get('outputsize'), '3');
      assert.equal(target.searchParams.get('timezone'), 'UTC');
    }
  }
  const text = JSON.stringify(result);
  for (const privateValue of [operator, provider, '2001.25', '2002.25', '2000.25', '2001.75', 'message', 'https://']) assert.equal(text.includes(privateValue), false);
});

test('provider errors are reduced to numeric codes and fixed classifications', async () => {
  const fixture = setup({ fetch: async () => Response.json({ status: 'error', code: 403, message: provider + ' raw upstream error', key: operator }) });
  const result = await (await fixture.handler(req())).json();
  assert.equal(result.usage.ok, false);
  assert.equal(result.usage.providerCode, 403);
  for (const item of result.results) {
    assert.equal(item.classification, 'plan_or_permission_restricted');
    assert.equal(item.providerCode, 403);
    assert.equal(item.candleCount, 0);
  }
  assert.equal(JSON.stringify(result).includes(provider), false);
  assert.equal(JSON.stringify(result).includes(operator), false);
});

test('invalid OHLC, metadata, dates and oversized bodies cannot produce candle success', async () => {
  for (const mutation of [p => { p.meta.symbol = 'OTHER'; }, p => { p.meta.timezone = 'America/New_York'; }, p => { p.values[0].high = '0'; }, p => { p.values[0].datetime = '2026-11-31 21:45:00'; }, p => { p.values.push(candle('2026-10-31 21:40:00')); }]) {
    const fixture = setup({ fetch: async (url) => { const p = payload(new URL(url).searchParams.get('symbol')); mutation(p); return Response.json(p); } });
    const result = await (await fixture.handler(req())).json();
    assert.equal(result.results.every(r => !r.ok && r.candleCount === 0), true);
  }
  const huge = setup({ fetch: async () => new Response('x'.repeat(65537)) });
  const result = await (await huge.handler(req())).json();
  assert.equal(result.results.every(r => r.classification === 'provider_transport_error'), true);
});

test('unrecognized plan strings and numeric anomalies are not echoed', async () => {
  const fixture = setup({ fetch: async () => Response.json({ plan_category: provider, plan_limit: -1, plan_daily_limit: 1e30 }) });
  const result = await (await fixture.handler(req())).json();
  assert.deepEqual([result.usage.plan_category, result.usage.plan_limit, result.usage.plan_daily_limit], [null, null, null]);
  assert.equal(JSON.stringify(result).includes(provider), false);
});

test('missing provider key is reported before outbound work', async () => {
  const fixture = setup({ env: { SUPABASE_SECRET_KEYS: environment.SUPABASE_SECRET_KEYS } });
  assert.equal((await fixture.handler(req())).status, 503);
  assert.equal(fixture.calls.length, 0);
});
