/**
 * Shared settings persistence layer.
 * Both PopKey and PopJot read/write to ~/.popsuite/settings.json.
 * File watcher notifies the app when the file changes externally.
 */

import { join } from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync, watch, readFileSync } from "fs";
import { homedir } from "os";
import type { SettingsSchema, SettingsValues } from "./schema";

function getSharedSettingsDir(): string {
  return join(homedir(), ".popsuite");
}

export function getSharedSettingsPath(): string {
  return join(getSharedSettingsDir(), "settings.json");
}

/** Load settings from the shared file synchronously, or return empty object if missing. */
export function loadSharedSettingsSync<S extends SettingsSchema>(
  schema: S
): Partial<SettingsValues<S>> {
  const path = getSharedSettingsPath();
  if (!existsSync(path)) return {};

  try {
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content);
    // Only return keys that exist in the schema (ignore stale/unknown settings)
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
      if (key in parsed) filtered[key] = parsed[key];
    }
    return filtered as Partial<SettingsValues<S>>;
  } catch {
    return {};
  }
}

/** Load settings from the shared file asynchronously, or return empty object if missing. */
export async function loadSharedSettings<S extends SettingsSchema>(
  schema: S
): Promise<Partial<SettingsValues<S>>> {
  const path = getSharedSettingsPath();
  if (!existsSync(path)) return {};

  try {
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content);
    // Only return keys that exist in the schema (ignore stale/unknown settings)
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
      if (key in parsed) filtered[key] = parsed[key];
    }
    return filtered as Partial<SettingsValues<S>>;
  } catch {
    return {};
  }
}

/** Save settings to the shared file. Creates directory if needed. */
export async function saveSharedSettings<S extends SettingsSchema>(
  values: SettingsValues<S>,
  schema: S
): Promise<void> {
  const dir = getSharedSettingsDir();
  const path = getSharedSettingsPath();

  // Only save non-volatile settings
  const toSave: Record<string, unknown> = {};
  for (const key of Object.keys(schema) as Array<keyof S & string>) {
    if (!schema[key].volatile) {
      toSave[key] = values[key];
    }
  }

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save shared settings:", err);
  }
}

/**
 * Create a debounced save handler for settings.
 * Batches rapid changes and saves once per 500ms.
 */
export function createSettingsSaver<S extends SettingsSchema>(
  schema: S,
  getValues: () => SettingsValues<S>
): () => void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveSharedSettings(getValues(), schema);
      saveTimer = null;
    }, 500);
  };
}

/**
 * Watch the shared settings file for external changes.
 * Calls `onExternalChange()` when the file is written by another app.
 * Returns an unwatch function.
 */
export function watchSharedSettings(onExternalChange: () => void): () => void {
  const dir = getSharedSettingsDir();

  // Debounce: file might be written multiple times in quick succession
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedCallback = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onExternalChange();
      debounceTimer = null;
    }, 200);
  };

  // Watch the directory (not the file itself, in case it's deleted/recreated)
  try {
    const watcher = watch(dir, { persistent: false }, (eventType, filename) => {
      if (filename === "settings.json" && eventType === "change") {
        debouncedCallback();
      }
    });

    return () => {
      watcher.close();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  } catch {
    // Directory doesn't exist yet; return no-op unwatch
    return () => {};
  }
}
