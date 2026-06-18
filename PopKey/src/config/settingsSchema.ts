import { setting } from "@shared/settings/schema";

/**
 * PopKey's tray-adjustable settings — the single source of truth for
 * defaults, allowed values, IPC channel names, preload bridge setters,
 * and the store slice. Add a setting here and every layer picks it up.
 */
export const settingsSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid"],
    "retro"
  ),
  animationIntensity: setting.enum(["low", "medium", "high"], "medium"),
  displayPosition: setting.enum(
    ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"],
    "bottom-left"
  ),
  positionOffsetX: setting.number(0),
  positionOffsetY: setting.number(0),
  scaleMultiplier: setting.number(1, { positive: true }),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
  badgeDuration: setting.number(2000, { positive: true }),
  maxBadges: setting.number(5, { positive: true }),
  badgeStyle: setting.enum(["flat", "flat-outline", "pop", "glow"], "flat"),
  // Badge text color: "auto" follows the theme, else force white/black.
  badgeTextColor: setting.enum(["auto", "white", "black"], "auto"),
  // Badge font (Pro) — free users always get "mono".
  badgeFont: setting.enum(["mono", "sans", "serif", "rounded", "condensed", "display"], "mono"),
  // Badge enter/exit animation style (Pro) — free users get "pop".
  badgeAnimation: setting.enum(["pop", "slide", "bounce", "fade", "rise"], "pop"),
  badgeTranslucency: setting.number(0),
  // Glow style: halo intensity (0 = subtle, 100 = intense).
  glowIntensity: setting.number(50),
  fontSize: setting.number(16, { positive: true }),
  badgeRoundness: setting.number(100),
  keyboardEnabled: setting.boolean(true),
  // Show a ×N counter on a held key as the OS auto-repeats it.
  showKeyRepeat: setting.boolean(false),
  wordMode: setting.boolean(false),
  mouseEnabled: setting.boolean(true),
  showMouseClicks: setting.boolean(true),
  showScrollWheel: setting.boolean(true),
  // OBS mode: drop the overlay's always-on-top pin so it sits in normal
  // z-order. Lets OBS capture PopKey as its own window source (and composite
  // later) instead of hard-baking it on top of everything else on screen.
  obsMode: setting.boolean(false),
  scrollColor: setting.string("palette"), // "palette" = use palette, else hex
  clickColor: setting.string("palette"), // "palette" = use palette, else hex
  // Solid palette: single-color badges. Uses a custom color instead of palette colors.
  solidColor: setting.string("#fcbf47"),
  // Click ripple appearance.
  clickEffect: setting.enum(["ring", "solid", "pulse", "burst"], "ring"),
  clickSize: setting.number(48, { positive: true }), // base diameter in px
  // Branding (Pro): a small corner logo/image overlay for screencasts.
  brandingEnabled: setting.boolean(false),
  brandingImage: setting.string(""), // data URL of the chosen image
  brandingCorner: setting.enum(["top-left", "top-right", "bottom-left", "bottom-right"], "top-right"),
  brandingSize: setting.number(80, { positive: true }), // max width/height in px
  brandingOpacity: setting.number(100),
  brandingRadius: setting.number(0), // corner rounding 0–50%
} as const;

export type SettingsSchema = typeof settingsSchema;
