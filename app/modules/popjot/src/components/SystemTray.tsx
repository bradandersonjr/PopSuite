import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activateLicense, deactivateLicense } from "@shared/license/renderer";
import CenterCircleSettings from "@popjot/components/pro/CenterCircleSettings";
import PalettePiePreview from "@popjot/components/PalettePiePreview";
import { DEFAULT_SPOTLIGHT_FEATHER_PCT } from "@popjot/lib/spotlight";

/** Ko-fi product page where buyers get a PopJot Pro key. */
const POPJOT_PRO_URL = "https://ko-fi.com/s/264fd0031f";
import {
  getShortcuts,
  isDesktop,
  quitApp,
  sendAnimationIntensity,
  sendColorPalette,
  sendGridMode,
  sendGridSize,
  sendMenuStyle,
  sendOverlayMode,
  sendSpotlightDimOpacity,
  sendSpotlightRadius,
  sendSpotlightFeather,
  sendGlowIntensity,
  sendTextColor,
  sendButtonRoundness,
  sendMenuTranslucency,
  sendScaleMultiplier,
  sendThemeMode,
  setMainShortcut,
  setPersistentShortcut,
  setSpotlightShortcut,
  setLastToolShortcut,
} from "@popjot/lib/platform";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import {
  type Option,
  OptionGrid,
  SettingGroup,
  SettingsColumns,
  SettingsSection,
  SettingsUIProvider,
  SettingsWindowFrame,
  EmbeddedSettingsPanel,
  SettingsImportExport,
  SyncSettings,
  ProSection,
  ShortcutButton,
  ShortcutErrorBanner,
  SliderRow,
  ToggleRow,
  useOpenAtLogin,
  useShortcutRecorder,
} from "@shared/components/settings";
import { SubMenuSection } from "@shared/components/settings/dropdown";
import { LogOut, Lock, Settings } from "lucide-react";
import {
  AnimationIntensity,
  ColorPalette,
  GridMode,
  GridSize,
  MenuStyle,
  OverlayMode,
  TextColor,
  ThemeMode,
  useStore,
} from "@popjot/store/useStore";
import { settingsSchema } from "@popjot/config/settingsSchema";
import { getEffectiveColors, getProPalette, setProPalette, setProPaletteActive } from "@popjot/pro";
import { ColorMixerPopover } from "@shared/components/settings";
import { getMenuColors, getSurfacePalette, PRO_ACCENT, type SurfacePalette } from "@shared/config/desktopTheme";
import { getColors, getGradientVariantStops, getHighlighterGradientStops, PALETTE_NAMES } from "@popjot/config/themes";
import { isMac } from "@shared/lib/hotkeys";


interface MenuStylePickerProps {
  menuStyle: MenuStyle;
  onSelect: (style: MenuStyle) => void;
  surfacePalette: SurfacePalette;
  themeMode: ThemeMode;
  colorPalette: ColorPalette;
  textColor: TextColor;
  glowIntensity: number;
  buttonRoundness: number;
}

