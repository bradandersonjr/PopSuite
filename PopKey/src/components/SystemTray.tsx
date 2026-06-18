import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getShortcuts,
  isDesktop,
  quitApp,
  sendAnimationIntensity,
  sendBadgeDuration,
  sendBadgeStyle,
  sendBadgeTextColor,
  sendBadgeFont,
  sendBadgeAnimation,
  sendBadgeTranslucency,
  sendGlowIntensity,
  sendColorPalette,
  sendDisplayPosition,
  sendKeyboardEnabled,
  sendShowKeyRepeat,
  sendMaxBadges,
  sendMouseEnabled,
  sendObsMode,
  sendScaleMultiplier,
  sendPositionOffsetX,
  sendPositionOffsetY,
  sendBadgeRoundness,
  sendScrollColor,
  sendClickColor,
  sendClickEffect,
  sendClickSize,
  sendSolidColor,
  sendShowMouseClicks,
  sendShowScrollWheel,
  sendThemeMode,
  setMainShortcut,
} from "@keys/lib/platform";
import {
  type Option,
  OptionGrid,
  SettingGroup,
  SettingsColumns,
  SettingsUIProvider,
  SettingsWindowFrame,
  EmbeddedSettingsPanel,
  SettingsImportExport,
  ProSection,
  ShortcutButton,
  ShortcutErrorBanner,
  SliderRow,
  ToggleRow,
  useOpenAtLogin,
  useShortcutRecorder,
} from "@shared/components/settings";
import { settingsSchema } from "@keys/config/settingsSchema";
import { BADGE_FONTS, fontStackFor } from "@keys/config/fonts";
import { BADGE_ANIMATIONS } from "@keys/config/badgeAnimations";
import { activateLicense, deactivateLicense } from "@shared/license/renderer";
import { LogOut, Lock, Settings } from "lucide-react";
import {
  AnimationIntensity,
  BadgeStyle,
  BadgeTextColor,
  BadgeFont,
  BadgeAnimation,
  ClickEffect,
  ColorPalette,
  DisplayPosition,
  ThemeMode,
  useStore,
} from "@keys/store/useStore";
import { getMenuColors, getSurfacePalette, type SurfacePalette } from "@shared/config/desktopTheme";
import { getBadgeColors, getBadgeGradientStops, PALETTE_NAMES, isProPalette, resolvePaletteColors } from "@keys/config/themes";
import BrandingSettings from "@keys/components/BrandingSettings";

/** Ko-fi product page where buyers get a PopKey Pro key. */
const POPKEY_PRO_URL = "https://ko-fi.com/s/264fd0031f";
import { isMac } from "@shared/lib/hotkeys";
import { useTraySettingsSync } from "@keys/hooks/useTraySettingsSync";

// ─── Custom Color Mixer Helpers ──────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  if (/^#?([0-9a-fA-F]{3})$/.test(hex)) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (/^#?([0-9a-fA-F]{6})$/.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

interface CustomColorPickerProps {
  currentColor: string;
  onColorChange: (hex: string) => void;
  surfacePalette: SurfacePalette;
  paletteColors: string[];
}

