import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema } from "@/config/settingsSchema";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login.
  ...createSettingsBridge(settingsSchema),
  ...createShortcutBridge(["main"]),
  ...createLicenseBridge(),

  // Main → Renderer: global shortcut toggle
  onShortcutToggle: subscribe("shortcut-toggle"),

  // Main → Renderer: absolute enabled state (suite auto-suppression sets a
  // specific value rather than toggling, so hide/restore can't drift).
  onSetAppEnabled: subscribe("set-app-enabled"),

  // Main → Renderer: raw input events from uiohook
  onInputKeyDown: subscribe("input:keydown"),
  onInputKeyUp: subscribe("input:keyup"),
  onInputClick: subscribe("input:click"),
  onInputWheel: subscribe("input:wheel"),
  onInputDrag: subscribe("input:drag"),
  onInputDragMove: subscribe("input:dragmove"),
  onInputFocusLost: subscribe("input:focus-lost"),
});
