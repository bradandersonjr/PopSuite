# app (PopSuite desktop shell)

`app/` builds the **PopSuite desktop app** — the single Electron binary that
ships PopJot and PopKey as one install. It is the only shipped desktop
deliverable; standalone per-app installers are deprecated. See the
[root README](../README.md) for how this fits into the repo's three product
surfaces (desktop app, websites, extensions).

## Architecture

One binary, two run modes, selected by an argv flag:

- **Launcher** (`PopSuite.exe`, no `--module` arg) — a resident, lightweight hub
  process. It creates the **single unified system tray icon** for the whole
  suite, spawns a detached child process per module (`--module=popjot`,
  `--module=popkey`), and stays alive listening on a local named pipe
  (`\\.\pipe\popsuite-tray` on Windows). Each module reports its state over
  that pipe (name, active, shortcut hints, annotating, etc.); the launcher
  builds one dynamic tray menu from whichever modules are currently connected
  and relays menu clicks back to the right module. The launcher owns **no**
  overlay/settings windows and never touches a module's window/focus/overlay
  behavior — it only relays.
- **Module** (`PopSuite.exe --module=<id>`) — boots that module's normal main
  process in this same executable: own userData, own single-instance lock, own
  overlay window, identical to the standalone app. Delegated to
  `src/main/<module>/index.ts` (loaded at runtime, not bundled at build time, so
  each module's bundle stays independent). It runs the shared app shell in
  `tray.mode: "reported"`, so it reports to the launcher instead of drawing its
  own OS tray icon.

Cross-module glue lives in the launcher (`src/main/index.ts`): PopJot reports
annotating on/off transitions up the pipe, and the launcher relays a `suppress`
command to PopKey, which force-hides its overlay while PopJot is active and
restores to the user's last requested state afterward. PopJot's Spotlight
presenter mode (dim-screen-except-cursor-circle, toggled via its own global
shortcut) reuses this same "annotating" signal, so PopKey auto-hides during
Spotlight too, and Spotlight/annotation are mutually exclusive with each other
in PopJot's own main process. This behavior is suite-only — it never engages
for standalone builds or a module run directly via `--module=` with no
launcher.

### Unified settings window

The launcher owns a single settings window (`src/main/suiteSettingsWindow.ts`)
instead of each module opening its own. It is one frameless `BaseWindow`
containing a thin tab-strip `WebContentsView` at the top plus one settings
`WebContentsView` per module, each loading that module's real settings
renderer. Only the active tab's view is visible; switching tabs re-lays-out the
views (attach/detach) rather than reloading, so scroll position and in-progress
form state survive flipping back and forth. Each hosted renderer's IPC is
tunneled over the suite pipe to its owning module process via a relay preload
(`src/main/suiteSettings/hostedPreload.ts`), so the real per-module settings
handlers keep running in the module process — nothing is duplicated in the
launcher. If a module isn't connected, its tab shows a placeholder instead of a
blank view. The tray's single "Settings" item opens this window.

### Fallback / resilience model

- **Module started without a launcher** (`--module=` run directly, or the
  launcher isn't running): the pipe connection fails immediately, so the module
  falls back to creating its own local tray icon and behaves exactly like the
  standalone app. This is the same fallback code path the standalone apps use
  by default (`tray.mode: "owned"`).
- **Launcher dies while modules are running**: the suite tray icon disappears;
  each connected module detects the dropped pipe and re-creates its own local
  tray icon (graceful degradation — no module is ever left without a tray). Any
  active PopJot->PopKey suppression is cleared at the same time, so PopKey can
  never get stuck hidden.
- A module's own single-instance lock and userData are independent of the
  launcher's. Per-module userData lives at `%APPDATA%/PopSuite/modules/popjot`
  and `.../modules/popkey`; the launcher's own single-instance lock lives at
  `%APPDATA%/PopSuite` (no `modules/` segment). Settings sync between modules
  still flows through `~/.popsuite/<app>.json` and `~/.popsuite/shared.json`,
  independent of userData isolation.

## Development

From the repo root:

```sh
npm run dev:suite           # both modules' electron-vite dev servers, in parallel
npm run typecheck:suite     # tsc --noEmit for app/
```

Or per-module, from the repo root or inside `app/`:

```sh
npm run dev:popjot --prefix app
npm run dev:popkey --prefix app
```

These run each module through the suite's own `electron.vite.<module>.ts`
config, without the launcher/tray-owner process. To exercise a module the same
way the standalone app runs it in dev (with its own tray), use the app's own
workflow instead: `npm run dev:module:popjot` / `dev:module:popkey` from the
repo root, or `npm run dev:electron` inside `app/modules/popjot/` or
`app/modules/popkey/`.

## Build / package

```sh
npm run build:suite          # from repo root: builds both modules + the launcher bundle
npm run package:suite        # from repo root: build + electron-builder (Windows NSIS installer)
```

Equivalent commands run directly inside `app/`:

```sh
npm run build --prefix app          # build:popjot + build:popkey + build:launcher
npm run package:win --prefix app    # build + electron-builder --win
```

Packaged output lands in `app/release/` (e.g.
`release/PopSuite Setup 1.0.0.exe`, `release/win-unpacked/PopSuite.exe`) per
`electron-builder.yml`'s `directories.output: release`. Per-module tray/app
icons and the launcher's own unified tray icon are copied in as
`extraResources` under `popjot/`, `popkey/`, and `suite/` inside the packaged
resources dir. `uiohook-napi`'s native binding (PopKey's input hook) is
unpacked from the asar via `asarUnpack` so it can be loaded at runtime; the
PopJot module bundle contains no reference to it.

macOS (dmg, universal) and Linux (AppImage) targets are also configured in
`electron-builder.yml`. `package`/`package:win` build the Windows NSIS
installer; the CI release workflow (`.github/workflows/release.yml`) additionally
builds and publishes the macOS dmg and Linux AppImage via `publish:mac` /
`publish:linux`, run on `macos-latest` / `ubuntu-latest` runners. Both are
currently **unsigned** — no Apple signing identity and no Linux code-signing
cert — so macOS requires a right-click -> Open on first launch and
`electron-updater` auto-checks are restricted to Windows (see
`app/src/main/updater.ts`); manual "Check for Updates" still works on every
platform.

## Manual verification

GUI/tray behavior (unified tray, module toggles, launcher fallback, PopJot/PopKey
suppression, login-item registration, etc.) can't be exercised headlessly. After
`npm run package:suite`, walk the full checklist in
[`MANUAL_VERIFICATION.md`](MANUAL_VERIFICATION.md) on a normal desktop session.
