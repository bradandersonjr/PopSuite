# PopSuite single-install — manual verification checklist

The suite build, path resolution, native-module packaging, and argv routing are
verified headlessly (see the final report). GUI behavior could not be exercised
from the build agent (launching an Electron GUI there crashes at startup — a
known environmental issue, not a code bug). Run these checks on a normal Windows
desktop session after installing `release/PopSuite Setup 1.0.0.exe` (or launching
`release/win-unpacked/PopSuite.exe`).

Build the package first:

```
npm run package:suite      # from repo root, or: npm run package:win --prefix app
```

## Checklist

### Unified suite tray (single icon)

1. **Exactly ONE suite tray icon.**
   Double-click `PopSuite.exe`. Within a second or two, exactly ONE tray icon
   appears (PopSuite), NOT one per module. In Task Manager you should see THREE
   `PopSuite.exe` processes: the resident launcher/tray-owner plus one child per
   module (popjot, popkey). The launcher no longer exits after spawning — it
   stays alive to own the tray.

2. **Menu reflects the new layout once both modules are running.**
   Left- or right-click the suite tray icon. The menu shows, top to bottom:
   - a disabled "PopSuite" title, then a separator;
   - a FLAT checkbox toggle per connected module ("Disable PopJot
     (Alt+Shift+A)", "Disable PopKey  (Alt+Shift+K)") directly under the title —
     NOT wrapped in per-module submenus — with a checkmark when active;
   - "Edit Settings" (submenu / picker) listing ONLY "PopJot Settings" and
     "PopKey Settings" — NO per-module About entries in the picker anymore;
   - a single "About PopSuite" item (one product-level About, not one per module);
   - a separator, then "Launch Preferences" (submenu) containing the single
     "Open PopSuite at Login" checkbox;
   - a separator, then "Changelog" and "Documentation";
   - a separator, then "Quit PopSuite".
   Modules appear only once they have connected over the pipe; the toggles and
   the Edit Settings picker update live as modules connect/disconnect, while
   Launch Preferences / Changelog / Documentation / Quit PopSuite are always
   present regardless of connected modules.

3. **Toggling from the tray menu activates/deactivates the correct module.**
   Click "Disable PopJot" — PopJot's shortcuts suspend and its checkbox clears;
   click again to re-enable. Do the same for PopKey (its visualizer toggles).
   Confirm toggling one module never affects the other. Toggle a module via its
   own hotkey instead and re-open the menu: the checkmark/label reflects the new
   state (state is pushed back to the launcher over the pipe).

4. **Edit Settings picker opens the correct module's window (Settings only).**
   From "Edit Settings > PopJot Settings" the PopJot settings window opens; from
   "Edit Settings > PopKey Settings" the PopKey settings window opens. Both relay
   over the existing per-module action pipe. The picker no longer contains any
   "About" entries — those moved out to the single "About PopSuite" item (below).

4-About. **Single "About PopSuite" shows the suite's own version.**
   Click "About PopSuite" (a top-level item, shown ONCE, not per module — it is
   present even with no module connected). A dialog titled "About PopSuite" with
   message "PopSuite" appears, whose version line reads the SUITE's own version
   (from `suite/package.json`, currently 1.0.0) — NOT PopJot's or PopKey's
   individual version. The detail also names both capabilities as one product
   (screen-annotation overlay + keystroke visualizer). This is launcher-local: no
   round-trip to a module, so it works even if a module is not running/connected.

4a. **Launch Preferences registers PopSuite.exe for login.**
   Open "Launch Preferences > Open PopSuite at Login" and tick it. Confirm
   PopSuite (PopSuite.exe with NO `--module` arg) now appears enabled in Windows
   Settings > Apps > Startup (or Task Manager > Startup apps tab). Untick it and
   confirm the entry is removed/disabled. Re-open the tray menu each time: the
   checkbox reflects the current state. Reboot (or sign out/in): PopSuite should
   auto-launch and bring up both modules when the toggle is on, and NOT launch
   when off — the state persists across relaunch (it lives in the OS login-items
   registry, not in app state). This registers the LAUNCHER only; a module's own
   standalone per-app login toggle is independent and unaffected.

4b. **Changelog / Documentation open the correct URLs.**
   Click "Changelog" — the default browser opens https://popjot.app/changelog.
   Click "Documentation" — it opens https://popjot.app/docs. Both are suite-wide
   (not per-module) and remain available even with no modules connected.

5. **Quit PopSuite exits everything.**
   Click "Quit PopSuite" (formerly "Quit All"; same behavior). Both module
   processes and the launcher/tray-owner exit; the tray icon disappears and no
   `PopSuite.exe` processes remain in Task Manager.

6. **Launcher death → each module falls back to its own tray (graceful
   degradation).**
   With all three processes running, end the LAUNCHER `PopSuite.exe` process in
   Task Manager (the one with no `--module` arg / lowest memory, owning the tray).
   The suite tray icon disappears, and within a moment EACH module re-creates its
   OWN local tray icon (two icons appear). Right-click them — the classic
   per-module menus are back. No module is ever left without a tray.

7. **Starting a module directly (bypassing the launcher) still shows its own
   tray.**
   Run `PopSuite.exe --module=popjot` from a terminal (no launcher running).
   Because the pipe is unavailable, PopJot immediately falls back to its own tray
   icon and behaves exactly like standalone PopJot. Same for `--module=popkey`.

8. **Standalone PopJot.exe / PopKey.exe are unaffected (redesign regression).**
   The standalone builds still create their own independent tray icons and menus
   exactly as before — the unified tray is suite-only (`tray.mode: "reported"` is
   passed only by the suite module entries; standalone omits it, defaulting to
   "owned"). The new unified-menu layout (flat toggles / Edit Settings picker /
   About PopSuite / Launch Preferences / Changelog / Documentation / Quit
   PopSuite) lives entirely in the launcher; the standalone per-app menu
   (Enable/Disable, Settings, About, Quit <App>) and each app's own per-app
   login-at-startup toggle in its settings window are untouched by this change.
   In particular, standalone PopJot.exe's "About" and standalone PopKey.exe's
   "About" each STILL show their OWN per-app dialog with their OWN module version
   and their own `aboutDetail` copy — the per-module About was only removed from
   the SUITE's unified picker, not from the standalone trays (which build their
   menu via a separate code path, `createTray`/`buildTrayMenu` in createPopApp).

