/**
 * Main-process side of the declarative settings layer.
 * Registers one validated IPC handler per setting and keeps the canonical
 * main-process copy of every non-volatile value.
 */

import { ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import {
  type SettingsSchema,
  type SettingsValues,
  type SettingValue,
  isValidSettingValue,
  setChannel,
  settingsDefaults,
  trayChannel,
} from "./schema";

export interface SettingsController<S extends SettingsSchema> {
  /** Live main-process settings state (mutated as set-* IPC arrives). */
  values: SettingsValues<S>;
  /** Replay current non-volatile settings into a (new) window. */
  syncToWindow(win: BrowserWindow): void;
}

export function registerSettingsIpc<S extends SettingsSchema>(
  schema: S,
  opts: {
    sendToRenderers: (channel: string, value: unknown) => void;
    onChange?: { [K in keyof S]?: (value: SettingValue<S[K]>) => void };
  }
): SettingsController<S> {
  const values = settingsDefaults(schema);

  for (const key of Object.keys(schema) as Array<keyof S & string>) {
    const spec = schema[key];
    ipcMain.on(setChannel(key), (_event, value: unknown) => {
      if (!isValidSettingValue(spec, value)) return;
      if (!spec.volatile) {
        (values as Record<string, unknown>)[key] = value;
      }
      opts.sendToRenderers(trayChannel(key), value);
      opts.onChange?.[key]?.(value as SettingValue<S[typeof key]>);
    });
  }

  return {
    values,
    syncToWindow(win) {
      for (const key of Object.keys(schema) as Array<keyof S & string>) {
        if (schema[key].volatile) continue;
        win.webContents.send(trayChannel(key), values[key]);
      }
    },
  };
}
