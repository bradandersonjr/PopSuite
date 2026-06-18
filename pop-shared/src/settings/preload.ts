/**
 * Preload side of the declarative settings layer.
 * Builds the `window.electronAPI` surface from the app's settings schema,
 * plus small helpers for app-specific channels.
 */

import { ipcRenderer } from "electron";
import { type SettingsSchema, setChannel, bridgeSetterName } from "./schema";

/** `subscribe("channel")` → `(callback) => unsubscribe` bridge member. */
export function subscribe(channel: string) {
  return (callback: (...args: never[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      (callback as (...args: unknown[]) => void)(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

/** `sender("channel")` → fire-and-forget bridge member. */
export function sender(channel: string) {
  return (...args: unknown[]) => ipcRenderer.send(channel, ...args);
}

/** `invoker("channel")` → request/response bridge member. */
export function invoker(channel: string) {
  return (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);
}

/**
 * Common bridge: one `set<Key>` sender per schema setting, the tray
 * subscription entry point, window controls, and open-at-login.
 */
export function createSettingsBridge<S extends SettingsSchema>(
  schema: S,
  ns?: string
): Record<string, unknown> {
  const api: Record<string, unknown> = {
    quitApp: sender("quit-app"),
    closeWindow: sender("close-window"),
    onTrayMenuChange: (event: string, callback: (value: unknown) => void) =>
      subscribe(event)(callback as (...args: never[]) => void),
    getOpenAtLogin: invoker("get-open-at-login"),
    setOpenAtLogin: sender("set-open-at-login"),
    openExternal: sender("open-external"),
    readClipboard: invoker("read-clipboard"),
  };

  // Namespaced bridge member + wire channel so composing two schemas in one
  // process never collides on shared key names.
  for (const key of Object.keys(schema)) {
    api[bridgeSetterName(key, ns)] = (value: unknown) =>
      ipcRenderer.send(setChannel(key, ns), value);
  }

  return api;
}

/**
 * Bridge members for named global shortcuts, e.g. ["main", "persistent"] →
 * setMainShortcut / setPersistentShortcut / getShortcuts.
 */
export function createShortcutBridge(names: readonly string[]): Record<string, unknown> {
  const api: Record<string, unknown> = {
    getShortcuts: invoker("get-shortcuts"),
  };
  for (const name of names) {
    api[`set${name.charAt(0).toUpperCase()}${name.slice(1)}Shortcut`] = invoker(
      `set-${name}-shortcut`
    );
  }
  return api;
}
