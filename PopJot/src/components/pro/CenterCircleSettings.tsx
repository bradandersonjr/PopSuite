import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, Trash2 } from "lucide-react";
import { getSurfacePalette, PRO_ACCENT } from "@shared/config/desktopTheme";
import { useStore } from "@/store/useStore";
import {
  clearProCenterIcon,
  getProCenterIcon,
  getProCenterScale,
  setProCenterIcon,
  setProCenterScale,
} from "@/pro";

const SCALE_PRESETS = [
  { label: "Small", value: 0.75 },
  { label: "Default", value: 1.0 },
  { label: "Large", value: 1.35 },
  { label: "XL", value: 1.75 },
];

const CenterCircleSettings = () => {
  const themeMode = useStore((s) => s.themeMode);
  const sp = getSurfacePalette(themeMode === "dark");

  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const icon = getProCenterIcon();
    if (icon) setIconDataUrl(icon);
    setScale(getProCenterScale());
  }, []);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") { setIconDataUrl(result); setProCenterIcon(result); }
    };
    reader.readAsDataURL(file);
  }, []);

  const applyScale = (v: number) => { setScale(v); setProCenterScale(v); };

  const sectionLabel = "text-[11px] font-bold uppercase tracking-widest";

  return (
    <div className="space-y-3">
      {/* Icon */}
      <div>
        <div className={`mb-1.5 ${sectionLabel}`} style={{ color: sp.muted }}>Custom Icon</div>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed py-5"
          style={{ borderColor: sp.divider, backgroundColor: sp.card }}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) readFile(f); }}
          onDragOver={(e) => e.preventDefault()}
        >
          {iconDataUrl ? (
            <img src={iconDataUrl} alt="" className="h-16 w-16 rounded-full object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: sp.selected }}>
              <ImageIcon size={28} style={{ color: sp.muted }} />
            </div>
          )}
          <div className="text-center">
            <div className="text-xs font-medium" style={{ color: sp.text }}>{iconDataUrl ? "Icon loaded" : "Drop an image or browse"}</div>
            <div className="text-[11px]" style={{ color: sp.muted }}>PNG, JPG, SVG</div>
          </div>
        </div>
        <input ref={fileInputRef} type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
        <div className="mt-2 flex gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-[12px] py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>
            <Upload size={15} /> Browse
          </button>
          {iconDataUrl && (
            <button onClick={() => { clearProCenterIcon(); setIconDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ backgroundColor: sp.card, color: sp.muted }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Size */}
      <div>
        <div className={`mb-1.5 ${sectionLabel}`} style={{ color: sp.muted }}>Circle Size</div>
        <div className="grid grid-cols-4 gap-2">
          {SCALE_PRESETS.map((p) => (
            <button key={p.label} onClick={() => applyScale(p.value)}
              className="rounded-[10px] py-2 text-xs font-semibold transition-colors"
              style={{ backgroundColor: Math.abs(scale - p.value) < 0.01 ? PRO_ACCENT : sp.card, color: Math.abs(scale - p.value) < 0.01 ? "#fff" : sp.muted }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: sp.muted }}>
          <span>0.5×</span>
          <input type="range" min={0.5} max={2} step={0.05} value={scale}
            onChange={(e) => applyScale(parseFloat(e.target.value))}
            className="flex-1" style={{ accentColor: PRO_ACCENT }} />
          <span>2.0×</span>
          <span className="w-10 text-right font-semibold" style={{ color: sp.text }}>{scale.toFixed(2)}×</span>
        </div>
      </div>
    </div>
  );
};

export default CenterCircleSettings;
