import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import { useTraySettingsSync } from "@/hooks/useTraySettingsSync";
import EngineShell from "@/engine/EngineShell";
import SystemTray from "@/components/SystemTray";
import { isSettingsWindow } from "@/lib/platform";
import { getSurfacePalette } from "@shared/config/desktopTheme";

const DesktopRoot = () => {
  const settingsWindow = isSettingsWindow();
  const { themeMode, setScaleFactor } = useStore();
  useScaleSync(setScaleFactor, !settingsWindow);
  useTraySettingsSync();

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
