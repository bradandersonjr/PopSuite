/**
 * Per-module electron-vite config for the PopSuite build.
 *
 * Runs once per module (popjot / popkey). It builds THAT module's:
 *   - main    → suite/out/main/<module>/index.js     (the suite module entry,
 *               which sets per-module userData then calls the app's register())
 *   - preload → suite/out/preload/<module>/index.js  (the app's own preload)
 *   - renderer→ suite/out/renderer/<module>/index.html (the app's own UI)
 *
 * The module entry lives in suite/src/modules/<module>.ts and pulls the app's
 * register() via the @popjot / @popkey alias. The renderer/preload roots point
 * at the app directory so the app's existing index.html, main.tsx, and `@`
 * alias resolve exactly as in the standalone build.
 */

import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "path";
import suiteTailwindConfig from "./tailwind.suite";

const SUITE_ROOT = __dirname;
const REPO_ROOT = resolve(SUITE_ROOT, "..");
const MODULES_ROOT = resolve(SUITE_ROOT, "modules");

interface ModuleBuildOptions {
  /** "popjot" | "popkey" */
  module: string;
  /** Directory name of the app package under app/modules, e.g. "popjot". */
  appDir: string;
}

export function createModuleConfig({ module, appDir }: ModuleBuildOptions) {
  const appRoot = resolve(MODULES_ROOT, appDir);

  // Aliases: `@` → this module's src, `@shared` → shared/, plus @popjot/@popkey
  // so the suite module entry can import the app's register().
  const alias = {
    "@": resolve(appRoot, "src"),
    "@shared": resolve(REPO_ROOT, "shared/src"),
    "@popjot": resolve(MODULES_ROOT, "popjot/src"),
    "@popkey": resolve(MODULES_ROOT, "popkey/src"),
  };

  return defineConfig({
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias },
      build: {
        outDir: resolve(SUITE_ROOT, `out/main/${module}`),
        emptyOutDir: true,
        lib: {
          entry: resolve(SUITE_ROOT, `src/modules/${module}.ts`),
          formats: ["cjs"],
        },
        rollupOptions: {
          // Force the module bundle to out/main/<module>/index.js so the
          // launcher's runtime require("./<module>/index.js") resolves.
          output: { format: "cjs", entryFileNames: "index.js" },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias },
      build: {
        outDir: resolve(SUITE_ROOT, `out/preload/${module}`),
        emptyOutDir: true,
        lib: {
          entry: resolve(appRoot, "src/preload/index.ts"),
        },
        rollupOptions: {
          output: { format: "cjs" },
        },
      },
    },
    renderer: {
      root: appRoot,
      // Explicit PostCSS chain so Tailwind uses the suite config (absolute
      // content globs) instead of the app's cwd-relative preset, which would
      // resolve against suite/ and generate no classes.
      css: {
        postcss: {
          plugins: [tailwindcss(suiteTailwindConfig), autoprefixer()],
        },
      },
      build: {
        outDir: resolve(SUITE_ROOT, `out/renderer/${module}`),
        emptyOutDir: true,
        rollupOptions: {
          input: resolve(appRoot, "index.html"),
        },
      },
      plugins: [react()],
      define: {
        __IS_DESKTOP__: JSON.stringify(true),
      },
      resolve: { alias },
    },
  });
}
