/**
 * Hold-to-draw release detection for momentary annotation sessions.
 *
 * The drawing overlay is non-focusable (see createPopApp's `focusable: false`):
 * activating it would tear down the transient UI of the app being annotated —
 * Fusion 360's menus, submenus and tooltips all close the instant another window
 * takes the foreground, which is exactly the thing users want to draw on. The
 * cost is that the overlay's renderer never receives key events, so it cannot
 * see the user let go of the hotkey's modifiers and end the session. That
 * detection moves here, onto the global input hook.
 *
 * Note: importing this module pulls in uiohook-napi (a native module), same as
 * PopKey's inputCapture.ts and spotlightScroll.ts. Like spotlightScroll (and
 * unlike PopKey, which needs the hook for its whole lifetime), the hook is only
 * started while a momentary session is active and stopped the moment it ends, to
 * keep the "only cost while active" property.
 *
 * Escape-to-exit is deliberately NOT handled here — it uses globalShortcut in
 * register.ts, mirroring spotlight. See the comment there for why.
 */

import { UiohookKey } from "uiohook-napi";
import {
  acquireGlobalInputHook,
  releaseGlobalInputHook,
  uIOhook,
} from "@shared/main/globalInputHook";

/**
 * Electron accelerator modifier token → the uiohook keycodes that satisfy it.
 * Both the left and right physical key count: the OS accepts either for the
 * accelerator, so a session started with right-Shift must end on right-Shift's
 * release. Aliases mirror Electron's own accelerator vocabulary, so a rebind
 * expressed as "CommandOrControl+Alt+P" resolves the same way the registration
 * did.
 */
const MODIFIER_KEYCODES: Record<string, readonly number[]> = {
  shift: [UiohookKey.Shift, UiohookKey.ShiftRight],
  alt: [UiohookKey.Alt, UiohookKey.AltRight],
  option: [UiohookKey.Alt, UiohookKey.AltRight],
  altgr: [UiohookKey.AltRight],
  control: [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  ctrl: [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  command: [UiohookKey.Meta, UiohookKey.MetaRight],
  cmd: [UiohookKey.Meta, UiohookKey.MetaRight],
  super: [UiohookKey.Meta, UiohookKey.MetaRight],
  meta: [UiohookKey.Meta, UiohookKey.MetaRight],
  // Electron resolves these per-platform at registration time; resolve them the
  // same way so the keys we watch are the keys the user actually pressed.
  commandorcontrol:
    process.platform === "darwin"
      ? [UiohookKey.Meta, UiohookKey.MetaRight]
      : [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  cmdorctrl:
    process.platform === "darwin"
      ? [UiohookKey.Meta, UiohookKey.MetaRight]
      : [UiohookKey.Ctrl, UiohookKey.CtrlRight],
};

/**
 * Modifier keycode groups for an Electron accelerator, one group per modifier
 * token (e.g. "Alt+Shift+A" → [[Alt, AltRight], [Shift, ShiftRight]]). The
 * accelerator's non-modifier key ("A") is intentionally ignored: hold-to-draw
 * ends when the user lets go of the chord's modifiers, and users routinely
 * release the letter first while keeping Alt+Shift down to keep drawing.
 *
 * Exported for tests — this is the piece that has to stay correct across
 * rebinds, since the shortcut is user-configurable and persists.
 */
export function acceleratorModifierGroups(accelerator: string): number[][] {
  const groups: number[][] = [];
  for (const raw of accelerator.split("+")) {
    const codes = MODIFIER_KEYCODES[raw.trim().toLowerCase()];
    if (codes) groups.push([...codes]);
  }
  return groups;
}

let modifierGroups: number[][] = [];
// Groups still considered held. A group is only removed once a key in it goes up
// with no other key in that group observed down.
//
// The hook starts AFTER the accelerator fired, so it never saw the chord's
// keydowns — which is why held-ness is tracked per GROUP (satisfied on the first
// keyup) rather than per keycode: seeding every keycode as down would leave the
// unused twin (e.g. right Shift when the user pressed left) permanently "held"
// and the session could never end. `down` holds only keycodes we actually saw
// pressed, which is what distinguishes "the other twin is genuinely still held"
// from "the other twin was never touched".
let heldGroups: number[][] = [];
const down = new Set<number>();
let onAllReleased: (() => void) | null = null;
let hookStarted = false;

function handleKeyDown(e: { keycode: number }): void {
  down.add(e.keycode);
  // Re-pressing a modifier we'd already counted as released puts it back in play
  // (e.g. letting go of Shift and grabbing it again without leaving the chord).
  for (const group of modifierGroups) {
    if (group.includes(e.keycode) && !heldGroups.includes(group)) heldGroups.push(group);
  }
}

function handleKeyUp(e: { keycode: number }): void {
  if (!onAllReleased) return;
  down.delete(e.keycode);
  heldGroups = heldGroups.filter(
    (group) =>
      !group.includes(e.keycode) || group.some((code) => down.has(code))
  );
  if (heldGroups.length > 0) return;
  const fire = onAllReleased;
  // Stop first: the callback deactivates the session, and re-entering stop()
  // from inside it must be a no-op rather than a double hook release.
  stopAnnotationKeys();
  fire();
}

/**
 * Start watching for the release of `accelerator`'s modifiers. Fires `callback`
 * once, when they are all up, then stops itself.
 *
 * `accelerator` must be the LIVE accelerator for the shortcut that started the
 * session (ctx.getShortcut), never a hardcoded default — the shortcut is
 * rebindable and the rebind persists, so a session started with a custom chord
 * has to end on that chord's modifiers.
 *
 * A modifier-less accelerator (e.g. a bare "F8") has nothing to release, so it
 * would never fire; such a session is left for Escape or the tray to end rather
 * than deactivating on the first stray keyup.
 */
export function startAnnotationKeys(accelerator: string, callback: () => void): void {
  stopAnnotationKeys();

  const groups = acceleratorModifierGroups(accelerator);
  if (groups.length === 0) return;

  modifierGroups = groups;
  // Every group starts held: the accelerator just fired, so the user is holding
  // one key from each of them right now.
  heldGroups = [...groups];
  down.clear();
  onAllReleased = callback;

  uIOhook.on("keydown", handleKeyDown);
  uIOhook.on("keyup", handleKeyUp);
  if (acquireGlobalInputHook()) {
    hookStarted = true;
    return;
  }

  // A native hook failure (missing macOS permission, Wayland session on Linux,
  // etc.) must not crash the main process. Drawing still works and Escape and
  // the tray still end the session — it just won't end on modifier release.
  uIOhook.removeListener("keydown", handleKeyDown);
  uIOhook.removeListener("keyup", handleKeyUp);
  modifierGroups = [];
  heldGroups = [];
  onAllReleased = null;
  console.error("Failed to start annotation key capture (uIOhook).");
}

/** Stop watching and drop all per-session state. Safe to call when not running. */
export function stopAnnotationKeys(): void {
  modifierGroups = [];
  heldGroups = [];
  down.clear();
  onAllReleased = null;
  if (!hookStarted) return;
  uIOhook.removeListener("keydown", handleKeyDown);
  uIOhook.removeListener("keyup", handleKeyUp);
  releaseGlobalInputHook();
  hookStarted = false;
}
