import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships subscription licensing and tablet screen controls", async () => {
  const [home, subscription, shared] = await Promise.all([
    readFile(new URL("../dist/client/open-v7.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/subscription.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/varex-shared-ui-v1.js", import.meta.url), "utf8"),
  ]);

  assert.match(home, /varex-shared-ui-v1\.js\?v=1/);
  assert.match(subscription, /page="subscription"/);
  assert.match(subscription, /varex-shared-ui-v1\.js\?v=1/);
  assert.match(shared, /الاشتراك والترخيص/);
  assert.match(shared, /varex_subscription/);
  assert.match(shared, /varex_selected_plan/);
  assert.match(shared, /SCALE_STEPS=\[50,60,75,100\]/);
  assert.match(shared, /target\.style\.zoom/);
  assert.match(shared, /overflowX="hidden"/);
  assert.match(shared, /animation:none!important;transition:none!important/);
  assert.match(shared, /data-vx-subscription-link/);
});
