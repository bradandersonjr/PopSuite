/**
 * PopSuite desktop main entry.
 *
 * One Electron main process owns two independent native overlay windows:
 * PopJot and PopKey. Each keeps its own renderer, preload, Chromium session,
 * settings, shortcuts, focus behavior, and input policy. The shared process owns
 * the unified tray, settings host, updater, and cross-tool coordination.
 */

import { app, Tray, Menu, nativeImage, dialog, shell } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import {
  createSuiteTrayServer,
  type SuiteTrayServer,
} from "@shared/main/suiteTrayServer";
import { buildSuiteTrayMenu, SUITE_ACTION_SETTINGS } from "@shared/main/suiteTray";
import { registerPopJot } from "@popjot/main/register";
import { registerPopKey } from "@popkey/main/register";
import { popjotLayout, popkeyLayout } from "./moduleRuntime";
import { createSuiteUpdater, type SuiteUpdater } from "./updater";
import {
  createSuiteSettingsWindow,
  type SuiteSettingsWindow,
} from "./suiteSettingsWindow";
/** Resolve the launcher's own tray icon. Reuses PopJot's brand icon (also the
 *  suite app icon). Packaged: extraResources at resourcesPath/suite/. Dev: read
 *  straight from the popjot module's assets dir (app/modules/popjot/assets). */
function launcherTrayIconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, "suite", "tray-icon.png");
  return join(app.getAppPath(), "modules", "popjot", "assets", "tray-icon.png");
}

  // ─── Launcher / tray-owner process ─────────────────────────────────
  // One lock owns the entire desktop suite; a second launch focuses Settings.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    let tray: Tray | null = null;
    let trayServer: SuiteTrayServer | null = null;
    let updater: SuiteUpdater | null = null;
    // One settings shell swaps two tool panels inside a single renderer.
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
          "Screen-annotation overlay and keystroke visualizer in one place.\n\n" +
          "Created by Brad Anderson Jr\n" +
          "https://github.com/bradandersonjr/PopSuite\n" +
          "https://www.bradandersonjr.com",
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
     * Creates the window lazily on first use. The selected panel talks to its
     * module through namespaced IPC, while module-to-renderer state pushes use
     * the suite relay. If appName is empty, the first connected module is used.
     */
    function openSettingsFor(appName: string): void {
      if (!trayServer || !settingsWindow) return;
      // Default to the first module if no specific appName is given (unified Settings item).
      const modules = trayServer.getModules();
      const selectedAppName = appName || (modules[0]?.appName ?? "popjot");
      settingsWindow.open(moduleIdForAppName(selectedAppName));
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
            // this module's panel inside the shared Settings renderer.
            // Any other action still relays to the module's own handler.
            if (actionId === SUITE_ACTION_SETTINGS) openSettingsFor(appName);
            else trayServer?.action(appName, actionId);
          },
          onToggleExtra: (appName, toggleId) => trayServer?.toggleExtra(appName, toggleId),
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
          onApplyPreset: (id) => settingsWindow?.applyPreset(id),
        },
        {
          launcherOpenAtLogin: getLauncherOpenAtLogin(),
          updateReady: readyVersion ? { version: readyVersion } : undefined,
          presets: settingsWindow
            ? {
                isPro: settingsWindow.getPresets().isPro,
                saved: settingsWindow.getPresets().presets,
              }
            : undefined,
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
      updater.installUpdate(() => app.quit());
    }

    function quitAll(): void {
      quitting = true;
      // Both tools share this main process, so one app quit tears down every
      // overlay, native hook, tray resource, and settings relay together.
      app.quit();
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
          // Keep the open Settings tabs in sync with module connection state.
          settingsWindow?.refreshConnState();
        },
        undefined,
        (appName, msg) => {
          // Forward module state pushes into the unified Settings renderer.
          settingsWindow?.routeRelay(appName, msg);
        }
      );

      // Create the settings-window controller eagerly (no window is shown until
      // open()/applyPreset()). This registers its IPC — including the presets
      // sync channel — and loads the persisted preset index so the tray can list
      // presets before the user ever opens Settings. Rebuild the menu whenever
      // the renderer syncs a change.
      settingsWindow = createSuiteSettingsWindow(
        __dirname,
        trayServer,
        launcherTrayIconPath(),
        () => {
          if (!quitting) rebuildMenu();
        },
      );

      // Register both tools in this Electron process. They still create separate
      // BrowserWindows and connect independently to the unified tray/settings host.
      registerPopJot(popjotLayout(), "reported", true);
      registerPopKey(popkeyLayout(), "reported", true);

      // Double-click opens the unified settings shell.
      tray.on("double-click", () => openSettingsFor(""));

      // Launcher-only auto-update: start the delayed initial check + 4h interval.
      // No-ops cleanly in dev (!app.isPackaged). When an update finishes
      // downloading it rebuilds the menu so the restart item appears.
      updater = createSuiteUpdater(() => {
        if (!quitting) rebuildMenu();
      });
      updater.start();

      rebuildMenu();
    });

    // A second desktop launch opens the existing suite settings window.
    app.on("second-instance", () => {
      openSettingsFor("");
    });

    // The launcher must stay resident as the tray owner, so window-all-closed
    // must NOT quit it. Its only window is the lazily-opened settings window;
    // closing that must leave the tray and both overlay windows running.
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
