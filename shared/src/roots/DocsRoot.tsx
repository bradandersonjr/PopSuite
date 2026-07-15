import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";

/* ─── Table of Contents ─── */
//
// Grouped so PopSuite is the parent and PopJot / PopKey are its two apps.
// `navGroups` drives the sidebar (headed groups); `sections` is the flat list
// of leaf ids the IntersectionObserver watches, derived from the groups.

const navGroups = [
  {
    label: "PopSuite",
    items: [
      { id: "getting-started", label: "Getting Started" },
      { id: "the-suite", label: "The PopSuite Tray" },
    ],
  },
  {
    label: "PopJot — Annotation",
    items: [
      { id: "popjot-overview", label: "Overview" },
      { id: "activation-modes", label: "Activation Modes" },
      { id: "drawing-tools", label: "Drawing Tools" },
      { id: "radial-menu", label: "Radial Menu" },
      { id: "canvas-controls", label: "Canvas Controls" },
      { id: "background-modes", label: "Background Modes" },
      { id: "spotlight", label: "Spotlight Mode" },
      { id: "popjot-customization", label: "Customization" },
    ],
  },
  {
    label: "PopKey — Keystrokes",
    items: [
      { id: "popkey-overview", label: "Overview" },
      { id: "popkey-inputs", label: "Keys, Clicks & Scroll" },
      { id: "popkey-position", label: "Position & Timing" },
      { id: "popkey-customization", label: "Customization" },
      { id: "popkey-obs", label: "OBS & Recording" },
    ],
  },
  {
    label: "Suite Reference",
    items: [
      { id: "settings-window", label: "Settings & Sync" },
      { id: "keyboard-shortcuts", label: "Keyboard Shortcuts" },
      { id: "resolution-scaling", label: "Resolution Scaling" },
      { id: "updates", label: "Updates" },
      { id: "chrome-extension", label: "Chrome Extension" },
    ],
  },
];

const sections = navGroups.flatMap((g) => g.items);

/* ─── Helpers ─── */

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-block bg-foreground/10 border border-foreground/20 px-1.5 py-0.5 text-xs font-mono font-semibold rounded mx-0.5 align-baseline">
    {children}
  </kbd>
);

const SectionHeading = ({ id, children, isFirst }: { id: string; children: React.ReactNode; isFirst?: boolean }) => (
  <h2 id={id} className={`text-2xl font-bold text-foreground ${isFirst ? "" : "mt-16"} mb-6 scroll-mt-24 border-b border-foreground/10 pb-3`}>
    {children}
  </h2>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-foreground mt-8 mb-3">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
);

/* ─── Component ─── */

