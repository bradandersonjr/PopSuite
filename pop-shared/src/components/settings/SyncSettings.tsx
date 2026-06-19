/**
 * Cross-app settings sync controls — shared by both apps' Sync tab.
 *
 * Lists every setting that exists in both PopKey and PopJot with a per-key
 * toggle, plus Sync All / Sync None. Toggles are stored in the shared settings
 * file, so flipping one here updates the sibling app's Sync tab live (and vice
 * versa). Enabling a key makes both apps adopt this app's current value.
 */

import { Check, X } from "lucide-react";
import type { SettingsSchema } from "../../settings/schema";
import { syncableKeysFor } from "../../settings/syncable";
import { isDesktop } from "../../settings/renderer";
import { useSyncPrefs } from "../../hooks/useSyncPrefs";
import { ToggleRow, useSettingsUI } from "./primitives";

export function SyncSettings({ schema }: { schema: SettingsSchema }) {
  const { palette } = useSettingsUI();
  const { prefs, setPref, setAll } = useSyncPrefs();
  const keys = syncableKeysFor(schema as Record<string, unknown>);

  if (!isDesktop()) {
    return (
      <p className="text-xs" style={{ color: palette.muted }}>
        Settings sync is available in the desktop app.
      </p>
    );
  }

  const allOn = keys.length > 0 && keys.every((k) => prefs[k.key]);
  const allOff = keys.every((k) => !prefs[k.key]);
  const btnClass =
    "flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-default";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAll(true)}
          disabled={allOn}
          className={btnClass}
          style={{ backgroundColor: palette.card, color: palette.text }}
        >
          <Check className="h-3.5 w-3.5" />
          Sync All
        </button>
        <button
          onClick={() => setAll(false)}
          disabled={allOff}
          className={btnClass}
          style={{ backgroundColor: palette.card, color: palette.text }}
        >
          <X className="h-3.5 w-3.5" />
          Sync None
        </button>
      </div>

      <div className="space-y-2">
        {keys.map((def) => (
          <ToggleRow
            key={def.key}
            label={def.label}
            description={def.description}
            checked={!!prefs[def.key]}
            onChange={() => setPref(def.key, !prefs[def.key])}
          />
        ))}
      </div>
    </div>
  );
}
