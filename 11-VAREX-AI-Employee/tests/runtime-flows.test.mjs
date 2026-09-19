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

async function passwordHash(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(value => Number.parseInt(value, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return Buffer.from(bits).toString('hex');
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

test('changing a password verifies the current password and revokes every session', async () => {
  const worker = await loadWorker('change-password-runtime');
  const oldSalt = '00112233445566778899aabbccddeeff';
  const oldHash = await passwordHash('Old123456', oldSalt);
  let updated = [];
  let revokedUser = '';
  const env = {
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'customer@example.com', password_salt: oldSalt, password_hash: oldHash }));
        if (sql.startsWith('UPDATE ai_users SET password_hash')) return statement(null, (...args) => { updated = args; return { success: true }; });
        if (sql.startsWith('DELETE FROM ai_sessions WHERE user_id')) return statement(null, userId => { revokedUser = userId; return { success: true }; });
        throw new Error(`Unexpected password SQL: ${sql}`);
      },
    },
  };
  const response = await worker.fetch(new Request('https://varex.test/api/auth/change-password', {
    method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' },
    body: JSON.stringify({ current_password: 'Old123456', new_password: 'New654321' }),
  }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(revokedUser, 'user-1');
  assert.equal(updated[3], 'user-1');
  assert.equal(updated[0], await passwordHash('New654321', updated[1]));
});

test('account deletion removes owned workspace data and keeps the developer account protected', async () => {
  const worker = await loadWorker('delete-account-runtime');
  const salt = 'ffeeddccbbaa99887766554433221100';
  const hash = await passwordHash('Delete123456', salt);
  const deletedObjects = [];
  const preparedDeletes = [];
  let batchSize = 0;
  const customerEnv = {
    FILES: { async delete(path) { deletedObjects.push(path); } },
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'customer@example.com', password_salt: salt, password_hash: hash }));
        if (sql === 'SELECT id FROM ai_organizations WHERE owner_id=?') return statement(null, null, () => ({ results: [{ id: 'org-1' }] }));
        if (sql.startsWith('SELECT storage_path FROM ai_knowledge_items')) return statement(null, null, () => ({ results: [{ storage_path: 'org-1/file.pdf' }] }));
        if (sql.startsWith('DELETE FROM')) { preparedDeletes.push(sql); return statement(); }
        throw new Error(`Unexpected deletion SQL: ${sql}`);
      },
      async batch(statements) { batchSize = statements.length; return []; },
    },
  };
  const deleted = await worker.fetch(new Request('https://varex.test/api/auth/delete-account', {
    method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' },
    body: JSON.stringify({ current_password: 'Delete123456', confirmation: 'DELETE_ACCOUNT' }),
  }), customerEnv, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted, true);
  assert.deepEqual(deletedObjects, ['org-1/file.pdf']);
  assert.ok(batchSize >= 20);
  assert.ok(preparedDeletes.some(sql => sql === 'DELETE FROM ai_users WHERE id=?'));

  const ownerEnv = { DB: { prepare(sql) { if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'developer-1', email: 'areejalloush1988@gmail.com' })); throw new Error(`Unexpected owner SQL: ${sql}`); } } };
  const protectedResponse = await worker.fetch(new Request('https://varex.test/api/auth/delete-account', {
    method: 'POST', headers: { authorization: 'Bearer owner-token', 'content-type': 'application/json' }, body: '{}',
  }), ownerEnv, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(protectedResponse.status, 403);
  assert.match((await protectedResponse.json()).message, /حساب المالك محمي/);
});

test('a one-time gift code activates the customer workspace without storing the plain code', async () => {
  const worker = await loadWorker('gift-code-runtime');
  let lookedUpHash = '';
  let batchSize = 0;
  const env = {
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'friend@example.com' }));
        if (sql.includes('SELECT role FROM ai_members')) return statement(() => ({ role: 'owner' }));
        if (sql.includes('SELECT * FROM ai_activation_codes WHERE code_hash')) return statement(hash => { lookedUpHash = hash; return { id: 'code-1', status: 'active' }; });
        if (sql.includes("UPDATE ai_activation_codes SET status='redeemed'")) return statement(null, () => ({ success: true, meta: { changes: 1 } }));
        if (sql.includes('UPDATE ai_subscriptions') || sql.includes('INSERT INTO ai_subscriptions') || sql.includes('UPDATE ai_organizations') || sql.includes('INSERT INTO ai_audit_logs')) return statement();
        if (sql.includes('SELECT * FROM ai_subscriptions WHERE id')) return statement(id => ({ id, organization_id: 'org-1', plan_code: 'gift', status: 'active', renews_at: null }));
        throw new Error(`Unexpected gift-code SQL: ${sql}`);
      },
      async batch(statements) { batchSize = statements.length; return []; },
    },
  };
  const response = await worker.fetch(new Request('https://varex.test/api/activation-codes/redeem', {
    method: 'POST', headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' },
    body: JSON.stringify({ organization_id: 'org-1', code: 'VAREX-FREE-ABCD-EFGH-JKLM' }),
  }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).subscription.plan_code, 'gift');
  assert.match(lookedUpHash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(lookedUpHash, /VAREX/i);
  assert.equal(batchSize, 4);
});

test('PayPal capture activates only after a completed server-verified payment', async () => {
  const worker = await loadWorker('paypal-capture-runtime');
  const originalFetch = globalThis.fetch;
  const providerCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    providerCalls.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'paypal-access-token' });
    return Response.json({
      id: 'PAYPAL-ORDER-1', status: 'COMPLETED', payer: { email_address: 'payer@example.com' },
      purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { value: '244.79', currency_code: 'USD' } }] } }],
    });
  };
  let batchSize = 0;
  const env = {
    PAYPAL_CLIENT_ID: 'client-id-value-long-enough', PAYPAL_CLIENT_SECRET: 'client-secret-value-long-enough', PAYPAL_ENV: 'live',
    DB: {
      prepare(sql) {
        if (sql.includes('JOIN ai_users')) return statement(() => ({ id: 'user-1', email: 'customer@example.com' }));
        if (sql.includes("FROM ai_payments WHERE provider='paypal'")) return statement(() => ({ id: 'payment-1', organization_id: 'org-1', plan_code: 'solo', amount: '244.79', currency: 'USD', status: 'created' }));
        if (sql.includes('SELECT role FROM ai_members')) return statement(() => ({ role: 'owner' }));
        if (sql.includes('UPDATE ai_subscriptions') || sql.includes('INSERT INTO ai_subscriptions') || sql.includes('UPDATE ai_payments') || sql.includes('UPDATE ai_organizations') || sql.includes('INSERT INTO ai_audit_logs')) return statement();
        if (sql.includes('SELECT * FROM ai_subscriptions WHERE id')) return statement(id => ({ id, organization_id: 'org-1', plan_code: 'solo', status: 'active' }));
        throw new Error(`Unexpected PayPal SQL: ${sql}`);
      },
      async batch(statements) { batchSize = statements.length; return []; },
    },
  };
  try {
    const response = await worker.fetch(new Request('https://varex.test/api/paypal/orders/PAYPAL-ORDER-1/capture', { method: 'POST', headers: { authorization: 'Bearer access-token' } }), env, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).subscription.status, 'active');
    assert.equal(providerCalls[0].url, 'https://api-m.paypal.com/v1/oauth2/token');
    assert.equal(providerCalls[1].url, 'https://api-m.paypal.com/v2/checkout/orders/PAYPAL-ORDER-1/capture');
    assert.equal(batchSize, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
