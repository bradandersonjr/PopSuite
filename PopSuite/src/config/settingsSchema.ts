import { setting } from "@shared/settings/schema";

/**
 * PopSuite's own (shell-level) settings. The keys/jot appearance settings live
 * in their modules' schemas, registered under the "keys"/"jot" namespaces by
 * the combined main process. This suite schema owns only what is shared or
 * shell-level: the settings-window theme, per-monitor scale, and the two
 * module-enable toggles.
 *
 * The suite schema itself is unnamespaced — it owns the root channel space, and
 * the module schemas are prefixed, so nothing collides.
 */
export const settingsSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  // Master enable toggles for each module. Disabling a module stops its
  // subsystem (uiohook / annotation hotkeys) and hides its overlay layer.
  keysEnabled: setting.boolean(true),
  jotEnabled: setting.boolean(true),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
} as const;

export type SettingsSchema = typeof settingsSchema;
