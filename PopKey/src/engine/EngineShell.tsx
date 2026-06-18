import { useStore } from "@keys/store/useStore";
import { useInputCapture } from "@keys/hooks/useInputCapture";
import InputHUD from "@keys/components/InputHUD";
import MouseRipple from "@keys/components/MouseRipple";
import ScrollIndicator from "@keys/components/ScrollIndicator";
import BrandingOverlay from "@keys/components/BrandingOverlay";

const EngineShell = () => {
  const { appEnabled, showMouseClicks, showScrollWheel } = useStore();
  const { badges, clicks, scrolls } = useInputCapture();

  return (
    <>
      {appEnabled && <InputHUD badges={badges} />}
      {appEnabled && showMouseClicks && <MouseRipple clicks={clicks} />}
      {appEnabled && showScrollWheel && <ScrollIndicator scrolls={scrolls} />}
      {appEnabled && <BrandingOverlay />}
    </>
  );
};

export default EngineShell;
