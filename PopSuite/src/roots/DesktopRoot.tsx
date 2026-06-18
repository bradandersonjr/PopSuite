import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import { getSurfacePalette } from "@shared/config/desktopTheme";

import { useStore as useSuiteStore } from "@suite/store/useStore";
import { isSettingsWindow } from "@suite/lib/platform";

// keys module — composed unchanged via its namespaced aliases.
import KeysEngineShell from "@keys/engine/EngineShell";
import { useStore as useKeysStore } from "@keys/store/useStore";
import { useTraySettingsSync as useKeysTraySync } from "@keys/hooks/useTraySettingsSync";
import { useLicenseSync as useKeysLicenseSync } from "@keys/hooks/useLicenseSync";

// jot module — composed unchanged via its namespaced aliases.
import JotEngineShell from "@jot/engine/EngineShell";
import { useStore as useJotStore } from "@jot/store/useStore";
import { useTraySettingsSync as useJotTraySync } from "@jot/hooks/useTraySettingsSync";
import { useLicenseSync as useJotLicenseSync } from "@jot/hooks/useLicenseSync";

/**
 * Single overlay window hosting both module layers. The keys HUD is always
 * click-through; the jot layer toggles click-through on activation (handled in
 * the main process via overlay-activated/-deactivated). Each module keeps its
 * own store, synced from its namespaced tray broadcasts.
 */
const DesktopRoot = () => {
  const settingsWindow = isSettingsWindow();
  const { themeMode, keysEnabled, jotEnabled } = useSuiteStore();

  // Per-monitor scale is derived locally per store (each module's components
  // read their own scaleFactor).
  const setKeysScale = useKeysStore((s) => s.setScaleFactor);
  const setJotScale = useJotStore((s) => s.setScaleFactor);
  useScaleSync(setKeysScale, !settingsWindow);
  useScaleSync(setJotScale, !settingsWindow);

  // Apply each module's namespaced tray-settings + license broadcasts.
  useKeysTraySync();
  useJotTraySync();
  useKeysLicenseSync();
  useJotLicenseSync();

  if (settingsWindow) {
    const surface = getSurfacePalette(themeMode === "dark");
    return (
      <TooltipProvider>
        <div
          className={`h-screen w-screen overflow-hidden theme-${themeMode}`}
          style={{ backgroundColor: surface.panel }}
        >
          {/* Phase 4: tabbed Keystrokes / Annotation / General settings. */}
          <div style={{ color: "#9ca3af", padding: 24, fontFamily: "system-ui" }}>
            PopSuite settings — coming soon
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={`h-screen w-screen overflow-hidden bg-transparent theme-${themeMode}`}>
        {keysEnabled && <KeysEngineShell />}
        {jotEnabled && <JotEngineShell />}
      </div>
    </TooltipProvider>
  );
};

export default DesktopRoot;
