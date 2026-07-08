/**
 * Preload for the launcher-owned settings window's tab strip.
 *
 * The tab strip is its own tiny renderer (tabStrip.html) at the top of the
 * window, independent of either module's settings bundle. This preload gives it
 * a minimal, safe bridge: pick a tab, learn which module is active/connected, and
 * subscribe to connection changes so a dead module's tab can be styled/labelled.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("suiteTabs", {
  /** Ask the launcher to show the given module's settings tab. */
  select: (moduleId: string) => ipcRenderer.send("suite:select-tab", moduleId),
  /** Current tab layout: [{ id, label, connected }], plus the active id. */
  getState: () => ipcRenderer.invoke("suite:tab-state"),
  /** Fire on any tab-state change (active tab or a module connect/disconnect). */
  onStateChanged: (cb: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => cb(state);
    ipcRenderer.on("suite:tab-state-changed", handler);
    return () => ipcRenderer.removeListener("suite:tab-state-changed", handler);
  },
});
