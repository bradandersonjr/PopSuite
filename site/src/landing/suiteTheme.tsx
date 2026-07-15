import {
  Star, Hexagon, Circle, Triangle, Heart, Diamond, Sparkles,
} from "lucide-react";
import { getColors, getGradientVariantStops } from "@popjot/config/themes";
import type { MenuStyle } from "@popjot/store/useStore";
import type { LandingTheme, CardStyle } from "@shared/components/landing/LandingPage";
import { gradientCss, renderShapes, type Shape } from "./shapes";

/**
 * Landing chrome theme, driven by PopJot's store (its palette / menu style is
 * the richer of the two). The per-app live demos still reflect their own
 * stores; this only styles the page's cards, dots, and decorative shapes.
 * Adapted from the retired PopJot WebRoot.
 */

const getLandingCardStyle = (
  colorIndex: number,
  menuStyle: MenuStyle,
  drawColors: readonly string[],
  isGradient: boolean,
  popColor?: string,
): CardStyle => {
  const gradientStyle = isGradient
    ? { backgroundImage: gradientCss(getGradientVariantStops(colorIndex)) }
    : {};

  if (menuStyle === "pop") {
    return {
      className: "landing-card-pop",
      style: isGradient
        ? gradientStyle
        : { backgroundColor: popColor ?? drawColors[colorIndex % drawColors.length] },
    };
  }
  if (menuStyle === "glow") {
    const bg = popColor ?? drawColors[colorIndex % drawColors.length];
    const glow = isGradient ? getGradientVariantStops(colorIndex)[0] : bg;
    return {
      className: "landing-card-glow",
      style: {
        ...(isGradient ? gradientStyle : { backgroundColor: bg }),
        boxShadow: `0 0 18px ${glow}, 0 0 36px ${glow}88`,
      },
    };
  }
  if (menuStyle === "flat-outline") {
    return {
      className: "landing-card-flat-outline",
      style: isGradient
        ? gradientStyle
        : { backgroundColor: drawColors[colorIndex % drawColors.length] },
    };
  }
  return {
    className: "landing-card-flat",
    style: isGradient
      ? gradientStyle
      : { backgroundColor: drawColors[colorIndex % drawColors.length] },
  };
};

/**
 * Bare-text counterpart to getLandingCardStyle: same four menu styles, but
 * applied to plain colored text instead of a filled panel (no background,
 * no padding) — for the "PopSuite" wordmark. Gradients don't translate
 * cleanly to text without background-clip plumbing, so a gradient palette
 * falls back to that color's first stop as a solid fill.
 */
const getLandingTextStyle = (
  colorIndex: number,
  menuStyle: MenuStyle,
  drawColors: readonly string[],
  isGradient: boolean,
): CardStyle => {
  const solid = isGradient
    ? getGradientVariantStops(colorIndex)[0]
    : drawColors[colorIndex % drawColors.length];

  if (menuStyle === "pop") {
    return {
      className: "landing-text-pop",
      style: {
        color: solid,
        WebkitTextStroke: `2px hsl(0 0% 5%)`,
        paintOrder: "stroke fill",
        textShadow: "4px 4px 0px hsl(0 0% 5%)",
      },
    };
  }
  if (menuStyle === "glow") {
    return {
      className: "landing-text-glow",
      style: { color: solid, textShadow: `0 0 18px ${solid}, 0 0 36px ${solid}88` },
    };
  }
  if (menuStyle === "flat-outline") {
    return {
      className: "landing-text-flat-outline",
      style: {
        color: solid,
        WebkitTextStroke: `1.5px hsl(0 0% 5% / 0.35)`,
        paintOrder: "stroke fill",
      },
    };
  }
  return {
    className: "landing-text-flat",
    style: { color: solid, textShadow: "2px 2px 4px rgb(0 0 0 / 0.15)" },
  };
};

