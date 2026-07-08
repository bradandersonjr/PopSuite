/**
 * PopSuite main entry — launcher/tray-owner + module router.
 *
 * ONE Electron binary, invoked in two modes:
 *
 *   PopSuite.exe                 → LAUNCHER / TRAY OWNER: a resident, lightweight
 *                                  hub process. It creates the SINGLE unified
 *                                  system tray icon for the whole suite, spawns a
 *                                  detached child process per module
 *                                  (--module=popjot, --module=popkey), and stays
 *                                  alive listening on a local pipe. Each module
 *                                  reports its state over that pipe; the launcher
 *                                  builds one dynamic menu from whichever modules
 *                                  are connected and relays clicks back. The
 *                                  launcher owns NO overlay/settings windows and
 *                                  never touches a module's window/focus/overlay
 *                                  behavior.
 *
 *   PopSuite.exe --module=<id>   → MODULE: boot that module's main process in
 *                                  this process (own userData, own lock, own
 *                                  overlay window — identical to the standalone
 *                                  app). Delegated to modules/<id>.ts, which runs
 *                                  in "reported" tray mode so it reports to the
 *                                  launcher instead of drawing its own tray. If
 *                                  the launcher pipe is unreachable, the module
 *                                  falls back to its own local tray automatically.
 */

import { app, Tray, Menu, nativeImage, dialog, shell } from "electron";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import {
  createSuiteTrayServer,
  type SuiteTrayServer,
} from "@shared/main/suiteTrayServer";
import { buildSuiteTrayMenu, SUITE_ACTION_SETTINGS } from "@shared/main/suiteTray";
import { createSuiteUpdater, type SuiteUpdater } from "./updater";
import {
  createSuiteSettingsWindow,
  type SuiteSettingsWindow,
} from "./suiteSettingsWindow";

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

/**
 * Spawn one detached child per module from this same executable. Packaged,
 * process.execPath IS PopSuite.exe, so `execPath --module=x` re-launches the
 * suite in module mode. In dev, process.execPath is electron.exe and the app
 * directory must be forwarded as the first arg; app.getAppPath() gives that in
 * both modes.
 *
 * Spawning is unconditional: a module whose single-instance lock is already held
 * loses the lock in createPopApp and quits cleanly (focusing the running
 * instance via the primary's second-instance handler). "Already running"
 * resolves to a focus, never a duplicate.
 */
function spawnModules(): void {
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();
  for (const module of MODULES) {
    const args = isPackaged ? [`--module=${module}`] : [appPath, `--module=${module}`];
    const child = spawn(process.execPath, args, { detached: true, stdio: "ignore" });
    // Detach so children outlive a launcher restart; the launcher tracks them via
    // the pipe, not the child handle.
    child.unref();
  }
}

/** Resolve the launcher's own tray icon. Reuses PopJot's brand icon (also the
 *  suite app icon). Packaged: extraResources at resourcesPath/suite/. Dev: read
 *  straight from the popjot module's assets dir (app/modules/popjot/assets). */
function launcherTrayIconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, "suite", "tray-icon.png");
  return join(app.getAppPath(), "modules", "popjot", "assets", "tray-icon.png");
}

const requestedModule = parseModuleArg(process.argv);

