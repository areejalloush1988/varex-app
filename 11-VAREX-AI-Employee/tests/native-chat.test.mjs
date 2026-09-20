import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [worker, parser, aiProvider, client, html, serviceWorker, schema, migration, nameMigration, activity, layout] = await Promise.all([
  readFile(new URL('worker/index.ts', root), 'utf8'),
  readFile(new URL('worker/chat-command.ts', root), 'utf8'),
  readFile(new URL('worker/ai-provider.ts', root), 'utf8'),
  readFile(new URL('public/app.js', root), 'utf8'),
  readFile(new URL('public/legacy-index.html', root), 'utf8'),
  readFile(new URL('public/sw.js', root), 'utf8'),
  readFile(new URL('db/schema.ts', root), 'utf8'),
  readFile(new URL('drizzle/0011_romantic_centennial.sql', root), 'utf8'),
  readFile(new URL('drizzle/0013_remove_legacy_lina_names.sql', root), 'utf8'),
  readFile(new URL('android/app/src/main/java/com/varex/ai/ChatActivity.java', root), 'utf8'),
  readFile(new URL('android/app/src/main/res/layout/activity_chat.xml', root), 'utf8'),
]);

test('chat history is durable and linked to action executions', () => {
  assert.match(schema, /aiChatMessages/);
  assert.match(migration, /CREATE TABLE `ai_chat_messages`/);
  assert.match(migration, /ai_chat_messages_thread_idx/);
  assert.match(worker, /\/api\/chat\/messages/);
  assert.match(worker, /action_execution_id/);
  assert.match(worker, /awaiting_approval/);
});

test('Arabic chat interpreter covers reports, AI calls, and supported native actions', () => {
  for (const value of ['whatsapp', 'voice', 'alarms', 'calendar', 'contacts', 'settings']) assert.match(parser, new RegExp(`appKey: "${value}"`));
  assert.match(parser, /kind: "report"/);
  assert.match(parser, /continuePendingIntent/);
  assert.match(parser, /digits\.startsWith\("00"\)/);
  assert.match(parser, /defaultCountryCode \+ digits\.slice\(1\)/);
});

