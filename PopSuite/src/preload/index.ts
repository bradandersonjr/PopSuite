import { contextBridge } from "electron";
import {
  createSettingsBridge,
  createShortcutBridge,
  sender,
  subscribe,
} from "@shared/settings/preload";
import { createLicenseBridge } from "@shared/license/preload";
import { settingsSchema as suiteSchema } from "@suite/config/settingsSchema";
import { settingsSchema as keysSchema, SETTINGS_NAMESPACE as KEYS_NS } from "@keys/config/settingsSchema";
import { settingsSchema as jotSchema, SETTINGS_NAMESPACE as JOT_NS } from "@jot/config/settingsSchema";

contextBridge.exposeInMainWorld("electronAPI", {
  // Suite (unnamespaced) + both module schemas (namespaced setKeys*/setJot*).
  // The common members (quitApp, onTrayMenuChange, …) are identical across all
  // three spreads.
  ...createSettingsBridge(suiteSchema),
  ...createSettingsBridge(keysSchema, KEYS_NS),
  ...createSettingsBridge(jotSchema, JOT_NS),
  ...createShortcutBridge(["keys", "annotate", "persistent"]),
  ...createLicenseBridge(),

  // ── keys module: toggle + raw uiohook input ──
  onShortcutToggle: subscribe("shortcut-toggle"),
  onInputKeyDown: subscribe("input:keydown"),
  onInputKeyUp: subscribe("input:keyup"),
  onInputClick: subscribe("input:click"),
  onInputWheel: subscribe("input:wheel"),
  onInputDrag: subscribe("input:drag"),
  onInputDragMove: subscribe("input:dragmove"),
  onInputFocusLost: subscribe("input:focus-lost"),

  // ── jot module: activation + overlay lifecycle ──
  onShortcutActivate: subscribe("shortcut-activate"),
  onShortcutPersistent: subscribe("shortcut-persistent"),
  overlayActivated: sender("overlay-activated"),
  overlayDeactivated: sender("overlay-deactivated"),
});
