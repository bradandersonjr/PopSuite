import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { getBadgeColors } from "@/config/themes";
import type { ClickRipple } from "@/hooks/useInputCapture";

interface MouseRippleProps {
  clicks: ClickRipple[];
}

const MouseRipple = ({ clicks }: MouseRippleProps) => {
  const { colorPalette, clickColor } = useStore();
  const colors = getBadgeColors(colorPalette);

  // button 1=left, 2=right, 3=middle (uiohook); 0=left, 2=right, 1=middle (DOM)
  const getColor = (button: number) => {
    if (clickColor !== "palette") return clickColor;
    if (button === 1 || button === 0) return colors[0];
    if (button === 2) return colors[1];
    return colors[2];
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99998 }}>
      <AnimatePresence>
        {clicks.map((click) => {
          const color = getColor(click.button);
          return (
            <motion.div
              key={click.id}
              initial={{ scale: 0, opacity: 0.9 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={{
                position: "absolute",
                left: click.x - 24,
                top: click.y - 24,
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: `3px solid ${color}`,
                boxShadow: `0 0 12px ${color}66`,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default MouseRipple;
