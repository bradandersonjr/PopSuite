import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  Keyboard,
  LogOut,
  MousePointer,
  Paintbrush,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import {
  SettingGroup,
  SettingsUIProvider,
  SuiteImportExport,
  SuitePresets,
  ToastProvider,
} from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { quitApp } from "@shared/settings/renderer";
import { getLicenseStatus, onLicenseChange } from "@shared/license/renderer";
import { isMac } from "@shared/lib/hotkeys";
import PopJotSystemTray, {
  type SuiteSectionRequest,
} from "@popjot/components/SystemTray";
import { useTraySettingsSync as usePopJotTraySettingsSync } from "@popjot/hooks/useTraySettingsSync";
import { useLicenseSync as usePopJotLicenseSync } from "@popjot/hooks/useLicenseSync";
import { settingsSchema as popjotSchema } from "@popjot/config/settingsSchema";
import { useStore as usePopJotStore } from "@popjot/store/useStore";
import PopKeySystemTray from "@popkey/components/SystemTray";
import { useTraySettingsSync as usePopKeyTraySettingsSync } from "@popkey/hooks/useTraySettingsSync";
import { useLicenseSync as usePopKeyLicenseSync } from "@popkey/hooks/useLicenseSync";
import { settingsSchema as popkeySchema } from "@popkey/config/settingsSchema";
import { useStore as usePopKeyStore } from "@popkey/store/useStore";
import "@shared/index.css";

type ModuleId = "popjot" | "popkey";

type SettingsState = {
  activeId: ModuleId;
  tabs: Array<{ id: ModuleId; label: string; connected: boolean }>;
};

declare global {
  interface Window {
    electronAPI?: {
      onTrayMenuChange(
        channel: string,
        callback: (enabled: unknown) => void,
      ): (() => void) | undefined;
    };
    suiteSettings: {
      getState(): Promise<SettingsState>;
      select(id: ModuleId): void;
      seed(id: ModuleId): void;
      // Subscribe a tray-settings channel bound to a FIXED module namespace,
      // independent of the preload's mutable activeId. See preload.subscribeSetting.
      subscribeSetting(
        id: ModuleId,
        channel: string,
        callback: (value: unknown) => void,
      ): () => void;
      // Module-fixed shortcut read, same reasoning as subscribeSetting: avoids
      // racing the mutable activeId on mount. See preload.ts's getShortcuts.
      getShortcuts(id: "popjot"): Promise<{
        main: string;
        persistent: string;
        spotlight: string;
        lastTool: string;
      }>;
      getShortcuts(id: "popkey"): Promise<{ main: string }>;
      close(): void;
      onStateChanged(callback: (state: SettingsState) => void): () => void;
      syncPresets(payload: {
        presets: Array<{ id: string; name: string }>;
        isPro: boolean;
      }): void;
      onApplyPreset(callback: (id: string) => void): () => void;
      notifyApplyDone(): void;
    };
  }
}

