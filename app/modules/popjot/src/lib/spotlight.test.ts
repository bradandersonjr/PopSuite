import { describe, expect, it } from "vitest";
import { canEnterSpotlight, nextSpotlightActive, spotlightGradient } from "@/lib/spotlight";

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
    expect(spotlightGradient(0, 0, 100, 0, true)).toContain("rgba(0,0,0,0)");
    expect(spotlightGradient(0, 0, 100, 100, true)).toContain("rgba(0,0,0,1)");
    expect(spotlightGradient(0, 0, 100, 65, true)).toContain("rgba(0,0,0,0.65)");
  });

  it("clamps out-of-range opacity", () => {
    expect(spotlightGradient(0, 0, 100, 200, true)).toContain("rgba(0,0,0,1)");
    expect(spotlightGradient(0, 0, 100, -50, true)).toContain("rgba(0,0,0,0)");
  });

  it("positions the circle at the cursor and uses the radius", () => {
    expect(spotlightGradient(120, 340, 180, 65, true)).toContain("at 120px 340px");
    expect(spotlightGradient(120, 340, 180, 65, true)).toContain("circle 180px");
  });

  it("feather starts the ramp inside the radius; hard edge does not", () => {
    // Soft: inner transparent stop is at 65% of the radius (200 * 0.65 = 130).
    expect(spotlightGradient(0, 0, 200, 50, true)).toContain("rgba(0,0,0,0) 130px");
    // Hard: transparent hole extends to the full radius (200px).
    expect(spotlightGradient(0, 0, 200, 50, false)).toContain("rgba(0,0,0,0) 200px");
  });
});
