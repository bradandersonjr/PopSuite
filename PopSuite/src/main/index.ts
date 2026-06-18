import { BrowserWindow, desktopCapturer, ipcMain, screen } from "electron";
import { createPopApp } from "@shared/main/createPopApp";
import { settingsSchema } from "@suite/config/settingsSchema";
import {
  settingsSchema as keysSchema,
  SETTINGS_NAMESPACE as KEYS_NS,
} from "@keys/config/settingsSchema";
import {
  settingsSchema as jotSchema,
  SETTINGS_NAMESPACE as JOT_NS,
} from "@jot/config/settingsSchema";
import {
  startInputCapture,
  stopInputCapture,
  setInputCapturePaused,
} from "@keys/main/inputCapture";

const isMac = process.platform === "darwin";

// Module enable + jot overlay-mode mirrors of the namespaced settings, tracked
// here so the shortcut handlers can branch without reading them off ctx (which
// only carries the suite schema's values).
let jotOverlayMode = jotSchema.overlayMode.default;

// ─── PopJot screenshot capture (snapshot overlay mode) ───────────────

let screenshotCaptureWarmed = false;
let screenshotWarmupPromise: Promise<void> | null = null;

async function captureScreenshot(): Promise<string | null> {
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { width, height } = display.bounds;
    const sf = display.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(width * sf), height: Math.round(height * sf) },
    });

    if (sources.length === 0) return null;

    const displaySource = sources.find((s) => s.display_id === display.id.toString()) ?? sources[0];
    return displaySource.thumbnail.toDataURL();
  } catch {
    return null;
  }
}

function warmupScreenshotCapture(): Promise<void> {
  if (screenshotCaptureWarmed) return Promise.resolve();
  if (screenshotWarmupPromise) return screenshotWarmupPromise;

  screenshotWarmupPromise = desktopCapturer
    .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    .then(() => {
      screenshotCaptureWarmed = true;
    })
    .catch(() => {})
    .finally(() => {
      screenshotWarmupPromise = null;
    });

  return screenshotWarmupPromise;
}

// ─── Combined app shell ──────────────────────────────────────────────

const popApp = createPopApp({
  appName: "PopSuite",
  aboutDetail: "Keystroke visualizer and screen annotation in one app.",
  settingsSchema,
  // Host the keys/jot module schemas under their namespaces so their renderer
  // code (composed in the overlay/settings windows) syncs unchanged.
  extraSettings: [
    { schema: keysSchema, namespace: KEYS_NS },
    {
      schema: jotSchema,
      namespace: JOT_NS,
      onChange: {
        overlayMode: (mode: string) => {
          jotOverlayMode = mode as typeof jotOverlayMode;
          if (mode === "snapshot") void warmupScreenshotCapture();
        },
      } as Record<string, (value: never) => void>,
    },
  ],
  proProduct: "suite",
  settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
  // Two overlay windows, each rendering one module so each keeps the exact
  // input/cursor behavior it has standalone. "jot" is primary (interactive,
  // toggled on activation); "keys" stays click-through and just shows the HUD.
  overlays: [
    { name: "jot", query: { module: "jot" } },
    { name: "keys", query: { module: "keys" } },
  ],
  shortcuts: [
    {
      // keys module: toggle the keystroke overlay on/off.
      name: "keys",
      default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
      handler: (ctx) => {
        ctx.getOverlay("keys")?.webContents.send("shortcut-toggle");
      },
    },
    {
      // jot module: start annotation. We drive PopJot's PERSISTENT mode (not the
      // hold-style "shortcut-activate"), because persistent mode is immune to
      // focus loss — it never deactivates on window blur or modifier release.
      // That focus-independence is what makes annotation reliable inside the
      // multi-window suite, where the overlay can't be guaranteed to hold OS
      // focus the way a lone standalone window does. Press again to toggle off.
      name: "annotate",
      default: isMac ? "Cmd+Shift+A" : "Alt+Shift+A",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win) return;
        ctx.moveOverlayToCursorDisplay();
        // Hand the overlay to PopJot immediately: make it interactive and
        // silence PopKey's global hook so the first stroke draws and the OS
        // cursor hides without waiting for the renderer round-trip.
        enterJotSession(win);
        const pos = ctx.getCursorDipPosition();
        const snapshot = jotOverlayMode === "snapshot" ? await captureScreenshot() : null;
        win.webContents.send("shortcut-persistent", pos, snapshot);
      },
    },
    {
      // jot module: persistent (sticky) draw mode.
      name: "persistent",
      default: isMac ? "Cmd+Shift+S" : "Alt+Shift+S",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win) return;
        ctx.moveOverlayToCursorDisplay();
        enterJotSession(win);
        const pos = ctx.getCursorDipPosition();
        const snapshot = jotOverlayMode === "snapshot" ? await captureScreenshot() : null;
        win.webContents.send("shortcut-persistent", pos, snapshot);
      },
    },
  ],
  tray: { settingsLabel: "Settings", doubleClickOpensSettings: true },
  secondInstance: "open-settings",
  onReady: (ctx) => {
    ctx.setTrayActive(true);
    // keys module: forward raw input to the keys overlay (its HUD) + the
    // settings window (its live previews).
    startInputCapture(() => {
      const windows: BrowserWindow[] = [];
      const keys = ctx.getOverlay("keys");
      const settings = ctx.getSettingsWindow();
      if (keys && !keys.isDestroyed()) windows.push(keys);
      if (settings && !settings.isDestroyed()) windows.push(settings);
      return windows;
    });
    // jot module: prime the first snapshot capture.
    void warmupScreenshotCapture();
  },
  onWillQuit: () => {
    stopInputCapture();
  },
});

// ─── Overlay session handoff (jot module) ────────────────────────────

// Begin a PopJot session. The keys overlay is full-screen, transparent and
// always-on-top, so leaving it shown lets it intercept clicks and the cursor
// even when click-through. Hiding it entirely makes the jot overlay the only
// window on screen — identical to standalone PopJot, so drawing and cursor-none
// just work. Also pause PopKey's global hook so it adds no input latency.
function enterJotSession(win: BrowserWindow): void {
  const keys = popApp.getOverlay("keys");
  if (keys && !keys.isDestroyed()) keys.hide();
  setInputCapturePaused(true);
  win.setIgnoreMouseEvents(false);
  win.focus();
}

// End a PopJot session: overlay returns to click-through, PopKey resumes and
// its overlay comes back (without stealing focus).
function exitJotSession(win: BrowserWindow): void {
  win.setIgnoreMouseEvents(true);
  setInputCapturePaused(false);
  const keys = popApp.getOverlay("keys");
  if (keys && !keys.isDestroyed()) keys.showInactive();
}

ipcMain.on("overlay-activated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  enterJotSession(win);
});

ipcMain.on("overlay-deactivated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  exitJotSession(win);
});
