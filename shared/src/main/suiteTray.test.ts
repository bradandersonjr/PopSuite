import { describe, expect, it, vi } from "vitest";
import {
  buildSuiteTrayMenu,
  encodeFrame,
  decodeFrames,
  SUITE_CHANGELOG_URL,
  SUITE_DOCS_URL,
  SUITE_PRESET_DEFAULT_ID,
  type SuiteModuleState,
  type SuiteTrayHandlers,
  type SuiteTrayMenuOptions,
  type SuiteMenuItem,
  type LauncherToModule,
  type ModuleToLauncher,
} from "./suiteTray";

function makeModule(overrides: Partial<SuiteModuleState> = {}): SuiteModuleState {
  return {
    appName: "PopJot",
    active: true,
    shortcuts: ["Alt+Shift+A"],
    canToggle: true,
    actions: [
      { id: "settings", label: "Settings" },
      { id: "about", label: "About" },
    ],
    ...overrides,
  };
}

function noopHandlers(): SuiteTrayHandlers {
  return {
    onToggle: vi.fn(),
    onAction: vi.fn(),
    onOpenAtLoginToggle: vi.fn(),
    onOpenLink: vi.fn(),
    onAbout: vi.fn(),
    onCheckForUpdates: vi.fn(),
    onInstallUpdate: vi.fn(),
    onQuitAll: vi.fn(),
    onApplyPreset: vi.fn(),
  };
}

function opts(overrides: Partial<SuiteTrayMenuOptions> = {}): SuiteTrayMenuOptions {
  return { launcherOpenAtLogin: false, ...overrides };
}

/** Depth-first list of labels for shallow structural assertions. */
function labels(items: SuiteMenuItem[]): string[] {
  return items.map((i) => i.label ?? `<${i.type}>`);
}