const floatingShapes = (draw: readonly string[], hl: readonly string[], grad: boolean): Shape[] => [
  { type: "box", className: "top-8 left-10 w-14 h-14 rotate-12 animate-float", color: draw[2], gradientStops: grad ? getGradientVariantStops(2) : undefined },
  { type: "box", className: "bottom-12 right-14 w-10 h-10 -rotate-6 animate-wiggle", color: hl[2], gradientStops: grad ? getGradientVariantStops(1) : undefined },
  { type: "box", className: "top-1/4 right-20 w-8 h-8 rotate-45 animate-float", color: draw[5], gradientStops: grad ? getGradientVariantStops(5) : undefined },
  { type: "box", className: "bottom-1/3 left-16 w-10 h-10 -rotate-12 animate-wiggle", color: draw[4], gradientStops: grad ? getGradientVariantStops(4) : undefined },
  { type: "box", className: "top-16 right-1/3 w-12 h-12 rounded-full rotate-6 animate-float [animation-delay:0.5s]", color: draw[1], gradientStops: grad ? getGradientVariantStops(1) : undefined },
  { type: "box", className: "bottom-20 left-1/4 w-8 h-8 rounded-full -rotate-3 animate-wiggle [animation-delay:1s]", color: draw[3], gradientStops: grad ? getGradientVariantStops(3) : undefined },
  { type: "icon", icon: Star, className: "top-[12%] right-[12%] animate-wiggle [animation-delay:0.2s]", color: draw[2], size: 32, gradientId: grad ? "floating-shape-grad-2" : undefined },
  { type: "icon", icon: Hexagon, className: "bottom-[20%] left-[10%] animate-float [animation-delay:0.7s]", color: draw[4], size: 28, gradientId: grad ? "floating-shape-grad-4" : undefined },
  { type: "icon", icon: Circle, className: "top-[60%] right-[8%] animate-wiggle [animation-delay:1.2s]", color: hl[2], size: 24, gradientId: grad ? "floating-shape-grad-1" : undefined },
  { type: "icon", icon: Triangle, className: "top-[18%] left-[25%] animate-float [animation-delay:0.4s]", color: draw[1], size: 26, gradientId: grad ? "floating-shape-grad-1" : undefined },
  { type: "icon", icon: Heart, className: "bottom-[30%] right-[25%] animate-wiggle [animation-delay:0.9s]", color: hl[0], size: 22, gradientId: grad ? "floating-shape-grad-0" : undefined },
  { type: "icon", icon: Diamond, className: "top-[45%] left-[6%] animate-float [animation-delay:1.5s]", color: draw[3], size: 30, gradientId: grad ? "floating-shape-grad-3" : undefined },
  { type: "icon", icon: Sparkles, className: "top-[8%] left-[50%] animate-float [animation-delay:1.1s]", color: draw[2], size: 24, gradientId: grad ? "floating-shape-grad-2" : undefined },
];

const sectionShapes = (draw: readonly string[], hl: readonly string[], grad: boolean): Shape[][] => [
  // 0 features
  [
    { type: "box", className: "top-6 right-[8%] w-10 h-10 rotate-12 animate-float [animation-delay:0.3s]", color: draw[2], gradientStops: grad ? getGradientVariantStops(2) : undefined },
    { type: "box", className: "bottom-10 left-[5%] w-8 h-8 -rotate-6 animate-wiggle [animation-delay:0.7s]", color: draw[4], gradientStops: grad ? getGradientVariantStops(4) : undefined },
    { type: "icon", icon: Star, className: "top-[30%] left-[3%] animate-float [animation-delay:1s]", color: hl[2], size: 22, gradientId: grad ? "floating-shape-grad-1" : undefined },
    { type: "icon", icon: Diamond, className: "bottom-[20%] right-[5%] animate-wiggle [animation-delay:0.5s]", color: draw[3], size: 26, gradientId: grad ? "floating-shape-grad-3" : undefined },
  ],
  // 1 demo / how-it-works
  [
    { type: "box", className: "top-8 left-[6%] w-9 h-9 rotate-[25deg] animate-wiggle [animation-delay:0.4s]", color: hl[2], gradientStops: grad ? getGradientVariantStops(0) : undefined },
    { type: "icon", icon: Hexagon, className: "bottom-[15%] right-[7%] animate-float [animation-delay:0.9s]", color: draw[2], size: 24, gradientId: grad ? "floating-shape-grad-2" : undefined },
    { type: "icon", icon: Heart, className: "top-[20%] right-[12%] animate-wiggle [animation-delay:1.1s]", color: draw[1], size: 20, gradientId: grad ? "floating-shape-grad-1" : undefined },
  ],
  // 2 settings
  [
    { type: "box", className: "top-8 right-[6%] w-10 h-10 rotate-12 animate-wiggle [animation-delay:0.3s]", color: draw[2], gradientStops: grad ? getGradientVariantStops(2) : undefined },
    { type: "icon", icon: Sparkles, className: "bottom-[20%] left-[5%] animate-float [animation-delay:0.8s]", color: draw[4], size: 26, gradientId: grad ? "floating-shape-grad-4" : undefined },
    { type: "icon", icon: Circle, className: "top-[50%] right-[8%] animate-wiggle [animation-delay:0.5s]", color: hl[2], size: 24, gradientId: grad ? "floating-shape-grad-1" : undefined },
  ],
  // 3 use cases
  [
    { type: "box", className: "top-10 right-[6%] w-11 h-11 rotate-6 animate-float [animation-delay:0.2s]", color: draw[4], gradientStops: grad ? getGradientVariantStops(4) : undefined },
    { type: "icon", icon: Sparkles, className: "bottom-[25%] left-[4%] animate-wiggle [animation-delay:0.8s]", color: draw[2], size: 26, gradientId: grad ? "floating-shape-grad-2" : undefined },
    { type: "icon", icon: Triangle, className: "top-[35%] left-[7%] animate-float [animation-delay:0.5s]", color: hl[2], size: 22, gradientId: grad ? "floating-shape-grad-1" : undefined },
  ],
  // 4 pricing
  [
    { type: "box", className: "top-6 left-[5%] w-10 h-10 rotate-[18deg] animate-wiggle [animation-delay:0.3s]", color: draw[1], gradientStops: grad ? getGradientVariantStops(1) : undefined },
    { type: "icon", icon: Star, className: "top-[45%] right-[4%] animate-float [animation-delay:0.7s]", color: draw[4], size: 28, gradientId: grad ? "floating-shape-grad-4" : undefined },
    { type: "icon", icon: Circle, className: "bottom-[30%] right-[6%] animate-wiggle [animation-delay:0.4s]", color: draw[3], size: 20, gradientId: grad ? "floating-shape-grad-3" : undefined },
  ],
  // 5 faq
  [
    { type: "box", className: "top-10 left-[6%] w-9 h-9 rotate-[15deg] animate-float [animation-delay:0.4s]", color: draw[3], gradientStops: grad ? getGradientVariantStops(3) : undefined },
    { type: "icon", icon: Diamond, className: "top-[30%] right-[5%] animate-wiggle [animation-delay:0.8s]", color: draw[1], size: 24, gradientId: grad ? "floating-shape-grad-1" : undefined },
    { type: "icon", icon: Star, className: "bottom-[15%] right-[8%] animate-float [animation-delay:0.6s]", color: draw[4], size: 22, gradientId: grad ? "floating-shape-grad-4" : undefined },
  ],
];

