/**
 * Launcher-owned settings window (the "one window, instant tabs" surface).
 *
 * The launcher creates ONE frameless BrowserWindow containing:
 *   - a thin tab-strip WebContentsView at the top (its own tabStrip.html, no
 *     dependency on either module's settings bundle), and
 *   - one settings WebContentsView PER MODULE, each loading that module's REAL
 *     settings renderer (out/renderer/<id>/index.html?settings=1) via the hosted
 *     preload, which tunnels the renderer's IPC over the suite pipe to the owning
 *     module process. Only the active tab's view is visible; switching tabs just
 *     re-lays-out the views (attach/detach) — never reload — so scroll and
 *     in-progress form state survive flipping back and forth.
 *
 * If a module process isn't connected, its tab shows a graceful placeholder
 * instead of a blank/broken view; the other tab keeps working independently.
 *
 * Standalone modules are unaffected: this window only exists in the launcher
 * process, and the launcher only ever opens it (it never relays a settings
 * action to a module), so a module with no launcher still creates its own local
 * settings window exactly as before.
 */

import { BaseWindow, WebContentsView, ipcMain, nativeImage } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import type { SuiteTrayServer } from "@shared/main/suiteTrayServer";
import type { ModuleToLauncher } from "@shared/main/suiteTray";

/** A hosted module: its id, display label, and settings WebContentsView. */
interface ModuleTab {
  id: string;
  label: string;
  view: WebContentsView;
  /** True once the module's renderer has loaded at least once (view is live). */
  loaded: boolean;
}

const WINDOW_WIDTH = 1160;
const WINDOW_HEIGHT = 860;
const WINDOW_MIN_WIDTH = 900;
const WINDOW_MIN_HEIGHT = 640;
const TAB_STRIP_HEIGHT = 40;

/** Modules the suite ships, in tab order, with their display labels. */
const MODULE_TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "popjot", label: "PopJot" },
  { id: "popkey", label: "PopKey" },
];

export interface SuiteSettingsWindow {
  /** Open (creating if needed) and focus the window, selecting `moduleId`'s tab. */
  open(moduleId: string): void;
  /**
   * Route a module→launcher relay message (invoke result / main→renderer push)
   * into the matching hosted settings view. Wired to the tray server's onRelay.
   */
  routeRelay(appName: string, msg: ModuleToLauncher): void;
  /** Rebuild tab-strip state after a module connect/disconnect (refresh dimming). */
  refreshConnState(): void;
  /** Destroy the window and all views (launcher shutdown). */
  dispose(): void;
}

/** Map a module id (popjot) to the appName it reports over the pipe (PopJot). */
function appNameForModule(id: string): string {
  return MODULE_TABS.find((m) => m.id === id)?.label ?? id;
}
function moduleForAppName(appName: string): string | undefined {
  return MODULE_TABS.find((m) => m.label === appName)?.id;
}

/**
 * Create the launcher's settings-window controller.
 *   - `dirname` is the launcher bundle's __dirname (out/main), used to resolve
 *     each module's renderer/preload in the packaged out/ tree and this window's
 *     own tab-strip/placeholder/preload assets (emitted beside the launcher).
 *   - `trayServer` relays settings IPC to the module processes and reports which
 *     modules are connected.
 *   - `iconPath` is the window icon (reuses the suite tray icon).
 */
