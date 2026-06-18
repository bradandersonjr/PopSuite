import type { BrandingCorner } from "@keys/store/useStore";

/**
 * The corner currently occupied by the keystroke badges (null when badges are
 * centered). Branding must avoid this corner so the two never overlap.
 */
export function blockedBrandingCorner(displayPosition: string): BrandingCorner | null {
  return displayPosition.includes("center") ? null : (displayPosition as BrandingCorner);
}
