import { contextBridge, ipcRenderer } from "electron";
import { createLicenseBridge } from "@shared/license/preload";
import {
  createSettingsBridge,
  createShortcutBridge,
} from "@shared/settings/preload";
import { settingsSchema as popjotSchema } from "@popjot/config/settingsSchema";
import { settingsSchema as popkeySchema } from "@popkey/config/settingsSchema";

type ModuleId = "popjot" | "popkey";

type SettingsState = {
  activeId: ModuleId;
  tabs: Array<{ id: ModuleId; label: string; connected: boolean }>;
};

const moduleApis: Record<ModuleId, Record<string, unknown>> = {
  popjot: {
    ...createSettingsBridge(popjotSchema, "popjot"),
    ...createShortcutBridge(
      ["main", "persistent", "spotlight", "lastTool"],
      "popjot",
    ),
    ...createLicenseBridge("popjot"),
  },
  popkey: {
    ...createSettingsBridge(popkeySchema, "popkey"),
    ...createShortcutBridge(["main"], "popkey"),
    ...createLicenseBridge("popkey"),
  },
};

let activeId: ModuleId = "popjot";

const electronAPI: Record<string, unknown> = {};
const apiKeys = new Set([
  ...Object.keys(moduleApis.popjot),
  ...Object.keys(moduleApis.popkey),
]);

for (const key of apiKeys) {
  electronAPI[key] = (...args: unknown[]) => {
    const member = moduleApis[activeId][key];
    if (typeof member !== "function") return undefined;
    return member(...args);
  };
}

// The module bridge close action would target a module-local settings window.
// This renderer belongs to the suite, so close the unified window instead.
electronAPI.closeWindow = () => ipcRenderer.send("suite:settings-close");

// Module-fixed tray-settings subscribe. The generated electronAPI.onTrayMenuChange
// resolves its IPC namespace via the mutable `activeId`, so a panel that mounts
// while the OTHER module is active would subscribe on the wrong namespace and
// silently miss its own seed pushes. This binds to the given module's bridge
// directly, independent of activeId, so both panels' listeners are always
// correctly namespaced from mount. Consumed by main.tsx's tray-settings sync.
function subscribeSetting(
  id: ModuleId,
  channel: string,
  callback: (value: unknown) => void,
): () => void {
  const onTrayMenuChange = moduleApis[id].onTrayMenuChange as
    | ((event: string, cb: (value: unknown) => void) => () => void)
    | undefined;
  if (typeof onTrayMenuChange !== "function") return () => {};
  return onTrayMenuChange(channel, callback);
}

// Module-fixed shortcut read, same reasoning as subscribeSetting above: both
// panels' mount-time getShortcuts() calls would otherwise resolve through the
// mutable `activeId` and race — whichever module ISN'T active at that instant
// reads the OTHER module's shortcuts (this is the bug that made PopKey's
// Settings briefly show PopJot's "Alt+Shift+A" as its own shortcut).
function getShortcuts(id: ModuleId): Promise<Record<string, string>> {
  const getter = moduleApis[id].getShortcuts as
    | (() => Promise<Record<string, string>>)
    | undefined;
  return getter?.() ?? Promise.resolve({});
}

const stateListeners = new Set<(state: SettingsState) => void>();

ipcRenderer.on(
  "suite:settings-state-changed",
  (_event, state: SettingsState) => {
    activeId = state.activeId;
    for (const listener of stateListeners) listener(state);
  },
);

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
contextBridge.exposeInMainWorld("suiteSettings", {
  getState: async (): Promise<SettingsState> => {
    const state = (await ipcRenderer.invoke(
      "suite:settings-state",
    )) as SettingsState;
    activeId = state.activeId;
    return state;
  },
  select: (id: ModuleId): void => {
    activeId = id;
    ipcRenderer.send("suite:settings-select", id);
  },
  seed: (id: ModuleId): void => {
    ipcRenderer.send("suite:settings-seed", id);
  },
  subscribeSetting,
  getShortcuts,
  close: (): void => {
    ipcRenderer.send("suite:settings-close");
  },
  onStateChanged: (callback: (state: SettingsState) => void) => {
    stateListeners.add(callback);
    return () => stateListeners.delete(callback);
  },
  // Presets: the renderer owns the preset list (localStorage) but mirrors a
  // lightweight index (id + name + Pro state) to the launcher so the tray can
  // list them. The launcher sends back a preset id to apply when the user picks
  // one from the tray; the renderer runs the same apply path as its own buttons.
  syncPresets: (payload: {
    presets: Array<{ id: string; name: string }>;
    isPro: boolean;
  }): void => {
    ipcRenderer.send("suite:presets-sync", payload);
  },
  onApplyPreset: (callback: (id: string) => void) => {
    const handler = (_event: unknown, id: string) => callback(id);
    ipcRenderer.on("suite:presets-apply", handler);
    // Now that a listener is attached, tell main to deliver any queued tray apply.
    ipcRenderer.send("suite:presets-ready", undefined);
    return () => ipcRenderer.removeListener("suite:presets-apply", handler);
  },
  // Sent after a tray-triggered apply has dispatched all its settings IPC, so
  // the launcher can tear down a hidden apply-only window (see suiteSettingsWindow).
  notifyApplyDone: (): void => {
    ipcRenderer.send("suite:presets-apply-done", undefined);
  },
});
