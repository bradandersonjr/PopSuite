import { afterEach, describe, expect, it } from "vitest";
import { calculateScaleFactor, getMonitorScale } from "@shared/utils/scale";

const originalDevicePixelRatio = window.devicePixelRatio;
const originalScreenWidth = window.screen.width;
const originalScreenHeight = window.screen.height;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

function setWindowDimensions({
  screenWidth,
  screenHeight,
  innerWidth,
  innerHeight,
  devicePixelRatio,
}: {
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
}) {
  Object.defineProperty(window.screen, "width", { configurable: true, value: screenWidth });
  Object.defineProperty(window.screen, "height", { configurable: true, value: screenHeight });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: innerWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: devicePixelRatio });
}

describe("scale helpers", () => {
  afterEach(() => {
    Object.defineProperty(window.screen, "width", { configurable: true, value: originalScreenWidth });
    Object.defineProperty(window.screen, "height", { configurable: true, value: originalScreenHeight });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: originalDevicePixelRatio });
  });

  it("calculates the expected scale from a physical 4k screen", () => {
    expect(calculateScaleFactor(3840, 2160)).toBe(2);
  });

  it("uses monitor resolution instead of the current viewport size", () => {
    setWindowDimensions({
      screenWidth: 2560,
      screenHeight: 1440,
      innerWidth: 1280,
      innerHeight: 720,
      devicePixelRatio: 1.5,
    });

    expect(getMonitorScale()).toBe(2);
  });

  it("compensates for extension tab zoom when requested", () => {
    setWindowDimensions({
      screenWidth: 1920,
      screenHeight: 1080,
      innerWidth: 1536,
      innerHeight: 864,
      devicePixelRatio: 1.25,
    });

    expect(getMonitorScale(1.25)).toBe(1);
  });
});