export interface SuiteThemeInput {
  themeMode: string;
  colorPalette: string;
  menuStyle: MenuStyle;
  buttonRoundness: number;
  /** Settings FAB placement override; defaults to bottom-left. */
  fabStyle?: React.CSSProperties;
}

export function buildSuiteTheme({
  themeMode,
  colorPalette,
  menuStyle,
  buttonRoundness,
  fabStyle,
}: SuiteThemeInput): {
  theme: LandingTheme;
  card: (colorIndex: number, slot: number) => CardStyle;
  text: (colorIndex: number) => CardStyle;
} {
  const isGradient = colorPalette === "gradient";
  const isGlitter = colorPalette === "glitter";
  const { draw: drawColors, highlighter: highlighterColors } = getColors(
    colorPalette as Parameters<typeof getColors>[0],
  );
  const cssVars = { "--radius": `${(buttonRoundness / 100) * 1.5}rem` } as React.CSSProperties;

  // Bare-text variant for the "PopSuite" wordmark. No glitter overlay here —
  // landing-glitter's sparkle layer assumes a filled box to sit on top of,
  // which bare text doesn't have.
  const text = (colorIndex: number): CardStyle =>
    getLandingTextStyle(colorIndex, menuStyle, drawColors, isGradient);

  const card = (colorIndex: number, popSlot: number): CardStyle => {
    const popColor = drawColors[popSlot % drawColors.length];
    const base = getLandingCardStyle(colorIndex, menuStyle, drawColors, isGradient, popColor);
    if (!isGlitter) return base;
    const tint = (base.style.backgroundColor as string) ?? drawColors[colorIndex % drawColors.length];
    return {
      className: `${base.className} landing-glitter`,
      style: { ...base.style, "--glitter-tint": tint } as React.CSSProperties,
    };
  };

  const floats = floatingShapes(drawColors, highlighterColors, isGradient);
  const sections = sectionShapes(drawColors, highlighterColors, isGradient);

  const theme: LandingTheme = {
    themeMode,
    colors: drawColors,
    card,
    cssVars,
    renderFloatingShapes: () => renderShapes(floats),
    renderSectionShapes: (index) => renderShapes(sections[index]),
    fabStyle,
    defs: isGradient ? (
      <svg className="absolute inset-0 h-0 w-0 pointer-events-none" aria-hidden="true">
        <defs>
          {Array.from({ length: 6 }, (_, i) => (
            <linearGradient key={`floating-shape-grad-${i}`} id={`floating-shape-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              {getGradientVariantStops(i).map((stop, stopIndex) => (
                <stop
                  key={`floating-shape-grad-${i}-${stopIndex}`}
                  offset={`${(stopIndex / Math.max(1, getGradientVariantStops(i).length - 1)) * 100}%`}
                  stopColor={stop}
                />
              ))}
            </linearGradient>
          ))}
        </defs>
      </svg>
    ) : null,
  };

  return { theme, card, text };
}
