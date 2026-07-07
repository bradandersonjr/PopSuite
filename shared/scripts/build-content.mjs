/**
 * build-content.mjs (shared)
 *
 * Bundles shared/src/extension/content.tsx into dist-extension/content.js using
 * esbuild directly (bypassing Vite/Rollup) to avoid the TDZ (Temporal Dead
 * Zone) errors that Rollup's IIFE format produces when bundling Framer Motion
 * and other packages with circular or forward-referenced const declarations.
 *
 * esbuild builds a true IIFE without reordering declarations across modules,
 * so const/let scoping is always correct.
 *
 * Lives in shared/ and runs against the consuming app's root (process.cwd(),
 * since npm runs this script from the app module dir). shared/ is at the repo
 * root, three levels up from app/modules/<name>. The IIFE global name is
 * derived from the app's package.json name (e.g. "PopJot" → "PopJotContent").
 */

import esbuild from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sharedRoot = path.resolve(root, "../../../shared");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const globalName = `${pkg.name}Content`;
const outFile = path.join(root, "dist-extension", "content.js");
const tailwindConfig = path.join(root, "tailwind.config.ts");

// Read index.css and inject it as an inline string the same way Vite's
// `?inline` import works — esbuild doesn't support the `?inline` query
// natively, so we handle it via a custom plugin.
const cssInlinePlugin = {
  name: "css-inline",
  setup(build) {
    // Intercept any import ending in ?inline — resolve the @ alias manually
    // since esbuild's alias option doesn't apply inside onResolve plugins.
    build.onResolve({ filter: /\?inline$/ }, (args) => {
      let rawPath = args.path.replace(/\?inline$/, "");
      // Expand the @ alias
      if (rawPath.startsWith("@/")) {
        rawPath = path.join(root, "src", rawPath.slice(2));
      } else if (rawPath.startsWith("@shared/")) {
        rawPath = path.join(sharedRoot, "src", rawPath.slice(8));
      } else if (!path.isAbsolute(rawPath)) {
        rawPath = path.resolve(path.dirname(args.importer), rawPath);
      }
      return { path: rawPath, namespace: "css-inline" };
    });
    build.onLoad({ filter: /.*/, namespace: "css-inline" }, async (args) => {
      const cssSource = await readFile(args.path, "utf8");
      const { css } = await postcss([
        tailwindcss({ config: tailwindConfig }),
        autoprefixer(),
      ]).process(cssSource, {
        from: args.path,
      });

      return {
        contents: `export default ${JSON.stringify(css)};`,
        loader: "js",
      };
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(sharedRoot, "src/extension/content.tsx")],
  bundle: true,
  format: "iife",
  globalName,
  outfile: outFile,
  platform: "browser",
  target: ["chrome110"],
  jsx: "automatic",
  define: {
    __IS_DESKTOP__: "false",
    __IS_EXTENSION__: "true",
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@": path.join(root, "src"),
    "@shared": path.join(sharedRoot, "src"),
  },
  // Do NOT minify identifiers — esbuild reuses short names (H, O, R…) across
  // different scopes, and V8 can misinterpret a const binding in one scope as
  // shadowing an arrow-function parameter in a parent scope, causing TDZ errors.
  // Minifying syntax/whitespace is fine; only identifier renaming causes the bug.
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: false,
  plugins: [cssInlinePlugin],
  // Suppress the "direct eval" warning from some deps
  logOverride: { "direct-eval": "silent" },
});

const stats = await import("node:fs").then((m) =>
  m.statSync(outFile)
);
const kb = (stats.size / 1024).toFixed(2);
console.log(`✓ content.js  ${kb} kB`);
