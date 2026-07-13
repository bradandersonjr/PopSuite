/**
 * One desktop-only settings BrowserWindow and one renderer.
 *
 * The renderer mounts either PopJot or PopKey settings and switches its preload
 * API between the existing namespaced IPC bridges. Overlay windows remain
 * separate and never participate in this window.
 */

import { app, BrowserWindow, ipcMain, nativeImage } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SuiteTrayServer } from "@shared/main/suiteTrayServer";
import type { ModuleToLauncher } from "@shared/main/suiteTray";

type ModuleId = "popjot" | "popkey";

type SettingsState = {
  activeId: ModuleId;
  tabs: Array<{ id: ModuleId; label: string; connected: boolean }>;
};

const WINDOW_WIDTH = 1160;
const WINDOW_HEIGHT = 860;
const WINDOW_MIN_WIDTH = 900;
const WINDOW_MIN_HEIGHT = 640;

const MODULE_TABS: ReadonlyArray<{ id: ModuleId; label: string }> = [
  { id: "popjot", label: "PopJot" },
  { id: "popkey", label: "PopKey" },
];

const HOST_START = "__suite_host_start";
const HOST_STOP = "__suite_host_stop";

const STATE_CHANNEL = "suite:settings-state";
const STATE_CHANGED_CHANNEL = "suite:settings-state-changed";
const SELECT_CHANNEL = "suite:settings-select";
const SEED_CHANNEL = "suite:settings-seed";
const CLOSE_CHANNEL = "suite:settings-close";
const PRESETS_SYNC_CHANNEL = "suite:presets-sync";
const PRESETS_APPLY_CHANNEL = "suite:presets-apply";
// Renderer -> main ack sent once a tray-triggered preset apply has dispatched
// all its settings IPC, so a window created solely to run the apply (never
// shown) can be torn down instead of lingering invisibly.
const PRESETS_APPLY_DONE_CHANNEL = "suite:presets-apply-done";
// Renderer -> main: the presets panel has mounted and attached its apply
// listener. This is the ONLY trigger that flushes a queued tray apply into a
// loading window. Flushing any earlier (e.g. on did-finish-load) races React's
// effect subscription: the apply would be sent into a renderer with no
// listener and dropped, while pendingApplyId is cleared — a silent no-op.
const PRESETS_READY_CHANNEL = "suite:presets-ready";

// Grace period after the renderer acks a tray apply before a hidden apply-only
// window is destroyed, so the fire-and-forget setting IPCs it dispatched reach
// the module processes first. Also the hard fallback if no ack ever arrives
// (renderer error / old renderer): the window is torn down regardless so it
// never lingers invisibly holding the settings relay.
const HIDDEN_APPLY_TEARDOWN_MS = 1500;

/** Tray-visible index of the renderer's presets. Names only — the full data
 *  stays in the renderer's localStorage; the tray just needs to list + apply. */
export interface SuitePresetsIndex {
  presets: Array<{ id: string; name: string }>;
  isPro: boolean;
}

export interface SuiteSettingsWindow {
  open(moduleId: string): void;
  routeRelay(appName: string, msg: ModuleToLauncher): void;
  refreshConnState(): void;
  /** Current preset index (id + name + Pro), for building the tray submenu. */
  getPresets(): SuitePresetsIndex;
  /** Apply a preset by id from the tray: opens the window (needed for the
   *  settings relay) and tells the renderer to run its apply path. */
  applyPreset(id: string): void;
  dispose(): void;
}

function moduleId(value: unknown): ModuleId | null {
  return value === "popjot" || value === "popkey" ? value : null;
}

function appNameForModule(id: ModuleId): string {
  return id === "popjot" ? "PopJot" : "PopKey";
}

