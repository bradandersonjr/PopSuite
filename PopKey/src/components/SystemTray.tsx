import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getShortcuts,
  isDesktop,
  quitApp,
  sendAnimationIntensity,
  sendBadgeDuration,
  sendBadgeStyle,
  sendBadgeTranslucency,
  sendColorPalette,
  sendDisplayPosition,
  sendKeyboardEnabled,
  sendMaxBadges,
  sendMouseEnabled,
  sendScaleMultiplier,
  sendPositionOffsetX,
  sendPositionOffsetY,
  sendBadgeRoundness,
  sendPopMonoColor,
  sendScrollColor,
  sendClickColor,
  sendShowMouseClicks,
  sendShowScrollWheel,
  sendThemeMode,
  setMainShortcut,
} from "@/lib/platform";
import {
  type Option,
  OptionGrid,
  SettingGroup,
  SettingsColumns,
  SettingsUIProvider,
  SettingsWindowFrame,
  EmbeddedSettingsPanel,
  ShortcutButton,
  ShortcutErrorBanner,
  SliderRow,
  ToggleRow,
  useOpenAtLogin,
  useShortcutRecorder,
} from "@shared/components/settings";
import { LogOut, Settings } from "lucide-react";
import {
  AnimationIntensity,
  BadgeStyle,
  ColorPalette,
  DisplayPosition,
  ThemeMode,
  useStore,
} from "@/store/useStore";
import { getMenuColors, getSurfacePalette, type SurfacePalette } from "@shared/config/desktopTheme";
import { getBadgeColors, PALETTE_NAMES } from "@/config/themes";
import { isMac } from "@shared/lib/hotkeys";
import { useTraySettingsSync } from "@/hooks/useTraySettingsSync";

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
      return hexToHsl(currentColor);
    } catch {
      return { h: 0, s: 100, l: 50 };
    }
  }, [currentColor]);

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

  const togglePicker = () => {
    if (!showPicker) {
      updateCoords();
      setShowPicker(true);
    } else {
      setShowPicker(false);
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
    onColorChange(hex);
  };

  const handleHexInput = (val: string) => {
    setTempHex(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onColorChange(val);
    }
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
            backgroundColor: currentColor,
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
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowPicker(false)} />
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

              {/* Quick Palette Colors */}
              <div className="flex flex-col gap-2 pt-2.5 border-t" style={{ borderColor: surfacePalette.divider }}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Palette Swatches</div>
                <div className="flex flex-wrap gap-1.5">
                  {paletteColors.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => {
                        setTempHex(hex);
                        onColorChange(hex);
                      }}
                      className="w-[22px] h-[22px] rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
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
    badgeTranslucency,
    setBadgeTranslucency: setBadgeTranslucencyLocal,
    showMouseClicks,
    setShowMouseClicks: setShowMouseClicksLocal,
    showScrollWheel,
    setShowScrollWheel: setShowScrollWheelLocal,
    keyboardEnabled,
    setKeyboardEnabled: setKeyboardEnabledLocal,
    mouseEnabled,
    setMouseEnabled: setMouseEnabledLocal,
    popMonoColor,
    setPopMonoColor: setPopMonoColorLocal,
    badgeRoundness,
    setBadgeRoundness: setBadgeRoundnessLocal,
    scrollColor,
    setScrollColor,
    clickColor,
    setClickColor,
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
  const applyPopMonoColor = (color: string) => {
    setPopMonoColorLocal(color);
    sendPopMonoColor(color);
  };
  const applyBadgeTranslucency = (val: number) => {
    setBadgeTranslucencyLocal(val);
    sendBadgeTranslucency(val);
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

  // ─── PopKey-specific pickers ──────────────────────────────────────────

  const renderPalettePicker = () => (
    <div className="grid grid-cols-2 gap-3">
      {PALETTE_NAMES.map((name) => {
        const colors = getBadgeColors(name);
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
            <div className="flex gap-1">
              {colors.map((hex) => (
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

  const badgeStyleOptions: Option<BadgeStyle>[] = [
    { label: "Flat", checked: badgeStyle === "flat", value: "flat", onSelect: applyBadgeStyle },
    { label: "Flat Outline", checked: badgeStyle === "flat-outline", value: "flat-outline", onSelect: applyBadgeStyle },
    { label: "Pop", checked: badgeStyle === "pop", value: "pop", onSelect: applyBadgeStyle },
    { label: "Pop Mono", checked: badgeStyle === "pop-mono", value: "pop-mono", onSelect: applyBadgeStyle },
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
          <div className="space-y-2">
            <OptionGrid options={badgeStyleOptions} columns="grid-cols-2" compact />
            {badgeStyle === "pop-mono" && (
              <div
                className="flex items-center gap-2 rounded-[12px] px-3 py-1.5"
                style={{ backgroundColor: surfacePalette.card }}
              >
                <span className="text-xs font-medium" style={{ color: surfacePalette.text }}>Mono Color</span>
                <div className="ml-auto">{renderColorPicker(popMonoColor, applyPopMonoColor)}</div>
              </div>
            )}
          </div>
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
      ],
    },
    {
      title: "Behavior",
      items: [
        <SettingGroup key="size" title="Size" description="Scale badges and spacing">
          <SliderRow value={Math.round(scaleMultiplier * 100)} min={50} max={200} step={5} onChange={(v) => applyScaleMultiplier(v / 100)} valueSuffix="%" defaultValue={100} />
        </SettingGroup>,
        <SettingGroup key="animation" title="Animation Intensity" description="Control how animated your interactions feel">
          <OptionGrid options={animationOptions} columns="grid-cols-3" compact />
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
            {/* Word mode toggle — disabled, see src/hooks/useWordCapture.ts */}
            <ToggleRow label="Mouse" description="Show mouse input" checked={mouseEnabled} onChange={toggleMouseEnabled} />
          </div>
        </SettingGroup>,
        <SettingGroup key="indicators" title="Indicators" description="Visual overlays to show">
          <div className="space-y-2">
            <ToggleRow label="Click Ripples" description="Expanding rings on click" checked={showMouseClicks} onChange={toggleShowMouseClicks} />
            {showMouseClicks && (
              <div className="flex items-center gap-2 rounded-[12px] px-3 py-1.5" style={{ backgroundColor: surfacePalette.card }}>
                <span className="text-xs font-medium" style={{ color: surfacePalette.text }}>Ring Color</span>
                <div className="ml-auto">{renderColorPicker(clickColor, applyClickColor, () => applyClickColor("palette"))}</div>
              </div>
            )}
            <ToggleRow label="Scroll Arrows" description="Direction arrows on scroll" checked={showScrollWheel} onChange={toggleShowScrollWheel} />
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
          <SettingGroup key="startup" title="Startup" description="Configure application startup behavior">
            <ToggleRow label="Open at login" checked={openAtLogin} onChange={toggleOpenAtLogin} />
          </SettingGroup>
        ) : null,
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
