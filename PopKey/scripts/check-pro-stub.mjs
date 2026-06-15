/**
 * guard:pro — fail the build/CI if real Pro code is present in this PUBLIC repo.
 *
 * The public build must ship only the stub `src/pro/index.ts` (`IS_PRO = false`,
 * no feature logic). The real implementation lives in the private Pro source and
 * is swapped in only to build paid binaries. This guard makes a leak impossible
 * to merge or deploy: it runs in CI and as `prebuild`, so `npm run build`
 * (including on Cloudflare) refuses to build if the real code is committed.
 *
 * Zero dependencies — runs with plain `node`.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const proFile = resolve(here, "../src/pro/index.ts");

// No Pro module at all (e.g. an app with no Pro features) → nothing to guard.
if (!existsSync(proFile)) {
  console.log("guard:pro — no src/pro/index.ts; nothing to check.");
  process.exit(0);
}

const src = readFileSync(proFile, "utf8");
const problems = [];

if (!/export\s+const\s+IS_PRO\s*=\s*false\b/.test(src)) {
  problems.push("Missing `export const IS_PRO = false` — the public build must not be Pro.");
}
if (/export\s+const\s+IS_PRO\s*=\s*true\b/.test(src)) {
  problems.push("Found `IS_PRO = true` — real Pro code must never be committed to a public repo.");
}
// The stub never touches storage; the real implementation is full of it.
if (/\blocalStorage\b/.test(src)) {
  problems.push("Found `localStorage` usage — the public Pro stub must not read/write Pro state (real implementation leaked?).");
}

if (problems.length) {
  console.error("\n✗ guard:pro FAILED for src/pro/index.ts\n");
  for (const p of problems) console.error("  • " + p);
  console.error("\nThe real Pro implementation belongs in the private repo, not here.");
  console.error("Restore the stub before committing/deploying.\n");
  process.exit(1);
}

console.log("✓ guard:pro — src/pro/index.ts is a safe public stub.");
