# PopKey

PopKey is a desktop-first **on-screen keystroke and mouse-action visualizer** built with Electron, React, Vite, Tailwind, and Zustand. It captures global keyboard and mouse input and renders animated key badges, a modifier bar, click ripples, and a scroll indicator over everything else on screen — useful for screencasts, tutorials, live demos, and pair programming.

## Stack

- Electron for the desktop shell, tray, and global shortcuts
- `uiohook-napi` for low-level global keyboard/mouse capture
- React + TypeScript for the renderer
- Vite and `electron-vite` for web and desktop builds
- Zustand for renderer state
- Tailwind CSS + Radix UI primitives for interface styling
- Framer Motion for badge and ripple animation

## Project Layout

- `src/main/index.ts`: Electron main process — tray, overlay window, global shortcut, settings sync
- `src/main/inputCapture.ts`: `uiohook-napi` bridge that forwards global input events to the renderer
- `src/preload/index.ts`: typed IPC bridge exposed as `window.electronAPI`
- `src/hooks/useInputCapture.ts`: renderer-side input event handling and badge lifecycle
- `src/components/InputHUD.tsx`: heads-up display that lays out the visualizers
- `src/components/KeyBadge.tsx`: individual key/shortcut badge
- `src/components/ModifierBar.tsx`: persistent modifier-key indicator
- `src/components/MouseRipple.tsx`: click ripple effect
- `src/components/ScrollIndicator.tsx`: scroll-wheel direction indicator
- `src/components/SystemTray.tsx`: in-app settings surface
- `src/store/useStore.ts`: renderer state (palette, theme, position, badge style, durations, toggles)
- `../pop-shared/`: the shared foundation at the repo root (UI primitives, hooks, config, lib), imported via the `@shared/*` alias

## Development

Install dependencies:

```sh
npm install
```

Run the browser experience (demo surface for settings/visualizers):

```sh
npm run dev
```

Run the Electron desktop app:

```sh
npm run dev:electron
```

Build the browser bundle / Electron app:

```sh
npm run build       # web bundle
npm run build:electron
```

Package a desktop build:

```sh
npm run package        # Windows (default)
npm run package:mac
npm run package:linux
```

Run the quality gates:

```sh
npm run typecheck
npm run lint
npm run test
```

## Usage

PopKey runs from the system tray. Toggle the on-screen overlay with the global shortcut (default **Alt+Shift+K**, **Cmd+Shift+K** on macOS). While active, every keypress appears as a badge, held modifiers show in the modifier bar, and — when enabled — mouse clicks render a ripple and scroll-wheel motion shows a direction indicator.

### Configuration (tray / settings)

- **Color palette**: muted, vibrant, retro, neon, pastel
- **Theme**: dark or light
- **Animation intensity**: low, medium, high
- **Display position**: any of six screen anchors, with fine X/Y offset
- **Scale**: overall size multiplier (auto-scales to monitor DPI)
- **Badge style**: flat, flat-outline, pop, pop-mono — with translucency, blur, and roundness controls
- **Badge behavior**: on-screen duration and maximum simultaneous badges
- **Inputs**: independently toggle keyboard, mouse clicks, and scroll-wheel visualization
- **Colors**: per-feature override colors for clicks and scrolls (or follow the palette)

## Notes

- Global input capture relies on `uiohook-napi`; on macOS the app needs Accessibility permission to observe input.
- Overlay/position behavior is centered on the primary display.
- Global shortcut registration can fail if another app already owns the accelerator.
- The web root is a functional demo surface, so some desktop settings are exposed there intentionally.
