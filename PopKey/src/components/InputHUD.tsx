import { AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { resolvePaletteColors } from "@/config/themes";
import KeyBadge from "./KeyBadge";
import type { Badge } from "@/hooks/useInputCapture";

interface InputHUDProps {
  badges: Badge[];
}

const InputHUD = ({ badges }: InputHUDProps) => {
  const { displayPosition, colorPalette, badgeStyle, fontSize, scaleFactor, scaleMultiplier, positionOffsetX, positionOffsetY, solidColor } = useStore();
  // "solid" injects the live color; others use the built-in palette.
  const colors = resolvePaletteColors(colorPalette, solidColor);
  const effectiveScale = scaleFactor * scaleMultiplier;

  const isTop = displayPosition.startsWith("top");
  const isBottom = displayPosition.startsWith("bottom");
  const isLeft = displayPosition.endsWith("left");
  const isRight = displayPosition.endsWith("right");
  const isCenter = displayPosition.endsWith("center");

  // Base edge inset (scaled)
  const edgeInset = Math.round(32 * effectiveScale);

  const posStyle: React.CSSProperties = {
    // Vertical
    ...(isTop ? { top: edgeInset - positionOffsetY } : {}),
    ...(isBottom ? { bottom: edgeInset + positionOffsetY } : {}),
    // Horizontal
    ...(isLeft ? { left: edgeInset + positionOffsetX } : {}),
    ...(isRight ? { right: edgeInset - positionOffsetX } : {}),
    ...(isCenter
      ? {
          left: "50%",
          transform: `translateX(calc(-50% + ${positionOffsetX}px))`,
          alignItems: "center",
        }
      : { alignItems: isLeft ? "flex-start" : "flex-end" }),
  };

  return (
    <div
      style={{
        position: "fixed",
        display: "flex",
        flexDirection: "column",
        gap: Math.round(6 * effectiveScale),
        zIndex: 99999,
        pointerEvents: "none",
        ...posStyle,
      }}
    >
      <AnimatePresence mode="popLayout">
        {badges.map((badge) => (
          <KeyBadge
            key={badge.id}
            label={badge.label}
            type={badge.type}
            color={colors[badge.colorIndex % colors.length]}
            style={badgeStyle}
            fontSize={Math.round(fontSize * effectiveScale)}
            exitDirection={isRight ? "right" : isCenter ? "center" : "left"}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default InputHUD;
