import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines an installable cross-device VAREX AI web app", async () => {
  const [manifestSource, shell, installer, installScript, serviceWorker, icon192, icon512, maskableIcon, favicon, privacy, terms, dataDeletion, workerSource] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/legacy-index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/install.html", import.meta.url), "utf8"),
    readFile(new URL("../public/install.js", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/icons/icon-192.png", import.meta.url)),
    readFile(new URL("../public/icons/icon-512.png", import.meta.url)),
    readFile(new URL("../public/icons/icon-maskable-512.png", import.meta.url)),
    readFile(new URL("../public/favicon.svg", import.meta.url)),
    readFile(new URL("../public/privacy.html", import.meta.url), "utf8"),
    readFile(new URL("../public/terms.html", import.meta.url), "utf8"),
    readFile(new URL("../public/data-deletion.html", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const sha256 = value => createHash("sha256").update(value).digest("hex");

  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./?source=installed-app");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some(icon => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.match(shell, /rel="manifest" href="\/manifest\.webmanifest\?v=20260916-2"/);
  assert.match(shell, /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}/);
  assert.equal(manifest.name, "VAREX AI");
  assert.match(installer, /تثبيت VAREX AI/);
  assert.doesNotMatch(installer, /Employee/i);
  assert.match(shell, /varex-icon-64\.png/);
  assert.doesNotMatch([manifestSource, shell, installer, privacy, terms, dataDeletion, workerSource].join("\n"), /VAREX AI Employee|AI EMPLOYEE|EMPLOYEE SYSTEM/);
  assert.equal(sha256(icon192), "94b8dc519402b74db1b538f6d826a54f5620de6e73e0f237e28efef8dd1acb5a");
  assert.equal(sha256(icon512), "1404e5fe1a89137af82ed57662d923e4833e980958fb52983742ba81578d5d75");
  assert.equal(sha256(maskableIcon), "d16cb3bd86622bcf8e2ad59e0cf031801e0c9bc76a6257cc66a7eb4bb2dba8e8");
  assert.equal(sha256(favicon), "f1b00fead6ce489b822a5e612d6132226ac87c125cfecc2cf623a10715eb85ba");
  assert.match(installer, /إضافة إلى الشاشة الرئيسية/);
  assert.match(installScript, /beforeinstallprompt/);
  assert.match(installScript, /appinstalled/);
  assert.match(serviceWorker, /\/\\\/api\\\//);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
});

test("serves the installer, manifest and service worker with install headers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("pwa-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const seen = [];
  const env = {
    ASSETS: {
      fetch: async request => {
        const pathname = new URL(request.url).pathname;
        seen.push(pathname);
        return new Response(pathname, { headers: { "content-type": "application/octet-stream" } });
      },
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const installer = await worker.fetch(new Request("https://varex.test/install"), env, ctx);
  assert.equal(await installer.text(), "/install.html");

  const manifest = await worker.fetch(new Request("https://varex.test/manifest.webmanifest"), env, ctx);
  assert.match(manifest.headers.get("content-type") ?? "", /^application\/manifest\+json/);

  const serviceWorker = await worker.fetch(new Request("https://varex.test/sw.js"), env, ctx);
  assert.equal(serviceWorker.headers.get("service-worker-allowed"), "/");
  assert.match(serviceWorker.headers.get("content-type") ?? "", /^text\/javascript/);
  assert.deepEqual(seen, ["/install.html", "/manifest.webmanifest", "/sw.js"]);
});
