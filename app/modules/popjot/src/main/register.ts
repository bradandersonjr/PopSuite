/**
 * PopJot main-process registration.
 *
 * This is the single source of truth for booting PopJot's main process. Both
 * the standalone entry (src/main/index.ts) and the PopSuite single-install
 * entry (suite/src/main/index.ts) call registerPopJot(); the suite passes a
 * `layout` so the shared shell resolves this module's renderer/preload/icons
 * from their per-module subdirectories inside the shared Electron binary.
 */

import { desktopCapturer, globalShortcut, ipcMain, screen } from "electron";
import { createPopApp, type PopAppOptions } from "@shared/main/createPopApp";
import type { settingsSchema as PopJotSchema } from "../config/settingsSchema";
import { settingsSchema } from "../config/settingsSchema";
import { startAnnotationKeys, stopAnnotationKeys } from "./annotationKeys";
import { startSpotlightScroll, stopSpotlightScroll } from "./spotlightScroll";

// Spotlight radius slider range (mirrors settingsSchema's SliderRow bounds in
// SystemTray.tsx: min=80 max=400). Kept here so the scroll-resize clamps to
// exactly what the slider allows.
const SPOTLIGHT_RADIUS_MIN = 80;
const SPOTLIGHT_RADIUS_MAX = 400;

const isMac = process.platform === "darwin";

// ─── Screenshot capture (snapshot overlay mode) ──────────────────────

let shortcutFired = false;
let screenshotCaptureWarmed = false;
let screenshotWarmupPromise: Promise<void> | null = null;

async function captureScreenshot(): Promise<string | null> {
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { width, height } = display.bounds;

    // Capture at the display's LOGICAL size, not physical pixels (no * scaleFactor).
    // The snapshot is a transient backdrop that gets drawn over immediately and is
    // stretched back to full size by the overlay (object-fill), so full-res detail
    // is wasted — and on a 4K/HiDPI display capturing physical pixels means encoding
    // and shipping ~4x the data, which is the bulk of the activation delay. Logical
    // size keeps it visually indistinguishable while cutting the capture/encode cost.
    //
    // getSources renders a thumbnail for EVERY screen and we keep one, so a
    // multi-monitor setup pays N times the scale cost. desktopCapturer has no way
    // to ask for a single display, so that is unavoidable here.
    //
    // The result stays a PNG data URL. toPNG() + a Buffer over IPC would skip the
    // base64 inflate, but toDataURL is already PNG-encoding under the hood — the
    // compression, which dominates, happens either way — and the renderer would
    // then need an object URL with its own decode and revoke lifecycle. Not a
    // clear win, so it isn't worth the complexity.
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
      fetchWindowIcons: false,
    });

    if (sources.length === 0) return null;

    const displaySource =
      sources.find((s) => s.display_id === display.id.toString()) ?? sources[0];
    return displaySource.thumbnail.toDataURL();
  } catch {
    return null;
  }
}

function warmupScreenshotCapture(): Promise<void> {
  if (screenshotCaptureWarmed) return Promise.resolve();
  if (screenshotWarmupPromise) return screenshotWarmupPromise;

  // Prime the first desktop capture so the first snapshot hotkey press is faster.
  // Warm at a real display's dimensions rather than 1x1: the first call pays for
  // spinning up the platform capture session AND for allocating its scaler at the
  // requested size, and a 1x1 request only exercises the former. The capture is
  // thrown away — this is purely to move that cost off the hotkey's critical path.
  //
  // NOT started eagerly on every activation-adjacent event: capture is only warmed
  // at boot and when the user switches into Snapshot mode, so Live-mode users never
  // pay for a capture pipeline they will not use.
  const { width, height } = screen.getPrimaryDisplay().bounds;
  screenshotWarmupPromise = desktopCapturer
    .getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
      fetchWindowIcons: false,
    })
    .then(() => {
      screenshotCaptureWarmed = true;
    })
    .catch(() => {
      // Ignore warmup failures; the real capture path already handles errors.
    })
    .finally(() => {
      screenshotWarmupPromise = null;
    });

  return screenshotWarmupPromise;
}

