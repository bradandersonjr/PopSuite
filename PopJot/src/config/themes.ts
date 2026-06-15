/** Draw color palettes for pen/marker sub-menus */
export const DRAW_COLORS_MUTED: [string, string, string, string, string, string] = [
    "#F05A5A", "#E38A3E", "#E3C84C", "#45C27D", "#4F8DFF", "#B07CFF",
];
export const DRAW_COLORS_VIBRANT: [string, string, string, string, string, string] = [
    "#FF2D2D", "#FF6B00", "#FFD600", "#00E065", "#0075FF", "#A033FF",
];

/** Highlighter color palettes: yellow, green, pink, blue */
export const HIGHLIGHTER_COLORS_MUTED: [string, string, string, string] = [
    "#E3C84C", "#45C27D", "#FF5C7A", "#4F8DFF",
];
export const HIGHLIGHTER_COLORS_VIBRANT: [string, string, string, string] = [
    "#FFD600", "#00E065", "#FF1A4B", "#0075FF",
];

/** 90s Retro color palettes */
export const DRAW_COLORS_RETRO: [string, string, string, string, string, string] = [
    "#FF006E", "#FB5607", "#FFBE0B", "#00D084", "#00B4D8", "#9D4EDD",
];
export const HIGHLIGHTER_COLORS_RETRO: [string, string, string, string] = [
    "#FFBE0B", "#00D084", "#FF006E", "#00B4D8",
];

/** True neon — maximum saturation, near-luminous hues */
export const DRAW_COLORS_NEON: [string, string, string, string, string, string] = [
    "#FF0099", "#FF6600", "#FFFF00", "#00FF41", "#00FFFF", "#BF00FF",
];
export const HIGHLIGHTER_COLORS_NEON: [string, string, string, string] = [
    "#FFFF00", "#00FF41", "#FF0099", "#00FFFF",
];

/** Pastel — soft, chalky tints */
export const DRAW_COLORS_PASTEL: [string, string, string, string, string, string] = [
    "#FF8FAB", "#FFB347", "#FFF176", "#A8E6CF", "#A0C4FF", "#D5A6F0",
];
export const HIGHLIGHTER_COLORS_PASTEL: [string, string, string, string] = [
    "#FFF176", "#A8E6CF", "#FF8FAB", "#A0C4FF",
];

/** Gradient palette (rainbow-like ink progression) */
export const DRAW_COLORS_GRADIENT: [string, string, string, string, string, string] = [
    "#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#0A84FF", "#AF52DE",
];
export const HIGHLIGHTER_COLORS_GRADIENT: [string, string, string, string] = [
    "#FFD60A", "#34C759", "#FF375F", "#0A84FF",
];

/** Glitter — 90s iridescent holographic shimmer */
export const DRAW_COLORS_GLITTER: [string, string, string, string, string, string] = [
    "#FF69B4", "#C0C0FF", "#FFD700", "#7FFFD4", "#E6CAFF", "#F4A0C0",
];
export const HIGHLIGHTER_COLORS_GLITTER: [string, string, string, string] = [
    "#FFD700", "#7FFFD4", "#FF69B4", "#C0C0FF",
];

/** Magical — enchanted wand sparkles & stardust (matches Vibrant palette) */
export const DRAW_COLORS_MAGICAL: [string, string, string, string, string, string] = [
    "#FF2D2D", "#FF6B00", "#FFD600", "#00E065", "#0075FF", "#A033FF",
];
export const HIGHLIGHTER_COLORS_MAGICAL: [string, string, string, string] = [
    "#FFD600", "#00E065", "#FF2D2D", "#0075FF",
];

/** Tertiary colors for center circle — 3 per palette, distinct from draw & highlighter */
export const TERTIARY_COLORS_MUTED: [string, string, string] = [
    "#5BA8A0", "#C76B8A", "#7B6BBF",
];
export const TERTIARY_COLORS_VIBRANT: [string, string, string] = [
    "#00CED1", "#FF1493", "#7B2FFF",
];
export const TERTIARY_COLORS_RETRO: [string, string, string] = [
    "#FF85A1", "#06D6A0", "#7209B7",
];
export const TERTIARY_COLORS_NEON: [string, string, string] = [
    "#FF3366", "#00FF88", "#9D00FF",
];
export const TERTIARY_COLORS_PASTEL: [string, string, string] = [
    "#B5EAD7", "#FFDAC1", "#C7CEEA",
];
export const TERTIARY_COLORS_GRADIENT: [string, string, string] = [
    "#FF6B6B", "#4ECDC4", "#9B59B6",
];
export const TERTIARY_COLORS_GLITTER: [string, string, string] = [
    "#E8A0BF", "#A0D2DB", "#D4AF37",
];
export const TERTIARY_COLORS_MAGICAL: [string, string, string] = [
    "#A033FF", "#FFD600", "#00E065",
];

