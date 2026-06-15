/**
 * pack-extension.mjs (shared)
 *
 * Post-build script: copies static extension assets into dist-extension/
 * so it becomes a self-contained, loadable Chrome unpacked extension.
 *
 * Lives in pop-shared and runs against the consuming app's root (process.cwd(),
 * since npm runs this script from the app dir). Run automatically via
 * `npm run build:extension`.
 */

import { copyFile, cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist-extension");

// 1. manifest.json
await copyFile(
  path.join(root, "extension", "manifest.json"),
  path.join(dist, "manifest.json")
);
console.log("✓ manifest.json");

// 2. background.js (plain JS, not bundled by Vite)
await copyFile(
  path.join(root, "extension", "background.js"),
  path.join(dist, "background.js")
);
console.log("✓ background.js");

// 3. Static HTML shells
await copyFile(
  path.join(root, "extension", "popup.html"),
  path.join(dist, "popup.html")
);
console.log("✓ popup.html");

await copyFile(
  path.join(root, "extension", "content.html"),
  path.join(dist, "content.html")
);
console.log("✓ content.html");

// 4. Icons — copy from assets/icons if present, otherwise warn.
const iconsDir = path.join(root, "assets", "icons");
const distIcons = path.join(dist, "icons");
if (existsSync(iconsDir)) {
  await mkdir(distIcons, { recursive: true });
  await cp(iconsDir, distIcons, { recursive: true });
  console.log("✓ icons/");
} else {
  console.warn(
    "⚠  assets/icons/ not found — extension icons will be missing.\n" +
    "   Add icon16.png, icon48.png, icon128.png to assets/icons/ to fix."
  );
}

console.log("\n✅  Extension built → dist-extension/");
console.log("   Load it in Chrome: chrome://extensions → Enable Developer mode → Load unpacked");
