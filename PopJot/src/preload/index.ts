import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  sender,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema } from "@/config/settingsSchema";

contextBridge.exposeInMainWorld("electronAPI", {
  // Generated from the settings schema: set<Key> senders, onTrayMenuChange,
  // quitApp, closeWindow, open-at-login.
  ...createSettingsBridge(settingsSchema),
  ...createShortcutBridge(["main", "persistent"]),
  ...createLicenseBridge(),

  // Main → Renderer: global shortcut was pressed
  onShortcutActivate: subscribe("shortcut-activate"),
  onShortcutPersistent: subscribe("shortcut-persistent"),

  // Renderer → Main: overlay lifecycle
  overlayActivated: sender("overlay-activated"),
  overlayDeactivated: sender("overlay-deactivated"),
});
