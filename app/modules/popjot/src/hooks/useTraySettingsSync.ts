import {
  useTraySettingsSync as useSchemaTraySettingsSync,
  type TraySettingsSubscribe,
} from "@shared/hooks/useTraySettingsSync";
import { settingsSchema } from "@popjot/config/settingsSchema";
import { useStore } from "@popjot/store/useStore";

/**
 * Applies tray-settings IPC broadcasts to the store — fully generated from
 * the settings schema. Mount in any window that must react to settings.
 *
 * `subscribe` is supplied only by the unified suite Settings window, which must
 * bind this module's listeners to its own IPC namespace regardless of the
 * preload's active module (see @shared/hooks/useTraySettingsSync). Standalone
 * builds omit it and use the module's own namespaced bridge.
 */
export function useTraySettingsSync(subscribe?: TraySettingsSubscribe): void {
  useSchemaTraySettingsSync(settingsSchema, useStore, subscribe);
}
