/**
 * Shared building blocks for the PopSuite settings UI.
 *
 * Both apps render the same kinds of controls (option grids, toggles,
 * sliders, shortcut buttons) at two visual densities: PopJot uses
 * "comfortable", PopKey uses "compact". Components read the density and
 * surface palette from SettingsUIProvider so call sites stay terse.
 */

import React, { createContext, useContext, useState } from "react";
import { AlertCircle, Check, Keyboard, RotateCcw, Paintbrush, SlidersHorizontal, MousePointer, Sparkles, RefreshCw, Image as ImageIcon, Settings as SettingsIcon } from "lucide-react";
import { ERROR_COLORS, PRO_ACCENT, type SurfacePalette } from "../../config/desktopTheme";
import { formatHotkey } from "../../lib/hotkeys";
import { closeWindow, isDesktop, isSettingsWindow, openExternal } from "../../settings/renderer";

export type Option<T> = {
  label: string;
  checked: boolean;
  value: T;
  onSelect: (value: T) => void;
};

export type SettingsDensity = "comfortable" | "compact";

const DENSITY_STYLES = {
  comfortable: {
    headingWrap: "mb-4",
    headingBar: "mt-1 h-0.5 w-10 rounded-full",
    groupWrap: "space-y-3 pt-2 pb-1",
    groupTitle: "text-base font-bold",
    groupDesc: "text-xs leading-normal opacity-90",
    gridGap: "gap-3",
    optionButton: "rounded-[12px] px-4 text-sm font-semibold py-3",
    optionCheck: "h-4 w-4",
    toggleRow: "rounded-[12px] px-5 py-3.5 text-sm font-semibold",
    toggleBox: "h-4 w-4",
    sliderWrap: "rounded-[12px] px-5 py-3.5",
    shortcutButton: "gap-2.5 rounded-[12px] px-5 py-3.5 text-sm font-semibold",
    itemDivider: "my-2.5 h-px",
    columnsGrid: "grid grid-cols-1 gap-6 md:grid-cols-3",
  },
  compact: {
    headingWrap: "mb-4",
    headingBar: "mt-1 h-0.5 w-10 rounded-full",
    groupWrap: "space-y-3 pt-2 pb-1",
    groupTitle: "text-base font-bold",
    groupDesc: "text-xs leading-normal opacity-90",
    gridGap: "gap-3",
    optionButton: "rounded-[12px] px-4 text-sm font-semibold py-3",
    optionCheck: "h-4 w-4",
    toggleRow: "rounded-[12px] px-5 py-3.5 text-sm font-semibold",
    toggleBox: "h-4 w-4",
    sliderWrap: "rounded-[12px] px-5 py-3.5",
    shortcutButton: "gap-2.5 rounded-[12px] px-5 py-3.5 text-sm font-semibold",
    itemDivider: "my-2.5 h-px",
    columnsGrid: "grid grid-cols-1 gap-6 md:grid-cols-3",
  },
} as const;

interface SettingsUIContextValue {
  density: SettingsDensity;
  palette: SurfacePalette;
}

const SettingsUIContext = createContext<SettingsUIContextValue | null>(null);

export function SettingsUIProvider({
  density,
  palette,
  children,
}: SettingsUIContextValue & { children: React.ReactNode }) {
  return (
    <SettingsUIContext.Provider value={{ density, palette }}>
      {children}
    </SettingsUIContext.Provider>
  );
}

export function useSettingsUI(): SettingsUIContextValue & {
  styles: (typeof DENSITY_STYLES)[SettingsDensity];
} {
  const ctx = useContext(SettingsUIContext);
  if (!ctx) {
    throw new Error("Settings UI components must be rendered inside SettingsUIProvider");
  }
  return { ...ctx, styles: DENSITY_STYLES[ctx.density] };
}

export const SectionHeading = ({ title }: { title: string }) => {
  const { palette, styles } = useSettingsUI();
  return (
    <div className={styles.headingWrap}>
      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: palette.muted }}>
        {title}
      </h3>
      <div className={styles.headingBar} style={{ backgroundColor: palette.muted, opacity: 0.4 }} />
    </div>
  );
};

