import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { createDiagnosticHandler, PROBE_EXPIRES_AT, EXPECTED_MODEL } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-31T22:05:00Z');
const operator = 'sb_secret_operator-fixture-not-real';
const provider = 'sk-provider-fixture-not-real';
const answer = 'مؤشر RSI يقيس زخم حركة السعر ويساعد على تفسير قوة الاتجاه.';
const environment = { SUPABASE_SECRET_KEYS: JSON.stringify({ default: operator }), OPENAI_API_KEY: provider,
  VAREX_ANALYSIS_AI_ENABLED: 'true', OPENAI_MODEL: EXPECTED_MODEL };
const req = ({ token = operator, bearer, body = '{}', query = '', method = 'POST' } = {}) => new Request('https://fixture.supabase.co/functions/v1/private-ai-check' + query, {
  method, headers: { ...(token ? { apikey: token } : {}), ...(bearer ? { authorization: 'Bearer ' + bearer } : {}), 'content-type': 'application/json' },
  ...(method === 'POST' ? { body } : {}),
});
const generated = (text = answer) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
function setup(options = {}) {
  const calls = [];
  let active = 0, maximum = 0;
  const handler = createDiagnosticHandler({ env: name => (options.env || environment)[name],
    now: typeof options.now === 'function' ? options.now : () => options.now ?? now,
    fetch: async (url, init) => {
      calls.push({ url, init }); active++; maximum = Math.max(maximum, active);
      try {
        await Promise.resolve();
        if (options.fetch) return await options.fetch(url, init);
        return Response.json(url.includes('/rpc/') ? true : generated());
      } finally { active--; }
    } });
  return { handler, calls, maximum: () => maximum };
}

test('only exact default secret via apikey can inspect config or contact providers', async () => {
  const fixture = setup();
  for (const request of [req({ token: '' }), req({ token: 'sb_secret_wrong' }), req({ token: '', bearer: operator }), req({ token: 'eyJ.fake.user-token' })]) {
    assert.equal((await fixture.handler(request)).status, 401);
  }
  assert.equal(fixture.calls.length, 0);
  const alternate = setup({ env: { ...environment, SUPABASE_SECRET_KEYS: JSON.stringify({ other: operator }) } });
  assert.equal((await alternate.handler(req())).status, 503);
  assert.equal(alternate.calls.length, 0);
});

test('fixed requests are sequential, at most one AI call per warm isolate, with no user data or quota writes', async () => {
  const fixture = setup();
  const responses = await Promise.all([fixture.handler(req()), fixture.handler(req())]);
  const result = await responses[0].json();
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.maximum(), 1);
  const [rpc, ai] = fixture.calls;
  assert.equal(rpc.url, 'https://eibadfdqzpeigccfdipt.supabase.co/rest/v1/rpc/varex_analysis_usage_ready');
  assert.equal(rpc.init.headers.apikey, operator);
  assert.equal(rpc.init.headers.Authorization, undefined);
  assert.equal(rpc.init.body, '{}');
  assert.equal(ai.url, 'https://api.openai.com/v1/responses');
  assert.equal(ai.init.headers.Authorization, 'Bearer ' + provider);
  for (const call of fixture.calls) {
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.cache, 'no-store');
    assert.equal(call.url.includes(operator) || call.url.includes(provider), false);
  }
  const body = JSON.parse(ai.init.body);
  assert.equal(body.model, EXPECTED_MODEL);
  assert.equal(body.max_output_tokens, 128);
  assert.equal(body.store, false);
  assert.equal(body.input, 'ما معنى مؤشر RSI؟');
  assert.equal(body.tools, undefined);
  assert.equal(body.user, undefined);
  assert.equal(ai.init.body.includes(operator) || ai.init.body.includes(provider), false);
  assert.equal(result.readiness.ready, true);
  assert.equal(result.ai.ok, true);
  assert.equal(result.ai.completed, true);
  assert.equal(result.ai.outputTextItems, 1);
  assert.equal(result.ai.outputTextCharacters, answer.length);
  assert.equal(result.ai.answer, answer);
  assert.equal(result.productionSettingsChanged, false);
  assert.equal(result.quotaWrites, false);
  const text = JSON.stringify(result);
  for (const forbidden of [operator, provider, 'https://', 'Authorization']) assert.equal(text.includes(forbidden), false);
});

test('missing or malformed configuration is reported as booleans without an AI call', async () => {
  const variants = [
    { OPENAI_API_KEY: '' }, { OPENAI_API_KEY: ' key-with-spaces ' }, { VAREX_ANALYSIS_AI_ENABLED: 'TRUE' },
    { VAREX_ANALYSIS_AI_ENABLED: '' }, { OPENAI_MODEL: provider }, { OPENAI_MODEL: EXPECTED_MODEL + ' ' },
  ];
  for (const variant of variants) {
    const fixture = setup({ env: { ...environment, ...variant } });
    const result = await (await fixture.handler(req())).json();
    assert.equal(fixture.calls.length, 1);
    assert.equal(result.ai.attempted, false);
    assert.equal(result.ai.classification, 'ai_configuration_incomplete');
    assert.equal(JSON.stringify(result).includes(provider), false);
  }
});

