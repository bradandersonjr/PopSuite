import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "path";
import { rmSync } from "fs";

// Isolate ~/.popsuite to a temp dir by pointing os.homedir() at it.
const TMP = join(process.env.TEMP || process.env.TMP || ".", `popsuite-test-${process.pid}`);
vi.mock("os", () => ({ homedir: () => TMP, default: { homedir: () => TMP } }));

// Capture the IPC handlers each app registers, and the watcher callbacks, so we
// can drive toggles + "the other app changed the file" deterministically.
const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock("electron", () => ({
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => ipcHandlers.set(ch, fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => ipcHandlers.set(ch, fn),
    removeHandler: (ch: string) => ipcHandlers.delete(ch),
    removeAllListeners: (ch: string) => ipcHandlers.delete(ch),
  },
}));

const watchCbs: Array<() => void> = [];
vi.mock("../settings/persistence", async (importActual) => {
  const actual = await importActual<typeof import("../settings/persistence")>();
  return {
    ...actual,
    watchSettingsFile: (_name: string, cb: () => void) => {
      watchCbs.push(cb);
      return () => {};
    },
  };
});

import { setting } from "../settings/schema";
import {
  loadAppSettings,
  saveAppSettings,
  saveSharedSync,
  loadSharedSync,
  updateSharedSync,
} from "../settings/persistence";
import { createSettingsSync } from "./settingsSync";

// Mini schemas: themeMode + colorPalette are syncable; the third key is
// app-specific (not in SYNCABLE_KEYS) and must stay independent.
const keySchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(["retro", "neon"], "retro"),
  badgeStyle: setting.enum(["flat", "pop"], "flat"),
} as const;
const jotSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(["retro", "neon"], "retro"),
  menuStyle: setting.enum(["flat", "pop"], "pop"),
} as const;

beforeEach(() => {
  rmSync(join(TMP, ".popsuite"), { recursive: true, force: true });
  ipcHandlers.clear();
  watchCbs.length = 0;
  vi.useRealTimers();
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("per-app persistence (data-loss bug fix)", () => {
  it("keeps each app's settings in its own file — one app's save never wipes the other's", () => {
    saveAppSettings("PopKey", { themeMode: "dark", badgeStyle: "pop" });
    saveAppSettings("PopJot", { themeMode: "light", menuStyle: "flat" });

    // PopJot's save must NOT have clobbered PopKey's app-specific keys.
    expect(loadAppSettings("PopKey")).toEqual({ themeMode: "dark", badgeStyle: "pop" });
    expect(loadAppSettings("PopJot")).toEqual({ themeMode: "light", menuStyle: "flat" });
  });
});

describe("shared file read-modify-write", () => {
  it("preserves existing keys when one key is updated", () => {
    updateSharedSync((f) => {
      f.prefs.themeMode = true;
      f.values.themeMode = "dark";
    });
    updateSharedSync((f) => {
      f.values.colorPalette = "neon";
    });
    const shared = loadSharedSync();
    expect(shared.values).toEqual({ themeMode: "dark", colorPalette: "neon" });
    expect(shared.prefs.themeMode).toBe(true);
  });
});

describe("initial values", () => {
  it("merges per-app file with synced overrides for enabled keys only", () => {
    saveAppSettings("PopKey", { themeMode: "light", badgeStyle: "pop" });
    saveSharedSync({ prefs: { themeMode: true }, values: { themeMode: "dark", colorPalette: "neon" } });

    const vals: Record<string, unknown> = {};
    const sync = createSettingsSync({
      appName: "PopKey",
      schema: keySchema,
      sendToRenderers: () => {},
      getValues: () => vals as never,
    });

    // themeMode is synced+enabled → shared value wins ("dark", not the app file's "light").
    // colorPalette has no pref → ignored even though present in shared values.
    // badgeStyle comes from the per-app file.
    expect(sync.initialValues).toEqual({ themeMode: "dark", badgeStyle: "pop" });
  });
});

describe("cross-app sync", () => {
  function makeApp(appName: string, schema: typeof keySchema | typeof jotSchema, vals: Record<string, unknown>) {
    const sent: Array<[string, unknown]> = [];
    const sync = createSettingsSync({
      appName,
      schema,
      sendToRenderers: (ch, v) => sent.push([ch, v]),
      getValues: () => vals as never,
    });
    ipcHandlers.clear();
    sync.start();
    const handlers = new Map(ipcHandlers);
    const watchCb = watchCbs[watchCbs.length - 1];
    return { sync, sent, handlers, watchCb, vals };
  }

  it("enabling a key in one app makes the other adopt that app's value", () => {
    const A = makeApp("PopKey", keySchema, { themeMode: "dark", colorPalette: "retro", badgeStyle: "flat" });
    const B = makeApp("PopJot", jotSchema, { themeMode: "light", colorPalette: "retro", menuStyle: "pop" });

    // User flips Theme Mode → ON in PopKey (via the set-sync-pref IPC).
    A.handlers.get("set-sync-pref")!(null, "themeMode", true);

    // PopKey seeded the shared value from its own state ("dark").
    expect(loadSharedSync()).toMatchObject({ prefs: { themeMode: true }, values: { themeMode: "dark" } });

    // PopJot's watcher fires → it adopts PopKey's value and re-broadcasts.
    B.watchCb();
    expect(B.vals.themeMode).toBe("dark");
    expect(B.sent).toContainEqual(["sync-prefs-changed", { themeMode: true, colorPalette: false }]);
    expect(B.sent.some(([ch, v]) => ch === "tray-set-theme-mode" && v === "dark")).toBe(true);
  });

  it("a synced value change propagates; an unsynced key stays independent", async () => {
    vi.useFakeTimers();
    const A = makeApp("PopKey", keySchema, { themeMode: "dark", colorPalette: "retro", badgeStyle: "flat" });
    const B = makeApp("PopJot", jotSchema, { themeMode: "dark", colorPalette: "retro", menuStyle: "pop" });

    // Enable themeMode sync on both ends.
    A.handlers.get("set-sync-pref")!(null, "themeMode", true);
    B.handlers.get("set-sync-pref")!(null, "themeMode", true);

    // PopKey changes a SYNCED key.
    A.vals.themeMode = "light";
    A.sync.onLocalChange("themeMode", "light");
    // PopKey changes an UNSYNCED app-specific key.
    A.vals.badgeStyle = "pop";
    A.sync.onLocalChange("badgeStyle", "pop");

    vi.advanceTimersByTime(500); // flush debounced writes

    const shared = loadSharedSync();
    expect(shared.values.themeMode).toBe("light"); // synced value written
    expect("badgeStyle" in shared.values).toBe(false); // unsynced never enters shared file

    // PopJot adopts the synced value; nothing about badgeStyle reaches it.
    B.watchCb();
    expect(B.vals.themeMode).toBe("light");

    // PopKey's own file persisted the unsynced key.
    expect(loadAppSettings("PopKey")).toMatchObject({ badgeStyle: "pop", themeMode: "light" });
  });
});
