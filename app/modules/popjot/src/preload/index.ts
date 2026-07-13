import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  sender,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema } from "@/config/settingsSchema";

const IPC_NAMESPACE = "popjot";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login.
  ...createSettingsBridge(settingsSchema, IPC_NAMESPACE),
  ...createShortcutBridge(["main", "persistent", "spotlight", "lastTool"], IPC_NAMESPACE),
  ...createLicenseBridge(IPC_NAMESPACE),

  // Main → Renderer: global shortcut was pressed
  onShortcutActivate: subscribe("shortcut-activate", IPC_NAMESPACE),
  onShortcutLastTool: subscribe("shortcut-last-tool", IPC_NAMESPACE),
  onShortcutPersistent: subscribe("shortcut-persistent", IPC_NAMESPACE),
  onOverlayDeactivateRequested: subscribe("overlay-deactivate-requested", IPC_NAMESPACE),

  // Renderer → Main: overlay lifecycle
  overlayActivated: sender("overlay-activated", IPC_NAMESPACE),
  overlayDeactivated: sender("overlay-deactivated", IPC_NAMESPACE),

  // Spotlight presenter mode: main toggles it and streams the cursor (the
  // overlay is click-through so it can't observe mousemove itself). Toggle and
  // Escape-to-exit are both owned by main via global shortcuts.
  onSpotlightSet: subscribe("spotlight-set", IPC_NAMESPACE),
  onSpotlightCursor: subscribe("spotlight-cursor", IPC_NAMESPACE),
});
