import { setting } from "@shared/settings/schema";

/**
 * PopJot's tray-adjustable settings — the single source of truth for
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
  menuStyle: setting.enum(["flat", "flat-outline", "pop", "pop-mono"], "pop"),
  gridMode: setting.enum(["none", "grid", "dots"], "none"),
  gridSize: setting.enum(["small", "large"], "small"),
  overlayMode: setting.enum(["live", "snapshot"], "live"),
  popMonoColor: setting.string("#fcbf47"),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
} as const;

export type SettingsSchema = typeof settingsSchema;
