import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useStore } from "@popjot/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import EngineShell from "@popjot/engine/EngineShell";
import SystemTray from "@popjot/components/SystemTray";
import { isSettingsWindow } from "@popjot/lib/platform";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { useTraySettingsSync } from "@popjot/hooks/useTraySettingsSync";
import { useLicenseSync } from "@popjot/hooks/useLicenseSync";

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

  // cursor-none is unconditional on the overlay root, not toggled per session.
  // The overlay window is only ever click-through (the cursor belongs to the app
  // underneath, so this rule is moot) or actively drawing (PopJot draws its own
  // cursor and the system one must be gone) — it has no state that should show a
  // system cursor. Toggling it in React raced the main process: setIgnoreMouseEvents
  // hands the window the pointer immediately, and the cursor stayed visible for the
  // frames until the re-render landed. Applying it statically at the root means the
  // rule is already in force before the window can ever take the pointer, and every
  // layer inherits it regardless of stacking order.
  return (
    <TooltipProvider>
      <div className={`h-screen w-screen overflow-hidden bg-transparent cursor-none theme-${themeMode}`}>
        <EngineShell />
      </div>
    </TooltipProvider>
  );
};

export default DesktopRoot;
