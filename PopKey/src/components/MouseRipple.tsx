import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { getBadgeColors } from "@/config/themes";
import type { ClickRipple } from "@/hooks/useInputCapture";

interface MouseRippleProps {
  clicks: ClickRipple[];
}

const MouseRipple = ({ clicks }: MouseRippleProps) => {
  const { colorPalette, clickColor, clickEffect, clickSize } = useStore();
  const colors = getBadgeColors(colorPalette);

  // button 1=left, 2=right, 3=middle (uiohook); 0=left, 2=right, 1=middle (DOM)
  const getColor = (button: number) => {
    if (clickColor !== "palette") return clickColor;
    if (button === 1 || button === 0) return colors[0];
    if (button === 2) return colors[1];
    return colors[2];
  };

  const size = clickSize;
  const half = size / 2;

  const renderEffect = (click: ClickRipple, color: string) => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: click.x - half,
      top: click.y - half,
      width: size,
      height: size,
      borderRadius: "50%",
    };

    switch (clickEffect) {
      case "solid":
        return (
          <motion.div
            key={click.id}
            initial={{ scale: 0, opacity: 0.55 }}
            animate={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ ...base, backgroundColor: color, boxShadow: `0 0 16px ${color}88` }}
          />
        );

      case "pulse":
        // Two staggered rings for a double-ripple.
        return (
          <div key={click.id}>
            {[0, 0.12].map((delay, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0.85 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay }}
                style={{ ...base, border: `3px solid ${color}`, boxShadow: `0 0 12px ${color}66` }}
              />
            ))}
          </div>
        );

      case "burst": {
        // Short lines radiating outward from the click point.
        const rays = 8;
        const len = half;
        const thickness = Math.max(2, size * 0.06);
        return (
          <div
            key={click.id}
            style={{ position: "absolute", left: click.x, top: click.y, width: 0, height: 0 }}
          >
            {Array.from({ length: rays }).map((_, i) => {
              const angle = (i / rays) * 360;
              return (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0.2, opacity: 0.95, rotate: angle }}
                  animate={{ scaleX: 1, opacity: 0, rotate: angle }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: -thickness / 2,
                    width: len,
                    height: thickness,
                    borderRadius: 999,
                    backgroundColor: color,
                    transformOrigin: "0% 50%",
                  }}
                />
              );
            })}
          </div>
        );
      }

      case "ring":
      default:
        return (
          <motion.div
            key={click.id}
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ ...base, border: `3px solid ${color}`, boxShadow: `0 0 12px ${color}66` }}
          />
        );
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99998 }}>
      <AnimatePresence>
        {clicks.map((click) => renderEffect(click, getColor(click.button)))}
      </AnimatePresence>
    </div>
  );
};

export default MouseRipple;
