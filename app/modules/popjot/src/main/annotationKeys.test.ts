import { describe, expect, it, vi, beforeEach } from "vitest";

const listeners: Record<string, ((e: { keycode: number }) => void)[]> = {};

const hook = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("uiohook-napi", async (importOriginal) => {
  // Keep the real UiohookKey keycode table — the whole point of these tests is
  // that a rebound accelerator maps to the RIGHT physical keys.
  const actual = await importOriginal<typeof import("uiohook-napi")>();
  return { UiohookKey: actual.UiohookKey, uIOhook: hook };
});

import { UiohookKey } from "uiohook-napi";
import {
  acceleratorModifierGroups,
  startAnnotationKeys,
  stopAnnotationKeys,
} from "./annotationKeys";

function installHookMocks(): void {
  hook.on.mockImplementation((event: string, fn: (e: { keycode: number }) => void) => {
    (listeners[event] ??= []).push(fn);
  });
  hook.removeListener.mockImplementation((event: string, fn: (e: { keycode: number }) => void) => {
    listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
  });
}

installHookMocks();

const emit = (event: "keydown" | "keyup", keycode: number) =>
  [...(listeners[event] ?? [])].forEach((fn) => fn({ keycode }));

describe("acceleratorModifierGroups", () => {
  it("watches both the left and right key for each modifier", () => {
    expect(acceleratorModifierGroups("Alt+Shift+A")).toEqual([
      [UiohookKey.Alt, UiohookKey.AltRight],
      [UiohookKey.Shift, UiohookKey.ShiftRight],
    ]);
  });

  it("derives the set from a REBOUND accelerator, not the default chord", () => {
    expect(acceleratorModifierGroups("Ctrl+Alt+P")).toEqual([
      [UiohookKey.Ctrl, UiohookKey.CtrlRight],
      [UiohookKey.Alt, UiohookKey.AltRight],
    ]);
  });

  it("ignores the accelerator's non-modifier key", () => {
    expect(acceleratorModifierGroups("Shift+F9")).toEqual([
      [UiohookKey.Shift, UiohookKey.ShiftRight],
    ]);
  });

  it("returns nothing for a modifier-less accelerator", () => {
    expect(acceleratorModifierGroups("F8")).toEqual([]);
  });
});

describe("startAnnotationKeys", () => {
  beforeEach(() => {
    stopAnnotationKeys();
    vi.clearAllMocks();
    // clearAllMocks drops the implementations, not just the call records.
    installHookMocks();
  });

  it("fires once every modifier of the live chord is released", () => {
    const onRelease = vi.fn();
    startAnnotationKeys("Alt+Shift+A", onRelease);

    // The chord's modifiers are already down when the hook starts (the shortcut
    // fired), so a keyup for one of them must count without a prior keydown.
    emit("keyup", UiohookKey.Alt);
    expect(onRelease).not.toHaveBeenCalled();

    emit("keyup", UiohookKey.Shift);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("accepts the right-hand twin of a modifier", () => {
    const onRelease = vi.fn();
    startAnnotationKeys("Alt+Shift+A", onRelease);

    emit("keydown", UiohookKey.AltRight);
    emit("keyup", UiohookKey.Alt);
    emit("keyup", UiohookKey.Shift);
    // AltRight is still down, so the Alt group is not fully released.
    expect(onRelease).not.toHaveBeenCalled();

    emit("keyup", UiohookKey.AltRight);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("does not fire on an unrelated key's release", () => {
    const onRelease = vi.fn();
    startAnnotationKeys("Alt+Shift+A", onRelease);

    emit("keyup", UiohookKey.A);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("releases the shared hook after firing", () => {
    startAnnotationKeys("Alt+Shift+A", vi.fn());
    emit("keyup", UiohookKey.Alt);
    emit("keyup", UiohookKey.Shift);
    expect(hook.stop).toHaveBeenCalledTimes(1);
  });

  it("never acquires the hook for a modifier-less accelerator", () => {
    startAnnotationKeys("F8", vi.fn());
    expect(hook.start).not.toHaveBeenCalled();
  });
});