export function createSuiteSettingsWindow(
  dirname: string,
  trayServer: SuiteTrayServer,
  iconPath: string
): SuiteSettingsWindow {
  let win: BaseWindow | null = null;
  let tabStrip: WebContentsView | null = null;
  let placeholder: WebContentsView | null = null;
  const tabs = new Map<string, ModuleTab>();
  let activeId = MODULE_TABS[0].id;

  // ─── Asset path resolution (mirrors moduleRuntime's layout) ──────────────
  // Launcher runs from out/main/index.js. A module's settings renderer lives at
  // out/renderer/<id>/index.html and its preload at out/preload/<id>/index.js —
  // i.e. ../renderer/<id>/... and ../preload/<id>/... from out/main. This
  // window's own assets are emitted beside the launcher at out/main/suiteSettings.
  const moduleRendererHtml = (id: string): string =>
    join(dirname, "..", "renderer", id, "index.html");
  const modulePreloadJs = (id: string): string =>
    join(dirname, "..", "preload", id, "index.js");
  const hostedPreloadJs = join(dirname, "suiteSettings", "hostedPreload.js");
  const tabStripPreloadJs = join(dirname, "suiteSettings", "tabStripPreload.js");
  const tabStripHtml = join(dirname, "suiteSettings", "tabStrip.html");
  const placeholderHtml = join(dirname, "suiteSettings", "placeholder.html");

  // ─── Layout ──────────────────────────────────────────────────────────────
  // Tab strip spans the top; the active settings view (or the placeholder) fills
  // the rest. Inactive views are detached so only one renders. Recomputed on
  // resize and on every tab switch.
  function relayout(): void {
    if (!win) return;
    const [w, h] = win.getContentSize();
    tabStrip?.setBounds({ x: 0, y: 0, width: w, height: TAB_STRIP_HEIGHT });
    const body = { x: 0, y: TAB_STRIP_HEIGHT, width: w, height: Math.max(0, h - TAB_STRIP_HEIGHT) };

    const active = tabs.get(activeId);
    const connected = trayServer.isConnected(appNameForModule(activeId));

    // Show the module view when its process is connected; otherwise show the
    // placeholder so the tab is never a blank/broken surface.
    for (const tab of tabs.values()) {
      const show = tab.id === activeId && connected;
      tab.view.setBounds(show ? body : { x: 0, y: 0, width: 0, height: 0 });
      tab.view.setVisible(show);
    }
    const showPlaceholder = Boolean(placeholder) && (!active || !connected);
    if (placeholder) {
      placeholder.setBounds(showPlaceholder ? body : { x: 0, y: 0, width: 0, height: 0 });
      placeholder.setVisible(showPlaceholder);
      if (showPlaceholder) {
        // Point the placeholder at the active module's label via the hash.
        const label = MODULE_TABS.find((m) => m.id === activeId)?.label ?? activeId;
        const url = `file://${placeholderHtml.replace(/\\/g, "/")}#${encodeURIComponent(label)}`;
        if (placeholder.webContents.getURL().split("#")[0] !== url.split("#")[0]) {
          void placeholder.webContents.loadURL(url);
        } else {
          placeholder.webContents.executeJavaScript(
            `location.hash = ${JSON.stringify("#" + encodeURIComponent(label))}; ` +
              `document.getElementById('title').textContent = ${JSON.stringify(label + " isn't running")};` +
              `document.getElementById('detail').textContent = ${JSON.stringify(label + "'s settings will appear here once it starts.")};`
          ).catch(() => {});
        }
      }
    }
  }

  // ─── Tab-strip state ─────────────────────────────────────────────────────
  function tabState(): { activeId: string; tabs: Array<{ id: string; label: string; connected: boolean }> } {
    return {
      activeId,
      tabs: MODULE_TABS.map((m) => ({
        id: m.id,
        label: m.label,
        connected: trayServer.isConnected(m.label),
      })),
    };
  }

  function pushTabState(): void {
    tabStrip?.webContents.send("suite:tab-state-changed", tabState());
  }

  // ─── View creation ───────────────────────────────────────────────────────
  function ensureModuleView(id: string): ModuleTab {
    const existing = tabs.get(id);
    if (existing) return existing;

    const view = new WebContentsView({
      webPreferences: {
        preload: hostedPreloadJs,
        contextIsolation: true,
        // Electron 20+ defaults preloads to sandbox: true, which restricts
        // require() to a small built-in allowlist. hostedPreload.ts must
        // require() the module's own compiled preload bundle by absolute path
        // at runtime (see hostedPreload.ts) — that require silently fails under
        // the sandbox, leaving window.electronAPI undefined in every hosted tab.
        // The module's standalone settings window preload is a self-contained
        // bundle with no runtime require of external files, so it works sandboxed;
        // this view genuinely needs the escape hatch.
        sandbox: false,
        // Pass the module id and its real preload path to the hosted preload so
        // it can tunnel IPC for the right module and boot the module's own bridge.
        additionalArguments: [
          `--suite-module=${id}`,
          `--suite-preload=${modulePreloadJs(id)}`,
        ],
      },
    });
    view.setVisible(false);
    const tab: ModuleTab = { id, label: appNameForModule(id), view, loaded: false };
    tabs.set(id, tab);
    win?.contentView.addChildView(view);

    // Load the module's real settings renderer (settings=1 mirrors the module's
    // own createSettingsWindow). Loaded lazily on first open so an unused tab
    // costs nothing until selected.
    const html = moduleRendererHtml(id);
    if (existsSync(html)) {
      void view.webContents.loadFile(html, { query: { settings: "1" } });
      tab.loaded = true;
    }
    return tab;
  }

  function ensureWindow(): void {
    if (win && !win.isDestroyed()) return;

    win = new BaseWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      minWidth: WINDOW_MIN_WIDTH,
      minHeight: WINDOW_MIN_HEIGHT,
      frame: false,
      show: false,
      title: "PopSuite Settings",
      backgroundColor: "#171717",
      icon: existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined,
    });

    // Tab strip on top.
    tabStrip = new WebContentsView({
      webPreferences: { preload: tabStripPreloadJs, contextIsolation: true },
    });
    win.contentView.addChildView(tabStrip);
    void tabStrip.webContents.loadFile(tabStripHtml);

    // Shared placeholder view for disconnected modules.
    placeholder = new WebContentsView({ webPreferences: { contextIsolation: true } });
    placeholder.setVisible(false);
    win.contentView.addChildView(placeholder);

    // One settings view per module (created up front so both tabs preserve state
    // once loaded, and switching never reloads).
    for (const m of MODULE_TABS) ensureModuleView(m.id);

    win.on("resize", relayout);
    win.on("closed", () => {
      // Tearing down the views on close is fine — reopening rebuilds them. State
      // that must survive a full close is the module's own persisted settings.
      tabs.clear();
      tabStrip = null;
      placeholder = null;
      win = null;
    });
  }

  function selectTab(id: string): void {
    if (!MODULE_TABS.some((m) => m.id === id)) return;
    activeId = id;
    relayout();
    pushTabState();
    // Focus the active module's webContents so keyboard input lands in it.
    const tab = tabs.get(id);
    if (tab && trayServer.isConnected(appNameForModule(id))) tab.view.webContents.focus();
  }

  // ─── IPC from the tab strip ──────────────────────────────────────────────
  ipcMain.on("suite:select-tab", (_e, id: unknown) => {
    if (typeof id === "string") selectTab(id);
  });
  ipcMain.handle("suite:tab-state", () => tabState());

  // ─── IPC from the hosted settings renderers (relay up to modules) ────────
  // Every hosted renderer's send/invoke arrives here tagged with its module id;
  // forward to the owning module process over the pipe.
  ipcMain.on("suite:relay-send", (_e, moduleId: string, channel: string, args: unknown[]) => {
    // The hosted "Done" button sends close-window; in the launcher-owned window
    // that must hide THIS window, not ask the (windowless) module to hide its own.
    // Everything else tunnels to the owning module.
    if (channel === "close-window") {
      if (win && !win.isDestroyed()) win.hide();
      return;
    }
    trayServer.relaySend(appNameForModule(moduleId), channel, args);
  });
  // Correlate invoke replies by id. The module answers via routeRelay below.
  let invokeSeq = 0;
  const pending = new Map<number, (r: { result?: unknown; error?: string }) => void>();
  ipcMain.handle(
    "suite:relay-invoke",
    (_e, moduleId: string, channel: string, args: unknown[]) =>
      new Promise((resolve, reject) => {
        const id = ++invokeSeq;
        pending.set(id, ({ result, error }) => {
          if (error) reject(new Error(error));
          else resolve(result);
        });
        trayServer.relayInvoke(appNameForModule(moduleId), id, channel, args);
        // Safety timeout so a dead module can't leak a hung renderer promise.
        setTimeout(() => {
          if (pending.delete(id)) reject(new Error("relay invoke timed out"));
        }, 10000);
      })
  );

  function routeRelay(appName: string, msg: ModuleToLauncher): void {
    const id = moduleForAppName(appName);
    if (!id) return;
    if (msg.type === "relayInvokeResult") {
      const settle = pending.get(msg.id);
      if (settle) {
        pending.delete(msg.id);
        settle({ result: msg.result, error: msg.error });
      }
    } else if (msg.type === "relayPush") {
      // Deliver a module main→renderer push into its hosted view.
      tabs.get(id)?.view.webContents.send("suite:relay-push", msg.channel, msg.args);
    }
  }

  return {
    open(moduleId: string): void {
      ensureWindow();
      selectTab(MODULE_TABS.some((m) => m.id === moduleId) ? moduleId : MODULE_TABS[0].id);
      if (win) {
        relayout();
        win.show();
        win.focus();
      }
    },
    routeRelay,
    refreshConnState(): void {
      // A module connected/disconnected: re-dim tabs and swap placeholder<->view.
      pushTabState();
      relayout();
    },
    dispose(): void {
      pending.clear();
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
      tabStrip = null;
      placeholder = null;
      tabs.clear();
    },
  };
}
