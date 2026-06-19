import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { SliderRow } from "@shared/components/settings";
import { useStore } from "@/store/useStore";
import { sendBrandingEnabled } from "@/lib/platform";
import {
  clearProCenterIcon,
  getProCenterIcon,
  getProCenterScale,
  setProCenterIcon,
  setProCenterScale,
} from "@/pro";

/**
 * Branding logo for PopJot — replaces the radial menu's center shape with a
 * custom image. Styled to match PopKey's branding picker (thumbnail + choose +
 * size slider). Setting a logo enables branding (and syncs that on/off state
 * with PopKey); clearing it disables branding.
 */
const CenterCircleSettings = () => {
  const themeMode = useStore((s) => s.themeMode);
  const setBrandingEnabled = useStore((s) => s.setBrandingEnabled);
  const sp = getSurfacePalette(themeMode === "dark");

  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIconDataUrl(getProCenterIcon());
    setScale(getProCenterScale());
  }, []);

  const setEnabled = useCallback(
    (on: boolean) => {
      setBrandingEnabled(on);
      sendBrandingEnabled(on);
    },
    [setBrandingEnabled]
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === "string") {
          setIconDataUrl(result);
          setProCenterIcon(result);
          setEnabled(true);
        }
      };
      reader.readAsDataURL(file);
    },
    [setEnabled]
  );

  const removeIcon = () => {
    clearProCenterIcon();
    setIconDataUrl(null);
    setEnabled(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyScale = (v: number) => {
    setScale(v);
    setProCenterScale(v);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ backgroundColor: sp.card }}>
        {iconDataUrl ? (
          <img src={iconDataUrl} alt="" className="h-8 w-8 rounded object-contain" style={{ backgroundColor: sp.panel }} />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded" style={{ backgroundColor: sp.panel, color: sp.muted }}>
            <ImagePlus className="h-4 w-4" />
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: sp.selected, color: sp.text }}
        >
          {iconDataUrl ? "Replace image" : "Choose image"}
        </button>
        {iconDataUrl && (
          <button
            onClick={removeIcon}
            title="Remove image"
            className="ml-auto rounded-[10px] p-1.5 transition-opacity hover:opacity-80"
            style={{ color: "#ef4444" }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: sp.card }}>
        <div className="mb-1 text-xs font-medium" style={{ color: sp.text }}>Size</div>
        <SliderRow
          value={Math.round(scale * 100)}
          min={50}
          max={200}
          step={5}
          onChange={(v) => applyScale(v / 100)}
          valueSuffix="%"
          defaultValue={100}
        />
      </div>
    </div>
  );
};

export default CenterCircleSettings;
