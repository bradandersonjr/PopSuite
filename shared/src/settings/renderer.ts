/**
 * Renderer side of the declarative settings layer.
 * Safe to import in web builds — every function no-ops when
 * `window.electronAPI` is absent.
 */

import {
  type SettingsSchema,
  type SettingValue,
  setterName,
  trayChannel,
} from "./schema";

export type ShortcutUpdateResult =
  | { ok: true; shortcut: string }
  | { ok: false; shortcut: string; error: string };

/** Loosely-typed view of the preload bridge used by shared helpers. */
type BridgeLike = Record<string, (...args: unknown[]) => unknown> & {
  onTrayMenuChange?: (event: string, callback: (value: unknown) => void) => () => void;
};

function bridge(): BridgeLike | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as { electronAPI?: unknown }).electronAPI as BridgeLike | undefined;
}

export function isDesktop(): boolean {
  return !!bridge();
}

export function isExtension(): boolean {
  return typeof __IS_EXTENSION__ !== "undefined" && __IS_EXTENSION__ === true;
}

export function isSettingsWindow(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("settings") === "1";
}

export function quitApp(): void {
  bridge()?.quitApp?.();
}

export function closeWindow(): void {
  bridge()?.closeWindow?.();
}

export async function getOpenAtLogin(): Promise<boolean> {
  return ((await bridge()?.getOpenAtLogin?.()) as boolean | undefined) ?? false;
}

export function setOpenAtLogin(enabled: boolean): void {
  bridge()?.setOpenAtLogin?.(enabled);
}

/** Open a URL in the OS browser (desktop). On web, falls back to window.open. */
export function openExternal(url: string): void {
  const api = bridge() as { openExternal?: (url: string) => void } | undefined;
  if (api?.openExternal) {
    api.openExternal(url);
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Read the clipboard text (desktop only; "" elsewhere). */
export async function readClipboard(): Promise<string> {
  const api = bridge() as { readClipboard?: () => Promise<string> } | undefined;
  return (await api?.readClipboard?.()) ?? "";
}

// ─── Cross-app settings sync ───────────────────────────────────────────

type SyncBridge = {
  getSyncPrefs?: () => Promise<Record<string, boolean>>;
  setSyncPref?: (key: string, enabled: boolean) => void;
  setSyncAll?: (enabled: boolean) => void;
  onSyncPrefsChanged?: (cb: (prefs: Record<string, boolean>) => void) => () => void;
};

/** Current per-key sync on/off map (empty on web). */
export async function getSyncPrefs(): Promise<Record<string, boolean>> {
  return (await (bridge() as SyncBridge | undefined)?.getSyncPrefs?.()) ?? {};
}

/** Enable/disable syncing a single setting key with the sibling app. */
export function setSyncPref(key: string, enabled: boolean): void {
  (bridge() as SyncBridge | undefined)?.setSyncPref?.(key, enabled);
}

/** Enable/disable syncing for every syncable key at once. */
export function setSyncAll(enabled: boolean): void {
  (bridge() as SyncBridge | undefined)?.setSyncAll?.(enabled);
}

/** Subscribe to sync-toggle changes (from this or the sibling app). */
export function onSyncPrefsChanged(cb: (prefs: Record<string, boolean>) => void): () => void {
  return (bridge() as SyncBridge | undefined)?.onSyncPrefsChanged?.(cb) ?? (() => {});
}

export interface SettingsPlatform<S extends SettingsSchema> {
  /** Send a setting change to the main process (no-op on web). */
  sendSetting<K extends keyof S & string>(key: K, value: SettingValue<S[K]>): void;
  /** Subscribe to broadcasts of a setting; returns an unsubscribe fn. */
  onSetting<K extends keyof S & string>(
    key: K,
    callback: (value: SettingValue<S[K]>) => void
  ): () => void;
}

export function createSettingsPlatform<S extends SettingsSchema>(schema: S): SettingsPlatform<S> {
  void schema; // schema only pins the type parameter
  return {
    sendSetting(key, value) {
      bridge()?.[setterName(key)]?.(value);
    },
    onSetting(key, callback) {
      return (
        bridge()?.onTrayMenuChange?.(trayChannel(key), callback as (value: unknown) => void) ??
        (() => {})
      );
    },
  };
}

/** Update a named global shortcut, e.g. setNamedShortcut("main", "Alt+Shift+A"). */
export async function setNamedShortcut(
  name: string,
  shortcut: string
): Promise<ShortcutUpdateResult> {
  const setter = bridge()?.[`set${name.charAt(0).toUpperCase()}${name.slice(1)}Shortcut`];
  return ((await setter?.(shortcut)) as ShortcutUpdateResult | undefined) ?? { ok: true, shortcut };
}

export async function getShortcuts<T extends Record<string, string>>(fallback: T): Promise<T> {
  return ((await bridge()?.getShortcuts?.()) as T | undefined) ?? fallback;
}
