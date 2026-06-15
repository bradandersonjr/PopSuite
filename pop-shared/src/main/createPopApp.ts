/**
 * Shared Electron app shell for PopSuite overlay apps.
 *
 * Owns everything that PopJot and PopKey have in common:
 *   - single-instance lock
 *   - transparent always-on-top overlay window + frameless settings window
 *   - schema-driven settings IPC (via settings/main)
 *   - named global shortcuts with validation, rollback, and tray broadcast
 *   - open-at-login IPC
 *   - system tray with Settings/About/Quit menu
 *   - app lifecycle (activate, window-all-closed, will-quit, second-instance)
 *
 * Apps supply their settings schema, window sizes, shortcut handlers, and
 * app-specific subsystems via the options object, and register any extra
 * ipcMain handlers themselves after calling createPopApp().
 */

import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  screen,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
} from "electron";
import { join } from "path";
import { existsSync } from "fs";
import { registerSettingsIpc } from "../settings/main";
import type { SettingsSchema, SettingsValues, SettingValue } from "../settings/schema";

export type ShortcutUpdateResult =
  | { ok: true; shortcut: string }
  | { ok: false; shortcut: string; error: string };

export interface PopAppContext<S extends SettingsSchema> {
  /** Live main-process settings state. */
  settings: SettingsValues<S>;
  getMainWindow(): BrowserWindow | null;
  getSettingsWindow(): BrowserWindow | null;
  /** Send to the overlay window only. */
  sendToMainWindow(channel: string, ...args: unknown[]): void;
  /** Broadcast to overlay + settings windows. */
  sendToRenderers(channel: string, value: unknown): void;
  /** Move the overlay window to cover the display the cursor is on. */
  moveOverlayToCursorDisplay(): void;
  /** Cursor position in the overlay window's coordinate space (DIPs). */
  getCursorDipPosition(): { x: number; y: number };
  openSettingsWindow(): void;
}

export interface PopShortcut<S extends SettingsSchema> {
  /** Channel/bridge identity, e.g. "main" → set-main-shortcut / setMainShortcut. */
  name: string;
  /** Default Electron accelerator, e.g. "Alt+Shift+A". */
  default: string;
  handler: (ctx: PopAppContext<S>) => void | Promise<void>;
}

export interface PopAppOptions<S extends SettingsSchema> {
  /** Product name used for window titles, tray tooltip/menu, and About box. */
  appName: string;
  /** One-line description shown under the version in the About box. */
  aboutDetail: string;
  settingsSchema: S;
  /** Side effects to run when a specific setting changes. */
  onSettingChange?: { [K in keyof S]?: (value: SettingValue<S[K]>, ctx: PopAppContext<S>) => void };
  settingsWindow: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    resizable?: boolean;
  };
  shortcuts: ReadonlyArray<PopShortcut<S>>;
  tray?: {
    /** Label for the settings item, defaults to "Settings". */
    settingsLabel?: string;
    doubleClickOpensSettings?: boolean;
  };
  /** What launching a second instance should do. Defaults to "focus-main". */
  secondInstance?: "focus-main" | "open-settings";
  onReady?: (ctx: PopAppContext<S>) => void;
  onWillQuit?: () => void;
}