### PopJot annotation auto-hides PopKey (suite-only)

A1. **Annotating PopJot auto-hides PopKey.**
   With BOTH modules running under the launcher and PopKey's visualizer ON,
   activate PopJot (Alt+Shift+A) and start drawing. PopKey's visualizer overlay
   should disappear the moment PopJot becomes active (key/click badges stop
   showing). This is driven over the suite pipe — PopJot's main process reports
   "annotating" up to the launcher, which relays a suppress command to PopKey.

A2. **Stopping annotation restores PopKey to its prior state.**
   Dismiss PopJot's overlay (Escape / click away, so annotation ends). PopKey's
   visualizer reappears in whatever state it was before (ON if it was ON). If you
   had PopKey OFF before PopJot activated, it stays OFF — it restores to your last
   requested state, not blindly to ON.

A3. **PopJot always wins: toggling PopKey while PopJot is active does not show
   it, but is honored afterward.**
   While PopJot is actively annotating (PopKey auto-hidden), press PopKey's hotkey
   (Alt+Shift+K) or click its tray toggle. PopKey must STAY hidden (PopJot wins).
   Then end PopJot's annotation: PopKey should now reflect that toggle — i.e. if
   it was ON and you toggled once while suppressed, it comes back OFF; toggle
   again while suppressed and it comes back ON. The LATEST request wins; requests
   are never silently dropped.

A4. **Tray shows the auto-hidden state.**
   While PopKey is auto-hidden by PopJot, open the suite tray menu: PopKey's entry
   is suffixed "(auto-hidden)". Its checkbox still reflects your requested state
   (checked if you last asked for it ON). The suffix clears once PopJot stops.

