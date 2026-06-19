import { useStore, DRAWING_TOOLS } from "@/store/useStore";
import Canvas, { StrokeType } from "@/components/Canvas";
import RadialMenu from "@/components/RadialMenu";
import BrandingOverlay from "@/components/BrandingOverlay";

const EngineShell = () => {
  const { tool, color, appEnabled, snapshotDataUrl } = useStore();
  const canvasTool = DRAWING_TOOLS.has(tool as StrokeType) ? (tool as StrokeType) : null;

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
      {appEnabled && <BrandingOverlay />}
      <RadialMenu />
    </>
  );
};

export default EngineShell;
