/**
 * Shared license types — pure module (no Electron/Node imports), safe to import
 * from main, preload, and renderer alike.
 */

export type LicenseStatus = {
  /** True when a valid license key is currently active. */
  isPro: boolean;
  /** The active key, or null when unlicensed. Kept so the UI can show it. */
  key: string | null;
};
