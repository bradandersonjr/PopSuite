/**
 * The set of settings that can be synced between PopKey and PopJot.
 *
 * Only keys that exist (with compatible meaning + value domain) in BOTH apps
 * belong here. Each app filters this list down to the keys its own schema
 * defines, so the same constant is safe to import everywhere.
 *
 * Some settings mean the same thing but have different key names per app
 * (e.g. PopKey `badgeStyle` vs PopJot `menuStyle`). For those, `key` is the
 * shared identifier (used in shared.json + as the Sync-tab toggle id) and
 * `localKeys` lists the per-app schema keys; each app uses whichever it has.
 */

export interface SyncableKeyDef {
  /** Shared identifier: the key in shared.json and the Sync-tab toggle id. */
  key: string;
  label: string;
  /** Short hint shown under the toggle in the Sync tab. */
  description: string;
  /**
   * Per-app local schema key names, when they differ from `key`. The app uses
   * whichever of these is present in its schema. Omit when the local key name
   * matches `key` in both apps.
   */
  localKeys?: readonly string[];
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
    key: "style",
    label: "Style",
    description: "Badge / menu style (flat, outline, pop, glow)",
    localKeys: ["badgeStyle", "menuStyle"],
  },
  {
    key: "brandingEnabled",
    label: "Branding",
    description: "Keep the logo branding on/off in step (each app uses its own logo)",
  },
] as const;

/** The local schema key this app uses for a syncable def, or null if absent. */
export function localKeyForSyncable(
  def: SyncableKeyDef,
  schema: Record<string, unknown>
): string | null {
  const candidates = def.localKeys ?? [def.key];
  for (const k of candidates) if (k in schema) return k;
  return null;
}

/** The syncable keys this app actually has, in display order. */
export function syncableKeysFor(schema: Record<string, unknown>): SyncableKeyDef[] {
  return SYNCABLE_KEYS.filter((def) => localKeyForSyncable(def, schema) !== null);
}

/** All-false preferences map for the given app's syncable keys (opt-in default). */
export function defaultSyncPrefs(schema: Record<string, unknown>): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  for (const def of syncableKeysFor(schema)) prefs[def.key] = false;
  return prefs;
}
