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
import { settingsSchema } from "@/config/settingsSchema";
import type {
  ThemeMode,
  ColorPalette,
  AnimationIntensity,
  DisplayPosition,
  BadgeStyle,
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

const settings = createSettingsPlatform(settingsSchema);

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
export const sendBadgeTranslucency = (val: number): void =>
  settings.sendSetting("badgeTranslucency", val);
export const sendBadgeBlur = (val: number): void => settings.sendSetting("badgeBlur", val);
export const sendBadgeRoundness = (val: number): void =>
  settings.sendSetting("badgeRoundness", val);
export const sendFontSize = (size: number): void => settings.sendSetting("fontSize", size);
export const sendKeyboardEnabled = (val: boolean): void =>
  settings.sendSetting("keyboardEnabled", val);
export const sendWordMode = (val: boolean): void => settings.sendSetting("wordMode", val);
export const sendMouseEnabled = (val: boolean): void => settings.sendSetting("mouseEnabled", val);
export const sendShowMouseClicks = (val: boolean): void =>
  settings.sendSetting("showMouseClicks", val);
export const sendShowScrollWheel = (val: boolean): void =>
  settings.sendSetting("showScrollWheel", val);
export const sendPopMonoColor = (color: string): void =>
  settings.sendSetting("popMonoColor", color);
export const sendScrollColor = (color: string): void => settings.sendSetting("scrollColor", color);
export const sendClickColor = (color: string): void => settings.sendSetting("clickColor", color);
export const sendScaleFactor = (scale: number): void => settings.sendSetting("scaleFactor", scale);

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
