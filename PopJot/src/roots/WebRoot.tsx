import {
  Zap, PenLine, Sparkles, Star, Hexagon, Circle, Triangle, Heart, Diamond,
  MousePointer2, Palette, Keyboard, Bolt, Pen, Monitor, Code2, TvMinimal,
  MessageSquare, GraduationCap,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { MenuStyle } from "@/store/useStore";
import { getColors, getGradientVariantStops } from "@/config/themes";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import {
  LandingPage,
  type LandingContent,
  type LandingTheme,
} from "@shared/components/landing/LandingPage";
import { Kbd, HotkeyBadge } from "@shared/components/landing/Kbd";
import EngineShell from "@/engine/EngineShell";
import SystemTray from "@/components/SystemTray";

// ─── Store URLs here — swap in real links when ready ────────────────────────
const CHROME_STORE_URL: string | null = null;     // e.g. "https://chrome.google.com/webstore/detail/..."
const GITHUB_RELEASE_URL: string | null = null;   // e.g. "https://github.com/bradandersonjr/PopJot/releases/latest"
const LEMON_SQUEEZY_URL: string | null = null;    // e.g. "https://store.lemonsqueezy.com/buy/..."
const POPKEY_URL: string | null = null;           // e.g. "https://popkey.app"
// ────────────────────────────────────────────────────────────────────────────

type BoxShape = {
  type: "box";
  className: string;
  color: string;
  gradientStops?: readonly string[];
};

type IconShape = {
  type: "icon";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  className: string;
  color: string;
  size: number;
  gradientId?: string;
};

type Shape = BoxShape | IconShape;

const gradientCss = (stops: readonly string[]) => `linear-gradient(135deg, ${stops.join(", ")})`;

/* ─── Landing card style helper ─── */

const getLandingCardStyle = (
  colorIndex: number,
  menuStyle: MenuStyle,
  drawColors: readonly string[],
  isGradient: boolean,
  popColor?: string,
  monoColor?: string,
): { className: string; style: React.CSSProperties } => {
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
  if (menuStyle === "pop-mono") {
    return {
      className: "landing-card-pop-mono",
      style: { backgroundColor: monoColor ?? "#fcbf47" },
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

/* ─── Floating shapes (dynamic colors) ─── */

const getFloatingShapes = (drawColors: readonly string[], highlighterColors: readonly string[], useGradient: boolean): Shape[] => [
  { type: "box", className: "top-8 left-10 w-14 h-14 rotate-12 animate-float", color: drawColors[2], gradientStops: useGradient ? getGradientVariantStops(2) : undefined },
  { type: "box", className: "bottom-12 right-14 w-10 h-10 -rotate-6 animate-wiggle", color: highlighterColors[2], gradientStops: useGradient ? getGradientVariantStops(1) : undefined },
  { type: "box", className: "top-1/4 right-20 w-8 h-8 rotate-45 animate-float", color: drawColors[5], gradientStops: useGradient ? getGradientVariantStops(5) : undefined },
  { type: "box", className: "bottom-1/3 left-16 w-10 h-10 -rotate-12 animate-wiggle", color: drawColors[4], gradientStops: useGradient ? getGradientVariantStops(4) : undefined },
  { type: "box", className: "top-16 right-1/3 w-12 h-12 rounded-full rotate-6 animate-float [animation-delay:0.5s]", color: drawColors[1], gradientStops: useGradient ? getGradientVariantStops(1) : undefined },
  { type: "box", className: "bottom-20 left-1/4 w-8 h-8 rounded-full -rotate-3 animate-wiggle [animation-delay:1s]", color: drawColors[3], gradientStops: useGradient ? getGradientVariantStops(3) : undefined },
  { type: "box", className: "top-1/3 left-[8%] w-6 h-6 rotate-[20deg] animate-wiggle [animation-delay:0.3s]", color: highlighterColors[2], gradientStops: useGradient ? getGradientVariantStops(0) : undefined },
  { type: "box", className: "bottom-[15%] right-[10%] w-7 h-7 -rotate-[15deg] animate-float [animation-delay:0.8s]", color: drawColors[2], gradientStops: useGradient ? getGradientVariantStops(2) : undefined },
  { type: "icon", icon: Star, className: "top-[12%] right-[12%] animate-wiggle [animation-delay:0.2s]", color: drawColors[2], size: 32, gradientId: useGradient ? "floating-shape-grad-2" : undefined },
  { type: "icon", icon: Hexagon, className: "bottom-[20%] left-[10%] animate-float [animation-delay:0.7s]", color: drawColors[4], size: 28, gradientId: useGradient ? "floating-shape-grad-4" : undefined },
  { type: "icon", icon: Circle, className: "top-[60%] right-[8%] animate-wiggle [animation-delay:1.2s]", color: highlighterColors[2], size: 24, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  { type: "icon", icon: Triangle, className: "top-[18%] left-[25%] animate-float [animation-delay:0.4s]", color: drawColors[1], size: 26, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  { type: "icon", icon: Heart, className: "bottom-[30%] right-[25%] animate-wiggle [animation-delay:0.9s]", color: highlighterColors[0], size: 22, gradientId: useGradient ? "floating-shape-grad-0" : undefined },
  { type: "icon", icon: Diamond, className: "top-[45%] left-[6%] animate-float [animation-delay:1.5s]", color: drawColors[3], size: 30, gradientId: useGradient ? "floating-shape-grad-3" : undefined },
  { type: "icon", icon: Star, className: "bottom-[10%] left-[40%] animate-wiggle [animation-delay:0.6s]", color: drawColors[1], size: 20, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  { type: "icon", icon: Sparkles, className: "top-[8%] left-[50%] animate-float [animation-delay:1.1s]", color: drawColors[2], size: 24, gradientId: useGradient ? "floating-shape-grad-2" : undefined },
];

const getSectionShapes = (drawColors: readonly string[], highlighterColors: readonly string[], useGradient: boolean): Shape[][] => [
  // Features section
  [
    { type: "box" as const, className: "top-6 right-[8%] w-10 h-10 rotate-12 animate-float [animation-delay:0.3s]", color: drawColors[2], gradientStops: useGradient ? getGradientVariantStops(2) : undefined },
    { type: "box" as const, className: "bottom-10 left-[5%] w-8 h-8 -rotate-6 animate-wiggle [animation-delay:0.7s]", color: drawColors[4], gradientStops: useGradient ? getGradientVariantStops(4) : undefined },
    { type: "icon" as const, icon: Star, className: "top-[30%] left-[3%] animate-float [animation-delay:1s]", color: highlighterColors[2], size: 22, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
    { type: "icon" as const, icon: Diamond, className: "bottom-[20%] right-[5%] animate-wiggle [animation-delay:0.5s]", color: drawColors[3], size: 26, gradientId: useGradient ? "floating-shape-grad-3" : undefined },
    { type: "box" as const, className: "top-[50%] right-[3%] w-6 h-6 rounded-full animate-float [animation-delay:1.3s]", color: drawColors[1], gradientStops: useGradient ? getGradientVariantStops(1) : undefined },
  ],
  // How it works section
  [
    { type: "box" as const, className: "top-8 left-[6%] w-9 h-9 rotate-[25deg] animate-wiggle [animation-delay:0.4s]", color: highlighterColors[2], gradientStops: useGradient ? getGradientVariantStops(0) : undefined },
    { type: "icon" as const, icon: Hexagon, className: "bottom-[15%] right-[7%] animate-float [animation-delay:0.9s]", color: drawColors[2], size: 24, gradientId: useGradient ? "floating-shape-grad-2" : undefined },
    { type: "box" as const, className: "top-[40%] right-[4%] w-7 h-7 -rotate-12 animate-float [animation-delay:0.6s]", color: drawColors[3], gradientStops: useGradient ? getGradientVariantStops(3) : undefined },
    { type: "icon" as const, icon: Heart, className: "top-[20%] right-[12%] animate-wiggle [animation-delay:1.1s]", color: drawColors[1], size: 20, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  ],
  // Settings section
  [
    { type: "box" as const, className: "top-8 right-[6%] w-10 h-10 rotate-12 animate-wiggle [animation-delay:0.3s]", color: drawColors[2], gradientStops: useGradient ? getGradientVariantStops(2) : undefined },
    { type: "icon" as const, icon: Sparkles, className: "bottom-[20%] left-[5%] animate-float [animation-delay:0.8s]", color: drawColors[4], size: 26, gradientId: useGradient ? "floating-shape-grad-4" : undefined },
    { type: "box" as const, className: "top-[35%] left-[7%] w-8 h-8 -rotate-6 animate-float [animation-delay:1.1s]", color: drawColors[3], gradientStops: useGradient ? getGradientVariantStops(3) : undefined },
    { type: "icon" as const, icon: Circle, className: "top-[50%] right-[8%] animate-wiggle [animation-delay:0.5s]", color: highlighterColors[2], size: 24, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  ],
  // Use cases section
  [
    { type: "box" as const, className: "top-10 right-[6%] w-11 h-11 rotate-6 animate-float [animation-delay:0.2s]", color: drawColors[4], gradientStops: useGradient ? getGradientVariantStops(4) : undefined },
    { type: "icon" as const, icon: Sparkles, className: "bottom-[25%] left-[4%] animate-wiggle [animation-delay:0.8s]", color: drawColors[2], size: 26, gradientId: useGradient ? "floating-shape-grad-2" : undefined },
    { type: "box" as const, className: "bottom-8 right-[10%] w-7 h-7 rounded-full -rotate-[15deg] animate-float [animation-delay:1.4s]", color: highlighterColors[0], gradientStops: useGradient ? getGradientVariantStops(0) : undefined },
    { type: "icon" as const, icon: Triangle, className: "top-[35%] left-[7%] animate-float [animation-delay:0.5s]", color: highlighterColors[2], size: 22, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
  ],
  // Pricing section
  [
    { type: "box" as const, className: "top-6 left-[5%] w-10 h-10 rotate-[18deg] animate-wiggle [animation-delay:0.3s]", color: drawColors[1], gradientStops: useGradient ? getGradientVariantStops(1) : undefined },
    { type: "icon" as const, icon: Star, className: "top-[45%] right-[4%] animate-float [animation-delay:0.7s]", color: drawColors[4], size: 28, gradientId: useGradient ? "floating-shape-grad-4" : undefined },
    { type: "box" as const, className: "bottom-12 left-[8%] w-8 h-8 -rotate-6 animate-float [animation-delay:1.2s]", color: highlighterColors[2], gradientStops: useGradient ? getGradientVariantStops(0) : undefined },
    { type: "icon" as const, icon: Circle, className: "bottom-[30%] right-[6%] animate-wiggle [animation-delay:0.4s]", color: drawColors[3], size: 20, gradientId: useGradient ? "floating-shape-grad-3" : undefined },
    { type: "box" as const, className: "top-[25%] right-[9%] w-6 h-6 rounded-full animate-float [animation-delay:0.9s]", color: drawColors[2], gradientStops: useGradient ? getGradientVariantStops(2) : undefined },
  ],
  // FAQ section
  [
    { type: "box" as const, className: "top-10 left-[6%] w-9 h-9 rotate-[15deg] animate-float [animation-delay:0.4s]", color: drawColors[3], gradientStops: useGradient ? getGradientVariantStops(3) : undefined },
    { type: "icon" as const, icon: Diamond, className: "top-[30%] right-[5%] animate-wiggle [animation-delay:0.8s]", color: drawColors[1], size: 24, gradientId: useGradient ? "floating-shape-grad-1" : undefined },
    { type: "box" as const, className: "bottom-[20%] left-[4%] w-7 h-7 rounded-full -rotate-12 animate-wiggle [animation-delay:1.2s]", color: highlighterColors[2], gradientStops: useGradient ? getGradientVariantStops(0) : undefined },
    { type: "icon" as const, icon: Star, className: "bottom-[15%] right-[8%] animate-float [animation-delay:0.6s]", color: drawColors[4], size: 22, gradientId: useGradient ? "floating-shape-grad-4" : undefined },
  ],
];

const renderShapes = (shapes: readonly Shape[], menuStyle: MenuStyle, themeMode: "dark" | "light", monoColor?: string) => {
  const defaultMonoColor = themeMode === "dark" ? "#242424" : "#F8F8F6";
  const isMonoStyle = menuStyle === "pop-mono";
  const finalMonoColor = isMonoStyle && monoColor ? monoColor : defaultMonoColor;
  return shapes.map((shape) =>
    shape.type === "box" ? (
      <div
        key={shape.className}
        className={`absolute z-0 neo-box hidden md:block opacity-30 ${shape.className}`}
        style={isMonoStyle ? { backgroundColor: finalMonoColor } : shape.gradientStops ? { backgroundImage: gradientCss(shape.gradientStops) } : { backgroundColor: shape.color }}
      />
    ) : (
      <shape.icon
        key={shape.className}
        className={`absolute z-0 hidden md:block opacity-30 ${shape.className}`}
        size={shape.size}
        strokeWidth={2.5}
        color={isMonoStyle ? finalMonoColor : shape.gradientId ? `url(#${shape.gradientId})` : shape.color}
      />
    )
  );
};

/* ─── Component ─── */

const WebRoot = () => {
  const { themeMode, colorPalette, menuStyle, hotkey, persistentHotkey, setScaleFactor, popMonoColor } = useStore();
  useScaleSync(setScaleFactor);

  const isGradient = colorPalette === "gradient";
  const { draw: drawColors, highlighter: highlighterColors } = getColors(colorPalette);

  // Deterministic color sequence: each slot cycles through all 6 colors in order.
  // No two adjacent slots share a color; groups of ≤6 each get exactly one of each color.
  const card = (colorIndex: number, popSlot: number) => {
    const popColor = drawColors[popSlot % drawColors.length];
    return getLandingCardStyle(colorIndex, menuStyle, drawColors, isGradient, popColor, popMonoColor);
  };

  const floatingShapes = getFloatingShapes(drawColors, highlighterColors, isGradient);
  const sectionShapes = getSectionShapes(drawColors, highlighterColors, isGradient);

  const content: LandingContent = {
    appName: "PopJot",
    hero: {
      brand: <img src="/popjot-logo.png" alt="PopJot" className="w-80 md:w-96 h-auto" />,
      tagline: "Screen annotation that stays out of your way.",
      pills: [
        { icon: Zap, label: "Instant & snappy", colorIndex: 0 },
        { icon: Bolt, label: "Radial menu", colorIndex: 1 },
        { icon: Sparkles, label: "Fully customizable", colorIndex: 2 },
      ],
      hint: (
        <>
          Hold <HotkeyBadge shortcut={hotkey} /> to activate &middot; release to clear
        </>
      ),
      footnote: <>Free &amp; open source &middot; Windows, macOS &amp; Linux &middot; Coming Soon</>,
    },
    demo: {
      heading: <>See it in <span className="text-secondary">action</span></>,
      description: "Watch how fast you can annotate, highlight, and draw over anything on screen.",
    },
    features: {
      heading: <>Quick, <span className="text-primary">temporary</span> screen annotation</>,
      description: "Draw over anything on screen while you record, present, or share. When you're done, it all vanishes.",
      items: [
        { icon: Zap, label: "Instant activation", description: "One hotkey summons a transparent canvas. Annotate over anything on screen — your audience sees it live.", colorIndex: 2 },
        { icon: Bolt, label: "Radial menu", description: "Right-click to open a circular tool picker. Choose your tool and color in one fluid gesture — no toolbar hunting.", colorIndex: 4 },
        { icon: PenLine, label: "Marker, pen & highlighter", description: "Three drawing tools — thick markers for emphasis, precise pens for detail, and translucent highlighters for callouts.", colorIndex: 0 },
        { icon: MousePointer2, label: "Straight line snapping", description: "Hold right-click while drawing to snap to perfectly straight lines. Point at exactly what you mean.", colorIndex: 3 },
        { icon: Palette, label: "Themes & palettes", description: "4 menu styles, 6 color palettes, dark or light theme, and 3 animation intensities. Make it yours.", colorIndex: 1 },
        { icon: Monitor, label: "Temporary by nature", description: "Annotations live on screen while you need them, then vanish. Release the hotkey or press Escape — clean slate.", colorIndex: 5 },
      ],
    },
    howItWorks: {
      heading: <>Three steps. <span className="text-secondary">That&apos;s it.</span></>,
      description: "No setup wizards. No learning curve. Activate, pick a tool, draw. You'll have it down in seconds.",
      steps: [
        { icon: Keyboard, number: "1", title: "Activate", description: "Press and hold a hotkey — a transparent canvas appears instantly on top of your screen.", colorIndex: 2 },
        { icon: Bolt, number: "2", title: "Pick a tool", description: "Right-click to open the radial menu. Hover a tool, glide to a color — selected in one smooth motion.", colorIndex: 4 },
        { icon: PenLine, number: "3", title: "Annotate", description: "Circle, underline, highlight. Release the hotkey when you're done — everything vanishes. Back to a clean screen.", colorIndex: 0 },
      ],
      extra: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Keyboard,
              title: "Two activation modes",
              colorIndex: 3,
              content: (
                <>
                  Hold <HotkeyBadge shortcut={hotkey} /> for quick annotations that
                  disappear when you release. Press{" "}
                  <HotkeyBadge shortcut={persistentHotkey} /> to stay in drawing mode
                  until you press <Kbd>Esc</Kbd>.
                </>
              ),
            },
            {
              icon: Bolt,
              title: "Radial tool picker",
              colorIndex: 5,
              content: (
                <>
                  Right-click to open a radial menu with marker, pen, highlighter, eraser,
                  and whiteboard modes. Hover to select a tool, then glide into a submenu
                  to pick your color — all in one gesture.
                </>
              ),
            },
            {
              icon: Pen,
              title: "Freehand & straight lines",
              colorIndex: 1,
              content: (
                <>
                  Draw naturally with freehand strokes. Hold <Kbd>right-click</Kbd> while
                  drawing to snap to a straight line. Press <Kbd>middle-click</Kbd> to
                  undo. Scroll to resize your brush on the fly.
                </>
              ),
            },
            {
              icon: TvMinimal,
              title: "Whiteboard backgrounds",
              colorIndex: 3,
              content: (
                <>
                  Use the screen tool to switch between a transparent canvas, a dark
                  whiteboard, or a light whiteboard. Optional grid and dot patterns
                  help you align your drawings.
                </>
              ),
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`${card(f.colorIndex, 16 + i).className} neo-box-hover p-6 flex flex-col gap-3 relative overflow-hidden`}
              style={card(f.colorIndex, 16 + i).style}
            >
              <div className="relative z-10 flex items-center gap-3">
                <f.icon className="w-6 h-6 text-foreground" strokeWidth={2.5} />
                <h3 className="font-display text-lg font-bold text-foreground">{f.title}</h3>
              </div>
              <p className="relative z-10 font-body text-sm text-foreground/80 leading-relaxed">
                {f.content}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    settings: {
      heading: <>Make it <span className="text-primary">yours</span></>,
      description: "Menu styles, color palettes, themes, and animation intensity. Tweak everything until it feels right.",
    },
    useCases: {
      heading: <>PopJot is perfect <span className="text-accent">for</span></>,
      description: "Anyone who needs to point at something on screen — quickly, temporarily, without interrupting their flow.",
      items: [
        { icon: Monitor, title: "Tutorial Creators", description: "Record Fusion, Blender, or any app tutorial and circle buttons, underline menus, draw arrows — all live on screen while you narrate.", colorIndex: 1 },
        { icon: MessageSquare, title: "Screen Sharing & Calls", description: "Annotate during Zoom, Teams, or Discord calls. Your audience sees the marks in real-time, then they vanish when you're done.", colorIndex: 3 },
        { icon: Code2, title: "Code Reviews & Demos", description: "Highlight lines of code, circle bugs, draw attention to diffs. Quick, temporary marks that disappear after the conversation.", colorIndex: 0 },
        { icon: GraduationCap, title: "Presentations & Teaching", description: "Emphasize key points on slides, diagrams, or any application. No switching apps — annotate right over what's on screen.", colorIndex: 5 },
      ],
    },
    pricing: {
      heading: <>Free forever. <span className="text-primary">Support if you love it.</span></>,
      description: "PopJot is free and open source. Sponsor the project to unlock Pro perks and keep development going.",
      planMinHeight: 512,
      plans: [
        { name: "PopJot Extension", price: "Free", period: "forever", colorIndex: 2, ctaColorIndex: 3, popular: false, features: ["Annotate over any webpage", "Marker, pen & highlighter", "Radial menu tool picker", "Chrome & Chromium browsers", "No install required"], cta: "Add to Chrome", url: CHROME_STORE_URL },
        { name: "PopJot Desktop", price: "Free", period: "open source", colorIndex: 4, ctaColorIndex: 1, popular: true, features: ["Transparent overlay over any app", "Marker, pen & highlighter", "Radial menu tool picker", "4 menu styles & 6 color palettes", "Dark/light themes & animations", "Custom keyboard shortcuts", "Windows, macOS & Linux"], cta: "Download", url: GITHUB_RELEASE_URL },
        { name: "PopSuite Pro", price: "$9", period: "one-time", colorIndex: 0, ctaColorIndex: 5, popular: false, features: ["Everything in Desktop", "Includes PopJot + PopKey", "Custom color palettes", "Custom radial menu center icon", "Scalable center shape", "Support open source development"], cta: "Get Pro", url: LEMON_SQUEEZY_URL, crossLink: { label: "Also includes PopKey", href: POPKEY_URL } },
      ],
    },
    faq: {
      heading: <>Got <span className="text-primary">questions?</span></>,
      description: "Everything you need to know about PopJot.",
      items: [
        { question: "What exactly is PopJot?", answer: "PopJot is a screen annotation tool. Press a hotkey and a transparent canvas appears on top of your screen. Draw, circle, highlight — your audience sees it live. Release the hotkey and everything vanishes." },
        { question: "Is this a screenshot tool?", answer: "No. PopJot is for live, temporary annotation — think circling a button while recording a tutorial, or highlighting code during a screen share. It doesn't capture or save images." },
        { question: "How does PopSuite Pro work?", answer: "Pay $9 once via Lemon Squeezy and get a download link for the Pro build. No subscriptions, no recurring charges. Pro perks include custom color palettes, a custom radial menu center icon, and a scalable center circle." },
        { question: "What platforms are supported?", answer: "Windows, macOS, and Linux. PopJot is built with Electron so it runs natively on all three." },
        { question: "Can I use this during Zoom / Teams / Discord calls?", answer: "Yes. PopJot draws on top of your entire screen, so your annotations show up in any screen share or recording. Your audience sees exactly what you draw." },
        { question: "How do I pick tools and colors?", answer: "Right-click to open a radial menu. Hover over a tool (marker, pen, highlighter, eraser), then glide into a submenu to pick your color. It's designed for speed — one fluid gesture." },
      ],
    },
  };

  const theme: LandingTheme = {
    themeMode,
    colors: drawColors,
    card,
    renderFloatingShapes: () => renderShapes(floatingShapes, menuStyle, themeMode, popMonoColor),
    renderSectionShapes: (index) => renderShapes(sectionShapes[index], menuStyle, themeMode, popMonoColor),
    // Gradient SVG defs (hidden, referenced by floating icons)
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

  return (
    <LandingPage
      content={content}
      theme={theme}
      settingsPanel={<SystemTray embedded />}
      engine={<EngineShell />}
    />
  );
};

export default WebRoot;
