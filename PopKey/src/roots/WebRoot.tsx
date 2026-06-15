import React from "react";
import {
  Zap, Sparkles, Star, Hexagon, Circle, Triangle, Heart, Diamond,
  MousePointer2, Keyboard, Monitor, Code2, TvMinimal, MessageSquare,
  GraduationCap, Mouse, Settings,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getBadgeColors } from "@/config/themes";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import {
  LandingPage,
  type LandingContent,
  type LandingTheme,
} from "@shared/components/landing/LandingPage";
import EngineShell from "@/engine/EngineShell";
import SystemTray from "@/components/SystemTray";

// ─── Store URLs here — swap in real links when ready ────────────────────────
const CHROME_STORE_URL: string | null = null;     // e.g. "https://chrome.google.com/webstore/detail/..."
const GITHUB_RELEASE_URL: string | null = null;   // e.g. "https://github.com/bradandersonjr/PopKey/releases/latest"
const POPJOT_URL: string | null = null;           // e.g. "https://popjot.app"
// ────────────────────────────────────────────────────────────────────────────

type BoxShape = {
  type: "box";
  className: string;
  color: string;
};

type IconShape = {
  type: "icon";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  className: string;
  color: string;
  size: number;
};

type Shape = BoxShape | IconShape;

/* ─── Floating shapes ─── */
const getFloatingShapes = (colors: readonly string[]): Shape[] => [
  { type: "box", className: "top-8 left-10 w-14 h-14 rotate-12 animate-float", color: colors[2] },
  { type: "box", className: "bottom-12 right-14 w-10 h-10 -rotate-6 animate-wiggle", color: colors[4] },
  { type: "box", className: "top-1/4 right-20 w-8 h-8 rotate-45 animate-float", color: colors[5] },
  { type: "box", className: "bottom-1/3 left-16 w-10 h-10 -rotate-12 animate-wiggle", color: colors[3] },
  { type: "box", className: "top-16 right-1/3 w-12 h-12 rounded-full rotate-6 animate-float [animation-delay:0.5s]", color: colors[1] },
  { type: "box", className: "bottom-20 left-1/4 w-8 h-8 rounded-full -rotate-3 animate-wiggle [animation-delay:1s]", color: colors[0] },
  { type: "icon", icon: Star, className: "top-[15%] right-[12%] animate-float [animation-delay:0.5s]", color: colors[0], size: 28 },
  { type: "icon", icon: Circle, className: "top-[60%] right-[8%] animate-wiggle [animation-delay:1.2s]", color: colors[3], size: 24 },
  { type: "icon", icon: Heart, className: "bottom-[30%] right-[25%] animate-wiggle [animation-delay:0.9s]", color: colors[1], size: 22 },
  { type: "icon", icon: Diamond, className: "top-[40%] left-[5%] animate-float [animation-delay:1.5s]", color: colors[5], size: 26 },
  { type: "icon", icon: Triangle, className: "bottom-[20%] left-[10%] animate-wiggle [animation-delay:0.4s]", color: colors[2], size: 20 },
  { type: "icon", icon: Hexagon, className: "top-[70%] left-[20%] animate-float [animation-delay:0.7s]", color: colors[4], size: 24 },
];

const getSectionShapes = (colors: readonly string[]): Shape[][] => [
  [
    { type: "box", className: "top-6 right-[8%] w-10 h-10 rotate-12 animate-float [animation-delay:0.3s]", color: colors[2] },
    { type: "box", className: "bottom-10 left-[5%] w-8 h-8 -rotate-6 animate-wiggle [animation-delay:0.7s]", color: colors[4] },
    { type: "icon", icon: Star, className: "top-[30%] left-[3%] animate-float [animation-delay:1s]", color: colors[0], size: 22 },
  ],
  [
    { type: "box", className: "top-10 left-[6%] w-10 h-10 rotate-6 animate-wiggle [animation-delay:0.2s]", color: colors[1] },
    { type: "icon", icon: Diamond, className: "bottom-[15%] right-[5%] animate-float [animation-delay:0.6s]", color: colors[3], size: 24 },
  ],
  [
    { type: "box", className: "top-[20%] right-[4%] w-8 h-8 -rotate-12 animate-float [animation-delay:0.4s]", color: colors[5] },
    { type: "icon", icon: Hexagon, className: "bottom-[25%] left-[4%] animate-wiggle [animation-delay:0.9s]", color: colors[0], size: 22 },
  ],
  [
    { type: "box", className: "top-12 right-[10%] w-10 h-10 rotate-3 animate-float [animation-delay:0.5s]", color: colors[3] },
    { type: "icon", icon: Triangle, className: "bottom-16 left-[8%] animate-wiggle [animation-delay:1.1s]", color: colors[1], size: 20 },
  ],
  [
    { type: "box", className: "top-8 left-[7%] w-8 h-8 rotate-[20deg] animate-float [animation-delay:0.3s]", color: colors[4] },
    { type: "icon", icon: Star, className: "bottom-12 right-[6%] animate-wiggle [animation-delay:0.8s]", color: colors[2], size: 24 },
  ],
  [
    { type: "box", className: "top-6 right-[5%] w-10 h-10 -rotate-6 animate-wiggle [animation-delay:0.4s]", color: colors[0] },
    { type: "icon", icon: Circle, className: "bottom-[20%] left-[6%] animate-float [animation-delay:1s]", color: colors[5], size: 20 },
  ],
];

