import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../backend/lib/trading-broker.ts", import.meta.url), "utf8");

test("protects provider credentials with authenticated encryption", () => {
  assert.match(source, /AES-GCM/);
  assert.match(source, /getRandomValues\(new Uint8Array\(12\)\)/);
  assert.match(source, /encryptTradingSecret/);
  assert.match(source, /decryptTradingSecret/);
  assert.match(source, /raw\.byteLength !== 32/);
});

test("requires safe Spot permissions and refuses money movement", () => {
  assert.match(source, /enableReading === true/);
  assert.match(source, /enableSpotAndMarginTrading === true/);
  assert.match(source, /permissions\.withdrawals/);
  assert.match(source, /permissions\.internalTransfer \|\| permissions\.universalTransfer/);
  assert.match(source, /permissions\.margin \|\| permissions\.futures \|\| permissions\.options/);
  assert.match(source, /\/sapi\/v1\/account\/apiRestrictions/);
  assert.doesNotMatch(source, /\/sapi\/v1\/capital\/withdraw\/apply/);
});

test("signs, validates, and then sends one market order", () => {
  assert.match(source, /HMAC/);
  assert.match(source, /X-MBX-APIKEY/);
  const testOrder = source.indexOf('"/api/v3/order/test"');
  const liveOrder = source.indexOf('"/api/v3/order"', testOrder + 1);
  assert.ok(testOrder >= 0);
  assert.ok(liveOrder > testOrder);
  assert.match(source, /newClientOrderId/);
  assert.match(source, /لن تتم إعادة المحاولة تلقائياً/);
});
