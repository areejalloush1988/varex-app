import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const codes = ["en", "ar", "fa", "ur", "zh", "ko", "it", "es", "he", "fr", "ru", "tr"];

function loadRuntime() {
  const sandbox = {
    window: {},
    document: { currentScript: { src: "https://varex.test/varex-locale.js" } },
    location: { href: "https://varex.test/plans/?lang=en", search: "?lang=en" },
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    URL,
    URLSearchParams,
    fetch
  };
  vm.runInNewContext(read("varex-locale.js"), sandbox, { filename: "varex-locale.js" });
  return sandbox.window.VAREXLocale;
}

test("native locale runtime exposes exactly the approved 12 languages with English as default", () => {
  const runtime = loadRuntime();
  assert.deepEqual(Array.from(runtime.languages, item => item.code), codes);
  assert.equal(runtime.defaultLanguage, "en");
  assert.equal(runtime.direction("ar"), "rtl");
  assert.equal(runtime.direction("fa"), "rtl");
  assert.equal(runtime.direction("ur"), "rtl");
  assert.equal(runtime.direction("he"), "rtl");
  assert.equal(runtime.direction("tr"), "ltr");
});

test("all locale files are valid, local and contain native cashier journey copy", () => {
  const critical = [
    "Cashier & Accounting Management System",
    "Dashboard",
    "Sales, inventory and accounting in one place",
    "Monthly subscription",
    "Download the app now",
    "Exit & Choose a Plan",
    "One system on every device",
    "Welcome to VAREX"
  ];
  let translatedKeys;
  for (const code of codes) {
    const relative = `locales/${code}.json`;
    assert.ok(fs.existsSync(path.join(root, relative)), relative);
    const locale = JSON.parse(read(relative));
    assert.equal(locale.code, code);
    assert.ok(["ltr", "rtl"].includes(locale.dir));
    assert.doesNotMatch(JSON.stringify(locale), /https?:\/\//i);
    if (code === "en") continue;
    const keys = Object.keys(locale.messages).sort();
    translatedKeys ||= keys;
    assert.deepEqual(keys, translatedKeys, `${code}: locale key parity`);
    assert.ok(keys.length >= 170, `${code}: locale coverage`);
    for (const key of critical) {
      assert.equal(typeof locale.messages[key], "string", `${code}: ${key}`);
      assert.ok(locale.messages[key].trim(), `${code}: ${key}`);
      assert.notEqual(locale.messages[key], key, `${code}: ${key}`);
    }
  }
});

test("Google translation is absent and language is carried through plans, preview and download", () => {
  const files = ["varex-locale.js", "varex-i18n.js", "plans/index.html", "preview/index.html", "preview/systems/catalog-demo/index.html", "download/index.html"];
  const source = files.map(read).join("\n");
  assert.doesNotMatch(source, /translate\.google|google\.translate|googtrans|goog-te-|skiptranslate/i);
  assert.match(read("plans/index.html"), /\.\.\/download\//);
  assert.match(read("plans/index.html"), /Download the app now/);
  assert.match(read("plans/index.html"), /withLanguage/);
  assert.match(read("preview/index.html"), /safeReturn\(\)/);
  assert.match(read("preview/index.html"), /searchParams\.set\("lang"/);
  assert.match(read("download/index.html"), /withLanguage/);
});

test("every cashier screen loads the native i18n layer in both published paths", () => {
  for (const folder of ["01-الكاشير-والحسابات", "cashier"]) {
    const htmlFiles = fs.readdirSync(path.join(root, folder)).filter(name => name.endsWith(".html"));
    assert.ok(htmlFiles.length >= 20);
    for (const name of htmlFiles) assert.match(read(`${folder}/${name}`), /varex-i18n\.js/, `${folder}/${name}`);
  }
});

test("cashier, plans, preview and download pages have no broken literal local assets", () => {
  const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
  for (const folder of ["01-الكاشير-والحسابات", "cashier", "plans", "preview", "download"]) {
    for (const relative of walk(folder).filter(name => name.endsWith(".html"))) {
      for (const match of read(relative).matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
        const raw = match[1];
        if (!raw || /^(?:https?:|data:|mailto:|tel:|javascript:|#)/i.test(raw) || /[{}$]/.test(raw)) continue;
        const clean = raw.split(/[?#]/)[0];
        if (!clean) continue;
        let target = path.resolve(path.dirname(path.join(root, relative)), clean);
        if (clean.endsWith("/")) target = path.join(target, "index.html");
        assert.ok(fs.existsSync(target), `${relative} -> ${raw}`);
      }
    }
  }
});
