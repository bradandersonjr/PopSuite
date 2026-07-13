/**
 * Layout helpers for the two independent module windows in unified PopSuite.
 * The legacy userData helper remains for standalone module-main development.
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
 * Resolve each module renderer/preload relative to unified out/main/index.js.
 * A persistent partition keeps PopJot and PopKey renderer sessions isolated.
 */
function layoutFor(module: ModuleId) {
  return {
    rendererHtml: join("..", "renderer", module, "index.html"),
    preloadScript: join("..", "preload", module, "index.js"),
    resourceSubdir: module,
    partition: "persist:popsuite-" + module,
  };
}

export function popjotLayout() {
  return layoutFor("popjot");
}

export function popkeyLayout() {
  return layoutFor("popkey");
}
