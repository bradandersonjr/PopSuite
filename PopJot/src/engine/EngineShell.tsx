import { useEffect } from "react";
import { useStore, DRAWING_TOOLS } from "@/store/useStore";
import { sendLastColorPalette } from "@/lib/platform";
import Canvas, { StrokeType } from "@/components/Canvas";
import RadialMenu from "@/components/RadialMenu";

const EngineShell = () => {
  const { tool, color, appEnabled, snapshotDataUrl } = useStore();
  const colorPalette = useStore((s) => s.colorPalette);
  const lastColorPalette = useStore((s) => s.lastColorPalette);
  const setLastColorPalette = useStore((s) => s.setLastColorPalette);
  const canvasTool = DRAWING_TOOLS.has(tool as StrokeType) ? (tool as StrokeType) : null;

  // Remember the last non-Solid palette (from the UI or a sync broadcast) so the
  // Solid palette can keep real multi-color stroke colors. Always-mounted here.
  useEffect(() => {
    if (colorPalette !== "solid" && colorPalette !== lastColorPalette) {
      setLastColorPalette(colorPalette);
      sendLastColorPalette(colorPalette);
    }
  }, [colorPalette, lastColorPalette, setLastColorPalette]);

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
      <RadialMenu />
    </>
  );
};

export default EngineShell;
