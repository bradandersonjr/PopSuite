/**
 * useWordCapture — live caption / word-mode feature.
 *
 * STATUS: Disabled. All logic is preserved here for future integration.
 *
 * When active, consecutive typed characters accumulate into a single
 * badge that grows in place (instead of individual key badges). Supports
 * full character composition for the desktop (uiohook) path: Shift,
 * CapsLock, shifted symbols, numpad. The web/DOM path uses the browser's
 * already-composed event.key directly.
 *
 * ─── Re-integration checklist ───────────────────────────────────────
 * 1. Import useWordCapture + helpers in useInputCapture.ts.
 * 2. Pass setBadges, maxBadgesRef, colorIndexRef, badgeDurationRef.
 * 3. Desktop keydown: call wordCapture.handleDesktopKeyDown(data, heldModifiersRef).
 * 4. Desktop keyup:   call wordCapture.handleDesktopKeyUp(data, heldModifiersRef).
 * 5. DOM keydown:     call wordCapture.handleDOMKeyDown(e, heldModifiersRef).
 * 6. DOM keyup:       call wordCapture.handleDOMKeyUp(e, heldModifiersRef).
 * 7. clearAllHeld:    call wordCapture.clearCaption().
 * 8. Show word mode toggle in SystemTray (search "Word mode toggle" comment).
 *
 * Each handle* function returns true if it consumed the event (caller
 * should skip its own badge logic for that event).
 * ────────────────────────────────────────────────────────────────────
 */

import { useRef, useCallback } from "react";
import type { Badge, BadgeType } from "./useInputCapture";

// ─── Constants ───────────────────────────────────────────────────────────────

const WORD_MAX_CHARS = 36;

