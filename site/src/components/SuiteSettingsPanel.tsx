import { useState } from "react";
import {
  Bookmark,
  Keyboard,
  MousePointer,
  Paintbrush,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { SettingsUIProvider, SuitePresets, type SuiteAppConfig } from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import PopJotSystemTray, {
  type SuiteSectionRequest,
} from "@popjot/components/SystemTray";
import { settingsSchema as popjotSchema } from "@popjot/config/settingsSchema";
import { useStore as usePopjotStore } from "@popjot/store/useStore";
import PopKeySystemTray from "@popkey/components/SystemTray";
import { settingsSchema as popkeySchema } from "@popkey/config/settingsSchema";
import { useStore as usePopkeyStore } from "@popkey/store/useStore";

/** Ko-fi product page for the suite Pro key (same product both apps link to). */
const SUITE_PRO_URL = "https://ko-fi.com/s/264fd0031f";

/**
 * The suite settings modal body: a web mirror of the desktop suite's Settings
 * window (app/src/settings/main.tsx) — same sidebar navigation, headings, and
 * combined pages rendering both modules' sections via `SystemTray
 * suiteSection`. This is a live demo, so every module panel is rendered
 * `embedded` (forces Pro features unlocked, matching the desktop suite once
 * purchased) and Shortcuts records real hotkeys straight into the browser
 * tab's store — `setNamedShortcut`/`applySettings` already no-op their
 * Electron IPC calls when `window.electronAPI` doesn't exist, so this works
 * with no platform branching. Presets uses the same localStorage-backed
 * SuitePresets as desktop (no suite IPC bridge here, so no tray sync).
 * Desktop-only items (startup, quit, file import/export) still fall back to
 * the modules' own "available in the desktop app" notes. Both module panels
 * stay mounted so each page keeps its state.
 */

type ModuleId = "popjot" | "popkey";

type LeafId =
  | "popjot-appearance"
  | "popjot-behavior"
  | "popkey-appearance"
  | "popkey-behavior"
  | "popkey-inputs"
  | "shortcuts"
  | "pro"
  | "presets"
  | "sync"
  | "system";

type LeafConfig = {
  heading: string;
  popjot: SuiteSectionRequest;
  popkey: SuiteSectionRequest;
};

const LEAVES: Record<LeafId, LeafConfig> = {
  "popjot-appearance": {
    heading: "PopJot Appearance",
    popjot: { title: "Appearance" },
    popkey: null,
  },
  "popjot-behavior": {
    heading: "PopJot Behavior",
    popjot: { title: "Behavior" },
    popkey: null,
  },
  "popkey-appearance": {
    heading: "PopKey Appearance",
    popjot: null,
    popkey: { title: "Appearance" },
  },
  "popkey-behavior": {
    heading: "PopKey Behavior",
    popjot: null,
    popkey: { title: "Behavior" },
  },
  "popkey-inputs": {
    heading: "PopKey Inputs",
    popjot: null,
    popkey: { title: "Inputs" },
  },
  shortcuts: {
    heading: "Shortcuts",
    popjot: { title: "Shortcuts" },
    popkey: { title: "Shortcuts" },
  },
  pro: {
    heading: "Pro",
    popjot: { title: "Pro" },
    // One suite license: the activation card renders once (from PopJot's
    // section); PopKey contributes only its feature cards.
    popkey: { title: "Pro", omitKeys: ["pro"] },
  },
  presets: {
    // Suite-only page (SuitePresetsBlock below); neither module contributes.
    heading: "Presets",
    popjot: null,
    popkey: null,
  },
  sync: {
    // The per-key link toggles are shared state, so one copy configures both.
    heading: "Sync",
    popjot: { title: "Sync" },
    popkey: null,
  },
  system: {
    // On the web the System column is a desktop-only note, so one copy.
    heading: "System",
    popjot: { title: "System" },
    popkey: null,
  },
};

const NAV_GROUPS: Array<{
  label: string | null;
  moduleId: ModuleId | null;
  items: Array<{ id: LeafId; label: string; icon: React.ReactNode }>;
}> = [
  {
    label: "PopJot",
    moduleId: "popjot",
    items: [
      { id: "popjot-appearance", label: "Appearance", icon: <Paintbrush className="h-4 w-4" /> },
      { id: "popjot-behavior", label: "Behavior", icon: <SlidersHorizontal className="h-4 w-4" /> },
    ],
  },
  {
    label: "PopKey",
    moduleId: "popkey",
    items: [
      { id: "popkey-appearance", label: "Appearance", icon: <Paintbrush className="h-4 w-4" /> },
      { id: "popkey-behavior", label: "Behavior", icon: <SlidersHorizontal className="h-4 w-4" /> },
      { id: "popkey-inputs", label: "Inputs", icon: <MousePointer className="h-4 w-4" /> },
    ],
  },
  {
    label: "Suite",
    moduleId: null,
    items: [
      { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="h-4 w-4" /> },
      { id: "pro", label: "Pro", icon: <Sparkles className="h-4 w-4" /> },
      { id: "presets", label: "Presets", icon: <Bookmark className="h-4 w-4" /> },
      { id: "sync", label: "Sync", icon: <RefreshCw className="h-4 w-4" /> },
      { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

const surfacePalette = getSurfacePalette(true);

const closeSettings = () => window.dispatchEvent(new CustomEvent("close-settings"));

/** Both apps' schema/store pairs for the web demo's Presets page (no `activate` — no suite IPC bridge on web). */
const SUITE_APPS: SuiteAppConfig[] = [
  { appName: "PopJot", schema: popjotSchema, store: usePopjotStore },
  { appName: "PopKey", schema: popkeySchema, store: usePopkeyStore },
];

/** App name label above each module's block on the combined pages. */
const AppLabel = ({ name }: { name: string }) => (
  <div className="mb-3 mt-1 flex items-center gap-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">
      {name}
    </span>
    <div className="h-px flex-1 bg-white/10" />
  </div>
);

interface Props {
  /** Live engine toggle state, shown as the desktop window's "(off)" markers. */
  popjotOn: boolean;
  popkeyOn: boolean;
}

const SuiteSettingsPanel = ({ popjotOn, popkeyOn }: Props) => {
  const [leaf, setLeaf] = useState<LeafId>("popjot-appearance");

  const config = LEAVES[leaf];
  const combined = config.popjot !== null && config.popkey !== null;
  const enabled = (id: ModuleId) => (id === "popjot" ? popjotOn : popkeyOn);

  return (
    <SettingsUIProvider density="compact" palette={surfacePalette}>
      <div className="flex h-[min(680px,85vh)] w-[min(920px,92vw)] flex-col overflow-hidden bg-[#202020] text-white">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Settings className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Settings</div>
            <div className="text-[11px] text-white/45">PopSuite preferences</div>
          </div>

          <button
            type="button"
            aria-label="Close settings"
            onClick={closeSettings}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 px-3 py-4">
            <nav
              className="custom-scrollbar flex-1 space-y-4 overflow-y-auto"
              style={{
                "--scrollbar-thumb-color": "rgba(255,255,255,0.15)",
                "--scrollbar-hover-color": "rgba(255,255,255,0.3)",
              } as React.CSSProperties}
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.label ?? "suite"}>
                  {group.label && (
                    <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                      {group.label}
                      {group.moduleId && !enabled(group.moduleId) && (
                        <span className="ml-1.5 normal-case text-white/25">(off)</span>
                      )}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = item.id === leaf;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setLeaf(item.id)}
                          className={
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors " +
                            (active
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:bg-white/5 hover:text-white/80")
                          }
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <button
              type="button"
              onClick={closeSettings}
              className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              Accept
            </button>
          </aside>

          <main
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5"
            style={{
              "--scrollbar-thumb-color": "rgba(255,255,255,0.15)",
              "--scrollbar-hover-color": "rgba(255,255,255,0.3)",
            } as React.CSSProperties}
          >
            <div className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
                {config.heading}
              </h2>
              <div className="mt-1 h-0.5 w-8 rounded-full bg-white/30" />
            </div>

            {/* Both panels stay mounted; a null section renders nothing but
                keeps that module's store live and each page's state intact. */}
            <div className={combined && config.popjot ? "mb-8" : undefined}>
              {combined && <AppLabel name="PopJot" />}
              <PopJotSystemTray suiteSection={config.popjot} embedded demoShortcuts />
            </div>
            <div>
              {combined && <AppLabel name="PopKey" />}
              <PopKeySystemTray suiteSection={config.popkey} embedded demoShortcuts />
            </div>
            {leaf === "presets" && (
              <SuitePresets apps={SUITE_APPS} isPro buyUrl={SUITE_PRO_URL} />
            )}
          </main>
        </div>
      </div>
    </SettingsUIProvider>
  );
};

export default SuiteSettingsPanel;
