/**
 * Zustand slice generated from a settings schema: one value + one setter per
 * setting, with defaults taken from the schema (the single source of truth).
 */

import {
  type SettingsSchema,
  type SettingsSetters,
  type SettingsValues,
  setterName,
} from "./schema";

export type SettingsState<S extends SettingsSchema> = SettingsValues<S> & SettingsSetters<S>;

export function createSettingsSlice<S extends SettingsSchema>(
  schema: S,
  set: (partial: Record<string, unknown>) => void
): SettingsState<S> {
  const slice: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    slice[key] = schema[key].default;
    slice[setterName(key)] = (value: unknown) => set({ [key]: value });
  }
  return slice as SettingsState<S>;
}