export const SettingGroup = ({
  title,
  description,
  children,
  pro = false,
  locked = false,
  buyUrl,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Pro feature: adds a "PRO" badge + accent card so it stands out. */
  pro?: boolean;
  /** Pro feature the user hasn't unlocked: controls show muted + disabled with a Get Pro CTA. */
  locked?: boolean;
  /** Where the Get Pro button links (shown when locked). */
  buyUrl?: string;
}) => {
  const { palette, styles } = useSettingsUI();
  return (
    <div
      className={pro ? "space-y-3 rounded-[16px] p-4" : styles.groupWrap}
      style={pro ? { border: `1.5px solid ${PRO_ACCENT}59`, backgroundColor: `${PRO_ACCENT}12` } : undefined}
    >
      <div>
        <div className="flex items-center gap-2">
          <h4 className={styles.groupTitle} style={{ color: palette.text }}>
            {title}
          </h4>
          {pro && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}
            >
              Pro
            </span>
          )}
          {pro && locked && buyUrl && (
            <button
              onClick={() => openExternal(buyUrl)}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}
            >
              <Sparkles className="h-3 w-3" />
              Get Pro
            </button>
          )}
        </div>
        <p className={styles.groupDesc} style={{ color: palette.muted }}>
          {description}
        </p>
      </div>
      {/* Locked: preview the real controls, muted + non-interactive. */}
      <div style={locked ? { opacity: 0.5, pointerEvents: "none", userSelect: "none" } : undefined}>
        {children}
      </div>
    </div>
  );
};

export function OptionGrid<T>({
  options,
  columns,
  compact = false,
}: {
  options: Option<T>[];
  columns: string;
  /** compact = centred label, no check mark. */
  compact?: boolean;
}) {
  const { palette, styles } = useSettingsUI();
  return (
    <div className={`grid ${columns} ${styles.gridGap}`}>
      {options.map((option) => (
        <button
          key={option.label}
          onClick={() => option.onSelect(option.value)}
          className={`flex items-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${styles.optionButton} ${compact ? "justify-center" : "justify-between"
            }`}
          style={{
            backgroundColor: option.checked ? palette.selected : palette.card,
            color: option.checked ? palette.text : palette.muted,
            border: `1.5px solid ${option.checked ? palette.text : "transparent"}`,
          }}
        >
          {option.label}
          {!compact && option.checked && <Check className={styles.optionCheck} />}
        </button>
      ))}
    </div>
  );
}

