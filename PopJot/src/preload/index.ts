import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  sender,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema, SETTINGS_NAMESPACE } from "@jot/config/settingsSchema";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login. Namespaced (setJot<Key>) so the jot
  // module composes cleanly into PopSuite.
  ...createSettingsBridge(settingsSchema, SETTINGS_NAMESPACE),
  ...createShortcutBridge(["main", "persistent"]),
  ...createLicenseBridge(),

  // Main → Renderer: global shortcut was pressed
  onShortcutActivate: subscribe("shortcut-activate"),
  onShortcutPersistent: subscribe("shortcut-persistent"),

  // Renderer → Main: overlay lifecycle
  overlayActivated: sender("overlay-activated"),
  overlayDeactivated: sender("overlay-deactivated"),
});
