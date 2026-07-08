import { useEffect } from "react";
import { useStore, DRAWING_TOOLS } from "@/store/useStore";
import { isDesktop, onSpotlightSet, sendLastColorPalette } from "@/lib/platform";
import Canvas, { StrokeType } from "@/components/Canvas";
import RadialMenu from "@/components/RadialMenu";
import Spotlight from "@/components/Spotlight";

const EngineShell = () => {
  const { tool, color, appEnabled, snapshotDataUrl } = useStore();
  const colorPalette = useStore((s) => s.colorPalette);
  const lastColorPalette = useStore((s) => s.lastColorPalette);
  const setLastColorPalette = useStore((s) => s.setLastColorPalette);
  const spotlightActive = useStore((s) => s.spotlightActive);
  const setSpotlightActive = useStore((s) => s.setSpotlightActive);
  const canvasTool = DRAWING_TOOLS.has(tool as StrokeType) ? (tool as StrokeType) : null;

  // Remember the last non-Solid palette (from the UI or a sync broadcast) so the
  // Solid palette can keep real multi-color stroke colors. Always-mounted here.
  useEffect(() => {
    if (colorPalette !== "solid" && colorPalette !== lastColorPalette) {
      setLastColorPalette(colorPalette);
      sendLastColorPalette(colorPalette);
    }
  }, [colorPalette, lastColorPalette, setLastColorPalette]);

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
