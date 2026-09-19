import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the right sidebar hidden on phones and touch tablets until requested", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../public/legacy-index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /@media\(max-width:1180px\),\(hover:none\) and \(pointer:coarse\)/);
  assert.match(html, /\.sidebar\{[^}]*visibility:hidden[^}]*pointer-events:none/);
  assert.match(html, /\.sidebar\.open\{[^}]*visibility:visible[^}]*pointer-events:auto/);
  assert.match(html, /id="menuBtn"[^>]*aria-controls="sidebar"[^>]*aria-expanded="false"/);
  assert.match(script, /function setSidebarOpen\(open, restoreFocus = false\)/);
  assert.match(script, /compactNavigation\.matches/);
  assert.match(script, /document\.body\.classList\.toggle\('nav-open', shouldOpen\)/);
  assert.match(script, /\$\('#overlay'\)\.addEventListener\('click', \(\) => setSidebarOpen\(false, true\)\)/);
});