/**
 * Boot PopJot's main process. `layout` is only passed by the suite entry to
 * point the shared shell at PopJot's per-module renderer/preload/icons.
 */
export function registerPopJot(
  layout?: PopAppOptions<typeof PopJotSchema>["layout"],
  trayMode?: "owned" | "reported",
  embedded = false
): void {
  // Whether shortcuts fire. Starts enabled; tray "Disable PopJot" suspends them.
  let enabled = true;

  // ─── Spotlight cursor tracking ─────────────────────────────────────
  // While spotlight mode is active the overlay stays click-through (mouse events
  // pass through to the apps underneath), so the renderer never sees mousemove.
  // We poll the OS cursor here (~60Hz) and push it to the renderer instead. We
  // deliberately do NOT enable { forward: true } on the overlay — the shared
  // shell warns it intercepts synthetic right/middle-click events from tablet
  // drivers (e.g. Huion stylus). Polling only runs while spotlight is active.
  //
  // Right-mouse-drag resize (spotlightDrag.ts) uses a separate global uiohook
  // listener, for the same reason: the click-through overlay never sees a real
  // mousedown. That listener is also only registered while spotlight is
  // active. It observes the right button globally but does not consume or
  // suppress the OS-level click — since { forward: true } is deliberately not
  // enabled on the overlay (see above), a right-click during spotlight still
  // reaches whatever app is under the cursor, same as every other button. That
  // is an accepted tradeoff: swallowing the click at the OS level would need
  // an approach this codebase already flagged as risky for stylus drivers.
  let spotlightActive = false;
  let cursorPollTimer: ReturnType<typeof setInterval> | null = null;
  // Mirrors renderer annotation state (from overlay-activated/deactivated) so the
  // spotlight shortcut can be gated in-process without querying the renderer.
  let annotating = false;

  function startCursorPolling(): void {
    if (cursorPollTimer) return;
    cursorPollTimer = setInterval(() => {
      const win = popApp.getMainWindow();
      if (!win || win.isDestroyed()) return;
      const pos = popApp.getCursorDipPosition();
      popApp.sendToMainWindow("spotlight-cursor", pos);
    }, 16);
  }

  function stopCursorPolling(): void {
    if (cursorPollTimer) {
      clearInterval(cursorPollTimer);
      cursorPollTimer = null;
    }
  }

  /**
   * `skipSuiteReport` is set by the drawing-mode force-exit below: entering
   * annotation immediately re-asserts reportSuiteAnnotating(true) right after
   * this would send `false`, and the two suite reports are separate
   * synchronous pipe sends the launcher processes in order — so without this,
   * PopKey would see a real (if momentary) false-then-true and could flicker
   * back into view for a frame before drawing mode re-suppresses it.
   */
  function setSpotlight(active: boolean, skipSuiteReport = false): void {
    if (spotlightActive === active) return;
    spotlightActive = active;
    if (active) {
      // Cover whichever display the cursor is on, then start feeding positions.
      popApp.moveOverlayToCursorDisplay();
      popApp.sendToMainWindow("spotlight-cursor", popApp.getCursorDipPosition());
      startCursorPolling();
      // Scroll-wheel resize. Only registered while spotlight is active (mirrors
      // the cursor-poll lifecycle above) so the native uiohook listener carries
      // zero cost whenever spotlight is off. Deliberately scroll-only, not a
      // mouse-button drag — no gesture here can be mistaken for (or swallow) a
      // click meant for the app under the cursor. Values push through
      // ctx.setSetting, the same path the tray/settings sliders use, so an open
      // Settings window's slider and the live paint loop both update in real
      // time as you scroll.
      startSpotlightScroll(
        () => popApp.settings.spotlightRadius,
        { radiusMin: SPOTLIGHT_RADIUS_MIN, radiusMax: SPOTLIGHT_RADIUS_MAX },
        {
          onChange: (radius) => {
            popApp.setSetting("spotlightRadius", radius);
          },
        }
      );
      // Escape exits spotlight. The overlay stays click-through and unfocused
      // (so clicks reach the apps underneath), which means its renderer can't see
      // key events — so we listen globally, only while spotlight is active. This
      // never touches the renderer's persistent-mode Escape path.
      globalShortcut.register("Escape", () => setSpotlight(false));
      // Hold-to-activate, same mechanism as PopJot's own hold-to-draw: watch the
      // live "spotlight" accelerator's modifiers on the global input hook and
      // exit the instant they're released, so spotlight never outlives the key
      // press. Reuses annotationKeys.ts's single-session watcher — safe because
      // spotlight and annotation are already mutually exclusive (this function's
      // "active" branch is only reached when annotation is not running).
      const spotlightAccelerator = popApp.getShortcut("spotlight");
      if (spotlightAccelerator) {
        startAnnotationKeys(spotlightAccelerator, () => setSpotlight(false));
      }
    } else {
      stopCursorPolling();
      stopSpotlightScroll();
      globalShortcut.unregister("Escape");
      stopAnnotationKeys();
    }
    // Suite-only: reuse the same "annotating" suppress signal drawing mode
    // already sends, so PopKey auto-hides (down to just its branding overlay)
    // while spotlight is active too — one full-screen presenter surface at a
    // time reads the same way to the suite regardless of which PopJot mode
    // triggered it. No-op outside the suite (no pipe client) and standalone.
    if (!skipSuiteReport) popApp.reportSuiteAnnotating(active);
    popApp.sendToMainWindow("spotlight-set", active);
  }

  // ─── Annotation session key handling ───────────────────────────────
  // The drawing overlay is non-focusable (createPopApp sets focusable:false) so
  // that activating it never tears down the transient UI of the app underneath —
  // menus, submenus and tooltips (Fusion 360's especially) close the moment
  // another window takes the foreground, which is precisely what users want to
  // annotate. The renderer therefore never sees key events during a session, so
  // both keyboard exits are owned here:
  //
  //  - Hold-to-draw release: annotationKeys.ts watches the global input hook for
  //    the release of the STARTING shortcut's modifiers. Momentary sessions only.
  //  - Escape: globalShortcut, mirroring spotlight's Escape (see setSpotlight).
  //    globalShortcut rather than the uiohook keyup listener because it works for
  //    persistent sessions too, which never acquire the native hook at all — and
  //    because it consumes the keypress, so Escape ends the session instead of
  //    also reaching the app underneath. Annotation and spotlight are mutually
  //    exclusive (see the overlay-activated handler), so the two Escape
  //    registrations can never both be live.
  let annotationEscapeRegistered = false;
  // Set when the momentary hold is released before the renderer has been told to
  // activate at all — i.e. during the awaited snapshot capture in a shortcut
  // handler. The handler checks this and abandons the activation instead of
  // raising an overlay nothing would ever take back down. See requestAnnotationExit.
  let annotationExitedEarly = false;

  /**
   * End the session from main. Drives the same renderer teardown the tray's
   * disable path uses (clear drawing state, drop the snapshot, hide the menu),
   * which echoes back overlay-deactivated to complete the hide and the suite
   * restoration — rather than inventing a parallel deactivation channel.
   */
  function requestAnnotationExit(): void {
    if (!annotating) {
      // The user let go (or hit Escape) while a shortcut handler was still
      // awaiting its snapshot capture, so the renderer was never asked to
      // activate. Tearing it down would be a no-op; instead flag the in-flight
      // handler to drop the activation on the floor.
      annotationExitedEarly = true;
      endAnnotationSession();
      return;
    }
    popApp.sendToMainWindow("overlay-deactivate-requested");
  }

  /**
   * `accelerator` is the shortcut that started the session, or null for a
   * persistent (toggle) session, which has no hold to release. Pass the LIVE
   * accelerator (ctx.getShortcut) — the shortcuts are rebindable and persist, so
   * a session started on a custom chord must end on that chord's modifiers, not
   * on the default's.
   *
   * Only a shortcut handler starts a session for real; `overlay-activated` calls
   * the backstop below instead, which must NOT clear annotationExitedEarly (see
   * there for the race that clobbering it opens up).
   */
  function startAnnotationSession(accelerator: string | null): void {
    annotationExitedEarly = false;
    // Force-exit spotlight (inside armAnnotationSession) BEFORE starting this
    // session's own key watch: spotlight's hold-to-activate now owns the same
    // single-session annotationKeys.ts watcher, and its exit path calls
    // stopAnnotationKeys() — started in the wrong order, that would immediately
    // wipe out the watch this call is about to arm.
    armAnnotationSession();
    if (accelerator) startAnnotationKeys(accelerator, requestAnnotationExit);
  }

  /**
   * The parts of a session start that are safe to re-run on an activation main
   * did not initiate. Deliberately does not touch annotationExitedEarly or the
   * hold-to-draw watch: an exit can already be in flight by the time the
   * renderer echoes overlay-activated back (the user let go before the overlay
   * came up), and re-arming those would strand a session with nothing watching
   * for its release.
   */
  function armAnnotationSession(): void {
    // Annotation and spotlight are mutually exclusive, and spotlight owns the
    // same Escape accelerator — force-exit it BEFORE registering ours, so its
    // unregister on the way out can never tear down the annotation binding.
    // skipSuiteReport: callers report annotating=true anyway, so don't emit a
    // same-tick false first (see setSpotlight's doc comment).
    if (spotlightActive) setSpotlight(false, true);
    if (!annotationEscapeRegistered) {
      annotationEscapeRegistered = globalShortcut.register("Escape", requestAnnotationExit);
    }
    // Fusion 360's own topmost popups can otherwise win the z-order race and
    // render over the ink. Only boosted while a session is live.
    popApp.setOverlayTopmostBoost(true);
  }

  function endAnnotationSession(): void {
    stopAnnotationKeys();
    if (annotationEscapeRegistered) {
      globalShortcut.unregister("Escape");
      annotationEscapeRegistered = false;
    }
    popApp.setOverlayTopmostBoost(false);
  }

  const popApp = createPopApp({
    appName: "PopJot",
    aboutDetail: "Screen annotation that stays out of your way.",
    settingsSchema,
    embedded,
    proProduct: "suite",
    layout,
    onSettingChange: {
      overlayMode: (mode) => {
        if (mode === "snapshot") void warmupScreenshotCapture();
      },
    },
    settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
    shortcuts: [
      {
        name: "main",
        default: isMac ? "Cmd+Shift+A" : "Alt+Shift+A",
        handler: async (ctx) => {
          const win = ctx.getMainWindow();
          if (!win || shortcutFired || !enabled) return;
          shortcutFired = true;
          // Suppress PopKey at shortcut-fire time, not at overlay-activated:
          // waiting for the renderer round trip (plus the snapshot capture
          // below) leaves PopKey's badges visible — and baked into the
          // snapshot — for a noticeable beat. overlay-activated re-asserts
          // true (harmless) and overlay-deactivated restores.
          popApp.reportSuiteAnnotating(true);
          // Start the hold-to-draw watch BEFORE the (awaited) snapshot capture,
          // not after: the capture can take a beat, and a quick tap would
          // otherwise release the modifiers before the hook was listening —
          // leaving a momentary session that can never end on its own.
          startAnnotationSession(ctx.getShortcut("main"));
          // Move overlay to whichever display the cursor is on before capturing
          ctx.moveOverlayToCursorDisplay();
          const pos = ctx.getCursorDipPosition();
          const needsSnapshot = ctx.settings.overlayMode === "snapshot";
          const snapshot = needsSnapshot ? await captureScreenshot() : null;
          if (!enabled || annotationExitedEarly) {
            shortcutFired = false;
            endAnnotationSession();
            popApp.reportSuiteAnnotating(false);
            return;
          }
          ctx.sendToMainWindow("shortcut-activate", pos, snapshot);
        },
      },
      {
        // Use last tool: activate the overlay straight into drawing with the
        // last-used tool, skipping the radial menu — the keyboard twin of the
        // top (History) slot. Alt+Shift+W (Cmd+Shift+W on macOS) was free.
        name: "lastTool",
        default: isMac ? "Cmd+Shift+W" : "Alt+Shift+W",
        handler: async (ctx) => {
          const win = ctx.getMainWindow();
          if (!win || !enabled) return;
          if (shortcutFired) {
            // Overlay already up (menu open): the renderer just dismisses the
            // menu and keeps the current tool — no re-capture needed.
            ctx.sendToMainWindow("shortcut-last-tool", null);
            return;
          }
          shortcutFired = true;
          // Early suppress, same as the main shortcut above.
          popApp.reportSuiteAnnotating(true);
          // Hold-to-draw watch on THIS shortcut's own chord, started before the
          // awaited capture — same reasoning as the main shortcut above.
          startAnnotationSession(ctx.getShortcut("lastTool"));
          ctx.moveOverlayToCursorDisplay();
          const needsSnapshot = ctx.settings.overlayMode === "snapshot";
          const snapshot = needsSnapshot ? await captureScreenshot() : null;
          if (!enabled || annotationExitedEarly) {
            shortcutFired = false;
            endAnnotationSession();
            popApp.reportSuiteAnnotating(false);
            return;
          }
          ctx.sendToMainWindow("shortcut-last-tool", snapshot);
        },
      },
      {
        name: "persistent",
        default: isMac ? "Cmd+Shift+S" : "Alt+Shift+S",
        handler: async (ctx) => {
          const win = ctx.getMainWindow();
          if (!win || !enabled) return;
          // Early suppress, same as the main shortcut above. If this press is
          // the renderer's persistent-mode OFF toggle, the resulting
          // overlay-deactivated reports false right after — correct end state.
          popApp.reportSuiteAnnotating(true);
          const needsSnapshot = ctx.settings.overlayMode === "snapshot";
          // The renderer makes this shortcut behave like the main (hold-to-draw)
          // one in Snapshot mode and like an on/off toggle in Live mode — mirror
          // that split here so the session gets the matching key handling: a
          // release watch for the hold, Escape-only for the toggle. A press while
          // already annotating in Live mode is the toggle's OFF edge, which the
          // renderer's overlay-deactivated already tears down.
          if (!annotating) {
            startAnnotationSession(needsSnapshot ? ctx.getShortcut("persistent") : null);
          }
          ctx.moveOverlayToCursorDisplay();
          const pos = ctx.getCursorDipPosition();
          const snapshot = needsSnapshot ? await captureScreenshot() : null;
          if (!enabled || annotationExitedEarly) {
            endAnnotationSession();
            if (!annotating) popApp.reportSuiteAnnotating(false);
            return;
          }
          ctx.sendToMainWindow("shortcut-persistent", pos, snapshot);
        },
      },
      {
        // Spotlight presenter mode — hold to activate, same as PopJot's main
        // (hold-to-draw) shortcut: pressing turns it on, releasing the chord's
        // modifiers turns it off (see the startAnnotationKeys call in
        // setSpotlight). Distinct chord from "main" (Alt+Shift+A), "persistent"
        // (Alt+Shift+S) and PopKey's Alt+Shift+K: Alt+Shift+D (Cmd+Shift+D on
        // macOS) was free.
        name: "spotlight",
        default: isMac ? "Cmd+Shift+D" : "Alt+Shift+D",
        handler: () => {
          if (!enabled || spotlightActive) return;
          // Mutually exclusive with annotation: ignore the press while
          // annotating so we never race the RadialMenu activation state machine.
          if (annotating) return;
          setSpotlight(true);
        },
      },
    ],
    onWillQuit: () => {
      stopCursorPolling();
      stopSpotlightScroll();
      stopAnnotationKeys();
    },
    tray: { settingsLabel: "Open Settings", mode: trayMode },
    trayToggle: {
      getEnabled: () => enabled,
      onToggle: () => {
        enabled = !enabled;
        popApp.setTrayActive(enabled);
        const win = popApp.getMainWindow();
        if (enabled) {
          // PopJot's transparent overlay remains resident while the app is
          // enabled so activation never has to recreate/show its native surface.
          win?.showInactive();
          return;
        }

        if (spotlightActive) setSpotlight(false);
        if (annotating) {
          // Let the renderer clear persistent/momentary state, then its normal
          // overlay-deactivated event completes the hide and suite restoration.
          popApp.sendToMainWindow("overlay-deactivate-requested");
        } else {
          shortcutFired = false;
          endAnnotationSession();
          win?.hide();
        }
      },
    },
    secondInstance: "open-settings",
    onReady: (ctx) => {
      ctx.setTrayActive(enabled);
      void warmupScreenshotCapture();

      // The overlay clears shortcutFired via "overlay-deactivated". If its
      // webContents reloads or crashes while active, that event never arrives and
      // the flag sticks — wedging the main hotkey until restart. Resetting on
      // did-finish-load recovers the gate whenever the overlay (re)loads.
      const main = ctx.getMainWindow();
      main?.webContents.on("did-finish-load", () => {
        shortcutFired = false;
        // Renderer reloads forget transient drawing/spotlight state. Reconcile
        // main and suite state while keeping the enabled overlay resident.
        if (spotlightActive) setSpotlight(false);
        if (annotating) {
          annotating = false;
          endAnnotationSession();
          ctx.reportSuiteAnnotating(false);
        }
        if (!enabled) main.hide();
      });
    },
  });

  // ─── Overlay activation (PopJot-specific) ────────────────────────────

  ipcMain.on(popApp.ipcChannel("overlay-activated"), () => {
    annotating = true;
    // The hold was released before the renderer got the overlay up (a quick tap:
    // requestAnnotationExit ran while `annotating` was still false, so it could
    // only flag itself). Now that the renderer says it IS up, take it back down —
    // this is the one path that can honour that deferred exit.
    if (annotationExitedEarly) {
      annotationExitedEarly = false;
      requestAnnotationExit();
      return;
    }
    // Backstop for activations main did not initiate (the renderer can enter
    // drawing on its own). Only re-arms Escape and the topmost boost — never the
    // hold-to-draw watch, which only a shortcut handler can set up since only it
    // knows which chord fired. Also force-exits spotlight, which is mutually
    // exclusive with annotation.
    armAnnotationSession();
    // Suite-only: tell the launcher we're annotating so PopKey auto-hides. No-op
    // outside the suite (no pipe client) and for standalone PopJot.exe.
    popApp.reportSuiteAnnotating(true);
    const win = popApp.getMainWindow();
    if (!win) return;
    win.setIgnoreMouseEvents(false);
    // Deliberately NOT win.focus(): taking the foreground closes the menus,
    // submenus and tooltips of the app being annotated (Fusion 360's most
    // visibly), which is the whole thing PopJot exists to draw on. The window is
    // created non-focusable; keyboard exits are owned by main instead (see the
    // annotation session section above). Mouse input still arrives — a
    // non-focusable window is not a click-through one.
  });

  ipcMain.on(popApp.ipcChannel("overlay-deactivated"), () => {
    annotating = false;
    endAnnotationSession();
    // Suite-only: annotation ended, let the launcher restore PopKey.
    popApp.reportSuiteAnnotating(false);
    const win = popApp.getMainWindow();
    if (!win) return;
    // Drop { forward: true } when inactive — forwarding keeps the window in the
    // input pipeline which can intercept synthetic right/middle-click events from
    // tablet drivers (e.g. Huion stylus buttons).
    win.setIgnoreMouseEvents(true);
    // The transparent native surface stays present between activations while
    // PopJot is enabled. Disabling PopJot still removes it entirely.
    if (!enabled) win.hide();
    shortcutFired = false;
  });
}
