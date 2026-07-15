/**
 * Situational Presets (Pro) — named snapshots of both apps' settings that can
 * be swapped in one click, e.g. a "Fusion" layout with badges bottom-right vs
 * a "Recording" layout with everything out of frame.
 *
 * Presets capture and reapply the combined settings of PopJot and PopKey,
 * stored in the current window's localStorage. The same nested shape as the
 * suite Config export ({ popjot: {...}, popkey: {...} }) keeps the formats
 * interchangeable. Used by the desktop suite's Settings window (persists
 * across restarts there) and by the popsuite.app web demo (persists only for
 * that browser tab's session).
 */

import { useEffect, useRef, useState } from "react";
import { Bookmark, Play, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { SettingGroup, useSettingsUI, useToast, type SuiteAppConfig } from "@shared/components/settings";
import { applySettings, collectSettings } from "@shared/settings/io";
import type { SettingsSchema } from "@shared/settings/schema";

// The desktop suite launcher declares the full window.suiteSettings bridge
// (app/src/settings/main.tsx); on web there is no such bridge. Read it as an
// untyped, optional global instead of augmenting `Window` here, since the
// desktop launcher's stricter (non-optional) declaration for the same global
// would otherwise conflict with a second declaration in this shared file.
const suiteSettingsBridge = (): {
  syncPresets?(payload: { presets: Array<{ id: string; name: string }>; isPro: boolean }): void;
  onApplyPreset?(callback: (id: string) => void): () => void;
  notifyApplyDone?(): void;
} | undefined => (window as unknown as { suiteSettings?: ReturnType<typeof suiteSettingsBridge> }).suiteSettings;

type Preset = {
  id: string;
  name: string;
  createdAt: number;
  data: Record<string, Record<string, unknown>>;
};

const STORAGE_KEY = "popsuite-presets";
const LAST_APPLIED_KEY = "popsuite-presets-last-applied";

/** Sentinel id for the built-in factory-defaults preset (not stored). */
const DEFAULT_PRESET_ID = "__default__";

/** Factory defaults for one app, straight from its schema. */
function collectDefaults(schema: SettingsSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.volatile) continue;
    out[key] = spec.default;
  }
  return out;
}

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Preset[]) : [];
  } catch {
    return [];
  }
}

