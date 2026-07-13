/**
 * Suite-wide config import/export — one file covering both apps' settings,
 * shown once on the suite System page instead of a per-app control in each
 * app's own System section. Nests each app's settings under its own key so
 * a single JSON file round-trips both schemas.
 */

import { useRef, useState } from "react";
import { Download, Upload, Check } from "lucide-react";
import type { SettingsSchema } from "../../settings/schema";
import { applySettings, collectSettings } from "../../settings/io";
import { useSettingsUI } from "./primitives";

type SettingsStore = { getState(): unknown };

export type SuiteAppConfig = {
  appName: string;
  schema: SettingsSchema;
  store: SettingsStore;
  /**
   * Called before writing this app's settings. The suite settings preload
   * multiplexes both modules' IPC bridges behind one electronAPI, routed by an
   * active-module id — this lets the caller point the router at the right
   * module before applySettings sends anything.
   */
  activate?: () => void;
};

export function SuiteImportExport({ apps }: { apps: SuiteAppConfig[] }) {
  const { palette } = useSettingsUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<null | "exported" | "imported">(null);

  const flash = (s: "exported" | "imported") => {
    setStatus(s);
    window.setTimeout(() => setStatus(null), 1800);
  };

  const exportConfig = () => {
    const combined: Record<string, unknown> = {};
    for (const app of apps) {
      combined[app.appName.toLowerCase()] = collectSettings(app.schema, app.store);
    }
    const json = JSON.stringify(combined, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "popsuite-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("exported");
  };

  const importConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== "object") return;
        let applied = 0;
        for (const app of apps) {
          const section = (data as Record<string, unknown>)[app.appName.toLowerCase()];
          app.activate?.();
          applied += applySettings(app.schema, app.store, section);
        }
        if (applied > 0) flash("imported");
      } catch {
        /* invalid file — ignore */
      }
    };
    reader.readAsText(file);
  };

  const btnClass =
    "flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80";

  return (
    <div className="flex items-center gap-2">
      <button onClick={exportConfig} className={btnClass} style={{ backgroundColor: palette.card, color: palette.text }}>
        {status === "exported" ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {status === "exported" ? "Exported" : "Export"}
      </button>
      <button onClick={() => fileRef.current?.click()} className={btnClass} style={{ backgroundColor: palette.card, color: palette.text }}>
        {status === "imported" ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        {status === "imported" ? "Imported" : "Import"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importConfig(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
