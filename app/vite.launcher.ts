/**
 * Launcher build. Produces suite/out/main/index.js — the entry electron-builder
 * points `main` at. It is the router: with --module=<id> it require()s the
 * matching module bundle (out/main/<id>/index.js); with no arg it spawns both
 * modules as detached children and stays resident as the tray owner.
 *
 * Built as plain CJS (no renderer pipeline) so it stays a tiny standalone entry.
 * Electron built-ins and Node built-ins are externalized; the shared suite-tray
 * server/model (@shared/*) is bundled in. electron-updater is left external too —
 * it is a production dependency electron-builder traces into the app's
 * node_modules, so it is require()d at runtime rather than bundled.
 *
 * Alongside index.js it also emits the launcher-owned settings window's two
 * preload scripts (out/main/suiteSettings/*.js) and copies its two static HTML
 * assets (tab strip + dead-module placeholder) into the same folder, so the
 * settings window can resolve them beside the launcher in the packaged out/ tree.
 */

import { defineConfig, type Plugin } from "vite";
import { builtinModules } from "module";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";

/** Copy the settings window's static HTML into out/main/suiteSettings after build. */
function copySuiteSettingsAssets(): Plugin {
  const from = resolve(__dirname, "src/main/suiteSettings");
  const to = resolve(__dirname, "out/main/suiteSettings");
  return {
    name: "copy-suite-settings-assets",
    writeBundle() {
      mkdirSync(to, { recursive: true });
      for (const file of ["tabStrip.html", "placeholder.html"]) {
        copyFileSync(resolve(from, file), resolve(to, file));
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
    },
  },
  plugins: [copySuiteSettingsAssets()],
  build: {
    outDir: resolve(__dirname, "out/main"),
    // Do NOT wipe out/main — the per-module builds write out/main/<module> first.
    emptyOutDir: false,
    // Multiple CJS entries: the launcher itself plus the settings-window preloads.
    // The preloads land under suiteSettings/ so the launcher resolves them beside
    // its own bundle (see suiteSettingsWindow.ts path resolution).
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/main/index.ts"),
        "suiteSettings/hostedPreload": resolve(__dirname, "src/main/suiteSettings/hostedPreload.ts"),
        "suiteSettings/tabStripPreload": resolve(
          __dirname,
          "src/main/suiteSettings/tabStripPreload.ts"
        ),
      },
      external: [
        "electron",
        "electron-updater",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        format: "cjs",
        entryFileNames: "[name].js",
        // Keep chunk names stable/predictable beside the entries.
        chunkFileNames: "[name].js",
      },
    },
  },
});
