/**
 * PopSuite unified-tray IPC + menu model.
 *
 * In the suite build there is ONE system tray icon owned by the launcher
 * process. Each module (PopJot, PopKey) runs as its own OS process and, instead
 * of creating its own tray, connects to the launcher over a local named pipe and
 * REPORTS its state (name, active/idle, shortcut hints, which extra tray actions
 * it offers). The launcher builds a single dynamic menu from every connected
 * module and sends action commands back down the pipe when the user clicks.
 *
 * This module holds everything that is pure and shared between the two sides:
 *   - the pipe path,
 *   - the wire message shapes,
 *   - newline-delimited-JSON framing helpers, and
 *   - buildSuiteTrayMenu(): a pure function that turns a list of connected-module
 *     states into an Electron menu template. Kept free of any Electron import so
 *     it is trivially unit-testable in a plain Node/vitest environment.
 *
 * The actual net.Server / net.Socket wiring lives in suiteTrayServer.ts (launcher
 * side) and suiteTrayClient.ts (module side); createPopApp uses the client.
 */

/** Named pipe the launcher listens on and modules connect to (Windows/Unix). */
export const SUITE_TRAY_PIPE =
  process.platform === "win32"
    ? "\\\\.\\pipe\\popsuite-tray"
    : `${process.env.TMPDIR || "/tmp"}/popsuite-tray.sock`;

/**
 * An extra tray action a module exposes beyond the toggle, e.g. "Open Settings"
 * or "About". `id` is echoed back verbatim in an ACTION message so the module
 * knows which handler to run.
 */
export interface SuiteTrayAction {
  id: string;
  label: string;
}

/**
 * Snapshot of a module's tray-relevant state. Sent by the module on connect and
 * whenever anything changes (toggle flips active, a shortcut is rebound).
 */
export interface SuiteModuleState {
  /** Product name, e.g. "PopJot". Also the connection's identity in the menu. */
  appName: string;
  /** True when the module is enabled/active (drives the checkmark + label). */
  active: boolean;
  /** Human-readable shortcut hints shown next to the toggle, e.g. ["Alt+Shift+A"]. */
  shortcuts: string[];
  /** Label to use for the toggle item, e.g. "Enable PopJot" / "Disable PopJot". */
  toggleLabel?: string;
  /** Whether the module offers a toggle at all. */
  canToggle: boolean;
  /** Extra per-module actions (settings, about, ...). */
  actions: SuiteTrayAction[];
  /**
   * Suite-only cross-module signal: true while this module is actively
   * annotating (PopJot drawing mode on). The launcher relays this to the other
   * module as a suppress command so, e.g., PopKey auto-hides while PopJot draws.
   * Undefined/absent for modules that never annotate (PopKey). Purely additive:
   * a module that never sets it behaves exactly as before.
   */
  annotating?: boolean;
  /**
   * Suite-only: true while this module's overlay is auto-suppressed by a sibling
   * (e.g. PopKey hidden because PopJot is annotating). Reported back so the
   * unified tray can label the entry distinctly. Distinct from `active`, which
   * still reflects the user's own manually-requested state.
   */
  autoSuppressed?: boolean;
}

// ─── Wire messages ──────────────────────────────────────────────────────

/** Module → launcher: full state snapshot (sent on connect and on any change). */
export interface StateMessage {
  type: "state";
  state: SuiteModuleState;
}

/** Launcher → module: run the module's toggle handler. */
export interface ToggleMessage {
  type: "toggle";
}

/** Launcher → module: run a named extra action (settings/about/...). */
export interface ActionMessage {
  type: "action";
  id: string;
}

/** Launcher → module: quit yourself (used by "Quit All"). */
export interface QuitMessage {
  type: "quit";
}

/**
 * Launcher → module: suite-only auto-suppress command. Sent to PopKey when a
 * sibling module (PopJot) starts/stops annotating. While suppressed the module
 * force-hides its overlay and defers the user's manual toggle requests; when it
 * clears, the module restores to the user's last manually-requested state.
 */
export interface SuppressMessage {
  type: "suppress";
  suppressed: boolean;
}

/** Everything a module may send up the pipe. */
export type ModuleToLauncher = StateMessage;
/** Everything the launcher may send down the pipe. */
export type LauncherToModule = ToggleMessage | ActionMessage | QuitMessage | SuppressMessage;

