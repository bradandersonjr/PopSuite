import { setting } from "@shared/settings/schema";

/**
 * PopJot's tray-adjustable settings — the single source of truth for
 * defaults, allowed values, IPC channel names, preload bridge setters,
 * and the store slice. Add a setting here and every layer picks it up.
 */
export const settingsSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid"],
    "retro"
  ),
  // Solid palette: single-color menu. Uses a custom color instead of palette colors.
  solidColor: setting.string("#fcbf47"),
  // Remembers the last non-Solid palette so stroke colors stay multi-color while
  // the Solid palette is active (Solid only restyles the menu chrome).
  lastColorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid"],
    "retro"
  ),
  animationIntensity: setting.enum(["low", "medium", "high"], "medium"),
  menuStyle: setting.enum(["flat", "flat-outline", "pop", "glow"], "pop"),
  // Glow style: halo intensity (0 = subtle, 100 = intense).
  glowIntensity: setting.number(50),
  // Menu text/icon color: "auto" follows the style, else force white/black.
  textColor: setting.enum(["auto", "white", "black"], "auto"),
  // Button corner roundness: 0 = square, 100 = circle.
  buttonRoundness: setting.number(100),
  // Menu button background opacity: 0 = opaque, higher = more see-through.
  menuTranslucency: setting.number(0),
  // Branding: replaces the radial-menu center shape with a custom logo (Pro).
  // Active whenever a center logo is set; brandingEnabled is synced with
  // PopKey's branding toggle (the image/scale stay per-app). Stored in settings
  // — not the @/pro stub — so the logo actually renders in every build.
  brandingEnabled: setting.boolean(false),
  brandingImage: setting.string(""), // data URL of the center logo
  brandingScale: setting.number(1, { positive: true }), // size multiplier (1 = 100%)
  gridMode: setting.enum(["none", "grid", "dots"], "none"),
  gridSize: setting.enum(["small", "large"], "small"),
  overlayMode: setting.enum(["live", "snapshot"], "live"),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
} as const;

export type SettingsSchema = typeof settingsSchema;