A5. **Killing the launcher mid-suppression un-sticks PopKey.**
   With PopJot annotating and PopKey auto-hidden, end the LAUNCHER `PopSuite.exe`
   process in Task Manager. PopKey must NOT stay stuck hidden: it falls back to
   its own local tray (per check 6) AND clears the auto-suppression, returning to
   normal manual control (visualizer restores to your last requested state, hotkey
   toggles work immediately).

A6. **Standalone PopJot.exe + PopKey.exe side-by-side do NOT interact
   (regression / out-of-scope check).**
   Launch the STANDALONE `PopJot.exe` and `PopKey.exe` (not via the suite
   launcher) at the same time. Annotate with PopJot: PopKey's visualizer must be
   COMPLETELY UNAFFECTED (stays visible, keeps showing keys/clicks). The auto-hide
   feature is gated entirely behind the suite pipe, so it must not engage for
   standalone apps. Same when running a module directly via `--module=` with no
   launcher.

### Regression checks (unchanged behavior)

9. **PopJot annotation activation / focus works with PopKey running (CRITICAL
   REGRESSION TEST).**
   With BOTH modules running, press PopJot's activate hotkey (Alt+Shift+A).
   The radial menu should appear and STAY active — draw a stroke, confirm the
   overlay holds focus and does not collapse on blur. This is the exact failure
   mode of the abandoned single-process merge; because each module now has its
   own process with exactly one overlay window, it must behave identically to
   standalone PopJot. Also test persistent mode (Alt+Shift+S).

10. **Killing one module leaves the other running.**
   In Task Manager, end one module `PopSuite.exe` process. The other module keeps
   running normally, and the suite tray menu drops the killed module's toggle
   while keeping the surviving one (the pipe disconnect updates the menu live).

11. **Settings sync still flows between modules.**
   In one app's Settings > Sync tab, enable a synced key (e.g. a shared style or
   branding value) and change it. Confirm the sibling app picks up the change
   live. Both modules read/write `~/.popsuite/<app>.json` and
   `~/.popsuite/shared.json` (under your home dir, NOT userData), so per-module
   userData isolation does not affect sync.

12. **Single-instance behavior on relaunch.**
   With everything running, double-click `PopSuite.exe` again. The launcher's own
   single-instance lock (under `%APPDATA%/PopSuite`, distinct from the modules'
   `.../modules/<module>` locks) routes the relaunch to the running launcher's
   second-instance handler, which re-spawns modules. Each module's own lock then
   causes the freshly spawned child to lose the lock and quit cleanly, and the
   running module handles its own second-instance event (PopJot focuses its
   overlay; PopKey opens its settings). You should NOT get a duplicate suite tray
   icon or duplicate processes.

13. **PopKey input capture works; PopJot never loads the native hook.**
   Confirm PopKey visualizes keystrokes/clicks (uiohook-napi is unpacked at
   `resources/app.asar.unpacked/.../win32-x64/uiohook-napi.node`). The PopJot
   module process must NOT load uiohook — its bundle contains zero references to
   it (verified at build time).

### PopJot spotlight presenter mode

Spotlight dims the whole screen except a soft circle that follows the cursor —
a presentation aid like snapshot mode, with NO drawing while it is active. It is
a PopJot-internal mode (the unified suite tray is untouched). Cursor position is
polled in PopJot's main process (~60Hz) and pushed to the overlay while spotlight
is active — the overlay stays click-through, so it never enables `{ forward: true }`
(which the shared shell warns intercepts Huion-stylus synthetic clicks).

14. **Shortcut toggles spotlight on and off.**
   With PopJot running, press `Alt+Shift+D` (`Cmd+Shift+D` on macOS). The screen
   dims to a black overlay with a bright circle at the cursor. Press it again —
   the dim clears completely. Confirm the chord does NOT collide with the main
   (`Alt+Shift+A`), persistent (`Alt+Shift+S`), or PopKey (`Alt+Shift+K`)
   shortcuts: those still work independently.

15. **Circle follows the cursor smoothly.**
   With spotlight on, move the mouse around. The transparent circle tracks the
   cursor across the whole display with no visible stutter or React re-render lag.
   Move to a second monitor: the overlay follows to whichever display the cursor
   was on when spotlight was toggled (it covers one display, like the other modes).

