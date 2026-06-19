import { useEffect, useState } from "react";
import {
  getSyncPrefs,
  onSyncPrefsChanged,
  setSyncAll,
  setSyncPref,
  isDesktop,
} from "../settings/renderer";

/**
 * Reads and mutates the cross-app sync toggle map. The map lives in the shared
 * settings file, so `onSyncPrefsChanged` fires when either this app or the
 * sibling app flips a toggle — keeping the Sync tab live-linked between them.
 */
export function useSyncPrefs(): {
  prefs: Record<string, boolean>;
  setPref: (key: string, enabled: boolean) => void;
  setAll: (enabled: boolean) => void;
} {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isDesktop()) return;
    let active = true;
    void getSyncPrefs().then((p) => {
      if (active) setPrefs(p);
    });
    const unsub = onSyncPrefsChanged((p) => setPrefs(p));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return {
    prefs,
    // Optimistically update locally; the main process echoes the authoritative
    // map back via onSyncPrefsChanged.
    setPref: (key, enabled) => {
      setSyncPref(key, enabled);
      setPrefs((p) => ({ ...p, [key]: enabled }));
    },
    setAll: (enabled) => {
      setSyncAll(enabled);
      setPrefs((p) => {
        const next = { ...p };
        for (const k of Object.keys(next)) next[k] = enabled;
        return next;
      });
    },
  };
}
