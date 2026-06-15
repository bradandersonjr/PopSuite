import { motion } from "framer-motion";
import {
  Mouse,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getAnimationConfig } from "@shared/config/animations";
import type { BadgeType } from "@/hooks/useInputCapture";
import { getBadgeGradientStops } from "@/config/themes";

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
  style: "flat" | "flat-outline" | "pop" | "pop-mono";
  fontSize: number;
  exitDirection: "left" | "right" | "center";
}

const KeyBadge = ({ label, type, color, style, fontSize, exitDirection }: KeyBadgeProps) => {
  const { colorPalette, animationIntensity, themeMode, badgeTranslucency, badgeBlur, popMonoColor, badgeRoundness } = useStore();
  const config = getAnimationConfig(animationIntensity);
  const isDark = themeMode === "dark";
  const backgroundAlpha = 1 - badgeTranslucency / 100;
  const flatBg = isDark ? "#2c313c" : "#eef1f5";
  const flatText = isDark ? "#e8edf5" : "#1f2937";
  const monoBg = popMonoColor;
  const monoText = isDark ? "#f5f5f5" : "#111111";
  const monoBorder = isDark ? "#000000" : "#ffffff";
  const popBorder = isDark ? "#111111" : "#f5f5f5";

  const baseStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    pointerEvents: "none" as const,
    userSelect: "none" as const,
  };

  // 0% = square, 100% = pill. Max radius is half the element height (font + padding).
  const maxRadius = fontSize * 1;
  const radius = `${(badgeRoundness / 100) * maxRadius}px`;
  const blur = badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none";

  const isGradient = colorPalette === "gradient" || colorPalette === "glitter" || colorPalette === "magical";
  const gradientStops = isGradient ? getBadgeGradientStops(color) : [];

  const getVariantStyle = (): React.CSSProperties => {
    switch (style) {
      case "flat": {
        // Gradient palette: use a soft gradient background tinted toward the key's color
        if (isGradient) {
          return {
            ...baseStyle,
            backgroundImage: `linear-gradient(135deg, ${withAlpha(gradientStops[0], backgroundAlpha * 0.85)}, ${withAlpha(gradientStops[1], backgroundAlpha * 0.75)})`,
            color: isDark ? "#ffffff" : "#111111",
            padding: `${fontSize * 0.4}px ${fontSize * 0.8}px`,
            borderRadius: radius,
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
          };
        }
        return {
          ...baseStyle,
          backgroundColor: withAlpha(flatBg, backgroundAlpha),
          color: flatText,
          padding: `${fontSize * 0.4}px ${fontSize * 0.8}px`,
          borderRadius: radius,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        };
      }
      case "flat-outline": {
        // Gradient palette: colorful border + tinted text using gradient stops
        if (isGradient) {
          return {
            ...baseStyle,
            backgroundColor: withAlpha(flatBg, backgroundAlpha),
            color: gradientStops[0],
            padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
            borderRadius: radius,
            border: `2px solid ${gradientStops[0]}`,
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
          };
        }
        return {
          ...baseStyle,
          backgroundColor: withAlpha(flatBg, backgroundAlpha),
          color: color,
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          border: `2px solid ${color}`,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        };
      }
      case "pop": {
        return {
          ...baseStyle,
          ...(isGradient
            ? { backgroundImage: `linear-gradient(135deg, ${withAlpha(gradientStops[0], backgroundAlpha)}, ${withAlpha(gradientStops[1], backgroundAlpha)})` }
            : { backgroundColor: withAlpha(color, backgroundAlpha) }),
          color: isDark ? "#ffffff" : "#0b0b0b",
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          border: `2px solid ${popBorder}`,
          boxShadow: `3px 3px 0 ${popBorder}`,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        };
      }
      case "pop-mono":
        return {
          ...baseStyle,
          backgroundColor: withAlpha(monoBg, backgroundAlpha),
          color: monoText,
          padding: `${fontSize * 0.35}px ${fontSize * 0.75}px`,
          borderRadius: radius,
          border: `2px solid ${monoBorder}`,
          boxShadow: `3px 3px 0 ${monoBorder}`,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
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
      initial={{
        opacity: 0,
        scale: config.enterScale,
        y: config.slideDistance,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          duration: config.enterDuration,
          ease: "easeOut",
          type: "spring",
          stiffness: config.springStiffness,
          damping: config.springDamping,
        },
      }}
      exit={{
        opacity: 0,
        x: exitDirection === "right" ? 20 : exitDirection === "center" ? 0 : -20,
        scale: 0.95,
        transition: { duration: config.exitDuration, ease: "easeIn" },
      }}
      style={{ ...getVariantStyle(), display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {prefixIcon}
      {labelText}
    </motion.div>
  );
};

export default KeyBadge;
