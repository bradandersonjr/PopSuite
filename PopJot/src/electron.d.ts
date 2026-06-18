import type { SettingsSetters } from "@shared/settings/schema";
import type { LicenseStatus } from "@shared/license/types";
import type { settingsSchema } from "@jot/config/settingsSchema";

type Position = { x: number; y: number };
type ShortcutUpdateResult =
  | { ok: true; shortcut: string }
  | { ok: false; shortcut: string; error: string };

declare global {
  interface Window {
    electronAPI?: SettingsSetters<typeof settingsSchema> & {
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

      // Named shortcuts
      setMainShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      setPersistentShortcut: (shortcut: string) => Promise<ShortcutUpdateResult>;
      getShortcuts: () => Promise<{ main: string; persistent: string }>;

      // PopJot-specific
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
