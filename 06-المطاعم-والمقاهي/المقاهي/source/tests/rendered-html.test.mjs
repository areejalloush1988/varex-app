import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("serves the standalone café app with matching PWA colors", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const html = await readFile(new URL("../dist/client/open-v7.html", import.meta.url), "utf8");
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async (request) => new URL(request.url).pathname === "/open-v7.html"
        ? new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
        : new Response("Not found", { status: 404 }) },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") ?? "", /\/login\.html\?return_to=/);
  const manifest = JSON.parse(await readFile(new URL("../dist/client/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.theme_color, "#8A5A44");
  assert.equal(manifest.start_url, "/open-v7.html");
  assert.match(html, /varex-app-icon-192\.png/);
  assert.match(html, /varex-app-v2\.js\?v=7/);
  assert.match(html, /varex-runtime-reset-v2\.js\?v=7/);
  assert.match(html, /varex-stability-v2\.css\?v=7/);
  assert.doesNotMatch(html, /login\.html|systems\.html|location\.replace/);
  const app = await readFile(new URL("../dist/client/dining.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../dist/client/dining.css", import.meta.url), "utf8");
  assert.match(app, /☕/);
  assert.match(app, /varex_dining_no_shake_v1/);
  assert.match(styles, /transform:none!important/);
});
