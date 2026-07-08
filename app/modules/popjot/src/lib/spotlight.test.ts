import { describe, expect, it } from "vitest";
import {
  canEnterSpotlight,
  DEFAULT_SPOTLIGHT_FEATHER_PCT,
  nextSpotlightActive,
  spotlightGradient,
} from "@/lib/spotlight";

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
    expect(spotlightGradient(0, 0, 100, 0, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,0)"
    );
    expect(spotlightGradient(0, 0, 100, 100, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,1)"
    );
    expect(spotlightGradient(0, 0, 100, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,0.65)"
    );
  });

  it("clamps out-of-range opacity", () => {
    expect(spotlightGradient(0, 0, 100, 200, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,1)"
    );
    expect(spotlightGradient(0, 0, 100, -50, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,0)"
    );
  });

  it("positions the circle at the cursor and uses the radius", () => {
    expect(spotlightGradient(120, 340, 180, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "at 120px 340px"
    );
    expect(spotlightGradient(120, 340, 180, 65, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "circle 180px"
    );
  });

  it("feather percent interpolates the ramp's inner stop by a fixed px width", () => {
    // 0%: hard edge — transparent hole extends to the full radius (400px, big
    // enough that the half-radius clamp never engages in this test).
    expect(spotlightGradient(0, 0, 400, 50, 0)).toContain("rgba(0,0,0,0) 400px");
    // 100%: softest allowed — ramp is MAX_FEATHER_PX (140) wide: 400 - 140 = 260.
    expect(spotlightGradient(0, 0, 400, 50, 100)).toContain("rgba(0,0,0,0) 260px");
    // Default (50%): ramp is 70px wide: 400 - 70 = 330.
    expect(spotlightGradient(0, 0, 400, 50, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,0) 330px"
    );
  });

  it("keeps the ramp width visually consistent as the circle shrinks", () => {
    // A small radius (60px) at 100% softness would collapse to a near-zero ramp
    // under the old radius-proportional model; the fixed-width ramp is now
    // clamped to at most half the radius (30px here) instead of vanishing.
    expect(spotlightGradient(0, 0, 60, 50, 100)).toContain("rgba(0,0,0,0) 30px");
    // A mid-size radius (200px) under 2x MAX_FEATHER_PX (140) at 100% softness:
    // the half-radius clamp (100px) engages before the full 140px ramp would.
    expect(spotlightGradient(0, 0, 200, 50, 100)).toContain("rgba(0,0,0,0) 100px");
  });

  it("clamps out-of-range feather percent", () => {
    expect(spotlightGradient(0, 0, 400, 50, 150)).toContain("rgba(0,0,0,0) 260px");
    expect(spotlightGradient(0, 0, 400, 50, -20)).toContain("rgba(0,0,0,0) 400px");
  });
});
