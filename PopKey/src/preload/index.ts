import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema, SETTINGS_NAMESPACE } from "@keys/config/settingsSchema";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login. Namespaced (setKeys<Key>) so the keys
  // module composes cleanly into PopSuite.
  ...createSettingsBridge(settingsSchema, SETTINGS_NAMESPACE),
  ...createShortcutBridge(["main"]),
  ...createLicenseBridge(),

  // Main → Renderer: global shortcut toggle
  onShortcutToggle: subscribe("shortcut-toggle"),

  // Main → Renderer: raw input events from uiohook
  onInputKeyDown: subscribe("input:keydown"),
  onInputKeyUp: subscribe("input:keyup"),
  onInputClick: subscribe("input:click"),
  onInputWheel: subscribe("input:wheel"),
  onInputDrag: subscribe("input:drag"),
  onInputDragMove: subscribe("input:dragmove"),
  onInputFocusLost: subscribe("input:focus-lost"),
});
