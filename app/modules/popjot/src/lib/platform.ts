/**
 * Platform abstraction layer — PopJot.
 * In Electron: delegates to window.electronAPI (exposed by preload).
 * In web: all functions are safe no-ops.
 */

import {
  createSettingsPlatform,
  getShortcuts as getNamedShortcuts,
  setNamedShortcut,
  type ShortcutUpdateResult,
} from "@shared/settings/renderer";
import { settingsSchema } from "@/config/settingsSchema";
import type {
  ThemeMode,
  ColorPalette,
  AnimationIntensity,
  MenuStyle,
  GridMode,
  GridSize,
  OverlayMode,
  TextColor,
} from "@/store/useStore";

export {
  isDesktop,
  isExtension,
  isSettingsWindow,
  quitApp,
  getOpenAtLogin,
  setOpenAtLogin,
} from "@shared/settings/renderer";
export type { ShortcutUpdateResult };

type Position = { x: number; y: number };

const settings = createSettingsPlatform(settingsSchema);

export const sendThemeMode = (mode: ThemeMode): void => settings.sendSetting("themeMode", mode);
export const sendColorPalette = (palette: ColorPalette): void =>
  settings.sendSetting("colorPalette", palette);
export const sendLastColorPalette = (palette: ColorPalette): void =>
  settings.sendSetting("lastColorPalette", palette);
export const sendAnimationIntensity = (intensity: AnimationIntensity): void =>
  settings.sendSetting("animationIntensity", intensity);
export const sendMenuStyle = (style: MenuStyle): void => settings.sendSetting("menuStyle", style);
export const sendScaleMultiplier = (multiplier: number): void => settings.sendSetting("scaleMultiplier", multiplier);
export const sendGridMode = (mode: GridMode): void => settings.sendSetting("gridMode", mode);
export const sendGridSize = (size: GridSize): void => settings.sendSetting("gridSize", size);
export const sendOverlayMode = (mode: OverlayMode): void =>
  settings.sendSetting("overlayMode", mode);
export const sendSpotlightDimOpacity = (val: number): void =>
  settings.sendSetting("spotlightDimOpacity", val);
export const sendSpotlightRadius = (val: number): void =>
  settings.sendSetting("spotlightRadius", val);
export const sendSpotlightFeather = (val: boolean): void =>
  settings.sendSetting("spotlightFeather", val);
export const sendButtonRoundness = (val: number): void =>
  settings.sendSetting("buttonRoundness", val);
export const sendMenuTranslucency = (val: number): void =>
  settings.sendSetting("menuTranslucency", val);
export const sendBrandingEnabled = (val: boolean): void =>
  settings.sendSetting("brandingEnabled", val);
export const sendBrandingImage = (dataUrl: string): void =>
  settings.sendSetting("brandingImage", dataUrl);
export const sendBrandingScale = (val: number): void =>
  settings.sendSetting("brandingScale", val);
export const sendGlowIntensity = (val: number): void =>
  settings.sendSetting("glowIntensity", val);
export const sendTextColor = (val: TextColor): void =>
  settings.sendSetting("textColor", val);
export const sendSolidColor = (color: string): void =>
  settings.sendSetting("solidColor", color);

export function overlayActivated(): void {
  window.electronAPI?.overlayActivated();
}

export function overlayDeactivated(): void {
  window.electronAPI?.overlayDeactivated();
}

// ─── Spotlight presenter mode ──────────────────────────────────────

export function onSpotlightSet(callback: (active: boolean) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onSpotlightSet(callback);
}

export function onSpotlightCursor(callback: (pos: Position) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onSpotlightCursor(callback);
}

export function onShortcutActivate(
  callback: (pos: Position, snapshotDataUrl: string | null) => void
): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onShortcutActivate(callback);
}

export function onShortcutPersistent(
  callback: (pos: Position, snapshotDataUrl: string | null) => void
): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onShortcutPersistent(callback);
}

export async function setMainShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("main", shortcut);
}

export async function setPersistentShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("persistent", shortcut);
}

export async function setSpotlightShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("spotlight", shortcut);
}

export async function getShortcuts(): Promise<{ main: string; persistent: string; spotlight: string }> {
  return getNamedShortcuts({ main: "", persistent: "", spotlight: "" });
}
