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
import { startInputCapture, stopInputCapture } from "@keys/main/inputCapture";

const isMac = process.platform === "darwin";

// Module enable + jot overlay-mode mirrors of the namespaced settings, tracked
// here so the shortcut handlers can branch without reading them off ctx (which
// only carries the suite schema's values).
let jotOverlayMode = jotSchema.overlayMode.default;

// ─── PopJot screenshot capture (snapshot overlay mode) ───────────────

let shortcutFired = false;
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
  shortcuts: [
    {
      // keys module: toggle the keystroke overlay on/off.
      name: "keys",
      default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
      handler: (ctx) => {
        ctx.sendToMainWindow("shortcut-toggle");
      },
    },
    {
      // jot module: one-shot annotation.
      name: "annotate",
      default: isMac ? "Cmd+Shift+A" : "Alt+Shift+A",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win || shortcutFired) return;
        shortcutFired = true;
        ctx.moveOverlayToCursorDisplay();
        const pos = ctx.getCursorDipPosition();
        const snapshot = jotOverlayMode === "snapshot" ? await captureScreenshot() : null;
        win.webContents.send("shortcut-activate", pos, snapshot);
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
    // keys module: forward raw input to overlay + settings windows.
    startInputCapture(() => {
      const windows: BrowserWindow[] = [];
      const main = ctx.getMainWindow();
      const settings = ctx.getSettingsWindow();
      if (main && !main.isDestroyed()) windows.push(main);
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

// ─── Overlay activation (jot module) ─────────────────────────────────

ipcMain.on("overlay-activated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  win.setIgnoreMouseEvents(false);
  win.focus();
});

ipcMain.on("overlay-deactivated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  win.setIgnoreMouseEvents(true);
  shortcutFired = false;
});
