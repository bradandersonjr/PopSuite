/**
 * Per-module renderer/preload build for unified PopSuite.
 *
 * Each run emits the module preload and renderer used by its independent native
 * window. A legacy module-main bundle is also retained for isolated development;
 * packaged PopSuite uses the unified app/src/main/index.ts bundle instead.
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
          // Retain a standalone module main bundle for isolated development.
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
