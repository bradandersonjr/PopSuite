import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { MenuStyle } from "@/store/useStore";
import { useStore } from "@/store/useStore";
import { getAnimationConfig } from "@shared/config/animations";
import PaletteEffectOverlay from "@shared/components/PaletteEffectOverlay";
import { withAlpha } from "@/lib/color";

// ─── Animation Constants ────────────────────────────────────────────

const SELECTION_OPACITY = [1, 1, 0, 0];
const SELECTION_TIMES = [0, 0.3, 0.6, 1];

// ─── Types ──────────────────────────────────────────────────────────

interface RadialButtonProps {
  variant: MenuStyle;
  size?: "default" | "sm";
  children: React.ReactNode;
  position?: { x: number; y: number };
  isSelected?: boolean;
  interactable?: boolean;
  hasActiveSelection?: boolean;
  menuOpen?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  title?: string;
  ringColor?: string;
  /** Pop random-color mode: background color for this button */
  popColor?: string;
  /** Pop gradient mode: gradient stops for background (overrides popColor) */
  popGradientStops?: readonly string[];
}

// ─── Component ──────────────────────────────────────────────────────

const RadialButton = ({
  variant,
  size = "default",
  children,
  position = { x: 0, y: 0 },
  isSelected = false,
  interactable = true,
  hasActiveSelection = false,
  menuOpen = true,
  onHoverStart,
  onHoverEnd,
  title,
  ringColor,
  popColor,
  popGradientStops,
}: RadialButtonProps) => {
  const animationIntensity = useStore(state => state.animationIntensity);
  const scaleFactor = useStore(state => state.scaleFactor);
  const scaleMultiplier = useStore(state => state.scaleMultiplier);
  const effectiveScale = scaleFactor * scaleMultiplier;
  const buttonRoundness = useStore(state => state.buttonRoundness);
  const colorPalette = useStore(state => state.colorPalette);
  const glowIntensity = useStore(state => state.glowIntensity);
  const textColor = useStore(state => state.textColor);
  const menuTranslucency = useStore(state => state.menuTranslucency);
  const themeMode = useStore(state => state.themeMode);
  const bgAlpha = 1 - menuTranslucency / 100;
  // Flat / flat-outline / pop-light backgrounds (otherwise from CSS) so translucency applies uniformly.
  const flatBase = themeMode === "dark" ? "#242424" : "#F8F8F6";
  const animConfig = getAnimationConfig(animationIntensity);
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    if (isSelected) {
      setIsPressing(true);
      const timer = setTimeout(() => setIsPressing(false), animConfig.selectionDuration * 0.3); // Sync shadow click with the physical press keyframe
      return () => clearTimeout(timer);
    } else {
      setIsPressing(false);
    }
  }, [animConfig.selectionDuration, isSelected]);

  // Base sizes (in px)
  const baseSize = size === "sm" ? 12 : 14;
  const scaledSize = baseSize * effectiveScale;
  const scaledHalf = scaledSize / 2;

  const skinClass = `radial-btn-${variant}`;
  const style: React.CSSProperties = {
    width: `${scaledSize * 4}px`,  // 12 * 4 = 48px or 14 * 4 = 56px
    height: `${scaledSize * 4}px`,
    marginLeft: `${-scaledHalf * 4}px`,
    marginTop: `${-scaledHalf * 4}px`,
    padding: 0,
    boxSizing: "border-box",
    lineHeight: 0,
    appearance: "none",
    WebkitAppearance: "none",
    ...(popGradientStops && popGradientStops.length > 1
      ? { background: `linear-gradient(135deg, ${popGradientStops.map((s) => withAlpha(s, bgAlpha)).join(", ")})` }
      : { backgroundColor: withAlpha(popColor ?? flatBase, bgAlpha) }),
    ...(ringColor ? { borderColor: ringColor } : {}),
    // Glow: soft colored halo in the button's own color, scaled by intensity.
    ...(variant === "glow"
      ? (() => {
          const glow = popGradientStops?.[0] ?? popColor;
          if (!glow) return {};
          const gi = glowIntensity / 100;
          return { boxShadow: `0 0 ${Math.round(8 + gi * 16)}px ${glow}, 0 0 ${Math.round(16 + gi * 30)}px ${glow}88` };
        })()
      : {}),
    // Force icon/text color when not "auto".
    ...(textColor === "white" ? { color: "#ffffff" } : textColor === "black" ? { color: "#111111" } : {}),
  };

  const animate = isSelected
    ? {
      scale: [animConfig.hoverScale as number, 1, animConfig.hoverScale as number, animConfig.hoverScale as number],
      x: [position.x + animConfig.hoverOffset, position.x + animConfig.pressOffset, position.x + animConfig.reboundOffset, position.x + animConfig.reboundOffset],
      y: [position.y + animConfig.hoverOffset, position.y + animConfig.pressOffset, position.y + animConfig.reboundOffset, position.y + animConfig.reboundOffset],
      opacity: SELECTION_OPACITY
    }
    : { scale: 1, opacity: 1, x: position.x, y: position.y };

  const transition = isSelected
    ? { duration: animConfig.selectionDuration / 1000, ease: "easeInOut" as const, times: SELECTION_TIMES }
    : { type: "spring", stiffness: animConfig.springStiffness, damping: animConfig.springDamping } as const;

  const borderRadius = `${buttonRoundness / 2}%`;

  const btnPixelSize = scaledSize * 4;

  return (
    <motion.button
      className={`absolute z-20 flex items-center justify-center ${skinClass} ${interactable && !hasActiveSelection ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{
        ...style,
        borderRadius,
        overflow: "hidden",
        transition: `box-shadow ${isSelected ? animConfig.selectionDuration * 0.3 : 100}ms ease-out`
      }}
      initial={{ scale: 0, x: 0, y: 0 }}
      animate={animate}
      whileHover={isSelected ? undefined : {
        scale: animConfig.hoverScale,
        x: position.x + animConfig.hoverOffset,
        y: position.y + animConfig.hoverOffset
      }}
      whileTap={{
        scale: 1,
        x: position.x + animConfig.pressOffset,
        y: position.y + animConfig.pressOffset
      }}
      exit={{ scale: 0, x: 0, y: 0, transition: { duration: hasActiveSelection ? 0 : menuOpen ? 0.1 : 0 } }}
      transition={transition}
      title={title}
      data-selected={isPressing}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          flexShrink: 0,
          pointerEvents: "none",
        }}
      >
        {children}
      </span>
      <PaletteEffectOverlay palette={colorPalette} size={btnPixelSize} seed={title ?? "btn"} tintColor={popColor ?? ringColor} />
    </motion.button>
  );
};

export default RadialButton;
