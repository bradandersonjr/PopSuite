import { uIOhook, UiohookKey } from "uiohook-napi";
import { BrowserWindow } from "electron";

// Build reverse map: keycode number → display name
const KEYCODE_TO_NAME: Record<number, string> = {};
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code === "number") {
    // Convert enum name to readable form: "ShiftLeft" → "Shift", "Ctrl" → "Ctrl", etc.
    KEYCODE_TO_NAME[code] = name;
  }
}

// Platform-appropriate label for the Meta/OS key: "Cmd" on macOS, "Super" on
// Linux (X11/desktop convention), "Win" on Windows.
const META_KEY_LABEL =
  process.platform === "darwin" ? "Cmd" : process.platform === "linux" ? "Super" : "Win";

// Friendly display overrides
const DISPLAY_NAMES: Record<string, string> = {
  Space: "Space",
  Backspace: "Backspace",
  Tab: "Tab",
  Enter: "Enter",
  Escape: "Esc",
  Delete: "Del",
  Insert: "Ins",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  CapsLock: "CapsLock",
  NumLock: "NumLock",
  ScrollLock: "ScrollLock",
  PrintScreen: "PrtSc",
  Pause: "Pause",
  ContextMenu: "Menu",
  // Modifiers
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  CtrlLeft: "Ctrl",
  CtrlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: META_KEY_LABEL,
  MetaRight: META_KEY_LABEL,
  // Number keys
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
  "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
  // Function keys
  F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  F13: "F13", F14: "F14", F15: "F15", F16: "F16", F17: "F17", F18: "F18",
  F19: "F19", F20: "F20", F21: "F21", F22: "F22", F23: "F23", F24: "F24",
  // Punctuation
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  // Numpad
  Numpad0: "Num0", Numpad1: "Num1", Numpad2: "Num2", Numpad3: "Num3",
  Numpad4: "Num4", Numpad5: "Num5", Numpad6: "Num6", Numpad7: "Num7",
  Numpad8: "Num8", Numpad9: "Num9",
  NumpadMultiply: "Num*",
  NumpadAdd: "Num+",
  NumpadSubtract: "Num-",
  NumpadDecimal: "Num.",
  NumpadDivide: "Num/",
  NumpadEnter: "NumEnter",
};

const MODIFIER_KEYS = new Set([
  "ShiftLeft", "ShiftRight", "CtrlLeft", "CtrlRight",
  "AltLeft", "AltRight", "MetaLeft", "MetaRight",
]);

function getKeyName(keycode: number): string {
  const rawName = KEYCODE_TO_NAME[keycode] ?? `Key${keycode}`;
  return DISPLAY_NAMES[rawName] ?? rawName;
}

function isModifier(keycode: number): boolean {
  const rawName = KEYCODE_TO_NAME[keycode] ?? "";
  return MODIFIER_KEYS.has(rawName);
}

const DRAG_THRESHOLD = 8; // pixels — below this is a click, above is a drag

// Map dx/dy to one of 8 sectors (0–7) for direction-change dedup
function dirSector(dx: number, dy: number): number {
  return Math.floor(((Math.atan2(dy, dx) * (180 / Math.PI) + 202.5) % 360) / 45);
}

export function startInputCapture(getWindows: () => BrowserWindow[]): void {
  // Track per-button mousedown position to detect drags in real-time
  const downPos: Record<number, { x: number; y: number }> = {};
  const wasDrag = new Set<number>(); // buttons currently dragging
  const dragEmitted = new Set<number>(); // buttons that already emitted a drag badge
  const lastDragSector: Record<number, number> = {}; // last emitted direction sector per button

  uIOhook.on("mousedown", (e) => {
    const button = Number(e.button); // uiohook-napi types button as unknown
    downPos[button] = { x: e.x, y: e.y };
    wasDrag.delete(button);
    dragEmitted.delete(button);
    delete lastDragSector[button];
  });

  uIOhook.on("mousemove", (e) => {
    for (const [btn, down] of Object.entries(downPos)) {
      const button = Number(btn);
      const dx = e.x - down.x;
      const dy = e.y - down.y;

      if (!dragEmitted.has(button)) {
        // Not yet dragging — check threshold
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          wasDrag.add(button);
          dragEmitted.add(button);
          lastDragSector[button] = dirSector(dx, dy);
          for (const win of getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send("input:drag", {
                button,
                x: e.x,
                y: e.y,
                dx,
                dy,
                time: Date.now(),
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
              });
            }
          }
        }
      } else {
        // Already dragging — send direction update only when sector changes
        const sector = dirSector(dx, dy);
        if (sector !== lastDragSector[button]) {
          lastDragSector[button] = sector;
          for (const win of getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send("input:dragmove", { button, dx, dy });
            }
          }
        }
      }
    }
  });

  uIOhook.on("mouseup", (e) => {
    const button = Number(e.button);
    delete downPos[button];
    delete lastDragSector[button];
    dragEmitted.delete(button);
  });

  // Win key keycodes — pressing Win always causes the OS to steal focus
  const WIN_KEYCODES = new Set<number>([UiohookKey.Meta, UiohookKey.MetaRight]);

  uIOhook.on("keydown", (e) => {
    const key = getKeyName(e.keycode);
    const modifier = isModifier(e.keycode);
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:keydown", {
          key,
          keycode: e.keycode,
          modifier,
          time: Date.now(),
        });
      }
    }

    // Windows-only: pressing the Win key opens the Start menu and steals focus,
    // so we clear all held state in the renderer after a short delay. On macOS,
    // Cmd is the primary chord modifier — clearing here would wipe held state
    // mid-chord — so this behavior is gated to win32.
    if (process.platform === "win32" && WIN_KEYCODES.has(e.keycode)) {
      setTimeout(() => {
        for (const win of getWindows()) {
          if (!win.isDestroyed()) win.webContents.send("input:focus-lost");
        }
      }, 200);
    }
  });

  uIOhook.on("keyup", (e) => {
    const key = getKeyName(e.keycode);
    const modifier = isModifier(e.keycode);
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:keyup", {
          key,
          keycode: e.keycode,
          modifier,
          time: Date.now(),
        });
      }
    }
  });

  uIOhook.on("click", (e) => {
    const button = Number(e.button);
    if (wasDrag.has(button)) {
      wasDrag.delete(button);
      return;
    }
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:click", {
          button, // 1=left, 2=right, 3=middle
          x: e.x,
          y: e.y,
          time: Date.now(),
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        });
      }
    }
  });

  uIOhook.on("wheel", (e) => {
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:wheel", {
          direction: e.rotation > 0 ? "down" : "up",
          x: e.x,
          y: e.y,
          amount: Math.abs(e.rotation),
          time: Date.now(),
        });
      }
    }
  });

  try {
    uIOhook.start();
  } catch (err) {
    // A native hook failure (missing macOS permission, Wayland session on Linux,
    // etc.) must not crash the main process — the rest of the app stays usable.
    console.error(`Failed to start input capture (uIOhook): ${String(err)}`);
  }
}

export function stopInputCapture(): void {
  uIOhook.stop();
}
