import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "www");
const allowedExtensions = new Set([".html", ".css", ".js", ".png", ".svg"]);
const systemFolders = [
  "01-الكاشير-والحسابات",
  "02-إدارة-العقارات",
  "03-إدارة-تأجير-السيارات",
  "04-كار-ليفت",
  "05-الصالونات-والسبا",
  "06-المطاعم-والمقاهي"
];

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

async function copySystemFolder(folder) {
  const source = join(root, folder);
  const destination = join(output, folder);
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!allowedExtensions.has(extname(entry.name)) && entry.name !== "manifest.json") continue;
    await copyFile(join(source, entry.name), join(destination, entry.name));
  }
}

for (const folder of systemFolders) {
  await copySystemFolder(folder);
}

if (!files.includes("index.html")) {
  throw new Error("VAREX mobile build failed: index.html was not found.");
}

console.log(`VAREX mobile web bundle ready: root files and ${systemFolders.length} system folders copied to www/`);
