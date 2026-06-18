import { useStore, DRAWING_TOOLS } from "@jot/store/useStore";
import Canvas, { StrokeType } from "@jot/components/Canvas";
import RadialMenu from "@jot/components/RadialMenu";

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
      <RadialMenu />
    </>
  );
};

export default EngineShell;
