/**
 * guard:pro — fail the build/CI if real Pro code is present in this PUBLIC repo.
 *
 * The public build must ship only the stub `src/pro/index.ts` (no real feature
 * logic; the license gate stays locked). The real implementation lives in the private Pro source and
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

// The stub never touches storage; the real implementation is full of it. This
// is the strongest signal that real Pro code leaked into the public repo.
if (/\blocalStorage\b/.test(src)) {
  problems.push("Found `localStorage` usage — the public Pro stub must not read/write Pro state (real implementation leaked?).");
}
// The license gate must never be hard-unlocked in the public stub.
if (/\blicensed\s*=\s*true\b/.test(src)) {
  problems.push("Found `licensed = true` — the public stub must not hard-unlock Pro.");
}
// Surface sanity: the stub must still expose the license gate the app wires to.
if (!/export\s+const\s+setProLicensed\b/.test(src) || !/export\s+const\s+isPro\b/.test(src)) {
  problems.push("Missing `setProLicensed` / `isPro` exports — keep the stub surface in lockstep with the real module.");
}

if (problems.length) {
  console.error("\n✗ guard:pro FAILED for src/pro/index.ts\n");
  for (const p of problems) console.error("  • " + p);
  console.error("\nThe real Pro implementation belongs in the private repo, not here.");
  console.error("Restore the stub before committing/deploying.\n");
  process.exit(1);
}

console.log("✓ guard:pro — src/pro/index.ts is a safe public stub.");
