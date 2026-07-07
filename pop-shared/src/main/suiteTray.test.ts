import { describe, expect, it, vi } from "vitest";
import {
  buildSuiteTrayMenu,
  encodeFrame,
  decodeFrames,
  type SuiteModuleState,
  type SuiteTrayHandlers,
  type SuiteMenuItem,
  type LauncherToModule,
} from "./suiteTray";

function makeModule(overrides: Partial<SuiteModuleState> = {}): SuiteModuleState {
  return {
    appName: "PopJot",
    active: true,
    shortcuts: ["Alt+Shift+A"],
    canToggle: true,
    actions: [{ id: "settings", label: "Open Settings" }],
    ...overrides,
  };
}

function noopHandlers(): SuiteTrayHandlers {
  return { onToggle: vi.fn(), onAction: vi.fn(), onQuitAll: vi.fn() };
}

/** Depth-first list of labels for shallow structural assertions. */
function labels(items: SuiteMenuItem[]): string[] {
  return items.map((i) => i.label ?? `<${i.type}>`);
}

describe("buildSuiteTrayMenu", () => {
  it("shows a coherent menu with no modules connected", () => {
    const menu = buildSuiteTrayMenu([], noopHandlers());
    expect(labels(menu)).toEqual([
      "PopSuite",
      "<separator>",
      "No modules running",
      "<separator>",
      "Quit All",
    ]);
  });

  it("builds a toggle checkbox per module with shortcut hint and checked state", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopJot", active: true, shortcuts: ["Alt+Shift+A"] })],
      noopHandlers()
    );
    const toggle = menu.find((i) => i.type === "checkbox");
    expect(toggle).toBeDefined();
    expect(toggle!.checked).toBe(true);
    expect(toggle!.label).toContain("Disable PopJot");
    expect(toggle!.label).toContain("Alt+Shift+A");
  });

  it("labels an inactive module as Enable and leaves the checkbox unchecked", () => {
    const menu = buildSuiteTrayMenu([makeModule({ active: false })], noopHandlers());
    const toggle = menu.find((i) => i.type === "checkbox")!;
    expect(toggle.checked).toBe(false);
    expect(toggle.label).toContain("Enable PopJot");
  });

  it("orders modules stably regardless of input order", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey" }), makeModule({ appName: "PopJot" })],
      noopHandlers()
    );
    const toggles = menu.filter((i) => i.type === "checkbox").map((i) => i.label);
    expect(toggles[0]).toContain("PopJot");
    expect(toggles[1]).toContain("PopKey");
  });

  it("groups a module's extra actions into its own submenu", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ actions: [{ id: "settings", label: "Open Settings" }, { id: "about", label: "About" }] })],
      noopHandlers()
    );
    const submenuItem = menu.find((i) => i.submenu);
    expect(submenuItem?.label).toBe("PopJot Options");
    expect(labels(submenuItem!.submenu!)).toEqual(["Open Settings", "About"]);
  });

  it("wires toggle / action / quit clicks to the handlers with the right args", () => {
    const handlers = noopHandlers();
    const menu = buildSuiteTrayMenu([makeModule({ appName: "PopKey" })], handlers);

    menu.find((i) => i.type === "checkbox")!.click!();
    expect(handlers.onToggle).toHaveBeenCalledWith("PopKey");

    menu.find((i) => i.submenu)!.submenu![0].click!();
    expect(handlers.onAction).toHaveBeenCalledWith("PopKey", "settings");

    menu.find((i) => i.label === "Quit All")!.click!();
    expect(handlers.onQuitAll).toHaveBeenCalledTimes(1);
  });

  it("marks an auto-suppressed module's toggle label with (auto-hidden)", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey", active: true, autoSuppressed: true })],
      noopHandlers()
    );
    const toggle = menu.find((i) => i.type === "checkbox")!;
    // Checkbox still reflects the user's own requested state (active)...
    expect(toggle.checked).toBe(true);
    // ...but the label flags that a sibling is forcing it hidden.
    expect(toggle.label).toContain("(auto-hidden)");
  });

  it("does not add (auto-hidden) when a module is not suppressed", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ appName: "PopKey", autoSuppressed: undefined })],
      noopHandlers()
    );
    const toggle = menu.find((i) => i.type === "checkbox")!;
    expect(toggle.label).not.toContain("(auto-hidden)");
  });

  it("renders a non-toggling module as a disabled heading", () => {
    const menu = buildSuiteTrayMenu(
      [makeModule({ canToggle: false, toggleLabel: undefined })],
      noopHandlers()
    );
    expect(menu.some((i) => i.type === "checkbox")).toBe(false);
    const heading = menu.find((i) => i.label === "PopJot");
    expect(heading?.enabled).toBe(false);
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
});
