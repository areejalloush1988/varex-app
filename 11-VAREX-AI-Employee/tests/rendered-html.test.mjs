import assert from "node:assert/strict";
import test from "node:test";

test("serves the VAREX AI application shell", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          assert.equal(new URL(request.url).pathname, "/legacy-index.html");
          return new Response("<!doctype html><title>VAREX AI</title>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), /VAREX AI/);
});

test("serves the application shell and client script without stale browser caching", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("cache-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const seen = [];
  const env = {
    ASSETS: {
      fetch: async (request) => {
        seen.push(new URL(request.url).pathname);
        return new Response("asset", { headers: { etag: '"old"' } });
      },
    },
  };

  for (const pathname of ["/legacy-index", "/app.js"]) {
    const response = await worker.fetch(new Request(`http://localhost${pathname}`, { headers: { "if-none-match": '"old"' } }), env, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate, max-age=0");
  }
  assert.deepEqual(seen, ["/legacy-index.html", "/app.js"]);
});
