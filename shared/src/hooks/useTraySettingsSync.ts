import { useEffect } from "react";
import { type SettingsSchema, setterName, trayChannel } from "@shared/settings/schema";
import { createSettingsPlatform, isDesktop } from "@shared/settings/renderer";
import type { SettingsState } from "@shared/settings/store";

/**
 * Optional per-key subscribe override. The unified suite Settings window mounts
 * BOTH module panels against a single `window.electronAPI` whose bridge routing
 * follows a mutable `activeId`. That makes the schema-derived `onSetting`
 * subscribe on whichever module happens to be active at mount time — so the
 * non-active panel would attach its listeners to the WRONG module's IPC
 * namespace and never receive its own seed pushes (see app/src/settings/main.tsx).
 * The suite passes a module-fixed subscribe here so each panel always listens on
 * its own namespace regardless of `activeId`. Standalone builds omit it and use
 * the module's own (already correctly namespaced) `onTrayMenuChange`.
 */
export type TraySettingsSubscribe = (
  channel: string,
  callback: (value: unknown) => void
) => () => void;

/**
 * Listens for tray-settings IPC broadcasts from the main process and applies
 * them to the app's Zustand store. Mount once in any renderer window that
 * needs to react to settings changes (e.g. the overlay window, which has no
 * settings UI of its own).
 */
export function useTraySettingsSync<S extends SettingsSchema>(
  schema: S,
  store: { getState(): SettingsState<S> },
  subscribe?: TraySettingsSubscribe
): void {
  useEffect(() => {
    if (!isDesktop()) return;

    const platform = createSettingsPlatform(schema);
    const state = store.getState() as Record<string, unknown>;
    const unlisteners = (Object.keys(schema) as Array<keyof S & string>).map((key) => {
      const apply = (value: unknown) =>
        (state[setterName(key)] as (value: unknown) => void)(value);
      // A module-fixed subscribe (suite) binds to the correct namespace; without
      // one, fall back to the schema platform's own onSetting (standalone).
      return subscribe
        ? subscribe(trayChannel(key), apply)
        : platform.onSetting(key, apply as never);
    });

    return () => unlisteners.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
