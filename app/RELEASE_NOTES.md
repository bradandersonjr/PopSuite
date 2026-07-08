# PopSuite 1.0.0

PopSuite is a single desktop install for two small, focused tools: **PopJot**
(screen annotation) and **PopKey** (keystroke and mouse visualizer). One
installer, one tray icon, one settings window — each app still runs as its
own independent process underneath.

This is the first release of the unified suite. Previously PopJot and PopKey
shipped as separate installers; this release replaces both with a single
download.

## What's in PopSuite 1.0.0

### The Suite
- One installer for both apps — download once, get PopJot and PopKey together
- A single unified system tray icon with a toggle for each app
- One settings window with a PopJot tab and a PopKey tab that switch instantly, no reload
- Cross-app settings sync — opt in per setting (via a Sync tab) to keep shared values, like color palette, aligned between the two apps
- PopKey automatically hides its overlay while PopJot is annotating or in Spotlight mode, and restores itself the moment PopJot stops
- Settings persist locally across sessions; nothing is uploaded anywhere
- Automatic background updates on Windows, plus a manual "Check for Updates" on every platform

### PopJot
- Transparent, fullscreen drawing overlay — hold Alt+Shift+A (Cmd+Shift+A on macOS) for a momentary overlay, or press Alt+Shift+S (Cmd+Shift+S) to toggle a persistent one
- Radial tool menu: marker, pen, highlighter, eraser, and background/whiteboard modes, all picked in one continuous gesture
- Live or snapshot overlay modes, canvas grid options, 4 menu styles, 8 color palettes, dark/light themes
- **New: Spotlight presenter mode** (Alt+Shift+D, Cmd+Shift+D) — dims the whole screen except a soft circle that follows your cursor. Scroll the wheel to resize the circle live, with adjustable soft-edge and dim-strength sliders. Press Escape to exit. Spotlight and drawing mode are mutually exclusive.
- Optional branding overlay

### PopKey
- On-screen keystroke and mouse visualizer for screencasts, streams, and demos
- 8 color palettes, badge position and scale controls, translucency and roundness options
- Toggle the overlay with Alt+Shift+K (Cmd+Shift+K on macOS)
- Auto-hides while PopJot is annotating or in Spotlight mode (its own branding overlay, if enabled, stays visible)

## Downloads

Grab the build for your platform from the assets below, or always get the
latest at [github.com/bradandersonjr/PopSuite/releases/latest](https://github.com/bradandersonjr/PopSuite/releases/latest).

| Platform | Asset |
| --- | --- |
| Windows | `PopSuite Setup 1.0.0.exe` |
| macOS (Intel + Apple Silicon) | `PopSuite-1.0.0.dmg` |
| Linux | `PopSuite-1.0.0.AppImage` |

### Windows

Run the installer. It's signed, so it installs like any normal Windows app,
and it checks for updates automatically in the background.

### macOS

The build is currently **unsigned** (no Apple Developer signing identity yet),
so Gatekeeper will refuse a normal double-click launch the first time. To open it:

1. Open the `.dmg` and drag PopSuite to Applications.
2. In Applications, **right-click (or Control-click) PopSuite -> Open**, then confirm **Open** in the dialog that appears. You only need to do this once.
3. If macOS instead says the app "is damaged and can't be opened," that's the download quarantine flag — clear it from Terminal:
   ```sh
   xattr -dr com.apple.quarantine /Applications/PopSuite.app
   ```
4. PopKey (and PopJot's Spotlight scroll-to-resize) need Accessibility permission to see global keyboard/mouse input — macOS will prompt for it; you may need to restart the app after granting it.

### Linux

Download the AppImage, make it executable, and run it:

```sh
chmod +x PopSuite-1.0.0.AppImage
./PopSuite-1.0.0.AppImage
```

## Update behavior

- **Windows** — checks for updates in the background and downloads silently. When ready, the tray menu shows "Restart to Update"; click it to install and relaunch.
- **macOS / Linux** — automatic background updates are disabled by design on these unsigned builds. Use **Launch Preferences -> Check for Updates** from the tray to check and download manually.
- On every platform, the manual **Check for Updates** action reports back if you're already current.

## Known limitations

- **macOS and Linux builds are unsigned.** They work, but expect the Gatekeeper/SmartScreen-style friction described above on first launch.
- **macOS auto-update is disabled by design.** Unsigned builds can't be reliably auto-installed by `electron-updater`; use manual "Check for Updates" instead.
- **macOS requires Accessibility permission** for PopKey's input capture and for PopJot's Spotlight scroll-to-resize. Without it, PopKey won't see keystrokes/clicks, and Spotlight's scroll-resize will silently do nothing (Spotlight itself still dims and follows the cursor).
- **macOS and Linux are early and untested on real hardware.** Both builds come from CI, not from a machine we've verified against by hand. If something doesn't work as expected, please open an issue — this is exactly the kind of feedback that helps.

Found a bug or have an idea? [Open an issue](https://github.com/bradandersonjr/PopSuite/issues).
