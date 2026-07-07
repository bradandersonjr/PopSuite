import { useStore } from "@/store/useStore";
import { useInputCapture } from "@/hooks/useInputCapture";
import InputHUD from "@/components/InputHUD";
import MouseRipple from "@/components/MouseRipple";
import ScrollIndicator from "@/components/ScrollIndicator";
import BrandingOverlay from "@/components/BrandingOverlay";

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
