/**
 * release.mjs — cut a per-app release for the PopSuite monorepo.
 *
 * Usage (from the repo root):
 *   npm run release:popjot -- 1.2.0
 *   npm run release:popkey -- 1.0.3
 *
 * Bumps the app's package.json version, commits it, and creates the tag
 * `<app>-v<version>`. It does NOT push — review, then:
 *   git push && git push origin <app>-v<version>
 * Pushing the tag triggers .github/workflows/release.yml, which builds the
 * installers on Windows/macOS/Linux and publishes the GitHub Release.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const APPS = { popjot: "PopJot", popkey: "PopKey" };

const [appArg, version] = process.argv.slice(2);
const app = appArg?.toLowerCase();
const dir = APPS[app];

if (!dir || !version) {
  console.error("Usage: npm run release:<popjot|popkey> -- <version>   (e.g. 1.2.0)");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version "${version}" — expected semver like 1.2.0`);
  process.exit(1);
}

// Refuse to run on a dirty tree so the version bump is the only thing committed.
const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty) {
  console.error("Working tree is not clean — commit or stash first:\n" + dirty);
  process.exit(1);
}

const pkgPath = `${dir}/package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const tag = `${app}-v${version}`;
execSync(`git add ${pkgPath}`, { stdio: "inherit" });
execSync(`git commit -m "${dir} ${version}"`, { stdio: "inherit" });
execSync(`git tag ${tag}`, { stdio: "inherit" });

console.log(`\n✓ Committed ${dir} ${version} and tagged ${tag}.`);
console.log(`  Push to trigger the release build:\n    git push && git push origin ${tag}\n`);
