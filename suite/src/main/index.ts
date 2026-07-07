/**
 * PopSuite main entry — launcher + module router.
 *
 * ONE Electron binary, invoked in two modes:
 *
 *   PopSuite.exe                 → LAUNCHER: spawn a detached child process for
 *                                  each module (--module=popjot, --module=popkey)
 *                                  from this same executable, then exit. Net
 *                                  effect: double-clicking PopSuite starts (or,
 *                                  via each module's own single-instance lock,
 *                                  focuses) both apps.
 *
 *   PopSuite.exe --module=<id>   → MODULE: boot that module's main process in
 *                                  this process (own userData, own lock, own
 *                                  overlay window — identical to the standalone
 *                                  app). Delegated to modules/<id>.ts.
 *
 * Each module keeps its OWN existing tray icon and UX. There is no suite-level
 * tray, window, or userData — the launcher process does no Electron UI work and
 * exits immediately after spawning.
 */

import { app } from "electron";
import { spawn } from "child_process";

const MODULES = ["popjot", "popkey"] as const;
type ModuleId = (typeof MODULES)[number];

function parseModuleArg(argv: string[]): ModuleId | null {
  for (const arg of argv) {
    const m = /^--module=(.+)$/.exec(arg);
    if (m && (MODULES as readonly string[]).includes(m[1])) {
      return m[1] as ModuleId;
    }
  }
  return null;
}

const requestedModule = parseModuleArg(process.argv);

if (requestedModule) {
  // ─── Module process ────────────────────────────────────────────────
  // Delegate to the module entry, which sets its per-module userData BEFORE
  // createPopApp requests the single-instance lock. Using require (not a static
  // import) keeps the other module's code — and, for PopKey, uiohook-napi — out
  // of this process entirely.
  // The per-module bundles are emitted at out/main/<module>/index.js, siblings
  // of this launcher at out/main/index.js. A computed require keeps the bundler
  // from trying to resolve these at build time — they are loaded at runtime from
  // the packaged tree.
  const modulePath = `./${requestedModule}/index.js`;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(modulePath);
} else {
  // ─── Launcher process ──────────────────────────────────────────────
  // Spawn one detached child per module from this same executable, then quit.
  // In a packaged build process.execPath IS PopSuite.exe, so `execPath --module=x`
  // re-launches the suite in module mode. In dev, process.execPath is electron.exe
  // and the app directory must be forwarded as the first arg so Electron knows
  // what to run; app.getAppPath() gives that path in both modes.
  //
  // We spawn unconditionally: a module whose single-instance lock is already
  // held will lose the lock in createPopApp and quit cleanly (see
  // createInertContext), which also focuses the running instance via the
  // primary's second-instance handler. So "already running" resolves to a focus,
  // never a duplicate.
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();

  for (const module of MODULES) {
    // Packaged: [PopSuite.exe] --module=x
    // Dev:      [electron.exe] <appPath> --module=x
    const args = isPackaged ? [`--module=${module}`] : [appPath, `--module=${module}`];
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
    });
    // Fully detach so the child outlives this launcher process.
    child.unref();
  }

  // Nothing else to do — the launcher owns no windows. Quit once spawns are away.
  // (app never reaches "ready" work; we exit before creating any UI.)
  app.quit();
}