describe("buildSuiteTrayMenu", () => {
  it("shows a coherent menu with no modules connected", () => {
    const menu = buildSuiteTrayMenu([], noopHandlers(), opts());
    // Module-dependent section collapses to a disabled line; the launcher-local
    // items (Launch Preferences / links / Quit) are always present.
    expect(labels(menu)).toEqual([
      "PopSuite",
      "<separator>",
      "No modules running",
      "About PopSuite",
      "<separator>",
      "Launch Preferences",
      "<separator>",
      "Changelog",
      "Documentation",
      "<separator>",
      "Quit PopSuite",
    ]);
  });

  it("builds a flat toggle checkbox per module with checked state (no shortcut hint)", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopJot", active: true, shortcuts: ["Alt+Shift+A"] })],
      noopHandlers(),
      opts()
    );
    const toggle = menu.find((i) => i.type === "checkbox" && i.label?.includes("PopJot"));
    expect(toggle).toBeDefined();
    expect(toggle!.checked).toBe(true);
    expect(toggle!.label).toContain("Disable PopJot");
    expect(toggle!.label).not.toContain("Alt+Shift+A");
  });

  it("labels an inactive module as Enable and leaves the checkbox unchecked", () => {
    const menu = buildSuiteTrayMenu([makeModule({ active: false })], noopHandlers(), opts());
    const toggle = menu.find((i) => i.type === "checkbox" && i.label?.includes("PopJot"))!;
    expect(toggle.checked).toBe(false);
    expect(toggle.label).toContain("Enable PopJot");
  });

  it("puts flat toggles directly under the title in stable order", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey" }), makeModule({ appName: "PopJot" })],
      noopHandlers(),
      opts()
    );
    // The two checkboxes are the first two items after the title separator.
    expect(menu[0].label).toBe("PopSuite");
    expect(menu[1].type).toBe("separator");
    expect(menu[2].type).toBe("checkbox");
    expect(menu[2].label).toContain("PopJot");
    expect(menu[3].type).toBe("checkbox");
    expect(menu[3].label).toContain("PopKey");
  });

  it("shows a single Settings item when any module offers settings", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey" }), makeModule({ appName: "PopJot" })],
      noopHandlers(),
      opts()
    );
    const settings = menu.find((i) => i.label === "Settings");
    expect(settings).toBeDefined();
    expect(settings?.submenu).toBeUndefined();
  });

  it("wires the Settings item to open the launcher's single settings window", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([makeModule({ appName: "PopKey" })], handlers, opts());
    const settings = menu.find((i) => i.label === "Settings")!;
    settings.click!();
    // Opens the launcher's unified settings window (empty appName = launcher handles default).
    expect(handlers.onAction).toHaveBeenCalledWith("", "settings");
  });

  it("shows a single About PopSuite item wired to onAbout", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey" }), makeModule({ appName: "PopJot" })],
      handlers,
      opts()
    );
    // Exactly one About item, product-level, not per module.
    const abouts = menu.filter((i) => i.label?.startsWith("About"));
    expect(labels(abouts)).toEqual(["About PopSuite"]);
    abouts[0].click!();
    expect(handlers.onAbout).toHaveBeenCalledTimes(1);
  });

  it("shows Launch Preferences with a login checkbox reflecting the passed-in state", () => {
    const off = buildSuiteTrayMenu([], noopHandlers(), opts({ launcherOpenAtLogin: false }));
    const offItem = off
      .find((i) => i.label === "Launch Preferences")!
      .submenu!.find((i) => i.label === "Open PopSuite at Login")!;
    expect(offItem.type).toBe("checkbox");
    expect(offItem.checked).toBe(false);

    const on = buildSuiteTrayMenu([], noopHandlers(), opts({ launcherOpenAtLogin: true }));
    const onItem = on
      .find((i) => i.label === "Launch Preferences")!
      .submenu!.find((i) => i.label === "Open PopSuite at Login")!;
    expect(onItem.checked).toBe(true);
  });

  it("puts a Check for Updates item in the Launch Preferences submenu wired to onCheckForUpdates", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([], handlers, opts());
    const prefs = menu.find((i) => i.label === "Launch Preferences")!;
    const check = prefs.submenu!.find((i) => i.label === "Check for Updates")!;
    expect(check).toBeDefined();
    check.click!();
    expect(handlers.onCheckForUpdates).toHaveBeenCalledTimes(1);
  });

  it("omits the Restart to Update item when no update is staged", () => {
    const menu = buildSuiteTrayMenu([], noopHandlers(), opts());
    expect(menu.some((i) => i.label?.startsWith("Restart to Update"))).toBe(false);
  });

  it("shows a Restart to Update item with the version just above Quit when an update is ready", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([], handlers, opts({ updateReady: { version: "1.1.0" } }));
    const idx = menu.findIndex((i) => i.label === "Restart to Update (1.1.0)");
    expect(idx).toBeGreaterThanOrEqual(0);
    // Sits directly above Quit PopSuite.
    expect(menu[idx + 1].label).toBe("Quit PopSuite");
    menu[idx].click!();
    expect(handlers.onInstallUpdate).toHaveBeenCalledTimes(1);
  });

  it("wires the login toggle to onOpenAtLoginToggle", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([], handlers, opts());
    menu
      .find((i) => i.label === "Launch Preferences")!
      .submenu!.find((i) => i.label === "Open PopSuite at Login")!
      .click!();
    expect(handlers.onOpenAtLoginToggle).toHaveBeenCalledTimes(1);
  });

  it("shows Changelog / Documentation wired to the hardcoded suite URLs", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([], handlers, opts());

    menu.find((i) => i.label === "Changelog")!.click!();
    expect(handlers.onOpenLink).toHaveBeenCalledWith(SUITE_CHANGELOG_URL);
    expect(SUITE_CHANGELOG_URL).toBe("https://popjot.app/changelog");

    menu.find((i) => i.label === "Documentation")!.click!();
    expect(handlers.onOpenLink).toHaveBeenCalledWith(SUITE_DOCS_URL);
    expect(SUITE_DOCS_URL).toBe("https://popjot.app/docs");
  });

  it("wires toggle and Quit PopSuite clicks to the handlers", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([makeModule({ appName: "PopKey" })], handlers, opts());

    menu.find((i) => i.type === "checkbox" && i.label?.includes("PopKey"))!.click!();
    expect(handlers.onToggle).toHaveBeenCalledWith("PopKey");

    menu.find((i) => i.label === "Quit PopSuite")!.click!();
    expect(handlers.onQuitAll).toHaveBeenCalledTimes(1);
  });

  it("marks an auto-suppressed module's toggle label with (auto-hidden)", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey", active: true, autoSuppressed: true })],
      noopHandlers(),
      opts()
    );
    const toggle = menu.find((i) => i.type === "checkbox" && i.label?.includes("PopKey"))!;
    // Checkbox still reflects the user's own requested state (active)...
    expect(toggle.checked).toBe(true);
    // ...but the label flags that a sibling is forcing it hidden.
    expect(toggle.label).toContain("(auto-hidden)");
  });

  it("does not add (auto-hidden) when a module is not suppressed", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey", autoSuppressed: undefined })],
      noopHandlers(),
      opts()
    );
    const toggle = menu.find((i) => i.type === "checkbox" && i.label?.includes("PopKey"))!;
    expect(toggle.label).not.toContain("(auto-hidden)");
  });

  it("renders a non-toggling module as a disabled heading", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ canToggle: false, toggleLabel: undefined })],
      noopHandlers(),
      opts()
    );
    expect(menu.some((i) => i.type === "checkbox")).toBe(false);
    const heading = menu.find((i) => i.label === "PopJot");
    expect(heading?.enabled).toBe(false);
  });

  describe("Situational Presets (Pro)", () => {
    it("omits the Presets submenu entirely for non-Pro users", () => {
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        noopHandlers(),
        opts({ presets: { isPro: false, saved: [{ id: "a", name: "Fusion" }] } })
      );
      expect(menu.some((i) => i.label === "Presets")).toBe(false);
    });

    it("shows a Presets submenu with only Default when no presets are saved", () => {
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        noopHandlers(),
        opts({ presets: { isPro: true, saved: [] } })
      );
      const presets = menu.find((i) => i.label === "Presets");
      expect(presets?.submenu?.map((i) => i.label ?? `<${i.type}>`)).toEqual([
        "Default",
      ]);
    });

    it("lists Default then a separator then each saved preset", () => {
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        noopHandlers(),
        opts({
          presets: {
            isPro: true,
            saved: [
              { id: "a", name: "Fusion" },
              { id: "b", name: "Recording" },
            ],
          },
        })
      );
      const presets = menu.find((i) => i.label === "Presets");
      expect(presets?.submenu?.map((i) => i.label ?? `<${i.type}>`)).toEqual([
        "Default",
        "<separator>",
        "Fusion",
        "Recording",
      ]);
    });

    it("appears directly after About PopSuite", () => {
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        noopHandlers(),
        opts({ presets: { isPro: true, saved: [] } })
      );
      const aboutIdx = menu.findIndex((i) => i.label === "About PopSuite");
      // About, then a separator, then the Presets submenu.
      expect(menu[aboutIdx + 1]?.type).toBe("separator");
      expect(menu[aboutIdx + 2]?.label).toBe("Presets");
    });

    it("wires Default to onApplyPreset with the default sentinel", () => {
      const handlers = noopHandlers();
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        handlers,
        opts({ presets: { isPro: true, saved: [] } })
      );
      const presets = menu.find((i) => i.label === "Presets");
      presets?.submenu?.find((i) => i.label === "Default")?.click?.();
      expect(handlers.onApplyPreset).toHaveBeenCalledWith(SUITE_PRESET_DEFAULT_ID);
    });

    it("wires a saved preset to onApplyPreset with its id", () => {
      const handlers = noopHandlers();
      const menu = buildSuiteTrayMenu(
        [makeModule()],
        handlers,
        opts({ presets: { isPro: true, saved: [{ id: "xyz", name: "Fusion" }] } })
      );
      const presets = menu.find((i) => i.label === "Presets");
      presets?.submenu?.find((i) => i.label === "Fusion")?.click?.();
      expect(handlers.onApplyPreset).toHaveBeenCalledWith("xyz");
    });
  });
});

