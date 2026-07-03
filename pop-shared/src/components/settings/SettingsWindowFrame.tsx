/**
 * Frameless settings-window chrome shared by both apps: rounded panel,
 * header with gear icon, scrollable body, and a Done button that hides the
 * window. Sized per density (PopJot comfortable, PopKey compact).
 */

import React from "react";
import { Settings } from "lucide-react";
import { closeWindow, isDesktop } from "../../settings/renderer";
import { useSettingsUI } from "./primitives";

const FRAME_STYLES = {
  comfortable: {
    outer: "flex h-screen w-screen p-4",
    width: "100%",
    height: "100%",
    radius: "24px",
    header: "px-6 pb-4 pt-5",
    headerRow: "flex items-center gap-3",
    iconBox: "flex h-10 w-10 items-center justify-center rounded-lg",
    icon: "h-5 w-5",
    title: "text-lg font-bold leading-tight",
    subtitle: "text-xs leading-tight",
    body: "flex-1 flex flex-col overflow-hidden px-6 py-4",
    footer: "px-6 py-4",
    doneButton: "rounded-[12px] px-5 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-95 hover:scale-105 active:scale-95 shadow-md",
  },
  compact: {
    outer: "flex h-screen w-screen p-4",
    width: "100%",
    height: "100%",
    radius: "24px",
    header: "px-6 pb-4 pt-5",
    headerRow: "flex items-center gap-3",
    iconBox: "flex h-10 w-10 items-center justify-center rounded-lg",
    icon: "h-5 w-5",
    title: "text-lg font-bold leading-tight",
    subtitle: "text-xs leading-tight",
    body: "flex-1 flex flex-col overflow-hidden px-6 py-4",
    footer: "px-6 py-4",
    doneButton: "rounded-[12px] px-5 py-2 text-xs font-semibold transition-all duration-200 hover:opacity-95 hover:scale-105 active:scale-95 shadow-md",
  },
} as const;

export const SettingsWindowFrame = ({
  appName,
  children,
}: {
  appName: string;
  children: React.ReactNode;
}) => {
  const { density, palette } = useSettingsUI();
  const f = FRAME_STYLES[density];

  return (
    <div className={f.outer}>
      <div
        className="flex flex-col"
        style={{
          backgroundColor: palette.panel,
          width: f.width,
          height: f.height,
          borderRadius: f.radius,
        }}
      >
        <header className={f.header} style={{ borderBottom: `1px solid ${palette.divider}` }}>
          <div className={f.headerRow}>
            <div className={f.iconBox} style={{ backgroundColor: palette.card }}>
              <Settings className={f.icon} style={{ color: palette.text }} />
            </div>
            <div>
              <div className={f.title} style={{ color: palette.text }}>
                Settings
              </div>
              <div className={f.subtitle} style={{ color: palette.muted }}>
                {appName} preferences
              </div>
            </div>
          </div>
        </header>

        <div className={f.body}>{children}</div>

        <div className={`${f.footer} md:hidden`} style={{ borderTop: `1px solid ${palette.divider}` }}>
          <div className="flex justify-end">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("close-settings"));
                if (isDesktop()) {
                  closeWindow();
                }
              }}
              className={f.doneButton}
              style={{ backgroundColor: palette.selected, color: palette.text }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Panel chrome for the embedded (web demo) settings variant. */
export const EmbeddedSettingsPanel = ({
  appName,
  children,
}: {
  appName?: string;
  children: React.ReactNode;
}) => {
  const { palette } = useSettingsUI();
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        backgroundColor: palette.panel,
        borderRadius: "24px",
        border: "3px solid hsl(var(--foreground))",
        boxShadow: "6px 6px 0px hsl(var(--foreground))",
        width: "960px",
        height: "680px",
        maxWidth: "100%",
        maxHeight: "90vh",
      }}
    >
      {appName && (
        <header
          className="px-6 pb-4 pt-5 shrink-0"
          style={{ borderBottom: `1px solid ${palette.divider}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: palette.card }}
            >
              <Settings className="h-5 w-5" style={{ color: palette.text }} />
            </div>
            <div>
              <div className="text-lg font-bold leading-tight" style={{ color: palette.text }}>
                Settings
              </div>
              <div className="text-xs leading-tight" style={{ color: palette.muted }}>
                {appName} preferences
              </div>
            </div>
          </div>
        </header>
      )}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
        {children}
      </div>
    </div>
  );
};
