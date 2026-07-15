/**
 * Pro branding settings — presentational, shared by both apps. The parent owns
 * the values + handlers (wired to its store) and the Pro/license state.
 */

import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { SurfacePalette } from "../../config/desktopTheme";
import type { BrandingCorner } from "../BrandingOverlay";
import { SliderRow, ToggleRow } from "./primitives";

const CORNERS: { value: BrandingCorner; label: string }[] = [
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
];

export function BrandingSettings({
  palette,
  image,
  corner,
  size,
  offsetX,
  offsetY,
  opacity,
  radius,
  grayscale,
  blockedCorner,
  onImage,
  onCorner,
  onSize,
  onOffsetX,
  onOffsetY,
  onOpacity,
  onRadius,
  onGrayscale,
}: {
  palette: SurfacePalette;
  image: string;
  corner: BrandingCorner;
  size: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
  radius: number;
  grayscale: boolean;
  blockedCorner: BrandingCorner | null;
  onImage: (dataUrl: string) => void;
  onCorner: (c: BrandingCorner) => void;
  onSize: (px: number) => void;
  onOffsetX: (v: number) => void;
  onOffsetY: (v: number) => void;
  onOpacity: (v: number) => void;
  onRadius: (v: number) => void;
  onGrayscale: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            {image ? (
              <img src={image} alt="" className="h-8 w-8 rounded object-contain" style={{ backgroundColor: palette.panel }} />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded" style={{ backgroundColor: palette.panel, color: palette.muted }}>
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: palette.selected, color: palette.text }}
            >
              {image ? "Replace image" : "Choose image"}
            </button>
            {image && (
              <button
                onClick={() => onImage("")}
                title="Remove image"
                className="ml-auto rounded-[10px] p-1.5 transition-opacity hover:opacity-80"
                style={{ color: "#ef4444" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium" style={{ color: palette.muted }}>Corner</div>
            <div className="grid grid-cols-2 gap-2">
              {CORNERS.map((c) => {
                const isBlocked = c.value === blockedCorner;
                const isSelected = corner === c.value && !isBlocked;
                return (
                  <button
                    key={c.value}
                    onClick={() => onCorner(c.value)}
                    disabled={isBlocked}
                    title={isBlocked ? "In use by the keystroke position" : undefined}
                    className="rounded-[10px] px-3 py-2 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: isSelected ? palette.selected : palette.card,
                      color: isSelected ? palette.text : palette.muted,
                      border: `1.5px solid ${isSelected ? palette.text : "transparent"}`,
                      opacity: isBlocked ? 0.4 : 1,
                      cursor: isBlocked ? "not-allowed" : "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            <div className="mb-1 text-xs font-medium" style={{ color: palette.text }}>Size</div>
            <SliderRow value={size} min={32} max={240} step={4} onChange={onSize} valueSuffix="px" defaultValue={80} />
          </div>
          <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            <div className="mb-1 text-xs font-medium" style={{ color: palette.text }}>Horizontal Offset</div>
            <SliderRow value={offsetX} min={-200} max={200} step={4} onChange={onOffsetX} valueSuffix="px" defaultValue={0} />
          </div>
          <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            <div className="mb-1 text-xs font-medium" style={{ color: palette.text }}>Vertical Offset</div>
            <SliderRow value={offsetY} min={-200} max={200} step={4} onChange={onOffsetY} valueSuffix="px" defaultValue={0} />
          </div>
          <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            <div className="mb-1 text-xs font-medium" style={{ color: palette.text }}>Opacity</div>
            <SliderRow value={opacity} min={10} max={100} step={5} onChange={onOpacity} valueSuffix="%" defaultValue={100} />
          </div>
          <div className="rounded-[12px] px-3 py-2" style={{ backgroundColor: palette.card }}>
            <div className="mb-1 text-xs font-medium" style={{ color: palette.text }}>Corner Radius</div>
            <SliderRow value={radius} min={0} max={50} step={2} onChange={onRadius} valueSuffix="%" defaultValue={0} />
          </div>
          <ToggleRow
            label="Black & white"
            description="Render the logo desaturated"
            checked={grayscale}
            onChange={() => onGrayscale(!grayscale)}
          />
    </div>
  );
}
