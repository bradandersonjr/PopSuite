import { describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("uiohook-napi", () => ({ uIOhook: hook }));

import {
  acquireGlobalInputHook,
  releaseGlobalInputHook,
} from "./globalInputHook";

describe("global input hook ownership", () => {
  it("keeps the hook running until the last owner releases it", () => {
    expect(acquireGlobalInputHook()).toBe(true);
    expect(acquireGlobalInputHook()).toBe(true);
    expect(hook.start).toHaveBeenCalledTimes(1);

    releaseGlobalInputHook();
    expect(hook.stop).not.toHaveBeenCalled();

    releaseGlobalInputHook();
    expect(hook.stop).toHaveBeenCalledTimes(1);
  });

  it("does not claim ownership when native startup fails", () => {
    hook.start.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });

    expect(acquireGlobalInputHook()).toBe(false);
    releaseGlobalInputHook();
    expect(hook.stop).toHaveBeenCalledTimes(1);
  });
});