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

function voiceDatabase() {
  return {
    prepare(sql) {
      if (sql.includes('SELECT i.id,i.metadata')) return statement(() => null);
      if (sql.includes('SELECT u.* FROM ai_sessions')) return statement(() => ({ id: 'developer-1', email: 'areejalloush1988@gmail.com', full_name: 'مالك الحساب' }));
      if (sql.includes('SELECT role FROM ai_members')) return statement(() => ({ role: 'owner' }));
      if (sql.includes('SELECT id,name,role,objective,instructions,language,tone,status FROM ai_agents')) return statement(() => ({ id: 'agent-1', name: 'الموظف الذكي', role: 'مساعد تنفيذي', objective: '', instructions: '', language: 'ar', tone: 'friendly', status: 'active' }));
      if (sql.includes('SELECT id FROM ai_agents')) return statement(() => ({ id: 'agent-1' }));
      if (sql.includes('SELECT voice_id FROM ai_voice_settings')) return statement(() => ({ voice_id: 'cedar' }));
      if (sql.includes('FROM ai_chat_messages')) return statement(null, null, () => ({ results: [] }));
      throw new Error(`Unexpected voice SQL: ${sql}`);
    },
  };
}

test('live session returns a configured ephemeral realtime token to the browser', async () => {
  const worker = await loadWorker('live-realtime-runtime');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://api.openai.com/v1/realtime/client_secrets');
    const payload = JSON.parse(init.body);
    assert.equal(payload.session.model, 'gpt-realtime-2.1');
    assert.equal(payload.session.audio.output.voice, 'cedar');
    assert.equal(payload.session.audio.input.transcription.model, 'gpt-live-transcribe');
    assert.equal(payload.session.audio.input.turn_detection.eagerness, 'high');
    return Response.json({ value: 'ek_test_ephemeral', expires_at: Math.floor(Date.now() / 1000) + 60 });
  };
  try {
    const response = await worker.fetch(new Request('https://varex.test/api/chat/live/session', {
      method: 'POST',
      headers: { authorization: 'Bearer live-session-token', 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: 'org-1', agent_id: 'agent-1', voice_id: 'cedar' }),
    }), { DB: voiceDatabase(), OPENAI_API_KEY: 'sk-test' }, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.value, 'ek_test_ephemeral');
    assert.equal(payload.voice, 'cedar');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('voice preview uses the saved OpenAI voice and returns playable MP3', async () => {
  const worker = await loadWorker('speech-runtime');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/speech');
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, 'gpt-4o-mini-tts');
    assert.equal(payload.voice, 'cedar');
    assert.equal(payload.response_format, 'mp3');
    return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const response = await worker.fetch(new Request('https://varex.test/api/chat/speech', {
      method: 'POST',
      headers: { authorization: 'Bearer live-session-token', 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: 'org-1', agent_id: 'agent-1', voice: 'ash', text: 'مرحباً' }),
    }), { DB: voiceDatabase(), OPENAI_API_KEY: 'sk-test' }, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('x-varex-voice'), 'cedar');
    assert.equal((await response.arrayBuffer()).byteLength, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
