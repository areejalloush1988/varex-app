import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/legacy-index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("preview mode loads a synthetic workspace without a session or API bootstrap", () => {
  assert.match(client, /const PREVIEW_MODE = new URLSearchParams\(location\.search\)\.get\('preview'\) === '1'/);
  assert.match(client, /function seedPreviewWorkspace\(\)/);
  assert.match(client, /if \(PREVIEW_MODE\) \{[\s\S]*?enterPreviewMode\(\);[\s\S]*?return;/);
  assert.match(client, /state\.session = null;/);
  assert.match(client, /شركة VAREX التجريبية/);
});

test("preview mode is visibly read-only and blocks every mutating action", () => {
  assert.match(client, /function guardPreviewActions\(\)/);
  assert.match(client, /document\.addEventListener\('submit',[\s\S]*?preventDefault\(\)[\s\S]*?stopImmediatePropagation\(\)/);
  assert.match(client, /نسخة المعاينة للعرض فقط — لا يتم تنفيذ أي إجراء أو حفظ أي بيانات/);
  assert.match(client, /function lockPreviewControls\(\)/);
  assert.match(html, /\.preview-mode \.commercial-banner\.preview-banner/);
});