const MenuStylePicker = ({
  menuStyle,
  onSelect,
  surfacePalette,
  themeMode,
  colorPalette,
  textColor,
  glowIntensity,
  buttonRoundness,
}: MenuStylePickerProps) => {
  const isDark = themeMode === "dark";
  // Reflect the live palette color (Custom sources from the Pro palette) so the
  // preview matches the real menu.
  const color = getEffectiveColors(colorPalette).draw[0];
  const stops = getHighlighterGradientStops(color);
  const textOverride = textColor === "white" ? "#ffffff" : textColor === "black" ? "#111111" : null;
  const popBorder = isDark ? "#111111" : "#f5f5f5";
  const flatBg = isDark ? "#2c313c" : "#eef1f5";
  const PREVIEW = 16;
  const radius = `${(buttonRoundness / 100) * PREVIEW}px`;
  const gi = glowIntensity / 100;

  const base: React.CSSProperties = {
    fontSize: `${PREVIEW}px`,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    borderRadius: radius,
    lineHeight: 1.2,
  };

  const styles: Record<MenuStyle, React.CSSProperties> = {
    flat: {
      ...base,
      backgroundColor: color,
      color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
      padding: "7px 14px",
    },
    "flat-outline": {
      ...base,
      backgroundColor: flatBg,
      color: textOverride ?? color,
      border: `2px solid ${color}`,
      padding: "5px 12px",
    },
    pop: {
      ...base,
      backgroundImage: `linear-gradient(135deg, ${stops[0]}, ${stops[1]})`,
      color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
      border: `2px solid ${popBorder}`,
      boxShadow: `3px 3px 0 ${popBorder}`,
      padding: "5px 12px",
    },
    glow: {
      ...base,
      backgroundColor: color,
      color: textOverride ?? (isDark ? "#ffffff" : "#0b0b0b"),
      boxShadow: `0 0 ${Math.round(PREVIEW * (0.35 + gi * 0.9))}px ${color}, 0 0 ${Math.round(PREVIEW * (0.8 + gi * 1.8))}px ${color}88`,
      padding: "5px 12px",
    },
  };

  const styleNames: Record<MenuStyle, string> = {
    flat: "Flat",
    "flat-outline": "Flat Outline",
    pop: "Pop",
    glow: "Glow",
  };

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {(Object.keys(styles) as MenuStyle[]).map((style) => (
        <button
          key={style}
          onClick={() => onSelect(style)}
          className="flex flex-col items-center justify-between gap-2.5 rounded-[14px] px-3 py-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            minHeight: 92,
            backgroundColor: menuStyle === style ? surfacePalette.selected : surfacePalette.card,
            border: `1.5px solid ${menuStyle === style ? surfacePalette.text : "transparent"}`,
          }}
        >
          <span className="flex flex-1 items-center">
            <span style={styles[style]}>PopJot</span>
          </span>
          <span className="text-xs font-medium" style={{ color: surfacePalette.muted }}>
            {styleNames[style]}
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * Suite-composed rendering: the suite settings window owns the section
 * navigation and asks this component for one section's content at a time.
 * `undefined` = not in suite mode; `null` = suite mode with this module's
 * content hidden (hooks stay mounted so state/IPC stay live); an object
 * selects a section by title, optionally omitting items by their JSX key.
 */
export type SuiteSectionRequest = { title: string; omitKeys?: string[] } | null;

type SystemTrayProps = {
  settingsWindowMode?: boolean;
  embedded?: boolean;
  unifiedSettingsMode?: boolean;
  suiteSection?: SuiteSectionRequest;
  /** Web-demo override: record real hotkeys into the store even off desktop. */
  demoShortcuts?: boolean;
  /**
   * Module-fixed shortcut read for the suite Settings window, which mounts
   * BOTH modules' panels at once against a single mutable-`activeId` bridge
   * (see app/src/main/suiteSettings/preload.ts). Without this, the ambient
   * getShortcuts() below would resolve through whichever module happens to be
   * "active" at mount time, so the non-active panel would read the OTHER
   * module's shortcuts. Standalone builds omit it and use the module's own
   * (already correctly namespaced) getShortcuts().
   */
  getShortcutsOverride?: () => Promise<{ main: string; persistent: string; spotlight: string; lastTool: string }>;
};

const SystemTray = ({
  settingsWindowMode = false,
  embedded = false,
  unifiedSettingsMode = false,
  suiteSection,
  demoShortcuts = false,
  getShortcutsOverride,
}: SystemTrayProps) => {
  /** Which ring the center pie preview is showing. */
  const [pieMode, setPieMode] = useState<"draw" | "highlighter">("draw");
  /** Which Custom-palette chip is being recolored right now, if any. */
  const [activeSlot, setActiveSlot] = useState<{ group: "draw" | "highlighter"; index: number } | null>(null);
  /** The pie-preview card — the color mixer anchors beside this, not its own trigger. */
  const pieCardRef = useRef<HTMLDivElement>(null);

  const {
    hotkey,
    setHotkey,
    persistentHotkey,
    setPersistentHotkey,
    spotlightHotkey,
    setSpotlightHotkey,
    lastToolHotkey,
    setLastToolHotkey,
    spotlightDimOpacity,
    setSpotlightDimOpacity: setSpotlightDimOpacityLocal,
    spotlightRadius,
    setSpotlightRadius: setSpotlightRadiusLocal,
    spotlightFeather,
    setSpotlightFeather: setSpotlightFeatherLocal,
    menuStyle,
    setMenuStyle: setMenuStyleLocal,
    glowIntensity,
    setGlowIntensity: setGlowIntensityLocal,
    textColor,
    setTextColor: setTextColorLocal,
    colorPalette,
    setColorPalette: setColorPaletteLocal,
    themeMode,
    setThemeMode: setThemeModeLocal,
    animationIntensity,
    setAnimationIntensity: setAnimationIntensityLocal,
    gridMode,
    setGridMode: setGridModeLocal,
    gridSize,
    setGridSize: setGridSizeLocal,
    scaleMultiplier,
    setScaleMultiplier: setScaleMultiplierLocal,
    overlayMode,
    setOverlayMode: setOverlayModeLocal,
    paletteVersion,
    bumpPaletteVersion,
    buttonRoundness,
    setButtonRoundness: setButtonRoundnessLocal,
    menuTranslucency,
    setMenuTranslucency: setMenuTranslucencyLocal,
    isPro,
  } = useStore();

  const { draw: drawColors } = getEffectiveColors(colorPalette);
  // paletteVersion is read above to trigger re-render when Pro palette changes
  void paletteVersion;
  const hasProPalette = getProPalette(colorPalette) !== null;
  const desktop = isDesktop();
  const effectiveIsPro = isPro || embedded;
  const isDark = themeMode === "dark";

  // Use custom palette for menu colors if active, otherwise use theme-based colors
  const getMenuColorsForPalette = (): ReturnType<typeof getMenuColors> => {
    if (!hasProPalette) return getMenuColors(isDark);

    // For custom palettes, use the first draw color as accent for hover state
    const accentColor = drawColors[0];
    const baseMenuColors = getMenuColors(isDark);

    return {
      ...baseMenuColors,
      hoverBg: accentColor,
      hoverText: "#ffffff",
    };
  };

  const { bg: menuBg, text: menuText, border: menuBorder, hoverBg: menuHoverBg, hoverText: menuHoverText, separator: menuSeparator } = getMenuColorsForPalette();

  const surfacePalette = useMemo(() => getSurfacePalette(isDark), [isDark]);

  const { openAtLogin, toggleOpenAtLogin } = useOpenAtLogin();

  const commitShortcut = useCallback(
    async (kind: string, formatted: string) => {
      const result =
        kind === "main"
          ? await setMainShortcut(formatted)
          : kind === "persistent"
            ? await setPersistentShortcut(formatted)
            : kind === "lastTool"
              ? await setLastToolShortcut(formatted)
              : await setSpotlightShortcut(formatted);
      if (result.ok) {
        const apply =
          kind === "main" ? setHotkey : kind === "persistent" ? setPersistentHotkey : kind === "lastTool" ? setLastToolHotkey : setSpotlightHotkey;
        apply(formatted);
      }
      return result;
    },
    [setHotkey, setPersistentHotkey, setSpotlightHotkey, setLastToolHotkey]
  );

  const { recordingKind, activeKeys, shortcutError, startRecording } = useShortcutRecorder({
    enabled: settingsWindowMode || embedded || unifiedSettingsMode || suiteSection !== undefined,
    commit: commitShortcut,
  });

  useEffect(() => {
    if (!desktop) return;

    let mounted = true;
    const load = getShortcutsOverride ?? getShortcuts;
    void load().then(({ main, persistent, spotlight, lastTool }) => {
      if (mounted) {
        setHotkey(main);
        setPersistentHotkey(persistent);
        setSpotlightHotkey(spotlight);
        setLastToolHotkey(lastTool);
      }
    });

    return () => {
      mounted = false;
    };
  }, [desktop, setHotkey, setPersistentHotkey, setSpotlightHotkey, setLastToolHotkey, getShortcutsOverride]);

  const applyThemeMode = (mode: ThemeMode) => {
    setThemeModeLocal(mode);
    sendThemeMode(mode);
  };

  const applyColorPalette = (palette: ColorPalette) => {
    setColorPaletteLocal(palette);
    sendColorPalette(palette);
    // "Custom" (formerly Solid) is a live editable palette backed by the Pro
    // custom-palette store — selecting it activates that override; picking any
    // other built-in deactivates it so getEffectiveColors falls back correctly.
    if (palette === "solid") {
      if (getProPalette(null) === null) {
        setProPalette([...getColors("muted").draw], [...getColors("muted").highlighter]);
      }
      setProPaletteActive(true);
    } else {
      setProPaletteActive(false);
    }
    bumpPaletteVersion();
  };

  const applyAnimationIntensity = (intensity: AnimationIntensity) => {
    setAnimationIntensityLocal(intensity);
    sendAnimationIntensity(intensity);
  };

  const applyMenuStyle = (style: MenuStyle) => {
    setMenuStyleLocal(style);
    sendMenuStyle(style);
  };

  const applyGlowIntensity = (val: number) => {
    setGlowIntensityLocal(val);
    sendGlowIntensity(val);
  };

  const applyTextColor = (val: TextColor) => {
    setTextColorLocal(val);
    sendTextColor(val);
  };

  const applyButtonRoundness = (val: number) => {
    setButtonRoundnessLocal(val);
    sendButtonRoundness(val);
  };

  const applyMenuTranslucency = (val: number) => {
    setMenuTranslucencyLocal(val);
    sendMenuTranslucency(val);
  };



  const applyScaleMultiplier = (multiplier: number) => {
    setScaleMultiplierLocal(multiplier);
    sendScaleMultiplier(multiplier);
  };

  const applyGridMode = (mode: GridMode) => {
    setGridModeLocal(mode);
    sendGridMode(mode);
  };

  const applyGridSize = (size: GridSize) => {
    setGridSizeLocal(size);
    sendGridSize(size);
  };

  const applyOverlayMode = (mode: OverlayMode) => {
    setOverlayModeLocal(mode);
    sendOverlayMode(mode);
  };

  const applySpotlightDimOpacity = (val: number) => {
    setSpotlightDimOpacityLocal(val);
    sendSpotlightDimOpacity(val);
  };

  const applySpotlightRadius = (val: number) => {
    setSpotlightRadiusLocal(val);
    sendSpotlightRadius(val);
  };

  const applySpotlightFeather = (val: number) => {
    setSpotlightFeatherLocal(val);
    sendSpotlightFeather(val);
  };

  const themeModeOptions: Option<ThemeMode>[] = [
    { label: "Dark", checked: themeMode === "dark", value: "dark", onSelect: applyThemeMode },
    { label: "Light", checked: themeMode === "light", value: "light", onSelect: applyThemeMode },
  ];

  const menuStyleOptions: Option<MenuStyle>[] = [
    { label: "Flat", checked: menuStyle === "flat", value: "flat", onSelect: applyMenuStyle },
    {
      label: "Flat Outline",
      checked: menuStyle === "flat-outline",
      value: "flat-outline",
      onSelect: applyMenuStyle,
    },
    { label: "Pop", checked: menuStyle === "pop", value: "pop", onSelect: applyMenuStyle },
    { label: "Glow", checked: menuStyle === "glow", value: "glow", onSelect: applyMenuStyle },
  ];

  const textColorOptions: Option<TextColor>[] = [
    { label: "Auto", checked: textColor === "auto", value: "auto", onSelect: applyTextColor },
    { label: "White", checked: textColor === "white", value: "white", onSelect: applyTextColor },
    { label: "Black", checked: textColor === "black", value: "black", onSelect: applyTextColor },
  ];

  const colorPaletteOptions: Option<ColorPalette>[] = PALETTE_NAMES.map((name) => ({
    label: name.charAt(0).toUpperCase() + name.slice(1),
    checked: colorPalette === name,
    value: name,
    onSelect: applyColorPalette,
  }));

  // First draw color per palette for the dropdown color dot (use base palette, not Pro override)
  const paletteColorMap: Record<string, string> = Object.fromEntries(
    PALETTE_NAMES.map((name) => [
      name.charAt(0).toUpperCase() + name.slice(1),
      getColors(name).draw[0],
    ])
  );

  // Left/right picker columns: PALETTE_NAMES is [muted, vibrant, retro, neon,
  // pastel, gradient, glitter, solid] — even indices are the left column, odd
  // are the right, matching the existing 2-column pairing (muted/vibrant,
  // retro/neon, pastel/gradient, glitter/solid) so nothing reorders visually.
  const paletteLeftNames = PALETTE_NAMES.filter((_, i) => i % 2 === 0);
  const paletteRightNames = PALETTE_NAMES.filter((_, i) => i % 2 === 1);

  const paletteDisplayLabel = (name: ColorPalette) => (name === "solid" ? "Custom" : name.charAt(0).toUpperCase() + name.slice(1));

  const renderPaletteButton = (name: ColorPalette) => {
    const isCustom = name === "solid";
    const locked = isCustom && !effectiveIsPro;
    const colors = isCustom ? getEffectiveColors("solid").draw : getColors(name).draw;
    const isSelected = colorPalette === name;
    return (
      <button
        key={name}
        onClick={() => { if (!locked) applyColorPalette(name); }}
        title={locked ? "Unlock with PopJot Pro" : undefined}
        className="relative flex w-full flex-col items-center gap-1.5 rounded-[12px] px-3 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        style={{
          backgroundColor: isSelected ? surfacePalette.selected : surfacePalette.card,
          color: isSelected ? surfacePalette.text : surfacePalette.muted,
          border: `1.5px solid ${isSelected ? surfacePalette.text : "transparent"}`,
          opacity: locked ? 0.55 : 1,
          cursor: locked ? "not-allowed" : "pointer",
        }}
      >
        {locked && (
          <Lock className="absolute right-2 top-2 h-3.5 w-3.5" style={{ color: surfacePalette.muted }} />
        )}
        <span>{paletteDisplayLabel(name)}</span>
        <div className="flex flex-wrap justify-center gap-1">
          {colors.slice(0, 6).map((hex: string, i: number) => (
            <span
              key={`${hex}-${i}`}
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: hex,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </button>
    );
  };

  /** 3-column palette picker: name columns flank a live pie preview of the
   *  selected palette's actual radial sub-menu (Draw or Highlighter ring). */
  const renderPalettePicker = () => {
    // Editable only for licensed users — guards legacy sessions where
    // colorPalette was already persisted as "solid" before Custom existed.
    const isCustom = colorPalette === "solid" && effectiveIsPro;
    const { draw: pieDrawColors, highlighter: pieHlColors, tertiary } = getEffectiveColors(colorPalette);
    const pieColors = pieMode === "draw" ? pieDrawColors : pieHlColors;
    // Same gating as RadialMenu.tsx's SUB_MENUS: gradient/glitter effects only
    // apply to the real built-in palette, never a Pro override (Custom).
    const useGradient = colorPalette === "gradient" && getProPalette(colorPalette) === null;
    const pieGradientStops = useGradient
      ? pieMode === "draw"
        ? pieColors.map((_, i) => getGradientVariantStops(i))
        : pieColors.map((c) => getHighlighterGradientStops(c))
      : undefined;
    const isGlitter = colorPalette === "glitter" && getProPalette(colorPalette) === null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_1.6fr_1fr] items-start gap-3">
          <div className="space-y-2">{paletteLeftNames.map(renderPaletteButton)}</div>

          <div
            ref={pieCardRef}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[12px] p-4"
            style={{ backgroundColor: surfacePalette.card }}
          >
            <div className="flex rounded-full p-0.5" style={{ backgroundColor: surfacePalette.selected }}>
              {(["draw", "highlighter"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setPieMode(mode); setActiveSlot(null); }}
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors"
                  style={{
                    backgroundColor: pieMode === mode ? PRO_ACCENT : "transparent",
                    color: pieMode === mode ? "#fff" : surfacePalette.muted,
                  }}
                >
                  {mode === "draw" ? "Draw" : "Highlighter"}
                </button>
              ))}
            </div>
            <div className={`theme-${themeMode}`}>
              <PalettePiePreview
                colors={pieColors}
                menuStyle={menuStyle}
                buttonRoundness={buttonRoundness}
                glowIntensity={glowIntensity}
                centerColor={tertiary[0]}
                angleOffset={pieMode === "draw" ? 30 : 45}
                gradientStops={pieGradientStops}
                isGlitter={isGlitter}
                onChipClick={isCustom ? (i) => setActiveSlot({ group: pieMode, index: i }) : undefined}
              />
            </div>
            <span className="text-center text-[10px] font-medium leading-tight" style={{ color: surfacePalette.muted }}>
              {isCustom ? "Click a chip, then the swatch below to recolor it" : "How the real menu looks"}
            </span>
            {/* Always visible (when Custom), same as PopKey's Solid picker —
                click a chip in the pie to select it (defaults to slot 0), then
                click this swatch to open the mixer for the selected slot. */}
            {isCustom && (() => {
              const slotIndex = activeSlot && activeSlot.group === pieMode ? activeSlot.index : 0;
              return (
                <ColorMixerPopover
                  currentColor={pieColors[slotIndex]}
                  onColorChange={(hex) => {
                    const nextDraw = pieMode === "draw" ? pieDrawColors.map((c, i) => (i === slotIndex ? hex : c)) : [...pieDrawColors];
                    const nextHl = pieMode === "highlighter" ? pieHlColors.map((c, i) => (i === slotIndex ? hex : c)) : [...pieHlColors];
                    setProPalette(nextDraw, nextHl);
                  }}
                  surfacePalette={surfacePalette}
                  historyColors={[...pieDrawColors, ...pieHlColors]}
                  label={`${pieMode === "draw" ? "Draw" : "Highlighter"} ${slotIndex + 1}`}
                  anchorRef={pieCardRef}
                />
              );
            })()}
          </div>

          <div className="space-y-2">{paletteRightNames.map(renderPaletteButton)}</div>
        </div>
      </div>
    );
  };

  const animationOptions: Option<AnimationIntensity>[] = [
    {
      label: "Low",
      checked: animationIntensity === "low",
      value: "low",
      onSelect: applyAnimationIntensity,
    },
    {
      label: "Medium",
      checked: animationIntensity === "medium",
      value: "medium",
      onSelect: applyAnimationIntensity,
    },
    {
      label: "High",
      checked: animationIntensity === "high",
      value: "high",
      onSelect: applyAnimationIntensity,
    },
  ];

  const gridModeOptions: Option<GridMode>[] = [
    { label: "None", checked: gridMode === "none", value: "none", onSelect: applyGridMode },
    { label: "Grid", checked: gridMode === "grid", value: "grid", onSelect: applyGridMode },
    { label: "Dots", checked: gridMode === "dots", value: "dots", onSelect: applyGridMode },
  ];

  const gridSizeOptions: Option<GridSize>[] = [
    {
      label: "Small",
      checked: gridSize === "small",
      value: "small",
      onSelect: applyGridSize,
    },
    {
      label: "Large",
      checked: gridSize === "large",
      value: "large",
      onSelect: applyGridSize,
    },
  ];

  const overlayModeOptions: Option<OverlayMode>[] = [
    {
      label: "Live",
      checked: overlayMode === "live",
      value: "live",
      onSelect: applyOverlayMode,
    },
    {
      label: "Snapshot",
      checked: overlayMode === "snapshot",
      value: "snapshot",
      onSelect: applyOverlayMode,
    },
  ];


  const settingsColumns = [
    {
      title: "Appearance",
      items: [
        <SettingGroup key="menu-style" title="Menu Style" description="Choose how your radial menu looks">
          <MenuStylePicker
            menuStyle={menuStyle}
            onSelect={applyMenuStyle}
            surfacePalette={surfacePalette}
            themeMode={themeMode}
            colorPalette={colorPalette}
            textColor={textColor}
            glowIntensity={glowIntensity}
            buttonRoundness={buttonRoundness}
          />
        </SettingGroup>,
        menuStyle === "glow" && (
          <SettingGroup key="glow-intensity" title="Glow Intensity" description="How strong the glow halo is">
            <SliderRow value={glowIntensity} min={0} max={100} step={5} onChange={applyGlowIntensity} valueSuffix="%" defaultValue={50} />
          </SettingGroup>
        ),
        <SettingGroup key="text-color" title="Icon Color" description="Force menu icons white or black, or follow the style">
          <OptionGrid options={textColorOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="theme" title="Theme Mode" description="Switch between dark and light themes">
          <OptionGrid options={themeModeOptions} columns="grid-cols-2" />
        </SettingGroup>,
        <SettingGroup
          key="palette"
          title="Color Palette"
          description="Select your preferred color scheme"
        >
          {renderPalettePicker()}
        </SettingGroup>,
        <SettingGroup key="roundness" title="Roundness" description="0% = square corners, 100% = circle">
          <SliderRow value={buttonRoundness} min={0} max={100} step={5} onChange={applyButtonRoundness} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
        <SettingGroup key="translucency" title="Translucency" description="Menu button background opacity">
          <SliderRow value={menuTranslucency} min={0} max={95} step={5} onChange={applyMenuTranslucency} valueSuffix="%" defaultValue={0} />
        </SettingGroup>,
        <SettingGroup key="scale" title="Size" description="Scale interface size">
          <SliderRow value={Math.round(scaleMultiplier * 100)} min={50} max={200} step={5} onChange={(v) => applyScaleMultiplier(v / 100)} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
      ],
    },
    {
      title: "Behavior",
      items: [
        <SettingGroup key="animation" title="Animation Intensity" description="Control how animated your interactions feel">
          <OptionGrid options={animationOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup
          key="overlay"
          title="Overlay Mode"
          description="Live draws straight onto the screen and keeps most menus and tooltips open. Snapshot freezes the screen first — slower to appear, but it holds anything Live can't, like dropdowns that close the moment you click away."
        >
          <OptionGrid options={overlayModeOptions} columns="grid-cols-2" />
        </SettingGroup>,
        <SettingGroup
          key="spotlight"
          title="Spotlight"
          description={
            desktop
              ? `Dim the screen except a circle that follows your cursor. Toggle with ${spotlightHotkey}, scroll to resize, and press Escape to exit.`
              : "Dim the screen except a circle that follows your cursor (desktop app)."
          }
        >
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Dim</div>
              <SliderRow value={spotlightDimOpacity} min={0} max={100} step={5} onChange={applySpotlightDimOpacity} valueSuffix="%" defaultValue={65} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Radius</div>
              <SliderRow value={spotlightRadius} min={80} max={400} step={10} onChange={applySpotlightRadius} valueSuffix="px" defaultValue={180} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Soft Edge</div>
              <SliderRow value={spotlightFeather} min={0} max={100} step={5} onChange={applySpotlightFeather} valueSuffix="%" defaultValue={DEFAULT_SPOTLIGHT_FEATHER_PCT} />
            </div>
          </div>
        </SettingGroup>,
        <SettingGroup key="grid" title="Canvas Grid" description="Display reference grid or dots on canvas">
          <div className="space-y-3">
            <OptionGrid options={gridModeOptions} columns="grid-cols-3" compact />
            {gridMode !== "none" && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Grid Size</div>
                <OptionGrid options={gridSizeOptions} columns="grid-cols-2" />
              </div>
            )}
          </div>
        </SettingGroup>,
      ],
    },
    {
      title: "Shortcuts",
      items: desktop || demoShortcuts ? [
        <SettingGroup
          key="main-shortcut"
          title="Main Shortcut"
          description="Hold to activate menu temporarily"
        >
          <ShortcutButton
            currentShortcut={hotkey}
            isRecording={recordingKind === "main"}
            activeKeys={activeKeys}
            onStartRecording={() => startRecording("main")}
          />
        </SettingGroup>,
        <SettingGroup
          key="persistent-shortcut"
          title="Persistent Shortcut"
          description="Press once to stay in draw mode"
        >
          <ShortcutButton
            currentShortcut={persistentHotkey}
            isRecording={recordingKind === "persistent"}
            activeKeys={activeKeys}
            onStartRecording={() => startRecording("persistent")}
          />
        </SettingGroup>,
        <SettingGroup
          key="last-tool-shortcut"
          title="Last Tool Shortcut"
          description="Hold to draw with your last-used tool, skipping the menu"
        >
          <ShortcutButton
            currentShortcut={lastToolHotkey}
            isRecording={recordingKind === "lastTool"}
            activeKeys={activeKeys}
            onStartRecording={() => startRecording("lastTool")}
          />
        </SettingGroup>,
        <SettingGroup
          key="spotlight-shortcut"
          title="Spotlight Shortcut"
          description="Hold to activate spotlight mode, release to exit"
        >
          <ShortcutButton
            currentShortcut={spotlightHotkey}
            isRecording={recordingKind === "spotlight"}
            activeKeys={activeKeys}
            onStartRecording={() => startRecording("spotlight")}
          />
        </SettingGroup>,
      ] : [
        <p key="desktop-only" className="text-xs" style={{ color: surfacePalette.muted }}>
          Shortcuts are available in the desktop app.
        </p>,
      ],
    },
    {
      title: "Pro",
      items: [
        // License activation talks to the desktop preload bridge; web builds
        // only show the feature cards (matches the old System-tab gating).
        desktop && (
          <ProSection
            key="pro"
            palette={surfacePalette}
            isPro={effectiveIsPro}
            buyUrl={POPJOT_PRO_URL}
            tagline="A custom color palette and a center logo for your radial menu."
            onActivate={(key) => activateLicense(key)}
            onDeactivate={() => void deactivateLicense()}
          />
        ),
        <SettingGroup key="branding" title="Branding" description="Replace the menu's center shape with your logo" pro locked={!effectiveIsPro} buyUrl={POPJOT_PRO_URL}>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Logo</div>
            <CenterCircleSettings />
          </div>
        </SettingGroup>,
      ],
    },
    {
      title: "Sync",
      items: [
        <SettingGroup
          key="sync"
          title="Sync with PopKey"
          description="Keep these settings identical across PopJot and PopKey. Toggles are shared, so changes here appear in PopKey instantly."
        >
          <SyncSettings schema={settingsSchema} />
        </SettingGroup>,
      ],
    },
    {
      title: "System",
      items: desktop ? [
        <SettingGroup key="startup" title="Startup" description="Configure application startup behavior">
          <ToggleRow label="Open at login" checked={openAtLogin} onChange={toggleOpenAtLogin} />
        </SettingGroup>,
        <SettingGroup key="config" title="Config" description="Back up your settings or restore them from a file">
          <SettingsImportExport schema={settingsSchema} store={useStore} appName="PopJot" />
        </SettingGroup>,
        <SettingGroup key="quit" title="Quit" description="Close PopJot completely">
          <button
            onClick={() => quitApp()}
            className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: surfacePalette.card, color: "#ef4444" }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Quit PopJot
            <span className="ml-auto text-xs opacity-60">{isMac() ? "Cmd+Q" : "Ctrl+Q"}</span>
          </button>
        </SettingGroup>,
      ] : [
        <p key="desktop-only" className="text-xs" style={{ color: surfacePalette.muted }}>
          System settings are available in the desktop app.
        </p>,
      ],
    },
  ];

  const sectionsContent = (
    <>
      <ShortcutErrorBanner error={shortcutError} isDark={isDark} />
      <SettingsColumns columns={settingsColumns} />
    </>
  );

  const dropdownContent = (
    <DropdownMenuContent
      forceMount={settingsWindowMode ? true : undefined}
      align={settingsWindowMode ? "start" : "center"}
      side={settingsWindowMode ? "bottom" : "top"}
      sideOffset={settingsWindowMode ? 0 : 4}
      className={settingsWindowMode ? "w-[320px]" : "mb-2 w-48"}
      style={{ borderColor: menuBorder, backgroundColor: menuBg, color: menuText }}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <DropdownMenuLabel style={{ color: menuText }}>PopJot</DropdownMenuLabel>
      <DropdownMenuSeparator style={{ backgroundColor: `${menuSeparator}40` }} />

      <SubMenuSection
        label="Menu Style"
        options={menuStyleOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />
      <SubMenuSection
        label="Theme Mode"
        options={themeModeOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />
      <SubMenuSection
        label="Color Palette"
        options={colorPaletteOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
        colorMap={paletteColorMap}
      />
      <SubMenuSection
        label="Animation Intensity"
        options={animationOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />
      <SubMenuSection
        label="Overlay Mode"
        options={overlayModeOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />
      <SubMenuSection
        label="Canvas Grid"
        options={gridModeOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />
      <SubMenuSection
        label="Grid Size"
        options={gridSizeOptions}
        menuText={menuText}
        menuHoverBg={menuHoverBg}
        menuHoverText={menuHoverText}
        menuBg={menuBg}
        menuBorder={menuBorder}
      />

      <DropdownMenuSeparator style={{ backgroundColor: `${menuSeparator}40` }} />
      <DropdownMenuItem
        className="text-red-400 focus:bg-red-500/20 focus:text-red-300"
        onSelect={() => quitApp()}
      >
        <LogOut className="mr-2 h-4 w-4" />
        <span>Quit</span>
        <DropdownMenuShortcut>{isMac() ? "Cmd+Q" : "Ctrl+Q"}</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (suiteSection !== undefined) {
    if (suiteSection === null) return null;
    const column = settingsColumns.find((c) => c.title === suiteSection.title);
    if (!column) return null;
    const omit = suiteSection.omitKeys ?? [];
    const items = column.items.filter(
      (item) =>
        !(isValidElement(item) && item.key !== null && omit.includes(String(item.key))),
    );
    return (
      <SettingsUIProvider density="compact" palette={surfacePalette}>
        <ShortcutErrorBanner error={shortcutError} isDark={isDark} />
        <SettingsSection items={items} />
      </SettingsUIProvider>
    );
  }

  if (unifiedSettingsMode) {
    return (
      <SettingsUIProvider density="compact" palette={surfacePalette}>
        <div className="flex h-full flex-col overflow-hidden px-6 py-4">{sectionsContent}</div>
      </SettingsUIProvider>
    );
  }

  if (embedded) {
    return (
      <SettingsUIProvider density="compact" palette={surfacePalette}>
        <EmbeddedSettingsPanel appName="PopJot">{sectionsContent}</EmbeddedSettingsPanel>
      </SettingsUIProvider>
    );
  }

  if (settingsWindowMode) {
    return (
      <SettingsUIProvider density="compact" palette={surfacePalette}>
        <SettingsWindowFrame appName="PopJot">{sectionsContent}</SettingsWindowFrame>
      </SettingsUIProvider>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="neo-box neo-box-hover-only inline-flex cursor-default items-center gap-2 px-5 py-3 text-foreground"
            style={{ backgroundColor: drawColors[3] }}
          >
            <Settings className="h-5 w-5 text-foreground" strokeWidth={2.5} />
            <span className="font-display text-sm font-bold uppercase tracking-wide">
              System Tray
            </span>
          </button>
        </DropdownMenuTrigger>
        {dropdownContent}
      </DropdownMenu>
    </div>
  );
};

export default SystemTray;