// ─── Newline-delimited JSON framing ─────────────────────────────────────
// A single socket carries many messages; frame each as one JSON object on its
// own line. Callers feed raw chunks into decodeFrames along with a persistent
// buffer and get back the completed messages plus the new buffer remainder.

/** Serialize a message to a single wire frame (JSON + trailing newline). */
export function encodeFrame(msg: ModuleToLauncher | LauncherToModule): string {
  return JSON.stringify(msg) + "\n";
}

/**
 * Split accumulated socket data into complete newline-delimited JSON messages.
 * Returns the parsed messages and whatever partial trailing text remains (to be
 * prepended to the next chunk). Malformed lines are skipped rather than thrown so
 * one bad frame can't kill a live connection.
 */
export function decodeFrames<T>(buffer: string, chunk: string): { messages: T[]; rest: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n");
  // The final element is an incomplete frame (no trailing newline yet).
  const rest = parts.pop() ?? "";
  const messages: T[] = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed frame; keep the connection alive.
    }
  }
  return { messages, rest };
}

// ─── Menu model (pure) ──────────────────────────────────────────────────
// Electron's Menu.buildFromTemplate accepts MenuItemConstructorOptions. We build
// that template shape here without importing electron, so the click callbacks are
// injected by the caller (the launcher) via the handlers argument. The returned
// objects use `click: () => handlers.X(appName, id)` closures.

/** Minimal structural mirror of Electron.MenuItemConstructorOptions we emit. */
export interface SuiteMenuItem {
  label?: string;
  type?: "separator" | "checkbox" | "normal";
  enabled?: boolean;
  checked?: boolean;
  click?: () => void;
  submenu?: SuiteMenuItem[];
}

/** Click handlers the launcher supplies; keyed by module appName. */
export interface SuiteTrayHandlers {
  onToggle(appName: string): void;
  onAction(appName: string, actionId: string): void;
  onQuitAll(): void;
}

/**
 * Build the unified tray menu template from the currently connected modules.
 *
 * Layout (top to bottom):
 *   - a disabled "PopSuite" title,
 *   - per module: a toggle item (checkbox reflecting `active`, label carrying the
 *     shortcut hint) followed by that module's extra actions in a submenu,
 *   - a global separator, then "Quit All".
 *
 * When no modules are connected we still return a coherent menu (title + a
 * disabled "No modules running" line + Quit All) so the icon is never dead.
 */
export function buildSuiteTrayMenu(
  modules: SuiteModuleState[],
  handlers: SuiteTrayHandlers
): SuiteMenuItem[] {
  const items: SuiteMenuItem[] = [{ label: "PopSuite", enabled: false }, { type: "separator" }];

  if (modules.length === 0) {
    items.push({ label: "No modules running", enabled: false });
  }

  // Stable ordering so the menu doesn't jump around as connections race in.
  const sorted = [...modules].sort((a, b) => a.appName.localeCompare(b.appName));

  for (const mod of sorted) {
    if (mod.canToggle) {
      const hint = mod.shortcuts.length ? `  (${mod.shortcuts.join(", ")})` : "";
      // While auto-suppressed by a sibling (PopJot annotating), flag it so the
      // user understands the overlay is hidden by the suite, not by them. The
      // checkbox still reflects their own requested `active` state, and toggling
      // is still relayed (the module defers it until suppression clears).
      const suffix = mod.autoSuppressed ? " (auto-hidden)" : "";
      const label =
        (mod.toggleLabel ?? `${mod.active ? "Disable" : "Enable"} ${mod.appName}`) + hint + suffix;
      items.push({
        label,
        type: "checkbox",
        checked: mod.active,
        click: () => handlers.onToggle(mod.appName),
      });
    } else {
      // No toggle: still show the module name as a heading so its actions group.
      items.push({ label: mod.appName, enabled: false });
    }

    // Extra actions (settings/about/...) grouped under the module's own submenu
    // to keep the top level short as more modules connect.
    if (mod.actions.length > 0) {
      items.push({
        label: `${mod.appName} Options`,
        submenu: mod.actions.map((action) => ({
          label: action.label,
          click: () => handlers.onAction(mod.appName, action.id),
        })),
      });
    }
  }

  items.push({ type: "separator" });
  items.push({ label: "Quit All", click: () => handlers.onQuitAll() });

  return items;
}
