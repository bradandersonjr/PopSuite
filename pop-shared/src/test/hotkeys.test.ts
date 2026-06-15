import { describe, expect, it } from "vitest";
import { formatHotkey, hasNonModifierKey, isHotkeyPressed, normalizeKey } from "@shared/lib/hotkeys";

describe("hotkey helpers", () => {
  it("normalizes aliases consistently", () => {
    expect(normalizeKey("Ctrl")).toBe("control");
    expect(normalizeKey("Command")).toBe("meta");
    expect(normalizeKey("Option")).toBe("alt");
    expect(normalizeKey("A")).toBe("a");
  });

  it("detects when the target hotkey is pressed", () => {
    const activeKeys = new Set(["alt", "shift", "a"]);
    expect(isHotkeyPressed("Alt + Shift + A", activeKeys)).toBe(true);
    expect(isHotkeyPressed("Alt + Shift + S", activeKeys)).toBe(false);
  });

  it("requires at least one non-modifier key for recording", () => {
    expect(hasNonModifierKey(new Set(["alt", "shift"]))).toBe(false);
    expect(hasNonModifierKey(new Set(["alt", "shift", "a"]))).toBe(true);
  });

  it("formats key sets into a readable shortcut string", () => {
    expect(formatHotkey(new Set(["control", "shift", "a"]))).toContain("Shift");
    expect(formatHotkey(new Set(["control", "shift", "a"]))).toContain("A");
  });
});