const CustomColorPicker = ({ currentColor, onColorChange, surfacePalette, paletteColors }: CustomColorPickerProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempHex, setTempHex] = useState(currentColor);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, showBelow: false });

  useEffect(() => {
    setTempHex(currentColor);
  }, [currentColor]);

  const { h, s, l } = useMemo(() => {
    try {
      return hexToHsl(tempHex);
    } catch {
      return { h: 0, s: 100, l: 50 };
    }
  }, [tempHex]);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 250;
      const showBelow = rect.top - 290 < 10;
      
      setCoords({
        top: showBelow ? rect.bottom + 8 : rect.top - 8,
        left: Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.right - popoverWidth)),
        showBelow
      });
    }
  };

  const closePicker = () => {
    // Apply color when closing picker
    if (tempHex !== currentColor && /^#[0-9a-fA-F]{6}$/.test(tempHex)) {
      onColorChange(tempHex);
    }
    setShowPicker(false);
  };

  const togglePicker = () => {
    if (!showPicker) {
      updateCoords();
      setShowPicker(true);
    } else {
      closePicker();
    }
  };

  useEffect(() => {
    if (showPicker) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [showPicker]);

  const handleHslChange = (newH: number, newS: number, newL: number) => {
    const hex = hslToHex(newH, newS, newL);
    setTempHex(hex);
  };

  const handleHexInput = (val: string) => {
    setTempHex(val);
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 animate-in fade-in duration-200"
        style={{ backgroundColor: surfacePalette.card, border: `1.5px solid ${surfacePalette.divider}` }}
      >
        <button
          ref={triggerRef}
          onClick={togglePicker}
          title="Open color mixer"
          className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer transition-transform hover:scale-110 active:scale-95 ring-1 ring-black/10"
          style={{
            backgroundColor: tempHex,
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
        <input
          type="text"
          value={tempHex}
          onChange={(e) => handleHexInput(e.target.value)}
          maxLength={7}
          spellCheck={false}
          style={{
            width: 68,
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

      {showPicker && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={closePicker} />
          <div
            className="fixed z-[9999] w-[250px]"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.showBelow ? "none" : "translateY(-100%)",
            }}
          >
            <div
              className={`w-full rounded-2xl p-4 flex flex-col gap-3 shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
                coords.showBelow ? "origin-top" : "origin-bottom"
              }`}
              style={{
                backgroundColor: surfacePalette.panel,
                borderColor: surfacePalette.divider,
                color: surfacePalette.text,
              }}
            >
              <div className="text-xs font-bold uppercase tracking-wider opacity-60">Color Mixer</div>
              
              {/* Hue Slider (Red to Red) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Hue</span>
                  <span>{h}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={h}
                  onChange={(e) => handleHslChange(Number(e.target.value), s, l)}
                  className="w-full mixer-slider cursor-pointer"
                  style={{
                    background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  }}
                />
              </div>

              {/* Saturation Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Saturation</span>
                  <span>{s}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s}
                  onChange={(e) => handleHslChange(h, Number(e.target.value), l)}
                  className="w-full mixer-slider cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #808080, hsl(${h}, 100%, 50%))`,
                  }}
                />
              </div>

              {/* Lightness Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-semibold opacity-70">
                  <span>Lightness</span>
                  <span>{l}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={l}
                  onChange={(e) => handleHslChange(h, s, Number(e.target.value))}
                  className="w-full mixer-slider cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #000000, hsl(${h}, ${s}%, 50%), #ffffff)`,
                  }}
                />
              </div>

              {/* Color History */}
              {paletteColors.length > 0 && (
                <div className="flex flex-col gap-2 pt-2.5 border-t" style={{ borderColor: surfacePalette.divider }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">History</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 22px)", gap: 6 }}>
                    {paletteColors.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => {
                          setTempHex(hex);
                        }}
                        className="w-[22px] h-[22px] rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

interface BadgeStylePickerProps {
  badgeStyle: BadgeStyle;
  onSelect: (style: BadgeStyle) => void;
  surfacePalette: SurfacePalette;
  themeMode: ThemeMode;
  colorPalette: ColorPalette;
  badgeTextColor: BadgeTextColor;
  solidColor: string;
  glowIntensity: number;
  badgeRoundness: number;
  badgeFont: BadgeFont;
  isPro: boolean;
}

const BadgeStylePicker = ({
  badgeStyle,
  onSelect,
  surfacePalette,
  themeMode,
  colorPalette,
  badgeTextColor,
  solidColor,
  glowIntensity,
  badgeRoundness,
  badgeFont,
  isPro,
}: BadgeStylePickerProps) => {
  const isDark = themeMode === "dark";
  // Reflect the live palette/solid color so the preview matches the real badges.
  const color = resolvePaletteColors(colorPalette, solidColor)[0];
  const stops = getBadgeGradientStops(color);
  const textOverride = badgeTextColor === "white" ? "#ffffff" : badgeTextColor === "black" ? "#111111" : null;
  const popBorder = isDark ? "#111111" : "#f5f5f5";
  const flatBg = isDark ? "#2c313c" : "#eef1f5";
  const PREVIEW = 16;
  const radius = `${(badgeRoundness / 100) * PREVIEW}px`;
  const gi = glowIntensity / 100;
  const fontFamily = fontStackFor(badgeFont, isPro);

  const base: React.CSSProperties = {
    fontSize: `${PREVIEW}px`,
    fontWeight: 700,
    fontFamily,
    borderRadius: radius,
    lineHeight: 1.2,
  };

  const styles: Record<BadgeStyle, React.CSSProperties> = {
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

  const styleNames: Record<BadgeStyle, string> = {
    flat: "Flat",
    "flat-outline": "Flat Outline",
    pop: "Pop",
    glow: "Glow",
  };

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {(Object.keys(styles) as BadgeStyle[]).map((style) => (
        <button
          key={style}
          onClick={() => onSelect(style)}
          className="flex flex-col items-center justify-between gap-2.5 rounded-[14px] px-3 py-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            minHeight: 92,
            backgroundColor: badgeStyle === style ? surfacePalette.selected : surfacePalette.card,
            border: `1.5px solid ${badgeStyle === style ? surfacePalette.text : "transparent"}`,
          }}
        >
          <span className="flex flex-1 items-center">
            <span style={styles[style]}>PopKey</span>
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
  const [colorHistory, setColorHistory] = useState<string[]>([]);

  const {
    hotkey,
    setHotkey,
    colorPalette,
    setColorPalette: setColorPaletteLocal,
    themeMode,
    setThemeMode: setThemeModeLocal,
    animationIntensity,
    setAnimationIntensity: setAnimationIntensityLocal,
    scaleMultiplier,
    setScaleMultiplier: setScaleMultiplierLocal,
    displayPosition,
    setDisplayPosition: setDisplayPositionLocal,
    positionOffsetX,
    setPositionOffsetX: setPositionOffsetXLocal,
    positionOffsetY,
    setPositionOffsetY: setPositionOffsetYLocal,
    badgeDuration,
    setBadgeDuration: setBadgeDurationLocal,
    maxBadges,
    setMaxBadges: setMaxBadgesLocal,
    badgeStyle,
    setBadgeStyle: setBadgeStyleLocal,
    badgeTextColor,
    setBadgeTextColor: setBadgeTextColorLocal,
    badgeFont,
    setBadgeFont: setBadgeFontLocal,
    badgeAnimation,
    setBadgeAnimation: setBadgeAnimationLocal,
    badgeTranslucency,
    setBadgeTranslucency: setBadgeTranslucencyLocal,
    glowIntensity,
    setGlowIntensity: setGlowIntensityLocal,
    showMouseClicks,
    setShowMouseClicks: setShowMouseClicksLocal,
    showScrollWheel,
    setShowScrollWheel: setShowScrollWheelLocal,
    keyboardEnabled,
    setKeyboardEnabled: setKeyboardEnabledLocal,
    showKeyRepeat,
    setShowKeyRepeat: setShowKeyRepeatLocal,
    mouseEnabled,
    setMouseEnabled: setMouseEnabledLocal,
    badgeRoundness,
    setBadgeRoundness: setBadgeRoundnessLocal,
    scrollColor,
    setScrollColor,
    clickColor,
    setClickColor,
    clickEffect,
    setClickEffect: setClickEffectLocal,
    clickSize,
    setClickSize: setClickSizeLocal,
    solidColor,
    setSolidColor: setSolidColorLocal,
    obsMode,
    setObsMode: setObsModeLocal,
    isPro,
  } = useStore();

  const desktop = isDesktop();
  const isDark = themeMode === "dark";
  const surfacePalette = useMemo(() => getSurfacePalette(isDark), [isDark]);

  const { openAtLogin, toggleOpenAtLogin } = useOpenAtLogin();

  // Apply tray-settings broadcasts from other windows to this one
  useTraySettingsSync();

  // Sync main-shortcut changes from other windows
  useEffect(() => {
    if (!desktop) return;
    const unlisten = window.electronAPI?.onTrayMenuChange("tray-set-main-shortcut", (v) =>
      setHotkey(String(v))
    );
    return () => unlisten?.();
  }, [desktop, setHotkey]);

  // Load current shortcut from the main process
  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    void getShortcuts().then(({ main }) => {
      if (mounted) setHotkey(main);
    });
    return () => { mounted = false; };
  }, [desktop, setHotkey]);

  const commitShortcut = useCallback(
    async (_kind: string, formatted: string) => {
      const result = await setMainShortcut(formatted);
      if (result.ok) setHotkey(formatted);
      return result;
    },
    [setHotkey]
  );

  const { recordingKind, activeKeys, shortcutError, startRecording } = useShortcutRecorder({
    enabled: settingsWindowMode || embedded,
    commit: commitShortcut,
  });

  // ─── Apply helpers ───────────────────────────────────────────────────

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
  const applyScaleMultiplier = (multiplier: number) => {
    setScaleMultiplierLocal(multiplier);
    sendScaleMultiplier(multiplier);
  };
  const applyDisplayPosition = (pos: DisplayPosition) => {
    setDisplayPositionLocal(pos);
    sendDisplayPosition(pos);
  };
  const applyPositionOffsetX = (val: number) => {
    setPositionOffsetXLocal(val);
    sendPositionOffsetX(val);
  };
  const applyPositionOffsetY = (val: number) => {
    setPositionOffsetYLocal(val);
    sendPositionOffsetY(val);
  };
  const applyBadgeDuration = (ms: number) => {
    setBadgeDurationLocal(ms);
    sendBadgeDuration(ms);
  };
  const applyMaxBadges = (n: number) => {
    setMaxBadgesLocal(n);
    sendMaxBadges(n);
  };
  const applyBadgeStyle = (style: BadgeStyle) => {
    setBadgeStyleLocal(style);
    sendBadgeStyle(style);
  };
  const applyBadgeTextColor = (val: BadgeTextColor) => {
    setBadgeTextColorLocal(val);
    sendBadgeTextColor(val);
  };
  const applyBadgeTranslucency = (val: number) => {
    setBadgeTranslucencyLocal(val);
    sendBadgeTranslucency(val);
  };
  const applyGlowIntensity = (val: number) => {
    setGlowIntensityLocal(val);
    sendGlowIntensity(val);
  };
  const applyBadgeFont = (val: BadgeFont) => {
    setBadgeFontLocal(val);
    sendBadgeFont(val);
  };
  const applyBadgeAnimation = (val: BadgeAnimation) => {
    setBadgeAnimationLocal(val);
    sendBadgeAnimation(val);
  };
  const applyBadgeRoundness = (val: number) => {
    setBadgeRoundnessLocal(val);
    sendBadgeRoundness(val);
  };
  const toggleShowMouseClicks = () => {
    const v = !showMouseClicks;
    setShowMouseClicksLocal(v);
    sendShowMouseClicks(v);
  };
  const toggleShowScrollWheel = () => {
    const v = !showScrollWheel;
    setShowScrollWheelLocal(v);
    sendShowScrollWheel(v);
  };
  const toggleKeyboardEnabled = () => {
    const v = !keyboardEnabled;
    setKeyboardEnabledLocal(v);
    sendKeyboardEnabled(v);
  };
  const toggleShowKeyRepeat = () => {
    const v = !showKeyRepeat;
    setShowKeyRepeatLocal(v);
    sendShowKeyRepeat(v);
  };
  // Word mode toggle — disabled, see src/hooks/useWordCapture.ts
  const toggleMouseEnabled = () => {
    const v = !mouseEnabled;
    setMouseEnabledLocal(v);
    sendMouseEnabled(v);
  };
  const applyScrollColor = (color: string) => {
    setScrollColor(color);
    sendScrollColor(color);
  };
  const applyClickColor = (color: string) => {
    setClickColor(color);
    sendClickColor(color);
  };
  const applyClickEffect = (effect: ClickEffect) => {
    setClickEffectLocal(effect);
    sendClickEffect(effect);
  };
  const applyClickSize = (px: number) => {
    setClickSizeLocal(px);
    sendClickSize(px);
  };
  const applySolidColor = (color: string) => {
    setSolidColorLocal(color);
    sendSolidColor(color);
    // Add to history (keep last 8, remove duplicates by moving to front)
    setColorHistory((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  };
  const toggleObsMode = () => {
    const v = !obsMode;
    setObsModeLocal(v);
    sendObsMode(v);
  };

  // ─── PopKey-specific pickers ──────────────────────────────────────────

  const renderPalettePicker = () => (
    <div className="grid grid-cols-2 gap-3">
      {PALETTE_NAMES.map((name) => {
        const isSelected = colorPalette === name;
        const locked = isProPalette(name) && !isPro;
        const isSolid = name === "solid";
        const colors = isSolid ? [solidColor] : getBadgeColors(name);

        return (
          <button
            key={name}
            onClick={() => {
              if (locked) return;
              applyColorPalette(name);
            }}
            title={locked ? "Unlock with PopKey Pro" : undefined}
            className="relative flex flex-col items-center gap-1.5 rounded-[12px] px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: isSelected ? surfacePalette.selected : surfacePalette.card,
              color: isSelected ? surfacePalette.text : surfacePalette.muted,
              border: `1.5px solid ${isSelected ? surfacePalette.text : "transparent"}`,
              opacity: locked ? 0.55 : 1,
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            {locked && (
              <Lock
                className="absolute right-2 top-2 h-3.5 w-3.5"
                style={{ color: surfacePalette.muted }}
              />
            )}
            <span className="capitalize">{name}</span>
            {isSolid && isSelected ? (
              <div onClick={(e) => e.stopPropagation()}>
                <CustomColorPicker
                  currentColor={solidColor}
                  onColorChange={applySolidColor}
                  surfacePalette={surfacePalette}
                  paletteColors={colorHistory}
                />
              </div>
            ) : (
              <div className="flex gap-1">
                {colors.map((hex, i) => (
                  <span
                    key={`${hex}-${i}`}
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

  const renderColorPicker = (
    currentColor: string,
    onColorChange: (hex: string) => void,
    onPaletteSelect?: () => void
  ) => {
    const paletteColors = getBadgeColors(colorPalette);
    const isPalette = currentColor === "palette";
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {paletteColors.map((hex) => {
          const isActive = !isPalette && currentColor === hex;
          return (
            <button
              key={hex}
              onClick={() => onColorChange(hex)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: hex,
                border: isActive ? `2.5px solid ${surfacePalette.text}` : `2px solid transparent`,
                flexShrink: 0,
                outline: "none",
              }}
            />
          );
        })}
        {onPaletteSelect && (
          <button
            onClick={onPaletteSelect}
            title="Follow palette"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: `conic-gradient(${paletteColors.join(", ")})`,
              border: isPalette ? `2.5px solid ${surfacePalette.text}` : `2px solid ${surfacePalette.divider}`,
              flexShrink: 0,
              outline: "none",
            }}
          />
        )}
        <CustomColorPicker
          currentColor={isPalette ? paletteColors[0] : currentColor}
          onColorChange={onColorChange}
          surfacePalette={surfacePalette}
          paletteColors={paletteColors}
        />
      </div>
    );
  };

  // ─── Option arrays ────────────────────────────────────────────────────

  const themeModeOptions: Option<ThemeMode>[] = [
    { label: "Dark", checked: themeMode === "dark", value: "dark", onSelect: applyThemeMode },
    { label: "Light", checked: themeMode === "light", value: "light", onSelect: applyThemeMode },
  ];

  const badgeTextColorOptions: Option<BadgeTextColor>[] = [
    { label: "Auto", checked: badgeTextColor === "auto", value: "auto", onSelect: applyBadgeTextColor },
    { label: "White", checked: badgeTextColor === "white", value: "white", onSelect: applyBadgeTextColor },
    { label: "Black", checked: badgeTextColor === "black", value: "black", onSelect: applyBadgeTextColor },
  ];

  const badgeFontOptions: Option<BadgeFont>[] = BADGE_FONTS.map((f) => ({
    label: f.label, checked: badgeFont === f.key, value: f.key, onSelect: applyBadgeFont,
  }));

  const badgeAnimationOptions: Option<BadgeAnimation>[] = BADGE_ANIMATIONS.map((a) => ({
    label: a.label, checked: badgeAnimation === a.key, value: a.key, onSelect: applyBadgeAnimation,
  }));

  const clickEffectOptions: Option<ClickEffect>[] = [
    { label: "Ring", checked: clickEffect === "ring", value: "ring", onSelect: applyClickEffect },
    { label: "Solid", checked: clickEffect === "solid", value: "solid", onSelect: applyClickEffect },
    { label: "Pulse", checked: clickEffect === "pulse", value: "pulse", onSelect: applyClickEffect },
    { label: "Burst", checked: clickEffect === "burst", value: "burst", onSelect: applyClickEffect },
  ];

  const animationOptions: Option<AnimationIntensity>[] = [
    { label: "Low", checked: animationIntensity === "low", value: "low", onSelect: applyAnimationIntensity },
    { label: "Medium", checked: animationIntensity === "medium", value: "medium", onSelect: applyAnimationIntensity },
    { label: "High", checked: animationIntensity === "high", value: "high", onSelect: applyAnimationIntensity },
  ];

  const positionOptions: Option<DisplayPosition>[] = [
    { label: "Top Left", checked: displayPosition === "top-left", value: "top-left", onSelect: applyDisplayPosition },
    { label: "Top Center", checked: displayPosition === "top-center", value: "top-center", onSelect: applyDisplayPosition },
    { label: "Top Right", checked: displayPosition === "top-right", value: "top-right", onSelect: applyDisplayPosition },
    { label: "Bottom Left", checked: displayPosition === "bottom-left", value: "bottom-left", onSelect: applyDisplayPosition },
    { label: "Bottom Center", checked: displayPosition === "bottom-center", value: "bottom-center", onSelect: applyDisplayPosition },
    { label: "Bottom Right", checked: displayPosition === "bottom-right", value: "bottom-right", onSelect: applyDisplayPosition },
  ];

  const durationOptions: Option<number>[] = [
    { label: "1s", checked: badgeDuration === 1000, value: 1000, onSelect: applyBadgeDuration },
    { label: "2s", checked: badgeDuration === 2000, value: 2000, onSelect: applyBadgeDuration },
    { label: "3s", checked: badgeDuration === 3000, value: 3000, onSelect: applyBadgeDuration },
    { label: "5s", checked: badgeDuration === 5000, value: 5000, onSelect: applyBadgeDuration },
  ];

  const maxBadgesOptions: Option<number>[] = [
    { label: "3", checked: maxBadges === 3, value: 3, onSelect: applyMaxBadges },
    { label: "5", checked: maxBadges === 5, value: 5, onSelect: applyMaxBadges },
    { label: "8", checked: maxBadges === 8, value: 8, onSelect: applyMaxBadges },
    { label: "12", checked: maxBadges === 12, value: 12, onSelect: applyMaxBadges },
  ];

  // ─── Sections ────────────────────────────────────────────────────────

  const settingsColumns = [
    {
      title: "Appearance",
      items: [
        <SettingGroup key="badge-style" title="Badge Style" description="Visual style for badges">
          <BadgeStylePicker
            badgeStyle={badgeStyle}
            onSelect={applyBadgeStyle}
            surfacePalette={surfacePalette}
            themeMode={themeMode}
            colorPalette={colorPalette}
            badgeTextColor={badgeTextColor}
            solidColor={solidColor}
            glowIntensity={glowIntensity}
            badgeRoundness={badgeRoundness}
            badgeFont={badgeFont}
            isPro={isPro}
          />
        </SettingGroup>,
        badgeStyle === "glow" && (
          <SettingGroup key="glow-intensity" title="Glow Intensity" description="How strong the glow halo is">
            <SliderRow value={glowIntensity} min={0} max={100} step={5} onChange={applyGlowIntensity} valueSuffix="%" defaultValue={50} />
          </SettingGroup>
        ),
        <SettingGroup key="text-color" title="Text Color" description="Force badge text white or black, or follow the theme">
          <OptionGrid options={badgeTextColorOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="font" title="Font" description="Typeface for badges" pro locked={!isPro} buyUrl={POPKEY_PRO_URL}>
          <OptionGrid options={badgeFontOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="theme" title="Theme Mode" description="Switch between dark and light themes">
          <OptionGrid options={themeModeOptions} columns="grid-cols-2" />
        </SettingGroup>,
        <SettingGroup key="palette" title="Color Palette" description="Select your preferred color scheme">
          {renderPalettePicker()}
        </SettingGroup>,
        <SettingGroup key="roundness" title="Roundness" description="0% = square corners, 100% = pill">
          <SliderRow value={badgeRoundness} min={0} max={100} step={5} onChange={applyBadgeRoundness} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
        <SettingGroup key="translucency" title="Translucency" description="Badge background opacity">
          <SliderRow value={badgeTranslucency} min={0} max={95} step={5} onChange={applyBadgeTranslucency} valueSuffix="%" defaultValue={0} />
        </SettingGroup>,
        <SettingGroup key="branding" title="Branding" description="Pin a logo or watermark to a screen corner" pro locked={!isPro} buyUrl={POPKEY_PRO_URL}>
          <BrandingSettings />
        </SettingGroup>,
      ],
    },
    {
      title: "Behavior",
      items: [
        <SettingGroup key="animation-style" title="Animation" description="How badges enter and exit" pro locked={!isPro} buyUrl={POPKEY_PRO_URL}>
          <OptionGrid options={badgeAnimationOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="animation" title="Animation Intensity" description="Control how animated your interactions feel">
          <OptionGrid options={animationOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="size" title="Size" description="Scale badges and spacing">
          <SliderRow value={Math.round(scaleMultiplier * 100)} min={50} max={200} step={5} onChange={(v) => applyScaleMultiplier(v / 100)} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
        <SettingGroup key="position" title="Position" description="Where badges appear on screen">
          <OptionGrid options={positionOptions} columns="grid-cols-3" compact />
        </SettingGroup>,
        <SettingGroup key="offset-x" title="Horizontal Offset" description="Nudge left or right from edge">
          <SliderRow value={positionOffsetX} min={-200} max={200} step={4} onChange={applyPositionOffsetX} valueSuffix="px" defaultValue={0} />
        </SettingGroup>,
        <SettingGroup key="offset-y" title="Vertical Offset" description="Nudge up or down from edge">
          <SliderRow value={positionOffsetY} min={-200} max={200} step={4} onChange={applyPositionOffsetY} valueSuffix="px" defaultValue={0} />
        </SettingGroup>,
        <SettingGroup key="duration" title="Duration" description="How long badges stay visible">
          <OptionGrid options={durationOptions} columns="grid-cols-4" compact />
        </SettingGroup>,
        <SettingGroup key="max-badges" title="Max Badges" description="Maximum shown at once">
          <OptionGrid options={maxBadgesOptions} columns="grid-cols-4" compact />
        </SettingGroup>,
      ],
    },
    {
      title: "Inputs",
      items: [
        <SettingGroup key="sources" title="Sources" description="Which inputs to capture">
          <div className="space-y-2">
            <ToggleRow label="Keyboard" description="Show key press badges" checked={keyboardEnabled} onChange={toggleKeyboardEnabled} />
            {keyboardEnabled && (
              <ToggleRow label="Key repeats" description="Count a held key as it auto-repeats (×N)" checked={showKeyRepeat} onChange={toggleShowKeyRepeat} />
            )}
            {/* Word mode toggle — disabled, see src/hooks/useWordCapture.ts */}
            <ToggleRow label="Mouse" description="Show mouse input" checked={mouseEnabled} onChange={toggleMouseEnabled} />
          </div>
        </SettingGroup>,
        <SettingGroup key="click-ripples" title="Click Ripples" description="Expanding effect on mouse clicks">
          <div className="space-y-2">
            <ToggleRow label="Show click ripples" checked={showMouseClicks} onChange={toggleShowMouseClicks} />
            {showMouseClicks && (
              <>
                <span className="text-xs font-medium" style={{ color: surfacePalette.muted }}>Effect</span>
                <OptionGrid options={clickEffectOptions} columns="grid-cols-4" compact />
                <span className="text-xs font-medium" style={{ color: surfacePalette.muted }}>Size</span>
                <SliderRow value={clickSize} min={24} max={120} step={4} onChange={applyClickSize} valueSuffix="px" defaultValue={48} />
                <div className="flex items-center gap-2 rounded-[12px] px-3 py-1.5" style={{ backgroundColor: surfacePalette.card }}>
                  <span className="text-xs font-medium" style={{ color: surfacePalette.text }}>Color</span>
                  <div className="ml-auto">{renderColorPicker(clickColor, applyClickColor, () => applyClickColor("palette"))}</div>
                </div>
              </>
            )}
          </div>
        </SettingGroup>,
        <SettingGroup key="scroll-arrows" title="Scroll Arrows" description="Direction arrows on scroll wheel">
          <div className="space-y-2">
            <ToggleRow label="Show scroll arrows" checked={showScrollWheel} onChange={toggleShowScrollWheel} />
            {showScrollWheel && (
              <div className="flex items-center gap-2 rounded-[12px] px-3 py-1.5" style={{ backgroundColor: surfacePalette.card }}>
                <span className="text-xs font-medium" style={{ color: surfacePalette.text }}>Arrow Color</span>
                <div className="ml-auto">{renderColorPicker(scrollColor, applyScrollColor, () => applyScrollColor("palette"))}</div>
              </div>
            )}
          </div>
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
          buyUrl={POPKEY_PRO_URL}
          tagline="Branding, custom fonts & badge animations."
          onActivate={(key) => activateLicense(key)}
          onDeactivate={() => void deactivateLicense()}
        />,
        desktop ? (
          <SettingGroup key="shortcut" title="Toggle Shortcut" description="Global shortcut to show/hide PopKey">
            <ShortcutButton
              currentShortcut={hotkey}
              isRecording={recordingKind === "main"}
              activeKeys={activeKeys}
              onStartRecording={() => startRecording("main")}
            />
          </SettingGroup>
        ) : null,
        desktop ? (
          <SettingGroup key="obs" title="OBS Mode" description="Unpin from always-on-top so OBS can capture PopKey as its own window source">
            <ToggleRow
              label="OBS mode"
              description="Overlay drops to normal z-order — capture it separately and composite in OBS"
              checked={obsMode}
              onChange={toggleObsMode}
            />
          </SettingGroup>
        ) : null,
        desktop ? (
          <SettingGroup key="startup" title="Startup" description="Configure application startup behavior">
            <ToggleRow label="Open at login" checked={openAtLogin} onChange={toggleOpenAtLogin} />
          </SettingGroup>
        ) : null,
        <SettingGroup key="config" title="Config" description="Back up your settings or restore them from a file">
          <SettingsImportExport schema={settingsSchema} store={useStore} appName="PopKey" />
        </SettingGroup>,
        desktop ? (
          <SettingGroup key="quit" title="Quit" description="Close PopKey completely">
            <button
              onClick={() => quitApp()}
              className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: surfacePalette.card, color: "#ef4444" }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Quit PopKey
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
        <SettingsWindowFrame appName="PopKey">{sectionsContent}</SettingsWindowFrame>
      </SettingsUIProvider>
    );
  }

  // Web/demo mode: floating settings button
  const { text: menuText } = getMenuColors(isDark);
  const previewColor = getBadgeColors(colorPalette)[0];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <button
        onClick={() => {/* Web mode — embedded in WebRoot */}}
        className="neo-box neo-box-hover-only inline-flex cursor-default items-center gap-2 px-5 py-3 text-foreground"
        style={{ backgroundColor: previewColor }}
      >
        <Settings className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        <span className="font-display text-sm font-bold uppercase tracking-wide" style={{ color: menuText }}>
          PopKey
        </span>
      </button>
    </div>
  );
};

export default SystemTray;