export function createPopApp<S extends SettingsSchema>(
  options: PopAppOptions<S>
): PopAppContext<S> {
  const { appName, settingsSchema } = options;

  // ─── Single instance lock ────────────────────────────────────────────
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }

  let mainWindow: BrowserWindow | null = null;
  let settingsWindow: BrowserWindow | null = null;
  let tray: Tray | null = null;

  const shortcutState: Record<string, string> = {};
  for (const sc of options.shortcuts) {
    shortcutState[sc.name] = sc.default;
  }

  function loadRendererWindow(win: BrowserWindow, query?: Record<string, string>): void {
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      if (query) {
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
      }
      win.loadURL(url.toString());
      return;
    }

    win.loadFile(join(__dirname, "../renderer/index.html"), query ? { query } : undefined);
  }

  function sendToRenderers(channel: string, value: unknown): void {
    mainWindow?.webContents.send(channel, value);
    settingsWindow?.webContents.send(channel, value);
  }

  // ─── Settings IPC (schema-driven) ────────────────────────────────────

  const settingsController = registerSettingsIpc(settingsSchema, {
    sendToRenderers,
    onChange: buildOnChange(),
  });

  function buildOnChange():
    | { [K in keyof S]?: (value: SettingValue<S[K]>) => void }
    | undefined {
    if (!options.onSettingChange) return undefined;
    const wrapped: Record<string, (value: never) => void> = {};
    for (const [key, fn] of Object.entries(options.onSettingChange)) {
      if (!fn) continue;
      wrapped[key] = (value) => (fn as (value: unknown, ctx: PopAppContext<S>) => void)(value, ctx);
    }
    return wrapped as { [K in keyof S]?: (value: SettingValue<S[K]>) => void };
  }

  function syncTraySettingsToWindow(win: BrowserWindow): void {
    settingsController.syncToWindow(win);
    win.webContents.send("tray-open-at-login", app.getLoginItemSettings().openAtLogin);
    for (const name of Object.keys(shortcutState)) {
      win.webContents.send(`tray-set-${name}-shortcut`, shortcutState[name]);
    }
  }

  // ─── Multi-monitor helpers ───────────────────────────────────────────

  function moveOverlayToCursorDisplay(): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { x, y, width, height } = display.bounds;
    mainWindow.setBounds({ x, y, width, height });
  }

  function getCursorDipPosition(): { x: number; y: number } {
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow?.getBounds() ?? { x: 0, y: 0 };
    return {
      x: cursor.x - bounds.x,
      y: cursor.y - bounds.y,
    };
  }

  // ─── Window creation ─────────────────────────────────────────────────

  function createWindow(): BrowserWindow {
    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      title: appName,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
      },
    });

    win.setAlwaysOnTop(true, "screen-saver");
    // No { forward: true } — we don't need hover detection on the transparent window.
    // Forwarding keeps the window in the input pipeline and can intercept synthetic
    // right/middle-click events from tablet drivers (e.g. Huion stylus buttons).
    win.setIgnoreMouseEvents(true);

    loadRendererWindow(win);

    win.once("ready-to-show", () => {
      // Force full-display bounds after show to override OS working-area constraints
      win.setBounds({ x, y, width, height });
      win.show();
    });

    win.on("closed", () => {
      mainWindow = null;
    });

    return win;
  }

  function trayIconPath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, "tray-icon.png")
      : join(__dirname, "../../assets/tray-icon.png");
  }

  function createSettingsWindow(): BrowserWindow {
    const iconPath = trayIconPath();
    const { width, height, minWidth, minHeight, resizable = false } = options.settingsWindow;

    const win = new BrowserWindow({
      width,
      height,
      minWidth,
      minHeight,
      frame: false,
      resizable,
      show: false,
      title: `${appName} Settings`,
      backgroundColor: "#171717",
      icon: existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
      },
    });

    loadRendererWindow(win, { settings: "1" });

    win.once("ready-to-show", () => {
      win.show();
    });
    win.webContents.on("did-finish-load", () => {
      syncTraySettingsToWindow(win);
    });

    win.on("closed", () => {
      settingsWindow = null;
    });

    return win;
  }

  function openSettingsWindow(): void {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      settingsWindow = createSettingsWindow();
      return;
    }

    // Sync latest settings before re-showing a hidden window
    syncTraySettingsToWindow(settingsWindow);
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
  }

  // ─── Context handed to app callbacks ─────────────────────────────────

  const ctx: PopAppContext<S> = {
    settings: settingsController.values,
    getMainWindow: () => mainWindow,
    getSettingsWindow: () => settingsWindow,
    sendToMainWindow: (channel, ...args) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
      }
    },
    sendToRenderers,
    moveOverlayToCursorDisplay,
    getCursorDipPosition,
    openSettingsWindow,
  };

  // ─── Common IPC ──────────────────────────────────────────────────────

  ipcMain.on("quit-app", () => {
    app.quit();
  });

  ipcMain.on("close-window", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.hide();
    }
  });

  ipcMain.handle("get-open-at-login", () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.on("set-open-at-login", (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    sendToRenderers("tray-open-at-login", Boolean(enabled));
  });

  // ─── Global shortcuts ────────────────────────────────────────────────

  function unregisterShortcuts(accelerators: Record<string, string>): void {
    for (const accelerator of Object.values(accelerators)) {
      globalShortcut.unregister(accelerator);
    }
  }

  function registerShortcutHandlers(accelerators: Record<string, string>): ShortcutUpdateResult {
    const entries = options.shortcuts.map((sc) => ({ sc, accelerator: accelerators[sc.name] }));

    const seen = new Set<string>();
    for (const { accelerator } of entries) {
      if (seen.has(accelerator)) {
        return {
          ok: false,
          shortcut: accelerator,
          error: "Shortcuts must be different from each other.",
        };
      }
      seen.add(accelerator);
    }

    const registered: string[] = [];
    for (const { sc, accelerator } of entries) {
      const ok = globalShortcut.register(accelerator, () => {
        void sc.handler(ctx);
      });
      if (!ok) {
        registered.forEach((a) => globalShortcut.unregister(a));
        return {
          ok: false,
          shortcut: accelerator,
          error: `Couldn't register ${accelerator}. It may be invalid or already in use.`,
        };
      }
      registered.push(accelerator);
    }

    return { ok: true, shortcut: entries[0]?.accelerator ?? "" };
  }

  function updateShortcuts(next: Record<string, string>): ShortcutUpdateResult {
    const previous = { ...shortcutState };

    unregisterShortcuts(previous);
    const result = registerShortcutHandlers(next);

    if (!result.ok) {
      const rollback = registerShortcutHandlers(previous);
      if (!rollback.ok) {
        dialog.showErrorBox(
          "Shortcut Registration Failed",
          `${result.error}\n\nThe previous shortcuts could not be restored, so the app will now quit.`
        );
        app.quit();
      }
      return result;
    }

    Object.assign(shortcutState, next);
    return result;
  }

  for (const sc of options.shortcuts) {
    ipcMain.handle(`set-${sc.name}-shortcut`, (_event, shortcut: string) => {
      const electronFormat = shortcut.replace(/ /g, "");
      const result = updateShortcuts({ ...shortcutState, [sc.name]: electronFormat });
      if (result.ok) {
        sendToRenderers(`tray-set-${sc.name}-shortcut`, electronFormat);
        return { ok: true, shortcut: electronFormat };
      }
      return result;
    });
  }

  ipcMain.handle("get-shortcuts", () => ({ ...shortcutState }));

  // ─── System tray ─────────────────────────────────────────────────────

  function createTray(): void {
    const iconPath = trayIconPath();
    const trayImage = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();

    tray = new Tray(trayImage);
    tray.setToolTip(appName);

    const buildTrayMenu = () =>
      Menu.buildFromTemplate([
        {
          label: appName,
          enabled: false,
        },
        { type: "separator" },
        {
          label: options.tray?.settingsLabel ?? "Settings",
          click: () => openSettingsWindow(),
        },
        {
          label: "About",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: `About ${appName}`,
              message: appName,
              detail: `Version ${app.getVersion()}\n${options.aboutDetail}`,
              buttons: ["OK"],
            });
          },
        },
        { type: "separator" },
        {
          label: `Quit ${appName}`,
          click: () => app.quit(),
        },
      ]);

    if (options.tray?.doubleClickOpensSettings) {
      tray.on("double-click", () => openSettingsWindow());
    }
    tray.on("right-click", () => {
      tray?.setContextMenu(buildTrayMenu());
      tray?.popUpContextMenu();
    });
  }

  // ─── App lifecycle ───────────────────────────────────────────────────

  app.whenReady().then(() => {
    mainWindow = createWindow();
    createTray();

    const shortcutRegistration = registerShortcutHandlers(shortcutState);
    if (!shortcutRegistration.ok) {
      dialog.showErrorBox("Shortcut Registration Failed", shortcutRegistration.error);
    }

    options.onReady?.(ctx);
  });

  app.on("window-all-closed", () => {
    // On macOS, apps conventionally remain in the dock until the user explicitly quits.
    if (process.platform !== "darwin") app.quit();
  });

  // macOS: re-create the overlay window when the dock icon is clicked and no windows are open.
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow();
    }
  });

  app.on("will-quit", () => {
    options.onWillQuit?.();
    globalShortcut.unregisterAll();
    settingsWindow?.destroy();
    settingsWindow = null;
    tray?.destroy();
    tray = null;
  });

  app.on("second-instance", () => {
    if (options.secondInstance === "open-settings") {
      openSettingsWindow();
      return;
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return ctx;
}
