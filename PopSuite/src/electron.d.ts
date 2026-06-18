import type { LicenseStatus } from "@shared/license/types";

type Position = { x: number; y: number };
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
type RawWheelEvent = {
  direction: "up" | "down";
  x: number;
  y: number;
  amount: number;
  time: number;
};
type RawDragEvent = RawClickEvent & { dx: number; dy: number };

declare global {
  interface Window {
    // The namespaced per-setting senders (setKeys*/setJot*/set*) are accessed
    // dynamically through the shared renderer bridge, so they are intentionally
    // not enumerated here — only the members components call directly are typed.
    electronAPI?: {
      // Common bridge (settings/preload.ts)
      quitApp: () => void;
      closeWindow: () => void;
      onTrayMenuChange: (event: string, callback: (value: never) => void) => () => void;
      getOpenAtLogin: () => Promise<boolean>;
      setOpenAtLogin: (enabled: boolean) => void;
      openExternal: (url: string) => void;
      readClipboard: () => Promise<string>;

      // License (license/preload.ts)
      getLicenseStatus: () => Promise<LicenseStatus>;
      activateLicense: (key: string) => Promise<LicenseStatus>;
      deactivateLicense: () => Promise<LicenseStatus>;
      onLicenseChange: (callback: (status: LicenseStatus) => void) => () => void;

      // Combined named shortcuts
      setKeysShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      setAnnotateShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      setPersistentShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      getShortcuts: () => Promise<{ keys: string; annotate: string; persistent: string }>;

      // keys module
      onShortcutToggle: (callback: (enabled: boolean) => void) => () => void;
      onInputKeyDown: (callback: (e: RawKeyEvent) => void) => () => void;
      onInputKeyUp: (callback: (e: RawKeyEvent) => void) => () => void;
      onInputClick: (callback: (e: RawClickEvent) => void) => () => void;
      onInputWheel: (callback: (e: RawWheelEvent) => void) => () => void;
      onInputDrag: (callback: (e: RawDragEvent) => void) => () => void;
      onInputDragMove: (callback: (e: { button: number; dx: number; dy: number }) => void) => () => void;
      onInputFocusLost: (callback: () => void) => () => void;

      // jot module
      onShortcutActivate: (
        callback: (pos: Position, snapshotDataUrl: string | null) => void
      ) => () => void;
      onShortcutPersistent: (
        callback: (pos: Position, snapshotDataUrl: string | null) => void
      ) => () => void;
      overlayActivated: () => void;
      overlayDeactivated: () => void;
    };
  }
}

export {};
