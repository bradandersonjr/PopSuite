/**
 * Ambient declarations for the app register() entry points as seen from the
 * suite package.
 *
 * The app sources use a `@/` alias that points at their OWN src, and PopJot and
 * PopKey each define it to a different directory. A single suite tsconfig can't
 * map `@/` to both, so instead of pulling the app register bodies into the
 * suite's type graph (each app already typechecks its own register.ts under its
 * own tsconfig), we declare just the signatures the suite consumes. `layout` is
 * intentionally loose here — createPopApp validates the real shape.
 */

declare module "@popjot/main/register" {
  export function registerPopJot(
    layout?: unknown,
    trayMode?: "owned" | "reported",
    embedded?: boolean,
  ): void;
}

declare module "@popkey/main/register" {
  export function registerPopKey(
    layout?: unknown,
    trayMode?: "owned" | "reported",
    embedded?: boolean,
  ): void;
}

declare module "@popjot/components/SystemTray" {
  export type SuiteSectionRequest = { title: string; omitKeys?: string[] } | null;
  const SystemTray: import("react").ComponentType<{
    unifiedSettingsMode?: boolean;
    suiteSection?: SuiteSectionRequest;
    getShortcutsOverride?: () => Promise<{
      main: string;
      persistent: string;
      spotlight: string;
      lastTool: string;
    }>;
  }>;
  export default SystemTray;
}

declare module "@popjot/hooks/useTraySettingsSync" {
  export function useTraySettingsSync(
    subscribe?: (channel: string, callback: (value: unknown) => void) => () => void,
  ): void;
}

declare module "@popjot/hooks/useLicenseSync" {
  export function useLicenseSync(): void;
}

declare module "@popkey/components/SystemTray" {
  export type SuiteSectionRequest = { title: string; omitKeys?: string[] } | null;
  const SystemTray: import("react").ComponentType<{
    unifiedSettingsMode?: boolean;
    suiteSection?: SuiteSectionRequest;
    getShortcutsOverride?: () => Promise<{ main: string }>;
  }>;
  export default SystemTray;
}

declare module "@popkey/hooks/useTraySettingsSync" {
  export function useTraySettingsSync(
    subscribe?: (channel: string, callback: (value: unknown) => void) => () => void,
  ): void;
}

declare module "@popkey/hooks/useLicenseSync" {
  export function useLicenseSync(): void;
}

// Schema + store shapes for the suite-wide Config export/import
// (SuiteImportExport only needs SettingsSchema and a Zustand-shaped store).
declare module "@popjot/config/settingsSchema" {
  export const settingsSchema: import("@shared/settings/schema").SettingsSchema;
}

declare module "@popjot/store/useStore" {
  export const useStore: { getState(): unknown };
}

declare module "@popkey/config/settingsSchema" {
  export const settingsSchema: import("@shared/settings/schema").SettingsSchema;
}

declare module "@popkey/store/useStore" {
  export const useStore: { getState(): unknown };
}
