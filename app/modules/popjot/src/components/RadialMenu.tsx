import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Bolt, History, Pen, PenLine, Highlighter, Eraser, TvMinimal, Circle, Moon, Sun, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, Tool, StrokeType, BackgroundMode, MenuStyle, ColorPalette, DRAWING_TOOLS } from "@popjot/store/useStore";
import { normalizeKey, isHotkeyPressed } from "@shared/lib/hotkeys";
import { isDesktop, onOverlayDeactivateRequested, onShortcutActivate, onShortcutLastTool, onShortcutPersistent, overlayActivated, overlayDeactivated } from "@popjot/lib/platform";
import { getGradientVariantStops, getHighlighterGradientStops } from "@popjot/config/themes";
import { getAnimationConfig } from "@shared/config/animations";
import { getEffectiveColors, getProPalette } from "@popjot/pro";
import RadialButton from "./RadialButton";
import PaletteEffectOverlay from "@shared/components/PaletteEffectOverlay";
import { withAlpha } from "@popjot/lib/color";

const BASE_SCREEN_ITEMS = [
  { icon: X, bg: "transparent" as const, color: undefined },
  { icon: Moon, bg: "dark" as const, color: undefined },
  { icon: Sun, bg: "light" as const, color: undefined },
];

const MAIN_ICONS = [History, Pen, PenLine, Highlighter, Eraser, TvMinimal];
const MAIN_LABELS = ["History", "Marker", "Pen", "Highlighter", "Eraser", "Screen"];
const MAIN_TOOLS = ["history", "marker", "pen", "highlighter", "eraser", "screen"] as const;

const toColorItems = (colors: readonly string[], palette: ColorPalette, mode: "draw" | "highlighter" | "none" = "none") =>
  colors.map((c, index) => ({
    icon: Circle,
    color: c,
    gradientStops: palette === "gradient" && mode === "draw"
      ? getGradientVariantStops(index)
      : palette === "gradient" && mode === "highlighter"
        ? getHighlighterGradientStops(c)
        : undefined,
  }));

// ─── Layout Constants ───────────────────────────────────────────────

const BASE_RADIUS = 88;
const BASE_SUB_RADIUS = 88;
const HOVER_SELECT_INTENT_MS = 0;

const getPosition = (index: number, total: number, radius: number, offset: number = 0) => {
  const angle = (index * 360) / total - 90 + offset;
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
};

const SPRING_CONFIG = { type: "spring", stiffness: 1500, damping: 40 } as const;

const pickPopColors = (palette: ColorPalette): { colors: string[]; centerColor: string; centerGradient?: [string, string]; gradientStops?: readonly string[][] } => {
  const { draw, tertiary } = getEffectiveColors(palette);

  // Fisher-Yates shuffle for random button coloring each time
  const colors = Array.from(draw);
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  const centerColor = tertiary[Math.floor(Math.random() * tertiary.length)];

  // Only use gradient rendering when the built-in gradient palette is active with no custom Pro override
  if (palette === "gradient" && getProPalette(palette) === null) {
    const gradientStops = colors.map((_, i) => [...getGradientVariantStops(i)]);
    // Pick 2 random distinct tertiary colors for the center gradient
    const shuffled = Array.from(tertiary);
    const a = Math.floor(Math.random() * shuffled.length);
    let b = Math.floor(Math.random() * (shuffled.length - 1));
    if (b >= a) b++;
    const centerGradient: [string, string] = [shuffled[a], shuffled[b]];
    return { colors, centerColor, centerGradient, gradientStops };
  }

  return { colors, centerColor };
};

/**
 * Angular gatekeeper: calculate which pie-slice (0-N) the mouse is in.
 * Must match getPosition() coordinate system: items start at -90° + offset,
 * each slice spans (360 / itemCount) degrees, centered on the item's angle.
 */
const getMouseSlice = (mousePos: { x: number; y: number }, menuOrigin: { x: number; y: number }, itemCount: number, angleOffset: number = 0): number | null => {
  const dx = mousePos.x - menuOrigin.x;
  const dy = mousePos.y - menuOrigin.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 20) return null;

  // Mouse angle in degrees (same coord system as atan2: 0° = right, 90° = down)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // getPosition places item 0 at (-90 + offset)°. Rotate so item 0 starts at 0°.
  const sliceSize = 360 / itemCount;
  const startAngle = -90 + angleOffset;
  angle = (angle - startAngle + 360 + sliceSize / 2) % 360;

  return Math.floor(angle / sliceSize) % itemCount;
};

