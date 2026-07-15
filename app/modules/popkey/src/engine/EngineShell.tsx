import { useStore } from "@popkey/store/useStore";
import { useInputCapture } from "@popkey/hooks/useInputCapture";
import InputHUD from "@popkey/components/InputHUD";
import MouseRipple from "@popkey/components/MouseRipple";
import ScrollIndicator from "@popkey/components/ScrollIndicator";
import BrandingOverlay from "@popkey/components/BrandingOverlay";

const EngineShell = () => {
  const { appEnabled, showMouseClicks, showScrollWheel } = useStore();
  const { badges, clicks, scrolls } = useInputCapture();

  return (
    <>
      {appEnabled && <InputHUD badges={badges} />}
      {appEnabled && showMouseClicks && <MouseRipple clicks={clicks} />}
      {appEnabled && showScrollWheel && <ScrollIndicator scrolls={scrolls} />}
      {/* Branding stays visible even while PopKey is hidden (manually or
          auto-suppressed by PopJot annotating) so the watermark never disappears. */}
      <BrandingOverlay />
    </>
  );
};

export default EngineShell;
