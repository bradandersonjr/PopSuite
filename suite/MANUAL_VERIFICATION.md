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

1. **Launcher spawns both modules.**
   Double-click `PopSuite.exe`. Within a second or two, BOTH tray icons appear
   (PopJot and PopKey). In Task Manager you should see two `PopSuite.exe`
   processes (one per module); the original launcher process has exited.

2. **Each module's tray icon and UX are unchanged.**
   Right-click each tray icon — PopJot shows its "Open Settings / Enable-Disable
   PopJot / About / Quit" menu; PopKey shows its menu with double-click-opens-
   settings. Open each Settings window; confirm the correct app's UI loads
   (PopJot's radial/annotation settings vs PopKey's badge/branding settings) and
   that tray icons render (icons resolve from `resources/popjot|popkey/`).

3. **PopJot annotation activation / focus works with PopKey running (CRITICAL
   REGRESSION TEST).**
   With BOTH modules running, press PopJot's activate hotkey (Alt+Shift+A).
   The radial menu should appear and STAY active — draw a stroke, confirm the
   overlay holds focus and does not collapse on blur. This is the exact failure
   mode of the abandoned single-process merge; because each module now has its
   own process with exactly one overlay window, it must behave identically to
   standalone PopJot. Also test persistent mode (Alt+Shift+S).

4. **Killing one module leaves the other running.**
   In Task Manager, end one `PopSuite.exe` process (or Quit one app from its
   tray). The other module keeps running normally — its tray stays, its hotkeys
   still fire.

5. **Settings sync still flows between modules.**
   In one app's Settings > Sync tab, enable a synced key (e.g. a shared style or
   branding value) and change it. Confirm the sibling app picks up the change
   live. Both modules read/write `~/.popsuite/<app>.json` and
   `~/.popsuite/shared.json` (under your home dir, NOT userData), so per-module
   userData isolation does not affect sync.

6. **Single-instance behavior on relaunch.**
   With both modules already running, double-click `PopSuite.exe` again. Each
   module's own single-instance lock (now under
   `%APPDATA%/PopSuite/modules/<module>`) causes the freshly spawned child to
   lose the lock and quit cleanly, and the running instance handles the
   second-instance event (PopJot focuses its overlay; PopKey opens its settings).
   You should NOT get duplicate tray icons or duplicate processes.

7. **PopKey input capture works; PopJot never loads the native hook.**
   Confirm PopKey visualizes keystrokes/clicks (uiohook-napi is unpacked at
   `resources/app.asar.unpacked/.../win32-x64/uiohook-napi.node`). The PopJot
   module process must NOT load uiohook — its bundle contains zero references to
   it (verified at build time).

## Notes

- Per-module userData lives at `%APPDATA%/PopSuite/modules/popjot` and
  `.../modules/popkey`. Delete these to reset a module's local state; the shared
  sync files under `~/.popsuite` are separate.
- Licensing is untouched: both modules use the `suite` Pro product and the same
  offline license layer as the standalone apps.
