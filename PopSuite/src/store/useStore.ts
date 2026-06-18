import { create } from "zustand";
import type { SettingValue } from "@shared/settings/schema";
import { createSettingsSlice, type SettingsState } from "@shared/settings/store";
import { settingsSchema } from "@suite/config/settingsSchema";

// Settings types derive from the schema — single source of truth.
export type ThemeMode = SettingValue<(typeof settingsSchema)["themeMode"]>;

// Re-exported so the shared, app-agnostic config/animations.ts (which imports
// AnimationIntensity from the current app's "@/store/useStore") resolves
// against PopSuite too. The suite has no global intensity of its own; this is
// just the shared vocabulary the modules use.
export type AnimationIntensity = "low" | "medium" | "high";

interface AppState extends SettingsState<typeof settingsSchema> {
  /** Pro license state, mirrored from the main process. */
  isPro: boolean;
  licenseKey: string | null;
  setLicense: (status: { isPro: boolean; key: string | null }) => void;
}

export const useStore = create<AppState>((set) => ({
  // Shell-level settings (values + setters) generated from the suite schema.
  ...createSettingsSlice(settingsSchema, set),

  isPro: false,
  licenseKey: null,
  setLicense: ({ isPro, key }) => set({ isPro, licenseKey: key }),
}));
