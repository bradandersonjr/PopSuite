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
  type SuiteBounds,
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
  /**
   * Send a suite-only auto-suppress command to the named module (no-op if not
   * connected). Used to hide/restore PopKey while PopJot annotates.
   */
  suppress(appName: string, suppressed: boolean): void;
  /**
   * Tell the named module to open (or focus) its settings window at `bounds`
   * (the tab-swap relay). Returns true if the module was connected and the
   * command was sent; false if it isn't running, so the requesting side can keep
   * its own settings window open rather than leaving the user with none.
   */
  openSettingsAt(appName: string, bounds: SuiteBounds): boolean;
  /** Ask every connected module to quit itself. */
  quitAll(): void;
  /** Stop listening and drop all connections. */
  dispose(): void;
}

/**
 * Start the tray server. `onChange` fires whenever the live module set or any
 * module's state changes, so the launcher can rebuild its menu. `onRequest`
 * fires (after the relay) when a module asks the launcher to relay a command to
 * a sibling — today only the settings tab-swap. The server performs the relay +
 * ack itself so the requester never strands the user with zero windows; the
 * callback is a launcher-side observation hook (logging) with the delivered flag.
 */
export function createSuiteTrayServer(
  onChange: () => void,
  pipePath: string = SUITE_TRAY_PIPE,
  onRequest?: (msg: ModuleToLauncher, delivered: boolean) => void
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
        } else if (msg.type === "requestSiblingSettings") {
          // Settings tab-swap: relay openSettings to the sibling (if connected),
          // then ack the requester with whether it was delivered. The requester
          // only hides its own window on delivered=true, so a dead sibling never
          // leaves the user with zero settings windows. Not a state change (no
          // menu rebuild). onRequest lets the launcher log/observe the relay.
          const target = findByApp(msg.target);
          const delivered = Boolean(target);
          if (target) send(target, { type: "openSettings", bounds: msg.bounds });
          send(conn, { type: "siblingSettingsResult", target: msg.target, delivered });
          onRequest?.(msg, delivered);
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
    suppress(appName: string, suppressed: boolean): void {
      const conn = findByApp(appName);
      if (conn) send(conn, { type: "suppress", suppressed });
    },
    openSettingsAt(appName: string, bounds: SuiteBounds): boolean {
      const conn = findByApp(appName);
      if (!conn) return false;
      send(conn, { type: "openSettings", bounds });
      return true;
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
