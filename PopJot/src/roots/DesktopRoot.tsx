import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useStore } from "@jot/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import EngineShell from "@jot/engine/EngineShell";
import SystemTray from "@jot/components/SystemTray";
import { isSettingsWindow } from "@jot/lib/platform";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { useTraySettingsSync } from "@jot/hooks/useTraySettingsSync";
import { useLicenseSync } from "@jot/hooks/useLicenseSync";

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
