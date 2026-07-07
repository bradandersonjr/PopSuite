/**
 * Pro features — PUBLIC STUB.
 *
 * This is the free/open-source build. Every Pro feature is disabled here and
 * each getter returns the "off" value while each setter is a no-op, so the app
 * compiles and runs identically to the free product.
 *
 * The real implementation lives in the private Pro repo and is swapped in at
 * build time to produce the paid binaries. Do NOT put the real logic here —
 * anything committed to this file ships in the public repo.
 *
 * Keep this file's exported surface (names, signatures, types) in lockstep
 * with the private implementation so both builds typecheck against it.
 *
 * NOTE: The web demo (embedded/WebRoot) bypasses the license gate via
 * `effectiveIsPro` in SystemTray, so the UI is fully unlocked. The in-memory
 * state below makes the features actually functional during a web session
 * without requiring the private Pro build.
 */

import { getColors } from "@/config/themes";
import type { ColorPalette } from "@/store/useStore";

/**
 * License gate. The real (private) build flips this via `setProLicensed` when a
 * valid key is active and gates every feature on it. In this public stub there
 * are no feature implementations, so `isPro` tracks the flag (so the UI can show
 * "unlocked") but the getters below stay no-ops regardless.
 */
let licensed = false;

export const setProLicensed = (value: boolean): void => {
  licensed = value;
};

export const isPro = (): boolean => licensed;

// ─── Custom Palette ───────────────────────────────────────────────────────────

let _palette: { draw: string[]; highlighter: string[] } | null = null;

export const getProPalette = (
  _p: ColorPalette | null,
): { draw: readonly string[]; highlighter: readonly string[] } | null => _palette;

export const setProPalette = (draw: string[], highlighter: string[]): void => {
  _palette = { draw, highlighter };
};

export const clearProPalette = (): void => {
  _palette = null;
};

// ─── Palette Active Toggle ────────────────────────────────────────────────────

let _paletteActive = false;

export const isProPaletteActive = (): boolean => _paletteActive && _palette !== null;

export const setProPaletteActive = (active: boolean): void => {
  _paletteActive = active;
};

// ─── Presets ──────────────────────────────────────────────────────────────────

export type PalettePreset = {
  id: string;
  name: string;
  draw: string[];
  highlighter: string[];
};

let _presets: PalettePreset[] = [];

export const getProPresets = (): PalettePreset[] => [..._presets];

export const saveProPreset = (name: string, draw: string[], highlighter: string[]): PalettePreset => {
  const p: PalettePreset = { id: Date.now().toString(), name, draw, highlighter };
  _presets.push(p);
  return p;
};

export const deleteProPreset = (id: string): void => {
  _presets = _presets.filter((p) => p.id !== id);
};

// ─── Custom Center Icon ───────────────────────────────────────────────────────

export const getProCenterIcon = (): string | null => null;

export const setProCenterIcon = (_dataUrl: string): void => {};

export const clearProCenterIcon = (): void => {};

// ─── Center Circle Scale ──────────────────────────────────────────────────────

export const getProCenterScale = (): number => 1;

export const setProCenterScale = (_scale: number): void => {};

// ─── Pro Stroke Effect ────────────────────────────────────────────────────────

export type ProEffect = "none" | "gradient" | "glitter";

let _effect: ProEffect = "none";

export const getProEffect = (): ProEffect => _effect;

export const setProEffect = (effect: ProEffect): void => {
  _effect = effect;
};

// ─── Effective Colors ─────────────────────────────────────────────────────────

/**
 * Returns the active custom palette when set, otherwise falls back to the
 * built-in palette. Mirrors the private implementation's signature.
 *
 * Always returns the same shape — { draw, highlighter, tertiary } — so callers
 * can destructure any slot without a discriminated union. A custom Pro palette
 * only overrides draw/highlighter; the center-circle tertiary colors always come
 * from the built-in palette so the center still has a sensible accent color.
 */
export const getEffectiveColors = (
  palette: ColorPalette,
): { draw: readonly string[]; highlighter: readonly string[]; tertiary: readonly string[] } => {
  const base = getColors(palette);
  if (_paletteActive && _palette) {
    return {
      draw: _palette.draw as readonly string[],
      highlighter: _palette.highlighter as readonly string[],
      tertiary: base.tertiary,
    };
  }
  return base;
};
