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
  shell,
  clipboard,
} from "electron";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { registerSettingsIpc } from "../settings/main";
import { createSettingsSync } from "./settingsSync";
import {
  createLicenseController,
  registerLicenseIpc,
  type LicenseController,
} from "./license";
import { trayChannel, type SettingsSchema, type SettingsValues, type SettingValue } from "../settings/schema";
import { createSuiteTrayClient, type SuiteTrayClient } from "./suiteTrayClient";
import type { SuiteModuleState, SuiteTrayAction } from "./suiteTray";
import {
  captureInvokeHandlers,
  createSuiteSettingsRelay,
  type SuiteSettingsRelay,
} from "./suiteSettingsRelay";
import {
  initialSuppressionState,
  applyManualToggle,
  applySuppression,
  clearSuppression,
  effectiveActive,
  type SuppressionState,
} from "./suiteSuppression";

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
  /**
   * Pin/unpin the overlay's always-on-top state. Pass `false` to let the
   * overlay sit in normal z-order (e.g. so OBS can capture it as its own
   * window source rather than it being hard-layered over everything).
   */
  setOverlayAlwaysOnTop(onTop: boolean): void;
  /**
   * Reflect the app's active/idle state in the tray icon (swaps to the
   * indicator-dot variant when active). No-ops if no active icon was shipped.
   */
  setTrayActive(active: boolean): void;
  /** Whether a valid Pro license is active. False until `app` is ready, and
   *  always false for apps that don't set `proProduct`. */
  isPro(): boolean;
  /** Cursor position in the overlay window's coordinate space (DIPs). */
  getCursorDipPosition(): { x: number; y: number };
  openSettingsWindow(): void;
  /**
   * Suite-only: report this app's annotating on/off transition up through the
   * unified-tray pipe (PopJot uses this to tell the launcher it is drawing, so
   * PopKey auto-hides). No-op outside the suite (owned tray / standalone) and
   * for apps that don't annotate. Additive: cheap and safe to call always.
   */
  reportSuiteAnnotating(annotating: boolean): void;
  /**
   * Suite-suppressible apps (PopKey): route a manual toggle (shortcut or tray)
   * through the shared suppression reducer instead of flipping state directly.
   * Normally this just flips visibility; while a sibling is annotating it updates
   * the remembered request but keeps the overlay hidden ("PopJot always wins"),
   * so the toggle is honored once the sibling stops. No-op if the app didn't set
   * `suiteSuppressible` (standalone apps without this feature use their own path).
   */
  suiteManualToggle(): void;
  /**
   * True while a sibling module is currently auto-suppressing this app's overlay
   * (suite-only). Lets a suppressible app distinguish an effective-visibility
   * change caused by suppression from one caused by the user's own toggle. Always
   * false for apps that didn't set `suiteSuppressible`.
   */
  isSuiteSuppressed(): boolean;
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
  /**
   * Product id for the offline license layer, e.g. "popkey" / "popjot". When
   * set, the license IPC is registered and `ctx.isPro()` reflects the active
   * key. Omit for apps with no Pro tier.
   */
  proProduct?: string;
  tray?: {
    /** Label for the settings item, defaults to "Settings". */
    settingsLabel?: string;
    doubleClickOpensSettings?: boolean;
    /**
     * How this app's tray is owned.
     *   - "owned" (default): create and manage its own OS tray icon. This is the
     *     standalone behavior and MUST stay the default so PopJot.exe/PopKey.exe
     *     are unaffected.
     *   - "reported": don't create an OS tray. Instead connect to the PopSuite
     *     launcher's unified-tray pipe and report state / receive click commands,
     *     so the suite shows ONE icon for both modules. If the launcher isn't
     *     reachable (started standalone, or launcher died), automatically falls
     *     back to "owned" and creates a local tray — a module never ends up with
     *     no tray.
     */
    mode?: "owned" | "reported";
  };
  /**
   * When provided, adds an Enable/Disable item to the tray right-click menu.
   * `getEnabled` is called fresh each time the menu is built so the label is
   * always current. `onToggle` is responsible for updating state AND calling
   * `ctx.setTrayActive` to swap the icon.
   */
  trayToggle?: {
    getEnabled: () => boolean;
    onToggle: () => void;
  };
  /**
   * Suite-only auto-suppression (PopKey opts in). When set, the shared shell
   * runs the pure suppression reducer (see suiteSuppression.ts) so that while a
   * sibling module (PopJot) is annotating, this app's overlay is force-hidden
   * and manual toggles are deferred ("PopJot always wins"); when the sibling
   * stops, the overlay restores to the user's last requested state.
   *
   * The app supplies:
   *   - initialActive: the user's initial requested visibility (usually true).
   *   - applyActive(active): drive the overlay to `active` (show/hide). Called
   *     with the effective visibility whenever it changes. The app must NOT flip
   *     its own state here — this IS the source of truth for visibility.
   *
   * When this is set, `trayToggle` and the module's toggle shortcut should route
   * their toggles through `ctx`... — but to keep the shell the single owner, the
   * shell instead intercepts the suite toggle/tray path itself and calls
   * `applyActive`. Standalone (owned tray, no suite pipe) never suppresses, so
   * applyActive is only ever called with the plain toggled value there.
   */
  suiteSuppressible?: {
    initialActive: boolean;
    /** Drive the overlay to the given effective visibility. */
    applyActive: (active: boolean) => void;
  };
  /** What launching a second instance should do. Defaults to "focus-main". */
  secondInstance?: "focus-main" | "open-settings";
  onReady?: (ctx: PopAppContext<S>) => void;
  onWillQuit?: () => void;
  /**
   * Layout overrides for the PopSuite single-install build, where one Electron
   * binary hosts both modules and each module's renderer/preload/extraResources
   * live in a per-module subdirectory. Standalone builds omit this and get the
   * flat, historical paths (out/main → ../renderer/index.html, ../preload/index.js,
   * process.resourcesPath/tray-icon.png).
   */
  layout?: {
    /**
     * Renderer HTML relative to the main bundle's __dirname. Defaults to
     * "../renderer/index.html". Suite passes e.g. "../renderer/popjot/index.html".
     */
    rendererHtml?: string;
    /**
     * Preload script relative to the main bundle's __dirname. Defaults to
     * "../preload/index.js". Suite passes e.g. "../preload/popjot/index.js".
     */
    preloadScript?: string;
    /**
     * Subdirectory under process.resourcesPath (packaged) or ../../assets (dev)
     * where this module's tray/app icons live. Defaults to "" (flat). Suite
     * passes e.g. "popjot".
     */
    resourceSubdir?: string;
  };
}

