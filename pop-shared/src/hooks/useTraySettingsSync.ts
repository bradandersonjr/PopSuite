import { useEffect } from "react";
import { type SettingsSchema, setterName } from "@shared/settings/schema";
import { createSettingsPlatform, isDesktop } from "@shared/settings/renderer";
import type { SettingsState } from "@shared/settings/store";

/**
 * Listens for tray-settings IPC broadcasts from the main process and applies
 * them to the app's Zustand store. Mount once in any renderer window that
 * needs to react to settings changes (e.g. the overlay window, which has no
 * settings UI of its own).
 */
export function useTraySettingsSync<S extends SettingsSchema>(
  schema: S,
  store: { getState(): SettingsState<S> },
  ns?: string
): void {
  useEffect(() => {
    if (!isDesktop()) return;

    const platform = createSettingsPlatform(schema, ns);
    const state = store.getState() as Record<string, unknown>;
    const unlisteners = (Object.keys(schema) as Array<keyof S & string>).map((key) =>
      platform.onSetting(key, (value) => {
        (state[setterName(key)] as (value: unknown) => void)(value);
      })
    );

    return () => unlisteners.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