export const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) => {
  const { palette, styles } = useSettingsUI();
  return (
    <label
      className={`flex cursor-pointer items-center justify-between transition-all duration-200 hover:brightness-110 ${styles.toggleRow}`}
      style={{ backgroundColor: palette.card, color: palette.text }}
    >
      <div>
        <div className="font-semibold">{label}</div>
        {description && (
          <div className="text-xs mt-0.5 leading-tight" style={{ color: palette.muted }}>
            {description}
          </div>
        )}
      </div>
      <div className="relative flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div
          className="h-6 w-11 rounded-full transition-colors duration-200 ease-in-out border border-transparent flex items-center px-0.5"
          style={{
            backgroundColor: checked ? palette.selected : palette.divider,
            border: `1px solid ${palette.divider}`,
          }}
        >
          <div
            className={`h-5 w-5 rounded-full shadow-md transition-transform duration-200 ease-in-out`}
            style={{
              backgroundColor: checked ? palette.text : palette.muted,
              transform: checked ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </div>
      </div>
    </label>
  );
};

export const SliderRow = ({
  value,
  min,
  max,
  step,
  onChange,
  valueSuffix = "",
  defaultValue,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  valueSuffix?: string;
  /** When set, shows a reset button whenever value differs. */
  defaultValue?: number;
}) => {
  const { palette, styles } = useSettingsUI();
  return (
    <div className={styles.sliderWrap} style={{ backgroundColor: palette.card }}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          className="flex-1 settings-slider"
          style={{
            "--slider-track-color": palette.divider,
            "--slider-thumb-color": palette.text,
          } as React.CSSProperties}
        />
        <span
          className="w-10 text-right text-xs font-semibold tabular-nums"
          style={{ color: palette.muted }}
        >
          {value}
          {valueSuffix}
        </span>
        {defaultValue !== undefined && value !== defaultValue && (
          <button
            onClick={() => onChange(defaultValue)}
            className="flex items-center justify-center rounded-md opacity-50 transition-all duration-150 hover:opacity-100 hover:scale-110"
            style={{ color: palette.muted }}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ShortcutButton = ({
  currentShortcut,
  isRecording,
  activeKeys,
  onStartRecording,
}: {
  currentShortcut: string;
  isRecording: boolean;
  activeKeys: Set<string>;
  onStartRecording: () => void;
}) => {
  const { palette, styles } = useSettingsUI();
  return (
    <button
      onClick={onStartRecording}
      className={`flex w-full items-center ${styles.shortcutButton}`}
      style={{
        backgroundColor: isRecording ? palette.selected : palette.card,
        color: palette.text,
      }}
    >
      <Keyboard className="h-4 w-4 opacity-50" />
      <span className="flex-1 text-left">
        {isRecording
          ? activeKeys.size > 0
            ? formatHotkey(activeKeys)
            : "Press keys..."
          : currentShortcut}
      </span>
    </button>
  );
};

export const ShortcutErrorBanner = ({
  error,
  isDark,
}: {
  error: string | null;
  isDark: boolean;
}) => {
  if (!error) return null;
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-[18px] border px-4 py-3 text-sm"
      style={{
        borderColor: ERROR_COLORS.border,
        backgroundColor: isDark ? ERROR_COLORS.bgDark : ERROR_COLORS.bgLight,
        color: isDark ? ERROR_COLORS.textDark : ERROR_COLORS.textLight,
      }}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
};

const getCategoryIcon = (title: string, className?: string) => {
  const t = title.toLowerCase();
  if (t.includes("style") || t.includes("appearance")) {
    return <Paintbrush className={className} />;
  }
  if (t.includes("layout") || t.includes("behavior")) {
    return <SlidersHorizontal className={className} />;
  }
  if (t.includes("input")) {
    return <MousePointer className={className} />;
  }
  if (t.includes("sync")) {
    return <RefreshCw className={className} />;
  }
  if (t.includes("brand")) {
    return <ImageIcon className={className} />;
  }
  return <SettingsIcon className={className} />;
};

/** Sidebar-based tabs layout for the settings categories. */
export const SettingsColumns = ({
  columns,
}: {
  columns: Array<{ title: string; items: Array<React.ReactNode> }>;
}) => {
  const { palette } = useSettingsUI();
  const validColumns = columns.filter((col) => col.items.some(Boolean));
  const [activeTab, setActiveTab] = useState(validColumns[0]?.title || "");

  const activeColumn = validColumns.find((col) => col.title === activeTab) || validColumns[0];

  return (
    <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
      {/* Sidebar / Tabs list */}
      <div
        className="w-full md:w-52 shrink-0 flex flex-row md:flex-col justify-between pb-3 md:pb-0 md:pr-4 border-b md:border-b-0 md:border-r mb-4 md:mb-0"
        style={{ borderColor: palette.divider }}
      >
        <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible scrollbar-hide">
          {validColumns.map((col) => {
            const isActive = col.title === activeTab;
            return (
              <button
                key={col.title}
                onClick={() => setActiveTab(col.title)}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-base font-semibold transition-all duration-200 text-left shrink-0 md:shrink ${
                  isActive ? "shadow-sm" : "hover:bg-neutral-500/10"
                }`}
                style={{
                  backgroundColor: isActive ? palette.selected : "transparent",
                  color: isActive ? palette.text : palette.muted,
                  borderLeft: isActive ? `3px solid ${palette.text}` : "3px solid transparent",
                }}
              >
                {getCategoryIcon(col.title, "h-5 w-5 shrink-0")}
                <span>{col.title}</span>
              </button>
            );
          })}
        </div>

        {/* Close/Accept Button at the bottom of the sidebar (only for desktop layout) */}
        <div className="hidden md:flex mt-auto pt-4 flex-col">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("close-settings"));
              if (isDesktop() && isSettingsWindow()) {
                closeWindow();
              }
            }}
            className="w-full rounded-[12px] px-4 py-2.5 text-base font-semibold transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-sm text-center"
            style={{ backgroundColor: palette.selected, color: palette.text }}
          >
            Accept
          </button>
        </div>
      </div>

      {/* Content panel */}
      <div
        className="flex-1 md:pl-6 overflow-y-auto h-full custom-scrollbar pr-2 pb-6 overscroll-contain"
        style={{
          "--scrollbar-thumb-color": `${palette.text}20`,
          "--scrollbar-hover-color": `${palette.text}40`,
        } as React.CSSProperties}
      >
        {activeColumn && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="mb-2">
              <h2 className="text-sm font-bold tracking-wider uppercase opacity-60" style={{ color: palette.text }}>
                {activeColumn.title}
              </h2>
              <div className="h-0.5 w-8 mt-1 rounded-full" style={{ backgroundColor: palette.text, opacity: 0.3 }} />
            </div>
            <div className="space-y-4">
              {activeColumn.items.filter(Boolean).map((item, index) => (
                <div
                  key={`${activeColumn.title}-${index}`}
                  className="rounded-xl transition-all duration-200"
                >
                  {index > 0 && (
                    <div className="my-3 h-px" style={{ backgroundColor: palette.divider }} />
                  )}
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Content-only renderer for a single settings section: the items of one
 * SettingsColumns column without the sidebar, scroll container, or section
 * heading. The suite settings window composes these under its own suite-level
 * navigation (one sidebar spanning both apps).
 */
export const SettingsSection = ({
  items,
}: {
  items: Array<React.ReactNode>;
}) => {
  const { palette } = useSettingsUI();
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-4">
      {visible.map((item, index) => (
        <div key={index} className="rounded-xl transition-all duration-200">
          {index > 0 && (
            <div className="my-3 h-px" style={{ backgroundColor: palette.divider }} />
          )}
          {item}
        </div>
      ))}
    </div>
  );
};
