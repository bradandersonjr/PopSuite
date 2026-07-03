## PopJot — draw on your screen, live

**PopJot** is a transparent screen-annotation overlay. Tap your hotkey and a drawing
canvas appears on top of everything — circle a button, underline a line of code,
sketch an arrow — your audience sees it in real time. Tap the hotkey again and it all
vanishes. Nothing is captured or saved; it's purely live, temporary ink over your
screen.

Perfect for tutorials, screen-shares, code reviews, and any Zoom / Teams / Discord
call where you want to point at things instead of saying "the button on the left… no,
the other one."

### Highlights
- ✏️ **Marker, pen & highlighter** — three tools with pressure-style strokes (powered by perfect-freehand)
- 🎯 **Radial tool menu** — pop a wheel under your cursor to switch tool, color, and size without leaving the canvas
- 🎨 **8 color palettes & 4 menu styles** — make it yours
- 🌗 **Dark / light themes & animations**
- ⌨️ **Custom keyboard shortcuts** — bind the overlay toggle and tools to whatever fits your muscle memory
- 🪟 **Transparent overlay over any app** — works on top of browsers, editors, slides, video calls
- 💻 **Windows, macOS & Linux** — native Electron builds for all three

### Getting started
1. Download the installer for your platform below.
2. Install and launch PopJot — it lives in your system tray.
3. Press the toggle hotkey to drop the overlay over your screen, and start drawing.
4. Open the tray menu (or settings) to set your hotkey, palette, and menu style.

---

## Downloads

| Platform | File |
| --- | --- |
| **Windows** | `PopJot.Setup.*.exe` (one-click installer) |
| **macOS (Apple Silicon)** | `PopJot-*-arm64.dmg` |
| **macOS (Intel)** | `PopJot-*.dmg` |
| **Linux (AppImage)** | `PopJot-*.AppImage` |
| **Linux (Debian/Ubuntu)** | `PopJot_*_amd64.deb` |

---

## ⚠️ "Windows protected your PC" / "macOS can't open this" — and how to install anyway

**This is expected, and the app is safe.** PopJot is free and open source, but the
installers are **not code-signed yet.** Code-signing certificates cost money every
year (Windows ~$100–400/yr, Apple Developer $99/yr), and as a free project we haven't
bought them. Unsigned apps make your operating system show a scary-looking warning —
it's a *"we can't verify the publisher"* message, **not** a virus alert. You can read
every line of PopJot's source in this repo, or build it yourself, if you'd rather not
take our word for it.

Here's how to get past the warning on each platform:

### Windows — SmartScreen
1. Your browser may say the `.exe` "isn't commonly downloaded" — choose **Keep / Keep anyway**.
2. Run the installer. If you see a blue **"Windows protected your PC"** box:
   - Click **More info**
   - Click **Run anyway**

### macOS — Gatekeeper
After dragging PopJot to Applications, the first launch may say *"PopJot can't be
opened because Apple cannot check it for malicious software."*
- **Right-click** (or Control-click) **PopJot in Applications → Open → Open.** You only
  have to do this once.
- Or: **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.

If macOS instead says PopJot **"is damaged and can't be opened"**, that's the download
quarantine flag. Clear it in Terminal:
```sh
xattr -dr com.apple.quarantine /Applications/PopJot.app
```

### Linux
- **AppImage:** make it executable, then run it:
  ```sh
  chmod +x PopJot-*.AppImage
  ./PopJot-*.AppImage
  ```
- **.deb:** `sudo dpkg -i PopJot_*_amd64.deb` (or double-click to open in your software center).

---

## Free & open source

PopJot is free forever. If it saves you time, **PopSuite Pro** ($7 one-time) unlocks
extra perks — custom color palettes, a custom radial-menu center icon, and a scalable
center shape — and includes its sister app **PopKey**. It's open core: you *can* build
the desktop app yourself, and buying Pro is mostly a way to support development. 💛

Found a bug or have an idea? [Open an issue](https://github.com/bradandersonjr/PopSuite/issues).
