/**
 * Two-tier settings sync orchestration (main process).
 *
 * Each app persists its own full settings to ~/.popsuite/<app>.json. The keys
 * the user has opted to sync (see syncable.ts) additionally live in
 * ~/.popsuite/shared.json as { prefs, values }. A directory watcher applies the
 * other app's changes live, and IPC lets the renderer read/flip the per-key
 * sync toggles (which are themselves stored in shared.json, so both apps agree).
 */

import { ipcMain } from "electron";
import type { SettingsSchema, SettingsValues } from "../settings/schema";
import { isValidSettingValue, trayChannel } from "../settings/schema";
import { syncableKeysFor, localKeyForSyncable } from "../settings/syncable";
import {
  ensureSettingsDir,
  loadAppSettings,
  saveAppSettings,
  loadSharedSync,
  updateSharedSync,
  watchSettingsFile,
} from "../settings/persistence";

export interface SettingsSyncOptions<S extends SettingsSchema> {
  appName: string;
  schema: S;
  sendToRenderers: (channel: string, value: unknown) => void;
  /** The controller's live (mutable) values object. */
  getValues: () => SettingsValues<S>;
}

export interface SettingsSync<S extends SettingsSchema> {
  /** Per-app + synced values to seed registerSettingsIpc with. */
  initialValues: Partial<SettingsValues<S>>;
  /** Notify the sync layer that a setting changed locally (via set-* IPC). */
  onLocalChange: (key: string, value: unknown) => void;
  /** Register IPC + start watching shared.json. Call once the controller exists. */
  start: () => void;
  dispose: () => void;
}

