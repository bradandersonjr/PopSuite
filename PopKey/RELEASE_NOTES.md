## PopKey — show every keystroke and click on screen

**PopKey** puts your keyboard and mouse on screen so your viewers can follow along.
It captures global key presses, shortcuts, clicks, and scrolls and renders them as
clean on-screen badges — ideal for screencasts, tutorials, live demos, and streams
where "wait, what did you just press?" is a constant question.

It draws over your entire screen, so the badges show up in any recording or
screen-share, on top of whatever app you're using.

### Highlights
- **Global keyboard capture** — every key and shortcut shown as a badge, system-wide (powered by uiohook)
- **Mouse click & scroll visualization** — click ripples and a scroll-direction indicator
- **Persistent modifier bar** — see Ctrl / Alt / Shift / Cmd held state at a glance
- **4 badge styles & 8 color palettes** — plus font and roundness controls
- **Dark / light themes**
- **Custom toggle shortcut**
- **Transparent overlay over any app**
- **Windows, macOS & Linux** — native Electron builds for all three

### Getting started
1. Download the installer for your platform below.
2. Install and launch PopKey — it lives in your system tray.
3. Toggle the overlay with your hotkey; press keys and click around to see the badges.
4. Open the tray menu (or settings) to pick badge style, palette, and position.

> **Note on permissions:** because PopKey watches global input, macOS will ask for
> **Accessibility / Input Monitoring** permission on first run (System Settings →
> Privacy & Security). Grant it so PopKey can see your keystrokes. It only displays
> them on your screen — nothing is logged, stored, or sent anywhere.

---

## Downloads

| Platform | File |
| --- | --- |
| **Windows** | `PopKey.Setup.*.exe` (one-click installer) |
| **macOS (Apple Silicon)** | `PopKey-*-arm64.dmg` |
| **macOS (Intel)** | `PopKey-*.dmg` |
| **Linux (AppImage)** | `PopKey-*.AppImage` |
| **Linux (Debian/Ubuntu)** | `PopKey_*_amd64.deb` |

---

## "Windows protected your PC" / "macOS can't open this" — and how to install anyway

**This is expected, and the app is safe.** PopKey is free and open source, but the
installers are **not code-signed yet.** Code-signing certificates cost money every
year (Windows ~$100–400/yr, Apple Developer $99/yr), and as a free project we haven't
bought them. Unsigned apps make your operating system show a scary-looking warning —
it's a *"we can't verify the publisher"* message, **not** a virus alert. You can read
every line of PopKey's source in this repo, or build it yourself, if you'd rather not
take our word for it.

Here's how to get past the warning on each platform:

### Windows — SmartScreen
1. Your browser may say the `.exe` "isn't commonly downloaded" — choose **Keep / Keep anyway**.
2. Run the installer. If you see a blue **"Windows protected your PC"** box:
   - Click **More info**
   - Click **Run anyway**

### macOS — Gatekeeper
After dragging PopKey to Applications, the first launch may say *"PopKey can't be
opened because Apple cannot check it for malicious software."*
- **Right-click** (or Control-click) **PopKey in Applications → Open → Open.** You only
  have to do this once.
- Or: **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.

If macOS instead says PopKey **"is damaged and can't be opened"**, that's the download
quarantine flag. Clear it in Terminal:
```sh
xattr -dr com.apple.quarantine /Applications/PopKey.app
```

(Remember to also grant **Input Monitoring / Accessibility** permission — see the note above.)

### Linux
- **AppImage:** make it executable, then run it:
  ```sh
  chmod +x PopKey-*.AppImage
  ./PopKey-*.AppImage
  ```
- **.deb:** `sudo dpkg -i PopKey_*_amd64.deb` (or double-click to open in your software center).

---

## Free & open source

PopKey is free forever. If it earns a spot in your recording setup, **PopSuite Pro**
($7 one-time) unlocks extra perks — custom color palettes, any system font, badge
enter/exit animations, and a branding watermark — and includes its sister app **PopJot**. It's open core: you *can* build the desktop app
yourself, and buying Pro is mostly a way to support development.

Found a bug or have an idea? [Open an issue](https://github.com/bradandersonjr/PopSuite/issues).
