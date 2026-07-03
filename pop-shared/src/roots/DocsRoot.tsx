import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";

/* ─── Table of Contents ─── */

const sections = [
  { id: "getting-started", label: "Getting Started" },
  { id: "activation-modes", label: "Activation Modes" },
  { id: "drawing-tools", label: "Drawing Tools" },
  { id: "radial-menu", label: "Radial Menu" },
  { id: "canvas-controls", label: "Canvas Controls" },
  { id: "background-modes", label: "Background Modes" },
  { id: "customization", label: "Customization" },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts" },
  { id: "resolution-scaling", label: "Resolution Scaling" },
  { id: "chrome-extension", label: "Chrome Extension" },
];

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

const DocsRoot = () => {
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
                <span className="text-foreground">Jot</span>
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
              {sections.map((s) => (
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
                  {sections.map((s) => (
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
              </nav>
            </div>
          )}

          {/* ─── Content ─── */}
          <main className="px-4 lg:px-12 py-12">

            {/* ─── Getting Started ─── */}
            <SectionHeading id="getting-started" isFirst>Getting Started</SectionHeading>

            <P>
              PopJot is a screen annotation tool. Press a hotkey and a transparent canvas appears on top of
              your entire screen. Draw, circle, underline, highlight — your audience sees it live. Release
              the hotkey and everything vanishes.
            </P>

            <SubHeading>Platforms</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>Desktop app</strong> — Windows, macOS, and Linux. Draws over your entire screen.</li>
              <li><strong>Chrome extension</strong> — Any Chromium browser. Draws over the active webpage.</li>
              <li><strong>Web demo</strong> — Try the radial menu and drawing engine directly on the landing page.</li>
            </ul>

            <SubHeading>Installation</SubHeading>
            <P>
              <strong>Desktop:</strong> Download the installer for your platform. On Windows you get an NSIS installer,
              on macOS a DMG, and on Linux an AppImage or .deb package. Run the installer and PopJot is ready.
            </P>
            <P>
              <strong>Chrome Extension:</strong> Install from the Chrome Web Store. It works in all Chromium-based
              browsers (Chrome, Edge, Brave, Arc, etc.). No restart required.
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
              <strong>Right-click</strong> anywhere on the canvas to open the radial menu. Six tool buttons
              appear in a circle around your cursor: History (undo), Marker, Pen, Highlighter, Eraser, and Screen.
            </P>

            <SubHeading>Selecting a tool</SubHeading>
            <P>
              Hover over a tool button. For drawing tools (Marker, Pen, Highlighter), a color submenu
              automatically appears with 6 color options. Glide your mouse into the submenu to pick a color.
              The entire interaction — open menu, pick tool, pick color — happens in one continuous gesture.
            </P>

            <SubHeading>Special tools</SubHeading>
            <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
              <li><strong>History</strong> — Undoes the last stroke. Each click removes one stroke.</li>
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
              Press <strong>middle-click</strong> (scroll wheel button) to undo the last stroke. You can
              also use the History button in the radial menu.
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
              <strong>Live</strong> (default) — The canvas shows real-time screen content beneath your strokes.
              <br />
              <strong>Snapshot</strong> — Captures the screen once when you activate the overlay, then freezes it.
              Annotate over a static image of your screen.
            </P>

            {/* ─── Customization ─── */}
            <SectionHeading id="customization">Customization</SectionHeading>

            <P>
              All customization options are in the Settings panel (accessible from the system tray on desktop,
              or the extension popup in Chrome).
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

            {/* ─── Keyboard Shortcuts ─── */}
            <SectionHeading id="keyboard-shortcuts">Keyboard Shortcuts</SectionHeading>

            <P>All shortcuts can be customized in Settings &gt; System &gt; Keyboard Shortcuts.</P>

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
                    <td className="py-2 pr-4">Exit persistent mode</td>
                    <td className="py-2 pr-4"><Kbd>Esc</Kbd></td>
                    <td className="py-2"><Kbd>Esc</Kbd></td>
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
                  <tr>
                    <td className="py-2 pr-4">Resize brush</td>
                    <td className="py-2 pr-4">Scroll wheel</td>
                    <td className="py-2">Scroll wheel</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── Resolution Scaling ─── */}
            <SectionHeading id="resolution-scaling">Resolution Scaling</SectionHeading>

            <P>
              PopJot automatically detects your screen resolution and scales the UI accordingly. The base
              reference is 1920x1080 (scale factor 1.0x). A 4K display (3840x2160) gets approximately 2.0x scaling.
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

            {/* ─── Footer ─── */}
            <div className="mt-20 pt-8 border-t border-foreground/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <a
                  href="/"
                  className="text-sm text-foreground/50 hover:text-foreground transition-colors"
                >
                  &larr; Back to PopJot
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
