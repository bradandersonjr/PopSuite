import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Bolt, History, Pen, PenLine, Highlighter, Eraser, TvMinimal, Circle, Moon, Sun, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, Tool, StrokeType, BackgroundMode, MenuStyle, ColorPalette, DRAWING_TOOLS } from "@/store/useStore";
import { normalizeKey, isHotkeyPressed, isMac } from "@shared/lib/hotkeys";
import { isDesktop, onShortcutActivate, onShortcutPersistent, overlayActivated, overlayDeactivated } from "@/lib/platform";
import { getGradientVariantStops, getHighlighterGradientStops } from "@/config/themes";
import { getAnimationConfig } from "@shared/config/animations";
import { getProCenterIcon, getProCenterScale, getEffectiveColors, getProPalette } from "@/pro";
import RadialButton from "./RadialButton";
import PaletteEffectOverlay from "./PaletteEffectOverlay";

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
  const menuStyle = useStore(state => state.menuStyle);
  const colorPalette = useStore(state => state.colorPalette);
  const popMonoColor = useStore(state => state.popMonoColor);
  const scaleFactor = useStore(state => state.scaleFactor);
  const pageZoomFactor = useStore(state => state.pageZoomFactor);

  // Scaled radii
  const RADIUS = BASE_RADIUS * scaleFactor;
  const SUB_RADIUS = BASE_SUB_RADIUS * scaleFactor;

  /** Random pop colors — reshuffled each time the menu opens */
  const popColorsRef = useRef(pickPopColors(colorPalette));

  const paletteVersion = useStore(state => state.paletteVersion);

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
  }, [colorPalette, paletteVersion]); // paletteVersion invalidates when Pro palette changes

  const checkHotkey = useCallback(
    () => isHotkeyPressed(hotkey, keysDown.current),
    [hotkey]
  );

  const checkPersistentHotkey = useCallback(
    () => isHotkeyPressed(persistentHotkey, keysDown.current),
    [persistentHotkey]
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
    const isActive = checkHotkey();
    const isPersistentSetupActive = checkPersistentHotkey();
    const state = useStore.getState();

    if (isPersistentSetupActive && !state.isPersistentMode && !isDesktop()) {
      state.setIsPersistentMode(true);
      state.setAppEnabled(true);
      state.setBackground("transparent");
    }

    if (keyEvent === "escape" && state.isPersistentMode) {
      state.setIsPersistentMode(false);
      state.setAppEnabled(false);
      state.setSnapshotDataUrl(null);
      setMenuOpen(false);
      state.triggerClearCanvas();
      wasActive.current = false;
      overlayDeactivated();
      return;
    }

    if (state.isPersistentMode) {
      if (isActive && !wasActive.current) {
        // In desktop mode, activation comes from globalShortcut IPC — skip here
        if (!isDesktop()) openMenuAtCursor();
      } else if (!isActive && wasActive.current) {
        setMenuOpen(false);
      }
    } else {
      if (isActive && !wasActive.current) {
        // In desktop mode, activation comes from globalShortcut IPC — skip here
        if (!isDesktop()) {
          state.setAppEnabled(true);
          state.setBackground("transparent");
          openMenuAtCursor();
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
  }, [checkHotkey, checkPersistentHotkey, openMenuAtCursor]);

  // ─── Keyboard listeners ──────────────────────────────────────────

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysDown.current.add(normalizeKey(e.key));
      if (checkHotkey() || checkPersistentHotkey()) e.preventDefault();
      checkKeys(normalizeKey(e.key));
    };
    const onUp = (e: KeyboardEvent) => {
      keysDown.current.delete(normalizeKey(e.key));
      checkKeys(normalizeKey(e.key));

      // Desktop shortcut deactivation: if modifier keys are released while shortcut was active
      if (isDesktop() && shortcutActivatedRef.current) {
        const normalizedKey = normalizeKey(e.key);
        const modifierKeys = isMac() ? ["meta", "shift"] : ["alt", "shift"];
        if (modifierKeys.includes(normalizedKey)) {
          const allReleased = modifierKeys.every(k => !keysDown.current.has(k));
          if (allReleased) {
            const state = useStore.getState();
            if (!state.isPersistentMode) {
              state.setAppEnabled(false);
              state.setSnapshotDataUrl(null);
              setMenuOpen(false);
              state.triggerClearCanvas();
              overlayDeactivated();
              shortcutActivatedRef.current = false;
            }
          }
        }
      }
    };
    const onBlur = () => {
      keysDown.current.clear();
      checkKeys();
      // If we lose focus while shortcut was active, deactivate
      if (isDesktop() && shortcutActivatedRef.current) {
        const state = useStore.getState();
        if (!state.isPersistentMode) {
          state.setAppEnabled(false);
          state.setSnapshotDataUrl(null);
          setMenuOpen(false);
          state.triggerClearCanvas();
          overlayDeactivated();
          shortcutActivatedRef.current = false;
        }
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [checkKeys, checkHotkey, checkPersistentHotkey]);

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
      shortcutActivatedRef.current = true; // Mark that shortcut is active (will be cleared on key release)
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

  // ─── Tray menu IPC handlers (for Electron desktop settings) ───────

  useEffect(() => {
    if (!isDesktop()) return;

    const unlisteners = [
      window.electronAPI?.onTrayMenuChange("tray-set-theme-mode", (mode: string) => {
        useStore.getState().setThemeMode(mode as "dark" | "light");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-color-palette", (palette: string) => {
        useStore.getState().setColorPalette(palette as "muted" | "vibrant" | "retro" | "neon" | "pastel" | "gradient");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-animation-intensity", (intensity: string) => {
        useStore.getState().setAnimationIntensity(intensity as "low" | "medium" | "high");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-menu-style", (style: string) => {
        useStore.getState().setMenuStyle(style as "flat" | "flat-outline" | "pop" | "pop-mono");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-grid-mode", (mode: string) => {
        useStore.getState().setGridMode(mode as "none" | "grid" | "dots");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-grid-size", (size: string) => {
        useStore.getState().setGridSize(size as "small" | "large");
      }),
      window.electronAPI?.onTrayMenuChange("tray-set-overlay-mode", (mode: string) => {
        useStore.getState().setOverlayMode(mode as "live" | "snapshot");
      }),
    ];

    return () => {
      unlisteners.forEach(fn => fn?.());
    };
  }, []);

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

  const isPop = menuStyle === "pop" || menuStyle === "pop-mono";

  return (
    <AnimatePresence>
      {menuOpen && (
        <div className="fixed inset-0 z-[100000] pointer-events-none cursor-default">
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
                    popColor={
                      menuStyle === "pop-mono"
                        ? popMonoColor
                        : isPop && !popColorsRef.current.gradientStops
                        ? popColorsRef.current.colors[i % popColorsRef.current.colors.length]
                        : undefined
                    }
                    popGradientStops={menuStyle === "pop" && popColorsRef.current.gradientStops ? popColorsRef.current.gradientStops[i % popColorsRef.current.gradientStops.length] : undefined}
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
                    <Icon size={28 * scaleFactor} strokeWidth={2} />
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
                          variant={isPop && item.color ? ("pop-light" as MenuStyle) : menuStyle}
                          position={pos}
                          isSelected={isSelected}
                          interactable={subInteractable}
                          hasActiveSelection={hasActiveSelection}
                          menuOpen={menuOpen}
                          ringColor={(isPop || menuStyle === "flat-outline") && item.color ? item.color : undefined}
                          popColor={
                            menuStyle === "pop-mono" && !item.color
                              ? popMonoColor
                              : isPop && !item.color && !item.gradientStops
                              ? popColorsRef.current.colors[si % popColorsRef.current.colors.length]
                              : undefined
                          }
                          popGradientStops={menuStyle === "pop" && !item.color && item.gradientStops ? item.gradientStops : undefined}
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
                              width: 28 * scaleFactor,
                              height: 28 * scaleFactor,
                              borderRadius: `${buttonRoundness / 2}%`,
                              flexShrink: 0,
                              background: item.gradientStops && item.gradientStops.length > 1
                                ? `linear-gradient(135deg, ${item.gradientStops.join(", ")})`
                                : item.color,
                            }} />
                          ) : (
                            <SubIcon size={28 * scaleFactor} strokeWidth={2} fill="none" color="currentColor" />
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
              const proScale = activeIndex === null ? getProCenterScale() : 1;
              const proIcon = getProCenterIcon();
              const circleSize = 48 * scaleFactor * proScale;
              const iconSize = 22 * scaleFactor * proScale;
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
                    ...(menuStyle === "pop-mono"
                      ? { backgroundColor: popMonoColor }
                      : isPop && popColorsRef.current.centerGradient
                      ? { background: `linear-gradient(135deg, ${popColorsRef.current.centerGradient[0]}, ${popColorsRef.current.centerGradient[1]})` }
                      : isPop ? { backgroundColor: popColorsRef.current.centerColor } : {}),
                  }}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={hasActiveSelection ? { scale: 0, rotate: 0 } : { scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90, transition: { duration: hasActiveSelection ? 0 : menuOpen ? 0.1 : 0 } }}
                  transition={hasActiveSelection ? { duration: 0 } : SPRING_CONFIG}
                >
                  {activeIndex === null ? (
                    proIcon ? (
                      <img src={proIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
                    ) : (
                      <Bolt size={iconSize} strokeWidth={2} />
                    )
                  ) : (
                    (() => {
                      const ActiveIcon = MAIN_ICONS[activeIndex];
                      return <ActiveIcon size={iconSize} strokeWidth={2} />;
                    })()
                  )}
                  <PaletteEffectOverlay palette={colorPalette} size={circleSize} seed="center" tintColor={menuStyle === "pop-mono" ? popMonoColor : isPop ? popColorsRef.current.centerColor : undefined} />
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
