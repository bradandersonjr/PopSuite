import type { BadgeFont } from "@/store/useStore";

/** Pro badge fonts — system font stacks (nothing bundled). */
export const BADGE_FONTS: { key: BadgeFont; label: string }[] = [
  { key: "mono", label: "Mono" },
  { key: "sans", label: "Sans" },
  { key: "serif", label: "Serif" },
  { key: "rounded", label: "Rounded" },
  { key: "condensed", label: "Condensed" },
  { key: "display", label: "Display" },
];

export const FONT_STACK: Record<BadgeFont, string> = {
  mono: "'Space Mono', ui-monospace, monospace",
  sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "'Segoe UI Rounded', 'Comic Sans MS', system-ui, sans-serif",
  condensed: "'Arial Narrow', 'Roboto Condensed', 'Segoe UI', sans-serif",
  display: "Impact, 'Arial Black', sans-serif",
};

/** Effective font stack — non-Pro users always get mono. */
export function fontStackFor(font: BadgeFont, isPro: boolean): string {
  return FONT_STACK[isPro ? font : "mono"];
}
