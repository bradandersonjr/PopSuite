/**
 * Renderer-side license helpers. Safe in web builds — every call no-ops (and
 * reports unlicensed) when `window.electronAPI` is absent.
 */

import type { LicenseStatus } from "./types";

const UNLICENSED: LicenseStatus = { isPro: false, key: null };

type LicenseBridge = {
  getLicenseStatus?: () => Promise<LicenseStatus>;
  activateLicense?: (key: string) => Promise<LicenseStatus>;
  deactivateLicense?: () => Promise<LicenseStatus>;
  onLicenseChange?: (callback: (status: LicenseStatus) => void) => () => void;
};

function bridge(): LicenseBridge | undefined {
  return typeof window === "undefined"
    ? undefined
    : ((window as { electronAPI?: unknown }).electronAPI as LicenseBridge | undefined);
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  return (await bridge()?.getLicenseStatus?.()) ?? UNLICENSED;
}

/** Try to activate a key. Returns the resulting status (isPro:false if invalid). */
export async function activateLicense(key: string): Promise<LicenseStatus> {
  return (await bridge()?.activateLicense?.(key)) ?? UNLICENSED;
}

export async function deactivateLicense(): Promise<LicenseStatus> {
  return (await bridge()?.deactivateLicense?.()) ?? UNLICENSED;
}

/** Subscribe to license changes (activation/deactivation). Returns unsubscribe. */
export function onLicenseChange(callback: (status: LicenseStatus) => void): () => void {
  return bridge()?.onLicenseChange?.(callback) ?? (() => {});
}

export type { LicenseStatus };
