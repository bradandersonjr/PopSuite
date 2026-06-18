import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import { useTraySettingsSync as useSchemaTraySync } from "@shared/hooks/useTraySettingsSync";
import { getSurfacePalette } from "@shared/config/desktopTheme";

import { settingsSchema as suiteSchema } from "@suite/config/settingsSchema";
import { useStore as useSuiteStore } from "@suite/store/useStore";

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
 * PopSuite runs ONE process but a SEPARATE overlay window per module, so each
 * keeps the exact input/cursor behavior it has standalone (no shared-window
 * coordination). The window's `?module=` query decides which module mounts;
 * `?settings=1` is the shared settings window. Each sub-root calls only its own
 * sync hooks so windows stay isolated.
 */

const KeysOverlay = () => {
  const themeMode = useKeysStore((s) => s.themeMode);
  const setScale = useKeysStore((s) => s.setScaleFactor);
  useScaleSync(setScale, true);
  useKeysTraySync();
  useKeysLicenseSync();
  return (
    <div className={`h-screen w-screen overflow-hidden bg-transparent theme-${themeMode}`}>
      <KeysEngineShell />
    </div>
  );
};

const JotOverlay = () => {
  const themeMode = useJotStore((s) => s.themeMode);
  const setScale = useJotStore((s) => s.setScaleFactor);
  useScaleSync(setScale, true);
  useJotTraySync();
  useJotLicenseSync();
  return (
    <div className={`h-screen w-screen overflow-hidden bg-transparent theme-${themeMode}`}>
      <JotEngineShell />
    </div>
  );
};

const SuiteSettings = () => {
  const themeMode = useSuiteStore((s) => s.themeMode);
  // The settings window hosts both modules' controls, so it syncs all three
  // stores (suite chrome + both module previews).
  useSchemaTraySync(suiteSchema, useSuiteStore);
  useKeysTraySync();
  useJotTraySync();
  useKeysLicenseSync();
  useJotLicenseSync();

  const surface = getSurfacePalette(themeMode === "dark");
  return (
    <div
      className={`h-screen w-screen overflow-hidden theme-${themeMode}`}
      style={{ backgroundColor: surface.panel }}
    >
      {/* Phase 4: tabbed Keystrokes / Annotation / General settings. */}
      <div style={{ color: "#9ca3af", padding: 24, fontFamily: "system-ui" }}>
        PopSuite settings — coming soon
      </div>
    </div>
  );
};

const DesktopRoot = () => {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  let body: JSX.Element | null = null;
  if (params?.get("settings") === "1") {
    body = <SuiteSettings />;
  } else if (params?.get("module") === "keys") {
    body = <KeysOverlay />;
  } else if (params?.get("module") === "jot") {
    body = <JotOverlay />;
  }

  return <TooltipProvider>{body}</TooltipProvider>;
};

export default DesktopRoot;
