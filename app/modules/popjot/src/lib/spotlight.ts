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
// boundary). 100% is the softest ramp we allow, MAX_FEATHER_PX wide. The ramp
// width is now a FIXED pixel span rather than a fraction of the radius, so
// shrinking the circle no longer shrinks (or erases) the visible feather —
// previously the ramp was `radius * fraction`, so a small enough radius made
// the whole ramp collapse to a few px or less and the edge looked hard even
// at high softness. Clamped to at most half the radius so the ramp can never
// invert past the circle's center on very small circles.
const MAX_FEATHER_PX = 140;
export const DEFAULT_SPOTLIGHT_FEATHER_PCT = 50;

function featherRampPx(featherPct: number, radius: number): number {
  const pct = Math.max(0, Math.min(100, featherPct)) / 100;
  return Math.min(pct * MAX_FEATHER_PX, radius / 2);
}

/**
 * Build the CSS radial-gradient that dims everything except the cursor circle.
 * A single gradient on one GPU-composited layer — no per-pixel canvas work.
 *
 *   - `dimOpacity` 0-100 maps to the black overlay alpha outside the circle.
 *   - `radius` is the transparent hole's radius in px.
 *   - `featherPct` 0-100 softens the edge by a fixed-width ramp (see
 *     featherRampPx above) that stays visually consistent regardless of the
 *     circle's size, instead of scaling with the radius.
 */
export function spotlightGradient(
  x: number,
  y: number,
  radius: number,
  dimOpacity: number,
  featherPct: number,
): string {
  const alpha = Math.max(0, Math.min(1, dimOpacity / 100));
  const r = Math.max(0, radius);
  // Round to avoid float noise in the CSS string — sub-pixel precision has no
  // visual effect here anyway.
  const innerStop = Math.round((r - featherRampPx(featherPct, r)) * 100) / 100;
  return (
    `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
    `rgba(0,0,0,0) ${innerStop}px, ` +
    `rgba(0,0,0,${alpha}) ${r}px)`
  );
}