export function createSuiteSettingsWindow(
  dirname: string,
  trayServer: SuiteTrayServer,
  iconPath: string,
  onPresetsChanged?: () => void,
): SuiteSettingsWindow {
  let win: BrowserWindow | null = null;
  let windowReady = false;
  let activeId: ModuleId = "popjot";
  // A preset id to hand the renderer once it's ready to host, when apply was
  // requested from the tray while the window was closed/still loading.
  let pendingApplyId: string | null = null;
  // Why the current window exists. "visible" is a normal Settings window the
  // user opened; "hidden-apply" is a window created only to run a tray preset
  // apply — it must never show, and is destroyed once the apply completes. A
  // later open() promotes a "hidden-apply" window to "visible".
  let windowPurpose: "visible" | "hidden-apply" = "visible";
  // Timer that tears down a hidden apply-only window after the renderer acks (or
  // after a fallback timeout). Cleared if the window is promoted/closed first.
  let hiddenApplyTeardown: ReturnType<typeof setTimeout> | null = null;

  const presetsFile = join(app.getPath("userData"), "suite-presets-index.json");

  function loadPresetsIndex(): SuitePresetsIndex {
    try {
      const raw = readFileSync(presetsFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<SuitePresetsIndex>;
      if (Array.isArray(parsed.presets)) {
        return { presets: parsed.presets, isPro: !!parsed.isPro };
      }
    } catch {
      // Missing or malformed — start empty.
    }
    return { presets: [], isPro: false };
  }

  let presetsIndex: SuitePresetsIndex = loadPresetsIndex();

  const rendererHtml = join(
    dirname,
    "..",
    "renderer",
    "settings",
    "index.html",
  );
  const preloadJs = join(dirname, "suiteSettings", "preload.js");

  function state(): SettingsState {
    return {
      activeId,
      tabs: MODULE_TABS.map((tab) => ({
        ...tab,
        connected: trayServer.isConnected(tab.label),
      })),
    };
  }

  function pushState(): void {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(STATE_CHANGED_CHANNEL, state());
  }

  function startHosting(id: ModuleId): void {
    trayServer.relaySend(appNameForModule(id), HOST_START, []);
  }

  function stopHosting(): void {
    for (const tab of MODULE_TABS) {
      trayServer.relaySend(tab.label, HOST_STOP, []);
    }
  }

  function clearHiddenApplyTeardown(): void {
    if (hiddenApplyTeardown) {
      clearTimeout(hiddenApplyTeardown);
      hiddenApplyTeardown = null;
    }
  }

  function destroyWindow(): void {
    clearHiddenApplyTeardown();
    if (win && !win.isDestroyed()) win.destroy();
  }

  /**
   * Promote a hidden apply-only window to a normal visible Settings window: an
   * open() arrived while a tray apply was still running. Cancel its scheduled
   * teardown and show it. Safe to call when the window is already visible.
   */
  function promoteToVisible(): void {
    windowPurpose = "visible";
    clearHiddenApplyTeardown();
    if (!win || win.isDestroyed()) return;
    if (!windowReady) return; // ready-to-show will show it (purpose is now visible)
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }

  function ensureWindow(): void {
    if (win && !win.isDestroyed()) return;

    win = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      minWidth: WINDOW_MIN_WIDTH,
      minHeight: WINDOW_MIN_HEIGHT,
      frame: false,
      show: false,
      title: "PopSuite Settings",
      // Matches the settings panel surface (bg-[#202020] in app/src/settings/main.tsx)
      // so the native window paints the same gray before the renderer loads.
      backgroundColor: "#202020",
      icon: existsSync(iconPath)
        ? nativeImage.createFromPath(iconPath)
        : undefined,
      webPreferences: {
        preload: preloadJs,
        contextIsolation: true,
        partition: "persist:popsuite-settings",
        // A tray preset apply runs this renderer in a window that is never
        // shown; Chromium background-throttles hidden renderers, which would
        // stall React mounting and the apply. Keep the renderer at full speed.
        backgroundThrottling: false,
      },
    });

    void win.loadFile(rendererHtml, { query: { settings: "1" } });

    win.once("ready-to-show", () => {
      if (!win || win.isDestroyed()) return;
      windowReady = true;
      pushState();
      // A window created only to run a tray preset apply stays hidden — showing
      // it is exactly the regression this guards against. It is torn down once
      // the renderer acks the apply (see flushPendingApply / the ack handler).
      if (windowPurpose === "hidden-apply") return;
      win.show();
      win.focus();
    });

    // NOTE: deliberately no flushPendingApply here. did-finish-load fires
    // BEFORE React mounts and attaches the suite:presets-apply listener, so
    // flushing now would send the apply into a renderer with no listener and
    // clear pendingApplyId — silently dropping the apply. The renderer sends
    // suite:presets-ready once its listener is attached; that is the only
    // trigger that flushes a queued apply.
    win.webContents.on("did-finish-load", () => {
      pushState();
    });

    win.on("closed", () => {
      clearHiddenApplyTeardown();
      stopHosting();
      windowReady = false;
      win = null;
    });
  }

  const onSelect = (_event: Electron.IpcMainEvent, value: unknown) => {
    const id = moduleId(value);
    if (!id) return;
    activeId = id;
    pushState();
  };

  const onSeed = (_event: Electron.IpcMainEvent, value: unknown) => {
    const id = moduleId(value);
    if (id) startHosting(id);
  };

  const onClose = () => destroyWindow();

  const onPresetsSync = (_event: Electron.IpcMainEvent, value: unknown) => {
    const payload = value as Partial<SuitePresetsIndex> | undefined;
    const presets = Array.isArray(payload?.presets)
      ? payload.presets
          .filter(
            (p): p is { id: string; name: string } =>
              !!p && typeof p.id === "string" && typeof p.name === "string",
          )
          .map((p) => ({ id: p.id, name: p.name }))
      : [];
    presetsIndex = { presets, isPro: !!payload?.isPro };
    try {
      writeFileSync(presetsFile, JSON.stringify(presetsIndex), "utf8");
    } catch {
      // Best-effort; the tray falls back to the last-known index in memory.
    }
    onPresetsChanged?.();
  };

  /**
   * Schedule teardown of a hidden apply-only window. Called when the renderer
   * acks the apply (short grace so the fire-and-forget setting IPCs land first)
   * and armed as a fallback right after we send the apply, so the window never
   * lingers invisibly even if the ack is missed.
   */
  function scheduleHiddenApplyTeardown(): void {
    if (windowPurpose !== "hidden-apply") return;
    clearHiddenApplyTeardown();
    hiddenApplyTeardown = setTimeout(() => {
      hiddenApplyTeardown = null;
      // An open() may have promoted the window meanwhile — only tear down while
      // it is still a hidden apply-only window.
      if (windowPurpose === "hidden-apply") destroyWindow();
    }, HIDDEN_APPLY_TEARDOWN_MS);
  }

  /** Send a queued tray-apply once the renderer's apply listener is attached
   *  (signaled via PRESETS_READY_CHANNEL — see its doc comment for why this
   *  must not run any earlier). */
  function flushPendingApply(): void {
    if (pendingApplyId === null) return;
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(PRESETS_APPLY_CHANNEL, pendingApplyId);
    pendingApplyId = null;
    // If this window exists only to run the apply, arm the fallback teardown now
    // (the ack shortens it). A visible window is left as-is.
    scheduleHiddenApplyTeardown();
  }

  // Renderer finished dispatching a tray apply: tear down a hidden apply-only
  // window after a short grace so its setting IPCs reach the modules first. A
  // visible/promoted window ignores this and stays open.
  // Presets panel mounted + subscribed: deliver any queued tray apply now.
  const onPresetsReady = () => flushPendingApply();

  const onApplyDone = () => {
    if (windowPurpose !== "hidden-apply") return;
    clearHiddenApplyTeardown();
    hiddenApplyTeardown = setTimeout(() => {
      hiddenApplyTeardown = null;
      if (windowPurpose === "hidden-apply") destroyWindow();
    }, 300);
  };

  ipcMain.handle(STATE_CHANNEL, () => state());
  ipcMain.on(SELECT_CHANNEL, onSelect);
  ipcMain.on(SEED_CHANNEL, onSeed);
  ipcMain.on(CLOSE_CHANNEL, onClose);
  ipcMain.on(PRESETS_SYNC_CHANNEL, onPresetsSync);
  ipcMain.on(PRESETS_APPLY_DONE_CHANNEL, onApplyDone);
  ipcMain.on(PRESETS_READY_CHANNEL, onPresetsReady);

  return {
    open(value): void {
      activeId = moduleId(value) ?? activeId;
      // A user-initiated open always wants a visible window. If a hidden
      // apply-only window is currently running, promote it instead of creating
      // a second one; otherwise create fresh (purpose defaults to visible).
      const hadHiddenApply =
        !!win && !win.isDestroyed() && windowPurpose === "hidden-apply";
      windowPurpose = "visible";
      ensureWindow();
      if (!win) return;
      pushState();
      if (hadHiddenApply) {
        promoteToVisible();
        return;
      }
      if (!windowReady) return;
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    },

    routeRelay(_appName, msg): void {
      if (msg.type !== "relayPush") return;
      if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
      win.webContents.send(msg.channel, ...msg.args);
    },

    refreshConnState(): void {
      pushState();
    },

    getPresets(): SuitePresetsIndex {
      return presetsIndex;
    },

    applyPreset(id): void {
      // Applying from the tray must never open/steal focus. The renderer still
      // has to run (it owns the preset data + dispatches the settings IPC), so:
      //   - Already-visible window: just send the apply; leave it visible and
      //     don't touch focus.
      //   - No window / still loading: create a HIDDEN apply-only window, run the
      //     apply, then tear it down once the renderer acks (or on a fallback
      //     timeout) so nothing lingers invisibly holding the settings relay.
      const wasReady =
        !!win && !win.isDestroyed() && windowReady && !win.webContents.isDestroyed();

      if (wasReady && win) {
        // Existing window: preserve its current purpose (visible stays visible).
        // No new hidden-apply teardown is scheduled for a visible window.
        win.webContents.send(PRESETS_APPLY_CHANNEL, id);
        if (windowPurpose === "hidden-apply") scheduleHiddenApplyTeardown();
        return;
      }

      // Creating (or waiting on) a window purely to run the apply — keep it hidden.
      if (!win || win.isDestroyed()) windowPurpose = "hidden-apply";
      pendingApplyId = id;
      ensureWindow();
    },

    dispose(): void {
      ipcMain.removeHandler(STATE_CHANNEL);
      ipcMain.removeListener(SELECT_CHANNEL, onSelect);
      ipcMain.removeListener(SEED_CHANNEL, onSeed);
      ipcMain.removeListener(CLOSE_CHANNEL, onClose);
      ipcMain.removeListener(PRESETS_SYNC_CHANNEL, onPresetsSync);
      ipcMain.removeListener(PRESETS_APPLY_DONE_CHANNEL, onApplyDone);
      ipcMain.removeListener(PRESETS_READY_CHANNEL, onPresetsReady);
      destroyWindow();
      win = null;
    },
  };
}
