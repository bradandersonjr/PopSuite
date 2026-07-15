import { useCallback, useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { SliderRow } from "@shared/components/settings";
import { useStore } from "@popjot/store/useStore";
import { sendBrandingEnabled, sendBrandingImage, sendBrandingScale } from "@popjot/lib/platform";

/**
 * Branding logo for PopJot — replaces the radial menu's center shape with a
 * custom image. Styled to match PopKey's branding picker (thumbnail + choose +
 * size slider). Stored in settings (not the @popjot/pro stub) so it renders in every
 * build; setting a logo enables branding (and syncs that on/off with PopKey),
 * clearing it disables branding. Rendering is still gated on Pro in RadialMenu.
 */
const CenterCircleSettings = () => {
  const s = useStore();
  const sp = getSurfacePalette(s.themeMode === "dark");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setEnabled = useCallback((on: boolean) => {
    s.setBrandingEnabled(on);
    sendBrandingEnabled(on);
  }, [s]);

  const setImage = useCallback((url: string) => {
    s.setBrandingImage(url);
    sendBrandingImage(url);
    setEnabled(url !== "");
  }, [s, setEnabled]);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") setImage(result);
    };
    reader.readAsDataURL(file);
  }, [setImage]);

  const applyScale = (pct: number) => {
    const scale = pct / 100;
    s.setBrandingScale(scale);
    sendBrandingScale(scale);
  };

  const image = s.brandingImage;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ backgroundColor: sp.card }}>
        {image ? (
          <img src={image} alt="" className="h-8 w-8 rounded object-contain" style={{ backgroundColor: sp.panel }} />
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
          {image ? "Replace image" : "Choose image"}
        </button>
        {image && (
          <button
            onClick={() => setImage("")}
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
          value={Math.round(s.brandingScale * 100)}
          min={50}
          max={200}
          step={5}
          onChange={applyScale}
          valueSuffix="%"
          defaultValue={100}
        />
      </div>
    </div>
  );
};

export default CenterCircleSettings;
