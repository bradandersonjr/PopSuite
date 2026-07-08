/**
 * Right-mouse-drag resize/soften for Spotlight mode.
 *
 * While spotlight is active, holding the right mouse button and dragging
 * adjusts the circle live: horizontal delta resizes the radius, vertical
 * delta adjusts the edge softness. This needs a global mouse hook (uiohook-
 * napi) because the spotlight overlay is click-through and unfocused, so it
 * never sees a normal DOM mousedown/mousemove/mouseup for the right button.
 *
 * Note: importing this module pulls in uiohook-napi (a native module), same
 * as PopKey's inputCapture.ts. Unlike PopKey (which needs the hook running for
 * its whole lifetime), the hook here is only started while spotlight mode is
 * active and stopped the moment it exits — mirroring the existing cursor-poll
 * lifecycle in register.ts, to keep the "only cost while active" property.
 */

import { uIOhook } from "uiohook-napi";

const RIGHT_BUTTON = 2; // uiohook-napi: 1=left, 2=right, 3=middle

// Sensitivity: pixels of mouse movement required per unit of change.
// Radius: 400px of slider range (80-400) mapped across a comfortable ~2px of
// screen-space drag per px of radius, so a full-range resize takes a ~640px
// drag — enough travel for fine control without needing to cross the whole
// screen.
const RADIUS_PX_PER_DELTA = 0.5; // radiusDelta = dx * this
// Feather: 100 percentage points mapped across a ~400px vertical drag (0.25
// points per px), matching the radius drag's "medium-length gesture" feel.
const FEATHER_PCT_PER_DELTA = 0.25; // featherDelta = -dy * this (see below)

export interface SpotlightDragBounds {
  radiusMin: number;
  radiusMax: number;
  featherMin: number;
  featherMax: number;
}

export interface SpotlightDragCallbacks {
  /** Called once per live update while dragging, with the new clamped values. */
  onChange(radius: number, featherPct: number): void;
}

let dragActive = false;
let startX = 0;
let startY = 0;
let startRadius = 0;
let startFeather = 0;
let getRadius: (() => number) | null = null;
let getFeather: (() => number) | null = null;
let bounds: SpotlightDragBounds | null = null;
let callbacks: SpotlightDragCallbacks | null = null;
let hookStarted = false;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function handleMouseDown(e: { button: unknown; x: number; y: number }): void {
  if (Number(e.button) !== RIGHT_BUTTON) return;
  if (!getRadius || !getFeather || !bounds) return;
  dragActive = true;
  startX = e.x;
  startY = e.y;
  startRadius = getRadius();
  startFeather = getFeather();
}

function handleMouseMove(e: { x: number; y: number }): void {
  if (!dragActive || !bounds || !callbacks) return;
  const dx = e.x - startX;
  const dy = e.y - startY;
  const radius = clamp(startRadius + dx * RADIUS_PX_PER_DELTA, bounds.radiusMin, bounds.radiusMax);
  // Drag up = softer (feather% increases): screen y grows downward, so "up"
  // is negative dy — negate so moving up increases the percentage.
  const featherPct = clamp(
    startFeather - dy * FEATHER_PCT_PER_DELTA,
    bounds.featherMin,
    bounds.featherMax
  );
  callbacks.onChange(radius, featherPct);
}

function handleMouseUp(e: { button: unknown }): void {
  if (Number(e.button) !== RIGHT_BUTTON) return;
  dragActive = false;
}

/**
 * Start listening for right-drag resize. Safe to call multiple times (no-op
 * if already running). `radiusGetter`/`featherGetter` are read fresh on each
 * right-button-down so the drag always starts from the current live value.
 */
export function startSpotlightDrag(
  radiusGetter: () => number,
  featherGetter: () => number,
  dragBounds: SpotlightDragBounds,
  cb: SpotlightDragCallbacks
): void {
  getRadius = radiusGetter;
  getFeather = featherGetter;
  bounds = dragBounds;
  callbacks = cb;
  if (hookStarted) return;
  uIOhook.on("mousedown", handleMouseDown);
  uIOhook.on("mousemove", handleMouseMove);
  uIOhook.on("mouseup", handleMouseUp);
  try {
    uIOhook.start();
    hookStarted = true;
  } catch (err) {
    // A native hook failure (missing macOS permission, Wayland session on
    // Linux, etc.) must not crash the main process — spotlight still works,
    // it just won't support the right-drag resize gesture.
    console.error(`Failed to start spotlight drag input capture (uIOhook): ${String(err)}`);
  }
}

/** Stop listening and drop all per-session state. Safe to call when not running. */
export function stopSpotlightDrag(): void {
  dragActive = false;
  getRadius = null;
  getFeather = null;
  bounds = null;
  callbacks = null;
  if (!hookStarted) return;
  uIOhook.removeListener("mousedown", handleMouseDown);
  uIOhook.removeListener("mousemove", handleMouseMove);
  uIOhook.removeListener("mouseup", handleMouseUp);
  uIOhook.stop();
  hookStarted = false;
}
