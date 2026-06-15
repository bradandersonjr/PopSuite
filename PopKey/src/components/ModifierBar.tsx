import { useStore } from "@/store/useStore";
import { getBadgeColors, getBadgeGradientStops } from "@/config/themes";

function withAlpha(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();
  const hex3 = /^#([0-9a-fA-F]{3})$/;
  const hex6 = /^#([0-9a-fA-F]{6})$/;

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

  return color;
}

interface ModifierBarProps {
  heldModifiers: Set<string>;
}

const MODIFIERS = ["Ctrl", "Shift", "Alt", "Win"];

const ModifierBar = ({ heldModifiers }: ModifierBarProps) => {
  const { colorPalette, fontSize, displayPosition, badgeStyle, themeMode, badgeTranslucency, badgeBlur, popMonoColor, badgeRoundness } = useStore();
  const colors = getBadgeColors(colorPalette);
  const isDark = themeMode === "dark";
  const backgroundAlpha = 1 - badgeTranslucency / 100;
  const flatBg = isDark ? "#2c313c" : "#eef1f5";
  const flatText = isDark ? "#e8edf5" : "#1f2937";
  const monoBg = popMonoColor;
  const monoText = isDark ? "#111111" : "#f5f5f5";
  const monoBorder = isDark ? "#ffffff" : "#000000";
  const isGradient = colorPalette === "gradient" || colorPalette === "glitter" || colorPalette === "magical";
  const popHeldBorder = isDark ? "#111111" : "#f5f5f5";

  // Position near the HUD
  const isTop = displayPosition.startsWith("top");
  const isRight = displayPosition.endsWith("right");
  const isCenter = displayPosition.endsWith("center");

  const posStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "row",
    gap: 4,
    ...(isTop
      ? { top: 32 + fontSize + 16, }
      : { bottom: 32 + fontSize + 16 }),
    ...(isRight
      ? { right: 32 }
      : isCenter
      ? { left: "50%", transform: "translateX(-50%)" }
      : { left: 32 }),
  };

  const smallFontSize = Math.max(10, fontSize - 4);
  const maxRadius = smallFontSize * 1;
  const radius = `${(badgeRoundness / 100) * maxRadius}px`;

  return (
    <div style={posStyle}>
      {MODIFIERS.map((mod, i) => {
        const held = heldModifiers.has(mod);
        const color = colors[i % colors.length];

        const chipStyle: React.CSSProperties = {
          fontSize: `${smallFontSize}px`,
          fontFamily: "'Space Mono', monospace",
          fontWeight: 700,
          padding: `${smallFontSize * 0.25}px ${smallFontSize * 0.55}px`,
          borderRadius: radius,
          transition: "opacity 0.1s, transform 0.1s",
          opacity: held ? 1 : 0.25,
          transform: held ? "scale(1.08)" : "scale(1)",
          userSelect: "none",
          ...(badgeStyle === "flat"
            ? {
                backgroundColor: withAlpha(flatBg, backgroundAlpha),
                color: held ? flatText : withAlpha(flatText, 0.7),
                backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
                WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
              }
            : badgeStyle === "flat-outline"
            ? {
                backgroundColor: withAlpha(flatBg, backgroundAlpha),
                color: held ? color : `${color}88`,
                border: `2px solid ${held ? color : `${color}66`}`,
                backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
                WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
              }
            : badgeStyle === "pop"
            ? (() => {
                const stops = isGradient ? getBadgeGradientStops(color) : [];
                return {
                  ...(isGradient
                    ? { backgroundImage: `linear-gradient(135deg, ${withAlpha(stops[0], backgroundAlpha)}, ${withAlpha(stops[1], backgroundAlpha)})` }
                    : { backgroundColor: withAlpha(color, backgroundAlpha) }),
                  color: isDark ? "#0b0b0b" : "#ffffff",
                  border: `2px solid ${popHeldBorder}`,
                  boxShadow: held ? `2px 2px 0 ${popHeldBorder}` : "none",
                  backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
                  WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
                };
              })()
            : {
                backgroundColor: withAlpha(monoBg, backgroundAlpha),
                color: held ? monoText : `${monoText}aa`,
                border: `2px solid ${monoBorder}`,
                boxShadow: held ? `2px 2px 0 ${monoBorder}` : "none",
                backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
                WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : "none",
              }),
        };

        return (
          <div key={mod} style={chipStyle}>
            {mod}
          </div>
        );
      })}
    </div>
  );
};

export default ModifierBar;
