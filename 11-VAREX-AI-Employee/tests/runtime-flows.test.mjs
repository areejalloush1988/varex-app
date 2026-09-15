import assert from 'node:assert/strict';
import test from 'node:test';

async function loadWorker(label) {
  const url = new URL('../dist/server/index.js', import.meta.url);
  url.searchParams.set(label, `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(url.href)).default;
}

function statement(first, run, all) {
  return {
    bind(...args) {
      return {
        first: async () => first?.(...args) ?? null,
        run: async () => run?.(...args) ?? { success: true },
        all: async () => all?.(...args) ?? { results: [] },
      };
    },
  };
}

test('signup sends the localized, themed OTP payload to the configured email provider', async () => {
  const worker = await loadWorker('otp-runtime');
  let outbound;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    outbound = JSON.parse(init.body);
    return Response.json({ id: 'email-test-id' }, { status: 200 });
  };
  const env = {
    RESEND_API_KEY: 're_test_key',
    AUTH_EMAIL_FROM: 'VAREX AI <no-reply@varexapp.com>',
    DB: {
      prepare(sql) {
        if (sql.includes('SELECT id FROM ai_users')) return statement(() => null);
        if (sql.includes('SELECT created_at FROM ai_auth_otps')) return statement(() => null);
        if (sql.includes('DELETE FROM ai_auth_otps')) return statement(null, () => ({ success: true }));
        if (sql.includes('INSERT INTO ai_auth_otps')) return statement(null, () => ({ success: true }));
        throw new Error(`Unexpected OTP SQL: ${sql}`);
      },
    },
  };
  try {
    const response = await worker.fetch(new Request('https://varex.test/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'runtime-test@example.com', password: 'Aa123456', locale: 'fr', theme: 'coral', data: { full_name: 'Runtime Test' } }),
    }), env, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).otp_required, true);
    assert.equal(outbound.subject, 'Code de vérification VAREX AI');
    assert.match(outbound.html, /<html lang="fr" dir="ltr">/);
    assert.match(outbound.html, /#7f2d2d/);
    assert.match(outbound.html, /#f9736d/);
    assert.match(outbound.html, />\d{6}</);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('knowledge upload writes the file bytes to R2 before returning a stored database record', async () => {
  const worker = await loadWorker('knowledge-runtime');
  let inserted;
  let objectWrite;
  const env = {
    FILES: {
      async put(key, stream, options) { objectWrite = { key, stream, options }; },
      async delete() { throw new Error('rollback should not run'); },
    },
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'owner@example.com' }));
        if (sql.includes('SELECT role FROM ai_members')) return statement(() => ({ role: 'owner' }));
        if (sql.includes('SELECT * FROM ai_subscriptions WHERE organization_id')) return statement(() => ({ id: 'sub-1', organization_id: 'org-1', plan_code: 'solo', status: 'active', renews_at: null }));
        if (sql.includes('INSERT INTO ai_knowledge_items')) return statement(null, (...args) => { inserted = args; return { success: true }; });
        if (sql.includes('SELECT * FROM ai_knowledge_items')) return statement(id => ({ id, organization_id: 'org-1', title: 'guide.pdf', file_type: 'application/pdf', file_size: 7, storage_path: objectWrite.key, status: 'stored', created_by: 'user-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
        throw new Error(`Unexpected knowledge SQL: ${sql}`);
      },
    },
  };
  const form = new FormData();
  form.set('organization_id', 'org-1');
  form.set('file', new Blob(['%PDF-1.7'], { type: 'application/pdf' }), 'guide.pdf');
  const response = await worker.fetch(new Request('https://varex.test/api/knowledge/upload', { method: 'POST', headers: { authorization: 'Bearer access-token' }, body: form }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 201);
  const [record] = await response.json();
  assert.equal(record.status, 'stored');
  assert.match(objectWrite.key, /^org-1\/[0-9a-f-]+\/guide\.pdf$/);
  assert.equal(objectWrite.options.httpMetadata.contentType, 'application/pdf');
  assert.equal(inserted[3], 'application/pdf');
  assert.equal(inserted[6], 'stored');
});

test('customer workspace data stays locked until a paid subscription is active', async () => {
  const worker = await loadWorker('subscription-gate-runtime');
  const env = {
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'customer@example.com' }));
        if (sql.includes('SELECT role FROM ai_members')) return statement(() => ({ role: 'owner' }));
        if (sql.includes('SELECT * FROM ai_subscriptions WHERE organization_id')) return statement(() => null);
        throw new Error(`Unexpected subscription gate SQL: ${sql}`);
      },
    },
  };
  const response = await worker.fetch(new Request('https://varex.test/api/data/ai_agents?organization_id=eq.org-1', { headers: { authorization: 'Bearer access-token' } }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, 'SUBSCRIPTION_REQUIRED');
});

test('developer account bypasses payment while remaining scoped to its own workspace', async () => {
  const worker = await loadWorker('developer-bypass-runtime');
  const env = {
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'developer-1', email: 'areejalloush1988@gmail.com' }));
        if (sql.includes('SELECT * FROM ai_agents')) return statement(null, null, () => ({ results: [] }));
        throw new Error(`Unexpected developer bypass SQL: ${sql}`);
      },
    },
  };
  const response = await worker.fetch(new Request('https://varex.test/api/data/ai_agents?organization_id=eq.org-1', { headers: { authorization: 'Bearer access-token' } }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test('logout removes only the presented hashed session and returns success', async () => {
  const worker = await loadWorker('logout-runtime');
  let deletedHash = '';
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /DELETE FROM ai_sessions WHERE access_token_hash=/);
        return statement(null, hash => { deletedHash = hash; return { success: true }; });
      },
    },
  };
  const response = await worker.fetch(new Request('https://varex.test/api/auth/logout', { method: 'POST', headers: { authorization: 'Bearer live-session-token' } }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.match(deletedHash, /^[0-9a-f]{64}$/);
  assert.notEqual(deletedHash, 'live-session-token');
});