describe("frame encode/decode", () => {
  it("round-trips a single message", () => {
    const frame = encodeFrame({ type: "toggle" });
    expect(frame.endsWith("\n")).toBe(true);
    const { messages, rest } = decodeFrames<LauncherToModule>("", frame);
    expect(messages).toEqual([{ type: "toggle" }]);
    expect(rest).toBe("");
  });

  it("splits multiple messages in one chunk", () => {
    const chunk = encodeFrame({ type: "toggle" }) + encodeFrame({ type: "action", id: "x" });
    const { messages, rest } = decodeFrames<LauncherToModule>("", chunk);
    expect(messages).toHaveLength(2);
    expect(rest).toBe("");
  });

  it("buffers a partial trailing frame until completed", () => {
    const full = encodeFrame({ type: "action", id: "settings" });
    const cut = Math.floor(full.length / 2);
    const first = decodeFrames<LauncherToModule>("", full.slice(0, cut));
    expect(first.messages).toEqual([]);
    expect(first.rest).toBe(full.slice(0, cut));

    const second = decodeFrames<LauncherToModule>(first.rest, full.slice(cut));
    expect(second.messages).toEqual([{ type: "action", id: "settings" }]);
    expect(second.rest).toBe("");
  });

  it("skips a malformed frame without dropping following valid ones", () => {
    const chunk = "not json\n" + encodeFrame({ type: "quit" });
    const { messages } = decodeFrames<LauncherToModule>("", chunk);
    expect(messages).toEqual([{ type: "quit" }]);
  });

  it("round-trips the settings-relay launcher→module messages", () => {
    const send = encodeFrame({ type: "relaySend", channel: "set-theme-mode", args: ["dark"] });
    expect(decodeFrames<LauncherToModule>("", send).messages).toEqual([
      { type: "relaySend", channel: "set-theme-mode", args: ["dark"] },
    ]);

    const invoke = encodeFrame({ type: "relayInvoke", id: 7, channel: "get-shortcuts", args: [] });
    expect(decodeFrames<LauncherToModule>("", invoke).messages).toEqual([
      { type: "relayInvoke", id: 7, channel: "get-shortcuts", args: [] },
    ]);
  });

  it("round-trips the settings-relay module→launcher messages", () => {
    const result = encodeFrame({ type: "relayInvokeResult", id: 7, result: { a: 1 } });
    expect(decodeFrames<ModuleToLauncher>("", result).messages).toEqual([
      { type: "relayInvokeResult", id: 7, result: { a: 1 } },
    ]);

    const push = encodeFrame({ type: "relayPush", channel: "tray-set-theme-mode", args: ["dark"] });
    expect(decodeFrames<ModuleToLauncher>("", push).messages).toEqual([
      { type: "relayPush", channel: "tray-set-theme-mode", args: ["dark"] },
    ]);
  });
});
