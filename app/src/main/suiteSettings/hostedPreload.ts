/**
 * Preload for a module's settings renderer hosted inside the launcher-owned
 * settings window (one WebContentsView per module).
 *
 * The module's REAL settings renderer bundle runs here, but in the LAUNCHER's
 * process — so its `ipcRenderer` would reach the launcher's main, which has none
 * of the module's settings handlers. This preload closes that gap generically,
 * without knowing anything about the module's bridge shape:
 *
 *   1. It patches the shared `ipcRenderer` methods (send / invoke / on /
 *      removeListener) so every settings channel is tunnelled to the launcher
 *      main on a single relay channel; the launcher forwards it over the suite
 *      pipe to the OWNING module process, which answers from its real handlers.
 *   2. It then requires the module's OWN compiled preload bundle, unchanged, so
 *      the module builds its exact `window.electronAPI` on top of the patched
 *      transport. Nothing module-specific is duplicated here.
 *
 * The module id and the relative path to the module preload are injected via
 * process.argv (additionalArguments) by the launcher when it creates the view.
 */

import { ipcRenderer } from "electron";

// ─── Injected context ────────────────────────────────────────────────────
// The launcher passes --suite-module=<id> and --suite-preload=<absPath> via the
// WebContentsView's webPreferences.additionalArguments.
function argValue(prefix: string): string {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}
const moduleId = argValue("--suite-module=");
const modulePreloadPath = argValue("--suite-preload=");

// ─── Relay channels (must match suiteSettingsWindow.ts on the launcher) ────
// One up channel carries every tunnelled send/invoke tagged with the module id;
// one down channel carries the module's main→renderer pushes back to us.
const RELAY_SEND = "suite:relay-send";
const RELAY_INVOKE = "suite:relay-invoke";
const RELAY_PUSH = "suite:relay-push";
// Control sends the module uses to bracket a hosting session.
const HOST_START = "__suite_host_start";

// ─── Patch ipcRenderer into a forwarding transport ─────────────────────────
// Subscriptions the module's bridge registered, keyed by channel, so a push
// arriving on RELAY_PUSH can be fanned out to the right listeners exactly as a
// real ipcRenderer.on would have received it.
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

ipcRenderer.on(RELAY_PUSH, (_event, channel: string, args: unknown[]) => {
  const set = listeners.get(channel);
  if (!set) return;
  // Mirror ipcRenderer.on's (event, ...args) shape; the event is unused by the
  // settings bridge (subscribe() drops it before calling the app callback).
  for (const fn of set) fn({} as Electron.IpcRendererEvent, ...args);
});

// Preserve the genuine methods for the relay channels themselves.
const realSend = ipcRenderer.send.bind(ipcRenderer);
const realInvoke = ipcRenderer.invoke.bind(ipcRenderer);

ipcRenderer.send = ((channel: string, ...args: unknown[]) => {
  // Forward every module-bound send to the launcher, tagged with the module id.
  realSend(RELAY_SEND, moduleId, channel, args);
}) as typeof ipcRenderer.send;

ipcRenderer.invoke = ((channel: string, ...args: unknown[]) =>
  // Forward every request/response call; the launcher awaits the module's reply.
  realInvoke(RELAY_INVOKE, moduleId, channel, args)) as typeof ipcRenderer.invoke;

ipcRenderer.on = ((channel: string, listener: (...args: unknown[]) => void) => {
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(listener);
  return ipcRenderer;
}) as typeof ipcRenderer.on;

ipcRenderer.removeListener = ((channel: string, listener: (...args: unknown[]) => void) => {
  listeners.get(channel)?.delete(listener);
  return ipcRenderer;
}) as typeof ipcRenderer.removeListener;

// ─── Boot the module's own preload on the patched transport ────────────────
// modulePreloadPath is absolute (launcher-resolved). Requiring it runs the
// module's exact preload, which calls contextBridge.exposeInMainWorld with its
// real electronAPI — now transparently talking to the owning module process.
if (modulePreloadPath) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(modulePreloadPath);
  } catch (err) {
    // Surface load failures instead of silently leaving window.electronAPI
    // undefined (which makes every isDesktop() check in the hosted renderer
    // fall back to its web-page copy, e.g. the Sync tab's "desktop app only"
    // message even though this genuinely IS the desktop app).
    // eslint-disable-next-line no-console
    console.error("[hostedPreload] failed to load module preload:", modulePreloadPath, err);
  }
} else {
  // eslint-disable-next-line no-console
  console.error("[hostedPreload] no --suite-preload argument received; argv:", process.argv);
}

// Tell the owning module (through the relay) that our renderer is up so it seeds
// current settings state and begins serving. Fire once the DOM is ready. The
// preload runs in a DOM context at runtime; the electron tsconfig omits the DOM
// lib, so reach `window` through globalThis with a minimal local type.
const dom = globalThis as unknown as {
  addEventListener(type: string, cb: () => void): void;
};
dom.addEventListener("DOMContentLoaded", () => {
  realSend(RELAY_SEND, moduleId, HOST_START, []);
});
