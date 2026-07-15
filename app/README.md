# app (PopSuite desktop runtime)

The app package builds the single shipped PopSuite desktop application. PopJot
and PopKey remain independent websites and independent UI modules, but the
desktop installation now uses one Electron main runtime.

## Architecture

The unified main process creates two separate native BrowserWindows:

- PopJot owns its transparent annotation window, focus lifecycle, mouse-input
  policy, preload, renderer, settings state, and global shortcuts.
- PopKey owns its transparent visualization window, click-through behavior,
  preload, renderer, settings state, and global shortcut.

The windows are not combined or layered into one shared renderer. Each module
uses a dedicated persistent Chromium session partition and namespaced IPC
channels, so a PopJot message cannot be handled by PopKey and vice versa.
Sharing the main process reduces duplicated Chromium services while preserving
the same two-tool interaction model.

The main process also owns the unified tray, updater, tabbed settings shell, and
cross-tool coordination. PopJot annotation or Spotlight activity temporarily
suppresses PopKey, then restores the previous requested PopKey state. Module
state still travels through the suite coordinator, but both module runtimes now
live inside the same Electron process.

### Unified settings window

Settings uses one desktop-only BrowserWindow, one preload, and one React
renderer. Its PopJot and PopKey tabs mount the selected tool's settings panel
against that tool's namespaced IPC bridge. Switching tabs does not merge tool
state, and closing Settings destroys this renderer so its helper process can be
reclaimed. The two overlay windows stay separate throughout.

### Native input ownership

PopKey needs the native uIOhook listener for its lifetime. PopJot uses the same
native singleton only while Spotlight wheel-resize is active. A shared
reference-counted owner keeps PopJot from stopping PopKey capture when
Spotlight exits.

### Failure model

There is one desktop single-instance lock and one updater lifecycle. A fatal
main-process failure can now affect both tools; renderer failures remain
isolated by window. Standalone per-module development commands are retained for
debugging either tool independently.

The two public websites are unchanged and continue to build independently from
their WebRoot entry points.

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
npm run build --prefix app          # build:popjot + build:popkey + build:settings + build:launcher
npm run package:win --prefix app    # build + electron-builder --win
```

Packaged output lands in `app/release/` (e.g.
`release/PopSuite Setup <version>.exe`, `release/win-unpacked/PopSuite.exe`) per
`electron-builder.yml`'s `directories.output: release`. Per-module tray/app
icons and the launcher's own unified tray icon are copied in as
`extraResources` under `popjot/`, `popkey/`, and `suite/` inside the packaged
resources dir. `uiohook-napi`'s native binding (PopKey's input hook) is
unpacked from the asar so the shared PopKey/Spotlight input-hook owner can
load it at runtime.

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
