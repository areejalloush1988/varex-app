import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("publishes the installable VAREX Call mobile surface", async () => {
  const [html, manifest, serviceWorker] = await Promise.all([
    read("web-source/index.html"),
    read("web-source/manifest.webmanifest"),
    read("web-source/sw.js"),
  ]);
  assert.match(html, /VAREX Call/);
  assert.match(html, /data-start-call="video"/);
  assert.match(html, /data-start-call="voice"/);
  assert.match(html, /rel="manifest" href="\/call\/manifest\.webmanifest"/);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.scope, "/call/");
  assert.equal(parsed.display, "standalone");
  assert.match(serviceWorker, /\/call\/api\//);
});

test("ships real WebRTC media and signaling controls", async () => {
  const [client, api, worker, migration] = await Promise.all([
    read("web-source/app.js"),
    read("backend/call-api.ts"),
    read("README.md"),
    read("database/0007_varex_call.sql"),
  ]);
  assert.match(client, /getUserMedia/);
  assert.match(client, /RTCPeerConnection/);
  assert.match(client, /createOffer/);
  assert.match(client, /createAnswer/);
  assert.match(api, /export async function callApi/);
  assert.match(worker, /https:\/\/app\.varexapp\.com\/call/);
  assert.match(migration, /CREATE TABLE `varex_call_room`/);
  assert.match(migration, /CREATE TABLE `varex_call_signal`/);
});