/**
 * Minimal no-op context returned by the losing instance after it fails the
 * single-instance lock and calls app.quit(). Every method is inert so the
 * app's module-level `createPopApp(...)` call still resolves to a valid object
 * without running any side effects (no windows, no IPC, no file IO).
 */
function createInertContext<S extends SettingsSchema>(): PopAppContext<S> {
  return {
    settings: {} as SettingsValues<S>,
    getMainWindow: () => null,
    getSettingsWindow: () => null,
    sendToMainWindow: () => {},
    sendToRenderers: () => {},
    moveOverlayToCursorDisplay: () => {},
    setOverlayAlwaysOnTop: () => {},
    setTrayActive: () => {},
    isPro: () => false,
    getCursorDipPosition: () => ({ x: 0, y: 0 }),
    openSettingsWindow: () => {},
    reportSuiteAnnotating: () => {},
    suiteManualToggle: () => {},
    isSuiteSuppressed: () => false,
  };
}

export function createPopApp<S extends SettingsSchema>(
  options: PopAppOptions<S>
): PopAppContext<S> {
  const { appName, settingsSchema } = options;

  // Layout paths: flat by default (standalone build), per-module subdirs when
  // the suite passes overrides. Resolved once so every window + tray call agrees.
  const rendererHtmlRel = options.layout?.rendererHtml ?? "../renderer/index.html";
  const preloadScriptRel = options.layout?.preloadScript ?? "../preload/index.js";
  const resourceSubdir = options.layout?.resourceSubdir ?? "";

  // ─── Single instance lock ────────────────────────────────────────────
  // When we lose the lock a sibling instance is already running: quit and
  // return an inert context immediately. Registering IPC, creating settingsSync
  // (which does file IO), or scheduling whenReady work in the losing instance
  // would race the primary and touch the same settings files before quit lands.
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return createInertContext<S>();
  }

  // Suite reported mode only: install the recording shim over ipcMain.handle
  // BEFORE any invoke handler is registered below, so the settings relay can
  // answer a launcher-hosted renderer's invokes from this process. The shim only
  // records + delegates (real handler behavior is unchanged) and is never
  // installed for standalone/owned apps, which keep the untouched ipcMain.
  if (options.tray?.mode === "reported") {
    captureInvokeHandlers();
  }

  let mainWindow: BrowserWindow | null = null;
  let settingsWindow: BrowserWindow | null = null;
  // Periodic fallback for reassertOverlayAlwaysOnTop; cleared on will-quit.
  let overlayTopmostInterval: ReturnType<typeof setInterval> | null = null;
  let tray: Tray | null = null;
  // Idle/active tray images. The active variant (with an indicator dot) is
  // optional — apps that don't ship one fall back to the idle icon.
  let trayIdleImage: Electron.NativeImage | null = null;
  let trayActiveImage: Electron.NativeImage | null = null;
  let trayActive = false;
  let licenseController: LicenseController | null = null;
  // Suite unified-tray client. Only created when tray.mode === "reported". Null
  // in standalone/owned mode and after a fallback to a local tray.
  let suiteTrayClient: SuiteTrayClient | null = null;
  // Suite-only annotating flag (PopJot): reported up so the launcher can relay
  // it to PopKey as a suppress command. Always false for non-annotating apps.
  let suiteAnnotating = false;
  // Suite-only auto-suppression state (PopKey opts in via options.suiteSuppressible).
  // Null when the app doesn't participate. Tracks the user's requested visibility
  // separately from whether a sibling is currently forcing us hidden.
  let suppression: SuppressionState | null = options.suiteSuppressible
    ? initialSuppressionState(options.suiteSuppressible.initialActive)
    : null;
  // Settings-window relay (suite-only). Engaged while the launcher's single
  // settings window hosts THIS module's settings renderer in a WebContentsView:
  // that renderer runs in the launcher's process, so its IPC is tunnelled to us
  // here and our main→renderer pushes are streamed back. Null until connected;
  // inert (never `hosting`) unless the launcher opens our tab, so standalone is
  // completely unaffected. See suiteSettingsRelay.ts.
  let suiteSettingsRelay: SuiteSettingsRelay | null = null;

  const shortcutState: Record<string, string> = {};
  for (const sc of options.shortcuts) {
    shortcutState[sc.name] = sc.default;
  }

  function loadRendererWindow(win: BrowserWindow, query?: Record<string, string>): void {
    // Never spawn an Electron window for links; hand http(s)/mailto to the OS
    // browser and deny everything else.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });

    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      if (query) {
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
      }
      win.loadURL(url.toString());
      return;
    }

    win.loadFile(join(__dirname, rendererHtmlRel), query ? { query } : undefined);
  }

  function sendToRenderers(channel: string, value: unknown): void {
    mainWindow?.webContents.send(channel, value);
    settingsWindow?.webContents.send(channel, value);
    // While the launcher hosts our settings tab there is no local settings
    // window, so mirror settings-bound pushes into the relay too (no-op unless
    // hosting). The overlay (mainWindow) is unaffected — it always stays local.
    suiteSettingsRelay?.pushToHost(channel, [value]);
  }

  // ─── Settings IPC + cross-app sync ───────────────────────────────────

  // Two-tier persistence: this app's own settings file, plus the shared file
  // for keys the user opted to sync with the sibling app. `initialValues`
  // already merges per-app values with any enabled synced overrides.
  const settingsSync = createSettingsSync({
    appName,
    schema: settingsSchema,
    sendToRenderers,
    getValues: (): SettingsValues<S> => settingsController.values,
  });

  const settingsController = registerSettingsIpc(settingsSchema, {
    sendToRenderers,
    initialValues: settingsSync.initialValues,
    onChange: buildOnChange(),
    onKeyChange: (key, value) => settingsSync.onLocalChange(key, value),
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

  // ─── Open-at-login (platform-aware) ──────────────────────────────────

  // app.setLoginItemSettings / getLoginItemSettings are no-ops on Linux, so
  // there we manage an XDG autostart .desktop file by hand. Routing every
  // platform through these two helpers keeps the IPC + tray-sync read paths on
  // a single code path.

  function linuxAutostartPath(): string {
    return join(homedir(), ".config", "autostart", `${appName.toLowerCase()}.desktop`);
  }

  function getOpenAtLoginState(): boolean {
    if (process.platform === "linux") {
      return existsSync(linuxAutostartPath());
    }
    return app.getLoginItemSettings().openAtLogin;
  }

  function setOpenAtLoginState(enabled: boolean): void {
    if (process.platform === "linux") {
      const file = linuxAutostartPath();
      try {
        if (enabled) {
          // Prefer the AppImage path when running packaged as one; fall back to
          // the current executable. Quote it so paths with spaces still launch.
          const exec = process.env.APPIMAGE ?? process.execPath;
          const contents =
            "[Desktop Entry]\n" +
            "Type=Application\n" +
            `Name=${appName}\n` +
            `Exec="${exec}"\n` +
            "X-GNOME-Autostart-enabled=true\n";
          mkdirSync(join(homedir(), ".config", "autostart"), { recursive: true });
          writeFileSync(file, contents, "utf-8");
        } else if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (err) {
        // Best-effort, consistent with settings persistence.
        console.error(`Failed to update Linux autostart entry: ${String(err)}`);
      }
      return;
    }
    app.setLoginItemSettings({ openAtLogin: enabled });
  }

  function syncTraySettingsToWindow(win: BrowserWindow): void {
    settingsController.syncToWindow(win);
    win.webContents.send("tray-open-at-login", getOpenAtLoginState());
    for (const name of Object.keys(shortcutState)) {
      win.webContents.send(`tray-set-${name}-shortcut`, shortcutState[name]);
    }
  }

  /**
   * Seed the launcher-hosted settings renderer with the same initial state
   * `syncTraySettingsToWindow` pushes into a local window: every non-volatile
   * setting value, the open-at-login flag, and each shortcut. Sent through the
   * relay (not a window) when the launcher opens/refreshes our settings tab so
   * the hosted UI renders the real values on load, exactly like a local window.
   */
  function seedHostedSettings(): void {
    if (!suiteSettingsRelay?.hosting) return;
    for (const key of Object.keys(settingsSchema) as Array<keyof S & string>) {
      if (settingsSchema[key].volatile) continue;
      suiteSettingsRelay.pushToHost(trayChannel(key), [settingsController.values[key]]);
    }
    suiteSettingsRelay.pushToHost("tray-open-at-login", [getOpenAtLoginState()]);
    for (const name of Object.keys(shortcutState)) {
      suiteSettingsRelay.pushToHost(`tray-set-${name}-shortcut`, [shortcutState[name]]);
    }
    // License status is pushed by the license controller via sendToRenderers on
    // change; the hosted renderer also pulls it with a license:status invoke on
    // mount, so no separate seed is needed here.
  }

  // ─── Multi-monitor helpers ───────────────────────────────────────────

  function moveOverlayToCursorDisplay(): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { x, y, width, height } = display.bounds;
    mainWindow.setBounds({ x, y, width, height });
  }

  // Overlay z-order level used when pinned on top. Kept as a constant so
  // window creation and later re-pins stay in sync.
  const OVERLAY_TOP_LEVEL = "screen-saver" as const;

  // Desired on-top state, independent of what Windows may have silently
  // reverted behind our back (see reassertOverlayAlwaysOnTop below).
  let wantsOverlayAlwaysOnTop = true;

  function setOverlayAlwaysOnTop(onTop: boolean): void {
    wantsOverlayAlwaysOnTop = onTop;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (onTop) {
      mainWindow.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL);
    } else {
      mainWindow.setAlwaysOnTop(false);
    }
  }

  // The Windows taskbar can reclaim topmost z-order on its own (e.g. on
  // auto-hide/show, or when Explorer restarts) without notifying us, which
  // leaves the overlay rendering underneath it. Re-pin whenever the work
  // area changes (taskbar show/hide/resize) and on a light poll as a
  // fallback for cases that fire no event at all.
  function reassertOverlayAlwaysOnTop(): void {
    if (!wantsOverlayAlwaysOnTop) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL);
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
        preload: join(__dirname, preloadScriptRel),
        contextIsolation: true,
      },
    });

    win.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL);
    // macOS: show the overlay over fullscreen apps and on every Space. Marking it
    // non-fullscreenable keeps it from ever entering its own fullscreen Space
    // (which would hide it behind the app the user is drawing over).
    if (process.platform === "darwin") {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setFullScreenable(false);
    }
    // No { forward: true } — we don't need hover detection on the transparent window.
    // Forwarding keeps the window in the input pipeline and can intercept synthetic
    // right/middle-click events from tablet drivers (e.g. Huion stylus buttons).
    win.setIgnoreMouseEvents(true);

    loadRendererWindow(win);

    // Push the loaded settings (persisted from disk, or synced from the sibling
    // app) into the overlay once its content is ready. Without this the overlay
    // renders with schema defaults every launch and only picks up the real
    // values if the user happens to open the Settings window, which has its own
    // did-finish-load sync below.
    win.webContents.on("did-finish-load", () => {
      syncTraySettingsToWindow(win);
    });

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

  function trayIconPath(file = "tray-icon.png"): string {
    // Packaged: extraResources land under process.resourcesPath, namespaced by
    // resourceSubdir in the suite ("" for standalone). Dev: icons live in the
    // module's assets dir; SUITE_ASSETS_DIR (set by the suite dev entry) points
    // at the composed module's assets, otherwise fall back to ../../assets.
    if (app.isPackaged) {
      return join(process.resourcesPath, resourceSubdir, file);
    }
    const devAssets = process.env.SUITE_ASSETS_DIR ?? join(__dirname, "../../assets");
    return join(devAssets, file);
  }

  /**
   * Swap the tray icon between its idle and active (indicator-dot) variants.
   * No-ops gracefully if the app didn't ship an active icon.
   */
  function setTrayActive(active: boolean): void {
    trayActive = active;
    // Suite reported mode: push the new active state to the launcher so its
    // unified menu checkmark/label stays current (e.g. after a shortcut toggle).
    reportSuiteState();
    if (!tray || tray.isDestroyed()) return;
    const next = active && trayActiveImage ? trayActiveImage : trayIdleImage;
    if (next) tray.setImage(next);
    // Linux uses a persisted context menu (see createTray), so the Enable/Disable
    // label must be rebuilt whenever the active state — and thus the label — changes.
    refreshLinuxTrayMenu();
  }

  // Assigned in createTray on Linux; a no-op elsewhere (where the menu is built
  // fresh per right-click instead of persisted).
  let refreshLinuxTrayMenu: () => void = () => {};

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
        preload: join(__dirname, preloadScriptRel),
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
    // While the launcher's single settings window hosts our settings tab, the
    // module must not also open a local window — the launcher's window covers it.
    // (The launcher opens/selects the tab itself; it never relays a settings
    // action to us in that case.) Standalone / fallback keeps the local window.
    if (suiteSettingsRelay?.hosting) return;

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

  // ─── Suite auto-suppression (PopKey) ─────────────────────────────────
  // Drive the overlay to the current effective visibility (userRequested AND NOT
  // suppressed) and keep the suite tray's autoSuppressed label current. Only ever
  // does anything when the app opted in via options.suiteSuppressible.

  function applyEffectiveActive(): void {
    if (!suppression || !options.suiteSuppressible) return;
    options.suiteSuppressible.applyActive(effectiveActive(suppression));
    // Reflect the (possibly changed) active/suppressed state in the unified tray.
    reportSuiteState();
  }

  function suiteManualToggle(): void {
    if (!suppression) return;
    suppression = applyManualToggle(suppression);
    applyEffectiveActive();
  }

  function applySuiteSuppression(suppressed: boolean): void {
    if (!suppression) return;
    suppression = applySuppression(suppression, suppressed);
    applyEffectiveActive();
  }

  function clearSuiteSuppression(): void {
    if (!suppression) return;
    const wasSuppressed = suppression.suppressed;
    suppression = clearSuppression(suppression);
    // Only re-drive the overlay if we actually were suppressed, so a normal
    // fallback (never suppressed) doesn't needlessly touch the renderer.
    if (wasSuppressed) applyEffectiveActive();
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
    setOverlayAlwaysOnTop,
    setTrayActive,
    isPro: () => licenseController?.isPro() ?? false,
    getCursorDipPosition,
    openSettingsWindow,
    reportSuiteAnnotating: (annotating: boolean) => {
      // Only meaningful in suite reported mode; harmless otherwise (no client →
      // report is a no-op). Re-report only on an actual change to avoid pipe spam.
      if (suiteAnnotating === annotating) return;
      suiteAnnotating = annotating;
      reportSuiteState();
    },
    suiteManualToggle,
    isSuiteSuppressed: () => suppression?.suppressed ?? false,
  };

  // ─── Common IPC ──────────────────────────────────────────────────────

  ipcMain.on("quit-app", () => {
    app.quit();
  });

  // Open a link in the user's default browser (not a new Electron window).
  // Restricted to http/https/mailto so a renderer can't open arbitrary URIs.
  ipcMain.on("open-external", (_event, url: unknown) => {
    if (typeof url !== "string") return;
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
  });

  // Clipboard read lives in main: the sandboxed preload can't access the
  // electron `clipboard` module. Used by the license field's Paste button.
  ipcMain.handle("read-clipboard", () => clipboard.readText());

  ipcMain.on("close-window", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.hide();
    }
  });

  ipcMain.handle("get-open-at-login", () => {
    return getOpenAtLoginState();
  });

  ipcMain.on("set-open-at-login", (_event, enabled: boolean) => {
    setOpenAtLoginState(Boolean(enabled));
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
        // Keep the suite menu's shortcut hint current after a rebind.
        reportSuiteState();
        return { ok: true, shortcut: electronFormat };
      }
      return result;
    });
  }

  ipcMain.handle("get-shortcuts", () => ({ ...shortcutState }));

  // ─── System tray ─────────────────────────────────────────────────────

  function showAboutDialog(): void {
    dialog.showMessageBox({
      type: "info",
      title: `About ${appName}`,
      message: appName,
      detail: `Version ${app.getVersion()}\n${options.aboutDetail}`,
      buttons: ["OK"],
    });
  }

  function createTray(): void {
    const iconPath = trayIconPath();
    trayIdleImage = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();

    const activePath = trayIconPath("tray-icon-active.png");
    trayActiveImage = existsSync(activePath) ? nativeImage.createFromPath(activePath) : null;

    tray = new Tray(trayActive && trayActiveImage ? trayActiveImage : trayIdleImage);
    tray.setToolTip(appName);

    const buildTrayMenu = () => {
      const sep: Electron.MenuItemConstructorOptions = { type: "separator" };
      const toggleItem: Electron.MenuItemConstructorOptions[] = options.trayToggle
        ? [
            {
              label: options.trayToggle.getEnabled()
                ? `Disable ${appName}`
                : `Enable ${appName}`,
              click: () => {
                options.trayToggle!.onToggle();
                // Keep the persisted Linux menu label current even if an app's
                // onToggle didn't route through setTrayActive.
                refreshLinuxTrayMenu();
              },
            },
            sep,
          ]
        : [];

      return Menu.buildFromTemplate([
        {
          label: appName,
          enabled: false,
        },
        { type: "separator" },
        ...toggleItem,
        {
          label: options.tray?.settingsLabel ?? "Settings",
          click: () => openSettingsWindow(),
        },
        {
          label: "About",
          click: () => showAboutDialog(),
        },
        { type: "separator" },
        {
          label: `Quit ${appName}`,
          click: () => app.quit(),
        },
      ]);
    };

    if (options.tray?.doubleClickOpensSettings) {
      tray.on("double-click", () => openSettingsWindow());
    }

    if (process.platform === "linux") {
      // Linux (libappindicator) does not emit "right-click" and does not support
      // popUpContextMenu, so the per-click approach below leaves the menu
      // unreachable. Use a persisted context menu instead, and rebuild it via
      // refreshLinuxTrayMenu whenever the Enable/Disable label would change.
      refreshLinuxTrayMenu = () => {
        if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
      };
      refreshLinuxTrayMenu();
      return;
    }

    // win32 / darwin: build a fresh menu per click and pass it directly to
    // popUpContextMenu. We intentionally never call setContextMenu — a persisted
    // menu makes Windows auto-show the *previous* menu on right-click (stale by
    // one click), so the Enable/Disable label would lag a step behind the real state.
    tray.on("right-click", () => {
      tray?.popUpContextMenu(buildTrayMenu());
    });
  }

  // ─── Suite unified tray (reported mode) ──────────────────────────────
  // In the suite build the launcher owns ONE tray icon; this module reports its
  // state over a pipe instead of creating its own tray. Extra actions map to the
  // same handlers the local tray uses (open settings, about). If the pipe is
  // unavailable at connect time or drops later, we fall back to a local tray so
  // the module always has a working tray (standalone parity / graceful degrade).

  // Action ids kept stable so the launcher can echo them back unambiguously.
  const SUITE_ACTION_SETTINGS = "settings";
  const SUITE_ACTION_ABOUT = "about";

  function suiteActions(): SuiteTrayAction[] {
    return [
      { id: SUITE_ACTION_SETTINGS, label: options.tray?.settingsLabel ?? "Settings" },
      { id: SUITE_ACTION_ABOUT, label: "About" },
    ];
  }

  function currentSuiteState(): SuiteModuleState {
    // For a suppressible app the reported `active` is the user's REQUESTED state
    // (so the tray checkbox tracks what they asked for), not the effective/hidden
    // state — the auto-hidden condition is surfaced separately via autoSuppressed.
    const enabled = suppression
      ? suppression.userRequested
      : options.trayToggle
        ? options.trayToggle.getEnabled()
        : trayActive;
    return {
      appName,
      active: enabled,
      shortcuts: Object.values(shortcutState),
      toggleLabel: options.trayToggle
        ? enabled
          ? `Disable ${appName}`
          : `Enable ${appName}`
        : undefined,
      canToggle: Boolean(options.trayToggle),
      actions: suiteActions(),
      // Only annotating apps (PopJot) ever set this; false otherwise.
      annotating: suiteAnnotating ? true : undefined,
      // Only suppressible apps (PopKey) ever set this; reflects a sibling forcing
      // us hidden right now so the launcher can label the entry "(auto-hidden)".
      autoSuppressed: suppression?.suppressed ? true : undefined,
    };
  }

  function reportSuiteState(): void {
    suiteTrayClient?.report(currentSuiteState());
  }

  // Control channels the launcher-hosted settings preload uses (over the relay's
  // send path) to bracket a hosting session: start when the WebContentsView's
  // renderer has mounted (begin serving + seed initial state), stop when the tab
  // or window goes away (fall back to local behavior). Kept as reserved channel
  // names so they can't collide with a real settings IPC channel.
  const SUITE_HOST_START = "__suite_host_start";
  const SUITE_HOST_STOP = "__suite_host_stop";

  function connectSuiteTray(): void {
    // Create the settings relay for this connection. It captures our invoke
    // handlers up front (a no-op recording shim over ipcMain.handle) so a relayed
    // invoke from the hosted renderer can be answered from this process, and it
    // forwards our main→renderer pushes up the pipe while hosting.
    suiteSettingsRelay = createSuiteSettingsRelay((channel, args) =>
      suiteTrayClient?.relayPush(channel, args)
    );

    suiteTrayClient = createSuiteTrayClient(
      {
        onToggle: () => {
          options.trayToggle?.onToggle();
          reportSuiteState();
        },
        onAction: (id) => {
          if (id === SUITE_ACTION_SETTINGS) openSettingsWindow();
          else if (id === SUITE_ACTION_ABOUT) showAboutDialog();
        },
        onQuit: () => app.quit(),
        onSuppress: (suppressed) => {
          // Launcher relayed PopJot's annotating state: force-hide / restore.
          applySuiteSuppression(suppressed);
        },
        onRelaySend: (channel, args) => {
          // Settings-window relay: a fire-and-forget IPC from our hosted renderer.
          // The two reserved control channels bracket a hosting session; everything
          // else is replayed against our own ipcMain listeners.
          if (channel === SUITE_HOST_START) {
            suiteSettingsRelay?.start();
            // Seed the freshly-mounted hosted renderer with current settings so it
            // shows real values immediately, just like a local window's load.
            seedHostedSettings();
            return;
          }
          if (channel === SUITE_HOST_STOP) {
            suiteSettingsRelay?.stop();
            return;
          }
          suiteSettingsRelay?.handleSend(channel, args);
        },
        onRelayInvoke: (channel, args) =>
          // Answer a relayed request/response invoke against our own handler.
          suiteSettingsRelay
            ? suiteSettingsRelay.handleInvoke(channel, args)
            : Promise.reject(new Error("relay unavailable")),
      },
      {
        onReady: () => reportSuiteState(),
        onUnavailable: () => {
          // Launcher absent or gone: drop the client and stand up a local tray so
          // this module is never left without one. Also clear any auto-suppression
          // so a PopKey that was hidden by PopJot isn't stuck hidden forever once
          // the suite glue is gone — the user regains normal manual control. Drop
          // the relay too so any later local settings window behaves normally.
          suiteSettingsRelay?.stop();
          suiteSettingsRelay = null;
          suiteTrayClient?.dispose();
          suiteTrayClient = null;
          clearSuiteSuppression();
          if (!tray || tray.isDestroyed()) createTray();
        },
      }
    );
  }

  // ─── App lifecycle ───────────────────────────────────────────────────

  app.whenReady().then(() => {
    if (options.proProduct) {
      licenseController = createLicenseController(options.proProduct, (status) =>
        sendToRenderers("license-changed", status)
      );
      registerLicenseIpc(licenseController, sendToRenderers);
    }

    mainWindow = createWindow();

    // Re-pin the overlay above the taskbar whenever the work area changes
    // (taskbar auto-hide/show, display changes) and on a light poll, since
    // Windows can silently reclaim topmost without firing any event.
    screen.on("display-metrics-changed", reassertOverlayAlwaysOnTop);
    overlayTopmostInterval = setInterval(reassertOverlayAlwaysOnTop, 2000);

    if (options.tray?.mode === "reported") {
      // Suite: hand our tray to the launcher's unified icon. Falls back to a
      // local tray inside connectSuiteTray if the launcher isn't reachable.
      connectSuiteTray();
    } else {
      createTray();
    }

    // Register sync IPC + start watching the shared file for the sibling app's
    // changes (applies enabled synced values and live-updates toggle state).
    settingsSync.start();

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
    screen.removeListener("display-metrics-changed", reassertOverlayAlwaysOnTop);
    if (overlayTopmostInterval) {
      clearInterval(overlayTopmostInterval);
      overlayTopmostInterval = null;
    }
    suiteSettingsRelay?.stop();
    suiteSettingsRelay = null;
    suiteTrayClient?.dispose();
    suiteTrayClient = null;
    settingsSync.dispose();
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
