/**
 * Config import/export — serialize the current settings to JSON and restore
 * them from a previously exported file. Schema-driven, so every app gets it
 * for free and new settings are included automatically. Volatile settings
 * (e.g. per-monitor scale) are skipped; unknown/invalid values are ignored.
 */

import {
  type SettingsSchema,
  isValidSettingValue,
  setterName,
} from "./schema";
import { createSettingsPlatform } from "./renderer";

/** A store exposing the schema's values and `set<Key>` setters (Zustand). */
type SettingsStore = { getState(): unknown };

/** Build a plain object of current (non-volatile) settings for export. */
export function collectSettings(schema: SettingsSchema, store: SettingsStore): Record<string, unknown> {
  const state = store.getState() as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.volatile) continue;
    out[key] = state[key];
  }
  return out;
}

/**
 * Apply imported settings: validates each value against the schema, updates the
 * store, and broadcasts to the main process so other windows + persistence sync.
 * Returns the number of settings applied.
 */
export function applySettings(
  schema: SettingsSchema,
  store: SettingsStore,
  data: unknown
): number {
  if (!data || typeof data !== "object") return 0;
  const incoming = data as Record<string, unknown>;
  const platform = createSettingsPlatform(schema);
  const state = store.getState() as Record<string, unknown>;
  let applied = 0;
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.volatile) continue;
    if (!(key in incoming)) continue;
    const value = incoming[key];
    if (!isValidSettingValue(spec, value)) continue;
    (state[setterName(key)] as (v: unknown) => void)?.(value);
    platform.sendSetting(key as never, value as never);
    applied++;
  }
  return applied;
}

/** Pretty JSON for download. */
export function exportSettingsJson(schema: SettingsSchema, store: SettingsStore): string {
  return JSON.stringify(collectSettings(schema, store), null, 2);
}
