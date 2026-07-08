/**
 * End-to-end smoke test of the suite-tray pipe: a real net server + client talk
 * over a temp pipe/socket, exercising connect, state reporting, command relay,
 * and disconnect fallback. No Electron involved.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "path";
import { createSuiteTrayServer, type SuiteTrayServer } from "./suiteTrayServer";
import { createSuiteTrayClient, type SuiteTrayClient } from "./suiteTrayClient";
import type { SuiteModuleState } from "./suiteTray";

// Unique per-run pipe path so parallel/retried runs never collide.
function pipePath(): string {
  const id = `popsuite-test-${process.pid}-${Math.random().toString(36).slice(2)}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${id}`
    : join(process.env.TMPDIR || "/tmp", `${id}.sock`);
}

function state(overrides: Partial<SuiteModuleState> = {}): SuiteModuleState {
  return {
    appName: "PopJot",
    active: true,
    shortcuts: ["Alt+Shift+A"],
    canToggle: true,
    actions: [{ id: "settings", label: "Open Settings" }],
    ...overrides,
  };
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

/** Wait until `pred()` is true or time out (polling; avoids fixed sleeps). */
async function until(pred: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("suite-tray IPC", () => {
  it("reports module state to the server on connect", async () => {
    const path = pipePath();
    const onChange = vi.fn();
    const server = createSuiteTrayServer(onChange, path);
    cleanups.push(() => server.dispose());

    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopKey", active: false }));

    await until(() => server.getModules().length === 1);
    const mods = server.getModules();
    expect(mods[0].appName).toBe("PopKey");
    expect(mods[0].active).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });

  it("relays toggle and action commands to the correct module", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const onToggle = vi.fn();
    const onAction = vi.fn();
    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle, onAction, onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopJot" }));
    await until(() => server.getModules().length === 1);

    server.toggle("PopJot");
    await until(() => onToggle.mock.calls.length === 1);

    server.action("PopJot", "settings");
    await until(() => onAction.mock.calls.length === 1);
    expect(onAction).toHaveBeenCalledWith("settings");
  });

  it("relays a suppress command to the named module", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const suppressCalls: boolean[] = [];
    let ready = false;
    const client = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onSuppress: (s) => suppressCalls.push(s),
      },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopKey" }));
    await until(() => server.getModules().length === 1);

    server.suppress("PopKey", true);
    await until(() => suppressCalls.length === 1);
    expect(suppressCalls[0]).toBe(true);

    server.suppress("PopKey", false);
    await until(() => suppressCalls.length === 2);
    expect(suppressCalls[1]).toBe(false);
  });

  it("carries the annotating flag through a reported state", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopJot", annotating: true }));
    await until(() => server.getModules().length === 1);
    expect(server.getModules()[0].annotating).toBe(true);
  });

  it("relays an openSettings command with bounds to the named module", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const openCalls: Array<{ x: number; y: number; width: number; height: number }> = [];
    let ready = false;
    const client = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onOpenSettings: (bounds) => openCalls.push(bounds),
      },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopKey" }));
    await until(() => server.getModules().length === 1);

    const bounds = { x: 100, y: 120, width: 1160, height: 860 };
    const sent = server.openSettingsAt("PopKey", bounds);
    expect(sent).toBe(true);
    await until(() => openCalls.length === 1);
    expect(openCalls[0]).toEqual(bounds);
  });

  it("openSettingsAt returns false when the target module is not connected", () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());
    // Nobody connected: a swap request for a dead sibling is a no-op the caller
    // can detect, so the requesting side keeps its own settings window.
    expect(server.openSettingsAt("PopKey", { x: 0, y: 0, width: 900, height: 680 })).toBe(false);
  });

  it("fires the launcher onRequest hook with the delivered flag for a swap request", async () => {
    const path = pipePath();
    const requests: Array<{ msg: unknown; delivered: boolean }> = [];
    const server = createSuiteTrayServer(vi.fn(), path, (msg, delivered) =>
      requests.push({ msg, delivered })
    );
    cleanups.push(() => server.dispose());

    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    // No sibling connected: the launcher hook sees delivered=false.
    const bounds = { x: 50, y: 60, width: 1160, height: 860 };
    client.requestSiblingSettings("PopKey", bounds);
    await until(() => requests.length === 1);
    expect(requests[0].msg).toEqual({ type: "requestSiblingSettings", target: "PopKey", bounds });
    expect(requests[0].delivered).toBe(false);
  });

  it("end-to-end: a swap request opens the sibling's settings and acks the requester delivered", async () => {
    const path = pipePath();
    // The server relays + acks internally now; no launcher policy needed.
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    // PopJot: the requester (receives the ack). PopKey: the sibling (opens settings).
    const openOnPopKey: Array<{ width: number }> = [];
    const acksOnPopJot: Array<{ target: string; delivered: boolean }> = [];
    let popjotReady = false;
    let popkeyReady = false;
    const popjot = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onSiblingSettingsResult: (target, delivered) => acksOnPopJot.push({ target, delivered }),
      },
      { onReady: () => (popjotReady = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => popjot.dispose());
    const popkey = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onOpenSettings: (b) => openOnPopKey.push(b),
      },
      { onReady: () => (popkeyReady = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => popkey.dispose());

    await until(() => popjotReady && popkeyReady);
    popjot.report(state({ appName: "PopJot" }));
    popkey.report(state({ appName: "PopKey" }));
    await until(() => server.getModules().length === 2);

    popjot.requestSiblingSettings("PopKey", { x: 0, y: 0, width: 1160, height: 860 });
    await until(() => openOnPopKey.length === 1 && acksOnPopJot.length === 1);
    expect(openOnPopKey[0].width).toBe(1160);
    expect(acksOnPopJot[0]).toEqual({ target: "PopKey", delivered: true });
  });

  it("acks the requester delivered=false when the sibling isn't running (never zero windows)", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const acks: Array<{ target: string; delivered: boolean }> = [];
    let ready = false;
    const client = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onSiblingSettingsResult: (target, delivered) => acks.push({ target, delivered }),
      },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopJot" }));
    await until(() => server.getModules().length === 1);

    // Sibling "PopKey" never connected: the requester is told delivered=false so
    // it keeps its own settings window.
    client.requestSiblingSettings("PopKey", { x: 0, y: 0, width: 900, height: 680 });
    await until(() => acks.length === 1);
    expect(acks[0]).toEqual({ target: "PopKey", delivered: false });
  });

  it("quitAll asks every connected module to quit", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const quits: string[] = [];
    for (const name of ["PopJot", "PopKey"]) {
      let ready = false;
      const client = createSuiteTrayClient(
        { onToggle: vi.fn(), onAction: vi.fn(), onQuit: () => quits.push(name) },
        { onReady: () => (ready = true), onUnavailable: vi.fn() },
        path
      );
      cleanups.push(() => client.dispose());
      await until(() => ready);
      client.report(state({ appName: name }));
    }
    await until(() => server.getModules().length === 2);

    server.quitAll();
    await until(() => quits.length === 2);
    expect(quits.sort()).toEqual(["PopJot", "PopKey"]);
  });

  it("fires onUnavailable when the launcher pipe is absent (fallback to local tray)", async () => {
    const onUnavailable = vi.fn();
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: vi.fn(), onUnavailable },
      pipePath() // nothing listening here
    );
    cleanups.push(() => client.dispose());
    await until(() => onUnavailable.mock.calls.length === 1);
  });

  it("fires onUnavailable when a live server disappears (launcher died)", async () => {
    const path = pipePath();
    let server: SuiteTrayServer | null = createSuiteTrayServer(vi.fn(), path);

    let ready = false;
    const onUnavailable = vi.fn();
    const client: SuiteTrayClient = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    server.dispose();
    server = null;

    await until(() => onUnavailable.mock.calls.length === 1);
  });

  it("drops a module from the server when its client disconnects", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    await until(() => ready);
    client.report(state({ appName: "PopJot" }));
    await until(() => server.getModules().length === 1);

    client.dispose();
    await until(() => server.getModules().length === 0);
  });
});
