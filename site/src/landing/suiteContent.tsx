import {
  Zap, PenLine, Sparkles, Palette, Keyboard, Bolt, Pen,
  Monitor, Code2, TvMinimal, MessageSquare, GraduationCap, Mouse, Settings,
} from "lucide-react";
import type { LandingContent, CardStyle } from "@shared/components/landing/LandingPage";
import { Kbd, HotkeyBadge } from "@shared/components/landing/Kbd";

/**
 * Merged PopSuite landing content, adapted from the two retired per-app
 * WebRoots. Feature / how-it-works / use-case sections are interleaved and
 * clearly labeled per app. Pricing is reconciled into one section; the FAQ
 * dedupes the overlapping suite/Pro questions and labels the app-specific ones.
 */

// ─── Store URLs — swap in real links when ready ─────────────────────────────
const GITHUB_RELEASE_URL: string | null =
  "https://github.com/bradandersonjr/PopSuite/releases";
const POPSUITE_PRO_URL: string | null = "https://ko-fi.com/s/264fd0031f";
const CHROME_STORE_URL: string | null = null;
// ────────────────────────────────────────────────────────────────────────────

interface Options {
  card: (colorIndex: number, slot: number) => CardStyle;
  popjotHotkey: string;
  popjotPersistentHotkey: string;
  popjotLastToolHotkey: string;
}

