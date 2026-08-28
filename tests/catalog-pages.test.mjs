import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadCatalog() {
  const sandbox = {
    window: {},
    URLSearchParams,
    localStorage: { getItem() { return null; }, setItem() {} }
  };
  vm.runInNewContext(read("catalog/varex-catalog.js"), sandbox, { filename: "varex-catalog.js" });
  return sandbox.window.VAREX_CATALOG;
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(script => script.trim());
}

test("catalog contains every published Shopify application and three exact plans", () => {
  const catalog = loadCatalog();
  const expected = ["cashier", "real-estate", "car-rental", "restaurant", "cafe", "women-salon", "men-salon", "pharmacy", "shipping", "construction", "perfumes-cosmetics", "cafeteria"];
  assert.deepEqual(Object.keys(catalog.apps).sort(), expected.sort());
  const variants = new Set();
  for (const app of Object.values(catalog.apps)) {
    assert.match(app.handle, /^varex-/);
    assert.equal(app.features.ar.length, 6);
    assert.ok(app.modules.ar.length >= 8);
    assert.deepEqual(Object.keys(app.plans), ["monthly", "annual", "lifetime"]);
    for (const [key, plan] of Object.entries(app.plans)) {
      assert.equal(typeof plan.variant, "number", `${app.handle} ${key}`);
      assert.equal(variants.has(plan.variant), false, `duplicate variant ${plan.variant}`);
      variants.add(plan.variant);
      assert.match(catalog.planUrl(app, key), new RegExp(`/cart/${plan.variant}:1$`));
    }
  }
  assert.equal(variants.size, 36);
});

test("overview, preview, demo and download scripts compile", () => {
  for (const relative of ["plans/index.html", "preview/index.html", "preview/systems/catalog-demo/index.html", "download/index.html"]) {
    const scripts = inlineScripts(read(relative));
    assert.ok(scripts.length > 0, relative);
    scripts.forEach((script, index) => assert.doesNotThrow(() => new vm.Script(script, { filename: `${relative}#${index}` })));
  }
});

test("every preview route is present and the previously missing systems use the safe demo", () => {
  const preview = read("preview/index.html");
  for (const slug of ["cashier", "real-estate", "car-rental", "restaurant", "cafe", "cafeteria", "women-salon", "men-salon", "pharmacy", "shipping", "construction", "perfumes-cosmetics"]) {
    assert.ok(preview.includes(`${slug}`), slug);
  }
  for (const slug of ["cashier", "pharmacy", "shipping", "perfumes-cosmetics"]) {
    assert.match(preview, new RegExp(`catalog-demo/index\\.html\\?app=${slug.replace("-", "\\-")}`));
  }
  assert.ok(fs.existsSync(path.join(root, "preview/systems/catalog-demo/index.html")));
});

test("preview copy remains neutral and demo data cannot persist", () => {
  const touched = ["catalog/varex-catalog.js", "plans/index.html", "preview/index.html", "preview/systems/catalog-demo/index.html", "shopify/varex-plan-links.js"].map(read).join("\n");
  assert.doesNotMatch(touched, /(?:اعملي|ادخلي|اختاري|اكتبي|سجلي|سجّلي|ادفعي|أعيدي|جربي|جرّبي|اضغطي|تابعي|يمكنكِ)/);
  assert.doesNotMatch(read("preview/systems/catalog-demo/index.html"), /localStorage\.(?:setItem|removeItem|clear)/);
  for (const relative of ["preview/systems/car-rental/mobility.js", "preview/systems/dining/dining.js", "preview/systems/real-estate/real-estate.js", "preview/systems/salons/salon.js", "preview/systems/pharmacy/app.js"]) {
    assert.match(read(relative), /PREVIEW_MODE/);
  }
});

test("Shopify bridge covers all catalog handles", () => {
  const catalog = loadCatalog();
  const bridge = read("shopify/varex-plan-links.js");
  for (const app of Object.values(catalog.apps)) assert.ok(bridge.includes(`"${app.handle}"`), app.handle);
  assert.match(bridge, /searchParams\.set\("theme"/);
  assert.match(read("shopify/INSTALL.md"), /app\.varexapp\.com\/shopify\/varex-plan-links\.js/);
});
