import { useTraySettingsSync as useSchemaTraySettingsSync } from "@shared/hooks/useTraySettingsSync";
import { settingsSchema, SETTINGS_NAMESPACE } from "@keys/config/settingsSchema";
import { useStore } from "@keys/store/useStore";

/**
 * Applies tray-settings IPC broadcasts to the store — fully generated from
 * the settings schema. Mount in any window that must react to settings.
 */
export function useTraySettingsSync(): void {
  useSchemaTraySettingsSync(settingsSchema, useStore, SETTINGS_NAMESPACE);
}
