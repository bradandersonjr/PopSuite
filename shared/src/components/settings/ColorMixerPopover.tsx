import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SurfacePalette } from "@shared/config/desktopTheme";

/**
 * HSL color mixer popover, anchored to a small swatch+hex trigger. Extracted
 * from PopKey's Solid-palette picker so PopJot's custom-palette editor (and any
 * future per-swatch color picker) can use the same mixer instead of a native
 * OS color input.
 */

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  if (/^#?([0-9a-fA-F]{3})$/.test(hex)) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (/^#?([0-9a-fA-F]{6})$/.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export interface ColorMixerPopoverProps {
  currentColor: string;
  onColorChange: (hex: string) => void;
  surfacePalette: SurfacePalette;
  /** Recently-used colors shown as a quick-pick row (e.g. the other slots in the palette). */
  historyColors?: string[];
  /** Trigger label, e.g. "Slot 1" — shown as the swatch's title tooltip. */
  label?: string;
  /**
   * Anchor the popover beside THIS element instead of beside the trigger
   * swatch — e.g. the whole pie-preview card, so the popover consistently
   * opens to the side of the entire picker rather than wherever the trigger
   * row happens to sit (which may be directly under content you don't want
   * covered, like PopJot's Custom-palette pie).
   */
  anchorRef?: React.RefObject<HTMLElement>;
}

export const ColorMixerPopover = ({
  currentColor,
  onColorChange,
  surfacePalette,
  historyColors = [],
  label,
  anchorRef,
}: ColorMixerPopoverProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempHex, setTempHex] = useState(currentColor);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, showBelow: false, showLeft: false });

  useEffect(() => {
    setTempHex(currentColor);
  }, [currentColor]);

  const { h, s, l } = useMemo(() => {
    try {
      return hexToHsl(tempHex);
    } catch {
      return { h: 0, s: 100, l: 50 };
    }
  }, [tempHex]);

  const updateCoords = () => {
    const popoverWidth = 250;
    const popoverHeight = 290;

    if (anchorRef?.current) {
      // Side-anchor to the caller-specified element (e.g. the whole pie card)
      // vertically centered on it, rather than tracking the trigger swatch —
      // keeps the popover clear of content stacked above/below the trigger.
      const rect = anchorRef.current.getBoundingClientRect();
      const showLeft = rect.right + 8 + popoverWidth > window.innerWidth - 10;
      const centeredTop = rect.top + rect.height / 2 - popoverHeight / 2;
      setCoords({
        top: Math.max(10, Math.min(window.innerHeight - popoverHeight - 10, centeredTop)),
        left: showLeft ? rect.left - popoverWidth - 8 : rect.right + 8,
        showBelow: true, // top-anchored either way in side mode
        showLeft,
      });
      return;
    }

    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const showBelow = rect.top - popoverHeight < 10;
    setCoords({
      top: showBelow ? rect.bottom + 8 : rect.top - 8,
      left: Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.right - popoverWidth)),
      showBelow,
      showLeft: false,
    });
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const togglePicker = () => {
    if (!showPicker) {
      updateCoords();
      setShowPicker(true);
    } else {
      closePicker();
    }
  };

  useEffect(() => {
    if (showPicker) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [showPicker]);

  const handleHslChange = (newH: number, newS: number, newL: number) => {
    const hex = hslToHex(newH, newS, newL);
    setTempHex(hex);
    onColorChange(hex);
  };

  const handleHexInput = (value: string) => {
    setTempHex(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) onColorChange(value);
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-[12px] px-2.5 py-1.5"
        style={{ backgroundColor: surfacePalette.card, border: `1.5px solid ${surfacePalette.divider}` }}
      >
        <button
          ref={triggerRef}
          onClick={togglePicker}
          title={label ? `${label} — open color mixer` : "Open color mixer"}
          className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer transition-transform hover:scale-110 active:scale-95 ring-1 ring-black/10"
          style={{ backgroundColor: tempHex, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
        />
        <input
          type="text"
          value={tempHex}
          onChange={(e) => handleHexInput(e.target.value)}
          maxLength={7}
          spellCheck={false}
          style={{
            width: 68,
            fontFamily: "'Space Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: surfacePalette.text,
            background: "transparent",
            border: "none",
            outline: "none",
          }}
        />
      </div>

      {showPicker && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={closePicker} />
          <div
            className="fixed z-[9999] w-[250px]"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.showBelow ? "none" : "translateY(-100%)",
            }}
          >
            <div
              className={`w-full rounded-2xl p-4 flex flex-col gap-3 shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
                coords.showBelow ? "origin-top" : "origin-bottom"
              }`}
              style={{
                backgroundColor: surfacePalette.panel,
                borderColor: surfacePalette.divider,
                color: surfacePalette.text,
              }}
            >
              <div className="text-xs font-bold uppercase tracking-wider opacity-60">Color Mixer</div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Hue</span>
                  <span>{h}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={h}
                  onChange={(e) => handleHslChange(Number(e.target.value), s, l)}
                  className="w-full mixer-slider cursor-pointer"
                  style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Saturation</span>
                  <span>{s}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s}
                  onChange={(e) => handleHslChange(h, Number(e.target.value), l)}
                  className="w-full mixer-slider cursor-pointer"
                  style={{ background: `linear-gradient(to right, #808080, hsl(${h}, 100%, 50%))` }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Lightness</span>
                  <span>{l}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={l}
                  onChange={(e) => handleHslChange(h, s, Number(e.target.value))}
                  className="w-full mixer-slider cursor-pointer"
                  style={{ background: `linear-gradient(to right, #000000, hsl(${h}, ${s}%, 50%), #ffffff)` }}
                />
              </div>

              {historyColors.length > 0 && (
                <div className="flex flex-col gap-2 pt-2.5 border-t" style={{ borderColor: surfacePalette.divider }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Palette</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 22px)", gap: 6 }}>
                    {historyColors.map((hex, i) => (
                      <button
                        key={`${hex}-${i}`}
                        onClick={() => { setTempHex(hex); onColorChange(hex); }}
                        className="w-[22px] h-[22px] rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ColorMixerPopover;
