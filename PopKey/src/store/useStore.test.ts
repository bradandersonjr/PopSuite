import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@keys/store/useStore";

describe("PopKey store actions", () => {
  beforeEach(() => {
    useStore.setState({ appEnabled: true, maxBadges: 5, badgeDuration: 2000 });
  });

  it("toggles app enabled state", () => {
    useStore.getState().setAppEnabled(false);
    expect(useStore.getState().appEnabled).toBe(false);
  });

  it("updates badge duration and max badges", () => {
    useStore.getState().setBadgeDuration(3500);
    useStore.getState().setMaxBadges(8);
    expect(useStore.getState().badgeDuration).toBe(3500);
    expect(useStore.getState().maxBadges).toBe(8);
  });
});
