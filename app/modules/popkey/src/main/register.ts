/**
 * PopKey main-process registration.
 *
 * Single source of truth for booting PopKey's main process. Both the standalone
 * entry (src/main/index.ts) and the PopSuite single-install entry
 * (suite/src/main/index.ts) call registerPopKey(); the suite passes a `layout`
 * so the shared shell resolves this module's renderer/preload/icons from their
 * per-module subdirectories.
 *
 * Note: startInputCapture pulls in uiohook-napi (a native module). This file is
 * only ever required by the PopKey process — the suite launcher and the PopJot
 * module process never import it, so the native binding never loads there.
 */

import { BrowserWindow, dialog, systemPreferences } from "electron";
import { createPopApp, type PopAppOptions } from "@shared/main/createPopApp";
import type { settingsSchema as PopKeySchema } from "../config/settingsSchema";
import { settingsSchema } from "../config/settingsSchema";
import { startInputCapture, stopInputCapture } from "./inputCapture";

const isMac = process.platform === "darwin";

/**
 * Boot PopKey's main process. `layout` is only passed by the suite entry to
 * point the shared shell at PopKey's per-module renderer/preload/icons.
 */
export function registerPopKey(
  layout?: PopAppOptions<typeof PopKeySchema>["layout"],
  trayMode?: "owned" | "reported",
  embedded = false
): void {
  // Mirrors the renderer's `appEnabled` (defaults on). Now owned by the shared
  // shell's suite-suppression reducer: `active` tracks the user's REQUESTED
  // visibility (what the tray checkbox shows), which is what applyActive receives
  // whenever the effective visibility changes. Outside the suite (or when PopJot
  // isn't annotating) effective == requested, so this behaves exactly as before.
  let active = true;

  const popApp = createPopApp({
    appName: "PopKey",
    aboutDetail: "Key visualizer for presentations and screen recordings.",
    settingsSchema,
    embedded,
    settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
    proProduct: "suite",
    layout,
    onSettingChange: {
      // OBS mode on → drop always-on-top so the overlay sits in normal z-order
      // and OBS can grab it as a separate window source.
      obsMode: (enabled, ctx) => ctx.setOverlayAlwaysOnTop(!enabled),
    },
    shortcuts: [
      {
        name: "main",
        default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
        // Route through the shell's suppression reducer. While PopJot annotates
        // this flips the remembered request but keeps the overlay hidden; the
        // reducer calls applyActive below with the resulting effective state.
        handler: (ctx) => ctx.suiteManualToggle(),
      },
    ],
    tray: { settingsLabel: "Settings", doubleClickOpensSettings: true, mode: trayMode },
    trayToggle: {
      // The user's requested state (mirrors the reducer's userRequested); drives
      // the local fallback tray's Enable/Disable label. In the suite the launcher
      // labels the entry from the reported state instead.
      getEnabled: () => active,
      onToggle: () => popApp.suiteManualToggle(),
    },
    // Suite-only auto-suppression: while PopJot is annotating, hide the visualizer
    // and defer manual toggles; restore afterward. applyActive receives the
    // EFFECTIVE visibility and is the single place the overlay state is driven.
    suiteSuppressible: {
      initialActive: true,
      applyActive: (visible) => {
        // Track the user's requested state for the local tray label: it only
        // changes on a manual toggle, which happens when NOT suppressed, so the
        // effective value equals the requested value in that case.
        if (!popApp.isSuiteSuppressed()) active = visible;
        // Absolute set (not toggle) so hide/restore land exactly, never drift.
        // PopKey's native overlay remains continuously present while the process
        // is enabled; only renderer content is suppressed/restored here.
        popApp.sendToMainWindow("set-app-enabled", visible);
        // Tray icon reflects whether the visualizer is actually showing.
        popApp.setTrayActive(visible);
      },
    },
    secondInstance: "open-settings",
    onReady: (ctx) => {
      // Reflect the initial active state (visualizer on by default) in the tray.
      ctx.setTrayActive(active);

      // macOS: global input capture needs Accessibility + Input Monitoring
      // permission. If we aren't trusted yet, show a non-blocking heads-up and
      // trigger the OS prompt (passing `true`). We still attempt to start capture
      // below — it may begin working once the user grants permission (sometimes
      // after a restart).
      if (isMac && !systemPreferences.isTrustedAccessibilityClient(false)) {
        void dialog.showMessageBox({
          type: "info",
          title: "PopKey needs permission",
          message: "PopKey needs Accessibility and Input Monitoring permission",
          detail:
            "To visualize your keys and clicks, grant PopKey permission in " +
            "System Settings > Privacy & Security (Accessibility and Input " +
            "Monitoring), then restart PopKey.",
          buttons: ["OK"],
        });
        // Passing `true` prompts the OS to open the Accessibility grant dialog.
        systemPreferences.isTrustedAccessibilityClient(true);
      }

      startInputCapture(() => {
        const windows: BrowserWindow[] = [];
        const main = ctx.getMainWindow();
        const settings = ctx.getSettingsWindow();
        if (main && !main.isDestroyed()) windows.push(main);
        if (settings && !settings.isDestroyed()) windows.push(settings);
        return windows;
      }, "popkey");
    },
    onWillQuit: () => {
      stopInputCapture();
    },
  });

  void popApp;
}
