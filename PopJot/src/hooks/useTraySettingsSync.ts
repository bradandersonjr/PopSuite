import { useTraySettingsSync as useSchemaTraySettingsSync } from "@shared/hooks/useTraySettingsSync";
import { settingsSchema } from "@/config/settingsSchema";
import { useStore } from "@/store/useStore";

/**
 * Applies tray-settings IPC broadcasts to the store — fully generated from
 * the settings schema. Mount in any window that must react to settings.
 */
export function useTraySettingsSync(): void {
  useSchemaTraySettingsSync(settingsSchema, useStore);
}
