/**
 * Unified PopSuite main build.
 *
 * The Settings UI and its self-contained sandboxed preload are built separately.
 */

import { defineConfig, type Plugin } from "vite";
import { builtinModules } from "module";
import { resolve } from "path";
import { rmSync } from "fs";

function cleanLegacySettingsAssets(): Plugin {
  const directory = resolve(__dirname, "out/main/suiteSettings");
  return {
    name: "clean-legacy-settings-assets",
    buildStart() {
      for (const file of [
        "hostedPreload.js",
        "placeholder.html",
        "tabStrip.html",
        "tabStripPreload.js",
        "settingsSchema.js",
      ]) {
        rmSync(resolve(directory, file), { force: true });
      }
      rmSync(resolve(__dirname, "out/main/settingsSchema.js"), { force: true });
    },
  };
}

export default defineConfig({
  plugins: [cleanLegacySettingsAssets()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
      "@popjot": resolve(__dirname, "modules/popjot/src"),
      "@popkey": resolve(__dirname, "modules/popkey/src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "out/main"),
    // Per-module builds write their standalone main outputs here first.
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/main/index.ts"),
      external: [
        "electron",
        "electron-updater",
        "uiohook-napi",
        ...builtinModules,
        ...builtinModules.map((module) => "node:" + module),
      ],
      output: {
        format: "cjs",
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
      },
    },
  },
});