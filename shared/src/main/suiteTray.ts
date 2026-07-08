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

/** A settings-window rectangle carried across the pipe during a tab swap. */
export interface SuiteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Launcher → module: open (or focus) your settings window at exactly these
 * bounds. Sent when the user clicks the sibling's tab in the shared settings
 * app-switcher: the requesting module hands its current window rect up to the
 * launcher, which relays it here so the arriving window lands in the same spot
 * and size, producing the "one window that swaps content" illusion.
 */
export interface OpenSettingsMessage {
  type: "openSettings";
  bounds: SuiteBounds;
}

/**
 * Module → launcher: please tell the sibling module to open ITS settings window
 * at these bounds (the tab-swap request). `target` is the sibling's appName. If
 * the target isn't connected the launcher no-ops and the requester keeps its own
 * window open, so the user is never left with zero settings windows.
 */
export interface RequestSiblingSettingsMessage {
  type: "requestSiblingSettings";
  target: string;
  bounds: SuiteBounds;
}

/**
 * Launcher → module: the result of this module's tab-swap request. `delivered`
 * is true when the sibling was connected and got the openSettings command (the
 * requester may now hide its own window), false when the sibling wasn't running
 * so the launcher dropped it (the requester MUST keep its window — never zero
 * settings windows). `target` echoes the requested sibling so a stale ack can't
 * be misapplied.
 */
