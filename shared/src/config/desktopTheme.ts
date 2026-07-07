/**
 * Desktop/Extension UI theme colors — single source of truth.
 *
 * Used by SystemTray, DesktopRoot, and ExtensionPopup so that all three
 * agree on the same color values without duplicating hardcoded hex strings.
 */

export type SurfacePalette = {
  panel: string;
  card: string;
  selected: string;
  text: string;
  muted: string;
  divider: string;
};

export type MenuColors = {
  bg: string;
  text: string;
  border: string;
  hoverBg: string;
  hoverText: string;
  separator: string;
};

const DARK: SurfacePalette = {
  panel: "#0F0F0F",
  card: "#1C1C1C",
  selected: "#2A2A2A",
  text: "#ECECEC",
  muted: "#A3A3A3",
  divider: "#2A2A2A",
};

const LIGHT: SurfacePalette = {
  panel: "#FCFCFC",
  card: "#F7F7F7",
  selected: "#EBEBEB",
  text: "#1A1A1A",
  muted: "#686868",
  divider: "#E5E5E5",
};

const MENU_DARK: MenuColors = {
  bg: "#171C23",
  text: "#D8DFE8",
  border: "#2D3745",
  hoverBg: "#212A36",
  hoverText: "#ffffff",
  separator: "#2D3745",
};

const MENU_LIGHT: MenuColors = {
  bg: "#F7F8FA",
  text: "#4B5563",
  border: "#DCE2EA",
  hoverBg: "#E9EDF3",
  hoverText: "#2D3748",
  separator: "#DCE2EA",
};

export const getSurfacePalette = (isDark: boolean): SurfacePalette =>
  isDark ? DARK : LIGHT;

export const getMenuColors = (isDark: boolean): MenuColors =>
  isDark ? MENU_DARK : MENU_LIGHT;

/** Pro feature accent — single source of truth for all Pro UI elements */
export const PRO_ACCENT = "#9D4EDD" as const;

/** Error/destructive feedback colors — matches Tailwind --destructive token range */
export const ERROR_COLORS = {
  border: "#B91C1C",
  bgDark: "#2A1111",
  bgLight: "#FEE2E2",
  textDark: "#FCA5A5",
  textLight: "#991B1B",
} as const;

/** Canvas background colors for dark/light board modes */
export const CANVAS_BG = {
  dark: "#1E1B16",
  light: "#F5F1E8",
  darkRgba: "rgba(30, 27, 22, 0.4)",
  lightRgba: "rgba(245, 241, 232, 0.4)",
} as const;
