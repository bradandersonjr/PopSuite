/**
 * Low-level settings persistence — file IO for the two-tier model.
 *
 *   ~/.popsuite/<app>.json   — one file per app, the app's full non-volatile
 *                              settings. Never touched by the other app, so
 *                              app-specific keys are safe and unsynced settings
 *                              stay independent.
 *   ~/.popsuite/shared.json  — { prefs, values } for the syncable keys only.
 *                              `prefs` is the per-key on/off map (the Sync tab
 *                              choices, shared so both apps agree); `values`
 *                              holds the synced value for each enabled key.
 *
 * The orchestration that decides what to read/write lives in
 * main/settingsSync.ts; this module only does typed file IO + watching.
 */

import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from "fs";
import { homedir } from "os";

export interface SharedSyncFile {
  /** Per-key sync on/off. Missing key = use the app's opt-in default (false). */
  prefs: Record<string, boolean>;
  /** Latest synced value per enabled key. */
  values: Record<string, unknown>;
}

function settingsDir(): string {
  return join(homedir(), ".popsuite");
}

/** Create ~/.popsuite if missing so reads/writes/watches are reliable. */
export function ensureSettingsDir(): string {
  const dir = settingsDir();
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error("Failed to create settings dir:", err);
  }
  return dir;
}

export function appSettingsPath(appName: string): string {
  return join(settingsDir(), `${appName.toLowerCase()}.json`);
}

export function sharedSyncPath(): string {
  return join(settingsDir(), "shared.json");
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  try {
    ensureSettingsDir();
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Failed to write ${path}:`, err);
  }
}

// ─── Per-app settings ──────────────────────────────────────────────────

/** Load this app's persisted settings (raw object; caller filters by schema). */
export function loadAppSettings(appName: string): Record<string, unknown> {
  return readJson(appSettingsPath(appName)) ?? {};
}

export function saveAppSettings(appName: string, values: Record<string, unknown>): void {
  writeJson(appSettingsPath(appName), values);
}

// ─── Shared sync file ──────────────────────────────────────────────────

export function loadSharedSync(): SharedSyncFile {
  const raw = readJson(sharedSyncPath());
  const prefs = (raw?.prefs as Record<string, boolean> | undefined) ?? {};
  const values = (raw?.values as Record<string, unknown> | undefined) ?? {};
  return { prefs, values };
}

export function saveSharedSync(data: SharedSyncFile): void {
  writeJson(sharedSyncPath(), data);
}

/**
 * Read-modify-write the shared file under a mutator. Minimises the clobber
 * window when both apps touch shared.json (writes are debounced and
 * human-driven, so a full lock isn't warranted).
 */
export function updateSharedSync(mutate: (file: SharedSyncFile) => void): SharedSyncFile {
  const file = loadSharedSync();
  mutate(file);
  saveSharedSync(file);
  return file;
}

// ─── Watching ──────────────────────────────────────────────────────────

/**
 * Watch a file in ~/.popsuite for changes by name, debounced. Watches the
 * directory (not the inode) so it survives delete/recreate. Returns unwatch.
 */
export function watchSettingsFile(filename: string, onChange: () => void): () => void {
  ensureSettingsDir();
  const dir = settingsDir();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 150);
  };

  try {
    const watcher = watch(dir, { persistent: false }, (_event, changed) => {
      if (changed === filename) fire();
    });
    return () => {
      watcher.close();
      if (timer) clearTimeout(timer);
    };
  } catch {
    return () => {};
  }
}
