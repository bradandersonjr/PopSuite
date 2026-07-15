/**
 * Shared landing-page template for PopSuite apps.
 *
 * Owns the page structure both sites share: full-screen snap sections
 * (hero / demo / features / how-it-works / settings / use-cases / pricing /
 * faq), the wheel-driven section scroller, dot navigation, FAQ accordion,
 * settings FAB + modal, and the footer.
 *
 * Apps supply content (copy, feature/step/plan/faq data) and theme behavior
 * (card styling, decorative shapes, accent colors) via props.
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Plus, Minus, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { useMobileDetect } from "@shared/hooks/useMobileDetect";
import MobileGate from "@shared/roots/MobileGate";

export type CardStyle = { className: string; style: React.CSSProperties };

type IconComponent = LucideIcon;

export interface LandingFeature {
  icon: IconComponent;
  label: string;
  description: string;
  colorIndex: number;
}

export interface LandingStep {
  icon: IconComponent;
  number: string;
  title: string;
  description: string;
  colorIndex: number;
}

export interface LandingUseCase {
  icon: IconComponent;
  title: string;
  description: string;
  colorIndex: number;
}

export interface LandingPlan {
  name: string;
  price: string;
  period: string;
  colorIndex: number;
  ctaColorIndex: number;
  popular: boolean;
  features: string[];
  cta: string;
  url: string | null;
  crossLink?: { label: string; href: string | null };
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingContent {
  appName: string;
  hero: {
    /** Logo image or wordmark heading. */
    brand: React.ReactNode;
    tagline: React.ReactNode;
    pills: Array<{ icon: IconComponent; label: string; colorIndex: number }>;
    /** Line under the CTA, desktop only (e.g. hotkey hint). */
    hint?: React.ReactNode;
    footnote: React.ReactNode;
  };
  demo: { heading: React.ReactNode; description: string };
  features: { heading: React.ReactNode; description: string; items: LandingFeature[] };
  howItWorks: {
    heading: React.ReactNode;
    description: string;
    steps: LandingStep[];
    /** Optional extra rows under the step cards (e.g. PopJot's detail cards). */
    extra?: React.ReactNode;
  };
  settings: { heading: React.ReactNode; description: string };
  useCases: { heading: React.ReactNode; description: string; items: LandingUseCase[] };
  pricing: {
    heading: React.ReactNode;
    description: string;
    plans: LandingPlan[];
    planMinHeight: number;
  };
  faq: { heading: React.ReactNode; description: string; items: LandingFaq[] };
}

export interface LandingTheme {
  themeMode: string;
  /** Accent colors for the dot nav and FAB. */
  colors: readonly string[];
  /**
   * Card styling per color index. `slot` is a deterministic sequence number
   * the template threads through so themes can cycle colors without
   * adjacent repeats (PopJot's pop style); themes may ignore it.
   */
  card: (colorIndex: number, slot: number) => CardStyle;
  renderFloatingShapes: () => React.ReactNode;
  /** Decorative shapes per section: 0 features, 1 demo/how, 2 settings, 3 use-cases, 4 pricing, 5 faq. */
  renderSectionShapes: (index: number) => React.ReactNode;
  /** Optional hidden defs (e.g. SVG gradients referenced by shapes). */
  defs?: React.ReactNode;
  /** Override FAB placement (defaults to bottom-left). */
  fabStyle?: React.CSSProperties;
  /**
   * CSS custom properties applied on the page root so live settings can
   * theme the page chrome (e.g. `--radius` driven by the roundness slider).
   */
  cssVars?: React.CSSProperties;
}

const SECTION_IDS = ["hero", "demo", "features", "how-it-works", "settings", "use-cases", "pricing", "faq"] as const;

const SectionBadge = ({
  label,
  card,
  rotate,
  onClick,
}: {
  label: string;
  card: CardStyle;
  rotate: "rotate-1" | "-rotate-1";
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`${card.className} neo-box-hover px-6 py-2 inline-block ${rotate} mb-6 cursor-pointer`}
    style={card.style}
  >
    <span className="font-display text-sm font-bold text-foreground uppercase tracking-wider">{label}</span>
  </button>
);

