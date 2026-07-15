/**
 * Preload side of the declarative settings layer.
 * Builds the window.electronAPI surface from the app's settings schema,
 * plus small helpers for app-specific channels.
 */

import { ipcRenderer } from "electron";
import { type SettingsSchema, setChannel, setterName } from "./schema";

export function namespacedChannel(namespace: string, channel: string): string {
  return namespace ? namespace + ":" + channel : channel;
}

/** Build a callback subscription bridge member. */
export function subscribe(channel: string, namespace = "") {
  const scopedChannel = namespacedChannel(namespace, channel);
  return (callback: (...args: never[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      (callback as (...args: unknown[]) => void)(...args);
    ipcRenderer.on(scopedChannel, handler);
    return () => ipcRenderer.removeListener(scopedChannel, handler);
  };
}

/** Build a fire-and-forget bridge member. */
export function sender(channel: string, namespace = "") {
  const scopedChannel = namespacedChannel(namespace, channel);
  return (...args: unknown[]) => ipcRenderer.send(scopedChannel, ...args);
}

/** Build a request/response bridge member. */
export function invoker(channel: string, namespace = "") {
  const scopedChannel = namespacedChannel(namespace, channel);
  return (...args: unknown[]) => ipcRenderer.invoke(scopedChannel, ...args);
}

/**
 * Common bridge: one set<Key> sender per schema setting, the tray
 * subscription entry point, window controls, and open-at-login.
 */
export function createSettingsBridge<S extends SettingsSchema>(
  schema: S,
  namespace = ""
): Record<string, unknown> {
  const api: Record<string, unknown> = {
    quitApp: sender("quit-app", namespace),
    closeWindow: sender("close-window", namespace),
    onTrayMenuChange: (event: string, callback: (value: unknown) => void) =>
      subscribe(event, namespace)(callback as (...args: never[]) => void),
    getOpenAtLogin: invoker("get-open-at-login", namespace),
    setOpenAtLogin: sender("set-open-at-login", namespace),
    openExternal: sender("open-external", namespace),
    readClipboard: invoker("read-clipboard", namespace),
    // Cross-app settings sync: per-key toggle map (shared with the sibling app)
    // plus a live subscription so the Sync tab reflects the other app's flips.
    getSyncPrefs: invoker("get-sync-prefs", namespace),
    setSyncPref: sender("set-sync-pref", namespace),
    setSyncAll: sender("set-sync-all", namespace),
    onSyncPrefsChanged: (callback: (prefs: Record<string, boolean>) => void) =>
      subscribe("sync-prefs-changed", namespace)(callback as (...args: never[]) => void),
  };

  for (const key of Object.keys(schema)) {
    api[setterName(key)] = (value: unknown) =>
      ipcRenderer.send(namespacedChannel(namespace, setChannel(key)), value);
  }

  return api;
}

/**
 * Bridge members for named global shortcuts.
 */
export function createShortcutBridge(
  names: readonly string[],
  namespace = ""
): Record<string, unknown> {
  const api: Record<string, unknown> = {
    getShortcuts: invoker("get-shortcuts", namespace),
  };
  for (const name of names) {
    const setter = "set" + name.charAt(0).toUpperCase() + name.slice(1) + "Shortcut";
    api[setter] = invoker("set-" + name + "-shortcut", namespace);
  }
  return api;
}