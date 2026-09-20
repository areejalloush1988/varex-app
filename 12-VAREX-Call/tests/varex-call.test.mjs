import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("contains the free PIN sign-in and messaging mobile surface", async () => {
  const [html, manifest, serviceWorker] = await Promise.all([
    read("web-source/index.html"),
    read("web-source/manifest.webmanifest"),
    read("web-source/sw.js"),
  ]);
  assert.match(html, /id="phoneForm"/);
  assert.match(html, /data-auth-mode="register"/);
  assert.match(html, /data-auth-mode="login"/);
  assert.match(html, /id="accountPin"/);
  assert.match(html, /id="confirmPin"/);
  assert.match(html, /الدخول مجاني بالكامل/);
  assert.doesNotMatch(html, /name="otpChannel"/);
  assert.match(html, /id="conversationList"/);
  assert.match(html, /data-chat-call="video"/);
  assert.match(html, /data-chat-call="voice"/);
  assert.match(html, /src="\/varex-icon-192\.png"/);
  assert.match(html, /\/call\/styles\.css\?v=20260920-5/);
  assert.match(html, /\/call\/app\.js\?v=20260920-5/);
  assert.match(html, /\.view\{display:none!important\}/);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.scope, "/call/");
  assert.equal(parsed.display, "standalone");
  assert.match(serviceWorker, /\/call\/api\//);
  assert.match(serviceWorker, /varex-call-shell-v5/);
  assert.match(serviceWorker, /const mustRefresh/);
});

test("contains durable chats, secure PIN sessions, contact import, and WebRTC", async () => {
  const [client, api, readme, migration, pinMigration] = await Promise.all([
    read("web-source/app.js"),
    read("backend/call-api.ts"),
    read("README.md"),
    read("database/0008_varex_call_messaging.sql"),
    read("database/0009_varex_call_free_pin.sql"),
  ]);
  assert.match(client, /navigator\.contacts\.select/);
  assert.match(client, /getUserMedia/);
  assert.match(client, /RTCPeerConnection/);
  assert.match(client, /createOffer/);
  assert.match(client, /createAnswer/);
  assert.match(client, /updateViaCache: "none"/);
  assert.match(api, /PBKDF2/);
  assert.match(api, /PIN_HASH_ITERATIONS = 100_000/);
  assert.doesNotMatch(api, /PIN_HASH_ITERATIONS = 120_000/);
  assert.match(api, /\/call\/api\/auth\/register/);
  assert.match(api, /\/call\/api\/auth\/login/);
  assert.match(api, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(api, /varex_call_conversation/);
  assert.match(api, /varex_call_message/);
  assert.doesNotMatch(api, /123456/);
  assert.match(readme, /https:\/\/app\.varexapp\.com\/call/);
  assert.match(migration, /CREATE TABLE `varex_call_account`/);
  assert.match(migration, /CREATE TABLE `varex_call_conversation`/);
  assert.match(migration, /CREATE TABLE `varex_call_message`/);
  assert.match(pinMigration, /ADD `pin_salt` text/);
  assert.match(pinMigration, /ADD `pin_hash` text/);
});
