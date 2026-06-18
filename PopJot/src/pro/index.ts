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

export const getProPalette = (
  _palette: ColorPalette | null,
): { draw: readonly string[]; highlighter: readonly string[] } | null => null;

export const setProPalette = (_draw: string[], _highlighter: string[]): void => {};

export const clearProPalette = (): void => {};

// ─── Palette Active Toggle ────────────────────────────────────────────────────

export const isProPaletteActive = (): boolean => false;

export const setProPaletteActive = (_active: boolean): void => {};

// ─── Presets ──────────────────────────────────────────────────────────────────

export type PalettePreset = {
  id: string;
  name: string;
  draw: string[];
  highlighter: string[];
};

export const getProPresets = (): PalettePreset[] => [];

export const saveProPreset = (name: string, draw: string[], highlighter: string[]): PalettePreset => ({
  id: Date.now().toString(),
  name,
  draw,
  highlighter,
});

export const deleteProPreset = (_id: string): void => {};

// ─── Custom Center Icon ───────────────────────────────────────────────────────

export const getProCenterIcon = (): string | null => null;

export const setProCenterIcon = (_dataUrl: string): void => {};

export const clearProCenterIcon = (): void => {};

// ─── Center Circle Scale ──────────────────────────────────────────────────────

export const getProCenterScale = (): number => 1;

export const setProCenterScale = (_scale: number): void => {};

// ─── Pro Stroke Effect ────────────────────────────────────────────────────────

export type ProEffect = "none" | "gradient" | "glitter";

export const getProEffect = (): ProEffect => "none";

export const setProEffect = (_effect: ProEffect): void => {};

// ─── Effective Colors ─────────────────────────────────────────────────────────

/**
 * Free build: always the built-in palette (no Pro overrides). Mirrors the
 * private implementation's signature so callers are identical in both builds.
 */
export const getEffectiveColors = (palette: ColorPalette) => getColors(palette);