/** US-layout shifted symbols keyed by unshifted physical key name (uiohook). */
const SHIFT_MAP: Record<string, string> = {
  "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
  "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
  "-": "_", "=": "+", "[": "{", "]": "}", "\\": "|",
  ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?", "`": "~",
};

const NUMPAD_MAP: Record<string, string> = {
  Num0: "0", Num1: "1", Num2: "2", Num3: "3", Num4: "4",
  Num5: "5", Num6: "6", Num7: "7", Num8: "8", Num9: "9",
  "Num.": ".", "Num+": "+", "Num-": "-", "Num*": "*", "Num/": "/",
};

// ─── Helpers (exported so callers can use them if needed) ─────────────────────

/** Ctrl / Alt / Win turn keystrokes into commands rather than text. Shift does not. */
export function hasCommandModifier(mods: Set<string>): boolean {
  return mods.has("Ctrl") || mods.has("Alt") || mods.has("Win");
}

/**
 * Returns true when Shift should be suppressed (treated as a typing modifier
 * rather than a shortcut modifier). Only applies in word mode.
 */
export function shouldSilenceShift(heldMods: Set<string>): boolean {
  return !hasCommandModifier(heldMods);
}

/**
 * Convert a physical key name (uiohook / desktop path) into the character it
 * would type, or null for non-printable keys. The DOM path uses event.key directly.
 */
export function composeChar(key: string, shift: boolean, caps: boolean): string | null {
  if (key === "Space") return " ";
  if (key.length === 1) {
    if (/^[a-z]$/i.test(key)) {
      return (shift !== caps) ? key.toUpperCase() : key.toLowerCase();
    }
    if (shift && SHIFT_MAP[key]) return SHIFT_MAP[key];
    return key;
  }
  if (key in NUMPAD_MAP) return NUMPAD_MAP[key];
  return null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

let wordBadgeCounter = 0;
function nextWordId(): string { return `w${++wordBadgeCounter}`; }

export interface WordCaptureHandlers {
  /** True when word mode is active (read .current inside closures). */
  wordModeRef: React.MutableRefObject<boolean>;
  /** Desktop keydown — returns true if the event was consumed. */
  handleDesktopKeyDown: (
    key: string,
    isModifier: boolean,
    heldMods: Set<string>,
  ) => boolean;
  /** Desktop keyup — returns true if the modifier badge should be suppressed. */
  handleDesktopKeyUp: (key: string, isModifier: boolean, heldMods: Set<string>) => boolean;
  /** DOM keydown — returns true if the event was consumed. */
  handleDOMKeyDown: (e: KeyboardEvent, heldMods: Set<string>) => boolean;
  /** DOM keyup — returns true if the modifier badge should be suppressed. */
  handleDOMKeyUp: (modName: string, heldMods: Set<string>) => boolean;
  /** Call from clearAllHeld to flush any in-progress caption. */
  clearCaption: () => void;
}

export function useWordCapture(
  wordMode: boolean,
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>,
  maxBadgesRef: React.MutableRefObject<number>,
  colorIndexRef: React.MutableRefObject<number>,
  badgeDurationRef: React.MutableRefObject<number>,
): WordCaptureHandlers {
  const wordModeRef = useRef(wordMode);
  wordModeRef.current = wordMode;

  const capsLockRef = useRef(false);
  const wordBufferRef = useRef<string>("");
  const wordBadgeIdRef = useRef<string | null>(null);
  const wordBadgeColorRef = useRef<number>(0);
  const wordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitWord = useCallback(() => {
    if (wordTimerRef.current) { clearTimeout(wordTimerRef.current); wordTimerRef.current = null; }
    wordBufferRef.current = "";
    wordBadgeIdRef.current = null;
  }, []);

  const renderWord = useCallback(() => {
    const full = wordBufferRef.current;
    const existingId = wordBadgeIdRef.current;
    const badgeId = existingId ?? nextWordId();
    if (!existingId) {
      wordBadgeIdRef.current = badgeId;
      wordBadgeColorRef.current = colorIndexRef.current++;
    }
    const colorIdx = wordBadgeColorRef.current;
    const display = full.length > WORD_MAX_CHARS ? "…" + full.slice(-WORD_MAX_CHARS) : full;
    setBadges((prev) => {
      const filtered = existingId ? prev.filter((b) => b.id !== existingId) : prev;
      const badge: Badge = { id: badgeId, label: display, type: "key" as BadgeType, colorIndex: colorIdx, timestamp: Date.now() };
      return [...filtered.slice(-(maxBadgesRef.current - 1)), badge];
    });
    if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
    wordTimerRef.current = setTimeout(commitWord, badgeDurationRef.current);
  }, [commitWord, setBadges, maxBadgesRef, colorIndexRef, badgeDurationRef]);

  const appendToWord = useCallback((char: string) => {
    wordBufferRef.current += char;
    renderWord();
  }, [renderWord]);

  const backspaceWord = useCallback(() => {
    if (!wordBufferRef.current) return;
    wordBufferRef.current = wordBufferRef.current.slice(0, -1);
    if (!wordBufferRef.current) {
      const id = wordBadgeIdRef.current;
      if (wordTimerRef.current) { clearTimeout(wordTimerRef.current); wordTimerRef.current = null; }
      wordBadgeIdRef.current = null;
      if (id) setBadges((prev) => prev.filter((b) => b.id !== id));
      return;
    }
    renderWord();
  }, [renderWord, setBadges]);

  const clearCaption = useCallback(() => {
    if (wordBufferRef.current) commitWord();
  }, [commitWord]);

  const handleDesktopKeyDown = useCallback((
    key: string,
    isModifier: boolean,
    heldMods: Set<string>,
  ): boolean => {
    if (!wordModeRef.current) return false;

    if (key === "CapsLock") { capsLockRef.current = !capsLockRef.current; return true; }

    if (isModifier) {
      if (key === "Shift" && shouldSilenceShift(heldMods)) return true; // consume silently
      if (wordBufferRef.current) commitWord();
      return false; // let caller show modifier badge
    }

    if (!hasCommandModifier(heldMods)) {
      const ch = composeChar(key, heldMods.has("Shift"), capsLockRef.current);
      if (ch !== null) { appendToWord(ch); return true; }
      if (key === "Backspace" && wordBufferRef.current) { backspaceWord(); return true; }
      if (wordBufferRef.current) commitWord();
    }
    return false;
  }, [commitWord, appendToWord, backspaceWord]);

  const handleDesktopKeyUp = useCallback((
    key: string,
    isModifier: boolean,
    heldMods: Set<string>,
  ): boolean => {
    if (!wordModeRef.current || !isModifier) return false;
    return key === "Shift" && shouldSilenceShift(heldMods);
  }, []);

  const handleDOMKeyDown = useCallback((e: KeyboardEvent, heldMods: Set<string>): boolean => {
    if (!wordModeRef.current) return false;

    if (e.key === "Shift") {
      if (shouldSilenceShift(heldMods)) return true;
      if (wordBufferRef.current) commitWord();
      return false;
    }

    if (!hasCommandModifier(heldMods)) {
      if (e.key.length === 1) { appendToWord(e.key); return true; }
      if (e.key === "Backspace" && wordBufferRef.current) { backspaceWord(); return true; }
      if (wordBufferRef.current) commitWord();
    }
    return false;
  }, [commitWord, appendToWord, backspaceWord]);

  const handleDOMKeyUp = useCallback((modName: string, heldMods: Set<string>): boolean => {
    if (!wordModeRef.current) return false;
    return modName === "Shift" && shouldSilenceShift(heldMods);
  }, []);

  return { wordModeRef, handleDesktopKeyDown, handleDesktopKeyUp, handleDOMKeyDown, handleDOMKeyUp, clearCaption };
}
