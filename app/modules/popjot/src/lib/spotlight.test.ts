import { describe, expect, it } from "vitest";
import {
  canEnterSpotlight,
  DEFAULT_SPOTLIGHT_FEATHER_PCT,
  nextSpotlightActive,
  spotlightGradient,
} from "@popjot/lib/spotlight";

// A round screen height so feather-ramp math in the assertions below stays
// readable: at 1000px, FEATHER_SCREEN_FRACTION (0.12) gives a 120px max ramp.
const SCREEN_H = 1000;

describe("spotlight gate", () => {
  it("blocks entering while annotating", () => {
    expect(canEnterSpotlight(true)).toBe(false);
    expect(canEnterSpotlight(false)).toBe(true);
  });

  it("only turns on when not annotating", () => {
    // off -> on requires no annotation
    expect(nextSpotlightActive(false, false)).toBe(true);
    expect(nextSpotlightActive(false, true)).toBe(false);
  });

  it("always allows turning off, even while annotating", () => {
    expect(nextSpotlightActive(true, false)).toBe(false);
    expect(nextSpotlightActive(true, true)).toBe(false);
  });
});

describe("spotlight gradient", () => {
  it("maps dim opacity 0-100 to a 0-1 outer alpha", () => {
    expect(
      spotlightGradient(0, 0, 100, 0, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,0)");
    expect(
      spotlightGradient(0, 0, 100, 100, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,1)");
    expect(
      spotlightGradient(0, 0, 100, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,0.65)");
  });

  it("clamps out-of-range opacity", () => {
    expect(
      spotlightGradient(0, 0, 100, 200, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,1)");
    expect(
      spotlightGradient(0, 0, 100, -50, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,0)");
  });

  it("positions the circle at the cursor and uses the radius", () => {
    expect(
      spotlightGradient(120, 340, 180, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("at 120px 340px");
    expect(
      spotlightGradient(120, 340, 180, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("circle 180px");
  });

  it("feather percent interpolates the ramp's inner stop as a fraction of screen height", () => {
    // 0%: hard edge — transparent hole extends to the full radius (400px, big
    // enough that the half-radius clamp never engages in this test).
    expect(spotlightGradient(0, 0, 400, 50, 0, SCREEN_H)).toContain("rgba(0,0,0,0) 400px");
    // 100%: softest allowed — ramp is 12% of SCREEN_H (1000 * 0.12 = 120) wide:
    // 400 - 120 = 280.
    expect(spotlightGradient(0, 0, 400, 50, 100, SCREEN_H)).toContain("rgba(0,0,0,0) 280px");
    // Default (50%): ramp is 60px wide (half of 120): 400 - 60 = 340.
    expect(
      spotlightGradient(0, 0, 400, 50, DEFAULT_SPOTLIGHT_FEATHER_PCT, SCREEN_H)
    ).toContain("rgba(0,0,0,0) 340px");
  });

  it("keeps the ramp width the same across different circle radii on the same screen", () => {
    // Same featherPct + screenHeight, two different (large enough) radii: the
    // ramp WIDTH (radius - innerStop) should be identical — the softness reads
    // the same regardless of how big the circle is scrolled to.
    const g1 = spotlightGradient(0, 0, 300, 50, 100, SCREEN_H);
    const g2 = spotlightGradient(0, 0, 400, 50, 100, SCREEN_H);
    // 300 - 120 = 180; 400 - 120 = 280 — both are a 120px ramp.
    expect(g1).toContain("rgba(0,0,0,0) 180px");
    expect(g2).toContain("rgba(0,0,0,0) 280px");
  });

  it("clamps the ramp to at most half the radius on a small circle", () => {
    // At 100% softness the ramp would be 120px, but the radius is only 100px,
    // so it's clamped to half the radius (50px) instead of inverting past center.
    expect(spotlightGradient(0, 0, 100, 50, 100, SCREEN_H)).toContain("rgba(0,0,0,0) 50px");
  });

  it("scales the max ramp width with screen height", () => {
    // Half the screen height halves the max ramp width at 100% softness:
    // 500 * 0.12 = 60px ramp, so innerStop = 400 - 60 = 340.
    expect(spotlightGradient(0, 0, 400, 50, 100, 500)).toContain("rgba(0,0,0,0) 340px");
  });

  it("clamps out-of-range feather percent", () => {
    expect(spotlightGradient(0, 0, 400, 50, 150, SCREEN_H)).toContain("rgba(0,0,0,0) 280px");
    expect(spotlightGradient(0, 0, 400, 50, -20, SCREEN_H)).toContain("rgba(0,0,0,0) 400px");
  });
});
