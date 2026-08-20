import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "www");
const allowedExtensions = new Set([".html", ".css", ".js", ".png"]);

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

console.log(`VAREX mobile web bundle ready: ${files.length} files copied to www/`);
