import type { MotionProps } from "framer-motion";
import type { getAnimationConfig } from "@shared/config/animations";
import type { BadgeAnimation } from "@/store/useStore";

type AnimConfig = ReturnType<typeof getAnimationConfig>;
type BadgeMotion = Required<Pick<MotionProps, "initial" | "animate" | "exit">>;

export const BADGE_ANIMATIONS: { key: BadgeAnimation; label: string }[] = [
  { key: "pop", label: "Pop" },
  { key: "slide", label: "Slide" },
  { key: "bounce", label: "Bounce" },
  { key: "fade", label: "Fade" },
  { key: "rise", label: "Rise" },
];

/**
 * Enter/exit motion for a badge. Intensity (`config`) controls timing/spring;
 * `style` controls the shape of the motion. Non-Pro users always get "pop".
 */
export function getBadgeMotion(
  style: BadgeAnimation,
  isPro: boolean,
  config: AnimConfig,
  exitDirection: "left" | "right" | "center",
): BadgeMotion {
  const effective: BadgeAnimation = isPro ? style : "pop";
  const dist = config.slideDistance;
  const exitX = exitDirection === "right" ? 20 : exitDirection === "center" ? 0 : -20;
  const spring = { type: "spring" as const, stiffness: config.springStiffness, damping: config.springDamping };

  switch (effective) {
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: config.enterDuration } },
        exit: { opacity: 0, transition: { duration: config.exitDuration } },
      };
    case "slide": {
      const fromX = exitDirection === "right" ? dist * 2.5 : exitDirection === "center" ? 0 : -dist * 2.5;
      const fromY = exitDirection === "center" ? dist * 1.5 : 0;
      return {
        initial: { opacity: 0, x: fromX, y: fromY },
        animate: { opacity: 1, x: 0, y: 0, transition: spring },
        exit: { opacity: 0, x: exitX, transition: { duration: config.exitDuration } },
      };
    }
    case "rise":
      return {
        initial: { opacity: 0, y: dist * 1.6 },
        animate: { opacity: 1, y: 0, transition: spring },
        exit: { opacity: 0, y: -dist, transition: { duration: config.exitDuration } },
      };
    case "bounce":
      return {
        initial: { opacity: 0, scale: 0.3 },
        animate: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 700, damping: 12 } },
        exit: { opacity: 0, scale: 0.5, transition: { duration: config.exitDuration } },
      };
    case "pop":
    default:
      return {
        initial: { opacity: 0, scale: config.enterScale, y: config.slideDistance },
        animate: { opacity: 1, scale: 1, y: 0, transition: { duration: config.enterDuration, ease: "easeOut", ...spring } },
        exit: { opacity: 0, x: exitX, scale: 0.95, transition: { duration: config.exitDuration, ease: "easeIn" } },
      };
  }
}
