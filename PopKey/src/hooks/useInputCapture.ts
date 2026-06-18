import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@keys/store/useStore";
import {
  isDesktop,
  onInputKeyDown,
  onInputKeyUp,
  onInputClick,
  onInputWheel,
  onInputDrag,
  onInputDragMove,
  onInputFocusLost,
  onShortcutToggle,
} from "@keys/lib/platform";
import type { KeyEvent, ClickEvent, WheelEventData } from "@keys/lib/platform";

export type BadgeType = "key" | "combo" | "click" | "scroll" | "drag";

export interface Badge {
  id: string;
  label: string;
  type: BadgeType;
  colorIndex: number;
  timestamp: number;
}

export interface ClickRipple {
  id: string;
  button: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface ScrollEvent {
  id: string;
  direction: "up" | "down";
  x: number;
  y: number;
  timestamp: number;
  count: number;
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

const DOM_MODIFIER_MAP: Record<string, string> = {
  Control: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Meta: "Win",
};

// Display names that uiohook uses for modifier keys (from inputCapture.ts DISPLAY_NAMES).
// Used as a reliable fallback since the `data.modifier` boolean can be stale across IPC.
const MODIFIER_NAMES = new Set(["Ctrl", "Shift", "Alt", "Win"]);

let badgeCounter = 0;
function nextId(): string { return `b${++badgeCounter}`; }

/** 8-direction arrow from a drag delta vector (screen coords: +y = down). */
function dragDirectionArrow(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5  && angle <  22.5)  return "→";
  if (angle >=  22.5  && angle <  67.5)  return "↘";
  if (angle >=  67.5  && angle < 112.5)  return "↓";
  if (angle >= 112.5  && angle < 157.5)  return "↙";
  if (angle >=  157.5 || angle < -157.5) return "←";
  if (angle >= -157.5 && angle < -112.5) return "↖";
  if (angle >= -112.5 && angle <  -67.5) return "↑";
  return "↗";
}

/** Build a modifier list from OS-supplied event booleans (desktop/uiohook path). */
function modsFromEvent(e: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }): string[] {
  const mods: string[] = [];
  if (e.ctrlKey)  mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey)   mods.push("Alt");
  if (e.metaKey)  mods.push("Win");
  return mods;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInputCapture() {
  const {
    appEnabled,
    setAppEnabled,
    badgeDuration,
    maxBadges,
    keyboardEnabled,
    mouseEnabled,
    showMouseClicks,
    showScrollWheel,
    showKeyRepeat,
  } = useStore();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [clicks, setClicks]   = useState<ClickRipple[]>([]);
  const [scrolls, setScrolls] = useState<ScrollEvent[]>([]);

  const heldKeysRef      = useRef<Set<number>>(new Set());
  const heldModifiersRef = useRef<Set<string>>(new Set());
  const colorIndexRef    = useRef(0);
  const lastClickRef     = useRef<{ button: number; time: number } | null>(null);
  const modifierBadgeIdRef = useRef<string | null>(null);
  const maxBadgesRef     = useRef(maxBadges);
  maxBadgesRef.current   = maxBadges;
  const showKeyRepeatRef = useRef(showKeyRepeat);
  showKeyRepeatRef.current = showKeyRepeat;
  // Tracks the live badge for each held key so OS auto-repeats can bump a ×N count.
  // Keyed by uiohook keycode (desktop) or DOM `event.code` (web).
  const heldKeyBadgeRef = useRef<Map<string | number, { id: string; labelBase: string; count: number }>>(new Map());

  // Live drag badge tracking: keyed by button number
  type ActiveDrag = { id: string; colorIdx: number; labelBase: string; lastArrow: string };
  const activeDragRef = useRef<Map<number, ActiveDrag>>(new Map());

  // ─── Badge helpers ─────────────────────────────────────────────────────────

  const addBadge = useCallback((label: string, type: BadgeType) => {
    const now = Date.now();
    setBadges((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.label === label && last.type === type && now - last.timestamp < 400) {
          return [...prev.slice(0, -1), { ...last, timestamp: now }];
        }
      }
      return [...prev.slice(-(maxBadgesRef.current - 1)), {
        id: nextId(), label, type, colorIndex: colorIndexRef.current++, timestamp: now,
      }];
    });
  }, []);

  const showModifierBadge = useCallback(() => {
    const mods = Array.from(heldModifiersRef.current);
    if (mods.length === 0) return;
    const oldId = modifierBadgeIdRef.current;
    const newId = nextId();
    modifierBadgeIdRef.current = newId;
    setBadges((prev) => {
      const filtered = oldId ? prev.filter((b) => b.id !== oldId) : prev;
      return [...filtered.slice(-(maxBadgesRef.current - 1)), {
        id: newId, label: mods.join(" + "), type: "combo" as BadgeType,
        colorIndex: colorIndexRef.current++, timestamp: Date.now(),
      }];
    });
  }, []);

  const addBadgeWithMods = useCallback((base: string, type: BadgeType, explicitMods?: string[]) => {
    const oldModId = modifierBadgeIdRef.current;
    modifierBadgeIdRef.current = null;
    const mods  = explicitMods ?? Array.from(heldModifiersRef.current);
    const label = mods.length > 0 ? `${mods.join(" + ")} + ${base}` : base;
    const badgeType: BadgeType = mods.length > 0 ? "combo" : type;
    const now = Date.now();
    setBadges((prev) => {
      const filtered = oldModId ? prev.filter((b) => b.id !== oldModId) : prev;
      if (filtered.length > 0) {
        const last = filtered[filtered.length - 1];
        if (last.label === label && last.type === badgeType && now - last.timestamp < 400) {
          return [...filtered.slice(0, -1), { ...last, timestamp: now }];
        }
      }
      return [...filtered.slice(-(maxBadgesRef.current - 1)), {
        id: nextId(), label, type: badgeType, colorIndex: colorIndexRef.current++, timestamp: now,
      }];
    });
  }, []);

  // Like addBadgeWithMods, but records the resulting badge id keyed by the held
  // key so repeats can update it. Used for the keyboard (non-modifier) path.
  const pressKey = useCallback((keyId: string | number, base: string) => {
    const oldModId = modifierBadgeIdRef.current;
    modifierBadgeIdRef.current = null;
    const mods  = Array.from(heldModifiersRef.current);
    const label = mods.length > 0 ? `${mods.join(" + ")} + ${base}` : base;
    const type: BadgeType = mods.length > 0 ? "combo" : "key";
    const now = Date.now();
    setBadges((prev) => {
      const filtered = oldModId ? prev.filter((b) => b.id !== oldModId) : prev;
      const last = filtered[filtered.length - 1];
      if (last && last.label === label && last.type === type && now - last.timestamp < 400) {
        heldKeyBadgeRef.current.set(keyId, { id: last.id, labelBase: label, count: 1 });
        return [...filtered.slice(0, -1), { ...last, timestamp: now }];
      }
      const id = nextId();
      heldKeyBadgeRef.current.set(keyId, { id, labelBase: label, count: 1 });
      return [...filtered.slice(-(maxBadgesRef.current - 1)), {
        id, label, type, colorIndex: colorIndexRef.current++, timestamp: now,
      }];
    });
  }, []);

  // OS auto-repeat of a held key: bump its badge to "<label> ×N".
  const repeatKey = useCallback((keyId: string | number) => {
    const entry = heldKeyBadgeRef.current.get(keyId);
    if (!entry) return;
    entry.count += 1;
    const now = Date.now();
    setBadges((prev) =>
      prev.map((b) => (b.id === entry.id ? { ...b, label: `${entry.labelBase} ×${entry.count}`, timestamp: now } : b))
    );
  }, []);

  const removeModifierBadge = useCallback(() => {
    if (heldModifiersRef.current.size > 0) {
      showModifierBadge();
    } else {
      const id = modifierBadgeIdRef.current;
      modifierBadgeIdRef.current = null;
      if (id) setBadges((prev) => prev.filter((b) => b.id !== id));
    }
  }, [showModifierBadge]);

  // ─── Drag helpers ──────────────────────────────────────────────────────────

  const startDragBadge = useCallback((button: number, baseName: string, mods: string[], dx: number, dy: number) => {
    const oldModId = modifierBadgeIdRef.current;
    modifierBadgeIdRef.current = null;
    const arrow     = dragDirectionArrow(dx, dy);
    const labelBase = mods.length > 0 ? `${mods.join(" + ")} + ${baseName}` : baseName;
    const id        = nextId();
    const colorIdx  = colorIndexRef.current++;
    activeDragRef.current.set(button, { id, colorIdx, labelBase, lastArrow: arrow });
    setBadges((prev) => {
      const filtered = oldModId ? prev.filter((b) => b.id !== oldModId) : prev;
      return [...filtered.slice(-(maxBadgesRef.current - 1)), {
        id, label: `${labelBase} ${arrow}`, type: "drag" as BadgeType,
        colorIndex: colorIdx, timestamp: Date.now(),
      }];
    });
  }, []);

  const updateDragBadge = useCallback((button: number, dx: number, dy: number) => {
    const active = activeDragRef.current.get(button);
    if (!active) return;
    const arrow = dragDirectionArrow(dx, dy);
    if (arrow === active.lastArrow) return;
    active.lastArrow = arrow;
    setBadges((prev) => {
      const filtered = prev.filter((b) => b.id !== active.id);
      return [...filtered.slice(-(maxBadgesRef.current - 1)), {
        id: active.id, label: `${active.labelBase} ${arrow}`, type: "drag" as BadgeType,
        colorIndex: active.colorIdx, timestamp: Date.now(),
      }];
    });
  }, []);

  // ─── Focus / blur ──────────────────────────────────────────────────────────

  const clearAllHeld = useCallback(() => {
    heldKeysRef.current.clear();
    heldModifiersRef.current.clear();
    heldKeyBadgeRef.current.clear();
    activeDragRef.current.clear();
    const id = modifierBadgeIdRef.current;
    if (id) { modifierBadgeIdRef.current = null; setBadges((prev) => prev.filter((b) => b.id !== id)); }
    // Word mode integration point: wordCapture.clearCaption()
  }, []);

  // ─── Badge expiry ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (badges.length === 0) return;
    const oldest  = badges[0];
    const elapsed = Date.now() - oldest.timestamp;
    const wait    = Math.max(0, badgeDuration - elapsed);
    const timer   = setTimeout(() => {
      const now = Date.now();
      setBadges((prev) => prev.filter((b) => now - b.timestamp < badgeDuration));
      // Only clear the badge ID pointer — not heldModifiersRef. The physical key may
      // still be held; clearing the ref would silently break the next combo.
      const modId = modifierBadgeIdRef.current;
      if (modId && badges.find((b) => b.id === modId && now - b.timestamp >= badgeDuration)) {
        modifierBadgeIdRef.current = null;
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [badges, badgeDuration]);

  useEffect(() => {
    if (clicks.length === 0) return;
    const timer = setTimeout(() => setClicks((prev) => prev.filter((c) => Date.now() - c.timestamp < 600)), 600);
    return () => clearTimeout(timer);
  }, [clicks]);

  useEffect(() => {
    if (scrolls.length === 0) return;
    const timer = setTimeout(() => setScrolls((prev) => prev.filter((s) => Date.now() - s.timestamp < 400)), 400);
    return () => clearTimeout(timer);
  }, [scrolls]);

  // ─── Desktop: IPC-based input capture ─────────────────────────────────────

  useEffect(() => {
    if (!isDesktop()) return;
    const cleanups: (() => void)[] = [];

    // Desktop uses uiohook (global key capture) — window focus is irrelevant.
    // Only clear held state when the OS explicitly signals focus loss (Win/Meta key).
    cleanups.push(onInputFocusLost(clearAllHeld));
    cleanups.push(onShortcutToggle(() => setAppEnabled(!useStore.getState().appEnabled)));

    if (!appEnabled) return () => cleanups.forEach((fn) => fn());

    if (keyboardEnabled) {
      cleanups.push(onInputKeyDown((data: KeyEvent) => {
        const isMod = data.modifier || MODIFIER_NAMES.has(data.key);
        // Already held → this is an OS auto-repeat; optionally show a ×N counter.
        if (heldKeysRef.current.has(data.keycode)) {
          if (showKeyRepeatRef.current && !isMod) repeatKey(data.keycode);
          return;
        }
        heldKeysRef.current.add(data.keycode);
        // Word mode integration point: if (wordCapture.handleDesktopKeyDown(...)) return;
        if (isMod) {
          heldModifiersRef.current.add(data.key);
          showModifierBadge();
          return;
        }
        pressKey(data.keycode, data.key);
      }));

      cleanups.push(onInputKeyUp((data: KeyEvent) => {
        heldKeysRef.current.delete(data.keycode);
        heldKeyBadgeRef.current.delete(data.keycode);
        // Word mode integration point: if (wordCapture.handleDesktopKeyUp(...)) return;
        if (data.modifier || MODIFIER_NAMES.has(data.key)) {
          heldModifiersRef.current.delete(data.key);
          removeModifierBadge();
        }
      }));
    }

    if (mouseEnabled && showMouseClicks) {
      cleanups.push(onInputDrag((data: ClickEvent) => {
        const names: Record<number, string> = { 1: "Drag", 2: "Right Drag", 3: "Middle Drag" };
        startDragBadge(data.button, names[data.button] ?? "Drag", modsFromEvent(data), data.dx ?? 1, data.dy ?? 0);
      }));
      cleanups.push(onInputDragMove((data) => updateDragBadge(data.button, data.dx, data.dy)));

      cleanups.push(onInputClick((data: ClickEvent) => {
        const now = Date.now();
        const last = lastClickRef.current;
        const isDouble = last && last.button === data.button && now - last.time < 300;
        lastClickRef.current = { button: data.button, time: now };
        const names:  Record<number, string> = { 1: "Left Click",   2: "Right Click",        3: "Middle Click" };
        const dNames: Record<number, string> = { 1: "Double Click", 2: "Right Double Click",  3: "Middle Double Click" };
        const base = isDouble ? (dNames[data.button] ?? `Double Click ${data.button}`) : (names[data.button] ?? `Click ${data.button}`);
        addBadgeWithMods(base, "click", modsFromEvent(data));
        setClicks((prev) => [...prev.slice(-9), { id: nextId(), button: data.button, x: data.x, y: data.y, timestamp: now }]);
      }));
    }

    if (mouseEnabled && showScrollWheel) {
      cleanups.push(onInputWheel((data: WheelEventData) => {
        const now = Date.now();
        addBadge(`Scroll ${data.direction === "up" ? "Up" : "Down"}`, "scroll");
        setScrolls((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.direction === data.direction && now - last.timestamp < 400) {
            return [{ ...last, x: data.x, y: data.y, timestamp: now, count: Math.min(last.count + 1, 3) }];
          }
          return [{ id: nextId(), direction: data.direction, x: data.x, y: data.y, timestamp: now, count: 1 }];
        });
      }));
    }

    return () => cleanups.forEach((fn) => fn());
  }, [appEnabled, keyboardEnabled, mouseEnabled, showMouseClicks, showScrollWheel,
      addBadge, addBadgeWithMods, pressKey, repeatKey, startDragBadge, updateDragBadge,
      showModifierBadge, removeModifierBadge, setAppEnabled, clearAllHeld]);

  // ─── Web / Extension: DOM-based fallback ──────────────────────────────────

  useEffect(() => {
    if (isDesktop()) return;
    if (!appEnabled) return;
    const cleanups: (() => void)[] = [];

    window.addEventListener("blur", clearAllHeld);
    cleanups.push(() => window.removeEventListener("blur", clearAllHeld));

    if (keyboardEnabled) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const modName = DOM_MODIFIER_MAP[e.key];
        if (modName) {
          if (heldModifiersRef.current.has(modName)) return;
          heldModifiersRef.current.add(modName);
          // Word mode integration point: if (wordCapture.handleDOMKeyDown(...)) return;
          showModifierBadge();
          return;
        }
        // Browser auto-repeat → optional ×N counter on the held key's badge.
        if (e.repeat) {
          if (showKeyRepeatRef.current) repeatKey(e.code);
          return;
        }
        // Word mode integration point: if (wordCapture.handleDOMKeyDown(...)) return;
        pressKey(e.code, e.key.length === 1 ? e.key.toUpperCase() : e.key);
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const modName = DOM_MODIFIER_MAP[e.key];
        if (modName) {
          heldModifiersRef.current.delete(modName);
          // Word mode integration point: if (wordCapture.handleDOMKeyUp(...)) return;
          removeModifierBadge();
          return;
        }
        heldKeyBadgeRef.current.delete(e.code);
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup",   handleKeyUp);
      cleanups.push(() => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup",   handleKeyUp);
      });
    }

    if (mouseEnabled && showMouseClicks) {
      const DOM_DRAG_THRESHOLD = 8;
      let dragOrigin: { x: number; y: number; button: number } | null = null;
      let didDrag = false;

      const handleMouseDown = (e: MouseEvent) => { dragOrigin = { x: e.clientX, y: e.clientY, button: e.button }; didDrag = false; };
      const handleMouseMove = (e: MouseEvent) => {
        if (!dragOrigin) return;
        const dx = e.clientX - dragOrigin.x;
        const dy = e.clientY - dragOrigin.y;
        if (!didDrag) {
          if (Math.sqrt(dx * dx + dy * dy) >= DOM_DRAG_THRESHOLD) {
            didDrag = true;
            const names: Record<number, string> = { 0: "Drag", 2: "Right Drag", 1: "Middle Drag" };
            startDragBadge(dragOrigin.button, names[dragOrigin.button] ?? "Drag", Array.from(heldModifiersRef.current), dx, dy);
          }
        } else {
          updateDragBadge(dragOrigin.button, dx, dy);
        }
      };
      const handleMouseUp = () => { if (dragOrigin) activeDragRef.current.delete(dragOrigin.button); dragOrigin = null; };
      const handleClick = (e: MouseEvent) => {
        if (didDrag) { didDrag = false; return; }
        const names: Record<number, string> = { 0: "Left Click", 1: "Middle Click", 2: "Right Click" };
        addBadgeWithMods(names[e.button] ?? "Click", "click");
        setClicks((prev) => [...prev.slice(-9), { id: nextId(), button: e.button, x: e.clientX, y: e.clientY, timestamp: Date.now() }]);
      };
      const handleDblClick = (e: MouseEvent) => {
        if (didDrag) return;
        const names: Record<number, string> = { 0: "Double Click", 1: "Middle Double Click", 2: "Right Double Click" };
        addBadgeWithMods(names[e.button] ?? "Double Click", "click");
      };

      window.addEventListener("mousedown",  handleMouseDown);
      window.addEventListener("mousemove",  handleMouseMove);
      window.addEventListener("mouseup",    handleMouseUp);
      window.addEventListener("click",      handleClick);
      window.addEventListener("dblclick",   handleDblClick);
      cleanups.push(() => {
        window.removeEventListener("mousedown",  handleMouseDown);
        window.removeEventListener("mousemove",  handleMouseMove);
        window.removeEventListener("mouseup",    handleMouseUp);
        window.removeEventListener("click",      handleClick);
        window.removeEventListener("dblclick",   handleDblClick);
      });
    }

    if (mouseEnabled && showScrollWheel) {
      const handleWheel = (e: globalThis.WheelEvent) => {
        const now = Date.now();
        const direction = e.deltaY > 0 ? "down" : "up";
        addBadge(`Scroll ${direction === "up" ? "Up" : "Down"}`, "scroll");
        setScrolls((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.direction === direction && now - last.timestamp < 400) {
            return [{ ...last, x: e.clientX, y: e.clientY, timestamp: now, count: Math.min(last.count + 1, 3) }];
          }
          return [{ id: nextId(), direction, x: e.clientX, y: e.clientY, timestamp: now, count: 1 }];
        });
      };
      window.addEventListener("wheel", handleWheel, { passive: true });
      cleanups.push(() => window.removeEventListener("wheel", handleWheel));
    }

    return () => cleanups.forEach((fn) => fn());
  }, [appEnabled, keyboardEnabled, mouseEnabled, showMouseClicks, showScrollWheel,
      addBadge, addBadgeWithMods, pressKey, repeatKey, startDragBadge, updateDragBadge,
      showModifierBadge, removeModifierBadge, clearAllHeld]);

  return { badges, clicks, scrolls };
}
