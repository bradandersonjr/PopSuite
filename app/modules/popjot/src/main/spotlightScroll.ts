/**
 * Scroll-wheel resize for Spotlight mode.
 *
 * While spotlight is active, scrolling the mouse wheel resizes the circle
 * live. This needs a global mouse hook (uiohook-napi) because the spotlight
 * overlay is click-through and unfocused, so it never sees a normal DOM wheel
 * event. Deliberately scroll-only (not click-drag): any mouse-button gesture
 * risks swallowing or misinterpreting a click meant for the app under the
 * cursor, which the overlay's click-through design explicitly protects.
 * Scrolling has no such ambiguity — it never activates anything underneath.
 *
 * Note: importing this module pulls in uiohook-napi (a native module), same
 * as PopKey's inputCapture.ts. Unlike PopKey (which needs the hook running for
 * its whole lifetime), the hook here is only started while spotlight mode is
 * active and stopped the moment it exits — mirroring the existing cursor-poll
 * lifecycle in register.ts, to keep the "only cost while active" property.
 */

import {
  acquireGlobalInputHook,
  releaseGlobalInputHook,
  uIOhook,
} from "@shared/main/globalInputHook";

// Sensitivity: radius change (px) per wheel "tick". uiohook reports rotation
// magnitude per tick (typically 1-3 for a standard mouse wheel notch); scale
// so one notch is a comfortable, noticeable step without needing many spins
// to cross the slider's full 80-400 range.
const RADIUS_PX_PER_TICK = 12;

export interface SpotlightScrollBounds {
  radiusMin: number;
  radiusMax: number;
}

export interface SpotlightScrollCallbacks {
  /** Called once per wheel tick while spotlight is active, with the new clamped radius. */
  onChange(radius: number): void;
}

let getRadius: (() => number) | null = null;
let bounds: SpotlightScrollBounds | null = null;
let callbacks: SpotlightScrollCallbacks | null = null;
let hookStarted = false;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function handleWheel(e: { rotation: number }): void {
  if (!getRadius || !bounds || !callbacks) return;
  // uiohook: positive rotation is scroll-down/toward-you, negative is
  // scroll-up/away — treat "away" (up) as zoom-in/larger, matching most
  // presentation and image-viewer scroll-to-zoom conventions.
  const delta = -e.rotation * RADIUS_PX_PER_TICK;
  const radius = clamp(getRadius() + delta, bounds.radiusMin, bounds.radiusMax);
  callbacks.onChange(radius);
}

/**
 * Start listening for scroll-wheel resize. Safe to call multiple times
 * (no-op if already running). `radiusGetter` is read fresh on every wheel
 * tick so each step starts from the current live value.
 */
export function startSpotlightScroll(
  radiusGetter: () => number,
  scrollBounds: SpotlightScrollBounds,
  cb: SpotlightScrollCallbacks
): void {
  getRadius = radiusGetter;
  bounds = scrollBounds;
  callbacks = cb;
  if (hookStarted) return;
  uIOhook.on("wheel", handleWheel);
  if (acquireGlobalInputHook()) {
    hookStarted = true;
  } else {
    uIOhook.removeListener("wheel", handleWheel);
    // A native hook failure (missing macOS permission, Wayland session on
    // Linux, etc.) must not crash the main process — spotlight still works,
    // it just won't support the scroll-to-resize gesture.
    //
    // TODO(mac): unlike PopKey's inputCapture (see register.ts's
    // isTrustedAccessibilityClient prompt), this path does not proactively
    // request Accessibility permission — it just silently degrades. On a fresh
    // macOS install the scroll-to-resize gesture will quietly do nothing with
    // no explanation to the user. Consider prompting for Accessibility the
    // first time spotlight mode is entered on mac, mirroring PopKey's flow.
    console.error("Failed to start spotlight scroll input capture (uIOhook).");
  }
}

/** Stop listening and drop all per-session state. Safe to call when not running. */
export function stopSpotlightScroll(): void {
  getRadius = null;
  bounds = null;
  callbacks = null;
  if (!hookStarted) return;
  uIOhook.removeListener("wheel", handleWheel);
  releaseGlobalInputHook();
  hookStarted = false;
}
