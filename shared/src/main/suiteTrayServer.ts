/**
 * PopSuite unified-tray SERVER (launcher side).
 *
 * The launcher owns the single system tray icon. This server listens on the
 * suite pipe, tracks every connected module's latest reported state, and lets
 * the launcher:
 *   - subscribe to "the set of live modules changed" (connect / disconnect /
 *     state update) so it can rebuild the one tray menu, and
 *   - send commands (toggle / action / quit) to a specific module by appName.
 *
 * A module is keyed by the appName it reports. The launcher never renders module
 * windows itself — it only relays clicks. Uses Node's `net` directly.
 */

import { createServer, type Server, type Socket } from "net";
import { existsSync, unlinkSync } from "fs";
import {
  SUITE_TRAY_PIPE,
  encodeFrame,
  decodeFrames,
  type SuiteModuleState,
  type ModuleToLauncher,
  type LauncherToModule,
} from "./suiteTray";

interface Connection {
  socket: Socket;
  buffer: string;
  /** Latest reported state; undefined until the first "state" message arrives. */
  state?: SuiteModuleState;
}

export interface SuiteTrayServer {
  /** Snapshot of all modules that have reported at least once, ordered stably. */
  getModules(): SuiteModuleState[];
  /** Send a toggle command to the named module (no-op if not connected). */
  toggle(appName: string): void;
  /** Send an action command to the named module. */
  action(appName: string, actionId: string): void;
  /** Flip a named extra toggle on the named module (e.g. PopKey's OBS Mode). */
  toggleExtra(appName: string, toggleId: string): void;
  /**
   * Send a suite-only auto-suppress command to the named module (no-op if not
   * connected). Used to hide/restore PopKey while PopJot annotates.
   */
  suppress(appName: string, suppressed: boolean): void;
  /** True when the named module is currently connected (its tab can host). */
  isConnected(appName: string): boolean;
  /**
   * Settings-window relay: forward a fire-and-forget IPC send from the launcher-
   * hosted settings renderer down to the owning module. No-op if not connected.
   */
  relaySend(appName: string, channel: string, args: unknown[]): void;
  /**
   * Settings-window relay: forward a request/response IPC invoke from the hosted
   * settings renderer down to the owning module. The module's answer comes back
   * via the `onRelay` callback as a relayInvokeResult. No-op if not connected.
   */
  relayInvoke(appName: string, id: number, channel: string, args: unknown[]): void;
  /** Ask every connected module to quit itself. */
  quitAll(): void;
  /** Stop listening and drop all connections. */
  dispose(): void;
}

/**
 * Start the tray server. `onChange` fires whenever the live module set or any
 * module's state changes, so the launcher can rebuild its menu. `onRelay` fires
 * for module→launcher settings-relay traffic (a hosted renderer's invoke result
 * or a main→renderer push), tagged with the sending module's appName so the
 * launcher can route it to the right settings tab. Omitted when the launcher
 * isn't hosting settings.
 */
export function createSuiteTrayServer(
  onChange: () => void,
  pipePath: string = SUITE_TRAY_PIPE,
  onRelay?: (appName: string, msg: ModuleToLauncher) => void
): SuiteTrayServer {
  // Best-effort cleanup of a stale Unix socket file from a crashed prior run.
  // On Windows named pipes there is no filesystem node to remove.
  if (process.platform !== "win32" && existsSync(pipePath)) {
    try {
      unlinkSync(pipePath);
    } catch {
      // If removal fails, listen() will surface the error below.
    }
  }

  const connections = new Set<Connection>();

  function send(conn: Connection, msg: LauncherToModule): void {
    if (conn.socket.destroyed) return;
    try {
      conn.socket.write(encodeFrame(msg));
    } catch {
      // Drop; the socket's close handler will clean the connection up.
    }
  }

  function findByApp(appName: string): Connection | undefined {
    for (const conn of connections) {
      if (conn.state?.appName === appName) return conn;
    }
    return undefined;
  }

  const server: Server = createServer((socket) => {
    const conn: Connection = { socket, buffer: "" };
    connections.add(conn);

    socket.on("data", (chunk: Buffer) => {
      const { messages, rest } = decodeFrames<ModuleToLauncher>(conn.buffer, chunk.toString("utf8"));
      conn.buffer = rest;
      let changed = false;
      for (const msg of messages) {
        if (msg.type === "state") {
          conn.state = msg.state;
          changed = true;
        } else if (msg.type === "relayInvokeResult" || msg.type === "relayPush") {
          // Settings-window relay coming back from the module: hand it to the
          // launcher tagged with the sender so it reaches the right hosted tab.
          // Not a state change (no menu rebuild).
          if (conn.state) onRelay?.(conn.state.appName, msg);
        }
      }
      if (changed) onChange();
    });

    const drop = (): void => {
      if (connections.delete(conn)) onChange();
    };
    socket.on("close", drop);
    socket.on("error", drop);
  });

  server.on("error", (err) => {
    // A launcher that can't own the pipe still runs, but modules will fall back
    // to their own trays. Surface it for logs; don't crash the launcher.
    console.error(`Suite tray server error: ${String(err)}`);
  });

  server.listen(pipePath);

  return {
    getModules(): SuiteModuleState[] {
      const states: SuiteModuleState[] = [];
      for (const conn of connections) {
        if (conn.state) states.push(conn.state);
      }
      return states.sort((a, b) => a.appName.localeCompare(b.appName));
    },
    toggle(appName: string): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "toggle" });
    },
    action(appName: string, actionId: string): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "action", id: actionId });
    },
    toggleExtra(appName: string, toggleId: string): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "toggleExtra", id: toggleId });
    },
    suppress(appName: string, suppressed: boolean): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "suppress", suppressed });
    },
    isConnected(appName: string): boolean {
      return Boolean(findByApp(appName));
    },
    relaySend(appName: string, channel: string, args: unknown[]): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "relaySend", channel, args });
    },
    relayInvoke(appName: string, id: number, channel: string, args: unknown[]): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "relayInvoke", id, channel, args });
    },
    quitAll(): void {
      for (const conn of connections) send(conn, { type: "quit" });
    },
    dispose(): void {
      for (const conn of connections) conn.socket.destroy();
      connections.clear();
      server.close();
    },
  };
}