const SectionIntro = ({
  heading,
  description,
}: {
  heading: React.ReactNode;
  description: string;
}) => (
  <>
    <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">{heading}</h2>
    <p className="font-body text-lg text-foreground/70 mt-6 max-w-2xl mx-auto">{description}</p>
  </>
);

/**
 * Scales its content down (never up) so a section's full content always fits
 * the viewport height — no clipping, no internal scrollbars. The natural
 * (unscaled) layout height is read via `offsetHeight`, which CSS transforms
 * don't affect, so applying the scale never feeds back into the measurement.
 * Fills its positioned parent; pass the section's inner content as children.
 */
const FitContent = ({ children }: { children: React.ReactNode }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = () => {
      const cs = getComputedStyle(outer);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const avail = outer.clientHeight - padY;
      const natural = inner.offsetHeight;
      setScale(natural > 0 && avail > 0 ? Math.min(1, avail / natural) : 1);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden px-6 py-12 md:px-12"
    >
      <div
        ref={innerRef}
        className="w-full"
        style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
      >
        {children}
      </div>
    </div>
  );
};

export const LandingPage = ({
  content,
  theme,
  settingsPanel,
  engine,
  navExtras,
}: {
  content: LandingContent;
  theme: LandingTheme;
  /** Rendered inside the settings modal (the app's embedded SystemTray). */
  settingsPanel: React.ReactNode;
  /** The app's live overlay engine, mounted at the page root. */
  engine: React.ReactNode;
  /**
   * Optional controls pinned top-left over the page (e.g. the PopSuite site's
   * per-app engine toggles). Single-app WebRoots omit it.
   */
  navExtras?: React.ReactNode;
}) => {
  const { appName } = content;
  const { card, colors, themeMode } = theme;

  const isMobile = useMobileDetect();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const handleClose = () => setSettingsOpen(false);
    window.addEventListener("close-settings", handleClose);
    return () => window.removeEventListener("close-settings", handleClose);
  }, []);
  const [activeSection, setActiveSection] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const currentSectionRef = useRef(0);

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  const animateScrollTo = useCallback((targetTop: number, duration = 600) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const startTime = performance.now();
    isAnimatingRef.current = true;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollTop = startTop + distance * easeInOut(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
      }
    };
    requestAnimationFrame(step);
  }, []);

  const scrollToSection = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, SECTION_IDS.length - 1));
      const section = document.getElementById(SECTION_IDS[clamped]);
      if (!section) return;
      currentSectionRef.current = clamped;
      setActiveSection(clamped);
      animateScrollTo(section.offsetTop);
    },
    [animateScrollTo]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (settingsOpen) return;
      e.preventDefault();
      if (isAnimatingRef.current) return;
      const next = currentSectionRef.current + (e.deltaY > 0 ? 1 : -1);
      scrollToSection(next);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [scrollToSection, settingsOpen]);

  return (
    <TooltipProvider>
      <div
        ref={scrollContainerRef}
        className={`w-full h-screen bg-background theme-${themeMode} overflow-x-hidden overflow-y-hidden`}
        style={theme.cssVars}
      >
        {isMobile && <MobileGate />}

        {navExtras}

        {theme.defs}

        {/* ─── HERO ─── */}
        <section id="hero" className="relative h-screen overflow-hidden">
          {theme.renderFloatingShapes()}
          <FitContent>
            <div className="flex flex-col items-center gap-12 max-w-3xl mx-auto text-center z-10 w-full">
              {content.hero.brand}

              <p className="font-body text-xl md:text-2xl font-medium text-foreground max-w-xl leading-snug">
                {content.hero.tagline}
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                {content.hero.pills.map((f, i) => (
                  <div
                    key={f.label}
                    className={`${card(f.colorIndex, 1 + i).className} neo-box-hover px-5 py-3 flex items-center gap-2 relative overflow-hidden`}
                    style={card(f.colorIndex, 1 + i).style}
                  >
                    <div className="relative z-10 flex items-center gap-2">
                      <f.icon className="w-5 h-5 text-foreground" strokeWidth={2.5} />
                      <span className="font-display text-sm font-bold text-foreground uppercase tracking-wide">
                        {f.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => scrollToSection(3)}
                className={`${card(3, 4).className} neo-box-hover px-10 py-4 mt-2 inline-block rotate-1 cursor-pointer`}
                style={card(3, 4).style}
              >
                <span className="font-display text-lg md:text-xl font-bold text-foreground uppercase tracking-wider">
                  {isMobile ? "How it works →" : "Try now! →"}
                </span>
              </button>

              {!isMobile && content.hero.hint && (
                <p className="font-body text-base md:text-lg text-muted-foreground">{content.hero.hint}</p>
              )}

              <p className="font-body text-sm text-muted-foreground">{content.hero.footnote}</p>
            </div>
          </FitContent>
          <button
            onClick={() => scrollToSection(1)}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex justify-center cursor-pointer hover:scale-110 transition-transform z-10"
            aria-label="Scroll to features"
          >
            <ChevronDown className="w-8 h-8 text-muted-foreground bounce-arrow" strokeWidth={2} />
          </button>
        </section>

        {/* ─── DEMO VIDEO ─── */}
        <section id="demo" className="relative h-screen overflow-hidden bg-primary/5">
          {theme.renderSectionShapes(1)}
          <FitContent>
            <div className="max-w-5xl mx-auto w-full">
              <div className="text-center mb-10">
                <SectionBadge label="Demo" card={card(5, 5)} rotate="-rotate-1" onClick={() => scrollToSection(1)} />
                <SectionIntro heading={content.demo.heading} description={content.demo.description} />
              </div>
              <div className={`${card(2, 2).className} w-full aspect-video overflow-hidden`} style={card(2, 2).style}>
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/"
                  title={`${appName} Demo`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </FitContent>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="relative h-screen overflow-hidden">
          {theme.renderSectionShapes(0)}
          <FitContent>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <SectionBadge label="Features" card={card(0, 0)} rotate="rotate-1" onClick={() => scrollToSection(2)} />
                <SectionIntro heading={content.features.heading} description={content.features.description} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.features.items.map((f, i) => (
                  <div
                    key={f.label}
                    className={`${card(f.colorIndex, 6 + i).className} neo-box-hover p-6 flex flex-col gap-3 relative overflow-hidden`}
                    style={card(f.colorIndex, 6 + i).style}
                  >
                    <f.icon className="relative z-10 w-8 h-8 text-foreground" strokeWidth={2.5} />
                    <h3 className="relative z-10 font-display text-lg font-bold text-foreground">{f.label}</h3>
                    <p className="relative z-10 font-body text-sm text-foreground/80 leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </FitContent>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="relative h-screen overflow-hidden bg-primary/5">
          {theme.renderSectionShapes(1)}
          <FitContent>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <SectionBadge label="How it works" card={card(3, 3)} rotate="-rotate-1" onClick={() => scrollToSection(3)} />
                <SectionIntro heading={content.howItWorks.heading} description={content.howItWorks.description} />
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${content.howItWorks.extra ? "mb-16" : ""}`}>
                {content.howItWorks.steps.map((step, i) => (
                  <div
                    key={step.title}
                    className={`${card(step.colorIndex, 13 + i).className} neo-box-hover p-6 flex flex-col gap-4 relative overflow-hidden`}
                    style={card(step.colorIndex, 13 + i).style}
                  >
                    <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-3xl font-bold text-foreground">{step.number}.</span>
                        <step.icon className="w-7 h-7 text-foreground" strokeWidth={2.5} />
                      </div>
                      <h3 className="font-display text-xl font-bold text-foreground">{step.title}</h3>
                    </div>
                    <p className="relative z-10 font-body text-sm text-foreground/80 leading-relaxed text-center">{step.description}</p>
                  </div>
                ))}
              </div>

              {content.howItWorks.extra}
            </div>
          </FitContent>
        </section>

        {/* ─── SETTINGS ─── */}
        <section id="settings" className="relative h-screen overflow-hidden">
          {theme.renderSectionShapes(2)}
          <FitContent>
            <div className="relative z-10 max-w-5xl mx-auto">
              <div className="text-center mb-4">
                <SectionBadge label="Settings" card={card(4, 4)} rotate="rotate-1" onClick={() => scrollToSection(4)} />
                <SectionIntro heading={content.settings.heading} description={content.settings.description} />
                <p className="font-body text-sm text-muted-foreground mt-8 italic">
                  This is the actual settings panel that the app uses
                </p>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className={`${card(4, 4).className} neo-box-hover px-8 py-4 cursor-pointer`}
                  style={card(4, 4).style}
                >
                  <span className="font-display text-base font-bold text-foreground uppercase tracking-wider">
                    Open Settings
                  </span>
                </button>
              </div>
            </div>
          </FitContent>
        </section>

        {/* ─── USE CASES ─── */}
        <section id="use-cases" className="relative h-screen overflow-hidden">
          {theme.renderSectionShapes(3)}
          <FitContent>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <SectionBadge label="Use Cases" card={card(1, 1)} rotate="rotate-1" onClick={() => scrollToSection(5)} />
                <SectionIntro heading={content.useCases.heading} description={content.useCases.description} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {content.useCases.items.map((u, i) => (
                  <div
                    key={u.title}
                    className={`${card(u.colorIndex, 22 + i).className} neo-box-hover p-6 flex flex-col gap-4 relative overflow-hidden`}
                    style={card(u.colorIndex, 22 + i).style}
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      <u.icon className="w-7 h-7 text-foreground" strokeWidth={2.5} />
                      <h3 className="font-display text-lg font-bold text-foreground">{u.title}</h3>
                    </div>
                    <p className="relative z-10 font-body text-sm text-foreground/80 leading-relaxed">{u.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </FitContent>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="relative h-screen overflow-hidden bg-primary/5">
          {theme.renderSectionShapes(4)}
          <FitContent>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <SectionBadge label="Pricing" card={card(5, 5)} rotate="-rotate-1" onClick={() => scrollToSection(6)} />
                <SectionIntro heading={content.pricing.heading} description={content.pricing.description} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-5xl mx-auto items-end">
                {content.pricing.plans.map((plan) => (
                  <div key={plan.name} style={plan.popular ? { paddingBottom: "24px" } : {}}>
                    <div
                      className={`${card(plan.colorIndex, plan.colorIndex).className} neo-box-hover p-8 flex flex-col gap-5 relative overflow-hidden`}
                      style={{ ...card(plan.colorIndex, plan.colorIndex).style, minHeight: `${content.pricing.planMinHeight}px` }}
                    >
                      {plan.popular && (
                        <div className="relative z-10 font-display text-xs font-bold uppercase tracking-widest px-3 py-2 self-start mb-2" style={{ backgroundColor: "#000", color: "#fff", border: "3px solid #000", borderRadius: "var(--radius)", boxShadow: "2px 2px 0px #000" }}>
                          Most Popular
                        </div>
                      )}

                      <h3 className="relative z-10 font-display text-2xl font-bold text-foreground">{plan.name}</h3>
                      <div className="relative z-10 flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="font-body text-sm text-foreground/70">{plan.period}</span>
                      </div>
                      <ul className="relative z-10 flex flex-col gap-2">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-center gap-2 font-body text-sm text-foreground">
                            <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
                            {feat}
                          </li>
                        ))}
                      </ul>
                      {plan.crossLink && (
                        <div className="relative z-10 text-center">
                          {plan.crossLink.href ? (
                            <a href={plan.crossLink.href} target="_blank" rel="noopener noreferrer" className="font-body text-xs font-semibold text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors">
                              {plan.crossLink.label} →
                            </a>
                          ) : (
                            <span className="font-body text-xs text-foreground/50">{plan.crossLink.label} →</span>
                          )}
                        </div>
                      )}
                      {plan.url ? (
                        <a
                          href={plan.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`relative z-10 ${card(plan.ctaColorIndex, plan.ctaColorIndex).className} neo-box-hover px-6 py-3 text-center mt-auto block`}
                          style={{ backgroundColor: "#fff", color: "#000", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
                        >
                          <span className="font-display text-sm font-bold uppercase tracking-wide">{plan.cta}</span>
                        </a>
                      ) : (
                        <div className={`relative z-10 ${card(plan.ctaColorIndex, plan.ctaColorIndex).className} neo-box-hover px-6 py-3 text-center mt-auto opacity-50 cursor-not-allowed`} style={{ backgroundColor: "#fff", color: "#000", border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}>
                          <span className="font-display text-sm font-bold uppercase tracking-wide">Coming Soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FitContent>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="relative flex h-screen flex-col overflow-hidden">
          {theme.renderSectionShapes(5)}
          <div className="relative flex-1">
            <FitContent>
              <div className="mx-auto w-full max-w-3xl">
                <div className="text-center mb-16">
                  <SectionBadge label="FAQ" card={card(2, 2)} rotate="-rotate-1" onClick={() => scrollToSection(7)} />
                  <SectionIntro heading={content.faq.heading} description={content.faq.description} />
                </div>

                <div className="flex flex-col gap-4 w-full">
                  {content.faq.items.map((faq, i) => (
                    <motion.div
                      key={i}
                      className="landing-card-faq neo-box-hover overflow-hidden w-full"
                      layout="position"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between p-5 text-left cursor-pointer"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        aria-expanded={openFaq === i}
                        aria-controls={`faq-answer-${i}`}
                      >
                        <h3 className="font-display text-base font-bold text-foreground flex-1">{faq.question}</h3>
                        <motion.div
                          animate={{ rotate: openFaq === i ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-4 flex-shrink-0"
                        >
                          {openFaq === i ? (
                            <Minus className="w-5 h-5 text-foreground" strokeWidth={2.5} />
                          ) : (
                            <Plus className="w-5 h-5 text-foreground" strokeWidth={2.5} />
                          )}
                        </motion.div>
                      </button>
                      <AnimatePresence initial={false}>
                        {openFaq === i && (
                          <motion.div
                            id={`faq-answer-${i}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5">
                              <p className="font-body text-sm text-foreground/80 leading-relaxed">{faq.answer}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            </FitContent>
          </div>
          <footer className="relative z-10 py-8 border-t border-foreground/10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="font-body text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} {appName} &mdash; made by{" "}
                <a href="https://www.bradandersonjr.com" target="_blank" rel="noopener noreferrer" className="font-comfortaa hover:text-foreground transition-colors">
                  @bradandersonjr
                </a>
              </p>
              <div className="flex gap-6 font-body text-sm text-muted-foreground">
                <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
                <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
                <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              </div>
            </div>
          </footer>
        </section>

        {/* ─── DOT NAV ─── */}
        {!isMobile && (
          <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4" aria-label="Page sections">
            {SECTION_IDS.map((id, i) => {
              const color = colors[i % colors.length];
              const dotCard = card(i, i);
              return (
                <button
                  key={id}
                  onClick={() => scrollToSection(i)}
                  aria-label={`Go to ${id}`}
                  className="group flex items-center justify-end gap-3 cursor-pointer"
                >
                  <span
                    className={`${dotCard.className} font-display text-sm font-bold text-foreground uppercase tracking-wide px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0`}
                    style={dotCard.style}
                  >
                    {id.replace(/-/g, " ")}
                  </span>
                  <span
                    className="block rounded-full transition-all duration-300 flex-shrink-0"
                    style={{
                      width: activeSection === i ? "16px" : "10px",
                      height: activeSection === i ? "16px" : "10px",
                      backgroundColor: activeSection === i ? color : `${color}66`,
                      boxShadow: activeSection === i ? `0 0 10px ${color}aa` : "none",
                    }}
                  />
                </button>
              );
            })}
          </nav>
        )}

        {/* ─── SETTINGS FAB + MODAL ─── */}
        {/* Reuses the app's card() so the button matches the live style,
            palette, roundness, and theme just like the page cards. */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          className={`fixed z-40 flex h-14 w-14 items-center justify-center text-foreground neo-box-hover ${card(0, 0).className}`}
          // position:fixed inline so the .landing-glitter rule (position:relative)
          // can't override the Tailwind `fixed` class and drop the FAB into flow.
          style={{ ...card(0, 0).style, position: "fixed", bottom: "1.5rem", left: "1.5rem", ...theme.fabStyle }}
        >
          <Settings className="h-6 w-6" strokeWidth={2.5} />
        </button>

        {settingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setSettingsOpen(false)}>
            <div className="absolute inset-0 bg-black/80" />
            <div className="relative rounded-[24px] overflow-auto shadow-2xl max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
              {settingsPanel}
            </div>
          </div>
        )}

        {engine}
      </div>
    </TooltipProvider>
  );
};

