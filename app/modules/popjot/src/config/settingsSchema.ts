import { setting } from "@shared/settings/schema";
import { DEFAULT_SPOTLIGHT_FEATHER_PCT } from "../lib/spotlight";

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
  // Spotlight mode: dim the whole screen except a soft circle that follows the
  // cursor (presenter effect). These tune the visual only — the mode itself is
  // toggled by the "spotlight" global shortcut, not a stored on/off flag.
  spotlightDimOpacity: setting.number(65), // 0 = no dim, 100 = fully black
  spotlightRadius: setting.number(180, { positive: true }), // circle radius in px
  // Edge softness: 0 = hard edge (ramp snaps at the radius), 100 = softest
  // allowed (ramp starts at 20% of the radius). Default 50 reproduces roughly
  // the old boolean feather's "true" look — see spotlight.ts for the curve.
  spotlightFeather: setting.number(DEFAULT_SPOTLIGHT_FEATHER_PCT),
  scaleMultiplier: setting.number(1, { positive: true }),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
} as const;

export type SettingsSchema = typeof settingsSchema;