/* ─── Render shapes ─── */
const renderShapes = (shapes: Shape[], themeMode: string) =>
  shapes.map((shape, i) =>
    shape.type === "box" ? (
      <div
        key={`shape-${i}`}
        className={`absolute neo-box pointer-events-none select-none ${shape.className}`}
        style={{ backgroundColor: shape.color, opacity: themeMode === "dark" ? 0.15 : 0.25 }}
      />
    ) : (
      <shape.icon
        key={`shape-${i}`}
        className={`absolute pointer-events-none select-none ${shape.className}`}
        style={{ color: shape.color, opacity: themeMode === "dark" ? 0.15 : 0.25 }}
        size={shape.size}
        strokeWidth={2}
      />
    )
  );

/* ─── Component ─── */

const WebRoot = () => {
  const { themeMode, colorPalette, setScaleFactor, displayPosition } = useStore();
  useScaleSync(setScaleFactor);

  const colors = getBadgeColors(colorPalette);
  const card = (colorIndex: number) => ({
    className: "neo-box",
    style: { backgroundColor: colors[colorIndex % colors.length] } as React.CSSProperties,
  });

  // FAB stays on the bottom, opposite side from the HUD overlay
  const fabOnLeft = !displayPosition.includes("left");
  const fabStyle: React.CSSProperties = {
    bottom: "1.5rem",
    left: fabOnLeft ? "1.5rem" : "auto",
    right: fabOnLeft ? "auto" : "1.5rem",
  };

  const content: LandingContent = {
    appName: "PopKey",
    hero: {
      brand: <h1 className="font-display text-6xl md:text-8xl font-bold text-foreground">PopKey</h1>,
      tagline: <>On-screen keyboard &amp; mouse overlay that stays out of your way.</>,
      pills: [
        { icon: Zap, label: "Instant & snappy", colorIndex: 0 },
        { icon: Keyboard, label: "Key & mouse badges", colorIndex: 1 },
        { icon: Sparkles, label: "Fully customizable", colorIndex: 2 },
      ],
      hint: "Type or click anywhere to see it in action",
      footnote: <>Free &amp; open source &middot; Windows, macOS &amp; Linux &middot; Coming Soon</>,
    },
    demo: {
      heading: <>See it in <span className="text-secondary">action</span></>,
      description: "Watch how PopKey displays your keyboard and mouse input in real-time.",
    },
    features: {
      heading: <>Every input, <span className="text-primary">visualized</span></>,
      description: "Keyboard presses, mouse clicks, scroll wheel — all displayed as beautiful on-screen badges.",
      items: [
        { icon: Keyboard, label: "Keyboard visualization", description: "Every keypress appears as a styled badge on screen. Modifiers, combos, and key sequences — all shown live.", colorIndex: 0 },
        { icon: Mouse, label: "Mouse click overlay", description: "Left, right, middle, double click, and drag — each gets its own badge. A ripple effect marks where you clicked.", colorIndex: 2 },
        { icon: MousePointer2, label: "Scroll indicator", description: "Scroll wheel activity shows directional arrows at the cursor position so your audience never loses track.", colorIndex: 4 },
        { icon: Sparkles, label: "5 color palettes", description: "Muted, vibrant, retro, neon, and pastel. Pick the palette that matches your recording style.", colorIndex: 1 },
        { icon: Settings, label: "Fully customizable", description: "Badge duration, max badges, position, font size, translucency, blur, roundness — tweak everything.", colorIndex: 3 },
        { icon: Monitor, label: "Transparent overlay", description: "Runs as a transparent layer on top of your screen. Your audience sees keystrokes over any app.", colorIndex: 5 },
      ],
    },
    howItWorks: {
      heading: <>Three steps. <span className="text-secondary">That&apos;s it.</span></>,
      description: "No configuration needed. Launch, customize if you want, and start recording.",
      steps: [
        { icon: Keyboard, number: "1", title: "Launch", description: "Start PopKey. It runs as a transparent overlay — invisible until you interact.", colorIndex: 2 },
        { icon: Settings, number: "2", title: "Customize", description: "Pick your color palette, badge style, position, and duration. Make it match your aesthetic.", colorIndex: 4 },
        { icon: TvMinimal, number: "3", title: "Record", description: "Start your recording. Every keypress and click shows up on screen automatically. That's it.", colorIndex: 0 },
      ],
    },
    settings: {
      heading: <>Make it <span className="text-primary">yours</span></>,
      description: "Badge style, color palette, position, duration, and more. Tweak everything until it feels right.",
    },
    useCases: {
      heading: <>PopKey is perfect <span className="text-accent">for</span></>,
      description: "Anyone who needs their audience to see what they're pressing — without interrupting their flow.",
      items: [
        { icon: Monitor, title: "Tutorial Creators", description: "Show your audience exactly what keys and mouse buttons you're pressing. No more 'what shortcut was that?' comments.", colorIndex: 1 },
        { icon: MessageSquare, title: "Live Streaming", description: "Display your inputs during live streams so viewers can follow along. Works with OBS, Streamlabs, and any capture tool.", colorIndex: 3 },
        { icon: Code2, title: "Code Walkthroughs", description: "Highlight keyboard shortcuts and navigation as you walk through code. Great for Vim, VS Code, or terminal demos.", colorIndex: 0 },
        { icon: GraduationCap, title: "Teaching & Training", description: "Students see every keystroke as you demonstrate software. No more 'can you do that again slower?' — it's all on screen.", colorIndex: 5 },
      ],
    },
    pricing: {
      heading: <>Free forever. <span className="text-primary">Open source.</span></>,
      description: "PopKey is free and open source. Use it however you want.",
      planMinHeight: 460,
      plans: [
        { name: "PopKey Extension", price: "Free", period: "forever", colorIndex: 2, ctaColorIndex: 3, popular: false, features: ["Keyboard input display", "Mouse click badges", "5 color palettes", "Chrome & Chromium browsers", "No install required"], cta: "Add to Chrome", url: CHROME_STORE_URL },
        { name: "PopKey Desktop", price: "Free", period: "open source", colorIndex: 4, ctaColorIndex: 1, popular: true, features: ["Transparent overlay over any app", "Global keyboard capture", "Mouse click & scroll visualization", "4 badge styles & 5 palettes", "Dark/light themes", "Custom keyboard shortcut", "Windows, macOS & Linux"], cta: "Download", url: GITHUB_RELEASE_URL },
        { name: "PopSuite Pro", price: "$9", period: "one-time", colorIndex: 0, ctaColorIndex: 5, popular: false, features: ["Everything in Desktop", "Includes PopKey + PopJot", "Custom color palettes", "Custom badge styles", "Support open source development"], cta: "Get Pro", url: null, crossLink: { label: "Also includes PopJot", href: POPJOT_URL } },
      ],
    },
    faq: {
      heading: <>Got <span className="text-primary">questions?</span></>,
      description: "Everything you need to know about PopKey.",
      items: [
        { question: "What exactly is PopKey?", answer: "PopKey is an on-screen input visualizer. It displays your keyboard presses, mouse clicks, and scroll wheel activity as styled badges overlaid on your screen — perfect for tutorials, recordings, and live streams." },
        { question: "Does it capture or log my input?", answer: "No. PopKey only displays inputs in real-time on your screen. Nothing is stored, logged, or transmitted. It's purely visual." },
        { question: "What platforms are supported?", answer: "Windows, macOS, and Linux. PopKey is built with Electron so it runs natively on all three." },
        { question: "Can I use this during screen recordings?", answer: "Yes — that's exactly what it's for. PopKey draws on a transparent overlay so your inputs show up in any screen recorder, OBS capture, or screen share." },
        { question: "Can I customize the appearance?", answer: "Absolutely. Badge style (flat, outlined, pop, mono), color palette, position, font size, translucency, blur, roundness, duration, and max badges on screen — everything is adjustable." },
        { question: "How is this different from other keystroke visualizers?", answer: "PopKey is designed to be snappy, beautiful, and stay out of your way. It supports keyboard, mouse clicks, scroll wheel, drag detection, and modifier combos — all with smooth animations and multiple visual styles." },
      ],
    },
  };

  const theme: LandingTheme = {
    themeMode,
    colors,
    card,
    renderFloatingShapes: () => renderShapes(getFloatingShapes(colors), themeMode),
    renderSectionShapes: (index) => renderShapes(getSectionShapes(colors)[index], themeMode),
    fabStyle,
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
