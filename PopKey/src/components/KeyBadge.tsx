import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mouse,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getAnimationConfig } from "@shared/config/animations";
import PaletteEffectOverlay from "@shared/components/PaletteEffectOverlay";
import type { BadgeType } from "@/hooks/useInputCapture";
import { getBadgeGradientStops } from "@/config/themes";
import { fontStackFor } from "@/config/fonts";
import { getBadgeMotion } from "@/config/badgeAnimations";

function withAlpha(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();
  const hex3 = /^#([0-9a-fA-F]{3})$/;
  const hex6 = /^#([0-9a-fA-F]{6})$/;
  const rgb = /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/;

  const m3 = hex.match(hex3);
  if (m3) {
    const [r, g, b] = m3[1].split("").map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }

  const m6 = hex.match(hex6);
  if (m6) {
    const r = parseInt(m6[1].slice(0, 2), 16);
    const g = parseInt(m6[1].slice(2, 4), 16);
    const b = parseInt(m6[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }

  const mrgb = hex.match(rgb);
  if (mrgb) {
    return `rgba(${mrgb[1]}, ${mrgb[2]}, ${mrgb[3]}, ${clamped})`;
  }

  return color;
}

interface KeyBadgeProps {
  label: string;
  type: BadgeType;
  color: string;
  style: "flat" | "flat-outline" | "pop" | "glow";
  fontSize: number;
  exitDirection: "left" | "right" | "center";
}

const KeyBadge = ({ label, type, color, style, fontSize, exitDirection }: KeyBadgeProps) => {
  const { colorPalette, animationIntensity, themeMode, badgeTranslucency, badgeRoundness, badgeTextColor, glowIntensity, badgeFont, badgeAnimation, isPro } = useStore();
  const fontFamily = fontStackFor(badgeFont, isPro);
  const config = getAnimationConfig(animationIntensity);
  const motion0 = getBadgeMotion(badgeAnimation, isPro, config, exitDirection);
  const isDark = themeMode === "dark";
  const backgroundAlpha = 1 - badgeTranslucency / 100;
  const flatBg = isDark ? "#2c313c" : "#eef1f5";
  // "auto" keeps the per-style theme text color; white/black force it everywhere.
  const textOverride = badgeTextColor === "white" ? "#ffffff" : badgeTextColor === "black" ? "#111111" : null;
  const popBorder = isDark ? "#111111" : "#f5f5f5";

  const baseStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily,
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    pointerEvents: "none" as const,
    userSelect: "none" as const,
  };

  // 0% = square, 100% = pill. Max radius is half the element height (font + padding).
  const maxRadius = fontSize * 1;
  const radius = `${(badgeRoundness / 100) * maxRadius}px`;

  const isGradient = colorPalette === "gradient" || colorPalette === "glitter";
  const gradientStops = isGradient ? getBadgeGradientStops(color) : [];
  // Glow halo uses the badge's own color (first gradient stop for gradient palettes).
  const glowColor = isGradient ? gradientStops[0] : color;
  // 0 = subtle, 100 = intense — scales halo spread and opacity.
  const gi = glowIntensity / 100;

  // Glitter renders PopJot's shimmering-particle overlay on top of the badge.
  // Measure the pill so the SVG sparkles fill its exact width/height.
  const badgeRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const showGlitter = colorPalette === "glitter";
  useEffect(() => {
    if (!showGlitter) return;
    const el = badgeRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showGlitter, label, fontSize]);

  const getVariantStyle = (): React.CSSProperties => {
    switch (style) {
      case "flat": {
        // Flat uses palette colors (or solidColor if Solid palette is active).
        return {
          ...baseStyle,
          backgroundColor: withAlpha(color, backgroundAlpha),
          color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
          padding: `${fontSize * 0.4}px ${fontSize * 0.8}px`,
          borderRadius: radius,
        };
      }
      case "flat-outline": {
        // Gradient palette: colorful border + tinted text, neutral background
        if (isGradient) {
          return {
            ...baseStyle,
            backgroundColor: withAlpha(flatBg, backgroundAlpha),
            color: textOverride ?? gradientStops[0],
            padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
            borderRadius: radius,
            border: `2px solid ${gradientStops[0]}`,
          };
        }
        return {
          ...baseStyle,
          backgroundColor: withAlpha(flatBg, backgroundAlpha),
          color: textOverride ?? color,
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          border: `2px solid ${color}`,
        };
      }
      case "pop": {
        return {
          ...baseStyle,
          ...(isGradient
            ? { backgroundImage: `linear-gradient(135deg, ${withAlpha(gradientStops[0], backgroundAlpha)}, ${withAlpha(gradientStops[1], backgroundAlpha)})` }
            : { backgroundColor: withAlpha(color, backgroundAlpha) }),
          color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          border: `2px solid ${popBorder}`,
          boxShadow: `3px 3px 0 ${popBorder}`,
        };
      }
      case "glow":
        // Filled like Pop, but with a soft colored halo instead of a hard shadow.
        return {
          ...baseStyle,
          ...(isGradient
            ? { backgroundImage: `linear-gradient(135deg, ${withAlpha(gradientStops[0], backgroundAlpha)}, ${withAlpha(gradientStops[1], backgroundAlpha)})` }
            : { backgroundColor: withAlpha(color, backgroundAlpha) }),
          color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          boxShadow: `0 0 ${Math.round(fontSize * (0.35 + gi * 0.9))}px ${withAlpha(glowColor, 0.5 + gi * 0.45)}, 0 0 ${Math.round(fontSize * (0.8 + gi * 1.8))}px ${withAlpha(glowColor, 0.2 + gi * 0.45)}`,
        };
    }
  };

  const iconSize = Math.round(fontSize * 0.85);
  const iconStyle: React.CSSProperties = { display: "inline", verticalAlign: "middle", flexShrink: 0 };

  // Map Unicode direction arrows (appended to drag labels) to Lucide icons
  const DIRECTION_ICONS: Partial<Record<string, LucideIcon>> = {
    "→": ArrowRight, "↗": ArrowUpRight, "↑": ArrowUp, "↖": ArrowUpLeft,
    "←": ArrowLeft, "↙": ArrowDownLeft, "↓": ArrowDown, "↘": ArrowDownRight,
  };

  // Split trailing direction arrow out of the label so it can be rendered as an icon
  const lastChar = label.slice(-1);
  const DirIcon = DIRECTION_ICONS[lastChar];
  const labelText = DirIcon ? label.slice(0, -1).trimEnd() : label;

  // Scroll prefix picks direction from the label; drag uses the dynamic direction icon
  const ScrollIcon = label.toLowerCase().includes("up") ? ArrowUp : ArrowDown;
  const DragIcon = DirIcon ?? ArrowUpRight;
  const prefixIcon = type === "click"  ? <Mouse     size={iconSize} strokeWidth={2.5} style={{ ...iconStyle, marginRight: 5 }} />
    : type === "drag"   ? <DragIcon    size={iconSize} strokeWidth={2.5} style={{ ...iconStyle, marginRight: 5 }} />
    : type === "scroll" ? <ScrollIcon  size={iconSize} strokeWidth={2.5} style={{ ...iconStyle, marginRight: 5 }} />
    : null;

  return (
    <motion.div
      initial={motion0.initial}
      animate={motion0.animate}
      exit={motion0.exit}
      ref={badgeRef}
      style={{ ...getVariantStyle(), display: "inline-flex", alignItems: "center", gap: 4, position: "relative", overflow: "hidden" }}
    >
      {prefixIcon}
      {labelText}
      {showGlitter && dims.w > 0 && (
        <PaletteEffectOverlay
          palette="glitter"
          size={dims.h}
          width={dims.w}
          height={dims.h}
          seed={label}
          tintColor={color}
        />
      )}
    </motion.div>
  );
};

export default KeyBadge;