export function createSettingsSync<S extends SettingsSchema>(
  opts: SettingsSyncOptions<S>
): SettingsSync<S> {
  const { appName, schema, sendToRenderers, getValues } = opts;
  ensureSettingsDir();

  const syncable = syncableKeysFor(schema);
  // Map the shared identifier (def.key — used in shared.json + Sync-tab toggles)
  // to this app's local schema key, e.g. shared "style" ↔ local "badgeStyle"
  // (PopKey) or "menuStyle" (PopJot). Same name for keys without an alias.
  const localKeyByShared = new Map<string, string>();
  const sharedKeyByLocal = new Map<string, string>();
  for (const def of syncable) {
    const local = localKeyForSyncable(def, schema as Record<string, unknown>);
    if (!local) continue;
    localKeyByShared.set(def.key, local);
    sharedKeyByLocal.set(local, def.key);
  }
  const nonVolatileKeys = (Object.keys(schema) as Array<keyof S & string>).filter(
    (k) => !schema[k].volatile
  );

  // Live sync prefs, keyed by the shared identifier (default opt-out).
  const prefs: Record<string, boolean> = {};
  for (const def of syncable) prefs[def.key] = false;

  // ─── Initial values: per-app file, then synced overrides ───────────────

  const initialValues: Record<string, unknown> = {};
  const appVals = loadAppSettings(appName);
  for (const key of nonVolatileKeys) {
    if (key in appVals && isValidSettingValue(schema[key], appVals[key])) {
      initialValues[key] = appVals[key];
    }
  }
  const shared = loadSharedSync();
  for (const def of syncable) {
    const localKey = localKeyByShared.get(def.key)!;
    prefs[def.key] = shared.prefs[def.key] ?? false;
    if (prefs[def.key] && def.key in shared.values) {
      const v = shared.values[def.key];
      if (isValidSettingValue(schema[localKey], v)) initialValues[localKey] = v;
    }
  }

  // ─── Debounced writers ─────────────────────────────────────────────────

  function collectNonVolatile(): Record<string, unknown> {
    const values = getValues() as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of nonVolatileKeys) out[key] = values[key];
    return out;
  }

  let appSaveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleAppSave(): void {
    if (appSaveTimer) clearTimeout(appSaveTimer);
    appSaveTimer = setTimeout(() => {
      appSaveTimer = null;
      saveAppSettings(appName, collectNonVolatile());
    }, 400);
  }

  // Pending synced value writes, flushed together to limit shared.json churn.
  const pendingSharedValues = new Map<string, unknown>();
  let sharedSaveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSharedValueWrite(key: string, value: unknown): void {
    pendingSharedValues.set(key, value);
    if (sharedSaveTimer) clearTimeout(sharedSaveTimer);
    sharedSaveTimer = setTimeout(() => {
      sharedSaveTimer = null;
      updateSharedSync((file) => {
        for (const [k, v] of pendingSharedValues) file.values[k] = v;
      });
      pendingSharedValues.clear();
    }, 400);
  }

  function onLocalChange(key: string, value: unknown): void {
    scheduleAppSave();
    const sharedKey = sharedKeyByLocal.get(key);
    if (sharedKey && prefs[sharedKey]) scheduleSharedValueWrite(sharedKey, value);
  }

  // ─── Applying the other app's changes ──────────────────────────────────

  function prefsForRenderer(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const def of syncable) out[def.key] = prefs[def.key];
    return out;
  }

  function broadcastPrefs(): void {
    sendToRenderers("sync-prefs-changed", prefsForRenderer());
  }

  function applySyncedValue(localKey: string, value: unknown): void {
    if (!isValidSettingValue(schema[localKey as keyof S & string], value)) return;
    const values = getValues() as Record<string, unknown>;
    if (values[localKey] === value) return;
    values[localKey] = value;
    sendToRenderers(trayChannel(localKey), value);
  }

  function onSharedChanged(): void {
    const file = loadSharedSync();

    let prefsChanged = false;
    for (const def of syncable) {
      const next = file.prefs[def.key] ?? false;
      if (next !== prefs[def.key]) {
        prefs[def.key] = next;
        prefsChanged = true;
      }
    }
    if (prefsChanged) broadcastPrefs();

    // Adopt synced values for every enabled key (mapped to the local schema key).
    for (const def of syncable) {
      if (prefs[def.key] && def.key in file.values) {
        applySyncedValue(localKeyByShared.get(def.key)!, file.values[def.key]);
      }
    }
  }

  // ─── Toggle handling (from the Sync tab) ───────────────────────────────

  function setPref(sharedKey: string, enabled: boolean): void {
    const localKey = localKeyByShared.get(sharedKey);
    if (!localKey) return;
    prefs[sharedKey] = enabled;
    updateSharedSync((file) => {
      file.prefs[sharedKey] = enabled;
      // Enabling seeds the shared value from THIS app, so the other adopts ours.
      if (enabled) file.values[sharedKey] = (getValues() as Record<string, unknown>)[localKey];
    });
    broadcastPrefs();
  }

  function setAll(enabled: boolean): void {
    for (const def of syncable) prefs[def.key] = enabled;
    updateSharedSync((file) => {
      for (const def of syncable) {
        file.prefs[def.key] = enabled;
        if (enabled) {
          file.values[def.key] = (getValues() as Record<string, unknown>)[localKeyByShared.get(def.key)!];
        }
      }
    });
    broadcastPrefs();
  }

  // ─── Wiring ────────────────────────────────────────────────────────────

  let unwatch: (() => void) | null = null;

  function start(): void {
    ipcMain.handle("get-sync-prefs", () => prefsForRenderer());
    ipcMain.on("set-sync-pref", (_e, key: string, enabled: boolean) => setPref(key, enabled));
    ipcMain.on("set-sync-all", (_e, enabled: boolean) => setAll(enabled));
    unwatch = watchSettingsFile("shared.json", onSharedChanged);
  }

  function dispose(): void {
    unwatch?.();
    unwatch = null;
    if (appSaveTimer) {
      clearTimeout(appSaveTimer);
      // Flush a final save so nothing is lost on quit.
      saveAppSettings(appName, collectNonVolatile());
    }
    if (sharedSaveTimer) {
      clearTimeout(sharedSaveTimer);
      if (pendingSharedValues.size) {
        updateSharedSync((file) => {
          for (const [k, v] of pendingSharedValues) file.values[k] = v;
        });
      }
    }
    ipcMain.removeHandler("get-sync-prefs");
    ipcMain.removeAllListeners("set-sync-pref");
    ipcMain.removeAllListeners("set-sync-all");
  }

  return { initialValues: initialValues as Partial<SettingsValues<S>>, onLocalChange, start, dispose };
}