const DocsRoot = ({ brand = "PopSuite" }: { brand?: string }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("getting-started");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sidebarAnchorRef = useRef<HTMLDivElement | null>(null);
  const [sidebarLeft, setSidebarLeft] = useState<number | null>(null);

  // Measure the sidebar column's left position from the flex layout
  useEffect(() => {
    const measure = () => {
      if (sidebarAnchorRef.current) {
        setSidebarLeft(sidebarAnchorRef.current.getBoundingClientRect().left);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="w-full min-h-screen bg-background theme-dark">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-foreground/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-brand text-lg">
                <span className="text-pop-yellow">Pop</span>
                <span className="text-foreground">{brand.replace(/^Pop/, "")}</span>
              </span>
            </a>
            <span className="text-foreground/30">/</span>
            <span className="text-sm font-semibold text-foreground">Docs</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Floating sidebar (desktop) ─── */}
      {sidebarLeft !== null && (
        <nav
          className="hidden lg:block fixed w-56 z-40"
          style={{ left: sidebarLeft, top: "6.5rem" }}
        >
          <div className="bg-background/80 backdrop-blur-sm border border-foreground/10 rounded-xl p-4 shadow-sm">
            <ul className="space-y-1">
              {navGroups.map((group) => (
                <li key={group.label}>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-foreground/35 first:pt-0">
                    {group.label}
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => scrollTo(s.id)}
                          className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSection === s.id
                              ? "text-foreground font-semibold bg-foreground/10"
                              : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"
                            }`}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <div className="max-w-6xl mx-auto flex gap-8">
        {/* Invisible anchor to measure sidebar column position */}
        <div ref={sidebarAnchorRef} className="hidden lg:block w-56 shrink-0" aria-hidden="true" />

        <div className="flex-1">

          {/* ─── Mobile menu overlay ─── */}
          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur pt-14">
              <nav className="p-6">
                <ul className="space-y-2">
                  {navGroups.map((group) => (
                    <li key={group.label}>
                      <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-foreground/35 first:pt-0">
                        {group.label}
                      </div>
                      <ul className="space-y-1">
                        {group.items.map((s) => (
                          <li key={s.id}>
                            <button
                              onClick={() => scrollTo(s.id)}
                              className="w-full text-left text-base px-3 py-2 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                            >
                              {s.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          )}

          {/* ─── Content ─── */}
          <main className="px-4 lg:px-12 py-12">

            {/* ─── Getting Started ─── */}
            <SectionHeading id="getting-started" isFirst>Getting Started</SectionHeading>

            <P>
              <strong>PopSuite</strong> is a pair of on-screen presentation tools in one install:
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>PopJot</strong> — screen annotation. Press a hotkey and a transparent canvas appears over your whole screen; draw, circle, underline, and highlight live, then release to clear it.</li>
              <li><strong>PopKey</strong> — a keystroke and click visualizer. Shows the keys, shortcuts, mouse clicks, and scrolls you make as on-screen badges, so your audience can follow along in demos and recordings.</li>
            </ul>
            <P>
              They install together, share one tray icon and one settings window, and are documented
              together here — PopSuite basics first, then each app&apos;s own features. You can run
              either app on its own; they simply live under one roof.
            </P>

            <SubHeading>Platforms</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Desktop app</strong> — Windows, macOS, and Linux. Both apps, one installer.</li>
              <li><strong>Chrome extension</strong> — PopJot only. Draws over the active webpage in any Chromium browser.</li>
              <li><strong>Web demo</strong> — try both apps&apos; engines directly on the landing page.</li>
            </ul>

            <SubHeading>Installation</SubHeading>
            <P>
              <strong>Desktop:</strong> <strong>PopSuite</strong> is a single download that includes both
              PopJot and PopKey. Get the latest installer for your platform from{" "}
              <a
                href="https://github.com/bradandersonjr/PopSuite/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                GitHub Releases
              </a>
              .
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Windows</strong> — run the signed <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">PopSuite Setup</code> installer. Auto-updates in the background.</li>
              <li>
                <strong>macOS</strong> — open the <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">.dmg</code> and drag PopSuite to Applications.
                The build is currently unsigned, so on first launch macOS will refuse to open it normally.{" "}
                <strong>Right-click (or Control-click) the app and choose Open</strong>, then confirm in the dialog
                that appears. You only need to do this once. Auto-update is disabled on macOS by design — check{" "}
                <em>Check for Updates</em> from the tray to update manually.
              </li>
              <li>
                <strong>Linux</strong> — download the <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">.AppImage</code>, mark it
                executable (<code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">chmod +x</code>), and run it. Unsigned, same as macOS;
                use <em>Check for Updates</em> from the tray to update manually.
              </li>
            </ul>
            <P>
              <strong>Chrome Extension (PopJot only):</strong> Install PopJot&apos;s browser overlay from
              the Chrome Web Store. It works in all Chromium-based browsers (Chrome, Edge, Brave, Arc,
              etc.). No restart required. PopKey is desktop-only.
            </P>

            {/* ─── The PopSuite Tray ─── */}
            <SectionHeading id="the-suite">The PopSuite Tray</SectionHeading>

            <P>
              PopSuite runs one system tray icon for both apps. PopJot and PopKey run as
              independent processes underneath, but you interact with them through a single
              unified menu:
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li>A checkbox toggle for each app (enable/disable PopJot, enable/disable PopKey)</li>
              <li>A single <strong>Settings</strong> item that opens one settings window with a tab for each app</li>
              <li><strong>About PopSuite</strong></li>
              <li><strong>Launch Preferences</strong> — open PopSuite at login, and a manual Check for Updates</li>
              <li><strong>Changelog</strong> and <strong>Documentation</strong> links</li>
              <li><strong>Quit PopSuite</strong>, which exits both apps</li>
            </ul>
            <P>
              While PopJot is annotating (or in Spotlight mode), PopKey automatically hides its
              overlay so the two never visually collide — its tray toggle shows &quot;(auto-hidden)&quot;
              during that time. PopKey&apos;s branding overlay, if enabled, stays visible. PopKey
              restores to whatever state you last asked for as soon as PopJot stops.
            </P>

            {/* ═══════════ PopJot ═══════════ */}

            {/* ─── PopJot Overview ─── */}
            <SectionHeading id="popjot-overview">PopJot Overview</SectionHeading>
            <P>
              PopJot is PopSuite&apos;s screen annotation tool. Press a hotkey and a transparent canvas
              appears over your entire screen; draw, circle, underline, and highlight live so your
              audience sees your marks in real time. It&apos;s built for pointing things out during
              screen shares, recordings, demos, and lessons &mdash; not for saving artwork.
            </P>
            <P>
              Activate it with <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd>{" "}
              (<Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd> on macOS) &mdash; hold to draw and release
              to clear, or use a persistent toggle for longer sessions (see Activation Modes below). A
              right-click radial menu switches tools and colors without leaving the canvas. When
              you&apos;re done, everything vanishes and leaves the screen untouched.
            </P>
            <P>
              PopJot also ships as a <strong>Chrome extension</strong> that draws over the active
              webpage in any Chromium browser, with the same tools as the desktop app. The desktop app
              draws over everything on your screen; the extension is scoped to the page.
            </P>

            {/* ─── Activation Modes ─── */}
            <SectionHeading id="activation-modes">Activation Modes</SectionHeading>

            <P>PopJot has two ways to activate the drawing overlay:</P>

            <SubHeading>Non-persistent mode (hold to draw)</SubHeading>
            <P>
              Press and <strong>hold</strong> <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd> (or{" "}
              <Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd> on macOS). The canvas appears instantly.
              Draw while holding the keys. When you release, the overlay disappears and your annotations are cleared.
            </P>
            <P>
              Best for: quick "let me circle this" moments during screen shares or recordings.
            </P>

            <SubHeading>Persistent mode (toggle)</SubHeading>
            <P>
              Press <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>S</Kbd> (or{" "}
              <Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>S</Kbd> on macOS) once to activate. The canvas stays
              open until you press <Kbd>Esc</Kbd>. Your annotations persist while the overlay is active.
            </P>
            <P>
              Best for: extended annotation sessions, whiteboard-style explanations, recording tutorials, or taking screenshots.
              You can use <Kbd>Print Screen</Kbd> or your platform&apos;s screenshot tool (like <Kbd>Shift</Kbd>+<Kbd>Cmd</Kbd>+<Kbd>4</Kbd> on macOS) to capture
              your annotations while the overlay is active.
            </P>

            {/* ─── Drawing Tools ─── */}
            <SectionHeading id="drawing-tools">Drawing Tools</SectionHeading>

            <P>PopJot includes four drawing tools, each designed for a specific use case:</P>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-foreground/80 border-collapse">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Tool</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Stroke</th>
                    <th className="text-left py-2 font-semibold text-foreground">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Marker</td>
                    <td className="py-2 pr-4">Thick, fully opaque</td>
                    <td className="py-2">Bold emphasis, circling elements, drawing arrows</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Pen</td>
                    <td className="py-2 pr-4">Thin, precise</td>
                    <td className="py-2">Underlining, fine annotations, writing text</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Highlighter</td>
                    <td className="py-2 pr-4">Wide, 40% opacity</td>
                    <td className="py-2">Highlighting text or regions without obscuring content</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Eraser</td>
                    <td className="py-2 pr-4">Destructive removal</td>
                    <td className="py-2">Removing individual strokes from the canvas</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <P>
              Each tool has 6 color options, selectable from the radial menu&apos;s submenu. Colors adapt
              to your chosen color palette.
            </P>

            {/* ─── Radial Menu ─── */}
            <SectionHeading id="radial-menu">Radial Menu</SectionHeading>

            <P>
              <strong>Right-click</strong> anywhere on the canvas to open the radial menu. Six buttons
              appear in a circle around your cursor: Last Tool, Marker, Pen, Highlighter, Eraser, and Screen.
            </P>

            <SubHeading>Selecting a tool</SubHeading>
            <P>
              Hover over a tool button. For drawing tools (Marker, Pen, Highlighter), a color submenu
              automatically appears with 6 color options. Glide your mouse into the submenu to pick a color.
              The entire interaction — open menu, pick tool, pick color — happens in one continuous gesture.
            </P>

            <SubHeading>Special tools</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Last Tool</strong> — Jumps straight to your last-used drawing tool, skipping the color submenu. It&apos;s the in-menu twin of the Last Tool shortcut (<Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>W</Kbd>), handy for getting right back to what you were just drawing with.</li>
              <li><strong>Eraser</strong> — Switches to eraser mode. Draw over strokes to remove them.</li>
              <li><strong>Screen</strong> — Opens a submenu to toggle background modes (transparent, dark whiteboard, light whiteboard).</li>
            </ul>

            <SubHeading>How it works internally</SubHeading>
            <P>
              The radial menu uses angular slice detection. The area around the menu is divided into
              pie-wedge sections (60° each for 6 items). Your mouse position determines which slice
              is active — this means you don&apos;t need to hover precisely over a small button. Fast
              flick gestures work reliably because the detection radius is effectively infinite.
            </P>

            {/* ─── Canvas Controls ─── */}
            <SectionHeading id="canvas-controls">Canvas Controls</SectionHeading>

            <SubHeading>Straight line snapping</SubHeading>
            <P>
              While drawing with any tool, <strong>hold right-click</strong> to snap your stroke into a
              perfectly straight line from the point where you started drawing. Release right-click to
              return to freehand mode. Useful for pointing at specific elements or drawing clean arrows.
            </P>

            <SubHeading>Undo</SubHeading>
            <P>
              Press <strong>middle-click</strong> (scroll wheel button) to undo the last stroke. Each
              press removes one more stroke.
            </P>

            <SubHeading>Brush size</SubHeading>
            <P>
              <strong>Scroll the mouse wheel</strong> to resize the active tool&apos;s brush. Each tool
              maintains its own size multiplier (range: 0.25x to 4x of the base size). A cursor indicator
              shows the current brush size as you scroll.
            </P>

            {/* ─── Background Modes ─── */}
            <SectionHeading id="background-modes">Background Modes</SectionHeading>

            <P>
              Access background modes through the Screen tool in the radial menu, or through the Settings panel.
            </P>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-foreground/80 border-collapse">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Mode</th>
                    <th className="text-left py-2 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Transparent</td>
                    <td className="py-2">Default. Draw directly over your screen content. Everything beneath is visible.</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Dark whiteboard</td>
                    <td className="py-2">Solid dark background. Full-screen whiteboard for explanations.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Light whiteboard</td>
                    <td className="py-2">Solid light background. Clean whiteboard for bright environments.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeading>Grid & dot overlays</SubHeading>
            <P>
              Enable optional grid or dot patterns on the canvas to help align your drawings. Available in
              two sizes (small and large). Configure in Settings &gt; Behavior &gt; Canvas Grid.
            </P>

            <SubHeading>Overlay mode</SubHeading>
            <P>
              <strong>Live</strong> (default) — You draw straight onto the live screen. Live mode keeps
              its hands off the app underneath, so open menus, dropdowns, and tooltips stay open while
              you annotate over them.
              <br />
              <strong>Snapshot</strong> — Captures the screen once when you activate the overlay, then
              freezes it so you annotate over a static image. Use this as the fallback for the rare cases
              Live mode can&apos;t hold — mainly menus that dismiss themselves the moment you click away.
              It takes a moment longer to appear because it has to grab the screen first.
            </P>

            {/* ─── Spotlight Mode ─── */}
            <SectionHeading id="spotlight">Spotlight Mode</SectionHeading>

            <P>
              Spotlight is a presenter aid, separate from drawing: it dims the entire screen except
              a soft circle that follows your cursor, so you can call attention to one spot without
              annotating anything. Hold <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>D</Kbd> (or{" "}
              <Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>D</Kbd> on macOS) to keep it active, and release to
              exit — the same hold-to-activate feel as drawing.
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Scroll the mouse wheel</strong> to resize the spotlight circle live, the same way brush size works while drawing.</li>
              <li><strong>Soft edge</strong> — a 0-100% slider controlling how gradual the fade is from the transparent circle to the dimmed background. 0% is a hard edge; 100% is the softest ramp.</li>
              <li><strong>Dim strength</strong> — a 0-100% slider controlling how dark the dimmed area outside the circle is.</li>
              <li>Press <Kbd>Esc</Kbd> to exit Spotlight at any time.</li>
            </ul>
            <P>
              Spotlight and drawing mode are mutually exclusive — activating one exits the other.
              While Spotlight is active, PopKey automatically hides its overlay, just as it does
              while PopJot is drawing.
            </P>

            {/* ─── Customization ─── */}
            <SectionHeading id="popjot-customization">Customization</SectionHeading>

            <P>
              All customization options live in PopJot&apos;s tab of the PopSuite settings window
              (opened from the tray&apos;s single Settings item), or the extension popup in Chrome.
            </P>

            <SubHeading>Menu styles</SubHeading>
            <P>Four visual styles for the radial menu buttons:</P>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-foreground/80 border-collapse">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Style</th>
                    <th className="text-left py-2 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Flat</td>
                    <td className="py-2">Simple flat circles. Colors adapt to dark/light theme.</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Flat Outline</td>
                    <td className="py-2">Flat circles with a 2px border. Adapts to theme.</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">PoP</td>
                    <td className="py-2">Neo-brutalist style with random colors from your selected palette.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Glow</td>
                    <td className="py-2">Filled buttons with a soft colored halo. Adapts to theme.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeading>Color palettes</SubHeading>
            <P>Eight palettes that affect drawing colors and PoP menu button colors:</P>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-foreground/80 border-collapse">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Palette</th>
                    <th className="text-left py-2 font-semibold text-foreground">Character</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Muted</td>
                    <td className="py-2">Soft, desaturated colors</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Vibrant</td>
                    <td className="py-2">Bright, saturated colors</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Retro</td>
                    <td className="py-2">90s-flavored neon palette (default)</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Neon</td>
                    <td className="py-2">True luminous neon colors</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Pastel</td>
                    <td className="py-2">Soft, chalky tints</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Gradient</td>
                    <td className="py-2">Rainbow ink gradient progression</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">Glitter</td>
                    <td className="py-2">Shimmering particle effect over each color</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Solid</td>
                    <td className="py-2">A single custom color for every stroke</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeading>Themes</SubHeading>
            <P>
              <strong>Dark</strong> (default) — Slate-based surfaces with soft text. Easy on the eyes.
              <br />
              <strong>Light</strong> — Gray-based surfaces with dark text. Better for bright environments.
            </P>
            <P>
              The theme affects the radial menu, settings panel, and flat/flat-outline button styles.
              PoP menu buttons use their own palette colors regardless of theme.
            </P>

            <SubHeading>Animation intensity</SubHeading>
            <P>Controls the feel of hover effects, selection animations, and spring physics:</P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Low</strong> — Subtle. Minimal hover scale, fast transitions.</li>
              <li><strong>Medium</strong> (default) — Balanced. Noticeable but not distracting.</li>
              <li><strong>High</strong> — Playful. Exaggerated hover effects and bouncy animations.</li>
            </ul>

            {/* ═══════════ PopKey ═══════════ */}

            {/* ─── PopKey Overview ─── */}
            <SectionHeading id="popkey-overview">PopKey Overview</SectionHeading>
            <P>
              PopKey is PopSuite&apos;s keystroke and click visualizer. It watches your keyboard and
              mouse and shows each input as a badge on screen &mdash; the keys and shortcuts you press,
              your mouse clicks, and your scroll direction &mdash; so viewers of a demo, screen recording,
              or live class can see exactly what you&apos;re doing.
            </P>
            <P>
              Toggle it from the PopSuite tray, or with its own shortcut{" "}
              <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>K</Kbd> (<Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>K</Kbd> on
              macOS). Unlike PopJot, it has no canvas &mdash; it just displays what you type and click,
              and stays out of the way otherwise.
            </P>
            <P>
              On macOS, PopKey needs Accessibility and Input Monitoring permission to see your keys and
              clicks. It prompts you on first launch; grant it in System Settings &gt; Privacy &amp;
              Security, then restart PopKey.
            </P>

            {/* ─── PopKey Inputs ─── */}
            <SectionHeading id="popkey-inputs">Keys, Clicks &amp; Scroll</SectionHeading>
            <P>Each input type can be shown or hidden independently in PopKey&apos;s Settings tab.</P>
            <SubHeading>Keyboard</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li>Keys and shortcut combinations appear as badges (e.g. <Kbd>Ctrl</Kbd>+<Kbd>C</Kbd>).</li>
              <li><strong>Key repeat</strong> — optionally show repeated badges when a key is held down.</li>
              <li><strong>Word mode</strong> — group consecutive letters into words instead of one badge per key.</li>
              <li><strong>Plain numpad digits</strong> — show numpad numbers as plain digits rather than &quot;Num&quot; keys.</li>
            </ul>
            <SubHeading>Mouse &amp; scroll</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Clicks</strong> — a visual effect at the cursor on each click. Choose the effect (ring, solid, pulse, or burst) and its size.</li>
              <li><strong>Scroll wheel</strong> — an indicator showing scroll direction.</li>
              <li>Click and scroll colors follow your palette by default, or set a custom color for each.</li>
            </ul>

            {/* ─── PopKey Position & Timing ─── */}
            <SectionHeading id="popkey-position">Position &amp; Timing</SectionHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Position</strong> — anchor badges to any of the six screen positions (top/bottom &times; left/center/right), with fine horizontal and vertical offset sliders.</li>
              <li><strong>Duration</strong> — how long each badge stays on screen before fading out (1&ndash;5 seconds).</li>
              <li><strong>Max badges</strong> — how many badges show at once (3, 5, 8, or 12) before the oldest drop off.</li>
              <li><strong>Scale</strong> — an overall size multiplier for badges, on top of the automatic resolution scaling PopKey shares with PopJot.</li>
            </ul>

            {/* ─── PopKey Customization ─── */}
            <SectionHeading id="popkey-customization">PopKey Customization</SectionHeading>
            <P>
              PopKey shares PopJot&apos;s visual system, so badges match your annotations. Many of these
              can be kept in sync with PopJot automatically &mdash; see Settings &amp; Sync below.
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Style</strong> — the same four looks as PopJot&apos;s menu: Flat, Flat Outline, Pop, and Glow.</li>
              <li><strong>Color palette</strong> — the same palettes as PopJot, including Solid (a single custom color).</li>
              <li><strong>Theme</strong> — dark or light.</li>
              <li><strong>Font</strong> — mono, sans, serif, or a custom font; adjustable size.</li>
              <li><strong>Badge animation</strong> — how badges appear: pop, slide, bounce, fade, or rise.</li>
              <li><strong>Roundness, translucency, and glow</strong> — fine-tune the badge shape and finish.</li>
              <li><strong>Text color</strong> — auto (follows theme) or forced white/black.</li>
              <li><strong>Branding overlay</strong> — an optional logo/watermark image pinned to a screen corner (shared concept with PopJot).</li>
            </ul>

            {/* ─── PopKey OBS ─── */}
            <SectionHeading id="popkey-obs">OBS &amp; Recording</SectionHeading>
            <P>
              <strong>OBS Mode</strong> (in the tray and PopKey&apos;s settings) drops the overlay&apos;s
              always-on-top pinning and shrinks it to the work area, so OBS and other capture tools can
              grab PopKey as an ordinary window source instead of a topmost overlay. Turn it on when you
              want PopKey visible inside a recording or stream layout rather than only on your physical
              screen.
            </P>

            {/* ─── Settings & Sync ─── */}
            <SectionHeading id="settings-window">Settings & Sync</SectionHeading>

            <P>
              PopSuite hosts one settings window for both apps. It opens from the tray&apos;s
              single <strong>Settings</strong> item and shows a PopJot tab and a PopKey tab;
              switching between them is instant — no reload, and your place in each tab is
              preserved when you switch back.
            </P>
            <SubHeading>Cross-app sync</SubHeading>
            <P>
              Some settings — like color palette — can be shared between PopJot and PopKey so
              you only have to set them once. Each syncable setting has its own opt-in toggle in
              a <strong>Sync</strong> tab; nothing syncs unless you turn it on for that specific
              setting. Synced values are stored in a shared file alongside each app&apos;s own
              settings, all under <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">~/.popsuite/</code> on
              your machine — never uploaded anywhere. Settings persist across restarts either way.
            </P>

            {/* ─── Keyboard Shortcuts ─── */}
            <SectionHeading id="keyboard-shortcuts">Keyboard Shortcuts</SectionHeading>

            <P>
              PopSuite&apos;s shortcuts across both apps. All of them are rebindable in the Settings
              window&apos;s <strong>Shortcuts</strong> tab.
            </P>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-foreground/80 border-collapse">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Action</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Windows / Linux</th>
                    <th className="text-left py-2 font-semibold text-foreground">macOS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Activate (hold)</td>
                    <td className="py-2 pr-4"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd></td>
                    <td className="py-2"><Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Activate (persistent)</td>
                    <td className="py-2 pr-4"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>S</Kbd></td>
                    <td className="py-2"><Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>S</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Activate with last tool (hold)</td>
                    <td className="py-2 pr-4"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>W</Kbd></td>
                    <td className="py-2"><Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>W</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Exit persistent mode</td>
                    <td className="py-2 pr-4"><Kbd>Esc</Kbd></td>
                    <td className="py-2"><Kbd>Esc</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Spotlight mode (hold)</td>
                    <td className="py-2 pr-4"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>D</Kbd></td>
                    <td className="py-2"><Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>D</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Exit Spotlight mode</td>
                    <td className="py-2 pr-4"><Kbd>Esc</Kbd></td>
                    <td className="py-2"><Kbd>Esc</Kbd></td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Resize Spotlight circle</td>
                    <td className="py-2 pr-4">Scroll wheel</td>
                    <td className="py-2">Scroll wheel</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Open radial menu</td>
                    <td className="py-2 pr-4">Right-click</td>
                    <td className="py-2">Right-click</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Undo last stroke</td>
                    <td className="py-2 pr-4">Middle-click</td>
                    <td className="py-2">Middle-click</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Snap straight line</td>
                    <td className="py-2 pr-4">Hold right-click while drawing</td>
                    <td className="py-2">Hold right-click while drawing</td>
                  </tr>
                  <tr className="border-b border-foreground/10">
                    <td className="py-2 pr-4">Resize brush</td>
                    <td className="py-2 pr-4">Scroll wheel</td>
                    <td className="py-2">Scroll wheel</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Show / hide PopKey</td>
                    <td className="py-2 pr-4"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>K</Kbd></td>
                    <td className="py-2"><Kbd>Cmd</Kbd>+<Kbd>Shift</Kbd>+<Kbd>K</Kbd></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── Resolution Scaling ─── */}
            <SectionHeading id="resolution-scaling">Resolution Scaling</SectionHeading>

            <P>
              Both apps automatically detect your screen resolution and scale their on-screen elements
              accordingly — PopJot&apos;s menu and PopKey&apos;s badges alike. The base reference is
              1920x1080 (scale factor 1.0x). A 4K display (3840x2160) gets approximately 2.0x scaling.
            </P>

            <SubHeading>How scaling works</SubHeading>
            <P>
              The scale factor is calculated from the geometric mean of your width and height relative
              to 1080p. This ensures balanced scaling regardless of aspect ratio. The factor is clamped
              between 0.5x and 4.0x to prevent extreme values.
            </P>
            <P>
              Scaling affects: radial menu size, button sizes, icon sizes, stroke widths, cursor indicators,
              and grid/dot pattern sizes.
            </P>

            <SubHeading>Manual override</SubHeading>
            <P>
              In Settings &gt; System &gt; UI Scale, you can override auto-detection with fixed presets:
            </P>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>75%</strong> — Compact UI</li>
              <li><strong>100%</strong> — Standard (1080p baseline)</li>
              <li><strong>150%</strong> — Good for 1440p displays</li>
              <li><strong>200%</strong> — Good for 4K displays</li>
            </ul>

            {/* ─── Updates ─── */}
            <SectionHeading id="updates">Updates</SectionHeading>
            <P>
              <strong>Windows</strong> — PopSuite checks for updates in the background and downloads
              them silently. When one is ready, the tray menu shows a &quot;Restart to Update&quot;
              item; click it to install and relaunch.
            </P>
            <P>
              <strong>macOS and Linux</strong> — automatic background updates are disabled on these
              unsigned builds. Use <strong>Launch Preferences &gt; Check for Updates</strong> from
              the tray to check manually, then download the latest release yourself.
            </P>
            <P>
              On every platform, <strong>Check for Updates</strong> in Launch Preferences triggers an
              immediate manual check and reports back if you&apos;re already on the latest version.
            </P>

            {/* ─── Chrome Extension ─── */}
            <SectionHeading id="chrome-extension">Chrome Extension</SectionHeading>

            <P>
              The Chrome extension brings PopJot to any webpage in your browser. It works in all
              Chromium-based browsers (Chrome, Edge, Brave, Arc, etc.).
            </P>

            <SubHeading>Activation</SubHeading>
            <P>
              Use the keyboard shortcut <Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>A</Kbd> or click the
              PopJot icon in your browser toolbar. The drawing overlay appears on top of the current webpage.
            </P>

            <SubHeading>Settings</SubHeading>
            <P>
              Click the PopJot extension icon and choose the settings popup to configure menu style,
              color palette, theme, and animation intensity. Settings are persisted in Chrome&apos;s local storage
              and sync across tabs.
            </P>

            <SubHeading>Differences from desktop</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li>The extension draws over the <strong>active webpage only</strong>, not the entire screen.</li>
              <li>Overlay mode is always &quot;live&quot; (no snapshot mode in the extension).</li>
              <li>The extension respects the page&apos;s zoom level and adjusts scaling accordingly.</li>
              <li>System tray and Open at Login features are not available in the extension.</li>
            </ul>

            <SubHeading>Why there&apos;s no PopKey extension</SubHeading>
            <P>
              The extension is PopJot only. PopKey visualizes your keystrokes and clicks across your
              whole computer, which needs global, OS-level input access — something a browser extension
              is sandboxed away from. In a browser, an extension can only see input directed at the
              current web page, so a PopKey extension couldn&apos;t do the thing PopKey is for.
              PopKey stays desktop-only for that reason.
            </P>

            {/* ─── Footer ─── */}
            <div className="mt-20 pt-8 border-t border-foreground/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <a
                  href="/"
                  className="text-sm text-foreground/50 hover:text-foreground transition-colors"
                >
                  &larr; Back to {brand}
                </a>
                <div className="flex gap-6 text-sm text-foreground/40">
                  <a href="/docs" className="text-foreground/60 hover:text-foreground transition-colors">Docs</a>
                  <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
                  <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                  <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
                </div>
              </div>
            </div>
          </main>
        </div>{/* flex-1 */}
      </div>{/* max-w-6xl flex */}
    </div>
  );
};

export default DocsRoot;