16. **Clicks pass through to the apps underneath.**
   With spotlight on, click a button in the app below (e.g. switch browser tabs,
   click a taskbar item). The click lands on that app — spotlight never steals it.
   This is the core presenter requirement: keep presenting/clicking while dimmed.

17. **Escape exits spotlight.**
   With spotlight on, press `Escape`. The dim clears. Confirm this does NOT
   interfere with persistent drawing mode's own Escape (test #9 above).

18. **Annotation shortcut while spotlighted force-exits spotlight (CRITICAL).**
   Turn spotlight ON, then press PopJot's activate hotkey (`Alt+Shift+A`) or
   persistent (`Alt+Shift+S`). Spotlight must instantly clear AND annotation must
   activate normally — the radial menu appears and holds focus, drawing works.
   Conversely, pressing the spotlight shortcut WHILE annotating is a no-op
   (ignored). Spotlight must never break the focus-sensitive annotation state
   machine: draw a stroke afterward to confirm the overlay still holds focus.

19. **Settings sliders live-update the effect.**
   Open PopJot Settings > Behavior > Spotlight. With spotlight active on screen,
   drag the Dim slider (0-100%) and Radius slider (80-400px), and toggle Soft edge
   on/off. Each change updates the on-screen effect immediately. Rebind the
   spotlight shortcut with the shortcut widget and confirm the new chord toggles it.

20. **PopKey stays visible during spotlight (no suppression).**
   With BOTH modules running and PopKey visualizing keys, turn spotlight ON.
   PopKey's key/click visualizer must REMAIN visible — spotlight is not annotating,
   so it must NOT report `annotating=true` up the suite pipe and must NOT trigger
   PopKey auto-hide (contrast with real annotation in test #9, which does hide it).

### One settings window (suite settings app-switcher / tab-swap)

In the suite, each module's settings window gains a "PopJot | PopKey" tab strip
at the very top of the window chrome. The current app's tab is highlighted; the
sibling's tab is clickable. Clicking it captures this window's bounds, asks the
launcher (over the existing pipe) to open the sibling's settings window at those
exact bounds, then hides this one once the sibling's window is up — so it reads
as one tabbed window swapping content, while staying two windows in two
processes. Standalone (no launcher / pipe) shows NO tab strip and behaves exactly
as today.

S1. **Tab strip visible in suite mode on BOTH apps' settings.**
   With both modules running under the launcher, open PopJot's settings (Edit
   Settings > PopJot Settings). A tab strip appears at the top: "PopJot" (active,
   highlighted) and "PopKey" (clickable). Open PopKey's settings the same way and
   confirm the mirror: "PopKey" active, "PopJot" clickable. The rest of each
   settings window's content is unchanged.

S2. **Clicking the sibling tab swaps seamlessly at the same position/size.**
   Open PopJot settings, move/resize the window somewhere distinctive, then click
   the "PopKey" tab. PopKey's settings window opens at the SAME position and size,
   and PopJot's settings window hides. There is no visible flash of "no window"
   (the sibling opens first, then this one hides on the launcher's ack). Click the
   "PopJot" tab in the now-shown PopKey window to swap back — same position/size.

S3. **No zero-windows when the sibling module is dead.**
   Quit ONE module (e.g. end the PopKey child `PopSuite.exe` in Task Manager, or
   use its own tray Quit) while keeping the launcher and the other module alive.
   Open the surviving module's settings — the tab strip may still show the sibling
   tab briefly (the launcher only drops the module on pipe disconnect). Click the
   dead sibling's tab: nothing opens AND the current window STAYS open (it is never
   hidden without the sibling taking over). You are never left with no settings
   window. A console line notes the dropped swap.

S4. **Tab strip absent when a module runs standalone.**
   Launch standalone `PopJot.exe` (or `PopSuite.exe --module=popjot` with no
   launcher). Open its settings — NO tab strip renders; the window is
   pixel-identical to before this feature. Same for PopKey standalone.