export function buildSuiteContent({
  card,
  popjotHotkey,
  popjotPersistentHotkey,
  popjotLastToolHotkey,
}: Options): LandingContent {
  return {
    appName: "PopSuite",
    hero: {
      brand: (
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-brand text-6xl md:text-8xl leading-none">
            <span className="text-pop-yellow">Pop</span>
            <span className="text-foreground">Suite</span>
          </h1>
          <p className="font-display text-sm md:text-base font-bold uppercase tracking-[0.3em] text-muted-foreground">
            PopJot + PopKey
          </p>
        </div>
      ),
      tagline: (
        <>
          Screen annotation and on-screen input, together in one download. Draw
          over anything, and show every key you press.
        </>
      ),
      pills: [
        { icon: PenLine, label: "Annotate", colorIndex: 0 },
        { icon: Keyboard, label: "Visualize input", colorIndex: 1 },
        { icon: Sparkles, label: "Fully customizable", colorIndex: 2 },
      ],
      hint: (
        <>
          Type anywhere to see PopKey &middot; hold{" "}
          <HotkeyBadge shortcut={popjotHotkey} /> to draw with PopJot
        </>
      ),
      footnote: (
        <>Free &amp; open source &middot; Windows, macOS &amp; Linux</>
      ),
    },
    demo: {
      heading: (
        <>
          See it in <span className="text-secondary">action</span>
        </>
      ),
      description:
        "Both engines are live on this page. Annotate over anything with PopJot, and every key and click shows up through PopKey.",
    },
    features: {
      heading: (
        <>
          Two tools, <span className="text-primary">one install</span>
        </>
      ),
      description:
        "PopJot draws over your screen; PopKey visualizes your input. Enable one or both — they run side by side without getting in each other's way.",
      items: [
        // ── PopJot ──
        { icon: Zap, label: "PopJot · Instant annotation", description: "One hotkey summons a transparent canvas. Annotate over anything on screen — your audience sees it live, then it vanishes.", colorIndex: 2 },
        { icon: Bolt, label: "PopJot · Radial menu", description: "Right-click to open a circular tool picker. Choose your tool and color in one fluid gesture — no toolbar hunting.", colorIndex: 4 },
        { icon: TvMinimal, label: "PopJot · Spotlight mode", description: "Dim the whole screen except a soft circle that follows your cursor — perfect for calling out one spot without drawing.", colorIndex: 0 },
        // ── PopKey ──
        { icon: Keyboard, label: "PopKey · Keyboard badges", description: "Every keypress appears as a styled badge on screen. Modifiers, combos, and key sequences — all shown live.", colorIndex: 1 },
        { icon: Mouse, label: "PopKey · Mouse & scroll", description: "Left, right, middle, double-click, drag, and scroll each get their own badge, with a ripple at the click point.", colorIndex: 3 },
        { icon: Palette, label: "Shared look & feel", description: "8 color palettes, 4 styles, dark or light theme, and adjustable animation. Set it once and sync it across both apps.", colorIndex: 5 },
      ],
    },
    howItWorks: {
      heading: (
        <>
          One tray. <span className="text-secondary">Both apps.</span>
        </>
      ),
      description:
        "PopSuite runs a single tray icon. PopJot and PopKey are independent underneath — toggle either one, and open one settings window with a tab for each.",
      steps: [
        { icon: Keyboard, number: "1", title: "Install once", description: "A single download installs PopSuite — PopJot and PopKey both included, both ready to go.", colorIndex: 2 },
        { icon: Settings, number: "2", title: "Toggle & tune", description: "Enable PopJot, PopKey, or both from the tray. Open Settings for a tab per app, and sync shared options.", colorIndex: 4 },
        { icon: TvMinimal, number: "3", title: "Record", description: "Annotate with PopJot and show your input with PopKey. While PopJot draws, PopKey steps aside automatically.", colorIndex: 0 },
      ],
      extra: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Keyboard,
              title: "PopJot · Three activation modes",
              colorIndex: 3,
              content: (
                <>
                  Hold <HotkeyBadge shortcut={popjotHotkey} /> for quick
                  annotations that disappear when you release, or{" "}
                  <HotkeyBadge shortcut={popjotLastToolHotkey} /> to skip the menu
                  and draw with your last tool. Press{" "}
                  <HotkeyBadge shortcut={popjotPersistentHotkey} /> to stay in
                  drawing mode until you press <Kbd>Esc</Kbd>.
                </>
              ),
            },
            {
              icon: Pen,
              title: "PopJot · Freehand & straight lines",
              colorIndex: 5,
              content: (
                <>
                  Draw naturally with freehand strokes. Hold <Kbd>right-click</Kbd>{" "}
                  while drawing to snap to a straight line. Press{" "}
                  <Kbd>middle-click</Kbd> to undo. Scroll to resize your brush on
                  the fly.
                </>
              ),
            },
            {
              icon: Keyboard,
              title: "PopKey · Every input, visualized",
              colorIndex: 1,
              content: (
                <>
                  Keyboard presses, mouse clicks, and the scroll wheel all appear
                  as on-screen badges. Modifier combos, drag directions, and
                  double-clicks are labeled — no configuration needed.
                </>
              ),
            },
            {
              icon: Settings,
              title: "PopKey · Fully customizable",
              colorIndex: 0,
              content: (
                <>
                  Badge duration, max badges, position, font size, translucency,
                  blur, and roundness — tweak everything. Runs as a transparent
                  layer over any app.
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
      heading: (
        <>
          Make it <span className="text-primary">yours</span>
        </>
      ),
      description:
        "Open the settings panel to tune PopJot and PopKey on separate tabs — the same panels the desktop app uses.",
    },
    useCases: {
      heading: (
        <>
          PopSuite is perfect <span className="text-accent">for</span>
        </>
      ),
      description:
        "Anyone recording, presenting, or teaching who needs to point at the screen and show what they are pressing — without interrupting their flow.",
      items: [
        { icon: Monitor, title: "Tutorial Creators", description: "Circle buttons and underline menus with PopJot while PopKey shows every shortcut you press. No more 'what key was that?' comments.", colorIndex: 1 },
        { icon: MessageSquare, title: "Screen Sharing & Streaming", description: "Annotate live during Zoom, Teams, or a Twitch stream, and let viewers follow your inputs. Works with OBS and any capture tool.", colorIndex: 3 },
        { icon: Code2, title: "Code Reviews & Demos", description: "Highlight lines and circle diffs with PopJot; surface your Vim, VS Code, or terminal shortcuts with PopKey.", colorIndex: 0 },
        { icon: GraduationCap, title: "Presentations & Teaching", description: "Emphasize points on slides or any app, and demonstrate software one keystroke at a time.", colorIndex: 5 },
      ],
    },
    pricing: {
      heading: (
        <>
          Free forever. <span className="text-primary">Support if you love it.</span>
        </>
      ),
      description:
        "PopSuite is free and open source. One optional Pro purchase unlocks perks across both apps and helps keep development going.",
      planMinHeight: 540,
      plans: [
        {
          name: "Extensions",
          price: "Free",
          period: "forever",
          colorIndex: 2,
          ctaColorIndex: 3,
          popular: false,
          features: [
            "PopJot annotation on any webpage",
            "PopKey input badges on any webpage",
            "Radial menu & 8 color palettes",
            "Chrome & Chromium browsers",
            "No install required",
          ],
          cta: "Add to Chrome",
          url: CHROME_STORE_URL,
        },
        {
          name: "PopSuite Desktop",
          price: "Free",
          period: "open source",
          colorIndex: 4,
          ctaColorIndex: 1,
          popular: true,
          features: [
            "One install: PopJot + PopKey",
            "Transparent overlay over any app",
            "Screen annotation & Spotlight mode",
            "Keyboard, mouse & scroll visualization",
            "4 styles, 8 palettes, dark/light themes",
            "Unified tray & one settings window",
            "Custom keyboard shortcuts",
            "Windows (signed), macOS & Linux (unsigned)",
          ],
          cta: "Download",
          url: GITHUB_RELEASE_URL,
        },
        {
          name: "PopSuite Pro",
          price: "$7",
          period: "one-time",
          colorIndex: 0,
          ctaColorIndex: 5,
          popular: false,
          features: [
            "Everything in Desktop",
            "Covers both PopJot & PopKey",
            "Custom color palettes",
            "PopJot: custom center icon & scalable shape",
            "PopKey: any system font & badge animations",
            "Branding watermark overlay",
            "Support open source development",
          ],
          cta: "Get Pro",
          url: POPSUITE_PRO_URL,
        },
      ],
    },
    faq: {
      heading: (
        <>
          Got <span className="text-primary">questions?</span>
        </>
      ),
      description: "Everything you need to know about PopSuite.",
      items: [
        { question: "What is PopSuite?", answer: "PopSuite is a single free download that bundles two tools: PopJot, a screen annotation overlay, and PopKey, an on-screen keyboard and mouse visualizer. They install together, share a tray, and can each be enabled or disabled independently." },
        { question: "PopJot — what does it do?", answer: "Press a hotkey and a transparent canvas appears over your screen. Draw, circle, and highlight with marker, pen, and highlighter tools; your audience sees it live, and it vanishes when you release the hotkey. Spotlight mode dims everything except a circle at your cursor." },
        { question: "PopKey — what does it do?", answer: "PopKey displays your keyboard presses, mouse clicks, and scroll activity as styled badges overlaid on your screen — perfect for tutorials, recordings, and streams. It only displays inputs in real time; nothing is stored, logged, or transmitted." },
        { question: "Do the two apps interfere with each other?", answer: "No. Both run as independent processes. While PopJot is annotating or in Spotlight mode, PopKey automatically hides its overlay so the two never collide, then restores itself afterward. On this web page the same rule applies — activating PopJot's canvas takes over input while it's up." },
        { question: "How does PopSuite Pro work?", answer: "Pay $7 once and get a download link for the Pro build — no subscriptions. Pro perks apply across both apps: custom color palettes, PopJot's custom center icon and scalable shape, PopKey's any-system-font and badge animations, and a branding watermark." },
        { question: "What platforms are supported?", answer: "Windows, macOS, and Linux. The Windows installer is signed and auto-updates in the background. macOS and Linux builds are unsigned — on first launch, right-click and choose Open (macOS) or mark the AppImage executable (Linux). A manual Check for Updates works everywhere; on macOS, PopKey also needs Accessibility and Input Monitoring permission." },
        { question: "Can I use this during recordings and calls?", answer: "Yes — that's exactly what it's for. Both apps draw on a transparent overlay, so your annotations and input badges show up in any screen recorder, OBS capture, or screen share (Zoom, Teams, Discord)." },
      ],
    },
  };
}
