/**
 * PopJot Chrome Extension content-script root.
 *
 * Rendered directly into the Shadow DOM appRoot node.
 * Handles:
 *  - Loading persisted settings from chrome.storage.local on mount
 *  - Using the shared in-page keyboard and pointer interactions
 *  - Rendering Canvas + RadialMenu overlay when active
 */

import { useEffect, useRef } from "react";
import { TooltipProvider } from "@shared/components/ui/tooltip";
// "@/" here is intentional dependency injection: this file is built per-app
// (extension content-script bundle), and each app's build config points "@"
// at its own src, so these resolve to the consuming app's store/engine.
import { useStore } from "@/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import EngineShell from "@/engine/EngineShell";
import { applyStoredSettings, EXTENSION_STORAGE_KEYS, type StoredSettings } from "@shared/utils/extensionStorage";

interface ExtensionRootProps {
  shadowRoot: ShadowRoot;
}

const ExtensionRoot = ({ shadowRoot }: ExtensionRootProps) => {
  const { themeMode, appEnabled, pageZoomFactor: browserZoomFactor, setPageZoomFactor, setScaleFactor } = useStore();
  useScaleSync(setScaleFactor, true, browserZoomFactor);

  const settingsLoaded = useRef(false);
  useEffect(() => {
    if (settingsLoaded.current) return;
    settingsLoaded.current = true;

    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

    chrome.runtime.sendMessage({ type: "POPJOT_LOAD_SETTINGS" }, (response) => {
      if (!response?.ok || !response.settings) return;
      applyStoredSettings(response.settings);
    });
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage || !chrome.runtime?.onMessage) return;

    chrome.runtime.sendMessage({ type: "POPJOT_GET_TAB_ZOOM" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (!response?.ok || typeof response.zoomFactor !== "number" || !isFinite(response.zoomFactor)) return;
      setPageZoomFactor(response.zoomFactor);
    });

    const handleRuntimeMessage = (message: unknown) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        message.type !== "POPJOT_TAB_ZOOM_CHANGED" ||
        !("zoomFactor" in message) ||
        typeof message.zoomFactor !== "number" ||
        !isFinite(message.zoomFactor)
      ) {
        return;
      }

      setPageZoomFactor(message.zoomFactor);
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [setPageZoomFactor]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      // Storage change values are typed `unknown`; project the changed keys back
      // into a StoredSettings shape. applyStoredSettings guards each with `!= null`.
      const next: StoredSettings = {};
      for (const key of EXTENSION_STORAGE_KEYS) {
        const change = changes[key];
        if (change && change.newValue != null) {
          (next as Record<string, unknown>)[key] = change.newValue;
        }
      }
      applyStoredSettings(next);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    const host = shadowRoot.host as HTMLElement;
    host.style.pointerEvents = appEnabled ? "auto" : "none";
  }, [appEnabled, shadowRoot]);

  return (
    <TooltipProvider>
      <div
        className={`theme-${themeMode}`}
        style={{
          position: "fixed",
          inset: 0,
          width: `${browserZoomFactor * 100}vw`,
          height: `${browserZoomFactor * 100}vh`,
          transform: browserZoomFactor === 1 ? undefined : `scale(${1 / browserZoomFactor})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <EngineShell />
      </div>
    </TooltipProvider>
  );
};

export default ExtensionRoot;
