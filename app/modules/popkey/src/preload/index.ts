import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema } from "@popkey/config/settingsSchema";

const IPC_NAMESPACE = "popkey";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login.
  ...createSettingsBridge(settingsSchema, IPC_NAMESPACE),
  ...createShortcutBridge(["main"], IPC_NAMESPACE),
  ...createLicenseBridge(IPC_NAMESPACE),

  // Main → Renderer: global shortcut toggle
  onShortcutToggle: subscribe("shortcut-toggle", IPC_NAMESPACE),

  // Main → Renderer: absolute enabled state (suite auto-suppression sets a
  // specific value rather than toggling, so hide/restore can't drift).
  onSetAppEnabled: subscribe("set-app-enabled", IPC_NAMESPACE),

  // Main → Renderer: raw input events from uiohook
  onInputKeyDown: subscribe("input:keydown", IPC_NAMESPACE),
  onInputKeyUp: subscribe("input:keyup", IPC_NAMESPACE),
  onInputClick: subscribe("input:click", IPC_NAMESPACE),
  onInputWheel: subscribe("input:wheel", IPC_NAMESPACE),
  onInputDrag: subscribe("input:drag", IPC_NAMESPACE),
  onInputDragMove: subscribe("input:dragmove", IPC_NAMESPACE),
  onInputFocusLost: subscribe("input:focus-lost", IPC_NAMESPACE),
});
