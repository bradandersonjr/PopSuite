import { useEffect } from "react";
import { useStore, DRAWING_TOOLS } from "@popjot/store/useStore";
import { isDesktop, onSpotlightSet } from "@popjot/lib/platform";
import Canvas, { StrokeType } from "@popjot/components/Canvas";
import RadialMenu from "@popjot/components/RadialMenu";
import Spotlight from "@popjot/components/Spotlight";

const EngineShell = () => {
  const { tool, color, appEnabled, snapshotDataUrl } = useStore();
  const spotlightActive = useStore((s) => s.spotlightActive);
  const setSpotlightActive = useStore((s) => s.setSpotlightActive);
  const canvasTool = DRAWING_TOOLS.has(tool as StrokeType) ? (tool as StrokeType) : null;

  // Spotlight is a desktop-only presenter mode. Main owns the on/off state (it
  // gates the shortcut against annotation and streams the cursor); the renderer
  // just mirrors it into the store so <Spotlight> mounts/unmounts.
  useEffect(() => {
    if (!isDesktop()) return;
    return onSpotlightSet((active) => setSpotlightActive(active));
  }, [setSpotlightActive]);

  return (
    <>
      {appEnabled && snapshotDataUrl && (
        <img
          src={snapshotDataUrl}
          alt=""
          className="fixed inset-0 z-[99998] h-full w-full object-fill pointer-events-none select-none"
          draggable={false}
        />
      )}
      {appEnabled && <Canvas tool={canvasTool} color={color} />}
      {spotlightActive && <Spotlight />}
      <RadialMenu />
    </>
  );
};

export default EngineShell;
