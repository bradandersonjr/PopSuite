/**
 * Import/Export config buttons — shared by both apps' settings. Exports the
 * current settings to a JSON file and restores them from one. Works in Electron
 * and web (uses a Blob download + file input, no main-process dialog needed).
 */

import { useRef, useState } from "react";
import { Download, Upload, Check } from "lucide-react";
import type { SettingsSchema } from "../../settings/schema";
import { applySettings, exportSettingsJson } from "../../settings/io";
import { useSettingsUI } from "./primitives";

type SettingsStore = { getState(): unknown };

export function SettingsImportExport({
  schema,
  store,
  appName,
}: {
  schema: SettingsSchema;
  store: SettingsStore;
  appName: string;
}) {
  const { palette } = useSettingsUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<null | "exported" | "imported">(null);

  const flash = (s: "exported" | "imported") => {
    setStatus(s);
    window.setTimeout(() => setStatus(null), 1800);
  };

  const exportConfig = () => {
    const json = exportSettingsJson(schema, store);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${appName.toLowerCase()}-settings.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("exported");
  };

  const importConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (applySettings(schema, store, data) > 0) flash("imported");
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
