/**
 * PopJot main-process registration.
 *
 * This is the single source of truth for booting PopJot's main process. Both
 * the standalone entry (src/main/index.ts) and the PopSuite single-install
 * entry (suite/src/main/index.ts) call registerPopJot(); the suite passes a
 * `layout` so the shared shell resolves this module's renderer/preload/icons
 * from their per-module subdirectories inside the shared Electron binary.
 */

import { desktopCapturer, globalShortcut, ipcMain, screen } from "electron";
import { createPopApp, type PopAppOptions } from "@shared/main/createPopApp";
import type { settingsSchema as PopJotSchema } from "@/config/settingsSchema";
import { settingsSchema } from "@/config/settingsSchema";

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

/**
 * Boot PopJot's main process. `layout` is only passed by the suite entry to
 * point the shared shell at PopJot's per-module renderer/preload/icons.
 */
export function registerPopJot(
  layout?: PopAppOptions<typeof PopJotSchema>["layout"],
  trayMode?: "owned" | "reported"
): void {
  // Whether shortcuts fire. Starts enabled; tray "Disable PopJot" suspends them.
  let enabled = true;

  // ─── Spotlight cursor tracking ─────────────────────────────────────
  // While spotlight mode is active the overlay stays click-through (mouse events
  // pass through to the apps underneath), so the renderer never sees mousemove.
  // We poll the OS cursor here (~60Hz) and push it to the renderer instead. We
  // deliberately do NOT enable { forward: true } on the overlay — the shared
  // shell warns it intercepts synthetic right/middle-click events from tablet
  // drivers (e.g. Huion stylus). Polling only runs while spotlight is active.
  let spotlightActive = false;
  let cursorPollTimer: ReturnType<typeof setInterval> | null = null;
  // Mirrors renderer annotation state (from overlay-activated/deactivated) so the
  // spotlight shortcut can be gated in-process without querying the renderer.
  let annotating = false;

  function startCursorPolling(): void {
    if (cursorPollTimer) return;
    cursorPollTimer = setInterval(() => {
      const win = popApp.getMainWindow();
      if (!win || win.isDestroyed()) return;
      const pos = popApp.getCursorDipPosition();
      win.webContents.send("spotlight-cursor", pos);
    }, 16);
  }

  function stopCursorPolling(): void {
    if (cursorPollTimer) {
      clearInterval(cursorPollTimer);
      cursorPollTimer = null;
    }
  }

  function setSpotlight(active: boolean): void {
    if (spotlightActive === active) return;
    spotlightActive = active;
    const win = popApp.getMainWindow();
    if (active) {
      // Cover whichever display the cursor is on, then start feeding positions.
      popApp.moveOverlayToCursorDisplay();
      win?.webContents.send("spotlight-cursor", popApp.getCursorDipPosition());
      startCursorPolling();
      // Escape exits spotlight. The overlay stays click-through and unfocused
      // (so clicks reach the apps underneath), which means its renderer can't see
      // key events — so we listen globally, only while spotlight is active. This
      // never touches the renderer's persistent-mode Escape path.
      globalShortcut.register("Escape", () => setSpotlight(false));
    } else {
      stopCursorPolling();
      globalShortcut.unregister("Escape");
    }
    win?.webContents.send("spotlight-set", active);
  }

  const popApp = createPopApp({
    appName: "PopJot",
    aboutDetail: "Screen annotation that stays out of your way.",
    settingsSchema,
    proProduct: "suite",
    layout,
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
      {
        // Spotlight presenter mode — toggle on/off. Distinct chord from "main"
        // (Alt+Shift+A), "persistent" (Alt+Shift+S) and PopKey's Alt+Shift+K:
        // Alt+Shift+D (Cmd+Shift+D on macOS) was free.
        name: "spotlight",
        default: isMac ? "Cmd+Shift+D" : "Alt+Shift+D",
        handler: () => {
          if (!enabled) return;
          // Mutually exclusive with annotation: ignore the toggle while
          // annotating so we never race the RadialMenu activation state machine.
          if (!spotlightActive && annotating) return;
          setSpotlight(!spotlightActive);
        },
      },
    ],
    onWillQuit: () => {
      stopCursorPolling();
    },
    tray: { settingsLabel: "Open Settings", mode: trayMode },
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

      // The overlay clears shortcutFired via "overlay-deactivated". If its
      // webContents reloads or crashes while active, that event never arrives and
      // the flag sticks — wedging the main hotkey until restart. Resetting on
      // did-finish-load recovers the gate whenever the overlay (re)loads.
      const main = ctx.getMainWindow();
      main?.webContents.on("did-finish-load", () => {
        shortcutFired = false;
        // The overlay renderer forgets spotlight on reload; drop our side too so
        // we don't keep polling the cursor for a layer that is no longer shown.
        if (spotlightActive) setSpotlight(false);
      });
    },
  });

  // ─── Overlay activation (PopJot-specific) ────────────────────────────

  ipcMain.on("overlay-activated", () => {
    // Annotation is starting. It is mutually exclusive with spotlight, so an
    // active spotlight force-exits here (spotlight stays click-through, so this
    // never fights the drawing overlay's input capture).
    annotating = true;
    if (spotlightActive) setSpotlight(false);
    // Suite-only: tell the launcher we're annotating so PopKey auto-hides. No-op
    // outside the suite (no pipe client) and for standalone PopJot.exe.
    popApp.reportSuiteAnnotating(true);
    const win = popApp.getMainWindow();
    if (!win) return;
    win.setIgnoreMouseEvents(false);
    win.focus();
  });

  ipcMain.on("overlay-deactivated", () => {
    annotating = false;
    // Suite-only: annotation ended, let the launcher restore PopKey.
    popApp.reportSuiteAnnotating(false);
    const win = popApp.getMainWindow();
    if (!win) return;
    // Drop { forward: true } when inactive — forwarding keeps the window in the
    // input pipeline which can intercept synthetic right/middle-click events from
    // tablet drivers (e.g. Huion stylus buttons).
    win.setIgnoreMouseEvents(true);
    shortcutFired = false;
  });
}
