import { describe, expect, it } from "vitest";
import { applyShiftSymbol, SHIFT_SYMBOLS } from "./useInputCapture";

describe("applyShiftSymbol", () => {
  it("maps Shift + digit to its glyph and drops Shift (desktop path)", () => {
    expect(applyShiftSymbol("1", ["Shift"])).toEqual({ base: "!", mods: [] });
    expect(applyShiftSymbol("/", ["Shift"])).toEqual({ base: "?", mods: [] });
    expect(applyShiftSymbol("=", ["Shift"])).toEqual({ base: "+", mods: [] });
    expect(applyShiftSymbol("'", ["Shift"])).toEqual({ base: '"', mods: [] });
  });

  it("drops the redundant Shift when the glyph is already supplied (web path)", () => {
    expect(applyShiftSymbol("!", ["Shift"])).toEqual({ base: "!", mods: [] });
    expect(applyShiftSymbol("?", ["Shift"])).toEqual({ base: "?", mods: [] });
  });

  it("leaves combos with other modifiers intact so shortcuts read fully", () => {
    expect(applyShiftSymbol("1", ["Ctrl", "Shift"])).toEqual({ base: "1", mods: ["Ctrl", "Shift"] });
    expect(applyShiftSymbol("1", ["Alt", "Shift"])).toEqual({ base: "1", mods: ["Alt", "Shift"] });
  });

  it("leaves letters and non-shiftable keys untouched", () => {
    expect(applyShiftSymbol("A", ["Shift"])).toEqual({ base: "A", mods: ["Shift"] });
    expect(applyShiftSymbol("Enter", ["Shift"])).toEqual({ base: "Enter", mods: ["Shift"] });
    expect(applyShiftSymbol("F1", ["Shift"])).toEqual({ base: "F1", mods: ["Shift"] });
  });

  it("passes through when Shift is not held", () => {
    expect(applyShiftSymbol("1", [])).toEqual({ base: "1", mods: [] });
    expect(applyShiftSymbol("1", ["Ctrl"])).toEqual({ base: "1", mods: ["Ctrl"] });
  });

  it("covers the full US digit row", () => {
    const expected = "!@#$%^&*()";
    "1234567890".split("").forEach((d, i) => {
      expect(SHIFT_SYMBOLS[d]).toBe(expected[i]);
    });
  });
});
