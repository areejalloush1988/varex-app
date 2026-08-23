const { copyFileSync, mkdirSync } = require("fs");
const { resolve } = require("path");

const windowsDirectory = resolve(__dirname, "..");
const source = resolve(windowsDirectory, "..", "assets", "varex-logo-salon-approved.png");
const destinationDirectory = resolve(windowsDirectory, "assets");

mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(source, resolve(destinationDirectory, "icon.png"));
