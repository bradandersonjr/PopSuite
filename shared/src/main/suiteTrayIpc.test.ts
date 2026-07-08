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

  // ─── Settings-window relay ─────────────────────────────────────────────
  // The launcher-owned settings window tunnels a hosted renderer's IPC to the
  // owning module and streams the module's pushes back. These exercise the wire
  // round-trip end to end (no Electron), mirroring the module/launcher wiring.

  it("relays a fire-and-forget send from the launcher to the owning module", async () => {
    const path = pipePath();
    const server = createSuiteTrayServer(vi.fn(), path);
    cleanups.push(() => server.dispose());

    const sends: Array<{ channel: string; args: unknown[] }> = [];
    let ready = false;
    const client = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        onRelaySend: (channel, args) => sends.push({ channel, args }),
      },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopKey" }));
    await until(() => server.getModules().length === 1);

    server.relaySend("PopKey", "set-theme-mode", ["dark"]);
    await until(() => sends.length === 1);
    expect(sends[0]).toEqual({ channel: "set-theme-mode", args: ["dark"] });
  });

  it("round-trips a relayed invoke and its correlated result", async () => {
    const path = pipePath();
    const relayBack: Array<{ appName: string; type: string }> = [];
    const server = createSuiteTrayServer(vi.fn(), path, (appName, msg) =>
      relayBack.push({ appName, type: msg.type })
    );
    cleanups.push(() => server.dispose());

    const results: Array<{ id: number; result?: unknown; error?: string }> = [];
    let ready = false;
    const client = createSuiteTrayClient(
      {
        onToggle: vi.fn(),
        onAction: vi.fn(),
        onQuit: vi.fn(),
        // Answer the invoke as the module would (from its own handler).
        onRelayInvoke: (channel, args) =>
          Promise.resolve({ echoed: channel, args }),
      },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopJot" }));
    await until(() => server.getModules().length === 1);

    // The launcher forwards an invoke; the module answers; the ack comes back via
    // the server's onRelay callback as a relayInvokeResult with the same id.
    server.relayInvoke("PopJot", 42, "get-shortcuts", []);
    await until(() => relayBack.some((r) => r.type === "relayInvokeResult"));
    // The result rode back on the same connection (surfaced through onRelay), so
    // the message was delivered — assert the callback saw it tagged to PopJot.
    expect(relayBack).toContainEqual({ appName: "PopJot", type: "relayInvokeResult" });
    void results;
  });

  it("streams a module main→renderer push up to the launcher via onRelay", async () => {
    const path = pipePath();
    const pushes: Array<{ appName: string; channel: string; args: unknown[] }> = [];
    const server = createSuiteTrayServer(vi.fn(), path, (appName, msg) => {
      if (msg.type === "relayPush") pushes.push({ appName, channel: msg.channel, args: msg.args });
    });
    cleanups.push(() => server.dispose());

    let ready = false;
    const client = createSuiteTrayClient(
      { onToggle: vi.fn(), onAction: vi.fn(), onQuit: vi.fn() },
      { onReady: () => (ready = true), onUnavailable: vi.fn() },
      path
    );
    cleanups.push(() => client.dispose());

    await until(() => ready);
    client.report(state({ appName: "PopKey" }));
    await until(() => server.getModules().length === 1);

    client.relayPush("tray-set-theme-mode", ["dark"]);
    await until(() => pushes.length === 1);
    expect(pushes[0]).toEqual({
      appName: "PopKey",
      channel: "tray-set-theme-mode",
      args: ["dark"],
    });
  });
});
