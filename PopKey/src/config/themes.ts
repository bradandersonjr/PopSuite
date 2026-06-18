import type { ColorPalette } from "@keys/store/useStore";

/** Badge color palettes — 6 accent colors per palette for styling key badges */
export const BADGE_COLORS_MUTED: [string, string, string, string, string, string] = [
    "#F05A5A", "#E38A3E", "#E3C84C", "#45C27D", "#4F8DFF", "#B07CFF",
];
export const BADGE_COLORS_VIBRANT: [string, string, string, string, string, string] = [
    "#FF2D2D", "#FF6B00", "#FFD600", "#00E065", "#0075FF", "#A033FF",
];
export const BADGE_COLORS_RETRO: [string, string, string, string, string, string] = [
    "#FF006E", "#FB5607", "#FFBE0B", "#00D084", "#00B4D8", "#9D4EDD",
];
export const BADGE_COLORS_NEON: [string, string, string, string, string, string] = [
    "#FF0099", "#FF6600", "#FFFF00", "#00FF41", "#00FFFF", "#BF00FF",
];
export const BADGE_COLORS_PASTEL: [string, string, string, string, string, string] = [
    "#FF8FAB", "#FFB347", "#FFF176", "#A8E6CF", "#A0C4FF", "#D5A6F0",
];
export const BADGE_COLORS_GRADIENT: [string, string, string, string, string, string] = [
    "#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#0A84FF", "#AF52DE",
];
export const BADGE_COLORS_GLITTER: [string, string, string, string, string, string] = [
    "#FF69B4", "#C0C0FF", "#FFD700", "#7FFFD4", "#E6CAFF", "#F4A0C0",
];

/** All badge palettes in index order — matches ColorPalette union order */
export const ALL_BADGE_PALETTES = [
    BADGE_COLORS_MUTED,
    BADGE_COLORS_VIBRANT,
    BADGE_COLORS_RETRO,
    BADGE_COLORS_NEON,
    BADGE_COLORS_PASTEL,
    BADGE_COLORS_GRADIENT,
    BADGE_COLORS_GLITTER,
] as const;

// "solid" has no fixed swatch set — it maps to a dummy index and the live color
// is injected at the component layer (see resolvePaletteColors).
const PALETTE_INDEX: Record<ColorPalette, number> = {
    muted: 0, vibrant: 1, retro: 2, neon: 3, pastel: 4, gradient: 5, glitter: 6, solid: 0,
};

/** Get the 6-color badge palette for a given ColorPalette name */
export const getBadgeColors = (palette: ColorPalette) => {
    return ALL_BADGE_PALETTES[PALETTE_INDEX[palette]];
};

/** Palette names in display order */
export const PALETTE_NAMES: ColorPalette[] = [
    "muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid",
];

/** Premium palettes — selectable only with a PopKey Pro license. (None today.) */
export const PRO_PALETTES: ReadonlySet<ColorPalette> = new Set<ColorPalette>();

/** Resolve the effective badge colors, injecting the live solid color. */
export function resolvePaletteColors(palette: ColorPalette, solidColor: string): readonly string[] {
    if (palette === "solid") return [solidColor];
    return getBadgeColors(palette);
}

/** Palette free users fall back to if a Pro palette is somehow active unlicensed. */
export const DEFAULT_FREE_PALETTE: ColorPalette = "retro";

export const isProPalette = (palette: ColorPalette): boolean => PRO_PALETTES.has(palette);

/** Helper to generate a 30° hue-shifted gradient pair for a base color */
export function getBadgeGradientStops(color: string): readonly string[] {
  // Parse hex color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 30° hue rotation: rotate RGB channels
  const shiftR = Math.round(r * 0.866 + g * 0.5); // ~86.6% r + ~50% g
  const shiftG = Math.round(g * 0.866 + b * 0.5); // ~86.6% g + ~50% b
  const shiftB = Math.round(b * 0.866 + r * 0.5); // ~86.6% b + ~50% r

  const shiftColor = `#${Math.min(255, shiftR).toString(16).padStart(2, "0")}${Math.min(255, shiftG).toString(16).padStart(2, "0")}${Math.min(255, shiftB).toString(16).padStart(2, "0")}`;
  return [color, shiftColor];
}
