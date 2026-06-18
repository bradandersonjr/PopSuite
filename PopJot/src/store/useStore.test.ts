import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@jot/store/useStore";

describe("PopJot store actions", () => {
  beforeEach(() => {
    useStore.setState({
      clearCanvas: false,
      toolSizeMultiplier: { marker: 1, pen: 1, highlighter: 1, eraser: 1 },
    });
  });

  it("toggles clearCanvas when requested", () => {
    const first = useStore.getState().clearCanvas;
    useStore.getState().triggerClearCanvas();
    expect(useStore.getState().clearCanvas).toBe(!first);
  });

  it("clamps tool size multiplier within supported bounds", () => {
    useStore.getState().adjustToolSize("marker", 10);
    expect(useStore.getState().toolSizeMultiplier.marker).toBe(4);

    useStore.getState().adjustToolSize("marker", -10);
    expect(useStore.getState().toolSizeMultiplier.marker).toBe(0.25);
  });
});