S5. **Window dragging still works.**
   The frameless settings window can still be moved/resized exactly as before; the
   tab strip does not introduce a drag region that would swallow the swap click or
   break window movement. (The settings window has no custom drag chrome; the tab
   strip is a normal, non-draggable button row.)

S6. **Rapid tab clicking is harmless (idempotent).**
   Double- or triple-click the sibling tab quickly. Exactly one swap happens (the
   in-flight guard ignores extra clicks until the launcher acks); you never end up
   with two windows fighting or a flicker of both.

S7. **Pipe drop hides/disables the strip live.**
   With a settings window open and its tab strip showing, end the LAUNCHER
   `PopSuite.exe` process. The tab strip DISAPPEARS from the open settings window
   within a moment (the live suite-connected flag flips false on the pipe drop),
   and the module falls back to its own tray (per check 6). The settings window
   itself stays open and fully usable — only the app-switcher strip is removed.

## Notes

- **Unified tray architecture.** The launcher (`PopSuite.exe` with no `--module`
  arg) is now a resident tray-owner: it creates the single suite tray icon,
  listens on a local named pipe (`\\.\pipe\popsuite-tray` on Windows), spawns the
  module children, and builds one dynamic menu from whichever modules have
  connected. It owns no overlay/settings windows and never touches a module's
  window/focus/overlay behavior — it only relays menu clicks over the pipe.
- **Reported vs owned tray.** Each suite module runs in `tray.mode: "reported"`:
  it skips creating its own OS tray and instead reports state (name, active,
  shortcut hints, actions) to the launcher. Standalone PopJot.exe/PopKey.exe use
  the default `"owned"` mode and are unchanged.
- **Resilience / graceful degradation.** If the launcher pipe is unreachable at
  connect time (module started standalone via `--module`, or launcher not
  running) OR the connection later drops (launcher killed/crashed), the module
  automatically falls back to creating its OWN local tray icon — so a module is
  never left without a tray. This is the same code path the standalone apps use.
- Per-module userData lives at `%APPDATA%/PopSuite/modules/popjot` and
  `.../modules/popkey`. Delete these to reset a module's local state; the shared
  sync files under `~/.popsuite` are separate. The launcher's own single-instance
  lock lives at `%APPDATA%/PopSuite` (no `modules/` segment).
- Licensing is untouched: both modules use the `suite` Pro product and the same
  offline license layer as the standalone apps.
- **Settings app-switcher (suite-only "one settings window").** Each module's
  settings window renders a shared `SuiteTabStrip` (in `SettingsWindowFrame`) that
  self-gates: it only appears when the module reports LIVE suite-connected state
  and has a configured `suiteSibling`. Clicking the sibling tab sends a
  `requestSiblingSettings` (with this window's bounds) up the pipe; the launcher's
  tray server relays an `openSettings` to the sibling (if running) and acks the
  requester with `siblingSettingsResult { delivered }`. The requester hides its
  own window ONLY on `delivered=true`, so a dead sibling never leaves zero
  windows. The arriving window clamps the incoming bounds onto a visible display
  (`clampBoundsToDisplays`) so an unplugged-monitor rect can't strand it
  off-screen, and Electron enforces each window's own min size. Gated entirely
  behind the pipe: standalone/web renders no strip and the switch is a no-op.
- **PopJot annotation auto-hide (suite-only).** PopJot's main process reports its
  annotating on/off transitions (surfaced from the existing renderer
  `overlay-activated` / `overlay-deactivated` IPC — RadialMenu's activation logic
  is untouched) up the unified-tray pipe. The launcher relays a `suppress` message
  to PopKey, which runs a pure state reducer (`suiteSuppression.ts`): while
  suppressed it force-hides its overlay (absolute `set-app-enabled`, not a toggle)
  and defers manual toggles, restoring the user's last requested state when PopJot
  stops. It is gated entirely behind the suite pipe — outside the suite (standalone
  or `--module=` with no launcher) no suppression ever engages, and if the pipe
  drops mid-suppression the fallback to a local tray also clears the suppression so
  PopKey can never get stuck hidden.
