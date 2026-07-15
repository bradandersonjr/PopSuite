/**
 * PopSuite unified-tray CLIENT (module side).
 *
 * A module process (PopJot / PopKey) running under the suite launcher uses this
 * to hand its tray over to the launcher's single icon:
 *   - connect() attempts to reach the launcher's pipe.
 *   - On success the module pushes its state (report) and receives commands
 *     (toggle / action / quit) which it routes back to its own handlers.
 *   - On failure to connect, or on later disconnect, the caller's `onUnavailable`
 *     runs so the module can fall back to creating its OWN local tray icon —
 *     exactly what it does when launched standalone. This is what keeps a module
 *     from ever ending up with no tray when the launcher is absent or dies.
 *
 * Uses Node's `net` module directly (no third-party dependency).
 */

import { connect, type Socket } from "net";
import {
  SUITE_TRAY_PIPE,
  encodeFrame,
  decodeFrames,
  type SuiteModuleState,
  type LauncherToModule,
  type ModuleToLauncher,
} from "./suiteTray";

export interface SuiteTrayClientHandlers {
  /** Run the module's toggle logic (same as its tray Enable/Disable item). */
  onToggle(): void;
  /** Run a named extra action, e.g. "settings" or "about". */
  onAction(id: string): void;
  /** Flip a named extra toggle, e.g. PopKey's "obsMode". Optional; only
   *  modules that report extraToggles need to handle this. */
  onToggleExtra?(id: string): void;
  /** Quit this module process (launcher asked, via "Quit All"). */
  onQuit(): void;
  /**
   * Suite-only: the launcher relayed a sibling's annotating state. When true,
   * force-hide this overlay and defer manual toggles; when false, restore to the
   * user's last requested state. Optional so modules that never suppress (PopJot)
   * can omit it. Defaults to a no-op.
   */
  onSuppress?(suppressed: boolean): void;
  /**
   * Suite-only: the launcher-owned settings window relayed a fire-and-forget IPC
   * send from this module's hosted settings renderer. Replay it against the
   * module's own ipcMain. Optional; defaults to a no-op.
   */
  onRelaySend?(channel: string, args: unknown[]): void;
  /**
   * Suite-only: the launcher relayed a request/response IPC invoke from this
   * module's hosted settings renderer. Answer it and resolve the returned promise
   * with the outcome; the client sends the correlated result back. Optional.
   */
  onRelayInvoke?(channel: string, args: unknown[]): Promise<unknown>;
}

export interface SuiteTrayClient {
  /** Push a fresh state snapshot to the launcher (no-op if not connected). */
  report(state: SuiteModuleState): void;
  /**
   * Suite-only: forward a main→renderer push (what the module would send to its
   * own settings window) up to the launcher, which delivers it into the hosted
   * settings renderer. No-op if not connected.
   */
  relayPush(channel: string, args: unknown[]): void;
  /** Tear down the socket. */
  dispose(): void;
}

/**
 * Try to attach this module to the launcher's unified tray.
 *
 * Resolves the connection asynchronously via callbacks rather than a promise so
 * the caller can register the socket immediately and keep reporting state:
 *   - `onReady` fires once connected (send your first state here).
 *   - `onUnavailable` fires if the initial connect fails OR the connection later
 *     drops. The caller MUST treat this as "the launcher is gone, create my own
 *     tray now". It fires at most once per client (idempotent).
 */
export function createSuiteTrayClient(
  handlers: SuiteTrayClientHandlers,
  callbacks: { onReady: () => void; onUnavailable: () => void },
  pipePath: string = SUITE_TRAY_PIPE
): SuiteTrayClient {
  let socket: Socket | null = null;
  let buffer = "";
  let unavailableFired = false;
  let disposed = false;

  function fireUnavailable(): void {
    if (unavailableFired || disposed) return;
    unavailableFired = true;
    callbacks.onUnavailable();
  }

  /** Write one framed message up the pipe; silent no-op if the socket is gone. */
  function writeFrame(msg: ModuleToLauncher): void {
    if (!socket || socket.destroyed) return;
    try {
      socket.write(encodeFrame(msg));
    } catch {
      // Write after close: the close/error handler already handles fallback.
    }
  }

  const s = connect(pipePath);
  socket = s;

  s.on("connect", () => {
    if (disposed) {
      s.destroy();
      return;
    }
    callbacks.onReady();
  });

  s.on("data", (chunk: Buffer) => {
    const { messages, rest } = decodeFrames<LauncherToModule>(buffer, chunk.toString("utf8"));
    buffer = rest;
    for (const msg of messages) {
      switch (msg.type) {
        case "toggle":
          handlers.onToggle();
          break;
        case "action":
          handlers.onAction(msg.id);
          break;
        case "toggleExtra":
          handlers.onToggleExtra?.(msg.id);
          break;
        case "quit":
          handlers.onQuit();
          break;
        case "suppress":
          handlers.onSuppress?.(msg.suppressed);
          break;
        case "relaySend":
          // Hosted settings renderer fired a fire-and-forget send; replay it.
          handlers.onRelaySend?.(msg.channel, msg.args);
          break;
        case "relayInvoke": {
          // Hosted settings renderer issued a request/response call. Answer it
          // and ack the launcher with the same id so it can resolve the promise.
          const { id, channel, args } = msg;
          const answer = handlers.onRelayInvoke?.(channel, args);
          if (!answer) {
            // No relay wired (shouldn't happen when hosting): reject cleanly.
            writeFrame({ type: "relayInvokeResult", id, error: "relay unavailable" });
            break;
          }
          void answer.then(
            (result) => writeFrame({ type: "relayInvokeResult", id, result }),
            (err: unknown) =>
              writeFrame({ type: "relayInvokeResult", id, error: String(err) })
          );
          break;
        }
      }
    }
  });

  // Connection refused (launcher not running) or dropped later: degrade to a
  // local tray. `error` may precede `close`; fireUnavailable is idempotent.
  s.on("error", () => {
    fireUnavailable();
  });
  s.on("close", () => {
    socket = null;
    fireUnavailable();
  });

  return {
    report(state: SuiteModuleState): void {
      writeFrame({ type: "state", state });
    },
    relayPush(channel: string, args: unknown[]): void {
      writeFrame({ type: "relayPush", channel, args });
    },
    dispose(): void {
      disposed = true;
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
        socket = null;
      }
    },
  };
}
