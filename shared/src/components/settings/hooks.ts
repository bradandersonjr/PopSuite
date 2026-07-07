/**
 * Stateful settings-UI hooks shared by both apps' SystemTray components.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { hasNonModifierKey, formatHotkey, normalizeKey } from "@shared/lib/hotkeys";
import {
  getOpenAtLogin,
  isDesktop,
  setOpenAtLogin,
  type ShortcutUpdateResult,
} from "@shared/settings/renderer";

/** Open-at-login state, kept in sync with the main process and other windows. */
export function useOpenAtLogin(): { openAtLogin: boolean; toggleOpenAtLogin: () => void } {
  const [openAtLogin, setOpenAtLoginState] = useState(false);
  const desktop = isDesktop();

  useEffect(() => {
    if (!desktop) return;

    let mounted = true;
    void getOpenAtLogin().then((enabled) => {
      if (mounted) setOpenAtLoginState(enabled);
    });

    const unlisten = window.electronAPI?.onTrayMenuChange("tray-open-at-login", (enabled) => {
      setOpenAtLoginState(Boolean(enabled));
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [desktop]);

  const toggleOpenAtLogin = () => {
    const next = !openAtLogin;
    setOpenAtLoginState(next);
    if (desktop) setOpenAtLogin(next);
  };

  return { openAtLogin, toggleOpenAtLogin };
}

/**
 * Keyboard-shortcut recording state machine. Supports any number of named
 * shortcuts (PopJot records "main" and "persistent", PopKey just "main").
 *
 * While recording, keydown accumulates keys; the first keyup with a
 * non-modifier key held commits the combination via `commit`.
 */
export function useShortcutRecorder({
  enabled,
  commit,
}: {
  /** Listen for keys only when the settings UI is actually interactive. */
  enabled: boolean;
  /** Persist the recorded accelerator; resolve ok:false to surface an error. */
  commit: (kind: string, formatted: string) => Promise<ShortcutUpdateResult>;
}) {
  const [recordingKind, setRecordingKind] = useState<string | null>(null);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const activeKeysRef = useRef(new Set<string>());

  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  const startRecording = (kind: string) => {
    setShortcutError(null);
    setRecordingKind(kind);
    activeKeysRef.current = new Set();
    setActiveKeys(new Set());
  };

  const stopRecording = () => {
    setRecordingKind(null);
    activeKeysRef.current = new Set();
    setActiveKeys(new Set());
  };

  const persistShortcut = useCallback(
    async (kind: string, formatted: string) => {
      setShortcutError(null);
      const result = await commit(kind, formatted);
      if (!result.ok) {
        setShortcutError(result.error);
      }
    },
    [commit]
  );

  useEffect(() => {
    if (!enabled || recordingKind === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const next = new Set(activeKeysRef.current);
      next.add(normalizeKey(e.key));
      activeKeysRef.current = next;
      setActiveKeys(next);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const currentKeys = new Set(activeKeysRef.current);

      if (currentKeys.size > 0 && hasNonModifierKey(currentKeys)) {
        const formatted = formatHotkey(currentKeys);
        const kind = recordingKind;
        stopRecording();
        void persistShortcut(kind, formatted);
        return;
      }

      currentKeys.delete(normalizeKey(e.key));
      activeKeysRef.current = currentKeys;
      setActiveKeys(currentKeys);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, persistShortcut, recordingKind]);

  return { recordingKind, activeKeys, shortcutError, setShortcutError, startRecording };
}