// ─── Suite navigation model ──────────────────────────────────────────
//
// One sidebar for the whole suite. Each leaf maps to at most one section of
// each module (both modules on the combined pages), rendered content-only via
// the SystemTray suiteSection prop. Both module panels stay mounted at all
// times so their stores and IPC relays remain live regardless of which page
// is showing.

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
    // section); PopKey contributes only its gated feature cards.
    popkey: { title: "Pro", omitKeys: ["pro"] },
  },
  presets: {
    // Suite-only page (SuitePresets below); neither module contributes a
    // section here.
    heading: "Presets",
    popjot: null,
    popkey: null,
  },
  sync: {
    // The per-key link toggles are shared state, so one copy configures both
    // apps — rendering PopKey's identical section would be pure duplication.
    heading: "Sync",
    popjot: { title: "Sync" },
    popkey: null,
  },
  system: {
    heading: "System",
    // Config (per-app export/import) and Quit are suite-wide here (below),
    // not per-app — quitting either module already quits the whole suite
    // process, and a combined Config file covers both apps at once.
    popjot: { title: "System", omitKeys: ["config", "quit"] },
    popkey: { title: "System", omitKeys: ["startup", "config", "quit"] },
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

/** Ko-fi product page for the suite Pro key (same product both apps link to). */
const SUITE_PRO_URL = "https://ko-fi.com/s/264fd0031f";

/**
 * Both apps' schema/store pairs for suite-wide bulk operations (Config
 * export/import, Presets). `activate` points the preload's bridge router at
 * the right module before applySettings sends IPC — window.suiteSettings
 * .select updates routing synchronously in the preload.
 */
const SUITE_APPS = [
  {
    appName: "PopJot",
    schema: popjotSchema,
    store: usePopJotStore,
    activate: () => window.suiteSettings.select("popjot"),
  },
  {
    appName: "PopKey",
    schema: popkeySchema,
    store: usePopKeyStore,
    activate: () => window.suiteSettings.select("popkey"),
  },
];

// Module-fixed tray-settings subscribes. Binding each panel to its OWN module's
// IPC namespace (never the preload's mutable activeId) is what makes seed pushes
// for BOTH modules reliably land in their stores — otherwise the panel that
// mounts while the other module is active listens on the wrong namespace and
// misses its own seed, leaving its store at schema defaults (and presets then
// capturing those defaults). See @shared/hooks/useTraySettingsSync.
const subscribePopJotSetting = (channel: string, cb: (value: unknown) => void) =>
  window.suiteSettings.subscribeSetting("popjot", channel, cb);
const subscribePopKeySetting = (channel: string, cb: (value: unknown) => void) =>
  window.suiteSettings.subscribeSetting("popkey", channel, cb);

function PopJotPanel({ section }: { section: SuiteSectionRequest }) {
  usePopJotTraySettingsSync(subscribePopJotSetting);
  usePopJotLicenseSync();
  useEffect(() => window.suiteSettings.seed("popjot"), []);
  return (
    <PopJotSystemTray
      suiteSection={section}
      getShortcutsOverride={() => window.suiteSettings.getShortcuts("popjot")}
    />
  );
}

function PopKeyPanel({ section }: { section: SuiteSectionRequest }) {
  usePopKeyTraySettingsSync(subscribePopKeySetting);
  usePopKeyLicenseSync();
  useEffect(() => window.suiteSettings.seed("popkey"), []);
  return (
    <PopKeySystemTray
      suiteSection={section}
      getShortcutsOverride={() => window.suiteSettings.getShortcuts("popkey")}
    />
  );
}

/**
 * Suite-wide Config export/import and Quit, shown once on the System page
 * instead of duplicated per-app. Quitting either module's Electron process
 * already quits the whole suite (see createPopApp's quit-app IPC handler),
 * so one "Quit PopSuite" button reflects what actually happens.
 */
function SuiteSystemBlock() {
  return (
    <SettingsUIProvider density="compact" palette={getSurfacePalette(true)}>
      <SettingGroup
        title="Config"
        description="Back up all PopSuite settings or restore them from a file"
      >
        <SuiteImportExport apps={SUITE_APPS} />
      </SettingGroup>
      <div className="my-3 h-px bg-white/10" />
      <SettingGroup title="Quit" description="Close PopSuite completely">
        <button
          onClick={() => quitApp()}
          className="flex w-full items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2 text-xs font-medium text-red-400 transition-opacity hover:opacity-80"
        >
          <LogOut className="h-3.5 w-3.5" />
          Quit PopSuite
          <span className="ml-auto text-xs opacity-60">{isMac() ? "Cmd+Q" : "Ctrl+Q"}</span>
        </button>
      </SettingGroup>
    </SettingsUIProvider>
  );
}

/**
 * Situational Presets page (Pro): suite-only, neither module contributes.
 *
 * Always mounted (even when another leaf is showing) and merely hidden via CSS
 * when `visible` is false, so its tray-apply IPC listener + preset-index sync
 * stay live regardless of the active page. This is what lets a tray "Apply
 * preset" work while the window sits on any other page — including a hidden
 * apply-only window that never shows a page at all.
 */
function SuitePresetsBlock({ isPro, visible }: { isPro: boolean; visible: boolean }) {
  return (
    <div style={visible ? undefined : { display: "none" }}>
      <SettingsUIProvider density="compact" palette={getSurfacePalette(true)}>
        <SuitePresets apps={SUITE_APPS} isPro={isPro} buyUrl={SUITE_PRO_URL} />
      </SettingsUIProvider>
    </div>
  );
}

/** App name label above each module's block on the combined pages. */
function AppLabel({ name }: { name: string }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">
        {name}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function SettingsApp() {
  const [state, setState] = useState<SettingsState | null>(null);
  const [leaf, setLeaf] = useState<LeafId>("popjot-appearance");
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getLicenseStatus().then((status) => {
      if (mounted) setIsPro(status.isPro);
    });
    const unsubscribe = onLicenseChange((status) => setIsPro(status.isPro));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void window.suiteSettings.getState().then((next) => {
      if (!mounted) return;
      setState(next);
      // Tray "Open Settings" on a specific app lands on that app's first page.
      setLeaf(next.activeId === "popkey" ? "popkey-appearance" : "popjot-appearance");
    });
    const unsubscribe = window.suiteSettings.onStateChanged((next) => {
      if (mounted) setState(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!state) {
    return <div className="h-screen w-screen bg-[#202020]" />;
  }

  const config = LEAVES[leaf];
  const combined = config.popjot !== null && config.popkey !== null;
  const connected = (id: ModuleId) =>
    state.tabs.find((tab) => tab.id === id)?.connected ?? false;

  return (
    <TooltipProvider>
     <SettingsUIProvider density="compact" palette={getSurfacePalette(true)}>
      <ToastProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#202020] text-white">
        <header
          className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
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
            onClick={() => window.suiteSettings.close()}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
                      {group.moduleId && !connected(group.moduleId) && (
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
              onClick={() => window.suiteSettings.close()}
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
                keeps that module's store, sync hooks, and relay seed alive.
                The capture handlers point the preload's shared electronAPI
                router at whichever module the user is interacting with —
                required on combined pages where both panels are live. */}
            <div
              className={combined && config.popjot ? "mb-8" : undefined}
              onPointerDownCapture={() => window.suiteSettings.select("popjot")}
              onFocusCapture={() => window.suiteSettings.select("popjot")}
            >
              {combined && <AppLabel name="PopJot" />}
              <PopJotPanel section={config.popjot} />
            </div>
            <div
              onPointerDownCapture={() => window.suiteSettings.select("popkey")}
              onFocusCapture={() => window.suiteSettings.select("popkey")}
            >
              {combined && <AppLabel name="PopKey" />}
              <PopKeyPanel section={config.popkey} />
            </div>
            {leaf === "system" && (
              <>
                {combined && <AppLabel name="PopSuite" />}
                <SuiteSystemBlock />
              </>
            )}
            {/* Always mounted so its tray-apply listener stays live on every
                page; only shown on the presets leaf. */}
            <SuitePresetsBlock isPro={isPro} visible={leaf === "presets"} />
          </main>
        </div>
      </div>
      </ToastProvider>
     </SettingsUIProvider>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")!).render(<SettingsApp />);
