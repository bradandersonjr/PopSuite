import { setting } from "@shared/settings/schema";

/**
 * PopKey's tray-adjustable settings — the single source of truth for
 * defaults, allowed values, IPC channel names, preload bridge setters,
 * and the store slice. Add a setting here and every layer picks it up.
 */
export const settingsSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "magical"],
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
  badgeStyle: setting.enum(["flat", "flat-outline", "pop", "pop-mono"], "flat"),
  badgeTranslucency: setting.number(0),
  badgeBlur: setting.number(0),
  fontSize: setting.number(16, { positive: true }),
  badgeRoundness: setting.number(100),
  keyboardEnabled: setting.boolean(true),
  wordMode: setting.boolean(false),
  mouseEnabled: setting.boolean(true),
  showMouseClicks: setting.boolean(true),
  showScrollWheel: setting.boolean(true),
  popMonoColor: setting.string("#fcbf47"),
  scrollColor: setting.string("palette"), // "palette" = use palette, else hex
  clickColor: setting.string("palette"), // "palette" = use palette, else hex
} as const;

export type SettingsSchema = typeof settingsSchema;
