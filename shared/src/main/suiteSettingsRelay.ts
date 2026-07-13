/**
 * Suite-only settings state-push relay.
 *
 * In the unified desktop build, the one Settings renderer sends requests
 * directly to each module's namespaced IPC handlers because both modules share
 * the same Electron main process. While a module panel is mounted, createPopApp
 * mirrors its main-to-renderer state pushes through the suite coordinator so
 * subscriptions in that shared renderer receive current values.
 *
 * The send/invoke replay helpers remain as compatibility paths for a separated
 * module host, but the current desktop Settings preload does not need them.
 */
import { ipcMain, type IpcMainInvokeEvent } from "electron";

/** Handler shape Electron stores for `ipcMain.handle`. */
type InvokeHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * Install a one-time recording shim over `ipcMain.handle` so every invoke
 * handler this process registers (shared settings/license IPC + the module's
 * own) is captured into a channel→handler map. The real `ipcMain.handle` still
 * runs, so ordinary invoke behavior for the module's own windows is unchanged.
 *
 * Returns the map. Idempotent: calling it twice returns the same map and does not
 * re-wrap. Safe to call unconditionally; it only records, never intercepts.
 */
let capturedHandlers: Map<string, InvokeHandler> | null = null;
export function captureInvokeHandlers(): Map<string, InvokeHandler> {
  if (capturedHandlers) return capturedHandlers;
  const handlers = new Map<string, InvokeHandler>();
  capturedHandlers = handlers;

  const realHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: InvokeHandler) => {
    handlers.set(channel, listener);
    return realHandle(channel, listener as Parameters<typeof realHandle>[1]);
  }) as typeof ipcMain.handle;

  const realRemoveHandler = ipcMain.removeHandler.bind(ipcMain);
  ipcMain.removeHandler = ((channel: string) => {
    handlers.delete(channel);
    return realRemoveHandler(channel);
  }) as typeof ipcMain.removeHandler;

  return handlers;
}

/** A relayed request/response the module must answer for the hosted renderer. */
export interface RelayInvokeResolution {
  id: number;
  result?: unknown;
  error?: string;
}

export interface SuiteSettingsRelay {
  /** True while the launcher is hosting this module's settings (relay engaged). */
  readonly hosting: boolean;
  /** Begin serving the hosted settings renderer (launcher opened/selected our tab). */
  start(): void;
  /** Stop serving (launcher closed the window or dropped our tab). */
  stop(): void;
  /** Replay a fire-and-forget renderer send against this module's `.on` listeners. */
  handleSend(channel: string, args: unknown[]): void;
  /** Answer a renderer invoke against this module's captured handler. */
  handleInvoke(channel: string, args: unknown[]): Promise<RelayInvokeResolution["result"]>;
  /**
   * Feed a main→renderer push (what the module would `webContents.send` to its
   * own settings window) so it can be forwarded to the hosted renderer. No-op
   * unless hosting, so standalone send paths pay nothing.
   */
  pushToHost(channel: string, args: unknown[]): void;
}

/**
 * Create the module-side relay. `forwardPush` sends a push up the pipe to the
 * launcher (only called while hosting). The relay owns no socket itself — the
 * suite tray client drives it — so it stays trivially testable.
 */
export function createSuiteSettingsRelay(
  forwardPush: (channel: string, args: unknown[]) => void
): SuiteSettingsRelay {
  const handlers = captureInvokeHandlers();
  let hosting = false;

  // A minimal stand-in for the IpcMainEvent that `.on` listeners receive. The
  // module's settings listeners only read `event.sender`-independent args (they
  // reply via the shared sendToRenderers sink, not event.reply), so an inert
  // sender is sufficient. Kept structurally close to Electron's event shape.
  const relayEvent = {
    // No renderer frame is associated with a relayed message; listeners that
    // ignore the event (all settings listeners do) are unaffected.
    sender: undefined,
    reply: () => {},
  } as unknown as Electron.IpcMainEvent;

  return {
    get hosting() {
      return hosting;
    },
    start() {
      hosting = true;
    },
    stop() {
      hosting = false;
    },
    handleSend(channel, args) {
      // Trigger the module's own registered listeners exactly as a renderer send
      // would. emit returns false when nothing listens; harmless either way.
      ipcMain.emit(channel, relayEvent, ...args);
    },
    async handleInvoke(channel, args) {
      const handler = handlers.get(channel);
      if (!handler) {
        // No such handler in this module: surface as an error the launcher can
        // reject the renderer promise with, mirroring Electron's own behavior
        // for an unhandled invoke channel.
        throw new Error(`No handler registered for '${channel}'`);
      }
      // Electron passes an IpcMainInvokeEvent; settings/license handlers ignore
      // it, so the same inert event stands in here too.
      return await handler(relayEvent as unknown as IpcMainInvokeEvent, ...args);
    },
    pushToHost(channel, args) {
      if (!hosting) return;
      forwardPush(channel, args);
    },
  };
}
