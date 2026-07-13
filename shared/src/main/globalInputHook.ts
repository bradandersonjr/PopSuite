/**
 * Shared ownership for the native uIOhook listener.
 *
 * PopKey keeps the hook for the app lifetime while PopJot acquires it only during
 * Spotlight. In the unified desktop runtime both consumers share one native
 * singleton, so stopping one consumer must not stop the other.
 */

import { uIOhook } from "uiohook-napi";

let owners = 0;
let running = false;

export { uIOhook };

export function acquireGlobalInputHook(): boolean {
  if (running) {
    owners += 1;
    return true;
  }

  try {
    uIOhook.start();
    running = true;
    owners = 1;
    return true;
  } catch {
    return false;
  }
}

export function releaseGlobalInputHook(): void {
  if (owners === 0) return;
  owners -= 1;
  if (owners > 0 || !running) return;
  uIOhook.stop();
  running = false;
}