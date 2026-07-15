import { ArrowLeft } from "lucide-react";

const SectionHeading = ({ id, children, isFirst }: { id: string; children: React.ReactNode; isFirst?: boolean }) => (
  <h2 id={id} className={`text-2xl font-bold text-foreground ${isFirst ? "" : "mt-12"} mb-4 scroll-mt-24 border-b border-foreground/10 pb-3`}>
    {children}
  </h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
);

const Tag = ({ type }: { type: "new" | "fix" | "improved" | "removed" }) => {
  const styles = {
    new: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    fix: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    improved: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    removed: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  };
  const labels = { new: "New", fix: "Fix", improved: "Improved", removed: "Removed" };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mr-2 ${styles[type]}`}>
      {labels[type]}
    </span>
  );
};

const Entry = ({ tag, children }: { tag: "new" | "fix" | "improved" | "removed"; children: React.ReactNode }) => (
  <li className="flex items-start gap-1 text-foreground/80 leading-relaxed py-1">
    <Tag type={tag} />
    <span>{children}</span>
  </li>
);

const ChangelogRoot = ({ brand = "PopJot" }: { brand?: string }) => {
  return (
    <div className="w-full min-h-screen bg-background theme-dark">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-foreground/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-brand text-lg">
                <span className="text-pop-yellow">Pop</span>
                <span className="text-foreground">{brand.replace(/^Pop/, "")}</span>
              </span>
            </a>
            <span className="text-foreground/30">/</span>
            <span className="text-sm font-semibold text-foreground">Changelog</span>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Changelog</h1>
        <P>All notable changes, bug fixes, and improvements to {brand} are documented here.</P>

        {/* ── PopSuite 1.0.0 ── */}
        <SectionHeading id="popsuite-1-0-0" isFirst>PopSuite 1.0.0 &mdash; July 8, 2026</SectionHeading>
        <P>
          PopJot now ships as part of <strong>PopSuite</strong>, a single desktop install
          that bundles PopJot and PopKey together. One installer, one tray icon, one
          settings window &mdash; each app still runs as its own process underneath.
        </P>
        <ul className="space-y-1 mb-6">
          <Entry tag="new">Single installer for PopJot and PopKey &mdash; one download, one tray icon, both apps included</Entry>
          <Entry tag="new">Unified system tray with a toggle for each app, one Settings item, About PopSuite, Launch Preferences, Changelog, and Documentation</Entry>
          <Entry tag="new">One settings window with a PopJot tab and a PopKey tab that switch instantly, no reload</Entry>
          <Entry tag="new">Cross-app settings sync &mdash; opt in per setting to keep shared values (like color palette) in sync between PopJot and PopKey</Entry>
          <Entry tag="new">PopKey automatically hides its overlay while PopJot is annotating or in Spotlight mode, and restores itself afterward</Entry>
          <Entry tag="new">Spotlight presenter mode (Alt+Shift+D, Cmd+Shift+D on macOS) &mdash; dims the screen except a circle that follows your cursor, for calling out one spot on screen without drawing</Entry>
          <Entry tag="new">Spotlight circle resizes live with the scroll wheel, with adjustable soft-edge and dim-strength sliders; press Escape to exit</Entry>
          <Entry tag="new">Automatic background updates on Windows, with a manual &quot;Check for Updates&quot; option on every platform</Entry>
          <Entry tag="improved">macOS and Linux builds are now available (unsigned) alongside the signed Windows installer</Entry>
        </ul>

        {/* ── PopJot v1.0.0 ── */}
        <SectionHeading id="v1-0-0">PopJot v1.0.0 &mdash; March 2026</SectionHeading>
        <P>Initial public release of PopJot.</P>
        <ul className="space-y-1 mb-6">
          <Entry tag="new">Transparent fullscreen drawing overlay for desktop (Windows, macOS, Linux)</Entry>
          <Entry tag="new">Chrome extension with Shadow DOM overlay on any webpage</Entry>
          <Entry tag="new">Radial menu with 6 tools: Pen, Marker, Highlighter, Eraser, Shapes, Clear</Entry>
          <Entry tag="new">4 menu styles: Flat, Flat Outline, Pop, Glow</Entry>
          <Entry tag="new">8 color palettes: Muted, Vibrant, Retro, Neon, Pastel, Gradient, Glitter, Solid</Entry>
          <Entry tag="new">Dark and light theme support</Entry>
          <Entry tag="new">3 animation intensity levels: Low, Medium, High</Entry>
          <Entry tag="new">Dynamic resolution scaling (optimized for 1080p through 4K)</Entry>
          <Entry tag="new">Global hotkeys &mdash; hold or toggle overlay without interrupting your workflow</Entry>
          <Entry tag="new">Canvas grid options: none, lines, dots</Entry>
          <Entry tag="new">Persistent settings saved locally (no account required)</Entry>
        </ul>

        {/* ─── Footer ─── */}
        <div className="mt-20 pt-8 border-t border-foreground/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <a href="/" className="text-sm text-foreground/50 hover:text-foreground transition-colors">
              &larr; Back to {brand}
            </a>
            <div className="flex gap-6 text-sm text-foreground/40">
              <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChangelogRoot;