test('readiness requires HTTP200 and literal true and blocks all AI calls otherwise', async () => {
  for (const [status, payload] of [[200, false], [200, 'true'], [200, { ready: true }], [403, { message: operator }], [500, true]]) {
    const fixture = setup({ fetch: async () => Response.json(payload, { status }) });
    const result = await (await fixture.handler(req())).json();
    assert.equal(fixture.calls.length, 1);
    assert.equal(result.readiness.ready, false);
    assert.equal(result.ai.attempted, false);
    assert.equal(result.ai.classification, 'quota_not_ready');
    assert.equal(JSON.stringify(result).includes(operator), false);
  }
});

test('upstream errors return only allowlisted codes and fixed classifications', async () => {
  for (const [status, code, classification] of [[401, 'invalid_api_key', 'authentication_rejected'], [429, 'insufficient_quota', 'billing_or_quota_unavailable'],
    [429, 'rate_limit_exceeded', 'rate_limited'], [404, 'model_not_found', 'model_unavailable'], [403, 'account_deactivated', 'access_denied'],
    [500, provider, 'provider_unavailable']]) {
    const fixture = setup({ fetch: async url => Response.json(url.includes('/rpc/') ? true : { error: { code, message: operator + provider } }, { status: url.includes('/rpc/') ? 200 : status }) });
    const result = await (await fixture.handler(req())).json();
    assert.equal(result.ai.classification, classification);
    assert.equal(result.ai.ok, false);
    assert.equal(result.ai.providerCode, code === provider ? null : code);
    assert.equal(JSON.stringify(result).includes(provider) || JSON.stringify(result).includes(operator), false);
    assert.equal(fixture.calls.length, 2);
  }
});

test('incomplete and refusal responses are not represented as successful AI answers', async () => {
  for (const payload of [
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ content: [{ type: 'output_text', text: 'جزء من الجواب' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: provider }] }] },
    { status: provider, output: [], error: { code: provider } },
  ]) {
    const fixture = setup({ fetch: async url => Response.json(url.includes('/rpc/') ? true : payload) });
    const result = await (await fixture.handler(req())).json();
    assert.equal(result.ai.ok, false);
    assert.equal(result.ai.answer, undefined);
    assert.equal(JSON.stringify(result).includes(provider), false);
  }
});

test('generated text that includes secrets, links, HTML or excessive length is withheld', async () => {
  for (const text of [provider, operator, 'https://example.invalid', '<script>alert(1)</script>', 'x'.repeat(1001)]) {
    const fixture = setup({ fetch: async url => Response.json(url.includes('/rpc/') ? true : generated(text)) });
    const result = await (await fixture.handler(req())).json();
    assert.equal(result.ai.classification, 'output_withheld');
    assert.equal(result.ai.answer, undefined);
    assert.equal(result.ai.ok, false);
    assert.equal(JSON.stringify(result).includes(provider) || JSON.stringify(result).includes(operator), false);
  }
});

test('caller cannot change prompts, URLs, model, query parameters or body size', async () => {
  const fixture = setup();
  for (const request of [req({ query: '?url=https://attacker.invalid' }), req({ body: '{"question":"other"}' }), req({ body: '[]' }),
    req({ body: 'null' }), req({ body: 'x'.repeat(257) })]) assert.equal((await fixture.handler(request)).status, 400);
  assert.equal((await fixture.handler(req({ method: 'GET' }))).status, 405);
  assert.equal(fixture.calls.length, 0);
});

test('oversized provider bodies and thrown exceptions never leak raw content', async () => {
  for (const behavior of [async () => new Response(provider.repeat(65536)), async () => { throw new Error(operator); }]) {
    const fixture = setup({ fetch: async url => url.includes('/rpc/') ? Response.json(true) : behavior() });
    const result = await (await fixture.handler(req())).json();
    assert.equal(result.ai.classification, 'provider_transport_error');
    assert.equal(result.ai.ok, false);
    assert.equal(JSON.stringify(result).includes(provider) || JSON.stringify(result).includes(operator), false);
  }
});

test('expired or deadline-crossing requests cannot start provider work', async () => {
  const fixed = setup({ now: Date.parse(PROBE_EXPIRES_AT) });
  assert.equal((await fixed.handler(req())).status, 410);
  assert.equal(fixed.calls.length, 0);
  let current = now, calls = 0;
  const handler = createDiagnosticHandler({ env: name => { if (name === 'OPENAI_API_KEY') current = Date.parse(PROBE_EXPIRES_AT); return environment[name]; },
    now: () => current, fetch: async () => { calls++; return Response.json(true); } });
  assert.equal((await handler(req())).status, 410);
  assert.equal(calls, 0);
});

test('expiry between readiness and AI prevents paid call', async () => {
  let current = now;
  const fixture = setup({ now: () => current, fetch: async () => { current = Date.parse(PROBE_EXPIRES_AT); return Response.json(true); } });
  assert.equal((await fixture.handler(req())).status, 410);
  assert.equal(fixture.calls.length, 1);
});

test('deadline settles even when fetch ignores abort', async () => {
  const started = Date.now(), expires = Date.parse(PROBE_EXPIRES_AT);
  const fixture = setup({ now: () => expires - 60 + Date.now() - started, fetch: async () => new Promise(() => {}) });
  assert.equal((await fixture.handler(req())).status, 410);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].init.signal.aborted, true);
});
