import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

test("official application path entries exist", () => {
  for (const route of ["restaurant", "cashier", "real-estate", "pharmacy", "library"]) {
    assert.ok(existsSync(join(root, route, "index.html")), `missing /${route}/ entry`);
  }
});

test("library route is anonymous and linked from the VAREX launcher", () => {
  const route = read("library/index.html");
  const library = read("10-مكتبة-فاريكس/index.html");
  const launcher = read("systems.html");
  assert.doesNotMatch(library, /أريج|Areej/i);
  assert.match(library, /VAREX LIBRARY/);
  assert.match(route, /\.\.\/10-مكتبة-فاريكس\//);
  assert.ok(existsSync(join(root, "10-مكتبة-فاريكس", "manifest.json")));
  assert.ok(existsSync(join(root, "10-مكتبة-فاريكس", "icon.svg")));
  assert.ok(existsSync(join(root, "10-مكتبة-فاريكس", "sw.js")));
  assert.match(launcher, /data-system="library"/);
  assert.match(launcher, /launcherUrl\("\.\/library\/"\)/);
});

test("restaurant path ships a complete install shell", () => {
  const install = read("restaurant/install.html");
  const manifest = JSON.parse(read("restaurant/manifest.json"));
  const worker = read("restaurant/sw.js");

  assert.match(install, /href="\.\/manifest\.json/);
  assert.match(install, /id="installButton"/);
  assert.match(install, /src="\.\/restaurant-install\.js/);
  assert.equal(manifest.scope, "./");
  assert.match(manifest.start_url, /^\.\//);
  assert.match(worker, /ROOT_PATH=new URL\("\.\/",self\.location\.href\)/);
});

test("restaurant authentication stays mounted below /restaurant", () => {
  const auth = read("restaurant/restaurant-auth.js");
  assert.match(auth, /var PREFIX=location\.pathname==="\/restaurant"/);
  assert.match(auth, /function apiPath\(path\)/);
  assert.doesNotMatch(auth, /\.chatgpt\.site/i);
});

test("real-estate alias keeps its pages and assets inside the official path", () => {
  const dashboard = read("real-estate/index.html");
  const navigation = read("real-estate/real-estate.js");
  assert.match(dashboard, /data-re-page="dashboard"/);
  assert.match(dashboard, /\.\/real-estate\.css/);
  assert.match(navigation, /\.\/real-estate-properties\.html/);
  assert.ok(existsSync(join(root, "real-estate", "real-estate-properties.html")));
});
