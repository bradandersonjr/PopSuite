/**
 * Pro features — PUBLIC STUB.
 *
 * This is the free, fair-source build. Every Pro feature is disabled here and
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
 *
 * DESKTOP GATE: on desktop the custom-palette settings persist to
 * ~/.popsuite/popjot.json, so a free user could hand-edit that file to try to
 * activate a Pro-only palette. `getProPalette` therefore refuses to return a
 * palette on desktop unless the license flag (`licensed` / `isPro()`) is set —
 * so hand-edited settings do nothing without a valid key. The web demo is
 * unaffected because `isDesktop()` is false there.
 *
 * Custom-palette state (proDrawPalette/proHighlighterPalette/proPaletteActive)
 * is NOT module-level here — it lives in the Zustand store as real schema
 * settings (see config/settingsSchema.ts) so edits made in the Settings window
 * sync via the normal tray-settings IPC to the overlay window that actually
 * renders the real menu. Those are two separate Electron renderer processes;
 * plain module state doesn't cross that boundary.
 */

import { getColors } from "@popjot/config/themes";
import { useStore, type ColorPalette } from "@popjot/store/useStore";
import { isDesktop } from "@popjot/lib/platform";
import { sendProDrawPalette, sendProHighlighterPalette, sendProPaletteActive } from "@popjot/lib/platform";

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

function parsePaletteJson(json: string): string[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.every((c) => typeof c === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export const getProPalette = (
  _p: ColorPalette | null,
): { draw: readonly string[]; highlighter: readonly string[] } | null => {
  // Desktop gate: hand-edited ~/.popsuite/popjot.json can't unlock Pro palettes
  // without a valid license. Web demo (isDesktop() === false) stays unlocked.
  if (isDesktop() && !isPro()) return null;
  const state = useStore.getState();
  if (!state.proPaletteActive) return null;
  const draw = parsePaletteJson(state.proDrawPalette);
  const highlighter = parsePaletteJson(state.proHighlighterPalette);
  if (!draw || !highlighter) return null;
  return { draw, highlighter };
};

export const setProPalette = (draw: string[], highlighter: string[]): void => {
  const drawJson = JSON.stringify(draw);
  const hlJson = JSON.stringify(highlighter);
  useStore.getState().setProDrawPalette(drawJson);
  useStore.getState().setProHighlighterPalette(hlJson);
  if (isDesktop()) {
    sendProDrawPalette(drawJson);
    sendProHighlighterPalette(hlJson);
  }
};

export const clearProPalette = (): void => {
  useStore.getState().setProDrawPalette("");
  useStore.getState().setProHighlighterPalette("");
  if (isDesktop()) {
    sendProDrawPalette("");
    sendProHighlighterPalette("");
  }
};

// ─── Palette Active Toggle ────────────────────────────────────────────────────

export const isProPaletteActive = (): boolean => getProPalette(null) !== null;

export const setProPaletteActive = (active: boolean): void => {
  useStore.getState().setProPaletteActive(active);
  if (isDesktop()) sendProPaletteActive(active);
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
  const pro = getProPalette(null);
  if (pro) {
    return {
      draw: pro.draw,
      highlighter: pro.highlighter,
      tertiary: base.tertiary,
    };
  }
  return base;
};
