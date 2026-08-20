import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "www");
const allowedExtensions = new Set([".html", ".css", ".js", ".png"]);
const mobileEntry = "app-launcher.html";

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
const files = entries
  .filter(entry => entry.isFile())
  .map(entry => entry.name)
  .filter(name => allowedExtensions.has(extname(name)) || name === "manifest.json")
  .sort();

for (const file of files) {
  await copyFile(join(root, file), join(output, file));
}

if (!files.includes("index.html")) {
  throw new Error("VAREX mobile build failed: index.html was not found.");
}

if (!files.includes(mobileEntry)) {
  throw new Error(`VAREX mobile build failed: ${mobileEntry} was not found.`);
}

// Keep the public website entry untouched, but make the installed app open on
// the systems launcher. The existing business dashboard remains available as
// dashboard.html inside the native bundle.
await copyFile(join(root, "index.html"), join(output, "dashboard.html"));
await copyFile(join(root, mobileEntry), join(output, "index.html"));

const mobileFiles = await readdir(output);
for (const file of mobileFiles) {
  const extension = extname(file);
  if (!new Set([".html", ".js"]).has(extension)) continue;
  if (file === "index.html" || file === mobileEntry) continue;

  const path = join(output, file);
  const source = await readFile(path, "utf8");
  const rewritten = source.replaceAll("index.html", "dashboard.html");
  if (rewritten !== source) await writeFile(path, rewritten, "utf8");
}

const serviceWorkerPath = join(output, "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
if (!serviceWorker.includes('"./index.html"')) {
  await writeFile(
    serviceWorkerPath,
    serviceWorker.replace('"./dashboard.html",', '"./index.html",\n"./dashboard.html",'),
    "utf8",
  );
}

console.log(`VAREX mobile bundle ready: launcher + ${files.length} application files copied to www/`);
