/**
 * Launcher build. Produces suite/out/main/index.js — the entry electron-builder
 * points `main` at. It is the router: with --module=<id> it require()s the
 * matching module bundle (out/main/<id>/index.js); with no arg it spawns both
 * modules as detached children and exits.
 *
 * Built as a plain CJS lib (no renderer/preload) so it stays a tiny standalone
 * entry. Electron built-ins and Node built-ins are externalized; the shared
 * suite-tray server/model (@shared/*) is bundled in. electron-updater is left
 * external too — it is a production dependency electron-builder traces into the
 * app's node_modules, so it is require()d at runtime rather than bundled.
 */

import { defineConfig } from "vite";
import { builtinModules } from "module";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "out/main"),
    // Do NOT wipe out/main — the per-module builds write out/main/<module> first.
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/main/index.ts"),
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [
        "electron",
        "electron-updater",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: { format: "cjs" },
    },
  },
});