test('native chat has text, microphone, branded voice controls, inline approvals, and polling', () => {
  for (const id of ['chatInput', 'chatMicButton', 'chatSendButton', 'voiceToggleButton', 'agentSpinner', 'chatVoiceSpinner', 'chatMessagesContainer']) assert.match(layout, new RegExp(`@\\+id/${id}`));
  assert.doesNotMatch(layout, /chatProviderSpinner/);
  assert.match(activity, /RecognizerIntent\.ACTION_RECOGNIZE_SPEECH/);
  assert.match(activity, /api\.postBytes\("\/chat\/speech"/);
  assert.match(activity, /new MediaPlayer\(\)/);
  assert.doesNotMatch(activity, /TextToSpeech/);
  assert.doesNotMatch(activity, /model_provider|ChatGPT|Gemini/);
  assert.match(activity, /موافقة وتنفيذ/);
  assert.match(activity, /REFRESH_INTERVAL_MS/);
});

test('each employee keeps a selectable saved conversation voice', () => {
  assert.match(html, /id="employeeVoiceModal"/);
  assert.match(html, /id="employeeChatVoicePicker"/);
  assert.match(client, /employeeVoiceCatalog/);
  assert.match(client, /authorizedRequest\('chat\/voice'/);
  assert.match(worker, /async function employeeVoicePreference/);
  assert.match(worker, /agent_chat_voice_updated/);
  assert.match(worker, /https:\/\/api\.openai\.com\/v1\/audio\/speech/);
  assert.match(worker, /gpt-4o-mini-tts/);
  assert.doesNotMatch(worker, /generateGeminiSpeech\(credential\.key, text/);
  assert.match(activity, /VOICE_IDS/);
  assert.match(activity, /api\.put\("\/chat\/voice"/);
});

test('the server connects ChatGPT and Gemini without exposing keys to the device', () => {
  assert.match(worker, /\/api\/ai\/providers/);
  assert.match(worker, /encryptIntegrationCredentials/);
  assert.match(aiProvider, /gpt-6-astra/);
  assert.match(aiProvider, /gpt-5\.6-sol/);
  assert.match(aiProvider, /gemini-3\.6-flash/);
  assert.match(aiProvider, /gemini-3\.5-flash-lite/);
  assert.match(aiProvider, /gemini-2\.5-flash-preview-tts/);
  assert.match(worker, /\/api\/chat\/speech/);
});

test('the employee behaves conversationally, searches the web, and prepares recipient-ready messages', () => {
  assert.match(aiProvider, /type: "web_search"/);
  assert.match(aiProvider, /search_context_size: "high"/);
  assert.match(aiProvider, /return_token_budget: "unlimited"/);
  assert.match(aiProvider, /reasoning: \{ effort: customerMode \|\| casualGreeting \? "low" : deepResearch \? "xhigh" : "high" \}/);
  assert.match(aiProvider, /function isCasualGreeting/);
  assert.match(aiProvider, /include: \["web_search_call\.action\.sources"\]/);
  assert.match(aiProvider, /افصل دائماً بين تعليمات المالك وبين النص النهائي للمستلم/);
  assert.match(aiProvider, /userName\?: string/);
  assert.match(aiProvider, /لا تبدأ المحادثة بتعريف نفسك/);
  assert.match(worker, /userName: chatDisplayName\(user\)/);
  assert.doesNotMatch(worker, /function chatHelp/);
  assert.match(worker, /function isLegacyCannedChatReply/);
  assert.match(client, /employeeChatThinking/);
  assert.match(client, /employee-chat-typing/);
  assert.doesNotMatch(client, /أنا موظفك الذكي/);
  assert.doesNotMatch(activity, /احكي معي بطريقتك/);
  assert.match(aiProvider, /target=أبو كرم/);
  assert.match(aiProvider, /verifyAiProviderCredential/);
  assert.match(client, /renderChatSources/);
  assert.match(client, /VAREX AI/);
});

test('provider outages are truthful and never fall through to blind automatic execution', () => {
  const unavailableBranch = worker.indexOf('intelligent.error === "AI_PROVIDER_UNAVAILABLE"');
  const actionBranch = worker.indexOf('intent.kind === "action"', unavailableBranch);
  assert.ok(unavailableBranch > 0 && actionBranch > unavailableBranch);
  assert.doesNotMatch(worker, /provider_fallback: true/);
  assert.match(worker, /NO_CREDITS/);
  assert.match(worker, /QUOTA_EXHAUSTED/);
  assert.match(worker, /المحادثة الذكية متوقفة حالياً/);
  assert.ok(worker.includes('ai\\.dev\\/rate-limit'));
  assert.match(client, /تعذر تحميل المحادثة مؤقتاً/);
  assert.doesNotMatch(client, /الموظف يفكر ويختار إن كان المطلوب جواباً أو تنفيذاً/);
  assert.doesNotMatch(html, />جاهز للمحادثة\.<\/div>/);
  assert.doesNotMatch(activity, /الموظف عم يفهم الطلب/);
});

test('updated chat assets replace stale installed-app code before using the offline cache', () => {
  assert.match(html, /app\.js\?v=20260920-69/);
  assert.match(serviceWorker, /varex-ai-shell-v69/);
  assert.ok(serviceWorker.indexOf('const response = await fetch(request)') < serviceWorker.indexOf('await cache.match(request)'));
});

test('live talk is low-latency, interruptible, named by the user, and durable', () => {
  for (const id of ['employeeLiveBar', 'employeeLiveStart', 'employeeLiveStop', 'employeeLiveMute', 'employeeLiveAudio']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(client, /new RTCPeerConnection\(\)/);
  assert.match(client, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(client, /createDataChannel\('oai-events'\)/);
  assert.match(client, /chat\/live\/session/);
  assert.match(client, /chat\/live\/message/);
  assert.match(client, /chat\/identity/);
  assert.match(worker, /gpt-realtime-2\.1/);
  assert.match(worker, /\/v1\/realtime\/client_secrets/);
  assert.match(worker, /"Content-Type": "application\/sdp"/);
  assert.match(client, /type: 'response\.create'/);
  assert.match(client, /ابدأ الحديث الآن فوراً/);
  assert.match(worker, /type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true/);
  assert.match(worker, /save_employee_name/);
  assert.match(worker, /agent_name_updated/);
  assert.match(worker, /\/api\/chat\/live\/session/);
  assert.match(worker, /\/api\/chat\/live\/message/);
  assert.match(worker, /\/api\/chat\/identity/);
  assert.doesNotMatch(`${html}\n${client}\n${worker}\n${aiProvider}`, /Lina AI|Lina|لينا|أنا مساعدتك/i);
  assert.match(nameMigration, /UPDATE `ai_agents`/);
  assert.match(nameMigration, /'الموظف الذكي'/);
});

test('the live picker exposes every realtime voice currently supported by the API', () => {
  const voiceIds = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  for (const voice of voiceIds) {
    assert.match(client, new RegExp(`id: '${voice}'`));
    assert.match(worker, new RegExp(`"${voice}"`));
  }
});

test('customer chat uses the developer-selected engine without exposing provider identity', () => {
  assert.match(worker, /const order: AiProvider\[\] = \["openai"\]/);
  assert.match(worker, /async function platformAiProviderKey/);
  assert.match(worker, /LOWER\(u\.email\)=\?/);
  assert.doesNotMatch(worker, /async function organizationAiProviderKey/);
  assert.doesNotMatch(html, /ChatGPT|OpenAI|Gemini|Google AI/i);
  assert.doesNotMatch(client, /ChatGPT|OpenAI|Gemini|Google AI/i);
  assert.doesNotMatch(activity, /ChatGPT|OpenAI|Gemini|Google AI/i);
  assert.doesNotMatch(layout, /ChatGPT|OpenAI|Gemini|Google AI/i);
  assert.match(worker, /هذه الإعدادات متاحة لإدارة VAREX فقط/);
});

test('WhatsApp API canonicalizes international numbers and returns actionable Meta failures', () => {
  assert.match(worker, /normalizePhoneDigits\(params\.to\)/);
  assert.match(worker, /deliverWhatsAppText/);
  assert.match(worker, /WHATSAPP_TEMPLATE_REQUIRED/);
  assert.match(worker, /WHATSAPP_RECIPIENT_NOT_ALLOWED/);
  assert.match(worker, /WHATSAPP_LINK_EXPIRED/);
});
