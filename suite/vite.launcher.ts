/**
 * Launcher build. Produces suite/out/main/index.js — the entry electron-builder
 * points `main` at. It is the router: with --module=<id> it require()s the
 * matching module bundle (out/main/<id>/index.js); with no arg it spawns both
 * modules as detached children and exits.
 *
 * Built as a plain CJS lib (no renderer/preload) so it stays a tiny standalone
 * entry. Electron built-ins and Node built-ins are externalized; the shared
 * suite-tray server/model (@shared/*) is bundled in.
 */

import { defineConfig } from "vite";
import { builtinModules } from "module";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../pop-shared/src"),
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
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: { format: "cjs" },
    },
  },
});
