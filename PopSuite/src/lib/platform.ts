/**
 * Platform abstraction layer — PopSuite shell.
 * Covers only the suite's own settings + the combined shortcut set. The keys
 * and jot modules keep using their own @keys/lib/platform and @jot/lib/platform
 * (namespaced "keys"/"jot"), which work unchanged inside this process.
 */

import {
  createSettingsPlatform,
  getShortcuts as getNamedShortcuts,
  setNamedShortcut,
  type ShortcutUpdateResult,
} from "@shared/settings/renderer";
import { settingsSchema } from "@suite/config/settingsSchema";
import type { ThemeMode } from "@suite/store/useStore";

export {
  isDesktop,
  isExtension,
  isSettingsWindow,
  quitApp,
  getOpenAtLogin,
  setOpenAtLogin,
} from "@shared/settings/renderer";
export type { ShortcutUpdateResult };

const settings = createSettingsPlatform(settingsSchema);

export const sendThemeMode = (mode: ThemeMode): void => settings.sendSetting("themeMode", mode);
export const sendKeysEnabled = (val: boolean): void => settings.sendSetting("keysEnabled", val);
export const sendJotEnabled = (val: boolean): void => settings.sendSetting("jotEnabled", val);
export const sendScaleFactor = (scale: number): void => settings.sendSetting("scaleFactor", scale);

// Combined shortcut set: keys toggle + annotate (one-shot) + persistent draw.
export async function setKeysShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("keys", shortcut);
}
export async function setAnnotateShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("annotate", shortcut);
}
export async function setPersistentShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("persistent", shortcut);
}

export async function getShortcuts(): Promise<{ keys: string; annotate: string; persistent: string }> {
  return getNamedShortcuts({ keys: "", annotate: "", persistent: "" });
}
