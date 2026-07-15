/**
 * Regression coverage for the suite Settings seed-routing bug.
 *
 * In the unified Settings window a single `window.electronAPI` serves BOTH
 * module panels, and its generated `onTrayMenuChange` resolves the IPC
 * namespace from a mutable `activeId`. On first load `activeId` is "popjot", so
 * without an override the PopKey panel would subscribe on PopJot's namespace and
 * never receive its own seed pushes — leaving PopKey's store at schema defaults,
 * which presets then capture. The fix threads a module-FIXED `subscribe` into
 * the hook so each panel binds to its own namespace regardless of `activeId`.
 *
 * These tests assert the contract the fix relies on:
 *   - when a `subscribe` override is passed, the hook subscribes exclusively
 *     through it (never the activeId-routed platform), once per schema key;
 *   - a value delivered on that subscription updates the matching store setter.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setting, trayChannel } from "@shared/settings/schema";
import { useTraySettingsSync } from "./useTraySettingsSync";

const schema = {
  themeMode: setting.enum(["light", "dark"], "dark"),
  radius: setting.number(8),
};

beforeEach(() => {
  // isDesktop() gates the hook; it needs window.electronAPI present.
  (window as unknown as { electronAPI: unknown }).electronAPI = {};
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  vi.restoreAllMocks();
});

describe("useTraySettingsSync module-fixed subscribe", () => {
  it("subscribes through the override for every non-volatile key and updates the store", () => {
    const setThemeMode = vi.fn();
    const setRadius = vi.fn();
    const store = { getState: () => ({ setThemeMode, setRadius } as never) };

    // Capture each channel's delivery callback so we can push a value in.
    const delivered = new Map<string, (value: unknown) => void>();
    const unsub = vi.fn();
    const subscribe = vi.fn((channel: string, cb: (value: unknown) => void) => {
      delivered.set(channel, cb);
      return unsub;
    });

    renderHook(() => useTraySettingsSync(schema, store, subscribe));

    // Every schema key subscribes through the override, on its bare trayChannel
    // (the module namespace is applied by the override, not here).
    const channels = subscribe.mock.calls.map((c) => c[0]);
    expect(channels).toEqual(
      expect.arrayContaining([trayChannel("themeMode"), trayChannel("radius")]),
    );

    // A push on the module-fixed channel routes into the matching setter.
    delivered.get(trayChannel("themeMode"))?.("light");
    expect(setThemeMode).toHaveBeenCalledWith("light");
    delivered.get(trayChannel("radius"))?.(16);
    expect(setRadius).toHaveBeenCalledWith(16);
  });

  it("does not fall back to the activeId-routed platform when an override is given", () => {
    const onTrayMenuChange = vi.fn(() => () => {});
    (window as unknown as { electronAPI: unknown }).electronAPI = { onTrayMenuChange };
    const store = { getState: () => ({ setThemeMode: vi.fn(), setRadius: vi.fn() } as never) };
    const subscribe = vi.fn(() => () => {});

    renderHook(() => useTraySettingsSync(schema, store, subscribe));

    // The platform's onTrayMenuChange (which would resolve the wrong namespace)
    // must never be touched when a module-fixed subscribe is supplied.
    expect(onTrayMenuChange).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(Object.keys(schema).length);
  });

  it("unsubscribes every listener on unmount", () => {
    const unsub = vi.fn();
    const subscribe = vi.fn(() => unsub);
    const store = { getState: () => ({ setThemeMode: vi.fn(), setRadius: vi.fn() } as never) };

    const { unmount } = renderHook(() => useTraySettingsSync(schema, store, subscribe));
    const attached = subscribe.mock.calls.length;
    unmount();
    expect(unsub).toHaveBeenCalledTimes(attached);
  });
});
