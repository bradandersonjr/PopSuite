import { useEffect } from "react";
import { getMonitorScale } from "@shared/utils/scale";

/**
 * Initializes and syncs the scale factor with the current monitor.
 * Recalculates when the viewport or monitor DPI context changes.
 */
export function useScaleSync(
  setScaleFactor: (scale: number) => void,
  enabled: boolean = true,
  browserZoomFactor: number = 1
) {
  useEffect(() => {
    if (!enabled) return;
    const update = () => setScaleFactor(getMonitorScale(browserZoomFactor));
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") update();
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [browserZoomFactor, enabled, setScaleFactor]);
}
