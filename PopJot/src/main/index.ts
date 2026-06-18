import { desktopCapturer, ipcMain, screen } from "electron";
import { createPopApp } from "@shared/main/createPopApp";
import { settingsSchema, SETTINGS_NAMESPACE } from "@jot/config/settingsSchema";

const isMac = process.platform === "darwin";

// ─── Screenshot capture (snapshot overlay mode) ──────────────────────

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

    const displaySource =
      sources.find((s) => s.display_id === display.id.toString()) ?? sources[0];
    return displaySource.thumbnail.toDataURL();
  } catch {
    return null;
  }
}

function warmupScreenshotCapture(): Promise<void> {
  if (screenshotCaptureWarmed) return Promise.resolve();
  if (screenshotWarmupPromise) return screenshotWarmupPromise;

  // Prime the first desktop capture so the first snapshot hotkey press is faster.
  screenshotWarmupPromise = desktopCapturer
    .getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    })
    .then(() => {
      screenshotCaptureWarmed = true;
    })
    .catch(() => {
      // Ignore warmup failures; the real capture path already handles errors.
    })
    .finally(() => {
      screenshotWarmupPromise = null;
    });

  return screenshotWarmupPromise;
}

// ─── App shell ───────────────────────────────────────────────────────

// Whether shortcuts fire. Starts enabled; tray "Disable PopJot" suspends them.
let enabled = true;

const popApp = createPopApp({
  appName: "PopJot",
  aboutDetail: "Screen annotation that stays out of your way.",
  settingsSchema,
  namespace: SETTINGS_NAMESPACE,
  proProduct: "suite",
  onSettingChange: {
    overlayMode: (mode) => {
      if (mode === "snapshot") void warmupScreenshotCapture();
    },
  },
  settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
  shortcuts: [
    {
      name: "main",
      default: isMac ? "Cmd+Shift+A" : "Alt+Shift+A",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win || shortcutFired || !enabled) return;
        shortcutFired = true;
        // Move overlay to whichever display the cursor is on before capturing
        ctx.moveOverlayToCursorDisplay();
        const pos = ctx.getCursorDipPosition();
        const needsSnapshot = ctx.settings.overlayMode === "snapshot";
        const snapshot = needsSnapshot ? await captureScreenshot() : null;
        win.webContents.send("shortcut-activate", pos, snapshot);
      },
    },
    {
      name: "persistent",
      default: isMac ? "Cmd+Shift+S" : "Alt+Shift+S",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win || !enabled) return;
        ctx.moveOverlayToCursorDisplay();
        const pos = ctx.getCursorDipPosition();
        const needsSnapshot = ctx.settings.overlayMode === "snapshot";
        const snapshot = needsSnapshot ? await captureScreenshot() : null;
        win.webContents.send("shortcut-persistent", pos, snapshot);
      },
    },
  ],
  tray: { settingsLabel: "Open Settings" },
  trayToggle: {
    getEnabled: () => enabled,
    onToggle: () => {
      enabled = !enabled;
      popApp.setTrayActive(enabled);
    },
  },
  secondInstance: "focus-main",
  onReady: (ctx) => {
    ctx.setTrayActive(enabled);
    void warmupScreenshotCapture();
  },
});

// ─── Overlay activation (PopJot-specific) ────────────────────────────

ipcMain.on("overlay-activated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  win.setIgnoreMouseEvents(false);
  win.focus();
});

ipcMain.on("overlay-deactivated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  // Drop { forward: true } when inactive — forwarding keeps the window in the
  // input pipeline which can intercept synthetic right/middle-click events from
  // tablet drivers (e.g. Huion stylus buttons).
  win.setIgnoreMouseEvents(true);
  shortcutFired = false;
});
