/**
 * Shared utilities for reading/writing PopJot settings in chrome.storage.local.
 * Used by both the content-script root (ExtensionRoot) and the popup (ExtensionPopup).
 */

import { useStore } from "@/store/useStore";
import type {
  MenuStyle,
  ColorPalette,
  ThemeMode,
  AnimationIntensity,
  GridMode,
  GridSize,
  OverlayMode,
} from "@/store/useStore";

export const EXTENSION_STORAGE_KEYS = [
  "menuStyle",
  "colorPalette",
  "themeMode",
  "animationIntensity",
  "gridMode",
  "gridSize",
  "overlayMode",
] as const;

// scaleFactor is intentionally excluded — it must always be calculated
// fresh from the monitor's physical resolution at runtime, never persisted.
export type StoredSettings = Partial<{
  menuStyle: MenuStyle;
  colorPalette: ColorPalette;
  themeMode: ThemeMode;
  animationIntensity: AnimationIntensity;
  gridMode: GridMode;
  gridSize: GridSize;
  overlayMode: OverlayMode;
}>;

/** Apply a partial settings object from storage into the Zustand store. */
export function applyStoredSettings(settings: StoredSettings): void {
  const store = useStore.getState();
  // Use `!= null` instead of truthy checks — "none" is a valid gridMode value but falsy.
  if (settings.menuStyle != null) store.setMenuStyle(settings.menuStyle);
  if (settings.colorPalette != null) store.setColorPalette(settings.colorPalette);
  if (settings.themeMode != null) store.setThemeMode(settings.themeMode);
  if (settings.animationIntensity != null) store.setAnimationIntensity(settings.animationIntensity);
  if (settings.gridMode != null) store.setGridMode(settings.gridMode);
  if (settings.gridSize != null) store.setGridSize(settings.gridSize);
  if (settings.overlayMode != null) store.setOverlayMode(settings.overlayMode);
  // scaleFactor is never applied from storage — always recalculated from monitor resolution.
}

/** Snapshot the current store state into a StoredSettings object. */
export function currentSettingsSnapshot(): StoredSettings {
  const s = useStore.getState();
  return {
    menuStyle: s.menuStyle,
    colorPalette: s.colorPalette,
    themeMode: s.themeMode,
    animationIntensity: s.animationIntensity,
    gridMode: s.gridMode,
    gridSize: s.gridSize,
    overlayMode: s.overlayMode,
    // scaleFactor excluded — always recalculated from monitor resolution at runtime.
  };
}
