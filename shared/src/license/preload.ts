/**
 * Preload bridge members for the license layer. Spread into the app's
 * window.electronAPI object alongside the settings/shortcut bridges.
 */

import { invoker, subscribe } from "../settings/preload";

export function createLicenseBridge(namespace = ""): Record<string, unknown> {
  return {
    getLicenseStatus: invoker("license:status", namespace),
    activateLicense: invoker("license:activate", namespace),
    deactivateLicense: invoker("license:deactivate", namespace),
    onLicenseChange: (callback: (value: unknown) => void) =>
      subscribe("license-changed", namespace)(callback as (...args: never[]) => void),
  };
}