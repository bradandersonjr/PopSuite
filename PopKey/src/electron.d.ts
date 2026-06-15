import type { SettingsSetters } from "@shared/settings/schema";
import type { settingsSchema } from "@/config/settingsSchema";

type ShortcutUpdateResult =
  | { ok: true; shortcut: string }
  | { ok: false; shortcut: string; error: string };

type RawKeyEvent = { key: string; keycode: number; modifier: boolean; time: number };
type RawClickEvent = {
  button: number;
  x: number;
  y: number;
  time: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};
type RawWheelEvent = { direction: "up" | "down"; x: number; y: number; amount: number; time: number };
type RawDragEvent = RawClickEvent & { dx: number; dy: number };

declare global {
  interface Window {
    electronAPI?: SettingsSetters<typeof settingsSchema> & {
      // Common bridge (settings/preload.ts)
      quitApp: () => void;
      closeWindow: () => void;
      onTrayMenuChange: (event: string, callback: (value: never) => void) => () => void;
      getOpenAtLogin: () => Promise<boolean>;
      setOpenAtLogin: (enabled: boolean) => void;

      // Named shortcuts
      setMainShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      getShortcuts: () => Promise<{ main: string }>;

      // PopKey-specific
      onShortcutToggle: (callback: (enabled: boolean) => void) => () => void;
      onInputKeyDown: (callback: (e: RawKeyEvent) => void) => () => void;
      onInputKeyUp: (callback: (e: RawKeyEvent) => void) => () => void;
      onInputClick: (callback: (e: RawClickEvent) => void) => () => void;
      onInputWheel: (callback: (e: RawWheelEvent) => void) => () => void;
      onInputDrag: (callback: (e: RawDragEvent) => void) => () => void;
      onInputDragMove: (callback: (e: { button: number; dx: number; dy: number }) => void) => () => void;
      onInputFocusLost: (callback: () => void) => () => void;
    };
  }
}

export {};
