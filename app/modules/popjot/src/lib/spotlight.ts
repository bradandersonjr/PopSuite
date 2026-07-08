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

// Feather-percent -> inner-stop-fraction curve. 0% is a hard edge (the
// transparent hole extends to the full radius, ramp snaps at the boundary).
// 100% is maximally soft; the ramp cannot start any closer than 20% of the
// radius (SOFTEST_INNER_FRACTION) or the circle would visually vanish before
// reaching the edge. Linear interpolation between those two endpoints:
//   fraction(pct) = 1.0 - (pct / 100) * (1.0 - 0.2) = 1.0 - pct * 0.008
// This replaces the old boolean feather (true = ramp at 65% of radius, false
// = ramp at 100%). Solving 0.65 = 1.0 - pct * 0.008 for pct gives pct = 43.75,
// but the old default was `true` paired with the *slider* defaults (65/180),
// not a deliberately tuned 65% ramp value — 65% was just a hardcoded "soft
// enough" constant. So rather than default to the not-especially-meaningful
// 43.75%, we pick the curve's own midpoint, 50%, as the new default: it maps
// to fraction 0.6 (ramp at 60% of radius), close enough to the old 65% that
// existing users see essentially the same edge, while landing on a round,
// self-explanatory default for the new slider.
const SOFTEST_INNER_FRACTION = 0.2;
const HARDEST_INNER_FRACTION = 1.0;
export const DEFAULT_SPOTLIGHT_FEATHER_PCT = 50;

function featherInnerFraction(featherPct: number): number {
  const pct = Math.max(0, Math.min(100, featherPct)) / 100;
  return HARDEST_INNER_FRACTION - pct * (HARDEST_INNER_FRACTION - SOFTEST_INNER_FRACTION);
}

/**
 * Build the CSS radial-gradient that dims everything except the cursor circle.
 * A single gradient on one GPU-composited layer — no per-pixel canvas work.
 *
 *   - `dimOpacity` 0-100 maps to the black overlay alpha outside the circle.
 *   - `radius` is the transparent hole's radius in px.
 *   - `featherPct` 0-100 softens the edge: 0 snaps the ramp hard at the full
 *     radius; 100 starts the ramp as early as 20% of the radius (the softest
 *     we allow — any softer and the circle would fade before it appears).
 *     See featherInnerFraction() above for the interpolation.
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
  // Round to avoid float noise in the CSS string (e.g. 200 * 0.2 producing
  // 39.99999999999999 instead of 40) — sub-pixel precision has no visual
  // effect here anyway.
  const innerStop = Math.round(r * featherInnerFraction(featherPct) * 100) / 100;
  return (
    `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
    `rgba(0,0,0,0) ${innerStop}px, ` +
    `rgba(0,0,0,${alpha}) ${r}px)`
  );
}
