import { BrowserWindow, dialog, systemPreferences } from "electron";
import { createPopApp } from "@shared/main/createPopApp";
import { settingsSchema } from "@/config/settingsSchema";
import { startInputCapture, stopInputCapture } from "./inputCapture";

const isMac = process.platform === "darwin";

// Mirrors the renderer's `appEnabled` (defaults on). The toggle shortcut is the
// only thing that flips it, so tracking it here keeps the tray indicator in sync.
let active = true;

const popApp = createPopApp({
  appName: "PopKey",
  aboutDetail: "Key visualizer for presentations and screen recordings.",
  settingsSchema,
  settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
  proProduct: "suite",
  onSettingChange: {
    // OBS mode on → drop always-on-top so the overlay sits in normal z-order
    // and OBS can grab it as a separate window source.
    obsMode: (enabled, ctx) => ctx.setOverlayAlwaysOnTop(!enabled),
  },
  shortcuts: [
    {
      name: "main",
      default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
      handler: (ctx) => {
        active = !active;
        ctx.sendToMainWindow("shortcut-toggle");
        ctx.setTrayActive(active);
      },
    },
  ],
  tray: { settingsLabel: "Settings", doubleClickOpensSettings: true },
  trayToggle: {
    getEnabled: () => active,
    onToggle: () => {
      active = !active;
      popApp.sendToMainWindow("shortcut-toggle");
      popApp.setTrayActive(active);
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
    });
  },
  onWillQuit: () => {
    stopInputCapture();
  },
});

void popApp;
