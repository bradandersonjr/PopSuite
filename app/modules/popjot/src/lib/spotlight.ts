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

/**
 * Build the CSS radial-gradient that dims everything except the cursor circle.
 * A single gradient on one GPU-composited layer — no per-pixel canvas work.
 *
 *   - `dimOpacity` 0-100 maps to the black overlay alpha outside the circle.
 *   - `radius` is the transparent hole's radius in px.
 *   - `feather` softens the edge: the dim ramps up across the outer ~35% of the
 *     radius when true, or snaps hard at the radius when false.
 */
export function spotlightGradient(
  x: number,
  y: number,
  radius: number,
  dimOpacity: number,
  feather: boolean,
): string {
  const alpha = Math.max(0, Math.min(1, dimOpacity / 100));
  const r = Math.max(0, radius);
  // Inner stop: fully transparent up to where the edge begins. With feather the
  // ramp starts at 65% of the radius; without it the transparent hole extends to
  // the full radius and the dim begins immediately after.
  const innerStop = feather ? r * 0.65 : r;
  return (
    `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
    `rgba(0,0,0,0) ${innerStop}px, ` +
    `rgba(0,0,0,${alpha}) ${r}px)`
  );
}
