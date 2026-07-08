import { create } from "zustand";
import { isMac } from "@shared/lib/hotkeys";
import type { SettingValue } from "@shared/settings/schema";
import { createSettingsSlice, type SettingsState } from "@shared/settings/store";
import { settingsSchema } from "@/config/settingsSchema";

// Settings types derive from the schema — single source of truth.
export type MenuStyle = SettingValue<(typeof settingsSchema)["menuStyle"]>;
export type ColorPalette = SettingValue<(typeof settingsSchema)["colorPalette"]>;
export type ThemeMode = SettingValue<(typeof settingsSchema)["themeMode"]>;
export type AnimationIntensity = SettingValue<(typeof settingsSchema)["animationIntensity"]>;
export type GridMode = SettingValue<(typeof settingsSchema)["gridMode"]>;
export type GridSize = SettingValue<(typeof settingsSchema)["gridSize"]>;
export type OverlayMode = SettingValue<(typeof settingsSchema)["overlayMode"]>;
export type TextColor = SettingValue<(typeof settingsSchema)["textColor"]>;

export type Tool = "history" | "marker" | "pen" | "highlighter" | "eraser" | "screen";
export type BackgroundMode = "transparent" | "dark" | "light";
export type StrokeType = "marker" | "pen" | "highlighter" | "eraser";
export const DRAWING_TOOLS = new Set<StrokeType>(["marker", "pen", "highlighter", "eraser"]);

interface AppState extends SettingsState<typeof settingsSchema> {
    tool: Tool;
    setTool: (tool: Tool) => void;
    color: string;
    setColor: (color: string) => void;
    appEnabled: boolean;
    setAppEnabled: (val: boolean) => void;
    clearCanvas: boolean;
    triggerClearCanvas: () => void;
    background: BackgroundMode;
    setBackground: (bg: BackgroundMode) => void;
    hotkey: string;
    setHotkey: (hotkey: string) => void;
    persistentHotkey: string;
    setPersistentHotkey: (hotkey: string) => void;
    spotlightHotkey: string;
    setSpotlightHotkey: (hotkey: string) => void;
    isPersistentMode: boolean;
    setIsPersistentMode: (isPersistentMode: boolean) => void;
    isDrawing: boolean;
    setIsDrawing: (isDrawing: boolean) => void;
    /** Spotlight presenter mode — dim the screen except a circle at the cursor.
     *  Runtime-only (not persisted); toggled by the spotlight shortcut/Escape. */
    spotlightActive: boolean;
    setSpotlightActive: (spotlightActive: boolean) => void;
    pageZoomFactor: number;
    setPageZoomFactor: (zoomFactor: number) => void;
    snapshotDataUrl: string | null;
    setSnapshotDataUrl: (url: string | null) => void;
    toolSizeMultiplier: Record<StrokeType, number>;
    adjustToolSize: (tool: StrokeType, delta: number) => void;
    /** Monotonic counter — bump to invalidate memoised getEffectiveColors() results */
    paletteVersion: number;
    bumpPaletteVersion: () => void;
    /** Pro license state, mirrored from the main process. */
    isPro: boolean;
    licenseKey: string | null;
    setLicense: (status: { isPro: boolean; key: string | null }) => void;
}

export const useStore = create<AppState>((set) => ({
    // Tray-adjustable settings (values + setters) generated from the schema
    ...createSettingsSlice(settingsSchema, set),

    tool: "marker",
    setTool: (tool) => set({ tool }),
    color: "#F05A5A",
    setColor: (color) => set({ color }),
    appEnabled: false,
    setAppEnabled: (appEnabled) => set({ appEnabled }),
    clearCanvas: false,
    triggerClearCanvas: () => set((state) => ({ clearCanvas: !state.clearCanvas })),
    background: "transparent",
    setBackground: (background) => set({ background }),
    hotkey: isMac() ? "Cmd + Shift + A" : "Alt + Shift + A",
    setHotkey: (hotkey) => set({ hotkey }),
    persistentHotkey: isMac() ? "Cmd + Shift + S" : "Alt + Shift + S",
    setPersistentHotkey: (persistentHotkey) => set({ persistentHotkey }),
    spotlightHotkey: isMac() ? "Cmd + Shift + D" : "Alt + Shift + D",
    setSpotlightHotkey: (spotlightHotkey) => set({ spotlightHotkey }),
    isPersistentMode: false,
    setIsPersistentMode: (isPersistentMode) => set({ isPersistentMode }),
    isDrawing: false,
    setIsDrawing: (isDrawing) => set({ isDrawing }),
    spotlightActive: false,
    setSpotlightActive: (spotlightActive) => set({ spotlightActive }),
    pageZoomFactor: 1,
    setPageZoomFactor: (pageZoomFactor) => set({ pageZoomFactor }),
    snapshotDataUrl: null,
    setSnapshotDataUrl: (snapshotDataUrl) => set({ snapshotDataUrl }),
    toolSizeMultiplier: { marker: 1, pen: 1, highlighter: 1, eraser: 1 },
    adjustToolSize: (tool, delta) =>
        set((state) => {
            const current = state.toolSizeMultiplier[tool];
            const next = Math.max(0.25, Math.min(4, current + delta));
            return { toolSizeMultiplier: { ...state.toolSizeMultiplier, [tool]: next } };
        }),
    paletteVersion: 0,
    bumpPaletteVersion: () => set((state) => ({ paletteVersion: state.paletteVersion + 1 })),
    isPro: false,
    licenseKey: null,
    setLicense: ({ isPro, key }) => set({ isPro, licenseKey: key }),
}));
