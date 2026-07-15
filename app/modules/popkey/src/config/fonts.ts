import type { BadgeFont } from "@popkey/store/useStore";

/** Preset badge fonts available to all users — no Pro required. */
export const BADGE_FONTS: { key: BadgeFont; label: string }[] = [
  { key: "mono", label: "Mono" },
  { key: "sans", label: "Sans" },
  { key: "serif", label: "Serif" },
];

export const FONT_STACK: Record<Exclude<BadgeFont, "custom">, string> = {
  mono: "'Space Mono', ui-monospace, monospace",
  sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};

/**
 * Effective font stack for badge rendering.
 * - Free users get mono/sans/serif.
 * - "custom" uses the named system font (Pro only); falls back to sans.
 */
export function fontStackFor(font: BadgeFont, isPro: boolean, customFont = ""): string {
  if (font === "custom") {
    return isPro && customFont.trim()
      ? `"${customFont.trim()}", system-ui, sans-serif`
      : FONT_STACK.sans;
  }
  return FONT_STACK[font] ?? FONT_STACK.mono;
}