function storePresets(presets: Preset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function SuitePresets({
  apps,
  isPro,
  buyUrl,
}: {
  apps: SuiteAppConfig[];
  isPro: boolean;
  buyUrl: string;
}) {
  const { palette } = useSettingsUI();
  const toast = useToast();
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [name, setName] = useState("");
  const [lastApplied, setLastApplied] = useState<string | null>(
    () => localStorage.getItem(LAST_APPLIED_KEY),
  );

  const persist = (next: Preset[]) => {
    setPresets(next);
    storePresets(next);
  };

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const data: Record<string, Record<string, unknown>> = {};
    for (const app of apps) {
      data[app.appName.toLowerCase()] = collectSettings(app.schema, app.store);
    }
    const preset: Preset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      createdAt: Date.now(),
      data,
    };
    persist([...presets, preset]);
    setName("");
    toast(`Saved preset "${trimmed}"`);
  };

  const markApplied = (id: string) => {
    setLastApplied(id);
    localStorage.setItem(LAST_APPLIED_KEY, id);
  };

  const apply = (preset: Preset) => {
    for (const app of apps) {
      app.activate?.();
      applySettings(app.schema, app.store, preset.data[app.appName.toLowerCase()]);
    }
    markApplied(preset.id);
    toast(`Applied "${preset.name}"`);
  };

  const applyDefaults = () => {
    for (const app of apps) {
      app.activate?.();
      applySettings(app.schema, app.store, collectDefaults(app.schema));
    }
    markApplied(DEFAULT_PRESET_ID);
    toast("Restored default settings");
  };

  /** Overwrite a saved preset with the current settings of both apps. */
  const update = (id: string) => {
    const data: Record<string, Record<string, unknown>> = {};
    for (const app of apps) {
      data[app.appName.toLowerCase()] = collectSettings(app.schema, app.store);
    }
    const target = presets.find((p) => p.id === id);
    persist(presets.map((p) => (p.id === id ? { ...p, data } : p)));
    // The preset now equals the live settings, so it is effectively active.
    markApplied(id);
    if (target) toast(`Updated "${target.name}"`);
  };

  const remove = (id: string) => {
    persist(presets.filter((p) => p.id !== id));
    if (lastApplied === id) {
      setLastApplied(null);
      localStorage.removeItem(LAST_APPLIED_KEY);
    }
  };

  // Mirror the preset index (+ Pro state) to the launcher so the tray can list
  // and gate them. Runs on mount and whenever the list or Pro state changes.
  useEffect(() => {
    suiteSettingsBridge()?.syncPresets?.({
      presets: presets.map((p) => ({ id: p.id, name: p.name })),
      isPro,
    });
  }, [presets, isPro]);

  // Apply-from-tray: the launcher opens this window and sends a preset id (or
  // the Default sentinel). Route it through the same apply path the buttons use.
  // A ref keeps the callback current without re-subscribing the IPC listener.
  const applyByIdRef = useRef<(id: string) => void>(() => {});
  applyByIdRef.current = (id: string) => {
    if (id === DEFAULT_PRESET_ID) {
      applyDefaults();
      return;
    }
    const target = presets.find((p) => p.id === id);
    if (target) apply(target);
  };
  useEffect(() => {
    return suiteSettingsBridge()?.onApplyPreset?.((id) => {
      applyByIdRef.current(id);
      // Tell the launcher the apply's settings IPC has been dispatched, so a
      // window opened only to run this apply (never shown) can be torn down.
      suiteSettingsBridge()?.notifyApplyDone?.();
    });
  }, []);

  return (
    <SettingGroup
      title="Situational Presets"
      description="Save the current PopJot + PopKey settings as a named preset and swap between them per app or task — one layout for Fusion, another for recording"
      pro
      locked={!isPro}
      buyUrl={buyUrl}
    >
      <div className="space-y-3">
        {/* Built-in starter preset: factory defaults for both apps. Always
            present, synthesized from the schemas, no stored data. */}
        <div
          className="flex items-center gap-2 rounded-[12px] px-3 py-2"
          style={{ backgroundColor: palette.card }}
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" style={{ color: palette.muted }} />
          <span className="truncate text-xs font-semibold" style={{ color: palette.text }}>
            Default
          </span>
          <span className="truncate text-[11px]" style={{ color: palette.muted }}>
            Factory settings
          </span>
          {lastApplied === DEFAULT_PRESET_ID && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: palette.selected, color: palette.muted }}
            >
              Active
            </span>
          )}
          <button
            onClick={applyDefaults}
            className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: palette.selected, color: palette.text }}
          >
            <Play className="h-3 w-3" />
            Apply
          </button>
        </div>

        {presets.length === 0 && (
          <p className="text-xs" style={{ color: palette.muted }}>
            No saved presets yet. Dial in your settings, name the setup, and save it.
          </p>
        )}

        {presets.map((preset) => (
          <div
            key={preset.id}
            className="flex items-center gap-2 rounded-[12px] px-3 py-2"
            style={{ backgroundColor: palette.card }}
          >
            <Bookmark className="h-3.5 w-3.5 shrink-0" style={{ color: palette.muted }} />
            <span className="truncate text-xs font-semibold" style={{ color: palette.text }}>
              {preset.name}
            </span>
            {lastApplied === preset.id && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: palette.selected, color: palette.muted }}
              >
                Active
              </span>
            )}
            <button
              onClick={() => apply(preset)}
              className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: palette.selected, color: palette.text }}
            >
              <Play className="h-3 w-3" />
              Apply
            </button>
            <button
              onClick={() => update(preset.id)}
              title="Overwrite this preset with the current settings"
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: palette.selected, color: palette.text }}
            >
              <RefreshCw className="h-3 w-3" />
              Update
            </button>
            <button
              onClick={() => remove(preset.id)}
              aria-label={`Delete preset ${preset.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 transition-opacity hover:opacity-80"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCurrent();
            }}
            placeholder="Preset name (e.g. Fusion, Recording)"
            className="min-w-0 flex-1 rounded-[12px] px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: palette.card, color: palette.text }}
          />
          <button
            onClick={saveCurrent}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: palette.selected, color: palette.text }}
          >
            <Plus className="h-3.5 w-3.5" />
            Save current
          </button>
        </div>
      </div>
    </SettingGroup>
  );
}
