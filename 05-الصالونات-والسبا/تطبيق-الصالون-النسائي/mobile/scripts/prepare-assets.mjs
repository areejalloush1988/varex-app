import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, "..");
const source = resolve(mobileDirectory, "..", "assets", "varex-logo-salon-approved.png");
const assetsDirectory = resolve(mobileDirectory, "assets");

mkdirSync(assetsDirectory, { recursive: true });
copyFileSync(source, resolve(assetsDirectory, "icon.png"));
copyFileSync(source, resolve(assetsDirectory, "splash.png"));
