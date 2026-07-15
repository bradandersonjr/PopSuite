import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useStore } from "@popkey/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import { useTraySettingsSync } from "@popkey/hooks/useTraySettingsSync";
import { useLicenseSync } from "@popkey/hooks/useLicenseSync";
import EngineShell from "@popkey/engine/EngineShell";
import SystemTray from "@popkey/components/SystemTray";
import { isSettingsWindow } from "@popkey/lib/platform";
import { getSurfacePalette } from "@shared/config/desktopTheme";

const DesktopRoot = () => {
  const settingsWindow = isSettingsWindow();
  const { themeMode, setScaleFactor } = useStore();
  useScaleSync(setScaleFactor, !settingsWindow);
  useTraySettingsSync();
  useLicenseSync();

  if (settingsWindow) {
    const surface = getSurfacePalette(themeMode === "dark");

    return (
      <TooltipProvider>
        <div className={`h-screen w-screen overflow-hidden theme-${themeMode}`} style={{ backgroundColor: surface.panel }}>
          <SystemTray settingsWindowMode />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={`h-screen w-screen overflow-hidden bg-transparent theme-${themeMode}`}>
        <EngineShell />
      </div>
    </TooltipProvider>
  );
};

export default DesktopRoot;
