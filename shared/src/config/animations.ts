/**
 * Single source of truth for the animation-intensity union. Both apps derive
 * their own `AnimationIntensity` type from their settings schema (which uses
 * this same "low" | "medium" | "high" enum) and re-export it from here so
 * this file — reachable from both apps' web/engine graphs — never needs to
 * import from either app's src.
 */
export type AnimationIntensity = "low" | "medium" | "high";

/** Animation configurations for different intensity levels */
export const ANIMATION_CONFIGS = {
  low: {
    // Subtle, barely noticeable
    hoverScale: 1.08,
    selectionScale: [1, 0.95, 1] as [number, number, number],
    selectionDuration: 200,
    springStiffness: 2000,
    springDamping: 60,
    hoverOffset: -1,
    pressOffset: 1,
    reboundOffset: -2,
    // Badge enter/exit (PopKey) — durations in seconds
    enterScale: 0.96,
    slideDistance: 8,
    enterDuration: 0.18,
    exitDuration: 0.14,
  },
  medium: {
    // Current balanced feel
    hoverScale: 1.25,
    selectionScale: [1, 0.6, 1] as [number, number, number],
    selectionDuration: 300,
    springStiffness: 1500,
    springDamping: 40,
    hoverOffset: -2,
    pressOffset: 2,
    reboundOffset: -4,
    // Badge enter/exit (PopKey) — durations in seconds
    enterScale: 0.9,
    slideDistance: 12,
    enterDuration: 0.24,
    exitDuration: 0.18,
  },
  high: {
    // More excessive, playful
    hoverScale: 1.4,
    selectionScale: [1, 0.5, 1] as [number, number, number],
    selectionDuration: 400,
    springStiffness: 1200,
    springDamping: 30,
    hoverOffset: -3,
    pressOffset: 3,
    reboundOffset: -6,
    // Badge enter/exit (PopKey) — durations in seconds
    enterScale: 0.82,
    slideDistance: 16,
    enterDuration: 0.3,
    exitDuration: 0.22,
  },
} as const;

export const getAnimationConfig = (intensity: AnimationIntensity) => {
  return ANIMATION_CONFIGS[intensity];
};
