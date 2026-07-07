/**
 * Shared runtime helpers for the PopSuite module processes.
 *
 * Both module entries (modules/popjot.ts, modules/popkey.ts) run inside the
 * SAME Electron binary as separate OS processes. These helpers give each one:
 *   - a per-module userData path (own single-instance lock + own storage), and
 *   - the layout that points the shared shell at this module's per-module
 *     renderer/preload/icon locations inside the shared out/ tree.
 */

import { app } from "electron";
import { join } from "path";

export type ModuleId = "popjot" | "popkey";

/**
 * Point userData at <parentOfDefault>/PopSuite/<module> so each module process
 * gets its own single-instance lock (the lock lives under userData) and its own
 * settings/cache, fully isolated from the sibling module. Must be called before
 * app is ready and before any single-instance lock request.
 *
 * The two-tier sync files (~/.popsuite/*.json) are unaffected — they live under
 * homedir, not userData, so both modules keep sharing them.
 */
export function applyModuleUserData(module: ModuleId): void {
  // Default userData is e.g. %APPDATA%/PopSuite (from productName). Nest each
  // module under it so both modules live beside each other but never collide.
  const base = app.getPath("userData");
  app.setPath("userData", join(base, "modules", module));
}

/**
 * Layout for the shared shell in packaged/prod builds. The suite's main bundles
 * live at out/main/<module>/index.js, so the renderer/preload resolve as
 * ../../renderer/<module>/index.html and ../../preload/<module>/index.js
 * relative to that. Icons come from resourcesPath/<module>/... (extraResources).
 *
 * In dev (electron-vite serves the renderer over http and writes preload/main to
 * a dev out/), ELECTRON_RENDERER_URL short-circuits renderer resolution in the
 * shell, and SUITE_ASSETS_DIR points the tray icons at the module's assets.
 */
function layoutFor(module: ModuleId) {
  return {
    rendererHtml: join("..", "..", "renderer", module, "index.html"),
    preloadScript: join("..", "..", "preload", module, "index.js"),
    resourceSubdir: module,
  };
}

export function popjotLayout() {
  return layoutFor("popjot");
}

export function popkeyLayout() {
  return layoutFor("popkey");
}
