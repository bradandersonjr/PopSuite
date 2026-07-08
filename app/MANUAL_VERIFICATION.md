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
