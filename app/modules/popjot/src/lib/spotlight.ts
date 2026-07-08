/**
 * Spotlight-mode pure helpers.
 *
 * Spotlight dims the whole screen except a soft circle that follows the cursor
 * (the classic presenter effect). It is a presentation aid like snapshot mode —
 * there is no drawing while it is active. Keeping the geometry/gate logic here
 * (free of React and Electron) lets the renderer stay a thin, ref-driven layer
 * and lets these rules be unit-tested directly.
 */

/**
 * Whether the spotlight shortcut may enter spotlight right now.
 *
 * Spotlight and annotation are mutually exclusive. The simplest safe rule that
 * cannot corrupt the fragile RadialMenu activation state machine: ignore the
 * spotlight shortcut whenever annotation is active (appEnabled). Entering
 * annotation force-exits spotlight separately (see EngineShell), so the two
 * never overlap.
 */
export function canEnterSpotlight(annotating: boolean): boolean {
  return !annotating;
}

/**
 * Toggle spotlight given the current state and whether annotation is active.
 * Turning spotlight ON is gated by canEnterSpotlight; turning it OFF is always
 * allowed (so Escape / the shortcut can always dismiss it).
 */
export function nextSpotlightActive(current: boolean, annotating: boolean): boolean {
  if (current) return false;
  return canEnterSpotlight(annotating) ? true : false;
}

// Feather-percent -> ramp-width-in-px curve. 0% is a hard edge (no ramp, the
// transparent hole extends to the full radius and the dim snaps in at the
// boundary). 100% is the softest ramp we allow, FEATHER_SCREEN_FRACTION of the
// screen's height wide. The ramp width is a fraction of SCREEN size, not of
// the circle's radius or a fixed px constant — so the edge looks the same
// softness at every zoom/monitor size, AND resizing the spotlight circle
// (scroll wheel) never changes how soft the edge looks, only how big the
// circle is. Still clamped to at most half the current radius so the ramp
// can never invert past the circle's center on a very small circle.
const FEATHER_SCREEN_FRACTION = 0.12; // 100% softness = 12% of screen height
export const DEFAULT_SPOTLIGHT_FEATHER_PCT = 50;

function featherRampPx(featherPct: number, radius: number, screenHeight: number): number {
  const pct = Math.max(0, Math.min(100, featherPct)) / 100;
  const maxRampPx = Math.max(0, screenHeight) * FEATHER_SCREEN_FRACTION;
  return Math.min(pct * maxRampPx, radius / 2);
}

/**
 * Build the CSS radial-gradient that dims everything except the cursor circle.
 * A single gradient on one GPU-composited layer — no per-pixel canvas work.
 *
 *   - `dimOpacity` 0-100 maps to the black overlay alpha outside the circle.
 *   - `radius` is the transparent hole's radius in px.
 *   - `featherPct` 0-100 softens the edge by a ramp sized as a fraction of
 *     `screenHeight` (see featherRampPx above), so the softness reads the
 *     same regardless of the circle's radius or the display's resolution.
 *   - `screenHeight` is the current display's height in px (DIP), used only
 *     to size the feather ramp — pass the display the spotlight is on.
 */
export function spotlightGradient(
  x: number,
  y: number,
  radius: number,
  dimOpacity: number,
  featherPct: number,
  screenHeight: number,
): string {
  const alpha = Math.max(0, Math.min(1, dimOpacity / 100));
  const r = Math.max(0, radius);
  // Round to avoid float noise in the CSS string — sub-pixel precision has no
  // visual effect here anyway.
  const innerStop = Math.round((r - featherRampPx(featherPct, r, screenHeight)) * 100) / 100;
  return (
    `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
    `rgba(0,0,0,0) ${innerStop}px, ` +
    `rgba(0,0,0,${alpha}) ${r}px)`
  );
}
