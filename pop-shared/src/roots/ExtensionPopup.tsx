/**
 * PopJot Chrome Extension — Popup settings panel.
 *
 * Opens when the user clicks the extension icon in the toolbar.
 * Mirrors the Desktop settings window: same SystemTray component,
 * themed dark/light, settings persisted to chrome.storage.local.
 */

import { useEffect, useRef } from "react";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import SystemTray from "@/components/SystemTray";
import {
  EXTENSION_STORAGE_KEYS,
  applyStoredSettings,
  currentSettingsSnapshot,
} from "@shared/utils/extensionStorage";
import { getSurfacePalette } from "@shared/config/desktopTheme";

// --------------------------------------------------------------------------

const ExtensionPopup = () => {
  const themeMode = useStore((state) => state.themeMode);
  const settingsLoaded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // --- Load persisted settings on mount, then subscribe to persist changes --
  // Subscribe only AFTER loading — subscribing before load would fire the
  // callback with default store values and overwrite the user's saved settings.
  useEffect(() => {
    if (settingsLoaded.current) return;
    settingsLoaded.current = true;

    if (typeof chrome === "undefined" || !chrome.storage) return;

    chrome.storage.local.get(EXTENSION_STORAGE_KEYS as unknown as string[], (stored) => {
      applyStoredSettings(stored);
    });

    unsubscribeRef.current = useStore.subscribe(() => {
      if (typeof chrome === "undefined" || !chrome.storage) return;
      chrome.storage.local.set(currentSettingsSnapshot());
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const surface = getSurfacePalette(themeMode === "dark");

  return (
    <TooltipProvider>
      <div
        className={`theme-${themeMode}`}
        style={{ backgroundColor: surface.panel, width: 420, minHeight: 500, overflow: "hidden" }}
      >
        <SystemTray settingsWindowMode />
      </div>
    </TooltipProvider>
  );
};

export default ExtensionPopup;
