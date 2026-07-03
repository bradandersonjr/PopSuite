import { useCallback, useEffect, useMemo } from "react";
import { activateLicense, deactivateLicense } from "@shared/license/renderer";
import CustomPaletteSettings from "@/components/pro/CustomPaletteSettings";
import CenterCircleSettings from "@/components/pro/CenterCircleSettings";

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
  sendGlowIntensity,
  sendTextColor,
  sendButtonRoundness,
  sendMenuTranslucency,
  sendSolidColor,
  sendScaleFactor,
  sendThemeMode,
  setMainShortcut,
  setPersistentShortcut,
} from "@/lib/platform";
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
import { LogOut, Settings } from "lucide-react";
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
} from "@/store/useStore";
import { settingsSchema } from "@/config/settingsSchema";
import { getEffectiveColors, getProPalette } from "@/pro";
import { getMenuColors, getSurfacePalette, PRO_ACCENT, type SurfacePalette } from "@shared/config/desktopTheme";
import { getColors, getHighlighterGradientStops, PALETTE_NAMES } from "@/config/themes";
import { isMac } from "@shared/lib/hotkeys";


interface MenuStylePickerProps {
  menuStyle: MenuStyle;
  onSelect: (style: MenuStyle) => void;
  surfacePalette: SurfacePalette;
  themeMode: ThemeMode;
  colorPalette: ColorPalette;
  solidColor: string;
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
  solidColor,
  textColor,
  glowIntensity,
  buttonRoundness,
}: MenuStylePickerProps) => {
  const isDark = themeMode === "dark";
  // Reflect the live palette/solid color so the preview matches the real menu.
  const color = colorPalette === "solid" ? solidColor : getEffectiveColors(colorPalette).draw[0];
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

type SystemTrayProps = {
  settingsWindowMode?: boolean;
  embedded?: boolean;
};

const SystemTray = ({ settingsWindowMode = false, embedded = false }: SystemTrayProps) => {

  const {
    hotkey,
    setHotkey,
    persistentHotkey,
    setPersistentHotkey,
    menuStyle,
    setMenuStyle: setMenuStyleLocal,
    glowIntensity,
    setGlowIntensity: setGlowIntensityLocal,
    textColor,
    setTextColor: setTextColorLocal,
    colorPalette,
    setColorPalette: setColorPaletteLocal,
    solidColor,
    setSolidColor: setSolidColorLocal,
    themeMode,
    setThemeMode: setThemeModeLocal,
    animationIntensity,
    setAnimationIntensity: setAnimationIntensityLocal,
    gridMode,
    setGridMode: setGridModeLocal,
    gridSize,
    setGridSize: setGridSizeLocal,
    scaleFactor,
    setScaleFactor: setScaleFactorLocal,
    overlayMode,
    setOverlayMode: setOverlayModeLocal,
    paletteVersion,
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
        kind === "main" ? await setMainShortcut(formatted) : await setPersistentShortcut(formatted);
      if (result.ok) {
        (kind === "main" ? setHotkey : setPersistentHotkey)(formatted);
      }
      return result;
    },
    [setHotkey, setPersistentHotkey]
  );

  const { recordingKind, activeKeys, shortcutError, startRecording } = useShortcutRecorder({
    enabled: settingsWindowMode || embedded,
    commit: commitShortcut,
  });

  useEffect(() => {
    if (!desktop) return;

    let mounted = true;
    void getShortcuts().then(({ main, persistent }) => {
      if (mounted) {
        setHotkey(main);
        setPersistentHotkey(persistent);
      }
    });

    return () => {
      mounted = false;
    };
  }, [desktop, setHotkey, setPersistentHotkey]);

  const applyThemeMode = (mode: ThemeMode) => {
    setThemeModeLocal(mode);
    sendThemeMode(mode);
  };

  const applyColorPalette = (palette: ColorPalette) => {
    setColorPaletteLocal(palette);
    sendColorPalette(palette);
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


  const applySolidColor = (color: string) => {
    setSolidColorLocal(color);
    sendSolidColor(color);
  };

  const applyScaleFactor = (scale: number) => {
    setScaleFactorLocal(scale);
    sendScaleFactor(scale);
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

  /** Rich palette picker matching PopKey style — 2-column grid + color swatches */
  const renderPalettePicker = () => (
    <div className="grid grid-cols-2 gap-3">
      {PALETTE_NAMES.map((name) => {
        const isSolid = name === "solid";
        const colors = isSolid ? [solidColor] : getColors(name).draw;
        const isSelected = colorPalette === name;
        return (
          <button
            key={name}
            onClick={() => applyColorPalette(name)}
            className="flex flex-col items-center gap-1.5 rounded-[12px] px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: isSelected ? surfacePalette.selected : surfacePalette.card,
              color: isSelected ? surfacePalette.text : surfacePalette.muted,
              border: `1.5px solid ${isSelected ? surfacePalette.text : "transparent"}`,
            }}
          >
            <span className="capitalize">{name}</span>
            {isSolid && isSelected ? (
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: solidColor, flexShrink: 0 }}
                />
                <input
                  type="text"
                  value={solidColor}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(val)) applySolidColor(val);
                  }}
                  maxLength={7}
                  spellCheck={false}
                  style={{
                    width: 72,
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 13,
                    fontWeight: 600,
                    color: surfacePalette.text,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <div className="flex gap-1">
                {colors.map((hex: string) => (
                  <span
                    key={hex}
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      backgroundColor: hex,
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

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

  const scaleOptions: Option<number>[] = [
    {
      label: "75%",
      checked: Math.abs(scaleFactor - 0.75) < 0.01,
      value: 0.75,
      onSelect: applyScaleFactor,
    },
    {
      label: "100%",
      checked: Math.abs(scaleFactor - 1.0) < 0.01,
      value: 1.0,
      onSelect: applyScaleFactor,
    },
    {
      label: "150%",
      checked: Math.abs(scaleFactor - 1.5) < 0.01,
      value: 1.5,
      onSelect: applyScaleFactor,
    },
    {
      label: "200%",
      checked: Math.abs(scaleFactor - 2.0) < 0.01,
      value: 2.0,
      onSelect: applyScaleFactor,
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
            solidColor={solidColor}
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
          description={hasProPalette ? "Custom Pro palette is active" : "Select your preferred color scheme"}
        >
          <div className="relative">
            <div style={{ opacity: hasProPalette ? 0.35 : 1, pointerEvents: hasProPalette ? "none" : "auto" }}>
              {renderPalettePicker()}
            </div>
            {hasProPalette && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}
                >
                  Custom Palette Active
                </span>
              </div>
            )}
          </div>
        </SettingGroup>,
        <SettingGroup key="roundness" title="Roundness" description="0% = square corners, 100% = circle">
          <SliderRow value={buttonRoundness} min={0} max={100} step={5} onChange={applyButtonRoundness} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
        <SettingGroup key="translucency" title="Translucency" description="Menu button background opacity">
          <SliderRow value={menuTranslucency} min={0} max={95} step={5} onChange={applyMenuTranslucency} valueSuffix="%" defaultValue={0} />
        </SettingGroup>,
      ],
    },
    {
      title: "Branding",
      items: [
        <SettingGroup key="branding" title="Branding" description="Replace the menu's center shape with your logo, plus a custom palette" pro locked={!isPro} buyUrl={POPJOT_PRO_URL}>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Logo</div>
              <CenterCircleSettings />
            </div>
            <div className="h-px" style={{ backgroundColor: surfacePalette.divider }} />
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: surfacePalette.muted }}>Custom Palette</div>
              <CustomPaletteSettings />
            </div>
          </div>
        </SettingGroup>,
      ],
    },
    {
      title: "Behavior",
      items: [
        <SettingGroup key="animation" title="Animation Intensity" description="Control how animated your interactions feel">
          <OptionGrid options={animationOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="overlay" title="Overlay Mode" description="Choose between live drawing or snapshot capture">
          <OptionGrid options={overlayModeOptions} columns="grid-cols-2" />
        </SettingGroup>,
        <SettingGroup key="grid" title="Canvas Grid" description="Display reference grid or dots on canvas">
          <OptionGrid options={gridModeOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="grid-size" title="Grid Size" description="Adjust grid density if visible">
          <OptionGrid options={gridSizeOptions} columns="grid-cols-2" />
        </SettingGroup>,
        <SettingGroup key="scale" title="UI Scale" description="Adjust interface size for your screen resolution">
          <OptionGrid options={scaleOptions} columns="grid-cols-2" />
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
      items: [
        <ProSection
          key="pro"
          palette={surfacePalette}
          isPro={isPro}
          buyUrl={POPJOT_PRO_URL}
          tagline="Custom palette, center icon, circle size & stroke effects — in the Appearance tab."
          onActivate={(key) => activateLicense(key)}
          onDeactivate={() => void deactivateLicense()}
        />,
        <SettingGroup
          key="main-shortcut"
          title="Main Shortcut"
          description={desktop ? "Hold to activate menu temporarily" : "Try shortcut changes directly in the browser"}
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
          description={desktop ? "Press once to stay in draw mode" : "Test a stay-in-draw shortcut for Mac or PC"}
        >
          <ShortcutButton
            currentShortcut={persistentHotkey}
            isRecording={recordingKind === "persistent"}
            activeKeys={activeKeys}
            onStartRecording={() => startRecording("persistent")}
          />
        </SettingGroup>,
        desktop ? (
          <SettingGroup key="startup" title="Startup" description="Configure application startup behavior">
            <ToggleRow label="Open at login" checked={openAtLogin} onChange={toggleOpenAtLogin} />
          </SettingGroup>
        ) : null,
        <SettingGroup key="config" title="Config" description="Back up your settings or restore them from a file">
          <SettingsImportExport schema={settingsSchema} store={useStore} appName="PopJot" />
        </SettingGroup>,
        desktop ? (
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
          </SettingGroup>
        ) : null,
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

  if (embedded) {
    return (
      <SettingsUIProvider density="compact" palette={surfacePalette}>
        <EmbeddedSettingsPanel>{sectionsContent}</EmbeddedSettingsPanel>
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