/** Validate that a chip's index matches the current angular slice */
const isChipInActiveSlice = (
  chipIndex: number,
  itemCount: number,
  mousePos: { x: number; y: number },
  menuOrigin: { x: number; y: number },
  angleOffset: number = 0,
): boolean => {
  const slice = getMouseSlice(mousePos, menuOrigin, itemCount, angleOffset);
  return slice !== null && slice === chipIndex;
};

// ─── Component ──────────────────────────────────────────────────────

const RadialMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuInteractable, setMenuInteractable] = useState(false);
  const [subInteractable, setSubInteractable] = useState(false);

  const keysDown = useRef<Set<string>>(new Set());
  const mousePos = useRef({ x: 0, y: 0 });
  const menuOriginRef = useRef({ x: 0, y: 0 });
  const submenuOriginRef = useRef({ x: 0, y: 0 });
  const wasActive = useRef(false);
  const lastToolWasActive = useRef(false);
  const menuOpenRef = useRef(false);
  const shortcutActivatedRef = useRef(false); // Track if desktop shortcut was activated
  const popTimerRef = useRef<number | null>(null);
  const popClearTimerRef = useRef<number | null>(null);
  const hoverSelectTimerRef = useRef<number | null>(null);

  const setTool = useStore(state => state.setTool);
  const setColor = useStore(state => state.setColor);
  const setBackground = useStore(state => state.setBackground);
  const hotkey = useStore(state => state.hotkey);
  const persistentHotkey = useStore(state => state.persistentHotkey);
  const lastToolHotkey = useStore(state => state.lastToolHotkey);
  const menuStyle = useStore(state => state.menuStyle);
  const colorPalette = useStore(state => state.colorPalette);
  const glowIntensity = useStore(state => state.glowIntensity);
  const textColor = useStore(state => state.textColor);
  const themeMode = useStore(state => state.themeMode);
  const menuTranslucency = useStore(state => state.menuTranslucency);
  const brandingEnabled = useStore(state => state.brandingEnabled);
  const brandingImage = useStore(state => state.brandingImage);
  const brandingScale = useStore(state => state.brandingScale);
  const isPro = useStore(state => state.isPro);
  const menuBgAlpha = 1 - menuTranslucency / 100;
  const menuFlatBase = themeMode === "dark" ? "#242424" : "#F8F8F6";
  const scaleFactor = useStore(state => state.scaleFactor);
  const scaleMultiplier = useStore(state => state.scaleMultiplier);
  const effectiveScale = scaleFactor * scaleMultiplier;
  const pageZoomFactor = useStore(state => state.pageZoomFactor);

  // Scaled radii
  const RADIUS = BASE_RADIUS * effectiveScale;
  const SUB_RADIUS = BASE_SUB_RADIUS * effectiveScale;

  /** Random pop colors — reshuffled each time the menu opens */
  const popColorsRef = useRef(pickPopColors(colorPalette));

  // Subscribed directly (not read via getEffectiveColors() alone) so a Pro
  // custom-palette edit — which arrives here as a schema-synced IPC broadcast
  // from the Settings window, a separate renderer process — invalidates this
  // memo immediately instead of waiting on an unrelated re-render.
  const proDrawPalette = useStore(state => state.proDrawPalette);
  const proHighlighterPalette = useStore(state => state.proHighlighterPalette);
  const proPaletteActive = useStore(state => state.proPaletteActive);

  const SUB_MENUS = useMemo(() => {
    const { draw: drawColors, highlighter: highlighterColors } = getEffectiveColors(colorPalette);
    // Only use gradient rendering when the built-in gradient palette is active with no custom Pro override
    const useGradient = colorPalette === "gradient" && getProPalette(colorPalette) === null;

    const drawItems = toColorItems(drawColors, useGradient ? "gradient" : "muted", "draw");
    const highlighterItems = toColorItems(highlighterColors, useGradient ? "gradient" : "muted", "highlighter");
    const screenItems = BASE_SCREEN_ITEMS.map((item, i) => ({
      ...item,
      gradientStops: useGradient ? getGradientVariantStops(i) : undefined,
    }));
    return [
      null,
      { offset: 30, items: drawItems },
      { offset: 30, items: drawItems },
      { offset: 45, items: highlighterItems },
      null,
      { offset: 180, items: screenItems },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorPalette, proDrawPalette, proHighlighterPalette, proPaletteActive]);

  const checkHotkey = useCallback(
    () => isHotkeyPressed(hotkey, keysDown.current),
    [hotkey]
  );

  const checkPersistentHotkey = useCallback(
    () => isHotkeyPressed(persistentHotkey, keysDown.current),
    [persistentHotkey]
  );

  const checkLastToolHotkey = useCallback(
    () => isHotkeyPressed(lastToolHotkey, keysDown.current),
    [lastToolHotkey]
  );

  const toOverlayPoint = useCallback(
    (x: number, y: number) => ({ x: x * pageZoomFactor, y: y * pageZoomFactor }),
    [pageZoomFactor],
  );

  const openMenuAtCursor = useCallback(() => {
    const state = useStore.getState();
    popColorsRef.current = pickPopColors(state.colorPalette);
    const origin = { x: mousePos.current.x, y: mousePos.current.y };
    menuOriginRef.current = origin;
    setMenuPos(origin);
    setMenuOpen(true);
    setActiveIndex(null);
  }, []);

  // ─── Animation interaction delays ────────────────────────────────

  useEffect(() => {
    menuOpenRef.current = menuOpen;
    submenuOriginRef.current = menuPos;
    if (menuOpen) {
      setMenuInteractable(false);
      const timer = setTimeout(() => setMenuInteractable(true), 80);
      return () => clearTimeout(timer);
    } else {
      setMenuInteractable(false);
    }
  }, [menuOpen, menuPos]);

  useEffect(() => {
    if (activeIndex !== null) {
      setSubInteractable(false);
      const timer = setTimeout(() => setSubInteractable(true), 50);
      return () => clearTimeout(timer);
    } else {
      setSubInteractable(false);
    }
  }, [activeIndex]);

  // ─── Mouse tracking & right-click menu ────────────────────────────

  useEffect(() => {
    const onMove = (e: MouseEvent | PointerEvent) => {
      mousePos.current = toOverlayPoint(e.clientX, e.clientY);
    };
    const onRightClick = (e: MouseEvent) => {
      const state = useStore.getState();
      const leftHeld = (e.buttons & 1) !== 0;
      if (state.appEnabled && !state.isDrawing && !leftHeld) {
        e.preventDefault();
        popColorsRef.current = pickPopColors(state.colorPalette);
        setMenuOpen(true);
        const origin = toOverlayPoint(e.clientX, e.clientY);
        menuOriginRef.current = origin;
        setMenuPos(origin);
        setActiveIndex(null);
      }
    };
    // Extension: browser command intercepts the keypress so the hotkey state
    // machine never fires. ExtensionRoot dispatches this event instead.
    const onExtensionActivate = () => openMenuAtCursor();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("contextmenu", onRightClick);
    window.addEventListener("popjot:activate", onExtensionActivate);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("contextmenu", onRightClick);
      window.removeEventListener("popjot:activate", onExtensionActivate);
    };
  }, [openMenuAtCursor, toOverlayPoint]);

  // ─── Hotkey state machine ────────────────────────────────────────

  const checkKeys = useCallback((keyEvent?: string) => {
    const isMainActive = checkHotkey();
    // Last-tool combo activates like the main hotkey but skips the radial menu
    // (web builds; on desktop the key is swallowed by globalShortcut and this
    // path is driven over IPC instead).
    const isLastToolActive = checkLastToolHotkey();
    const isActive = isMainActive || isLastToolActive;
    const isPersistentSetupActive = checkPersistentHotkey();
    const state = useStore.getState();

    // Rising edge of the last-tool combo while the menu is up: dismiss it and
    // keep drawing with the current tool.
    if (isLastToolActive && !lastToolWasActive.current && menuOpenRef.current) {
      setMenuOpen(false);
    }
    lastToolWasActive.current = isLastToolActive;

    if (isPersistentSetupActive && !state.isPersistentMode && !isDesktop()) {
      state.setIsPersistentMode(true);
      state.setAppEnabled(true);
      state.setBackground("transparent");
    }

    // Escape exits any active session, not just persistent mode — a momentary
    // (hold-to-draw) session in Snapshot overlay mode is also appEnabled but
    // isPersistentMode is false, and previously had no way to Escape out.
    //
    // Web/extension only. The desktop overlay is non-focusable so it never sees
    // key events at all; main owns Escape there (globalShortcut) and drives the
    // exact same teardown over onOverlayDeactivateRequested below.
    if (keyEvent === "escape" && state.appEnabled && !isDesktop()) {
      state.setIsPersistentMode(false);
      state.setAppEnabled(false);
      state.setSnapshotDataUrl(null);
      setMenuOpen(false);
      state.triggerClearCanvas();
      wasActive.current = false;
      shortcutActivatedRef.current = false;
      overlayDeactivated();
      return;
    }

    if (state.isPersistentMode) {
      if (isActive && !wasActive.current) {
        // In desktop mode, activation comes from globalShortcut IPC — skip here
        if (!isDesktop() && isMainActive) openMenuAtCursor();
      } else if (!isActive && wasActive.current) {
        setMenuOpen(false);
      }
    } else {
      if (isActive && !wasActive.current) {
        // In desktop mode, activation comes from globalShortcut IPC — skip here
        if (!isDesktop()) {
          state.setAppEnabled(true);
          state.setBackground("transparent");
          if (isMainActive) openMenuAtCursor();
        }
      } else if (!isActive && wasActive.current) {
        state.setAppEnabled(false);
        state.setSnapshotDataUrl(null);
        setMenuOpen(false);
        state.triggerClearCanvas();
        overlayDeactivated();
      }
    }
    wasActive.current = isActive;
  }, [checkHotkey, checkLastToolHotkey, checkPersistentHotkey, openMenuAtCursor]);

  // ─── Keyboard listeners ──────────────────────────────────────────

  // These drive the hotkey state machine for the WEB and EXTENSION builds, where
  // there is no main process and DOM events are the only input the app ever gets.
  //
  // On DESKTOP the overlay is non-focusable — activating it would close the menus
  // and tooltips of the app being annotated — so it receives no key events at all
  // and these listeners are inert. Hold-to-draw release, Escape, and the focus-loss
  // fallback are all owned by the main process there (annotationKeys.ts +
  // globalShortcut), which drives the identical teardown over the
  // onOverlayDeactivateRequested IPC below. The `blur` fallback in particular has
  // no desktop meaning left: a window that never takes focus can never lose it.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysDown.current.add(normalizeKey(e.key));
      if (checkHotkey() || checkPersistentHotkey() || checkLastToolHotkey()) e.preventDefault();
      checkKeys(normalizeKey(e.key));
    };
    const onUp = (e: KeyboardEvent) => {
      keysDown.current.delete(normalizeKey(e.key));
      checkKeys(normalizeKey(e.key));
    };
    const onBlur = () => {
      keysDown.current.clear();
      checkKeys();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [checkKeys, checkHotkey, checkLastToolHotkey, checkPersistentHotkey]);

  // ─── Desktop global shortcut handler (Electron IPC) ───────────────

  useEffect(() => {
    if (!isDesktop()) return;

    const cleanupActivate = onShortcutActivate(({ x, y }, snapshotDataUrl) => {
      // Only activate if shortcut isn't already active (prevents duplicate triggers)
      if (shortcutActivatedRef.current) return;
      const state = useStore.getState();
      if (!state.appEnabled) {
        state.setAppEnabled(true);
        state.setBackground("transparent");
        state.setSnapshotDataUrl(snapshotDataUrl);
        overlayActivated();
      }
      popColorsRef.current = pickPopColors(state.colorPalette);
      menuOriginRef.current = { x, y };
      setMenuPos({ x, y });
      setMenuOpen(true);
      setActiveIndex(null);
      // Guards against a re-fire while already up. Cleared when main drives the
      // teardown (onOverlayDeactivateRequested) — main owns release detection
      // now, since the non-focusable overlay never sees the keyup itself.
      shortcutActivatedRef.current = true;
    });

    const cleanupPersistent = onShortcutPersistent(({ x, y }, snapshotDataUrl) => {
      const state = useStore.getState();
      if (state.overlayMode === "snapshot") {
        // In snapshot mode the persistent shortcut behaves like the main shortcut:
        // hold to show, release to dismiss (no toggle).
        if (shortcutActivatedRef.current) return;
        if (!state.appEnabled) {
          state.setAppEnabled(true);
          state.setBackground("transparent");
          state.setSnapshotDataUrl(snapshotDataUrl);
          overlayActivated();
        }
        popColorsRef.current = pickPopColors(state.colorPalette);
        menuOriginRef.current = { x, y };
        setMenuPos({ x, y });
        setMenuOpen(true);
        setActiveIndex(null);
        shortcutActivatedRef.current = true;
        return;
      }
      // Live mode: persistent shortcut toggles persistent drawing mode
      if (!state.isPersistentMode) {
        state.setIsPersistentMode(true);
        state.setAppEnabled(true);
        state.setBackground("transparent");
        state.setSnapshotDataUrl(snapshotDataUrl);
        overlayActivated();
      }
      // Only update position if menu wasn't already open
      if (!menuOpenRef.current) {
        popColorsRef.current = pickPopColors(state.colorPalette);
        menuOriginRef.current = { x, y };
        setMenuPos({ x, y });
        setMenuOpen(true);
        setActiveIndex(null);
      }
    });

    return () => {
      cleanupActivate();
      cleanupPersistent();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    return onOverlayDeactivateRequested(() => {
      const state = useStore.getState();
      state.setIsPersistentMode(false);
      state.setAppEnabled(false);
      state.setSnapshotDataUrl(null);
      setMenuOpen(false);
      state.triggerClearCanvas();
      wasActive.current = false;
      shortcutActivatedRef.current = false;
      overlayDeactivated();
    });
  }, []);

  // Tray-settings broadcasts are applied generically by useTraySettingsSync
  // (mounted in DesktopRoot), so no per-setting handlers are needed here.

  // ─── Selection pop animation ─────────────────────────────────────

  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) clearTimeout(popTimerRef.current);
      if (popClearTimerRef.current !== null) clearTimeout(popClearTimerRef.current);
      if (hoverSelectTimerRef.current !== null) clearTimeout(hoverSelectTimerRef.current);
    };
  }, []);

  const animationIntensity = useStore(state => state.animationIntensity);
  const buttonRoundness = useStore(state => state.buttonRoundness);
  const animConfig = getAnimationConfig(animationIntensity);

  const playSelectionPop = useCallback((itemId: string) => {
    if (popTimerRef.current !== null) clearTimeout(popTimerRef.current);
    if (popClearTimerRef.current !== null) clearTimeout(popClearTimerRef.current);

    setSelectedItemId(itemId);
    popTimerRef.current = window.setTimeout(() => setMenuOpen(false), animConfig.selectionDuration);
    popClearTimerRef.current = window.setTimeout(() => setSelectedItemId(null), animConfig.selectionDuration + 10);
  }, [animConfig]);

  // Last-tool shortcut (e.g. Alt+Shift+W): activate straight into drawing with
  // the last-used tool, skipping the radial menu — the keyboard twin of the top
  // (History) slot. If the menu is already open, dismiss it with the same pop.
  useEffect(() => {
    if (!isDesktop()) return;
    return onShortcutLastTool((snapshotDataUrl) => {
      const state = useStore.getState();
      if (!state.appEnabled) {
        state.setAppEnabled(true);
        state.setBackground("transparent");
        state.setSnapshotDataUrl(snapshotDataUrl);
        overlayActivated();
        shortcutActivatedRef.current = true; // cleared when main detects the modifier release
      } else if (menuOpenRef.current) {
        playSelectionPop("main-0");
      }
    });
  }, [playSelectionPop]);

  const hasActiveSelection = selectedItemId !== null;

  const clearHoverSelectionTimer = useCallback(() => {
    if (hoverSelectTimerRef.current !== null) {
      clearTimeout(hoverSelectTimerRef.current);
      hoverSelectTimerRef.current = null;
    }
  }, []);

  const scheduleLeafSelection = useCallback((selectionId: string, action?: () => void) => {
    clearHoverSelectionTimer();
    hoverSelectTimerRef.current = window.setTimeout(() => {
      action?.();
      playSelectionPop(selectionId);
      hoverSelectTimerRef.current = null;
    }, HOVER_SELECT_INTENT_MS);
  }, [clearHoverSelectionTimer, playSelectionPop]);

  // ─── Render ──────────────────────────────────────────────────────

  // Glow shares Pop's palette-color logic (colored fill); only the chrome differs.
  const isPop = menuStyle === "pop" || menuStyle === "glow";

  return (
    <AnimatePresence>
      {menuOpen && (
        // No cursor-* here: EngineShell hides the cursor for the whole overlay
        // while a session is live, and drawing draws its own. A cursor-default on
        // this full-screen layer sits ABOVE the canvas and hands the system
        // cursor straight back.
        <div className="fixed inset-0 z-[100000] pointer-events-none">
          <div className="absolute" style={{ left: menuPos.x, top: menuPos.y }}>
            {/* Main items */}
            <AnimatePresence>
              {activeIndex === null && MAIN_ICONS.map((Icon, i) => {
                const pos = getPosition(i, MAIN_ICONS.length, RADIUS);
                const isSelected = selectedItemId === `main-${i}`;
                if (hasActiveSelection && !isSelected) return null;
                return (
                  <RadialButton
                    key={`main-${i}`}
                    variant={menuStyle}
                    position={pos}
                    isSelected={isSelected}
                    interactable={menuInteractable && activeIndex === null}
                    hasActiveSelection={hasActiveSelection}
                    menuOpen={menuOpen}
                    title={MAIN_LABELS[i]}
                    ringColor={
                      menuStyle === "flat-outline"
                        ? popColorsRef.current.colors[i % popColorsRef.current.colors.length]
                        : undefined
                    }
                    popColor={
                      isPop && !popColorsRef.current.gradientStops
                        ? popColorsRef.current.colors[i % popColorsRef.current.colors.length]
                        : undefined
                    }
                    popGradientStops={isPop && popColorsRef.current.gradientStops ? popColorsRef.current.gradientStops[i % popColorsRef.current.gradientStops.length] : undefined}
                    onHoverStart={() => {
                      // Angular gatekeeper: validate chip is in the correct slice
                      if (!isChipInActiveSlice(i, MAIN_ICONS.length, mousePos.current, menuOriginRef.current)) return;

                      const mainTool = MAIN_TOOLS[i] as Tool;
                      if (!SUB_MENUS[i]) {
                        setActiveIndex(null);
                        scheduleLeafSelection(`main-${i}`, () => {
                          if (DRAWING_TOOLS.has(mainTool as StrokeType)) setTool(mainTool);
                        });
                      } else {
                        clearHoverSelectionTimer();
                        const p = getPosition(i, MAIN_ICONS.length, RADIUS);
                        setMenuPos({ x: menuOriginRef.current.x + p.x, y: menuOriginRef.current.y + p.y });
                        if (DRAWING_TOOLS.has(mainTool as StrokeType)) setTool(mainTool);
                        setActiveIndex(i);
                      }
                    }}
                    onHoverEnd={clearHoverSelectionTimer}
                  >
                    <Icon size={28 * effectiveScale} strokeWidth={2} />
                  </RadialButton>
                );
              })}
            </AnimatePresence>

            {/* Sub-menu */}
            <AnimatePresence>
              {(() => {
                const subMenu = activeIndex !== null ? SUB_MENUS[activeIndex] : null;
                if (!subMenu) return null;

                return (
                  <>
                    {subMenu.items.map((item, si) => {
                      const pos = getPosition(si, subMenu.items.length, SUB_RADIUS, subMenu.offset);
                      const SubIcon = item.icon;
                      const isSelected = selectedItemId === `sub-${activeIndex}-${si}`;
                      if (hasActiveSelection && !isSelected) return null;
                      return (
                        <RadialButton
                          key={`sub-${activeIndex}-${si}`}
                          variant={menuStyle === "glow" ? "glow" : isPop && item.color ? ("pop-light" as MenuStyle) : menuStyle}
                          position={pos}
                          isSelected={isSelected}
                          interactable={subInteractable}
                          hasActiveSelection={hasActiveSelection}
                          menuOpen={menuOpen}
                          ringColor={menuStyle !== "glow" && (isPop || menuStyle === "flat-outline") && item.color ? item.color : undefined}
                          popColor={
                            menuStyle === "glow" && item.color
                              ? item.color
                              : isPop && !item.color && !item.gradientStops
                              ? popColorsRef.current.colors[si % popColorsRef.current.colors.length]
                              : undefined
                          }
                          popGradientStops={isPop && !item.color && item.gradientStops ? item.gradientStops : undefined}
                          onHoverStart={() => {
                            // Validate chip is in active angular slice (with offset for submenu layout)
                            const isValid = isChipInActiveSlice(
                              si,
                              subMenu.items.length,
                              mousePos.current,
                              menuPos,
                              subMenu.offset,
                            );
                            if (!isValid) return;

                            scheduleLeafSelection(`sub-${activeIndex}-${si}`, () => {
                              if (item.color) setColor(item.color);
                              if (item.bg) setBackground(item.bg as BackgroundMode);
                            });
                          }}
                          onHoverEnd={clearHoverSelectionTimer}
                          title={`sub-${activeIndex}-${si}`}
                        >
                          {item.color ? (
                            <div style={{
                              width: 28 * effectiveScale,
                              height: 28 * effectiveScale,
                              borderRadius: `${buttonRoundness / 2}%`,
                              flexShrink: 0,
                              background: item.gradientStops && item.gradientStops.length > 1
                                ? `linear-gradient(135deg, ${item.gradientStops.join(", ")})`
                                : item.color,
                            }} />
                          ) : (
                            <SubIcon size={28 * effectiveScale} strokeWidth={2} fill="none" color="currentColor" />
                          )}
                        </RadialButton>
                      );
                    })}
                  </>
                );
              })()}
            </AnimatePresence>

            {/* Center circle */}
            {(() => {
              // Branding logo replaces the center shape (Pro). Stored in
              // settings so it renders in every build, gated on Pro + enabled.
              const brandingActive = (!isDesktop() || isPro) && brandingEnabled && brandingImage !== "";
              const proScale = activeIndex === null && brandingActive ? brandingScale : 1;
              const proIcon = brandingActive ? brandingImage : null;
              const circleSize = 48 * effectiveScale * proScale;
              const iconSize = 22 * effectiveScale * proScale;
              const centerBorderRadius = `${buttonRoundness / 2}%`;
              return (
                <motion.div
                  className={`absolute z-40 flex items-center justify-center radial-btn-${menuStyle}`}
                  style={{
                    borderRadius: centerBorderRadius,
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                    marginLeft: `${-circleSize / 2}px`,
                    marginTop: `${-circleSize / 2}px`,
                    padding: 0,
                    boxSizing: "border-box",
                    lineHeight: 0,
                    overflow: "hidden",
                    ...(isPop && popColorsRef.current.centerGradient
                      ? { background: `linear-gradient(135deg, ${withAlpha(popColorsRef.current.centerGradient[0], menuBgAlpha)}, ${withAlpha(popColorsRef.current.centerGradient[1], menuBgAlpha)})` }
                      : { backgroundColor: withAlpha(isPop ? popColorsRef.current.centerColor : menuFlatBase, menuBgAlpha) }),
                    ...(menuStyle === "glow"
                      ? (() => {
                          const glow = popColorsRef.current.centerGradient?.[0] ?? popColorsRef.current.centerColor;
                          if (!glow) return {};
                          const gi = glowIntensity / 100;
                          return { boxShadow: `0 0 ${Math.round(8 + gi * 16)}px ${glow}, 0 0 ${Math.round(16 + gi * 30)}px ${glow}88` };
                        })()
                      : {}),
                    ...(textColor === "white" ? { color: "#ffffff" } : textColor === "black" ? { color: "#111111" } : {}),
                  }}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={hasActiveSelection ? { scale: 0, rotate: 0 } : { scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90, transition: { duration: hasActiveSelection ? 0 : menuOpen ? 0.1 : 0 } }}
                  transition={hasActiveSelection ? { duration: 0 } : SPRING_CONFIG}
                >
                  {activeIndex === null ? (
                    proIcon ? (
                      <img src={proIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: centerBorderRadius }} />
                    ) : (
                      <Bolt size={iconSize} strokeWidth={2} />
                    )
                  ) : (
                    (() => {
                      const ActiveIcon = MAIN_ICONS[activeIndex];
                      return <ActiveIcon size={iconSize} strokeWidth={2} />;
                    })()
                  )}
                  <PaletteEffectOverlay palette={colorPalette} size={circleSize} seed="center" tintColor={isPop ? popColorsRef.current.centerColor : undefined} />
                </motion.div>
              );
            })()}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RadialMenu;
