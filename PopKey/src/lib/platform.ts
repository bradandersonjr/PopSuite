/**
 * Platform abstraction layer — PopKey.
 * In Electron: delegates to window.electronAPI (exposed by preload).
 * In web: all functions are safe no-ops.
 */

import {
  createSettingsPlatform,
  getShortcuts as getNamedShortcuts,
  setNamedShortcut,
  type ShortcutUpdateResult,
} from "@shared/settings/renderer";
import { settingsSchema, SETTINGS_NAMESPACE } from "@keys/config/settingsSchema";
import type {
  ThemeMode,
  ColorPalette,
  AnimationIntensity,
  DisplayPosition,
  BadgeStyle,
  BadgeTextColor,
  ClickEffect,
  BrandingCorner,
  BadgeFont,
  BadgeAnimation,
} from "@keys/store/useStore";

export {
  isDesktop,
  isExtension,
  isSettingsWindow,
  quitApp,
  getOpenAtLogin,
  setOpenAtLogin,
} from "@shared/settings/renderer";
export type { ShortcutUpdateResult };

// Raw uiohook event shapes forwarded by the main process (see main/inputCapture.ts).
export type KeyEvent = { key: string; keycode: number; modifier: boolean; time: number };
export type ClickEvent = {
  button: number;
  x: number;
  y: number;
  time: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  dx?: number;
  dy?: number;
};
export type WheelEventData = { direction: "up" | "down"; x: number; y: number; amount: number; time: number };
export type DragEventData = ClickEvent & { dx: number; dy: number };

const settings = createSettingsPlatform(settingsSchema, SETTINGS_NAMESPACE);

export const sendThemeMode = (mode: ThemeMode): void => settings.sendSetting("themeMode", mode);
export const sendColorPalette = (palette: ColorPalette): void =>
  settings.sendSetting("colorPalette", palette);
export const sendAnimationIntensity = (intensity: AnimationIntensity): void =>
  settings.sendSetting("animationIntensity", intensity);
export const sendScaleMultiplier = (multiplier: number): void =>
  settings.sendSetting("scaleMultiplier", multiplier);
export const sendDisplayPosition = (pos: DisplayPosition): void =>
  settings.sendSetting("displayPosition", pos);
export const sendPositionOffsetX = (val: number): void =>
  settings.sendSetting("positionOffsetX", val);
export const sendPositionOffsetY = (val: number): void =>
  settings.sendSetting("positionOffsetY", val);
export const sendBadgeDuration = (ms: number): void => settings.sendSetting("badgeDuration", ms);
export const sendMaxBadges = (n: number): void => settings.sendSetting("maxBadges", n);
export const sendBadgeStyle = (style: BadgeStyle): void => settings.sendSetting("badgeStyle", style);
export const sendBadgeTextColor = (val: BadgeTextColor): void =>
  settings.sendSetting("badgeTextColor", val);
export const sendBadgeFont = (val: BadgeFont): void => settings.sendSetting("badgeFont", val);
export const sendBadgeAnimation = (val: BadgeAnimation): void =>
  settings.sendSetting("badgeAnimation", val);
export const sendBadgeTranslucency = (val: number): void =>
  settings.sendSetting("badgeTranslucency", val);
export const sendBadgeRoundness = (val: number): void =>
  settings.sendSetting("badgeRoundness", val);
export const sendGlowIntensity = (val: number): void =>
  settings.sendSetting("glowIntensity", val);
export const sendFontSize = (size: number): void => settings.sendSetting("fontSize", size);
export const sendKeyboardEnabled = (val: boolean): void =>
  settings.sendSetting("keyboardEnabled", val);
export const sendShowKeyRepeat = (val: boolean): void =>
  settings.sendSetting("showKeyRepeat", val);
export const sendWordMode = (val: boolean): void => settings.sendSetting("wordMode", val);
export const sendMouseEnabled = (val: boolean): void => settings.sendSetting("mouseEnabled", val);
export const sendShowMouseClicks = (val: boolean): void =>
  settings.sendSetting("showMouseClicks", val);
export const sendShowScrollWheel = (val: boolean): void =>
  settings.sendSetting("showScrollWheel", val);
export const sendScrollColor = (color: string): void => settings.sendSetting("scrollColor", color);
export const sendClickColor = (color: string): void => settings.sendSetting("clickColor", color);
export const sendClickEffect = (effect: ClickEffect): void =>
  settings.sendSetting("clickEffect", effect);
export const sendClickSize = (px: number): void => settings.sendSetting("clickSize", px);
export const sendSolidColor = (color: string): void => settings.sendSetting("solidColor", color);
export const sendBrandingEnabled = (val: boolean): void =>
  settings.sendSetting("brandingEnabled", val);
export const sendBrandingImage = (dataUrl: string): void =>
  settings.sendSetting("brandingImage", dataUrl);
export const sendBrandingCorner = (corner: BrandingCorner): void =>
  settings.sendSetting("brandingCorner", corner);
export const sendBrandingSize = (px: number): void => settings.sendSetting("brandingSize", px);
export const sendBrandingOpacity = (val: number): void =>
  settings.sendSetting("brandingOpacity", val);
export const sendBrandingRadius = (val: number): void =>
  settings.sendSetting("brandingRadius", val);
export const sendScaleFactor = (scale: number): void => settings.sendSetting("scaleFactor", scale);
export const sendObsMode = (val: boolean): void => settings.sendSetting("obsMode", val);

export async function setMainShortcut(shortcut: string): Promise<ShortcutUpdateResult> {
  return setNamedShortcut("main", shortcut);
}

export async function getShortcuts(): Promise<{ main: string }> {
  return getNamedShortcuts({ main: "" });
}

export function onShortcutToggle(callback: (enabled: boolean) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onShortcutToggle(callback);
}

export function onInputKeyDown(callback: (e: KeyEvent) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputKeyDown(callback);
}

export function onInputKeyUp(callback: (e: KeyEvent) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputKeyUp(callback);
}

export function onInputClick(callback: (e: ClickEvent) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputClick(callback);
}

export function onInputWheel(callback: (e: WheelEventData) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputWheel(callback);
}

export function onInputDrag(callback: (e: DragEventData) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputDrag(callback);
}

export function onInputDragMove(callback: (e: { button: number; dx: number; dy: number }) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputDragMove(callback);
}

export function onInputFocusLost(callback: () => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onInputFocusLost(callback);
}
