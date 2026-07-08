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
} from "./suiteTray";

export interface SuiteTrayClientHandlers {
  /** Run the module's toggle logic (same as its tray Enable/Disable item). */
  onToggle(): void;
  /** Run a named extra action, e.g. "settings" or "about". */
  onAction(id: string): void;
  /** Quit this module process (launcher asked, via "Quit All"). */
  onQuit(): void;
  /**
   * Suite-only: the launcher relayed a sibling's annotating state. When true,
   * force-hide this overlay and defer manual toggles; when false, restore to the
   * user's last requested state. Optional so modules that never suppress (PopJot)
   * can omit it. Defaults to a no-op.
   */
  onSuppress?(suppressed: boolean): void;
}

export interface SuiteTrayClient {
  /** Push a fresh state snapshot to the launcher (no-op if not connected). */
  report(state: SuiteModuleState): void;
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
        case "quit":
          handlers.onQuit();
          break;
        case "suppress":
          handlers.onSuppress?.(msg.suppressed);
          break;
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
      if (!socket || socket.destroyed) return;
      try {
        socket.write(encodeFrame({ type: "state", state }));
      } catch {
        // Write after close: the close/error handler already handles fallback.
      }
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
