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

  it("feather percent interpolates the ramp's inner stop between hard and soft", () => {
    // 0%: hard edge — transparent hole extends to the full radius (200px).
    expect(spotlightGradient(0, 0, 200, 50, 0)).toContain("rgba(0,0,0,0) 200px");
    // 100%: softest allowed — ramp starts at 20% of the radius (200 * 0.2 = 40).
    expect(spotlightGradient(0, 0, 200, 50, 100)).toContain("rgba(0,0,0,0) 40px");
    // Default (50%): ramp starts at 60% of the radius (200 * 0.6 = 120).
    expect(spotlightGradient(0, 0, 200, 50, DEFAULT_SPOTLIGHT_FEATHER_PCT)).toContain(
      "rgba(0,0,0,0) 120px"
    );
  });

  it("clamps out-of-range feather percent", () => {
    expect(spotlightGradient(0, 0, 200, 50, 150)).toContain("rgba(0,0,0,0) 40px");
    expect(spotlightGradient(0, 0, 200, 50, -20)).toContain("rgba(0,0,0,0) 200px");
  });
});
