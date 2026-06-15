import { BrowserWindow } from "electron";
import { createPopApp } from "@shared/main/createPopApp";
import { settingsSchema } from "@/config/settingsSchema";
import { startInputCapture, stopInputCapture } from "./inputCapture";

const isMac = process.platform === "darwin";

const popApp = createPopApp({
  appName: "PopKey",
  aboutDetail: "Key visualizer for presentations and screen recordings.",
  settingsSchema,
  settingsWindow: { width: 1200, height: 760, minWidth: 900, minHeight: 600, resizable: true },
  shortcuts: [
    {
      name: "main",
      default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
      handler: (ctx) => {
        ctx.sendToMainWindow("shortcut-toggle");
      },
    },
  ],
  tray: { settingsLabel: "Settings", doubleClickOpensSettings: true },
  secondInstance: "open-settings",
  onReady: (ctx) => {
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
