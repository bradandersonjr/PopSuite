// Emits a tiny redirect-only static build for a retired per-app domain.
// Usage: node shared/scripts/build-redirect.mjs <moduleDir> <targetUrl>
//   e.g. node shared/scripts/build-redirect.mjs app/modules/popjot https://popsuite.app
//
// The domain (popjot.app / popkey.app) is now a redirect to popsuite.app. The
// Cloudflare Pages project still runs `build:popjot` / `build:popkey` and
// publishes <moduleDir>/dist, so this writes that dist with:
//   _redirects  — Cloudflare edge 301 for every path (preserves :splat)
//   index.html  — meta-refresh + canonical fallback for anything the edge misses

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [moduleDir, target] = process.argv.slice(2);

if (!moduleDir || !target) {
  console.error("Usage: build-redirect.mjs <moduleDir> <targetUrl>");
  process.exit(1);
}

// shared/scripts/build-redirect.mjs -> repo root is two levels up.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const distDir = resolve(repoRoot, moduleDir, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

writeFileSync(resolve(distDir, "_redirects"), `/*  ${target}/:splat  301\n`);

writeFileSync(
  resolve(distDir, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=${target}" />
  <link rel="canonical" href="${target}" />
  <title>Moved to PopSuite</title>
</head>
<body>
  <p>This site has moved to <a href="${target}">${target}</a>.</p>
</body>
</html>
`
);

console.log(`Wrote redirect dist for ${moduleDir} -> ${target} (${distDir})`);
