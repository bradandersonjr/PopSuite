/**
 * Preload bridge members for the license layer. Spread into the app's
 * `window.electronAPI` object alongside the settings/shortcut bridges.
 */

import { invoker, subscribe } from "../settings/preload";

export function createLicenseBridge(): Record<string, unknown> {
  return {
    getLicenseStatus: invoker("license:status"),
    activateLicense: invoker("license:activate"),
    deactivateLicense: invoker("license:deactivate"),
    onLicenseChange: (callback: (value: unknown) => void) =>
      subscribe("license-changed")(callback as (...args: never[]) => void),
  };
}