export interface SiblingSettingsResultMessage {
  type: "siblingSettingsResult";
  target: string;
  delivered: boolean;
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
export type ModuleToLauncher = StateMessage | RequestSiblingSettingsMessage;
/** Everything the launcher may send down the pipe. */
export type LauncherToModule =
  | ToggleMessage
  | ActionMessage
  | QuitMessage
  | SuppressMessage
  | OpenSettingsMessage
  | SiblingSettingsResultMessage;

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

// ─── Settings-swap bounds clamp (pure) ──────────────────────────────────
// A swapped-in settings window inherits the requesting window's rect. A rect
// coming off a display that no longer exists (monitor unplugged between the two
// modules opening) could strand the arriving window off every screen. Clamp it
// so its top-left always lands inside some display's work area, keeping the
// window title bar reachable. Kept Electron-free (plain rects) for unit testing;
// createPopApp feeds it screen.getAllDisplays().workArea.

/** Minimal rectangle mirror of an Electron display's workArea. */
export interface DisplayArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clamp `bounds` so its origin sits within a visible display's work area. If the
 * origin already falls inside any display it is returned unchanged; otherwise it
 * is nudged onto the nearest display (by clamping to the display whose center is
 * closest), preserving width/height. With no displays supplied the bounds pass
 * through untouched (Electron will place the window on the primary display).
 */
export function clampBoundsToDisplays(bounds: SuiteBounds, displays: DisplayArea[]): SuiteBounds {
  if (displays.length === 0) return bounds;

  const originInside = displays.some(
    (d) =>
      bounds.x >= d.x &&
      bounds.x < d.x + d.width &&
      bounds.y >= d.y &&
      bounds.y < d.y + d.height
  );
  if (originInside) return bounds;

  // Pick the display whose center is nearest the window's origin, then clamp the
  // origin into that display's work area so the title bar is always on-screen.
  let best = displays[0];
  let bestDist = Infinity;
  for (const d of displays) {
    const cx = d.x + d.width / 2;
    const cy = d.y + d.height / 2;
    const dist = (cx - bounds.x) ** 2 + (cy - bounds.y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  const clampAxis = (value: number, min: number, size: number): number =>
    Math.max(min, Math.min(value, min + Math.max(size - 1, 0)));

  return {
    x: clampAxis(bounds.x, best.x, best.width),
    y: clampAxis(bounds.y, best.y, best.height),
    width: bounds.width,
    height: bounds.height,
  };
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

/** Suite-wide external links, always shown regardless of connected modules. */
export const SUITE_CHANGELOG_URL = "https://popjot.app/changelog";
export const SUITE_DOCS_URL = "https://popjot.app/docs";

/** Action ids modules honor for the Edit Settings picker (mirror createPopApp). */
export const SUITE_ACTION_SETTINGS = "settings";
export const SUITE_ACTION_ABOUT = "about";

/** Click handlers the launcher supplies. Toggle/action are per-module relays;
 *  login toggle and link opens are launcher-local (no pipe round-trip). */
export interface SuiteTrayHandlers {
  onToggle(appName: string): void;
  onAction(appName: string, actionId: string): void;
  /** Toggle whether the launcher (PopSuite.exe) is registered to run at login. */
  onOpenAtLoginToggle(): void;
  /** Open an external URL in the default browser (Changelog / Documentation). */
  onOpenLink(url: string): void;
  /** Show the single suite-level About dialog (launcher-local, suite version). */
  onAbout(): void;
  /** Trigger an immediate manual update check (launcher-local, no pipe). */
  onCheckForUpdates(): void;
  /**
   * Install a downloaded update: quit the modules, then quitAndInstall. Only
   * wired when an update is staged (options.updateReady is set).
   */
  onInstallUpdate(): void;
  onQuitAll(): void;
}

/** Extra inputs to the menu builder beyond the connected-module list. */
export interface SuiteTrayMenuOptions {
  /** Current launcher open-at-login state; drives the checkbox in the submenu. */
  launcherOpenAtLogin: boolean;
  /**
   * Set when an update has downloaded and is ready to install; renders a
   * "Restart to Update (version)" item near Quit. Absent when no update is
   * staged (dev, offline, already current, or still downloading).
   */
  updateReady?: { version: string };
}

/**
 * Build the unified tray menu template from the currently connected modules.
 *
 * Layout (top to bottom):
 *   - a disabled "PopSuite" title,
 *   - a flat toggle checkbox per connected module (reflecting `active`, label
 *     carrying the shortcut hint and any "(auto-hidden)" suppression suffix),
 *   - an "Edit Settings" picker submenu with per-module Settings entries,
 *   - a single "About PopSuite" item (one product, suite version),
 *   - a "Launch Preferences" submenu holding the "Open PopSuite at Login" toggle
 *     and a manual "Check for Updates" item,
 *   - suite-wide "Changelog" / "Documentation" links,
 *   - an optional "Restart to Update (version)" item when an update is staged,
 *   - "Quit PopSuite".
 *
 * The module-dependent section (toggles + Edit Settings) collapses to a disabled
 * "No modules running" line when nothing has connected yet; the launcher-local
 * items (Launch Preferences, links, Quit) are always shown so the icon is never
 * dead and those capabilities never depend on a module being up.
 */
export function buildSuiteTrayMenu(
  modules: SuiteModuleState[],
  handlers: SuiteTrayHandlers,
  options: SuiteTrayMenuOptions
): SuiteMenuItem[] {
  const items: SuiteMenuItem[] = [{ label: "PopSuite", enabled: false }, { type: "separator" }];

  // Stable ordering so the menu doesn't jump around as connections race in.
  const sorted = [...modules].sort((a, b) => a.appName.localeCompare(b.appName));

  if (sorted.length === 0) {
    items.push({ label: "No modules running", enabled: false });
  }

  // Flat toggles: one checkbox per module directly under the title.
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
      // No toggle: still show the module name as a heading so it isn't lost.
      items.push({ label: mod.appName, enabled: false });
    }
  }

  // Edit Settings picker: one submenu that lists each module's Settings entry
  // so the user picks which module's window to open. Reuses the existing
  // per-module action relay (SUITE_ACTION_SETTINGS). About is deliberately
  // omitted here — the suite presents a single product-level "About PopSuite"
  // below instead of one About per module (the modules still report their About
  // action for their own standalone trays; we just don't surface it in the
  // unified picker). Only shown when at least one module exposes a Settings action.
  const editSettings: SuiteMenuItem[] = [];
  for (const mod of sorted) {
    for (const action of mod.actions) {
      if (action.id === SUITE_ACTION_ABOUT) continue;
      editSettings.push({
        label: `${mod.appName} ${action.label}`,
        click: () => handlers.onAction(mod.appName, action.id),
      });
    }
  }
  if (editSettings.length > 0) {
    items.push({ label: "Edit Settings", submenu: editSettings });
  }

  // Single product-level About: one "About PopSuite" for the whole suite,
  // launcher-local (shows the suite's own version), never per module. Always
  // shown — it's about the product, not a connected module.
  items.push({ label: "About PopSuite", click: () => handlers.onAbout() });

  // ─── Launcher-local items (never depend on a connected module) ─────────
  items.push({ type: "separator" });
  items.push({
    label: "Launch Preferences",
    submenu: [
      {
        label: "Open PopSuite at Login",
        type: "checkbox",
        checked: options.launcherOpenAtLogin,
        click: () => handlers.onOpenAtLoginToggle(),
      },
      { type: "separator" },
      // Manual update check. The silent auto-check runs on its own cadence; this
      // lets the user force one and get a "you're on the latest version" reply.
      { label: "Check for Updates", click: () => handlers.onCheckForUpdates() },
    ],
  });

  items.push({ type: "separator" });
  items.push({ label: "Changelog", click: () => handlers.onOpenLink(SUITE_CHANGELOG_URL) });
  items.push({ label: "Documentation", click: () => handlers.onOpenLink(SUITE_DOCS_URL) });

  items.push({ type: "separator" });
  // A staged update surfaces as a restart item directly above Quit, so the two
  // "app lifecycle" actions sit together. Only present once the download is ready.
  if (options.updateReady) {
    items.push({
      label: `Restart to Update (${options.updateReady.version})`,
      click: () => handlers.onInstallUpdate(),
    });
  }
  items.push({ label: "Quit PopSuite", click: () => handlers.onQuitAll() });

  return items;
}
