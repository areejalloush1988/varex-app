import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("contains the phone verification and messaging mobile surface", async () => {
  const [html, manifest, serviceWorker] = await Promise.all([
    read("web-source/index.html"),
    read("web-source/manifest.webmanifest"),
    read("web-source/sw.js"),
  ]);
  assert.match(html, /id="phoneForm"/);
  assert.match(html, /name="otpChannel" value="sms"/);
  assert.match(html, /name="otpChannel" value="whatsapp"/);
  assert.match(html, /name="otpChannel" value="call"/);
  assert.match(html, /id="conversationList"/);
  assert.match(html, /data-chat-call="video"/);
  assert.match(html, /data-chat-call="voice"/);
  assert.match(html, /src="\/varex-icon-192\.png"/);
  assert.match(html, /\/call\/styles\.css\?v=20260920-4/);
  assert.match(html, /\/call\/app\.js\?v=20260920-4/);
  assert.match(html, /\.view\{display:none!important\}/);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.scope, "/call/");
  assert.equal(parsed.display, "standalone");
  assert.match(serviceWorker, /\/call\/api\//);
  assert.match(serviceWorker, /varex-call-shell-v4/);
  assert.match(serviceWorker, /const mustRefresh/);
});

test("contains durable chats, contact import, secure sessions, and WebRTC", async () => {
  const [client, api, readme, migration] = await Promise.all([
    read("web-source/app.js"),
    read("backend/call-api.ts"),
    read("README.md"),
    read("database/0008_varex_call_messaging.sql"),
  ]);
  assert.match(client, /navigator\.contacts\.select/);
  assert.match(client, /getUserMedia/);
  assert.match(client, /RTCPeerConnection/);
  assert.match(client, /createOffer/);
  assert.match(client, /createAnswer/);
  assert.match(client, /updateViaCache: "none"/);
  assert.match(api, /TWILIO_VERIFY_SERVICE_SID/);
  assert.match(api, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(api, /varex_call_conversation/);
  assert.match(api, /varex_call_message/);
  assert.doesNotMatch(api, /123456/);
  assert.match(readme, /https:\/\/app\.varexapp\.com\/call/);
  assert.match(migration, /CREATE TABLE `varex_call_account`/);
  assert.match(migration, /CREATE TABLE `varex_call_conversation`/);
  assert.match(migration, /CREATE TABLE `varex_call_message`/);
});
