# PopSuite single-install — manual verification checklist

The suite build, path resolution, native-module packaging, and argv routing are
verified headlessly (see the final report). GUI behavior could not be exercised
from the build agent (launching an Electron GUI there crashes at startup — a
known environmental issue, not a code bug). Run these checks on a normal Windows
desktop session after installing `release/PopSuite Setup 1.0.0.exe` (or launching
`release/win-unpacked/PopSuite.exe`).

Build the package first:

```
npm run package:suite      # from repo root, or: npm run package:win --prefix suite
```

## Checklist

### Unified suite tray (single icon)

1. **Exactly ONE suite tray icon.**
   Double-click `PopSuite.exe`. Within a second or two, exactly ONE tray icon
   appears (PopSuite), NOT one per module. In Task Manager you should see THREE
   `PopSuite.exe` processes: the resident launcher/tray-owner plus one child per
   module (popjot, popkey). The launcher no longer exits after spawning — it
   stays alive to own the tray.

2. **Menu reflects both modules once both are running.**
   Left- or right-click the suite tray icon. The menu shows, top to bottom:
   a disabled "PopSuite" title, a checkbox toggle per connected module
   ("Disable PopJot  (Alt+Shift+A)", "Disable PopKey  (Alt+Shift+K)") with a
   checkmark when the module is active, a "PopJot Options" / "PopKey Options"
   submenu (Open Settings, About), and finally "Quit All". Modules appear only
   once they have connected over the pipe; the list updates live as modules
   connect/disconnect.

3. **Toggling from the tray menu activates/deactivates the correct module.**
   Click "Disable PopJot" — PopJot's shortcuts suspend and its checkbox clears;
   click again to re-enable. Do the same for PopKey (its visualizer toggles).
   Confirm toggling one module never affects the other. Toggle a module via its
   own hotkey instead and re-open the menu: the checkmark/label reflects the new
   state (state is pushed back to the launcher over the pipe).

4. **Per-module settings entries open the correct window.**
   From "PopJot Options > Open Settings" the PopJot settings window opens; from
   "PopKey Options > Settings" the PopKey settings window opens. "About" in each
   submenu shows that module's About box.

5. **Quit All exits everything.**
   Click "Quit All". Both module processes and the launcher/tray-owner exit; the
   tray icon disappears and no `PopSuite.exe` processes remain in Task Manager.

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

8. **Standalone PopJot.exe / PopKey.exe are unaffected.**
   The standalone builds still create their own independent tray icons and menus
   exactly as before — the unified tray is suite-only (`tray.mode: "reported"` is
   passed only by the suite module entries; standalone omits it, defaulting to
   "owned").

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