/** All tertiary palettes in index order — matches ColorPalette union order */
export const ALL_TERTIARY_PALETTES = [
    TERTIARY_COLORS_MUTED,
    TERTIARY_COLORS_VIBRANT,
    TERTIARY_COLORS_RETRO,
    TERTIARY_COLORS_NEON,
    TERTIARY_COLORS_PASTEL,
    TERTIARY_COLORS_GRADIENT,
    TERTIARY_COLORS_GLITTER,
    TERTIARY_COLORS_MAGICAL,
] as const;

/** Six themed gradients keyed to the 6 draw color slots */
export const DRAW_GRADIENT_VARIANTS = [
    ["#FF00C8", "#FF7A00", "#FFE600", "#00F5FF"], // neon party
    ["#FF3131", "#FF6A00", "#FFB800", "#FF2AD4"], // tropical heat
    ["#D9FF00", "#00FF85", "#00D4FF", "#0066FF"], // acid rave
    ["#00FFF0", "#00B3FF", "#7A5CFF", "#FF2AF5"], // cyber ocean
    ["#8A2BFF", "#00A3FF", "#00FFCC", "#7DFF00"], // aurora shock (reversed flow)
    ["#FF4D6D", "#FF1493", "#8A2BE2", "#00E5FF"], // vapor pop
    ["#FF69B4", "#C0C0FF", "#FFD700", "#7FFFD4"], // glitter shimmer
    ["#7B2FBE", "#FFB830", "#00C9A7", "#FF6B9D"], // magical stardust
] as const;

export function getGradientVariantStops(index: number): readonly string[] {
    return DRAW_GRADIENT_VARIANTS[((index % DRAW_GRADIENT_VARIANTS.length) + DRAW_GRADIENT_VARIANTS.length) % DRAW_GRADIENT_VARIANTS.length];
}

/** Highlighter gradient: 30° hue shift */
export function getHighlighterGradientStops(color: string): readonly string[] {
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

/** All draw palettes in index order — matches ColorPalette union order */
export const ALL_DRAW_PALETTES = [
    DRAW_COLORS_MUTED,
    DRAW_COLORS_VIBRANT,
    DRAW_COLORS_RETRO,
    DRAW_COLORS_NEON,
    DRAW_COLORS_PASTEL,
    DRAW_COLORS_GRADIENT,
    DRAW_COLORS_GLITTER,
    DRAW_COLORS_MAGICAL,
] as const;

/** All highlighter palettes in index order — matches ColorPalette union order */
export const ALL_HL_PALETTES = [
    HIGHLIGHTER_COLORS_MUTED,
    HIGHLIGHTER_COLORS_VIBRANT,
    HIGHLIGHTER_COLORS_RETRO,
    HIGHLIGHTER_COLORS_NEON,
    HIGHLIGHTER_COLORS_PASTEL,
    HIGHLIGHTER_COLORS_GRADIENT,
    HIGHLIGHTER_COLORS_GLITTER,
    HIGHLIGHTER_COLORS_MAGICAL,
] as const;

type ColorPalette = "muted" | "vibrant" | "retro" | "neon" | "pastel" | "gradient" | "glitter" | "magical";

const PALETTE_INDEX: Record<ColorPalette, number> = {
    muted: 0, vibrant: 1, retro: 2, neon: 3, pastel: 4, gradient: 5, glitter: 6, magical: 7,
};

/** Helper to get color palettes based on ColorPalette selection */
export const getColors = (palette: ColorPalette) => {
    const i = PALETTE_INDEX[palette];
    return { draw: ALL_DRAW_PALETTES[i], highlighter: ALL_HL_PALETTES[i], tertiary: ALL_TERTIARY_PALETTES[i] };
};

/** Palette names in display order — matches ColorPalette union order */
export const PALETTE_NAMES: ColorPalette[] = [
    "muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "magical",
];

/** Seed palette list for the Pro settings UI */
export const PALETTE_SEEDS = PALETTE_NAMES.map((name) => ({
    name: (name.charAt(0).toUpperCase() + name.slice(1)) as string,
    draw: [...getColors(name).draw] as string[],
    hl: [...getColors(name).highlighter] as string[],
}));
