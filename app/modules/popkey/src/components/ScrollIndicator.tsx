import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useStore } from "@popkey/store/useStore";
import { getBadgeColors } from "@popkey/config/themes";
import type { ScrollEvent } from "@popkey/hooks/useInputCapture";

interface ScrollIndicatorProps {
  scrolls: ScrollEvent[];
}

const ARROW_SPACING = 22; // px between stacked arrows

const ScrollIndicator = ({ scrolls }: ScrollIndicatorProps) => {
  const { colorPalette, scrollColor } = useStore();
  const paletteColor = getBadgeColors(colorPalette)[3];
  const color = scrollColor === "palette" ? paletteColor : scrollColor;

  const latest = scrolls.length > 0 ? scrolls[scrolls.length - 1] : null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99998 }}>
      <AnimatePresence>
        {latest && (
          <motion.div
            key={`${latest.id}-${latest.count}`}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: latest.x - 16,
              top: latest.direction === "up"
                ? latest.y - 38 - (latest.count - 1) * ARROW_SPACING
                : latest.y + 38,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              filter: `drop-shadow(0 0 5px ${color}99)`,
            }}
          >
            {Array.from({ length: latest.count }).map((_, i) => {
              // For "up": first arrow (i=0) is the topmost/leading one → brightest
              // For "down": first arrow (i=0) is the leading one → brightest
              const opacity = 1 - (i * 0.28);
              const Icon = latest.direction === "up" ? ChevronUp : ChevronDown;
              return (
                <Icon
                  key={i}
                  size={30}
                  strokeWidth={3}
                  style={{ color, opacity, display: "block", marginTop: i === 0 ? 0 : -14 }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScrollIndicator;
