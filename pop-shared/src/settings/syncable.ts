/**
 * The set of settings that can be synced between PopKey and PopJot.
 *
 * Only keys that exist (with compatible meaning) in BOTH apps' schemas belong
 * here. Each app filters this list down to the keys its own schema actually
 * defines, so the same constant is safe to import everywhere.
 */

export interface SyncableKeyDef {
  key: string;
  label: string;
  /** Short hint shown under the toggle in the Sync tab. */
  description: string;
}

export const SYNCABLE_KEYS: readonly SyncableKeyDef[] = [
  { key: "themeMode", label: "Theme Mode", description: "Dark / light appearance" },
  { key: "colorPalette", label: "Color Palette", description: "The active color scheme" },
  { key: "solidColor", label: "Solid Color", description: "Custom color for the Solid palette" },
  {
    key: "animationIntensity",
    label: "Animation Intensity",
    description: "How animated interactions feel",
  },
  { key: "glowIntensity", label: "Glow Intensity", description: "Strength of the glow halo" },
  {
    key: "brandingEnabled",
    label: "Branding",
    description: "Keep the logo branding on/off in step (each app uses its own logo)",
  },
] as const;

/** The syncable keys this app actually has, in display order. */
export function syncableKeysFor(schema: Record<string, unknown>): SyncableKeyDef[] {
  return SYNCABLE_KEYS.filter((def) => def.key in schema);
}

/** All-false preferences map for the given app's syncable keys (opt-in default). */
export function defaultSyncPrefs(schema: Record<string, unknown>): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  for (const def of syncableKeysFor(schema)) prefs[def.key] = false;
  return prefs;
}