if (requestedModule) {
  // ─── Module process ────────────────────────────────────────────────
  // Delegate to the module entry, which sets its per-module userData BEFORE
  // createPopApp requests the single-instance lock. A computed require keeps the
  // bundler from resolving the per-module bundles at build time — they are loaded
  // at runtime from out/main/<module>/index.js, siblings of this launcher.
  const modulePath = `./${requestedModule}/index.js`;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(modulePath);
} else {
  // ─── Launcher / tray-owner process ─────────────────────────────────
  // Single-instance lock so re-launching PopSuite doesn't stack multiple tray
  // owners; the second instance just re-spawns modules (which focus via their
  // own locks) and exits.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    let tray: Tray | null = null;
    let trayServer: SuiteTrayServer | null = null;
    let updater: SuiteUpdater | null = null;
    // The launcher-owned settings window (one window, a tab per module). Created
    // lazily on first "Edit Settings". Hosts each module's real settings renderer
    // and relays its IPC to the owning module process over the pipe.
    let settingsWindow: SuiteSettingsWindow | null = null;
    // Guards a graceful shutdown so module "close" events during Quit All don't
    // re-trigger menu rebuilds against a torn-down tray.
    let quitting = false;
    // Last relayed annotating state so we only send a suppress command on an
    // actual transition, not on every unrelated state report (shortcut rebind,
    // toggle, etc.). PopJot annotating -> PopKey suppressed, and vice versa.
    let lastAnnotating = false;

    /**
     * Relay PopJot's annotating state to PopKey as an auto-suppress command.
     * Suite-only cross-module glue: when PopJot starts drawing, PopKey hides;
     * when PopJot stops, PopKey restores to the user's last requested state.
     * Only fires on a real change so a PopKey that connects late still gets the
     * current suppression via getModules()->rebuild is not enough — so we also
     * re-assert on every change below.
     */
    function relaySuppression(): void {
      if (!trayServer || quitting) return;
      const modules = trayServer.getModules();
      const popjot = modules.find((m) => m.appName === "PopJot");
      const annotating = Boolean(popjot?.annotating);
      if (annotating !== lastAnnotating) {
        lastAnnotating = annotating;
        trayServer.suppress("PopKey", annotating);
      } else if (annotating) {
        // PopJot still annotating: re-assert to any PopKey that (re)connected
        // after the original transition, so a late/reconnecting PopKey is hidden.
        trayServer.suppress("PopKey", true);
      }
    }

    // ─── Launcher open-at-login (registers PopSuite.exe, not a module) ──
    // In the suite the thing that should launch at login is the LAUNCHER
    // (PopSuite.exe with no args), which then spawns both modules on boot —
    // the whole point of "one install". This is the launcher process's OWN
    // Electron `app` login registration, entirely separate from each module's
    // per-process login toggle (which standalone apps keep independently).
    function getLauncherOpenAtLogin(): boolean {
      return app.getLoginItemSettings().openAtLogin;
    }

    function setLauncherOpenAtLogin(enabled: boolean): void {
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
    }

    // Open a suite-wide external link in the default browser. The URLs are
    // hardcoded literals, but we validate with the same guard the shared shell
    // uses for renderer-opened links so the code path stays consistent.
    function openSuiteLink(url: string): void {
      if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
    }

    // Single product-level About for the whole suite. Launcher-local: uses the
    // launcher's OWN app.getVersion() (suite/package.json), independent of either
    // module's version, and never relays to a module process — so it works even
    // when no module is connected. The standalone modules keep their own per-app
    // About dialog (createPopApp.showAboutDialog); this is the suite presentation.
    function showSuiteAboutDialog(): void {
      dialog.showMessageBox({
        type: "info",
        title: "About PopSuite",
        message: "PopSuite",
        detail:
          `Version ${app.getVersion()}\n` +
          "Screen-annotation overlay and keystroke visualizer in one place.",
        buttons: ["OK"],
      });
    }

    // Map a reported appName (PopJot) to its module id (popjot) for the settings
    // window's tab selection.
    function moduleIdForAppName(appName: string): string {
      return appName.toLowerCase();
    }

    /**
     * Open the launcher-owned settings window and select the given module's tab.
     * Creates the window lazily on first use, wiring the module→launcher relay
     * (invoke results + main→renderer pushes) into the hosted views. Replaces the
     * old "relay a Settings action to the module's own window" behavior — the
     * launcher now owns the one window and never asks a module to open its own.
     */
    function openSettingsFor(appName: string): void {
      if (!trayServer) return;
      if (!settingsWindow) {
        settingsWindow = createSuiteSettingsWindow(__dirname, trayServer, launcherTrayIconPath());
      }
      settingsWindow.open(moduleIdForAppName(appName));
    }

    function rebuildMenu(): void {
      if (!tray || tray.isDestroyed() || !trayServer) return;
      const readyVersion = updater?.readyVersion ?? null;
      const template = buildSuiteTrayMenu(
        trayServer.getModules(),
        {
          onToggle: (appName) => trayServer?.toggle(appName),
          onAction: (appName, actionId) => {
            // Edit Settings picker: open the launcher's single settings window on
            // this module's tab (the window hosts the module's real settings UI).
            // Any other action still relays to the module's own handler.
            if (actionId === SUITE_ACTION_SETTINGS) openSettingsFor(appName);
            else trayServer?.action(appName, actionId);
          },
          onOpenAtLoginToggle: () => {
            setLauncherOpenAtLogin(!getLauncherOpenAtLogin());
            // Rebuild so the checkbox reflects the new state immediately.
            rebuildMenu();
          },
          onOpenLink: (url) => openSuiteLink(url),
          onAbout: () => showSuiteAboutDialog(),
          onCheckForUpdates: () => checkForUpdates(),
          onInstallUpdate: () => installUpdate(),
          onQuitAll: () => quitAll(),
        },
        {
          launcherOpenAtLogin: getLauncherOpenAtLogin(),
          updateReady: readyVersion ? { version: readyVersion } : undefined,
        }
      );
      tray.setContextMenu(Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[]));
    }

    // Manual "Check for Updates": trigger an immediate check and, when nothing
    // newer is found, reassure the user. A found update follows the same silent
    // download -> tray restart-item flow as the automatic checks, so we only need
    // a dialog for the up-to-date / unavailable cases.
    function checkForUpdates(): void {
      void updater?.checkNow().then((result) => {
        if (result.status === "up-to-date" || result.status === "unavailable") {
          dialog.showMessageBox({
            type: "info",
            title: "PopSuite",
            message: "You're on the latest version.",
            buttons: ["OK"],
          });
        }
        // "downloading"/"ready" surface via the tray item; no dialog needed.
      });
    }

    // Install a staged update: hand the updater our module-quit routine so the
    // modules tear down (PopKey's uiohook, overlays) before quitAndInstall.
    function installUpdate(): void {
      if (!updater?.readyVersion) return;
      quitting = true;
      updater.installUpdate(() => trayServer?.quitAll());
    }

    function quitAll(): void {
      quitting = true;
      // Ask every connected module to quit itself, then quit the launcher. The
      // modules tear down their own windows/hooks via their will-quit handlers.
      trayServer?.quitAll();
      // Give the quit messages a moment to flush over the pipe before we go.
      setTimeout(() => app.quit(), 200);
    }

    app.whenReady().then(() => {
      const iconPath = launcherTrayIconPath();
      const image = existsSync(iconPath)
        ? nativeImage.createFromPath(iconPath)
        : nativeImage.createEmpty();
      tray = new Tray(image);
      tray.setToolTip("PopSuite");

      // Start the pipe server first so modules can connect the instant they boot,
      // then rebuild the menu on every connect/disconnect/state change.
      trayServer = createSuiteTrayServer(
        () => {
          if (quitting) return;
          // Relay PopJot annotating -> PopKey suppress before rebuilding the menu
          // so the menu reflects PopKey's resulting auto-hidden label in the same
          // pass once PopKey reports back its autoSuppressed state.
          relaySuppression();
          rebuildMenu();
          // Keep the open settings window's tabs in sync with which modules are
          // connected (swap a placeholder <-> the real view as modules come/go).
          settingsWindow?.refreshConnState();
        },
        undefined,
        (appName, msg) => {
          // Settings-window relay coming back from a module: hand it to the
          // launcher settings window so it reaches the right hosted tab (invoke
          // results resolve the renderer's promise; pushes drive its subscriptions).
          settingsWindow?.routeRelay(appName, msg);
        }
      );

      // Windows/macOS: double-click the icon to re-spawn any missing modules.
      tray.on("double-click", () => spawnModules());

      // Launcher-only auto-update: start the delayed initial check + 4h interval.
      // No-ops cleanly in dev (!app.isPackaged). When an update finishes
      // downloading it rebuilds the menu so the restart item appears.
      updater = createSuiteUpdater(() => {
        if (!quitting) rebuildMenu();
      });
      updater.start();

      rebuildMenu();
      spawnModules();
    });

    // Re-launch of PopSuite while the launcher owns the tray: re-spawn modules so
    // any that were quit come back; running ones focus via their own locks.
    app.on("second-instance", () => {
      spawnModules();
    });

    // The launcher must stay resident as the tray owner, so window-all-closed
    // must NOT quit it. Its only window is the lazily-opened settings window;
    // closing that must leave the tray (and both module processes) running.
    app.on("window-all-closed", () => {
      // Intentionally empty: keep the launcher alive.
    });

    app.on("will-quit", () => {
      updater?.dispose();
      updater = null;
      settingsWindow?.dispose();
      settingsWindow = null;
      trayServer?.dispose();
      trayServer = null;
      tray?.destroy();
      tray = null;
    });

    // Surface a launcher-fatal error rather than dying silently with a dead icon.
    process.on("uncaughtException", (err) => {
      console.error(`PopSuite launcher error: ${String(err)}`);
      if (app.isReady()) dialog.showErrorBox("PopSuite", `Launcher error: ${String(err)}`);
    });
  }
}
