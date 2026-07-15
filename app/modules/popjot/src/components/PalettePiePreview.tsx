import type { MenuStyle } from "@popjot/store/useStore";
import PaletteEffectOverlay from "@shared/components/PaletteEffectOverlay";

/**
 * Static mockup of the real radial menu's color sub-menu ring (Draw or
 * Highlighter), sized to fit inline in the settings picker. Mirrors
 * RadialMenu.tsx's submenu rendering exactly — same angle offset, same
 * skin-class branching per menu style, same plain color-swatch div (no icon
 * glyph), same gradient-stop backgrounds for the Gradient palette, and the
 * same shimmering PaletteEffectOverlay for Glitter — but has no store
 * dependency, animation, or interactivity beyond the caller's onClick. Every
 * palette in the picker needs to render its OWN colors simultaneously, which
 * the live (single global palette) radial menu can't do.
 */

const getPosition = (index: number, total: number, radius: number, offset: number) => {
  const angle = (index * 360) / total - 90 + offset;
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
};

export interface PalettePiePreviewProps {
  /** Colors in ring order — 6 for Draw, 4 for Highlighter. */
  colors: readonly string[];
  menuStyle: MenuStyle;
  buttonRoundness: number;
  glowIntensity?: number;
  size?: number;
  /** Outer button diameter (matches RadialButton's default 56px baseline). */
  buttonSize?: number;
  /** Inner color-swatch size (matches RadialMenu's 28px baseline). */
  swatchSize?: number;
  centerColor?: string;
  /** Angle offset in degrees — 30 for Draw, 45 for Highlighter (see RadialMenu's SUB_MENUS). */
  angleOffset?: number;
  /** Per-chip gradient stops (Gradient palette only) — same shape as RadialMenu's item.gradientStops. */
  gradientStops?: readonly (readonly string[] | undefined)[];
  /** True while the Glitter palette is active, to render the shimmer overlay. */
  isGlitter?: boolean;
  /** Click a chip (e.g. to open a color mixer for that slot). Omit for a non-interactive preview. */
  onChipClick?: (index: number) => void;
}

// Matches RadialMenu.tsx at 100% scale (effectiveScale = 1): BASE_SUB_RADIUS
// (88) is the chip-center radius, buttonSize is RadialButton's 14*4 default
// size, swatchSize is the 28px inner color div — so this preview is pixel-
// identical to the real menu at default scale, not an arbitrary card-fit size.
const REAL_RADIUS = 88;
const REAL_BUTTON_SIZE = 56;
const REAL_SWATCH_SIZE = 28;

const PalettePiePreview = ({
  colors,
  menuStyle,
  buttonRoundness,
  glowIntensity = 50,
  size = REAL_RADIUS * 2 + REAL_BUTTON_SIZE,
  buttonSize = REAL_BUTTON_SIZE,
  swatchSize = REAL_SWATCH_SIZE,
  centerColor,
  angleOffset = 30,
  gradientStops,
  isGlitter = false,
  onChipClick,
}: PalettePiePreviewProps) => {
  const isPop = menuStyle === "pop" || menuStyle === "glow";
  const radius = (size - buttonSize) / 2;
  const outerRadius = `${buttonRoundness / 2}%`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {colors.map((color, i) => {
        const pos = getPosition(i, colors.length, radius, angleOffset);
        // Mirrors RadialMenu's submenu variant/ringColor/popColor branching for
        // an item.color chip exactly (see the sub-menu RadialButton call site).
        const variant = menuStyle === "glow" ? "glow" : isPop ? "pop-light" : menuStyle;
        const ringColor = menuStyle !== "glow" && (isPop || menuStyle === "flat-outline") ? color : undefined;
        const outerBg = menuStyle === "glow" ? color : undefined;
        const glow = menuStyle === "glow"
          ? (() => {
              const gi = glowIntensity / 100;
              return `0 0 ${Math.round(8 + gi * 16)}px ${color}, 0 0 ${Math.round(16 + gi * 30)}px ${color}88`;
            })()
          : undefined;
        const stops = gradientStops?.[i];
        // Same rule as RadialMenu's sub-menu swatch div: gradient stops (Gradient
        // palette) override the flat color; unrelated to menuStyle/glow chrome.
        const swatchBackground = stops && stops.length > 1
          ? `linear-gradient(135deg, ${stops.join(", ")})`
          : color;
        // PaletteEffectOverlay tints off popColor ?? ringColor on the real button
        // (RadialButton.tsx) — same precedence here.
        const effectTint = outerBg ?? ringColor ?? color;

        return (
          <button
            key={i}
            type="button"
            onClick={onChipClick ? () => onChipClick(i) : undefined}
            title={`Slot ${i + 1} — ${color.toUpperCase()}`}
            className={`absolute flex items-center justify-center overflow-hidden radial-btn-${variant} ${onChipClick ? "cursor-pointer" : "cursor-default"}`}
            style={{
              width: buttonSize,
              height: buttonSize,
              left: size / 2 + pos.x - buttonSize / 2,
              top: size / 2 + pos.y - buttonSize / 2,
              borderRadius: outerRadius,
              backgroundColor: outerBg,
              borderColor: ringColor,
              boxShadow: glow,
              padding: 0,
            }}
          >
            <div
              style={{
                width: swatchSize,
                height: swatchSize,
                borderRadius: outerRadius,
                flexShrink: 0,
                background: swatchBackground,
              }}
            />
            {isGlitter && (
              <PaletteEffectOverlay palette="glitter" size={buttonSize} seed={`pie-${i}`} tintColor={effectTint} />
            )}
          </button>
        );
      })}

      {/* Center bolt — purely decorative, matches the real menu's idle state. */}
      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={{
          width: buttonSize * 0.86,
          height: buttonSize * 0.86,
          left: size / 2 - (buttonSize * 0.86) / 2,
          top: size / 2 - (buttonSize * 0.86) / 2,
          borderRadius: outerRadius,
          backgroundColor: centerColor ?? "rgba(128,128,128,0.25)",
        }}
      >
        {isGlitter && centerColor && (
          <PaletteEffectOverlay palette="glitter" size={buttonSize * 0.86} seed="pie-center" tintColor={centerColor} />
        )}
      </div>
    </div>
  );
};

export default PalettePiePreview;
