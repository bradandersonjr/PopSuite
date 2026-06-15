import { create } from "zustand";
import { isMac } from "@shared/lib/hotkeys";
import type { SettingValue } from "@shared/settings/schema";
import { createSettingsSlice, type SettingsState } from "@shared/settings/store";
import { settingsSchema } from "@/config/settingsSchema";

// Settings types derive from the schema — single source of truth.
export type ColorPalette = SettingValue<(typeof settingsSchema)["colorPalette"]>;
export type ThemeMode = SettingValue<(typeof settingsSchema)["themeMode"]>;
export type AnimationIntensity = SettingValue<(typeof settingsSchema)["animationIntensity"]>;
export type DisplayPosition = SettingValue<(typeof settingsSchema)["displayPosition"]>;
export type BadgeStyle = SettingValue<(typeof settingsSchema)["badgeStyle"]>;

interface AppState extends SettingsState<typeof settingsSchema> {
    appEnabled: boolean;
    setAppEnabled: (val: boolean) => void;
    hotkey: string;
    setHotkey: (hotkey: string) => void;
    pageZoomFactor: number;
    setPageZoomFactor: (zoomFactor: number) => void;
}

export const useStore = create<AppState>((set) => ({
    // Tray-adjustable settings (values + setters) generated from the schema
    ...createSettingsSlice(settingsSchema, set),

    appEnabled: true,
    setAppEnabled: (appEnabled) => set({ appEnabled }),
    hotkey: isMac() ? "Cmd + Shift + A" : "Alt + Shift + A",
    setHotkey: (hotkey) => set({ hotkey }),
    pageZoomFactor: 1,
    setPageZoomFactor: (pageZoomFactor) => set({ pageZoomFactor }),
}));
